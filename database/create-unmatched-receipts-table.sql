-- Create unmatched_receipts table for POS Receipt Assignment Modal
-- This table stores receipts that have been intercepted from POS but not yet assigned to customer tabs

CREATE TABLE IF NOT EXISTS unmatched_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  receipt_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  assigned_to_tab_id UUID REFERENCES tabs(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  
  CONSTRAINT unmatched_receipts_status_check CHECK (
    status IN ('pending', 'assigned', 'expired')
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_unmatched_receipts_bar_status 
  ON unmatched_receipts(bar_id, status);
  
CREATE INDEX IF NOT EXISTS idx_unmatched_receipts_expires 
  ON unmatched_receipts(expires_at);

CREATE INDEX IF NOT EXISTS idx_unmatched_receipts_created_at 
  ON unmatched_receipts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_unmatched_receipts_assigned_tab 
  ON unmatched_receipts(assigned_to_tab_id);

-- Comments for documentation
COMMENT ON TABLE unmatched_receipts IS 'POS receipts awaiting assignment to customer tabs via Staff PWA modal';
COMMENT ON COLUMN unmatched_receipts.receipt_data IS 'Complete receipt data including venue name, items, quantities, prices, subtotal, tax, and total';
COMMENT ON COLUMN unmatched_receipts.status IS 'Receipt status: pending (awaiting assignment), assigned (linked to tab), expired (older than 1 hour)';
COMMENT ON COLUMN unmatched_receipts.expires_at IS 'Timestamp when receipt expires (1 hour from creation)';

-- Function to automatically expire old receipts
CREATE OR REPLACE FUNCTION expire_old_receipts()
RETURNS void AS $$
BEGIN
  UPDATE unmatched_receipts
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update assigned_at timestamp
CREATE OR REPLACE FUNCTION update_receipt_assigned_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'assigned' AND OLD.status = 'pending' AND NEW.assigned_at IS NULL THEN
    NEW.assigned_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically set assigned_at timestamp
CREATE TRIGGER trigger_update_receipt_assigned_at
  BEFORE UPDATE ON unmatched_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_receipt_assigned_at();

-- Enable Row Level Security
ALTER TABLE unmatched_receipts ENABLE ROW LEVEL SECURITY;

-- Policy: Bar staff can view their bar's unmatched receipts
CREATE POLICY unmatched_receipts_bar_staff_select ON unmatched_receipts
  FOR SELECT
  USING (
    bar_id IN (
      SELECT bar_id FROM user_bars 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: System can insert unmatched receipts (from printer service)
CREATE POLICY unmatched_receipts_system_insert ON unmatched_receipts
  FOR INSERT
  WITH CHECK (true);

-- Policy: Bar staff can update their bar's unmatched receipts (for assignment)
CREATE POLICY unmatched_receipts_bar_staff_update ON unmatched_receipts
  FOR UPDATE
  USING (
    bar_id IN (
      SELECT bar_id FROM user_bars 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    bar_id IN (
      SELECT bar_id FROM user_bars 
      WHERE user_id = auth.uid()
    )
  );

-- Enable Supabase Realtime for this table
-- Note: This needs to be run in Supabase dashboard or via Supabase CLI
-- ALTER PUBLICATION supabase_realtime ADD TABLE unmatched_receipts;

-- View for unmatched receipt statistics
CREATE OR REPLACE VIEW unmatched_receipt_stats AS
SELECT 
  bar_id,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'assigned') as assigned_count,
  COUNT(*) FILTER (WHERE status = 'expired') as expired_count,
  AVG(EXTRACT(EPOCH FROM (assigned_at - created_at))) FILTER (WHERE assigned_at IS NOT NULL) as avg_assignment_seconds,
  MAX(created_at) as last_receipt_at
FROM unmatched_receipts
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY bar_id;

COMMENT ON VIEW unmatched_receipt_stats IS 'Statistics on unmatched receipt processing by bar (last 24 hours)';
