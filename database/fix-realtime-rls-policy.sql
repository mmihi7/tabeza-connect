-- Fix Realtime RLS Policy for unmatched_receipts
-- 
-- Issue: Supabase Realtime events are filtered by RLS policies even when using service role key
-- Solution: Add a policy that allows service role to bypass RLS for realtime events
--
-- Background:
-- - Staff PWA will use authenticated user tokens in production (RLS enforced)
-- - Test scripts use service role key (should bypass RLS)
-- - Realtime subscriptions need explicit permission even with service role
--
-- This fix adds a policy that allows service role (used by printer service and tests)
-- to read all receipts, while still enforcing bar-specific access for authenticated users.

-- Drop existing SELECT policy
DROP POLICY IF EXISTS unmatched_receipts_bar_staff_select ON unmatched_receipts;

-- Create new SELECT policy that allows:
-- 1. Service role (auth.uid() IS NULL) - for printer service and tests
-- 2. Bar staff (auth.uid() in user_bars) - for Staff PWA
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

-- Verify the policy was created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'unmatched_receipts' 
  AND policyname = 'unmatched_receipts_select';

-- Test query (should return rows when using service role key)
SELECT COUNT(*) as total_receipts FROM unmatched_receipts;

