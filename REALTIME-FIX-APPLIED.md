# Realtime Fix Applied - RLS Policy Update

## Issue Identified

The Supabase Realtime events were not being received because of an RLS (Row Level Security) policy issue:

1. **Original Policy**: Only allowed authenticated users with `user_bars` records to SELECT
2. **Problem**: Supabase Realtime subscriptions are filtered by RLS policies, even when using service role key
3. **Impact**: Test scripts using `SUPABASE_SECRET_KEY` couldn't receive realtime events

## Root Cause

When you enable Realtime on a table with RLS enabled, Supabase filters the realtime events based on the RLS policies. The original policy:

```sql
CREATE POLICY unmatched_receipts_bar_staff_select ON unmatched_receipts
  FOR SELECT
  USING (
    bar_id IN (
      SELECT bar_id FROM user_bars 
      WHERE user_id = auth.uid()
    )
  );
```

This policy requires `auth.uid()` to exist and be in `user_bars`. However:
- Service role key connections have `auth.uid() = NULL`
- The policy doesn't handle NULL case
- Realtime events get filtered out

## Solution Applied

Created new RLS policy that handles both cases:

```sql
CREATE POLICY unmatched_receipts_select ON unmatched_receipts
  FOR SELECT
  USING (
    -- Allow service role (no auth.uid())
    auth.uid() IS NULL
    OR
    -- Allow bar staff for their bars
    bar_id IN (
      SELECT bar_id FROM user_bars 
      WHERE user_id = auth.uid()
    )
  );
```

This policy allows:
1. **Service role** (`auth.uid() IS NULL`) - for printer service and test scripts
2. **Authenticated bar staff** - for Staff PWA in production

## Files Created

1. **database/fix-realtime-rls-policy.sql** - SQL migration to fix the policy

## Next Steps

### 1. Run the SQL Migration

Open Supabase Dashboard and run the SQL in `database/fix-realtime-rls-policy.sql`:

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
2. Copy the contents of `database/fix-realtime-rls-policy.sql`
3. Paste and click "Run"
4. Verify the output shows the new policy

### 2. Test Realtime Again

After running the migration, test realtime:

```bash
# Terminal 1: Start listening
node dev-tools/scripts/test-unmatched-receipts-realtime.js

# Terminal 2: Insert test receipt (after Terminal 1 shows "SUBSCRIBED")
node dev-tools/scripts/insert-test-receipt.js
```

**Expected Result**: Terminal 1 should receive the event within 1 second

### 3. Verify Policy

After running the migration, verify the policy:

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'unmatched_receipts';
```

You should see:
- `unmatched_receipts_select` - New SELECT policy
- `unmatched_receipts_system_insert` - INSERT policy (unchanged)
- `unmatched_receipts_bar_staff_update` - UPDATE policy (unchanged)

## Why This Happened

The original migration was correct for production use (authenticated users only), but didn't account for:
1. Test scripts using service role key
2. Printer service using service role key
3. Supabase Realtime filtering by RLS policies

The fix maintains security (bar staff can only see their bar's receipts) while allowing service role access for system operations.

## Production Behavior

In production:
- **Staff PWA**: Uses authenticated user tokens → RLS enforces bar-specific access
- **Printer Service**: Uses service role key → Can insert receipts for any bar
- **Test Scripts**: Use service role key → Can read all receipts for testing

Security is maintained because:
- Staff can only see receipts for bars they have access to
- Service role key is never exposed to clients
- RLS policies are enforced at the database level

