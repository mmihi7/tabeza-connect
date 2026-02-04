-- Migration script for existing venues to onboarding system
-- This script handles venues that were created before the onboarding flow was implemented
-- Requirements: 2.1, 2.2, 2.3

-- Begin transaction for atomic migration
BEGIN;

-- Create a backup table for rollback purposes
CREATE TABLE IF NOT EXISTS bars_migration_backup AS 
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
  created_at
FROM bars 
WHERE onboarding_completed IS NULL OR onboarding_completed = false;

-- Log migration start
INSERT INTO audit_logs (action, details, created_at)
VALUES (
  'migration_start',
  jsonb_build_object(
    'migration_type', 'existing_venues_onboarding',
    'affected_venues_count', (
      SELECT COUNT(*) 
      FROM bars 
      WHERE onboarding_completed IS NULL OR onboarding_completed = false
    )
  ),
  now()
);

-- Update existing venues without completed onboarding
-- Set default configuration: venue_mode='venue', authority_mode='tabeza'
UPDATE bars 
SET 
  venue_mode = 'venue',
  authority_mode = 'tabeza',
  pos_integration_enabled = false,
  printer_required = false,
  onboarding_completed = true,
  authority_configured_at = COALESCE(authority_configured_at, now()),
  mode_last_changed_at = COALESCE(mode_last_changed_at, now())
WHERE 
  onboarding_completed IS NULL 
  OR onboarding_completed = false;

-- Get count of migrated venues for logging
DO $migration_log$
DECLARE
  migrated_count INTEGER;
BEGIN
  -- Count venues that were just migrated
  SELECT COUNT(*) INTO migrated_count
  FROM bars 
  WHERE id IN (
    SELECT id FROM bars_migration_backup
  );
  
  -- Log successful migration
  INSERT INTO audit_logs (action, details, created_at)
  VALUES (
    'migration_complete',
    jsonb_build_object(
      'migration_type', 'existing_venues_onboarding',
      'migrated_venues_count', migrated_count,
      'default_config', jsonb_build_object(
        'venue_mode', 'venue',
        'authority_mode', 'tabeza',
        'pos_integration_enabled', false,
        'printer_required', false,
        'onboarding_completed', true
      )
    ),
    now()
  );
  
  -- Output migration summary
  RAISE NOTICE 'Migration completed successfully. Migrated % venues to default configuration.', migrated_count;
END;
$migration_log$;

-- Verify migration results
DO $migration_verify$
DECLARE
  invalid_count INTEGER;
  incomplete_count INTEGER;
BEGIN
  -- Check for any venues with invalid configurations
  SELECT COUNT(*) INTO invalid_count
  FROM bars 
  WHERE 
    -- Basic mode must use POS authority
    (venue_mode = 'basic' AND authority_mode != 'pos') OR
    -- Basic mode must require printer
    (venue_mode = 'basic' AND printer_required != true) OR
    -- POS authority must have integration enabled
    (authority_mode = 'pos' AND pos_integration_enabled != true) OR
    -- Tabeza authority must have integration disabled
    (authority_mode = 'tabeza' AND pos_integration_enabled != false);
  
  -- Check for any venues still without completed onboarding
  SELECT COUNT(*) INTO incomplete_count
  FROM bars 
  WHERE onboarding_completed IS NULL OR onboarding_completed = false;
  
  -- Raise error if validation fails
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Migration validation failed: % venues have invalid configurations', invalid_count;
  END IF;
  
  IF incomplete_count > 0 THEN
    RAISE EXCEPTION 'Migration validation failed: % venues still have incomplete onboarding', incomplete_count;
  END IF;
  
  -- Log successful validation
  INSERT INTO audit_logs (action, details, created_at)
  VALUES (
    'migration_validated',
    jsonb_build_object(
      'migration_type', 'existing_venues_onboarding',
      'validation_result', 'success',
      'invalid_configurations', invalid_count,
      'incomplete_onboarding', incomplete_count
    ),
    now()
  );
  
  RAISE NOTICE 'Migration validation passed. All venues have valid configurations.';
END;
$migration_verify$;

-- Create index for efficient onboarding queries if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_bars_onboarding_incomplete 
ON bars(onboarding_completed) 
WHERE onboarding_completed = false;

-- Commit transaction
COMMIT;

-- Rollback script (to be run separately if needed)
/*
-- ROLLBACK SCRIPT - Run this if migration needs to be reversed
-- WARNING: This will restore venues to their pre-migration state

BEGIN;

-- Restore venues from backup
UPDATE bars 
SET 
  venue_mode = backup.venue_mode,
  authority_mode = backup.authority_mode,
  pos_integration_enabled = backup.pos_integration_enabled,
  printer_required = backup.printer_required,
  onboarding_completed = backup.onboarding_completed,
  authority_configured_at = backup.authority_configured_at,
  mode_last_changed_at = backup.mode_last_changed_at
FROM bars_migration_backup backup
WHERE bars.id = backup.id;

-- Log rollback
INSERT INTO audit_logs (action, details, created_at)
VALUES (
  'migration_rollback',
  jsonb_build_object(
    'migration_type', 'existing_venues_onboarding',
    'rollback_reason', 'manual_rollback'
  ),
  now()
);

-- Drop backup table
DROP TABLE IF EXISTS bars_migration_backup;

COMMIT;
*/

-- Cleanup script (to be run after confirming migration success)
/*
-- CLEANUP SCRIPT - Run this after confirming migration is successful
-- This removes the backup table to free up space

DROP TABLE IF EXISTS bars_migration_backup;

INSERT INTO audit_logs (action, details, created_at)
VALUES (
  'migration_cleanup',
  jsonb_build_object(
    'migration_type', 'existing_venues_onboarding',
    'cleanup_action', 'backup_table_dropped'
  ),
  now()
);
*/