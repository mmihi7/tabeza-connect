# Quick Deployment Guide: Receipt Trigger & Delete Function

## What You're Deploying

1. **Receipt Parsing Trigger** - Automatically parses receipts when inserted
2. **Receipt Delete Function** - Allows staff to soft-delete unclaimed receipts

## Deployment Steps

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase Dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**

---

### Step 2: Deploy Receipt Parsing Trigger

**Copy this entire file and paste into SQL Editor:**

📁 **File**: `Tabz/database/create-receipt-parsing-trigger.sql`

**The configuration is hardcoded in the trigger function:**
- ✅ Edge Function URL: `https://bkaigyrrzsqbfscyznzw.supabase.co/functions/v1/parse-receipt`
- ✅ Publishable Key: Your `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `.env.local`

**Just copy the entire file and run it!** No configuration needed.

Click **Run** (or press Ctrl+Enter / Cmd+Enter)

**Expected Result**: ✅ "Success. No rows returned"

**Note**: If you change your Supabase URL or publishable key in the future, you'll need to update the trigger function and redeploy it.

---

### Step 3: Deploy Receipt Delete Function

**Copy this entire file and paste into SQL Editor:**

📁 **File**: `Tabz/database/create-receipt-delete-function.sql`

Click **Run**

**Expected Result**: ✅ "Success. No rows returned"

---

### Step 4: Verify Installation

Run these verification queries:

```sql
-- 1. Check trigger exists
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name
FROM pg_trigger 
WHERE tgname = 'trigger_parse_receipt_on_insert';
-- Expected: 1 row showing trigger on raw_pos_receipts

-- 2. Check delete function exists
SELECT proname 
FROM pg_proc 
WHERE proname = 'soft_delete_unclaimed_receipt';
-- Expected: 1 row

-- 3. Check new columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pos_receipts' 
AND column_name IN ('voided_at', 'voided_by_staff_id');
-- Expected: 2 rows
```

---

## Testing

### Test 1: Receipt Parsing Trigger

```sql
-- Insert a test receipt (replace 'your-bar-id' with actual bar UUID)
INSERT INTO raw_pos_receipts (bar_id, device_id, timestamp, text, metadata)
VALUES (
  'your-bar-id-uuid',
  'test-device',
  NOW(),
  'TEST RECEIPT
Item 1  2  10.00  20.00
TOTAL  KES 20.00',
  '{"source": "test"}'::jsonb
);

-- Wait 2-3 seconds, then check if it was parsed
SELECT 
  pr.status,
  pr.parsing_method,
  pr.confidence_score,
  pr.total
FROM pos_receipts pr
JOIN raw_pos_receipts rpr ON pr.raw_receipt_id = rpr.id
WHERE rpr.device_id = 'test-device'
ORDER BY pr.created_at DESC
LIMIT 1;
-- Expected: 1 row with status 'UNCLAIMED' or 'PARSE_FAILED'
```

### Test 2: Receipt Delete Function

```sql
-- First, get an UNCLAIMED receipt ID and your staff user ID
SELECT id FROM pos_receipts WHERE status = 'UNCLAIMED' LIMIT 1;
SELECT id FROM auth.users WHERE email = 'your-staff-email@example.com';

-- Then test the delete function (replace UUIDs)
SELECT soft_delete_unclaimed_receipt(
  'receipt-uuid-here'::uuid,
  'staff-user-uuid-here'::uuid
);
-- Expected: JSON with "success": true

-- Verify receipt was voided
SELECT id, status, voided_at, voided_by_staff_id
FROM pos_receipts
WHERE id = 'receipt-uuid-here';
-- Expected: status = 'VOID', voided_at has timestamp
```

---

## Quick Reference: File Locations

| File | Purpose | Location |
|------|---------|----------|
| Trigger SQL | Receipt parsing trigger | `Tabz/database/create-receipt-parsing-trigger.sql` |
| Delete SQL | Receipt delete function | `Tabz/database/create-receipt-delete-function.sql` |
| Trigger README | Detailed trigger docs | `Tabz/database/README-receipt-parsing-trigger.md` |
| This Guide | Quick deployment | `Tabz/database/DEPLOY-RECEIPT-TRIGGER-AND-DELETE.md` |

---

## Troubleshooting

### Trigger not firing?

```sql
-- Check pg_net extension
SELECT * FROM pg_extension WHERE extname = 'pg_net';
-- If empty, run: CREATE EXTENSION pg_net;

-- Check trigger function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'trigger_receipt_parsing';
-- Should show the function with hardcoded URL and key
```

### Delete function returns permission error?

```sql
-- Check staff is linked to bar
SELECT * FROM user_bars 
WHERE user_id = 'staff-user-uuid' 
AND bar_id = 'bar-uuid';
-- Should return 1 row
```

### Need to rollback?

```sql
-- Remove trigger
DROP TRIGGER IF EXISTS trigger_parse_receipt_on_insert ON raw_pos_receipts;
DROP FUNCTION IF EXISTS trigger_receipt_parsing();

-- Remove delete function
DROP FUNCTION IF EXISTS soft_delete_unclaimed_receipt(UUID, UUID);

-- Remove columns (optional)
ALTER TABLE pos_receipts DROP COLUMN IF EXISTS voided_at;
ALTER TABLE pos_receipts DROP COLUMN IF EXISTS voided_by_staff_id;
```

---

## Next Steps

After successful deployment:

1. ✅ Test with real receipts from TabezaConnect
2. ✅ Implement API endpoint that calls `soft_delete_unclaimed_receipt()`
3. ✅ Add "Delete" button in staff UI for UNCLAIMED receipts
4. ✅ Monitor parsing success rate in dashboard

---

## Support

For detailed documentation:
- Trigger details: See `README-receipt-parsing-trigger.md`
- Task requirements: See `.kiro/specs/pos-receipt-capture-transformation/tasks.md`
