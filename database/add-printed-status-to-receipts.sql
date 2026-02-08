-- Add 'printed' status to unmatched_receipts table
-- This supports the dual workflow: assign to tab OR print for non-Tabeza customers

-- Drop the existing constraint
ALTER TABLE unmatched_receipts 
  DROP CONSTRAINT IF EXISTS unmatched_receipts_status_check;

-- Add new constraint with 'printed' status
ALTER TABLE unmatched_receipts 
  ADD CONSTRAINT unmatched_receipts_status_check CHECK (
    status IN ('pending', 'assigned', 'printed', 'expired')
  );

-- Update comment to reflect new status
COMMENT ON COLUMN unmatched_receipts.status IS 'Receipt status: pending (awaiting action), assigned (linked to tab), printed (physically printed for non-Tabeza customer), expired (older than 1 hour)';

-- Update the trigger function to handle 'printed' status
CREATE OR REPLACE FUNCTION update_receipt_assigned_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Set assigned_at for both 'assigned' and 'printed' statuses
  IF (NEW.status IN ('assigned', 'printed')) AND 
     (OLD.status = 'pending') AND 
     (NEW.assigned_at IS NULL) THEN
    NEW.assigned_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the stats view to include printed count
CREATE OR REPLACE VIEW unmatched_receipt_stats AS
SELECT 
  bar_id,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'assigned') as assigned_count,
  COUNT(*) FILTER (WHERE status = 'printed') as printed_count,
  COUNT(*) FILTER (WHERE status = 'expired') as expired_count,
  AVG(EXTRACT(EPOCH FROM (assigned_at - created_at))) FILTER (WHERE assigned_at IS NOT NULL) as avg_assignment_seconds,
  MAX(created_at) as last_receipt_at
FROM unmatched_receipts
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY bar_id;

COMMENT ON VIEW unmatched_receipt_stats IS 'Statistics on unmatched receipt processing by bar (last 24 hours) - includes printed receipts for non-Tabeza customers';
