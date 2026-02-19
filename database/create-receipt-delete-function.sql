-- Migration: Create Receipt Delete/Discard Function
-- Purpose: Allow staff to soft-delete UNCLAIMED receipts (set status to VOID)
-- Requirements: Task 12.2 - Receipt delete/discard API
-- Date: 2024

-- ============================================================================
-- CREATE SOFT DELETE FUNCTION FOR UNCLAIMED RECEIPTS
-- ============================================================================

CREATE OR REPLACE FUNCTION soft_delete_unclaimed_receipt(
  p_receipt_id UUID,
  p_staff_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_receipt RECORD;
  v_bar_id UUID;
  v_has_permission BOOLEAN;
BEGIN
  -- 1. Check if receipt exists and get its details
  SELECT 
    id,
    bar_id,
    status,
    claimed_by_tab_id
  INTO v_receipt
  FROM pos_receipts
  WHERE id = p_receipt_id;

  -- Receipt not found
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Receipt not found',
      'code', 'RECEIPT_NOT_FOUND'
    );
  END IF;

  -- 2. Check if receipt is UNCLAIMED (can only delete unclaimed receipts)
  IF v_receipt.status != 'UNCLAIMED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot delete receipt with status: ' || v_receipt.status,
      'code', 'INVALID_STATUS',
      'current_status', v_receipt.status
    );
  END IF;

  -- 3. Check if receipt is already claimed (double-check)
  IF v_receipt.claimed_by_tab_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot delete claimed receipt',
      'code', 'RECEIPT_CLAIMED',
      'tab_id', v_receipt.claimed_by_tab_id
    );
  END IF;

  -- 4. Verify staff has permission for this bar
  SELECT EXISTS(
    SELECT 1 FROM user_bars
    WHERE user_id = p_staff_user_id
    AND bar_id = v_receipt.bar_id
  ) INTO v_has_permission;

  IF NOT v_has_permission THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Staff does not have permission for this bar',
      'code', 'PERMISSION_DENIED'
    );
  END IF;

  -- 5. Soft delete: Update status to VOID
  UPDATE pos_receipts
  SET 
    status = 'VOID',
    voided_at = NOW(),
    voided_by_staff_id = p_staff_user_id
  WHERE id = p_receipt_id;

  -- 6. Log the deletion in audit_logs
  INSERT INTO audit_logs (
    bar_id,
    staff_id,
    action,
    details
  ) VALUES (
    v_receipt.bar_id,
    p_staff_user_id,
    'receipt_voided',
    jsonb_build_object(
      'receipt_id', p_receipt_id,
      'previous_status', v_receipt.status,
      'reason', 'staff_deleted_unclaimed_receipt'
    )
  );

  -- 7. Return success
  RETURN jsonb_build_object(
    'success', true,
    'receipt_id', p_receipt_id,
    'previous_status', v_receipt.status,
    'new_status', 'VOID',
    'voided_at', NOW(),
    'voided_by', p_staff_user_id
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Handle any unexpected errors
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'code', 'INTERNAL_ERROR'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION soft_delete_unclaimed_receipt(UUID, UUID) IS 
  'Soft-deletes an UNCLAIMED receipt by setting status to VOID. Only staff with bar permissions can delete receipts. Logs action in audit_logs.';

-- ============================================================================
-- ADD VOIDED COLUMNS TO pos_receipts TABLE (if not exists)
-- ============================================================================

-- Add voided_at timestamp column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pos_receipts' 
    AND column_name = 'voided_at'
  ) THEN
    ALTER TABLE pos_receipts ADD COLUMN voided_at TIMESTAMPTZ;
    COMMENT ON COLUMN pos_receipts.voided_at IS 'Timestamp when receipt was voided by staff';
  END IF;
END $$;

-- Add voided_by_staff_id column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pos_receipts' 
    AND column_name = 'voided_by_staff_id'
  ) THEN
    ALTER TABLE pos_receipts ADD COLUMN voided_by_staff_id UUID REFERENCES auth.users(id);
    COMMENT ON COLUMN pos_receipts.voided_by_staff_id IS 'Staff user who voided the receipt';
  END IF;
END $$;

-- Add index for voided receipts
CREATE INDEX IF NOT EXISTS idx_pos_receipts_voided 
  ON pos_receipts(bar_id, voided_at DESC) 
  WHERE status = 'VOID';

-- ============================================================================
-- CREATE RLS POLICY FOR SOFT DELETE FUNCTION
-- ============================================================================

-- Allow staff to execute the function for their bars
-- Note: Function uses SECURITY DEFINER so it runs with creator's permissions
-- The function itself checks bar permissions internally

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Test the function (replace UUIDs with actual values)
-- SELECT soft_delete_unclaimed_receipt(
--   'receipt-uuid-here',
--   'staff-user-uuid-here'
-- );

-- Check voided receipts
-- SELECT 
--   id,
--   receipt_number,
--   status,
--   total,
--   voided_at,
--   voided_by_staff_id
-- FROM pos_receipts
-- WHERE status = 'VOID'
-- ORDER BY voided_at DESC;

-- Check audit logs for voided receipts
-- SELECT 
--   al.created_at,
--   al.action,
--   al.details->>'receipt_id' as receipt_id,
--   al.details->>'previous_status' as previous_status,
--   u.email as staff_email
-- FROM audit_logs al
-- LEFT JOIN auth.users u ON al.staff_id = u.id
-- WHERE al.action = 'receipt_voided'
-- ORDER BY al.created_at DESC;

