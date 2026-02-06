-- Add printer relay tables for virtual printer driver integration
-- This enables POS systems to send receipts to Tabeza via virtual printer drivers

-- Print jobs table - stores raw print data from POS systems
CREATE TABLE IF NOT EXISTS print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL,                    -- Unique driver installation ID
  raw_data TEXT NOT NULL,                     -- Base64 encoded ESC/POS data
  parsed_data JSONB,                          -- Parsed receipt data
  printer_name TEXT,                          -- System printer name
  document_name TEXT,                         -- Document name from print job
  metadata JSONB DEFAULT '{}'::jsonb,         -- Additional metadata
  status TEXT NOT NULL DEFAULT 'received',    -- received, processed, error, no_match
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  matched_tab_id UUID REFERENCES tabs(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT print_jobs_status_check CHECK (
    status IN ('received', 'processed', 'error', 'no_match')
  )
);

-- Digital receipts table - stores receipts delivered to customers
CREATE TABLE IF NOT EXISTS digital_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id UUID NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  print_job_id UUID REFERENCES print_jobs(id) ON DELETE SET NULL,
  receipt_data JSONB NOT NULL,                -- Parsed receipt with items, totals
  receipt_number TEXT,                        -- Receipt/invoice number
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'delivered',   -- delivered, viewed, paid
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT digital_receipts_status_check CHECK (
    status IN ('delivered', 'viewed', 'paid')
  ),
  CONSTRAINT digital_receipts_amount_check CHECK (
    total_amount >= 0
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_print_jobs_bar_id ON print_jobs(bar_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_driver_id ON print_jobs(driver_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_received_at ON print_jobs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_jobs_matched_tab ON print_jobs(matched_tab_id);

CREATE INDEX IF NOT EXISTS idx_digital_receipts_tab_id ON digital_receipts(tab_id);
CREATE INDEX IF NOT EXISTS idx_digital_receipts_bar_id ON digital_receipts(bar_id);
CREATE INDEX IF NOT EXISTS idx_digital_receipts_print_job ON digital_receipts(print_job_id);
CREATE INDEX IF NOT EXISTS idx_digital_receipts_status ON digital_receipts(status);
CREATE INDEX IF NOT EXISTS idx_digital_receipts_delivered_at ON digital_receipts(delivered_at DESC);

-- Comments for documentation
COMMENT ON TABLE print_jobs IS 'Raw print jobs captured from POS systems via virtual printer drivers';
COMMENT ON TABLE digital_receipts IS 'Digital receipts delivered to customer tabs';

COMMENT ON COLUMN print_jobs.driver_id IS 'Unique identifier for the printer driver installation';
COMMENT ON COLUMN print_jobs.raw_data IS 'Base64 encoded ESC/POS thermal printer data';
COMMENT ON COLUMN print_jobs.parsed_data IS 'Parsed receipt data including items, totals, and customer info';
COMMENT ON COLUMN print_jobs.status IS 'Processing status: received, processed, error, no_match';
COMMENT ON COLUMN print_jobs.matched_tab_id IS 'Customer tab that this receipt was matched to';

COMMENT ON COLUMN digital_receipts.receipt_data IS 'Complete receipt data with items, prices, and totals';
COMMENT ON COLUMN digital_receipts.status IS 'Receipt status: delivered, viewed, paid';

-- Function to update receipt status when viewed
CREATE OR REPLACE FUNCTION update_receipt_viewed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'viewed' AND OLD.status = 'delivered' AND NEW.viewed_at IS NULL THEN
    NEW.viewed_at = NOW();
  END IF;
  
  IF NEW.status = 'paid' AND OLD.status != 'paid' AND NEW.paid_at IS NULL THEN
    NEW.paid_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically set viewed_at and paid_at timestamps
CREATE TRIGGER trigger_update_receipt_timestamps
  BEFORE UPDATE ON digital_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_receipt_viewed_at();

-- View for receipt processing statistics
CREATE OR REPLACE VIEW print_job_stats AS
SELECT 
  bar_id,
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE status = 'processed') as processed_jobs,
  COUNT(*) FILTER (WHERE status = 'error') as error_jobs,
  COUNT(*) FILTER (WHERE status = 'no_match') as unmatched_jobs,
  AVG(EXTRACT(EPOCH FROM (processed_at - received_at))) FILTER (WHERE processed_at IS NOT NULL) as avg_processing_seconds,
  MAX(received_at) as last_job_at
FROM print_jobs
GROUP BY bar_id;

COMMENT ON VIEW print_job_stats IS 'Statistics on print job processing by bar';

-- Grant permissions (adjust as needed for your RLS policies)
-- These are examples - adjust based on your security requirements
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_receipts ENABLE ROW LEVEL SECURITY;

-- Policy: Bar staff can view their bar's print jobs
CREATE POLICY print_jobs_bar_staff_select ON print_jobs
  FOR SELECT
  USING (
    bar_id IN (
      SELECT bar_id FROM user_bars 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: System can insert print jobs (from driver service)
CREATE POLICY print_jobs_system_insert ON print_jobs
  FOR INSERT
  WITH CHECK (true); -- Adjust based on your authentication method

-- Policy: Customers can view their own digital receipts
CREATE POLICY digital_receipts_customer_select ON digital_receipts
  FOR SELECT
  USING (
    tab_id IN (
      SELECT id FROM tabs 
      WHERE device_identifier = current_setting('request.headers')::json->>'x-device-id'
      OR owner_identifier = current_setting('request.headers')::json->>'x-customer-id'
    )
  );

-- Policy: Bar staff can view their bar's digital receipts
CREATE POLICY digital_receipts_bar_staff_select ON digital_receipts
  FOR SELECT
  USING (
    bar_id IN (
      SELECT bar_id FROM user_bars 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: System can insert digital receipts
CREATE POLICY digital_receipts_system_insert ON digital_receipts
  FOR INSERT
  WITH CHECK (true); -- Adjust based on your authentication method

-- Policy: Customers can update their receipt status (mark as viewed)
CREATE POLICY digital_receipts_customer_update ON digital_receipts
  FOR UPDATE
  USING (
    tab_id IN (
      SELECT id FROM tabs 
      WHERE device_identifier = current_setting('request.headers')::json->>'x-device-id'
      OR owner_identifier = current_setting('request.headers')::json->>'x-customer-id'
    )
  )
  WITH CHECK (
    tab_id IN (
      SELECT id FROM tabs 
      WHERE device_identifier = current_setting('request.headers')::json->>'x-device-id'
      OR owner_identifier = current_setting('request.headers')::json->>'x-customer-id'
    )
  );
