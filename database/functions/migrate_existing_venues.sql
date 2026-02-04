-- Function to migrate existing venues to onboarding system
-- This provides a safe, callable function for the migration
-- Requirements: 2.1, 2.2, 2.3

CREATE OR REPLACE FUNCTION migrate_existing_venues_to_onboarding()
RETURNS TABLE (
  migration_id uuid,
  venues_migrated integer,
  migration_status text,
  error_message text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  migration_uuid uuid;
  venues_count integer;
  error_msg text;
BEGIN
  -- Generate unique migration ID
  migration_uuid := gen_random_uuid();
  
  -- Initialize return values
  migration_id := migration_uuid;
  venues_migrated := 0;
  migration_status := 'started';
  error_message := null;
  
  BEGIN
    -- Count venues that need migration
    SELECT COUNT(*) INTO venues_count
    FROM bars 
    WHERE onboarding_completed IS NULL OR onboarding_completed = false;
    
    -- Log migration start
    INSERT INTO audit_logs (action, details, created_at)
    VALUES (
      'migration_function_start',
      jsonb_build_object(
        'migration_id', migration_uuid,
        'migration_type', 'existing_venues_onboarding',
        'venues_to_migrate', venues_count
      ),
      now()
    );
    
    -- Perform the migration
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
    
    -- Get actual count of migrated venues
    GET DIAGNOSTICS venues_migrated = ROW_COUNT;
    
    -- Validate migration results
    DECLARE
      invalid_count integer;
      incomplete_count integer;
    BEGIN
      -- Check for invalid configurations
      SELECT COUNT(*) INTO invalid_count
      FROM bars 
      WHERE 
        (venue_mode = 'basic' AND authority_mode != 'pos') OR
        (venue_mode = 'basic' AND printer_required != true) OR
        (authority_mode = 'pos' AND pos_integration_enabled != true) OR
        (authority_mode = 'tabeza' AND pos_integration_enabled != false);
      
      -- Check for incomplete onboarding
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
    END;
    
    -- Log successful migration
    INSERT INTO audit_logs (action, details, created_at)
    VALUES (
      'migration_function_success',
      jsonb_build_object(
        'migration_id', migration_uuid,
        'migration_type', 'existing_venues_onboarding',
        'venues_migrated', venues_migrated,
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
    
    migration_status := 'completed';
    
  EXCEPTION WHEN OTHERS THEN
    -- Capture error details
    error_msg := SQLERRM;
    migration_status := 'failed';
    error_message := error_msg;
    
    -- Log migration failure
    INSERT INTO audit_logs (action, details, created_at)
    VALUES (
      'migration_function_error',
      jsonb_build_object(
        'migration_id', migration_uuid,
        'migration_type', 'existing_venues_onboarding',
        'error_message', error_msg,
        'venues_migrated', venues_migrated
      ),
      now()
    );
    
    -- Re-raise the exception to ensure transaction rollback
    RAISE;
  END;
  
  -- Return migration results
  RETURN NEXT;
END;
$function$;

-- Grant execute permission to authenticated users (adjust as needed)
GRANT EXECUTE ON FUNCTION migrate_existing_venues_to_onboarding() TO authenticated;

-- Add function comment
COMMENT ON FUNCTION migrate_existing_venues_to_onboarding() IS 
'Safely migrates existing venues to the onboarding system with default configuration: venue_mode=venue, authority_mode=tabeza, onboarding_completed=true';

-- Example usage:
-- SELECT * FROM migrate_existing_venues_to_onboarding();