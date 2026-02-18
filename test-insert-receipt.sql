-- Test receipt insertion for parsing
-- This simulates what TabezaConnect would do

INSERT INTO public.raw_pos_receipts (
  bar_id,
  device_id,
  raw_text,
  escpos_data,
  created_at
) VALUES (
  '438c80c1-fe11-4ac5-8a48-2fc45104ba31',
  'driver-MIHI-PC',
  '========================================
         TABEZA TEST BAR
         NAIROBI, KENYA
========================================
Date: 18/02/2026
Time: 13:05:00
Cashier: John
Table: T12
========================================

QTY  ITEM                      PRICE     TOTAL
2x   Tusker Lager 500ml        250.00    500.00
1x   Nyama Choma (Half Kg)     800.00    800.00
3x   Pilsner 500ml             200.00    600.00
1x   Chips Masala              150.00    150.00
2x   Soda (Coke)               80.00     160.00
1x   Sukuma Wiki               120.00    120.00
========================================
SUBTOTAL:                     2330.00
VAT (16%):                    372.80
TOTAL:                       KES 2702.80
========================================

PAYMENT METHOD:
CASH:                         2702.80
CHANGE:                       0.00

Thank you for visiting!
See you again soon!
========================================',
  'VGVzdCBFU0MvUE9TIGRhdGEgZm9yIHRlc3QgcmVjZWlwdA==',
  NOW()
);

-- Check if parsing was triggered
SELECT * FROM public.pos_receipts 
WHERE bar_id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'
ORDER BY created_at DESC LIMIT 5;
