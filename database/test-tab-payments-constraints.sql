-- Test Script: M-Pesa Payment System Constraints
-- Run this after the migration to test constraint enforcement
-- WARNING: This script creates and deletes test data

-- ============================================================================
-- SETUP: Create test tab for constraint testing
-- ============================================================================
DO $$
DECLARE
    test_bar_id UUID;
    test_tab_id UUID;
BEGIN
    -- Get or create a test bar
    SELECT id INTO test_bar_id FROM bars LIMIT 1;
    
    IF test_bar_id IS NULL THEN
        INSERT INTO bars (name, location) 
        VALUES ('Test Bar for Constraints', 'Test Location')
        RETURNING id INTO test_bar_id;
    END IF;
    
    -- Create a test tab
    INSERT INTO tabs (bar_id, tab_number, status)
    VALUES (test_bar_id, 9999, 'open')
    RETURNING id INTO test_tab_id;
    
    RAISE NOTICE 'Created test tab: %', test_tab_id;
END $$;

-- ============================================================================
-- TEST 1: New Status Values
-- ============================================================================
DO $$
DECLARE
    test_tab_id UUID;
    payment_id_1 UUID;
    payment_id_2 UUID;
BEGIN
    -- Get test tab
    SELECT id INTO test_tab_id FROM tabs WHERE tab_number = 9999 LIMIT 1;
    
    -- Test 'initiated' status
    INSERT INTO tab_payments (tab_id, amount, method, status)
    VALUES (test_tab_id, 100.00, 'mpesa', 'initiated')
    RETURNING id INTO payment_id_1;
    
    -- Test 'stk_sent' status  
    INSERT INTO tab_payments (tab_id, amount, method, status)
    VALUES (test_tab_id, 200.00, 'mpesa', 'stk_sent')
    RETURNING id INTO payment_id_2;
    
    RAISE NOTICE 'TEST 1 PASS ✓: New status values accepted';
    RAISE NOTICE 'Created payments: % (initiated), % (stk_sent)', payment_id_1, payment_id_2;
    
    -- Clean up
    DELETE FROM tab_payments WHERE id IN (payment_id_1, payment_id_2);
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'TEST 1 FAIL ✗: New status values - %', SQLERRM;
END $$;

-- ============================================================================
-- TEST 2: Unique Checkout Request ID Constraint
-- ============================================================================
DO $$
DECLARE
    test_tab_id UUID;
    payment_id_1 UUID;
BEGIN
    SELECT id INTO test_tab_id FROM tabs WHERE tab_number = 9999 LIMIT 1;
    
    -- Insert first payment with checkout_request_id
    INSERT INTO tab_payments (tab_id, amount, method, status, checkout_request_id)
    VALUES (test_tab_id, 100.00, 'mpesa', 'initiated', 'TEST_CHECKOUT_123')
    RETURNING id INTO payment_id_1;
    
    -- Try to insert duplicate checkout_request_id (should fail)
    BEGIN
        INSERT INTO tab_payments (tab_id, amount, method, status, checkout_request_id)
        VALUES (test_tab_id, 200.00, 'mpesa', 'initiated', 'TEST_CHECKOUT_123');
        
        RAISE NOTICE 'TEST 2 FAIL ✗: Duplicate checkout_request_id was allowed';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE 'TEST 2 PASS ✓: Unique checkout_request_id constraint working';
    END;
    
    -- Clean up
    DELETE FROM tab_payments WHERE id = payment_id_1;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'TEST 2 ERROR: %', SQLERRM;
END $$;

-- ============================================================================
-- TEST 3: Unique M-Pesa Receipt Constraint
-- ============================================================================
DO $$
DECLARE
    test_tab_id UUID;
    payment_id_1 UUID;
BEGIN
    SELECT id INTO test_tab_id FROM tabs WHERE tab_number = 9999 LIMIT 1;
    
    -- Insert first payment with mpesa_receipt
    INSERT INTO tab_payments (tab_id, amount, method, status, mpesa_receipt)
    VALUES (test_tab_id, 100.00, 'mpesa', 'success', 'TEST_RECEIPT_456')
    RETURNING id INTO payment_id_1;
    
    -- Try to insert duplicate mpesa_receipt (should fail)
    BEGIN
        INSERT INTO tab_payments (tab_id, amount, method, status, mpesa_receipt)
        VALUES (test_tab_id, 200.00, 'mpesa', 'success', 'TEST_RECEIPT_456');
        
        RAISE NOTICE 'TEST 3 FAIL ✗: Duplicate mpesa_receipt was allowed';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE 'TEST 3 PASS ✓: Unique mpesa_receipt constraint working';
    END;
    
    -- Clean up
    DELETE FROM tab_payments WHERE id = payment_id_1;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'TEST 3 ERROR: %', SQLERRM;
END $$;

-- ============================================================================
-- TEST 4: Single Pending M-Pesa Payment Per Tab
-- ============================================================================
DO $$
DECLARE
    test_tab_id UUID;
    payment_id_1 UUID;
BEGIN
    SELECT id INTO test_tab_id FROM tabs WHERE tab_number = 9999 LIMIT 1;
    
    -- Insert first pending M-Pesa payment
    INSERT INTO tab_payments (tab_id, amount, method, status)
    VALUES (test_tab_id, 100.00, 'mpesa', 'initiated')
    RETURNING id INTO payment_id_1;
    
    -- Try to insert second pending M-Pesa payment for same tab (should fail)
    BEGIN
        INSERT INTO tab_payments (tab_id, amount, method, status)
        VALUES (test_tab_id, 200.00, 'mpesa', 'stk_sent');
        
        RAISE NOTICE 'TEST 4 FAIL ✗: Multiple pending M-Pesa payments allowed for same tab';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE 'TEST 4 PASS ✓: Single pending M-Pesa payment per tab constraint working';
    END;
    
    -- Clean up
    DELETE FROM tab_payments WHERE id = payment_id_1;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'TEST 4 ERROR: %', SQLERRM;
END $$;

-- ============================================================================
-- TEST 5: Allow Multiple Non-Pending Payments
-- ============================================================================
DO $$
DECLARE
    test_tab_id UUID;
    payment_id_1 UUID;
    payment_id_2 UUID;
BEGIN
    SELECT id INTO test_tab_id FROM tabs WHERE tab_number = 9999 LIMIT 1;
    
    -- Insert multiple completed M-Pesa payments (should succeed)
    INSERT INTO tab_payments (tab_id, amount, method, status)
    VALUES (test_tab_id, 100.00, 'mpesa', 'success')
    RETURNING id INTO payment_id_1;
    
    INSERT INTO tab_payments (tab_id, amount, method, status)
    VALUES (test_tab_id, 200.00, 'mpesa', 'failed')
    RETURNING id INTO payment_id_2;
    
    RAISE NOTICE 'TEST 5 PASS ✓: Multiple non-pending M-Pesa payments allowed';
    
    -- Clean up
    DELETE FROM tab_payments WHERE id IN (payment_id_1, payment_id_2);
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'TEST 5 FAIL ✗: Multiple non-pending payments - %', SQLERRM;
END $$;

-- ============================================================================
-- CLEANUP: Remove test data
-- ============================================================================
DO $$
BEGIN
    -- Remove test tab and any remaining test payments
    DELETE FROM tab_payments WHERE tab_id IN (SELECT id FROM tabs WHERE tab_number = 9999);
    DELETE FROM tabs WHERE tab_number = 9999;
    
    RAISE NOTICE 'Cleanup complete: Test data removed';
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================
SELECT '=== CONSTRAINT TESTING COMPLETE ===' as summary;