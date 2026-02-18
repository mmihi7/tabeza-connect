-- Migration: Create POS Receipt Capture Tables
-- Purpose: Transform TabezaConnect from blocking intermediary to passive receipt capture
-- Requirements: 14.1, 14.2, 14.3
-- Date: 2024

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Receipt status enum
CREATE TYPE receipt_status AS ENUM (
  'CAPTURED',      -- Received from capture service, not yet parsed
  'PARSING',       -- Currently being processed
  'PARSED',        -- Structured data available
  'UNCLAIMED',     -- Visible in customer "Recent receipts"
  'CLAIMED',       -- Linked to a customer tab
  'PAID',          -- Payment confirmed
  'VOID',          -- Marked void by staff (not claimable)
  'PARSE_FAILED'   -- Regex and AI both failed (physical receipt only)
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Raw POS receipts (immutable storage)
CREATE TABLE raw_pos_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL, -- TabezaConnect device ID
  timestamp TIMESTAMPTZ NOT NULL,
  escpos_bytes TEXT, -- base64 encoded ESC/POS data
  text TEXT NOT NULL, -- converted text from ESC/POS
  metadata JSONB, -- {jobId, source, fileSize, printerName}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE raw_pos_receipts IS 'Immutable storage of raw POS receipt data captured from print spooler';
COMMENT ON COLUMN raw_pos_receipts.escpos_bytes IS 'Base64 encoded ESC/POS byte data from print spooler';
COMMENT ON COLUMN raw_pos_receipts.text IS 'ASCII text converted from ESC/POS bytes';
COMMENT ON COLUMN raw_pos_receipts.metadata IS 'Print job metadata: {jobId, source, fileSize, printerName}';

-- Parsed POS receipts (structured data)
CREATE TABLE pos_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_receipt_id UUID NOT NULL REFERENCES raw_pos_receipts(id) ON DELETE CASCADE,
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  receipt_number TEXT, -- Extracted from receipt
  subtotal DECIMAL(10, 2) NOT NULL,
  tax DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  parsed_at TIMESTAMPTZ DEFAULT NOW(),
  confidence_score DECIMAL(3, 2) NOT NULL, -- 0.00 to 1.00
  parsing_method TEXT NOT NULL, -- 'regex' or 'ai'
  template_version INT, -- Version of template used
  status receipt_status NOT NULL DEFAULT 'PARSED',
  claimed_by_tab_id UUID REFERENCES tabs(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE pos_receipts IS 'Parsed POS receipts with structured data';
COMMENT ON COLUMN pos_receipts.confidence_score IS 'Parsing confidence from 0.00 to 1.00';
COMMENT ON COLUMN pos_receipts.parsing_method IS 'Method used: regex (fast) or ai (fallback)';
COMMENT ON COLUMN pos_receipts.template_version IS 'Version of parsing template used';

-- POS receipt line items
CREATE TABLE pos_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES pos_receipts(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  quantity INT NOT NULL,
  item_name TEXT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL
);

COMMENT ON TABLE pos_receipt_items IS 'Individual line items from parsed POS receipts';

-- Tab-to-receipt linking (join table)
CREATE TABLE tab_pos_receipts (
  tab_id UUID NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  pos_receipt_id UUID NOT NULL REFERENCES pos_receipts(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tab_id, pos_receipt_id)
);

COMMENT ON TABLE tab_pos_receipts IS 'Links POS receipts to customer tabs (a tab can have multiple receipts)';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- raw_pos_receipts indexes
CREATE INDEX idx_raw_pos_receipts_bar ON raw_pos_receipts(bar_id);
CREATE INDEX idx_raw_pos_receipts_timestamp ON raw_pos_receipts(timestamp DESC);
CREATE INDEX idx_raw_pos_receipts_device ON raw_pos_receipts(device_id);
CREATE INDEX idx_raw_pos_receipts_created ON raw_pos_receipts(created_at DESC);

-- pos_receipts indexes
CREATE INDEX idx_pos_receipts_bar ON pos_receipts(bar_id);
CREATE INDEX idx_pos_receipts_raw ON pos_receipts(raw_receipt_id);
CREATE INDEX idx_pos_receipts_tab ON pos_receipts(claimed_by_tab_id);
CREATE INDEX idx_pos_receipts_status ON pos_receipts(status);
CREATE INDEX idx_pos_receipts_confidence ON pos_receipts(confidence_score);
CREATE INDEX idx_pos_receipts_timestamp ON pos_receipts(created_at DESC);
CREATE INDEX idx_pos_receipts_unclaimed ON pos_receipts(bar_id, status) WHERE status = 'UNCLAIMED';
CREATE INDEX idx_pos_receipts_recent_unclaimed ON pos_receipts(bar_id, created_at DESC) WHERE status = 'UNCLAIMED';
CREATE INDEX idx_pos_receipts_parsing_method ON pos_receipts(parsing_method);

-- pos_receipt_items indexes
CREATE INDEX idx_pos_receipt_items_receipt ON pos_receipt_items(receipt_id);
CREATE INDEX idx_pos_receipt_items_line ON pos_receipt_items(receipt_id, line_number);

-- tab_pos_receipts indexes
CREATE INDEX idx_tab_pos_receipts_tab ON tab_pos_receipts(tab_id);
CREATE INDEX idx_tab_pos_receipts_receipt ON tab_pos_receipts(pos_receipt_id);

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

-- Ensure confidence score is between 0 and 1
ALTER TABLE pos_receipts ADD CONSTRAINT pos_receipts_confidence_check 
  CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00);

-- Ensure parsing method is valid
ALTER TABLE pos_receipts ADD CONSTRAINT pos_receipts_parsing_method_check 
  CHECK (parsing_method IN ('regex', 'ai'));

-- Ensure currency is valid (can be extended)
ALTER TABLE pos_receipts ADD CONSTRAINT pos_receipts_currency_check 
  CHECK (currency IN ('KES', 'USD', 'EUR', 'GBP'));

-- Ensure quantities are positive
ALTER TABLE pos_receipt_items ADD CONSTRAINT pos_receipt_items_quantity_check 
  CHECK (quantity > 0);

-- Ensure prices are non-negative
ALTER TABLE pos_receipt_items ADD CONSTRAINT pos_receipt_items_price_check 
  CHECK (unit_price >= 0 AND total_price >= 0);

-- ============================================================================
-- RLS POLICIES (Row Level Security)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE raw_pos_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tab_pos_receipts ENABLE ROW LEVEL SECURITY;

-- raw_pos_receipts policies
CREATE POLICY "Staff can view raw receipts for their bars"
  ON raw_pos_receipts FOR SELECT
  USING (
    bar_id IN (
      SELECT bar_id FROM user_bars 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Capture service can insert raw receipts"
  ON raw_pos_receipts FOR INSERT
  WITH CHECK (true); -- Service uses service role key

-- pos_receipts policies
CREATE POLICY "Staff can view parsed receipts for their bars"
  ON pos_receipts FOR SELECT
  USING (
    bar_id IN (
      SELECT bar_id FROM user_bars 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can view their claimed receipts"
  ON pos_receipts FOR SELECT
  USING (
    claimed_by_tab_id IN (
      SELECT id FROM tabs 
      WHERE owner_identifier = auth.uid()::text
    )
  );

CREATE POLICY "Staff can update receipt status"
  ON pos_receipts FOR UPDATE
  USING (
    bar_id IN (
      SELECT bar_id FROM user_bars 
      WHERE user_id = auth.uid()
    )
  );

-- pos_receipt_items policies
CREATE POLICY "Staff can view receipt items for their bars"
  ON pos_receipt_items FOR SELECT
  USING (
    receipt_id IN (
      SELECT id FROM pos_receipts 
      WHERE bar_id IN (
        SELECT bar_id FROM user_bars 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Customers can view items from their claimed receipts"
  ON pos_receipt_items FOR SELECT
  USING (
    receipt_id IN (
      SELECT id FROM pos_receipts 
      WHERE claimed_by_tab_id IN (
        SELECT id FROM tabs 
        WHERE owner_identifier = auth.uid()::text
      )
    )
  );

-- tab_pos_receipts policies
CREATE POLICY "Staff can view tab-receipt links for their bars"
  ON tab_pos_receipts FOR SELECT
  USING (
    tab_id IN (
      SELECT id FROM tabs 
      WHERE bar_id IN (
        SELECT bar_id FROM user_bars 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Customers can view their tab-receipt links"
  ON tab_pos_receipts FOR SELECT
  USING (
    tab_id IN (
      SELECT id FROM tabs 
      WHERE owner_identifier = auth.uid()::text
    )
  );

-- ============================================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================================

-- Enable realtime for customer receipt updates
ALTER PUBLICATION supabase_realtime ADD TABLE pos_receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE pos_receipt_items;
ALTER PUBLICATION supabase_realtime ADD TABLE tab_pos_receipts;
