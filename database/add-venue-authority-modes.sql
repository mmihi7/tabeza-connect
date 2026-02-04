-- Add venue mode and authority configuration to bars table
-- This implements the Core Truth & Order Authority Model

-- Create enums for venue and authority modes
CREATE TYPE venue_mode_enum AS ENUM ('basic', 'venue');
CREATE TYPE authority_mode_enum AS ENUM ('pos', 'tabeza');

-- Add new columns to bars table
ALTER TABLE bars 
ADD COLUMN venue_mode venue_mode_enum DEFAULT 'venue',
ADD COLUMN authority_mode authority_mode_enum DEFAULT 'tabeza',
ADD COLUMN pos_integration_enabled boolean DEFAULT false,
ADD COLUMN printer_required boolean DEFAULT false,
ADD COLUMN onboarding_completed boolean DEFAULT false,
ADD COLUMN authority_configured_at timestamp with time zone,
ADD COLUMN mode_last_changed_at timestamp with time zone DEFAULT now();

-- Add constraints to enforce Core Truth rules
ALTER TABLE bars 
ADD CONSTRAINT bars_venue_authority_check 
CHECK (
  -- Basic mode must use POS authority
  (venue_mode = 'basic' AND authority_mode = 'pos') OR
  -- Venue mode can use either authority
  (venue_mode = 'venue' AND authority_mode IN ('pos', 'tabeza'))
);

-- Add constraint for printer requirements
ALTER TABLE bars 
ADD CONSTRAINT bars_printer_requirement_check 
CHECK (
  -- Basic mode always requires printer
  (venue_mode = 'basic' AND printer_required = true) OR
  -- Venue mode printer is optional
  (venue_mode = 'venue')
);

-- Add constraint for POS integration consistency
ALTER TABLE bars 
ADD CONSTRAINT bars_pos_integration_check 
CHECK (
  -- POS authority should have integration enabled
  (authority_mode = 'pos' AND pos_integration_enabled = true) OR
  -- Tabeza authority should have integration disabled
  (authority_mode = 'tabeza' AND pos_integration_enabled = false)
);

-- Create indexes for performance
CREATE INDEX idx_bars_venue_mode ON bars(venue_mode);
CREATE INDEX idx_bars_authority_mode ON bars(authority_mode);
CREATE INDEX idx_bars_onboarding_completed ON bars(onboarding_completed);

-- Update existing bars to default configuration
-- Assume existing bars are Venue mode with Tabeza authority (current behavior)
UPDATE bars 
SET 
  venue_mode = 'venue',
  authority_mode = 'tabeza',
  pos_integration_enabled = false,
  printer_required = false,
  onboarding_completed = true,
  authority_configured_at = now(),
  mode_last_changed_at = now()
WHERE venue_mode IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN bars.venue_mode IS 'Application scope: basic (POS bridge) or venue (full service)';
COMMENT ON COLUMN bars.authority_mode IS 'Digital order authority: pos (external) or tabeza (internal)';
COMMENT ON COLUMN bars.pos_integration_enabled IS 'Whether POS integration features are active';
COMMENT ON COLUMN bars.printer_required IS 'Whether thermal printer is required for operation';
COMMENT ON COLUMN bars.onboarding_completed IS 'Whether venue has completed mode selection onboarding';
COMMENT ON COLUMN bars.authority_configured_at IS 'When authority mode was last configured';
COMMENT ON COLUMN bars.mode_last_changed_at IS 'When venue/authority mode was last changed';

-- Create function to validate mode changes
CREATE OR REPLACE FUNCTION validate_venue_authority_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log mode changes
  IF OLD.venue_mode != NEW.venue_mode OR OLD.authority_mode != NEW.authority_mode THEN
    NEW.mode_last_changed_at = now();
    
    -- If authority mode changed, update configured timestamp
    IF OLD.authority_mode != NEW.authority_mode THEN
      NEW.authority_configured_at = now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for mode change validation
CREATE TRIGGER trigger_validate_venue_authority_change
  BEFORE UPDATE ON bars
  FOR EACH ROW
  EXECUTE FUNCTION validate_venue_authority_change();

-- Create view for authority configuration summary
CREATE VIEW venue_authority_summary AS
SELECT 
  id,
  name,
  slug,
  venue_mode,
  authority_mode,
  pos_integration_enabled,
  printer_required,
  onboarding_completed,
  authority_configured_at,
  mode_last_changed_at,
  CASE 
    WHEN venue_mode = 'basic' THEN 'Transaction & Receipt Bridge'
    WHEN venue_mode = 'venue' AND authority_mode = 'pos' THEN 'Customer Interaction + POS Integration'
    WHEN venue_mode = 'venue' AND authority_mode = 'tabeza' THEN 'Full Service Platform'
    ELSE 'Unknown Configuration'
  END as configuration_description,
  CASE
    WHEN venue_mode = 'basic' THEN 'POS creates orders, Tabeza mirrors receipts'
    WHEN venue_mode = 'venue' AND authority_mode = 'pos' THEN 'Customers request, POS confirms, Tabeza delivers'
    WHEN venue_mode = 'venue' AND authority_mode = 'tabeza' THEN 'Tabeza handles full order lifecycle'
    ELSE 'Invalid configuration'
  END as workflow_description
FROM bars;

COMMENT ON VIEW venue_authority_summary IS 'Human-readable summary of venue authority configurations';