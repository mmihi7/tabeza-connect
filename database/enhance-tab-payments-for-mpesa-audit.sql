-- M-Pesa Payment System Audit: Database Foundation Enhancement
-- Enhances tab_payments table for improved M-Pesa payment safety and idempotency
-- Requirements: 4.1, 4.2, 1.4

-- Step 1: Verify current tab_payments table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tab_payments' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Add missing columns for M-Pesa tracking
-- Add checkout_request_id column for M-Pesa STK Push tracking
ALTER TABLE tab_payments 
ADD COLUMN IF NOT EXISTS checkout_request_id TEXT;

-- Add mpesa_receipt column for M-Pesa receipt number tracking
ALTER TABLE tab_payments 
ADD COLUMN IF NOT EXISTS mpesa_receipt TEXT;

-- Step 3: Update status constraint to include new M-Pesa specific statuses
-- Drop existing status constraint
ALTER TABLE tab_payments 
DROP CONSTRAINT IF EXISTS tab_payments_status_check;

-- Add new status constraint with M-Pesa specific statuses
ALTER TABLE tab_payments 
ADD CONSTRAINT tab_payments_status_check 
CHECK (
  status = ANY (ARRAY[
    'pending'::text, 
    'initiated'::text,    -- New: Payment intent created
    'stk_sent'::text,     -- New: STK Push sent to customer
    'success'::text, 
    'failed'::text
  ])
);

-- Step 4: Add unique constraints for M-Pesa idempotency and safety
-- Unique constraint for checkout_request_id (M-Pesa STK Push identifier)
ALTER TABLE tab_payments 
ADD CONSTRAINT tab_payments_checkout_request_id_unique 
UNIQUE (checkout_request_id)
DEFERRABLE INITIALLY DEFERRED;

-- Unique constraint for mpesa_receipt (M-Pesa receipt number)
ALTER TABLE tab_payments 
ADD CONSTRAINT tab_payments_mpesa_receipt_unique 
UNIQUE (mpesa_receipt)
DEFERRABLE INITIALLY DEFERRED;

-- Critical constraint: Only one pending M-Pesa payment per tab
-- This prevents multiple simultaneous payment attempts on the same tab
CREATE UNIQUE INDEX IF NOT EXISTS tab_payments_single_pending_mpesa_per_tab
ON tab_payments (tab_id) 
WHERE method = 'mpesa' AND status IN ('initiated', 'stk_sent');

-- Step 5: Add indexes for efficient M-Pesa queries
CREATE INDEX IF NOT EXISTS idx_tab_payments_checkout_request_id 
ON tab_payments (checkout_request_id) 
WHERE checkout_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tab_payments_mpesa_receipt 
ON tab_payments (mpesa_receipt) 
WHERE mpesa_receipt IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tab_payments_mpesa_status 
ON tab_payments (method, status) 
WHERE method = 'mpesa';

-- Step 6: Add metadata indexes for M-Pesa specific queries
-- Index for idempotency key lookups in metadata
CREATE INDEX IF NOT EXISTS idx_tab_payments_metadata_idempotency 
ON tab_payments USING GIN ((metadata->'idempotency_key')) 
WHERE method = 'mpesa' AND metadata ? 'idempotency_key';

-- Index for M-Pesa environment filtering
CREATE INDEX IF NOT EXISTS idx_tab_payments_metadata_environment 
ON tab_payments USING GIN ((metadata->'environment')) 
WHERE method = 'mpesa' AND metadata ? 'environment';

-- Step 7: Verification queries
-- Check that all required columns exist
SELECT 
    'Required columns check' as check_type,
    CASE 
        WHEN COUNT(*) = 9 THEN 'PASS: All required columns present'
        ELSE 'FAIL: Missing columns - found ' || COUNT(*) || ' of 9 required'
    END as result
FROM information_schema.columns 
WHERE table_name = 'tab_payments' 
AND table_schema = 'public'
AND column_name IN (
    'id', 'tab_id', 'amount', 'status', 
    'checkout_request_id', 'mpesa_receipt', 'created_at',
    'method', 'metadata'
);

-- Check that status constraint includes new values
SELECT 
    'Status constraint check' as check_type,
    constraint_name,
    check_clause
FROM information_schema.check_constraints 
WHERE constraint_name = 'tab_payments_status_check';

-- Check that unique constraints are in place
SELECT 
    'Unique constraints check' as check_type,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'tab_payments' 
AND constraint_type = 'UNIQUE'
AND constraint_name IN (
    'tab_payments_checkout_request_id_unique',
    'tab_payments_mpesa_receipt_unique'
);

-- Check that the critical single pending payment index exists
SELECT 
    'Single pending payment index check' as check_type,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'tab_payments' 
AND indexname = 'tab_payments_single_pending_mpesa_per_tab';

-- Step 8: Test the constraints (optional verification)
-- This section can be uncommented to test constraint enforcement

/*
-- Test 1: Try to create duplicate checkout_request_id (should fail)
-- INSERT INTO tab_payments (tab_id, amount, method, status, checkout_request_id) 
-- VALUES 
--   ('00000000-0000-0000-0000-000000000001', 100.00, 'mpesa', 'initiated', 'TEST_CHECKOUT_123'),
--   ('00000000-0000-0000-0000-000000000002', 200.00, 'mpesa', 'initiated', 'TEST_CHECKOUT_123');

-- Test 2: Try to create multiple pending payments for same tab (should fail)
-- INSERT INTO tab_payments (tab_id, amount, method, status) 
-- VALUES 
--   ('00000000-0000-0000-0000-000000000001', 100.00, 'mpesa', 'initiated'),
--   ('00000000-0000-0000-0000-000000000001', 200.00, 'mpesa', 'stk_sent');

-- Test 3: Verify new status values are accepted
-- INSERT INTO tab_payments (tab_id, amount, method, status) 
-- VALUES 
--   ('00000000-0000-0000-0000-000000000003', 100.00, 'mpesa', 'initiated'),
--   ('00000000-0000-0000-0000-000000000004', 200.00, 'mpesa', 'stk_sent');
*/

-- Migration complete!
-- The tab_payments table now has enhanced M-Pesa safety constraints:
-- ✓ Required columns: id, tab_id, amount, status, checkout_request_id, mpesa_receipt, created_at
-- ✓ Unique constraints: checkout_request_id, mpesa_receipt
-- ✓ Single pending payment per tab constraint
-- ✓ Updated status values: pending, initiated, stk_sent, success, failed
-- ✓ Optimized indexes for M-Pesa queries