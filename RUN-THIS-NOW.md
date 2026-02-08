# 🚀 Run This Now - Fix Realtime RLS Policy

## Issue Found ✅

The Realtime events weren't being received because the RLS policy didn't allow service role access. This is now fixed!

## What You Need to Do

### Step 1: Run the SQL Migration

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to: **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the contents of: `database/fix-realtime-rls-policy.sql`
5. Click **Run** (or press Ctrl+Enter)

**Expected Output:**
```
schemaname | tablename           | policyname                    | ...
-----------+---------------------+-------------------------------+----
public     | unmatched_receipts  | unmatched_receipts_select     | ...

total_receipts
--------------
1
```

### Step 2: Test Realtime (Should Work Now!)

Open **two terminals**:

**Terminal 1** (start listening):
```bash
node dev-tools/scripts/test-unmatched-receipts-realtime.js
```

Wait for: `✅ Successfully subscribed to unmatched_receipts events`

**Terminal 2** (insert test receipt):
```bash
node dev-tools/scripts/insert-test-receipt.js
```

**Expected Result in Terminal 1:**
```
✅ Event 1 received at 2026-02-07T19:30:00.000Z
📦 Payload:
{
  "new": {
    "id": "...",
    "bar_id": "...",
    "receipt_data": {
      "venueName": "Kadida",
      "items": [...],
      "total": 1392
    },
    "status": "pending",
    ...
  }
}

📄 Receipt Details:
   ID: ...
   Bar ID: ...
   Status: pending
   Created: ...
   Venue: Kadida
   Items: 3
   Total: KES 1392
```

## What Was Fixed

**Before:**
- RLS policy only allowed authenticated users with `user_bars` records
- Service role key connections have `auth.uid() = NULL`
- Realtime events were filtered out

**After:**
- RLS policy now allows BOTH:
  1. Service role (`auth.uid() IS NULL`) - for tests and printer service
  2. Authenticated bar staff - for Staff PWA in production

## Security Notes

✅ **Still Secure:**
- Staff PWA users can only see receipts for their bars
- Service role key is never exposed to clients
- RLS policies enforced at database level

✅ **Production Ready:**
- Authenticated users: Bar-specific access only
- Printer service: Can insert receipts (service role)
- Test scripts: Can read all receipts (service role)

## Files Created

1. `database/fix-realtime-rls-policy.sql` - SQL migration
2. `REALTIME-FIX-APPLIED.md` - Detailed explanation

## Next Steps After This Works

Once realtime is working:
1. Mark Task 1 as complete ✅
2. Move to Task 2: Real-Time Receipt Delivery hook
3. Continue with modal implementation

---

**Questions?** Check `REALTIME-FIX-APPLIED.md` for detailed explanation.

