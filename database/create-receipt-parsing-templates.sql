-- Migration: Create Receipt Parsing Template Tables
-- Purpose: Support AI template generation and self-healing template learning
-- Requirements: 14.4, 14.5, 14.6
-- Date: 2024

-- ============================================================================
-- TABLES
-- ============================================================================

-- Receipt parsing templates (venue-specific regex patterns)
CREATE TABLE receipt_parsing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  version INT NOT NULL,
  patterns JSONB NOT NULL, -- {itemLine, totalLine, taxLine, voidMarker, discountLine}
  semantic_map JSONB NOT NULL, -- {itemLine: ["name", "qty", "unit_price", "line_total"], currency, taxInclusive}
  known_edge_cases JSONB, -- ["split_bill_header", "happy_hour_suffix", ...]
  confidence_threshold DECIMAL(3, 2) NOT NULL DEFAULT 0.85,
  active BOOLEAN DEFAULT FALSE,
  accuracy DECIMAL(3, 2), -- 0.00 to 1.00
  receipt_samples_used INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);

COMMENT ON TABLE receipt_parsing_templates IS 'Venue-specific regex templates for receipt parsing';
COMMENT ON COLUMN receipt_parsing_templates.patterns IS 'JSONB object with regex patterns: {itemLine, totalLine, taxLine, voidMarker, discountLine}';
COMMENT ON COLUMN receipt_parsing_templates.semantic_map IS 'Maps capture groups to fields: {itemLine: ["name", "qty", "unit_price", "line_total"], currency, taxInclusive}';
COMMENT ON COLUMN receipt_parsing_templates.known_edge_cases IS 'Array of known edge case identifiers for this venue';
COMMENT ON COLUMN receipt_parsing_templates.confidence_threshold IS 'Minimum confidence score (0.00-1.00) to accept regex parsing';
COMMENT ON COLUMN receipt_parsing_templates.accuracy IS 'Template accuracy from testing against sample receipts';
COMMENT ON COLUMN receipt_parsing_templates.receipt_samples_used IS 'Number of receipts used to generate this template';

-- Template learning events (AI parsing results for template evolution)
CREATE TABLE template_learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  raw_receipt_id UUID NOT NULL REFERENCES raw_pos_receipts(id) ON DELETE CASCADE,
  ai_output JSONB NOT NULL, -- Parsed result from AI
  new_pattern_detected TEXT,
  promoted_to_template BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE template_learning_events IS 'AI parsing events used for template evolution';
COMMENT ON COLUMN template_learning_events.ai_output IS 'Structured receipt data from AI parser';
COMMENT ON COLUMN template_learning_events.new_pattern_detected IS 'Description of new pattern if detected';
COMMENT ON COLUMN template_learning_events.promoted_to_template IS 'Whether this event contributed to a new template version';

-- Parse failures (tracking for monitoring and improvement)
CREATE TABLE pos_parse_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_receipt_id UUID NOT NULL REFERENCES raw_pos_receipts(id) ON DELETE CASCADE,
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  template_version INT,
  regex_confidence DECIMAL(3, 2),
  ai_attempted BOOLEAN DEFAULT FALSE,
  ai_succeeded BOOLEAN DEFAULT FALSE,
  error_message TEXT NOT NULL,
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE pos_parse_failures IS 'Failed parsing attempts for monitoring and improvement';
COMMENT ON COLUMN pos_parse_failures.regex_confidence IS 'Confidence score from regex parser (if attempted)';
COMMENT ON COLUMN pos_parse_failures.ai_attempted IS 'Whether AI fallback was attempted';
COMMENT ON COLUMN pos_parse_failures.ai_succeeded IS 'Whether AI fallback succeeded';
COMMENT ON COLUMN pos_parse_failures.error_details IS 'Additional error context and debugging information';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- receipt_parsing_templates indexes
CREATE INDEX idx_parsing_templates_bar ON receipt_parsing_templates(bar_id);
CREATE INDEX idx_parsing_templates_active ON receipt_parsing_templates(bar_id, active);
CREATE INDEX idx_parsing_templates_version ON receipt_parsing_templates(bar_id, version DESC);
CREATE INDEX idx_parsing_templates_created ON receipt_parsing_templates(created_at DESC);

-- template_learning_events indexes
CREATE INDEX idx_learning_events_bar ON template_learning_events(bar_id);
CREATE INDEX idx_learning_events_created ON template_learning_events(created_at DESC);
CREATE INDEX idx_learning_events_promoted ON template_learning_events(promoted_to_template);
CREATE INDEX idx_learning_events_raw_receipt ON template_learning_events(raw_receipt_id);

-- pos_parse_failures indexes
CREATE INDEX idx_pos_parse_failures_bar ON pos_parse_failures(bar_id);
CREATE INDEX idx_pos_parse_failures_created ON pos_parse_failures(created_at DESC);
CREATE INDEX idx_pos_parse_failures_raw ON pos_parse_failures(raw_receipt_id);
CREATE INDEX idx_pos_parse_failures_ai_attempted ON pos_parse_failures(ai_attempted);

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

