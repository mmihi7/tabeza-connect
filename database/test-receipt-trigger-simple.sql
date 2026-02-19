-- Simple Test for Receipt Parsing Trigger
-- Run this in Supabase SQL Editor

-- Insert a simple test receipt (single line, no multi-line issues)
INSERT INTO raw_pos_receipts (
  bar_id,
  device_id,
  timestamp,
  text,
  metadata
) VALUES (
  (SELECT id FROM bars LIMIT 1),
  'test-device-simple-001',
  NOW(),
  'TEST RECEIPT | Tusker Lager 2x250.00=500.00 | Nyama Choma 1x800.00=800.00 | SUBTOTAL 1300.00 | TAX 208.00 | TOTAL KES 1508.00',
  '{"source": "simple_test", "jobId": "test-123"}'::jsonb
)
RETURNING id, bar_id, device_id, created_at;

-- Wait 2-3 seconds, then check if it was processed:

-- 1. Check raw receipt was inserted
SELECT id, device_id, LEFT(text, 50) as text_preview
FROM raw_pos_receipts
WHERE device_id = 'test-device-simple-001';

-- 2. Check if pg_net made HTTP request
SELECT *
FROM net._http_response 
ORDER BY id DESC 
LIMIT 3;

-- 3. Check if parsed receipt was created (wait 3-5 seconds)
SELECT 
  pr.id,
  pr.status,
  pr.parsing_method,
  pr.confidence_score,
  pr.total
FROM pos_receipts pr
JOIN raw_pos_receipts rpr ON pr.raw_receipt_id = rpr.id
WHERE rpr.device_id = 'test-device-simple-001';

-- Cleanup
DELETE FROM pos_receipts 
WHERE raw_receipt_id IN (
  SELECT id FROM raw_pos_receipts WHERE device_id = 'test-device-simple-001'
);

DELETE FROM raw_pos_receipts WHERE device_id = 'test-device-simple-001';
