# Apply Printer Tables Migration - URGENT

## The Problem

The test print is failing with:
```
❌ Test print failed: Cloud API error: 500 - {"success":false,"error":"Failed to process print job"}
```

**Root Cause**: The `print_jobs` and `digital_receipts` tables don't exist in your database yet.

## The Solution

You need to run the printer tables migration. Here are two ways to do it:

---

## ✅ Option 1: Supabase Dashboard (Easiest)

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy the Migration SQL**
   - Open file: `database/add-printer-relay-tables.sql`
   - Copy ALL the contents (Ctrl+A, Ctrl+C)

4. **Paste and Run**
   - Paste into the SQL Editor
   - Click "Run" button
   - Wait for "Success" message

5. **Verify**
   - You should see: "Success. No rows returned"
   - This is normal - it just created the tables

---

## ✅ Option 2: Run the Script (If you have Supabase CLI)

```bash
node dev-tools/scripts/apply-printer-tables-migration.js
```

**Note**: This might not work if you don't have the Supabase RPC function set up. Use Option 1 instead.

---

## ✅ Option 3: Supabase CLI (If installed)

If you have Supabase CLI installed:

```bash
supabase db push
```

This will apply all pending migrations.

---

## What Gets Created

The migration creates:

### Tables:
- ✅ `print_jobs` - Stores raw print data from POS
- ✅ `digital_receipts` - Stores receipts delivered to customers

### Indexes:
- Performance indexes for fast queries

### Policies:
- Row Level Security (RLS) policies
- Bar staff can view their bar's data
- Customers can view their own receipts

### Functions:
- Auto-update timestamps for receipt status changes

---

## After Migration

Once the migration is applied:

1. **Test the printer service again**
   - Go to: http://localhost:3003/settings
   - Click "Test Print"
   - Should now work! ✅

2. **Verify in database**
   - Go to Supabase Dashboard → Table Editor
   - You should see `print_jobs` and `digital_receipts` tables

---

## Troubleshooting

### "Table already exists" error
- This is fine! It means the tables are already there
- Just verify they exist in Table Editor

### "Permission denied" error
- Make sure you're using the service role key
- Check your `.env.local` has `SUPABASE_SECRET_KEY`

### Still getting 500 error after migration
- Check the printer service terminal for errors
- Check the staff app terminal for errors
- Make sure both services are running

---

## Quick Verification

After running the migration, verify it worked:

```sql
-- Run this in Supabase SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('print_jobs', 'digital_receipts');
```

You should see both tables listed.

---

## Next Steps

1. ✅ Apply the migration (Option 1 recommended)
2. ✅ Test print again
3. ✅ Should see "Test print successful!" message
4. ✅ Check Captain's Orders for the test receipt

---

**Need Help?**

If you're stuck, just:
1. Go to Supabase Dashboard
2. SQL Editor → New Query
3. Copy/paste from `database/add-printer-relay-tables.sql`
4. Click Run

That's it! 🎉
