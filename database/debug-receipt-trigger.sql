-- Debug Receipt Trigger Issue
-- Run these queries to understand what's happening

-- 1. Check if receipt was inserted
SELECT id, bar_id, device_id, LEFT(text, 50) as text_preview, created_at
FROM raw_pos_receipts
WHERE device_id LIKE 'test-%'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check what the trigger sent to Edge Function
SELECT 
  id,
  status_code,
  content,
  created
FROM net._http_response 
ORDER BY id DESC 
LIMIT 3;

-- 3. Check Edge Function logs in Supabase Dashboard
-- Go to: Edge Functions → parse-receipt → Logs
-- Look for console.log output showing what receipt_id was received

-- 4. Test the Edge Function directly with a known receipt ID
-- First, get a receipt ID:
SELECT id FROM raw_pos_receipts ORDER BY created_at DESC LIMIT 1;

-- Then test calling the Edge Function manually:
-- (Replace YOUR_RECEIPT_ID with actual ID from above)
/*
curl -X POST 'https://bkaigyrrzsqbfscyznzw.supabase.co/functions/v1/parse-receipt' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrYWlneXJyenNxYmZzY3l6bnp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjQxNjIsImV4cCI6MjA4MTY0MDE2Mn0.9TRx4tjxTVh-ASDtjBdtWqB5TEZbz_OukzKXx79Ru_s' \
  -H 'Content-Type: application/json' \
  -d '{"receipt_id": "YOUR_RECEIPT_ID"}'
*/

-- 5. Check if there's a timing issue (trigger fires before INSERT commits)
-- The trigger might be sending the receipt_id before the row is visible to other transactions

-- 6. Verify the trigger is using the correct receipt ID
-- Check trigger function:
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'trigger_receipt_parsing';
