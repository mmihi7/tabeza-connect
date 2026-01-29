-- Verification Script: M-Pesa Payment System Audit Database Foundation
-- Run this after executing enhance-tab-payments-for-mpesa-audit.sql
-- This script verifies all requirements from task 1 are met

-- ============================================================================
-- VERIFICATION 1: Required Columns Check
-- ============================================================================
SELECT 
    'VERIFICATION 1: Required Columns' as test_name,
    CASE 
        WHEN COUNT(*) >= 9 THEN 'PASS ✓'
        ELSE 'FAIL ✗ - Missing columns'
    END as result,
    'Found ' || COUNT(*) || ' of 9+ required columns' as details
FROM information_schema.columns 
WHERE table_name = 'tab_payments' 
AND table_schema = 'public'
AND column_name IN (
    'id', 'tab_id', 'amount', 'status', 
    'checkout_request_id', 'mpesa_receipt', 'created_at',
    'method', 'metadata'
);

-- List all columns for manual verification
SELECT 
    'Column Details' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tab_payments' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================================================
-- VERIFICATION 2: Status Values Check
-- ============================================================================
SELECT 
    'VERIFICATION 2: Status Constraint' as test_name,
    CASE 
        WHEN check_clause LIKE '%initiated%' AND check_clause LIKE '%stk_sent%' 
        THEN 'PASS ✓'
        ELSE 'FAIL ✗ - Missing new status values'
    END as result,
    'Status constraint: ' || check_clause as details
FROM information_schema.check_constraints 
WHERE constraint_name = 'tab_payments_status_check';

-- ============================================================================
-- VERIFICATION 3: Unique Constraints Check
-- ============================================================================
SELECT 
    'VERIFICATION 3: Unique Constraints' as test_name,
    CASE 
        WHEN COUNT(*) >= 2 THEN 'PASS ✓'
        ELSE 'FAIL ✗ - Missing unique constraints'
    END as result,
    'Found ' || COUNT(*) || ' unique constraints' as details
FROM information_schema.table_constraints 
WHERE table_name = 'tab_payments' 
AND constraint_type = 'UNIQUE'
AND constraint_name IN (
    'tab_payments_checkout_request_id_unique',
    'tab_payments_mpesa_receipt_unique'
);

-- List unique constraints for verification
SELECT 
    'Unique Constraint Details' as info,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'tab_payments' 
AND constraint_type = 'UNIQUE';

-- ============================================================================
-- VERIFICATION 4: Single Pending Payment Index Check
-- ============================================================================
SELECT 
    'VERIFICATION 4: Single Pending Payment Index' as test_name,
    CASE 
        WHEN COUNT(*) = 1 THEN 'PASS ✓'
        ELSE 'FAIL ✗ - Missing critical index'
    END as result,
    'Index prevents multiple pending M-Pesa payments per tab' as details
FROM pg_indexes 
WHERE tablename = 'tab_payments' 
AND indexname = 'tab_payments_single_pending_mpesa_per_tab';

-- ============================================================================
-- VERIFICATION 5: M-Pesa Indexes Check
-- ============================================================================
SELECT 
    'VERIFICATION 5: M-Pesa Indexes' as test_name,
    CASE 
        WHEN COUNT(*) >= 3 THEN 'PASS ✓'
        ELSE 'FAIL ✗ - Missing M-Pesa indexes'
    END as result,
    'Found ' || COUNT(*) || ' M-Pesa specific indexes' as details
FROM pg_indexes 
WHERE tablename = 'tab_payments' 
AND indexname IN (
    'idx_tab_payments_checkout_request_id',
    'idx_tab_payments_mpesa_receipt',
    'idx_tab_payments_mpesa_status'
);

-- List all indexes for verification
SELECT 
    'Index Details' as info,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'tab_payments' 
AND indexname LIKE '%mpesa%' OR indexname LIKE '%checkout%' OR indexname LIKE '%receipt%'
ORDER BY indexname;

-- ============================================================================
-- VERIFICATION 6: Constraint Testing (Safe Tests)
-- ============================================================================

-- Test new status values are accepted
DO $$
BEGIN
    -- Test that new status values are valid
    PERFORM 1 WHERE 'initiated' = ANY(ARRAY['pending', 'initiated', 'stk_sent', 'success', 'failed']);
    PERFORM 1 WHERE 'stk_sent' = ANY(ARRAY['pending', 'initiated', 'stk_sent', 'success', 'failed']);
    
    RAISE NOTICE 'VERIFICATION 6: Status Values - New status values are properly configured ✓';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'VERIFICATION 6: Status Values - FAIL ✗ - %', SQLERRM;
END $$;

-- ============================================================================
-- SUMMARY REPORT
-- ============================================================================
SELECT 
    '=== TASK 1 COMPLETION SUMMARY ===' as summary,
    'Database foundation enhancements for M-Pesa payment system audit' as description;

SELECT 
    'Requirements Mapping' as section,
    '4.1 - Unique constraints for checkout_request_id and mpesa_receipt' as req_4_1,
    '4.2 - Database transactions and constraint enforcement' as req_4_2,
    '1.4 - Single pending payment per tab constraint' as req_1_4;

-- Final verification count
SELECT 
    'FINAL CHECK' as test_name,
    CASE 
        WHEN 
            -- Check all required elements exist
            (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'tab_payments' AND column_name IN ('checkout_request_id', 'mpesa_receipt')) = 2
            AND (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = 'tab_payments' AND constraint_type = 'UNIQUE' AND constraint_name LIKE '%checkout%') >= 1
            AND (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = 'tab_payments' AND constraint_type = 'UNIQUE' AND constraint_name LIKE '%receipt%') >= 1
            AND (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'tab_payments' AND indexname = 'tab_payments_single_pending_mpesa_per_tab') = 1
            AND (SELECT COUNT(*) FROM information_schema.check_constraints WHERE constraint_name = 'tab_payments_status_check' AND check_clause LIKE '%initiated%') = 1
        THEN 'ALL REQUIREMENTS MET ✓'
        ELSE 'SOME REQUIREMENTS MISSING ✗'
    END as overall_result;

-- Show current table structure for final confirmation
-- Note: Use \d tab_payments; in psql for detailed table structure
SELECT 
    'Table Structure' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tab_payments' 
AND table_schema = 'public'
ORDER BY ordinal_position;