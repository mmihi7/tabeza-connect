-- Create print_jobs table only (safe to run multiple times)
-- This is a minimal version that just creates the table needed for the relay API

-- Drop trigger if it exists (from failed migration)
DROP TRIGGER IF EXISTS trigger_update_receipt_timestamps ON digital_receipts;

-- Drop function if it exists
DROP FUNCTION IF EXISTS update_receipt_viewed_at();

-- Create print_jobs table
CREATE TABLE IF NOT EXISTS print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL,
  raw_data TEXT NOT NULL,
  parsed_data JSONB,
  printer_name TEXT,
  document_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'received',
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  matched_tab_id UUID REFERENCES tabs(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT print_jobs_status_check CHECK (
    status IN ('received', 'processed', 'parsed', 'pending', 'error', 'no_match')
  )
);

-- Create digital_receipts table
CREATE TABLE IF NOT EXISTS digital_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id UUID NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  print_job_id UUID REFERENCES print_jobs(id) ON DELETE SET NULL,
  receipt_data JSONB NOT NULL,
  receipt_number TEXT,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'delivered',
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_print_jobs_bar_id ON print_jobs(bar_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_driver_id ON print_jobs(driver_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_received_at ON print_jobs(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_digital_receipts_tab_id ON digital_receipts(tab_id);
CREATE INDEX IF NOT EXISTS idx_digital_receipts_bar_id ON digital_receipts(bar_id);
CREATE INDEX IF NOT EXISTS idx_digital_receipts_status ON digital_receipts(status);

-- Enable RLS
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_receipts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS print_jobs_system_insert ON print_jobs;
DROP POLICY IF EXISTS print_jobs_bar_staff_select ON print_jobs;
DROP POLICY IF EXISTS digital_receipts_system_insert ON digital_receipts;
DROP POLICY IF EXISTS digital_receipts_bar_staff_select ON digital_receipts;

-- Create policies
CREATE POLICY print_jobs_system_insert ON print_jobs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY print_jobs_bar_staff_select ON print_jobs
  FOR SELECT
  USING (
    bar_id IN (
      SELECT bar_id FROM user_bars 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY digital_receipts_system_insert ON digital_receipts
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY digital_receipts_bar_staff_select ON digital_receipts
  FOR SELECT
  USING (
    bar_id IN (
      SELECT bar_id FROM user_bars 
      WHERE user_id = auth.uid()
    )
  );

-- Recreate the function and trigger
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

CREATE TRIGGER trigger_update_receipt_timestamps
  BEFORE UPDATE ON digital_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_receipt_viewed_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Print jobs tables created successfully!';
  RAISE NOTICE '📋 Tables: print_jobs, digital_receipts';
  RAISE NOTICE '🎉 You can now test the printer service';
END $$;
