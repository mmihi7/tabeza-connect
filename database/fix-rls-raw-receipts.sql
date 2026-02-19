-- Fix RLS for raw_pos_receipts table
-- The Edge Function needs to read from this table using the anon key

-- Check current RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'raw_pos_receipts';

-- If RLS is enabled, we need to add a policy for the anon role
-- Option 1: Disable RLS (simplest for internal tables)
ALTER TABLE raw_pos_receipts DISABLE ROW LEVEL SECURITY;

-- Option 2: Keep RLS enabled but add policy for anon role (more secure)
-- Uncomment if you prefer this approach:
/*
ALTER TABLE raw_pos_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to read raw_pos_receipts"
ON raw_pos_receipts
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow service_role full access to raw_pos_receipts"
ON raw_pos_receipts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
*/

-- Verify the change
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'raw_pos_receipts';

-- Test query (should now work with anon key)
SELECT COUNT(*) FROM raw_pos_receipts;
