-- Test receipt insertion with your actual receipt format
-- This will test the parsing with real data

INSERT INTO public.raw_pos_receipts (
  bar_id,
  device_id,
  timestamp,
  text,
  escpos_bytes,
  created_at
) VALUES (
  '438c80c1-fe11-4ac5-8a48-2fc45104ba31',
  'driver-MIHI-PC',
  NOW(),
  '           CAPTAIN''S ORDER
        POPOS LOUNGE & GRILL
--------------------------------
Table No: 
Captain: John
Date: 07-Feb-2026
Time: 8:45 PM
--------------------------------

QTY   ITEM
--------------------------------
3     Tusker Lager 500ml Kes 250, Kes 750
2     Smirnoff Vodka 250ml Kes 450, Kes 900
1     Nyama Choma (Goat) 1kg Kes 780
1     Kachumbari Kes 100
--------------------------------

Total: Kes 2530

--------------------------------
Order Type: DINE-IN
--------------------------------

Signature (Captain): ___________
--------------------------------',
  'VGVzdCBFU0MvUE9TIGRhdGEgZm9yIFBvcG9zIExvdW5nZSByZWNlaXB0',
  NOW()
);

-- Check if parsing was triggered and results
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

-- Also check the items if parsing succeeded
SELECT 
  item_name,
  quantity,
  unit_price,
  total_price
FROM public.pos_receipt_items 
WHERE receipt_id IN (
  SELECT id FROM public.pos_receipts 
  WHERE bar_id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'
  ORDER BY created_at DESC LIMIT 1
);
