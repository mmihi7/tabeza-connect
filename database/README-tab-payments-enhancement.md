# M-Pesa Payment System Audit: Database Foundation Enhancement

## Overview

This enhancement implements the database foundation requirements for the M-Pesa payment system audit (Task 1). It ensures the `tab_payments` table has proper safety constraints and idempotency protection for M-Pesa payments.

## Files Created

1. **`enhance-tab-payments-for-mpesa-audit.sql`** - Main migration script
2. **`verify-tab-payments-enhancement.sql`** - Verification script to confirm changes
3. **`test-tab-payments-constraints.sql`** - Constraint testing script

## Requirements Addressed

### Requirement 4.1 - Database Constraints
- ✅ Added unique constraint for `checkout_request_id`
- ✅ Added unique constraint for `mpesa_receipt`
- ✅ Enhanced indexes for efficient M-Pesa queries

### Requirement 4.2 - Transaction Safety
- ✅ Added deferrable constraints for transaction safety
- ✅ Proper constraint enforcement under concurrent access

### Requirement 1.4 - Single Pending Payment
- ✅ Added unique index preventing multiple pending M-Pesa payments per tab
- ✅ Constraint applies only to 'initiated' and 'stk_sent' statuses

## Changes Made

### 1. New Columns Added
```sql
-- M-Pesa specific tracking columns
ALTER TABLE tab_payments ADD COLUMN checkout_request_id TEXT;
ALTER TABLE tab_payments ADD COLUMN mpesa_receipt TEXT;
```

### 2. Updated Status Constraint
```sql
-- Old: 'pending', 'success', 'failed'
-- New: 'pending', 'initiated', 'stk_sent', 'success', 'failed'
```

### 3. Critical Unique Constraints
```sql
-- Prevent duplicate checkout request IDs
ALTER TABLE tab_payments ADD CONSTRAINT tab_payments_checkout_request_id_unique 
UNIQUE (checkout_request_id);

-- Prevent duplicate M-Pesa receipts
ALTER TABLE tab_payments ADD CONSTRAINT tab_payments_mpesa_receipt_unique 
UNIQUE (mpesa_receipt);

-- Prevent multiple pending M-Pesa payments per tab
CREATE UNIQUE INDEX tab_payments_single_pending_mpesa_per_tab
ON tab_payments (tab_id) 
WHERE method = 'mpesa' AND status IN ('initiated', 'stk_sent');
```

### 4. Performance Indexes
```sql
-- Efficient M-Pesa queries
CREATE INDEX idx_tab_payments_checkout_request_id ON tab_payments (checkout_request_id);
CREATE INDEX idx_tab_payments_mpesa_receipt ON tab_payments (mpesa_receipt);
CREATE INDEX idx_tab_payments_mpesa_status ON tab_payments (method, status);
```

## How to Run

### Step 1: Execute Migration
```bash
psql $DATABASE_URL -f database/enhance-tab-payments-for-mpesa-audit.sql
```

### Step 2: Verify Changes
```bash
psql $DATABASE_URL -f database/verify-tab-payments-enhancement.sql
```

### Step 3: Test Constraints (Optional)
```bash
psql $DATABASE_URL -f database/test-tab-payments-constraints.sql
```

## Expected Results

After running the migration, you should see:

1. **New Columns**: `checkout_request_id` and `mpesa_receipt` added to `tab_payments`
2. **Updated Status Values**: Can now use 'initiated' and 'stk_sent' statuses
3. **Unique Constraints**: Prevent duplicate checkout requests and receipts
4. **Single Pending Rule**: Only one pending M-Pesa payment allowed per tab
5. **Optimized Queries**: New indexes for efficient M-Pesa operations

## Safety Features

- **Deferrable Constraints**: Allow for safe transaction handling
- **Conditional Indexes**: Only apply where relevant (M-Pesa payments)
- **Backward Compatibility**: Existing data and functionality preserved
- **Comprehensive Testing**: Built-in constraint validation

## Next Steps

After successful migration:

1. ✅ Task 1 complete - Database foundation ready
2. 🔄 Proceed to Task 2 - Payment initiation API enhancement
3. 🔄 Continue with remaining M-Pesa audit tasks

## Troubleshooting

If migration fails:
1. Check database connection and permissions
2. Verify no conflicting data exists
3. Review error messages in verification script
4. Run test script to identify specific constraint issues

## Rollback (If Needed)

```sql
-- Remove new constraints
ALTER TABLE tab_payments DROP CONSTRAINT IF EXISTS tab_payments_checkout_request_id_unique;
ALTER TABLE tab_payments DROP CONSTRAINT IF EXISTS tab_payments_mpesa_receipt_unique;
DROP INDEX IF EXISTS tab_payments_single_pending_mpesa_per_tab;

-- Remove new columns
ALTER TABLE tab_payments DROP COLUMN IF EXISTS checkout_request_id;
ALTER TABLE tab_payments DROP COLUMN IF EXISTS mpesa_receipt;

-- Restore original status constraint
ALTER TABLE tab_payments DROP CONSTRAINT tab_payments_status_check;
ALTER TABLE tab_payments ADD CONSTRAINT tab_payments_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text]));
```