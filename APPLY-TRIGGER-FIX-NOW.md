# Apply Database Trigger Fix - Quick Guide

## Issue
You're seeing this error:
```
ERROR: 42710: trigger "trigger_update_receipt_assigned_at" for relation "unmatched_receipts" already exists
```

## Solution (2 minutes)

### Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New query"

3. **Copy and paste this SQL**:
   ```sql
   -- Fix duplicate trigger error
   DROP TRIGGER IF EXISTS trigger_update_receipt_assigned_at ON unmatched_receipts;
   DROP FUNCTION IF EXISTS update_receipt_assigned_at();

   CREATE OR REPLACE FUNCTION update_receipt_assigned_at()
   RETURNS TRIGGER AS $$
   BEGIN
     IF NEW.status = 'assigned' AND OLD.status = 'pending' AND NEW.assigned_at IS NULL THEN
       NEW.assigned_at = NOW();
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER trigger_update_receipt_assigned_at
     BEFORE UPDATE ON unmatched_receipts
     FOR EACH ROW
     EXECUTE FUNCTION update_receipt_assigned_at();
   ```

4. **Run the query**
   - Click "Run" button
   - Should see "Success. No rows returned"

5. **Verify**
   ```sql
   SELECT trigger_name, event_manipulation, action_timing
   FROM information_schema.triggers
   WHERE trigger_name = 'trigger_update_receipt_assigned_at';
   ```
   - Should return 1 row showing the trigger exists

### Option 2: From File

The SQL is already saved in:
```
dev-tools/sql/fix-unmatched-receipts-trigger.sql
```

Just copy the contents and run in Supabase SQL Editor.

## What This Does

- Drops the existing duplicate trigger
- Drops the old function
- Recreates the function with correct logic
- Recreates the trigger cleanly

## After Applying

✅ Test print functionality will work completely
✅ Receipts will automatically get `assigned_at` timestamp when assigned
✅ No more duplicate trigger errors

## Test It Works

1. Go to staff dashboard
2. Check printer status shows "Connected"
3. Click "Test Print" button
4. Should see success message
5. Check Captain's Orders for test receipt

---

**This is a one-time fix. Once applied, you won't need to run it again.**