-- Ensure only one active template per bar
CREATE UNIQUE INDEX idx_parsing_templates_bar_active 
  ON receipt_parsing_templates(bar_id) 
  WHERE active = TRUE;

-- Ensure version numbers are positive
ALTER TABLE receipt_parsing_templates ADD CONSTRAINT parsing_templates_version_check 
  CHECK (version > 0);

-- Ensure confidence threshold is between 0 and 1
ALTER TABLE receipt_parsing_templates ADD CONSTRAINT parsing_templates_threshold_check 
  CHECK (confidence_threshold >= 0.00 AND confidence_threshold <= 1.00);

-- Ensure accuracy is between 0 and 1 (if set)
ALTER TABLE receipt_parsing_templates ADD CONSTRAINT parsing_templates_accuracy_check 
  CHECK (accuracy IS NULL OR (accuracy >= 0.00 AND accuracy <= 1.00));

-- Ensure regex confidence is between 0 and 1 (if set)
ALTER TABLE pos_parse_failures ADD CONSTRAINT pos_parse_failures_confidence_check 
  CHECK (regex_confidence IS NULL OR (regex_confidence >= 0.00 AND regex_confidence <= 1.00));

-- ============================================================================
-- RLS POLICIES (Row Level Security)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE receipt_parsing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_parse_failures ENABLE ROW LEVEL SECURITY;

-- receipt_parsing_templates policies
CREATE POLICY "Staff can view templates for their bars"
  ON receipt_parsing_templates FOR SELECT
  USING (
    bar_id IN (
      SELECT bar_id FROM user_bars 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can update templates for their bars"
  ON receipt_parsing_templates FOR UPDATE
  USING (
    bar_id IN (
      SELECT bar_id FROM user_bars 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert templates"
  ON receipt_parsing_templates FOR INSERT
  WITH CHECK (true); -- Service uses service role key

-- template_learning_events policies
CREATE POLICY "Staff can view learning events for their bars"
  ON template_learning_events FOR SELECT
  USING (
    bar_id IN (
      SELECT bar_id FROM user_bars 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert learning events"
  ON template_learning_events FOR INSERT
  WITH CHECK (true); -- Service uses service role key

-- pos_parse_failures policies
CREATE POLICY "Staff can view parse failures for their bars"
  ON pos_parse_failures FOR SELECT
  USING (
    bar_id IN (
      SELECT bar_id FROM user_bars 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert parse failures"
  ON pos_parse_failures FOR INSERT
  WITH CHECK (true); -- Service uses service role key

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get active template for a bar
CREATE OR REPLACE FUNCTION get_active_template(p_bar_id UUID)
RETURNS receipt_parsing_templates AS $$
  SELECT * FROM receipt_parsing_templates
  WHERE bar_id = p_bar_id AND active = TRUE
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION get_active_template IS 'Returns the active parsing template for a bar';

-- Function to count recent parse failures for a bar
CREATE OR REPLACE FUNCTION count_recent_parse_failures(p_bar_id UUID, p_days INT DEFAULT 7)
RETURNS INT AS $$
  SELECT COUNT(*)::INT FROM pos_parse_failures
  WHERE bar_id = p_bar_id 
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION count_recent_parse_failures IS 'Counts parse failures for a bar in the last N days';

-- Function to get template evolution history
CREATE OR REPLACE FUNCTION get_template_history(p_bar_id UUID)
RETURNS TABLE (
  version INT,
  accuracy DECIMAL(3, 2),
  samples_used INT,
  created_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  is_active BOOLEAN
) AS $$
  SELECT 
    version,
    accuracy,
    receipt_samples_used,
    created_at,
    activated_at,
    active
  FROM receipt_parsing_templates
  WHERE bar_id = p_bar_id
  ORDER BY version DESC;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION get_template_history IS 'Returns template version history for a bar';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to deactivate old templates when a new one is activated
CREATE OR REPLACE FUNCTION deactivate_old_templates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.active = TRUE THEN
    -- Deactivate all other templates for this bar
    UPDATE receipt_parsing_templates
    SET active = FALSE
    WHERE bar_id = NEW.bar_id 
      AND id != NEW.id 
      AND active = TRUE;
    
    -- Set activation timestamp
    NEW.activated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_deactivate_old_templates
  BEFORE UPDATE ON receipt_parsing_templates
  FOR EACH ROW
  WHEN (NEW.active = TRUE AND OLD.active = FALSE)
  EXECUTE FUNCTION deactivate_old_templates();

COMMENT ON TRIGGER trigger_deactivate_old_templates ON receipt_parsing_templates IS 
  'Ensures only one template is active per bar at a time';
