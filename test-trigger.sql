-- Simple test to verify the database trigger works
-- This should trigger the Edge Function automatically

-- First, let's check if our tables exist
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%receipt%'
ORDER BY table_name;

-- Now insert a simple test receipt
INSERT INTO public.raw_pos_receipts (
  bar_id,
  device_id,
  timestamp,
  text,
  created_at
) VALUES (
  '438c80c1-fe11-4ac5-8a48-2fc45104ba31',
  'test-device',
  NOW(),
  'Test Receipt
Total: KES 100
Item 1 x 1 = 50
Item 2 x 1 = 50',
  NOW()
) 
RETURNING id, created_at;

-- Wait 2 seconds, then check if parsing was triggered
-- (You'll need to run this separately after waiting)
SELECT 
  id,
  status,
  total,
  parsing_method,
  confidence_score,
  created_at
FROM public.pos_receipts 
WHERE bar_id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'
ORDER BY created_at DESC LIMIT 1;
