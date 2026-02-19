-- Test Receipt Parsing Trigger
-- Purpose: Test that the trigger automatically invokes the Edge Function when a raw receipt is inserted
-- Date: 2024

-- ============================================================================
-- STEP 1: GET A TEST BAR ID
-- ============================================================================

-- First, let's see what bars exist
SELECT id, name, slug FROM bars LIMIT 5;

-- Copy one of the bar IDs from above and use it in the test below
-- Or use this query to get the first bar ID:
DO $$
DECLARE
  test_bar_id UUID;
BEGIN
  SELECT id INTO test_bar_id FROM bars LIMIT 1;
  
  IF test_bar_id IS NULL THEN
    RAISE EXCEPTION 'No bars found in database. Please create a bar first.';
  END IF;
  
  RAISE NOTICE 'Using test bar ID: %', test_bar_id;
END $$;

-- ============================================================================
-- STEP 2: INSERT TEST RECEIPT (This will trigger the Edge Function)
-- ============================================================================

-- Replace 'YOUR-BAR-ID-HERE' with an actual bar ID from Step 1
INSERT INTO raw_pos_receipts (
  bar_id,
  device_id,
  timestamp,
  text,
  metadata
) VALUES (
  (SELECT id FROM bars LIMIT 1), -- Uses first bar automatically
  'test-device-trigger-001',
  NOW(),
  $$TEST RECEIPT - TRIGGER TEST
================================
Captain's Bar & Grill
123 Main Street
Nairobi, Kenya

Receipt #: TEST-001
Date: 2024-02-18 18:15:00

ITEMS:
--------------------------------
Tusker Lager      2   250.00   500.00
Nyama Choma       1   800.00   800.00
Chips Masala      1   200.00   200.00
--------------------------------
SUBTOTAL                      1,500.00
VAT (16%)                       240.00
SERVICE CHARGE (10%)            150.00
--------------------------------
TOTAL            KES          1,890.00
================================

Thank you for your visit!$$,
  jsonb_build_object(
    'source', 'trigger_test',
    'jobId', 'test-job-' || EXTRACT(EPOCH FROM NOW())::TEXT,
    'fileSize', 1024,
    'printerName', 'Test Thermal Printer'
  )
)
RETURNING id, bar_id, device_id, created_at;

-- ============================================================================
-- STEP 3: VERIFY TRIGGER FIRED
-- ============================================================================

-- Wait 2-3 seconds for the Edge Function to process, then run these queries:

-- 3.1: Check if raw receipt was inserted
SELECT 
  id,
  bar_id,
  device_id,
  created_at,
  LEFT(text, 50) || '...' as text_preview
FROM raw_pos_receipts
WHERE device_id = 'test-device-trigger-001'
ORDER BY created_at DESC
LIMIT 1;

-- 3.2: Check pg_net request queue (to see if HTTP request was made)
-- This shows the trigger called the Edge Function
-- Note: Column names may vary by pg_net version, try this query:
SELECT *
FROM net._http_response 
ORDER BY id DESC 
LIMIT 5;

-- Or if the table doesn't exist or is empty, check the request log:
-- SELECT * FROM net.http_request_queue ORDER BY id DESC LIMIT 5;

-- 3.3: Check if parsed receipt was created (wait 3-5 seconds after insert)
SELECT 
  pr.id,
  pr.raw_receipt_id,
  pr.status,
  pr.parsing_method,
  pr.confidence_score,
  pr.total,
  pr.currency,
  pr.created_at
FROM pos_receipts pr
JOIN raw_pos_receipts rpr ON pr.raw_receipt_id = rpr.id
WHERE rpr.device_id = 'test-device-trigger-001'
ORDER BY pr.created_at DESC
LIMIT 1;

-- 3.4: Check parsed receipt items (if parsing succeeded)
SELECT 
  pri.line_number,
  pri.quantity,
  pri.item_name,
  pri.unit_price,
  pri.total_price
FROM pos_receipt_items pri
JOIN pos_receipts pr ON pri.receipt_id = pr.id
JOIN raw_pos_receipts rpr ON pr.raw_receipt_id = rpr.id
WHERE rpr.device_id = 'test-device-trigger-001'
ORDER BY pri.line_number;

-- ============================================================================
-- STEP 4: CHECK EDGE FUNCTION LOGS (In Supabase Dashboard)
-- ============================================================================

-- Go to: Supabase Dashboard → Edge Functions → parse-receipt → Logs
-- Look for:
-- - Incoming POST request from the trigger
-- - Receipt parsing logs (🔍 Parsing receipt: ...)
-- - Success or failure messages

-- ============================================================================
-- EXPECTED RESULTS
-- ============================================================================

-- ✅ Step 3.1: Should show 1 raw receipt with device_id 'test-device-trigger-001'
-- ✅ Step 3.2: Should show HTTP POST request to parse-receipt Edge Function
-- ✅ Step 3.3: Should show 1 parsed receipt with:
--    - status: 'UNCLAIMED' (if parsing succeeded) or 'PARSE_FAILED' (if both regex and AI failed)
--    - parsing_method: 'regex' or 'ai'
--    - confidence_score: 0.00 to 1.00
--    - total: 1890.00
-- ✅ Step 3.4: Should show 3 line items (Tusker, Nyama Choma, Chips Masala)

-- ============================================================================
-- CLEANUP (Optional - run after testing)
-- ============================================================================

-- Delete test data
DELETE FROM pos_receipt_items 
WHERE receipt_id IN (
  SELECT pr.id FROM pos_receipts pr
  JOIN raw_pos_receipts rpr ON pr.raw_receipt_id = rpr.id
  WHERE rpr.device_id = 'test-device-trigger-001'
);

DELETE FROM pos_receipts 
WHERE raw_receipt_id IN (
  SELECT id FROM raw_pos_receipts 
  WHERE device_id = 'test-device-trigger-001'
);

DELETE FROM raw_pos_receipts 
WHERE device_id = 'test-device-trigger-001';

-- Verify cleanup
SELECT COUNT(*) as remaining_test_receipts
FROM raw_pos_receipts 
WHERE device_id = 'test-device-trigger-001';
-- Should return 0

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- If trigger didn't fire:
-- 1. Check trigger exists:
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'trigger_parse_receipt_on_insert';
-- Should show: trigger_parse_receipt_on_insert | O (enabled)

-- 2. Check pg_net extension:
SELECT * FROM pg_extension WHERE extname = 'pg_net';
-- Should show 1 row

-- 3. Check trigger function:
SELECT proname FROM pg_proc WHERE proname = 'trigger_receipt_parsing';
-- Should show: trigger_receipt_parsing

-- If Edge Function wasn't called:
-- 1. Check PostgreSQL logs for NOTICE or WARNING messages
-- 2. Verify Edge Function is deployed: Supabase Dashboard → Edge Functions
-- 3. Test Edge Function directly with curl:
--    curl -X POST https://bkaigyrrzsqbfscyznzw.supabase.co/functions/v1/parse-receipt \
--      -H "Authorization: Bearer sb_publishable_-RItbICa9f_G0IpfwZ3vig_FLw0-FR2" \
--      -H "Content-Type: application/json" \
--      -d '{"receipt_id": "test-receipt-id"}'

-- If parsing failed:
-- 1. Check if template exists for the bar:
SELECT id, bar_id, version, active 
FROM receipt_parsing_templates 
WHERE bar_id = (SELECT id FROM bars LIMIT 1);
-- If no template exists, parsing will fail (expected for first test)

-- 2. Check parse failures:
SELECT * FROM pos_parse_failures 
ORDER BY created_at DESC 
LIMIT 5;

