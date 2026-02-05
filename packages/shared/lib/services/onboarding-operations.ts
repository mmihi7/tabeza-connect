/**
 * Onboarding Operations Service
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This service handles all database operations related to venue onboarding
 * with comprehensive error handling, retry logic, and user-friendly messaging.
 */

import { 
  withOnboardingErrorHandling, 
  withVenueConfigErrorHandling,
  withMigrationErrorHandling,
  DatabaseOperationResult,
  createUserErrorMessage,
  isTemporaryError
} from './database-error-handler';
import { 
  validateVenueConfiguration,
  generateCorrectedConfiguration,
  getDefaultMigrationConfiguration,
  type VenueConfiguration
} from './venue-configuration-validation';
import {
  getAuditLogger,
  logOnboardingCompletion,
  logConfigurationChange,
  logValidationFailure,
  logOnboardingFailure,
  logMigrationEvent,
  type OnboardingAuditData,
  type ConfigurationChangeAuditData,
  type ValidationFailureAuditData
} from './audit-logger';

// Types for onboarding operations
export interface OnboardingProgress {
  step: 'mode' | 'authority' | 'summary';
  selectedMode: 'basic' | 'venue' | null;
  selectedAuthority: 'pos' | 'tabeza' | null;
  timestamp: number;
  barId?: string;
}

export interface VenueConfigurationInput {
  venue_mode: 'basic' | 'venue';
  authority_mode: 'pos' | 'tabeza';
  pos_integration_enabled?: boolean;
  printer_required?: boolean;
  authority_configured_at?: string;
  mode_last_changed_at?: string;
}

export interface VenueData {
  id: string;
  name: string;
  onboarding_completed: boolean | null;
  venue_mode: 'basic' | 'venue' | null;
  authority_mode: 'pos' | 'tabeza' | null;
  pos_integration_enabled?: boolean;
  printer_required?: boolean;
  authority_configured_at?: string;
  mode_last_changed_at?: string;
}

export interface OnboardingCompletionData {
  venue_mode: 'basic' | 'venue';
  authority_mode: 'pos' | 'tabeza';
  pos_integration_enabled: boolean;
  printer_required: boolean;
  onboarding_completed: boolean;
  authority_configured_at: string;
  mode_last_changed_at: string;
}

export interface MigrationResult {
  migration_id: string;
  venues_migrated: number;
  migration_status: string;
  error_message: string | null;
}

/**
 * Check if a venue needs onboarding
 */
export async function checkOnboardingStatus(
  supabaseClient: any,
  barId: string
): Promise<DatabaseOperationResult<{ needsOnboarding: boolean; venue: VenueData | null }>> {
  return withOnboardingErrorHandling(
    async () => {
      const { data, error } = await supabaseClient
        .from('bars')
        .select('id, name, onboarding_completed, venue_mode, authority_mode, pos_integration_enabled, printer_required, authority_configured_at, mode_last_changed_at')
        .eq('id', barId)
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error('Venue not found');
      }

      const venue = data as VenueData;
      const needsOnboarding = venue.onboarding_completed === false || 
                             venue.onboarding_completed === null ||
                             !venue.venue_mode ||
                             !venue.authority_mode;

      return {
        needsOnboarding,
        venue
      };
    },
    'check_onboarding_status',
    { barId }
  );
}

/**
 * Complete venue onboarding with configuration
 */
export async function completeOnboarding(
  supabaseClient: any,
  barId: string,
  configuration: VenueConfigurationInput,
  userContext?: {
    user_id?: string;
    session_id?: string;
    user_agent?: string;
    ip_address?: string;
    request_id?: string;
  }
): Promise<DatabaseOperationResult<VenueData>> {
  const startTime = Date.now();
  
  return withOnboardingErrorHandling(
    async () => {
      // Validate configuration first
      const validationResult = validateVenueConfiguration(configuration);
      
      if (!validationResult.isValid) {
        // Log validation failure with detailed error information
        await logValidationFailure({
          bar_id: barId,
          validation_type: 'onboarding',
          attempted_config: configuration,
          validation_errors: validationResult.errors,
          constraint_violations: validationResult.errors.filter(e => e.includes('constraint')),
          business_rule_violations: validationResult.errors.filter(e => e.includes('rule')),
          user_action_blocked: true,
          suggested_corrections: validationResult.warnings || [],
          current_config: null as any,
          ...userContext,
          operation_duration_ms: Date.now() - startTime
        });
        
        throw new Error(`Invalid configuration: ${validationResult.errors.join(', ')}`);
      }

      const correctedConfig = validationResult.correctedConfig!;
      
      // Prepare update data
      const updateData: Partial<OnboardingCompletionData> = {
        venue_mode: correctedConfig.venue_mode,
        authority_mode: correctedConfig.authority_mode,
        pos_integration_enabled: correctedConfig.pos_integration_enabled,
        printer_required: correctedConfig.printer_required,
        onboarding_completed: true,
        authority_configured_at: correctedConfig.authority_configured_at,
        mode_last_changed_at: correctedConfig.mode_last_changed_at
      };

      // Update venue configuration
      const { data, error } = await supabaseClient
        .from('bars')
        .update(updateData)
        .eq('id', barId)
        .select('id, name, onboarding_completed, venue_mode, authority_mode, pos_integration_enabled, printer_required, authority_configured_at, mode_last_changed_at')
        .single();

      if (error) throw error;

      // Log successful onboarding completion with comprehensive details
      await logOnboardingCompletion({
        bar_id: barId,
        venue_mode: correctedConfig.venue_mode,
        authority_mode: correctedConfig.authority_mode,
        pos_integration_enabled: correctedConfig.pos_integration_enabled,
        printer_required: correctedConfig.printer_required,
        selected_mode: correctedConfig.venue_mode,
        selected_authority: correctedConfig.authority_mode,
        completion_percentage: 100,
        steps_completed: ['mode', 'authority', 'summary'],
        time_spent_seconds: Math.round((Date.now() - startTime) / 1000),
        validation_errors: validationResult.warnings || [],
        ...userContext,
        operation_duration_ms: Date.now() - startTime
      });

      return data as VenueData;
    },
    'complete_onboarding',
    { 
      barId, 
      configuration: {
        venue_mode: configuration.venue_mode,
        authority_mode: configuration.authority_mode
      }
    }
  );
}

/**
 * Update venue configuration after onboarding
 */
export async function updateVenueConfiguration(
  supabaseClient: any,
  barId: string,
  currentConfig: VenueConfiguration,
  newConfig: VenueConfigurationInput,
  userContext?: {
    user_id?: string;
    session_id?: string;
    user_agent?: string;
    ip_address?: string;
    request_id?: string;
    change_reason?: string;
  }
): Promise<DatabaseOperationResult<VenueData>> {
  const startTime = Date.now();
  
  return withVenueConfigErrorHandling(
    async () => {
      // Import validation function here to avoid circular dependency
      const { validateConfigurationChange } = await import('./venue-configuration-validation');
      
      // Validate configuration change
      const validationResult = validateConfigurationChange(currentConfig, newConfig);
      
      if (!validationResult.isValid) {
        // Log validation failure with detailed error information
        await logValidationFailure({
          bar_id: barId,
          validation_type: 'configuration_change',
          attempted_config: newConfig,
          validation_errors: validationResult.errors,
          constraint_violations: validationResult.errors.filter(e => e.includes('constraint')),
          business_rule_violations: validationResult.errors.filter(e => e.includes('rule')),
          user_action_blocked: true,
          suggested_corrections: validationResult.warnings || [],
          current_config: currentConfig,
          ...userContext,
          operation_duration_ms: Date.now() - startTime
        });
        
        throw new Error(`Invalid configuration change: ${validationResult.errors.join(', ')}`);
      }

      const correctedConfig = validationResult.correctedConfig!;
      
      // Prepare update data
      const updateData: Partial<OnboardingCompletionData> = {
        venue_mode: correctedConfig.venue_mode,
        authority_mode: correctedConfig.authority_mode,
        pos_integration_enabled: correctedConfig.pos_integration_enabled,
        printer_required: correctedConfig.printer_required,
        mode_last_changed_at: correctedConfig.mode_last_changed_at
      };

      // Update venue configuration
      const { data, error } = await supabaseClient
        .from('bars')
        .update(updateData)
        .eq('id', barId)
        .select('id, name, onboarding_completed, venue_mode, authority_mode, pos_integration_enabled, printer_required, authority_configured_at, mode_last_changed_at')
        .single();

      if (error) throw error;

      // Log configuration change with before/after states
      await logConfigurationChange({
        bar_id: barId,
        previous_config: {
          venue_mode: currentConfig.venue_mode,
          authority_mode: currentConfig.authority_mode,
          pos_integration_enabled: currentConfig.pos_integration_enabled,
          printer_required: currentConfig.printer_required,
          onboarding_completed: currentConfig.onboarding_completed
        },
        new_config: {
          venue_mode: correctedConfig.venue_mode,
          authority_mode: correctedConfig.authority_mode,
          pos_integration_enabled: correctedConfig.pos_integration_enabled,
          printer_required: correctedConfig.printer_required,
          onboarding_completed: true
        },
        change_reason: userContext?.change_reason || 'User initiated change',
        change_type: 'user_initiated',
        destructive_change: currentConfig.venue_mode !== correctedConfig.venue_mode,
        confirmation_required: currentConfig.venue_mode !== correctedConfig.venue_mode,
        user_confirmed: true,
        validation_warnings: validationResult.warnings || [],
        validation_errors: [],
        auto_corrections_applied: [], // Remove reference to non-existent corrections property
        ...userContext,
        operation_duration_ms: Date.now() - startTime
      });

      return data as VenueData;
    },
    'update_configuration',
    { 
      barId,
      currentConfig: {
        venue_mode: currentConfig.venue_mode,
        authority_mode: currentConfig.authority_mode
      },
      newConfig: {
        venue_mode: newConfig.venue_mode,
        authority_mode: newConfig.authority_mode
      }
    }
  );
}

/**
 * Migrate existing venue to onboarding system
 */
export async function migrateExistingVenue(
  supabaseClient: any,
  barId: string,
  userContext?: {
    user_id?: string;
    session_id?: string;
    user_agent?: string;
    ip_address?: string;
    request_id?: string;
  }
): Promise<DatabaseOperationResult<{ migrationCompleted: boolean; venue: VenueData }>> {
  const startTime = Date.now();
  
  return withMigrationErrorHandling(
    async () => {
      // Check if venue needs migration
      const statusResult = await checkOnboardingStatus(supabaseClient, barId);
      
      if (!statusResult.success) {
        throw new Error(`Failed to check venue status: ${statusResult.error}`);
      }

      const { needsOnboarding, venue } = statusResult.data!;
      
      if (!needsOnboarding) {
        return {
          migrationCompleted: false,
          venue: venue!
        };
      }

      // Log migration start
      await logMigrationEvent('configuration_migration_started', {
        bar_id: barId,
        migration_type: 'automatic_migration',
        venues_affected: 1,
        migration_id: `migration_${barId}_${Date.now()}`,
        ...userContext,
        operation_duration_ms: Date.now() - startTime
      });

      // Get default migration configuration
      const defaultConfig = getDefaultMigrationConfiguration();
      
      // Apply migration using the database function
      const { data: migrationResult, error: migrationError } = await supabaseClient
        .rpc('migrate_existing_venues_to_onboarding');

      if (migrationError) {
        // Log migration failure
        await logMigrationEvent('configuration_migration_failed', {
          bar_id: barId,
          migration_type: 'automatic_migration',
          venues_affected: 1,
          migration_errors: [migrationError.message],
          ...userContext,
          operation_duration_ms: Date.now() - startTime
        });
        
        throw migrationError;
      }

      // Get the migration results
      const migration = (migrationResult as MigrationResult[])?.[0];
      
      if (!migration || migration.migration_status !== 'completed') {
        const errorMsg = migration?.error_message || 'Unknown migration error';
        
        // Log migration failure
        await logMigrationEvent('configuration_migration_failed', {
          bar_id: barId,
          migration_type: 'automatic_migration',
          venues_affected: 1,
          migration_errors: [errorMsg],
          ...userContext,
          operation_duration_ms: Date.now() - startTime
        });
        
        throw new Error(`Migration failed: ${errorMsg}`);
      }

      // Fetch updated venue data
      const { data: updatedVenue, error: fetchError } = await supabaseClient
        .from('bars')
        .select('id, name, onboarding_completed, venue_mode, authority_mode, pos_integration_enabled, printer_required, authority_configured_at, mode_last_changed_at')
        .eq('id', barId)
        .single();

      if (fetchError) {
        console.warn('Failed to fetch updated venue data after migration:', fetchError);
        // Migration succeeded but we can't fetch updated data - use default config
        const fallbackVenue = {
          id: barId,
          name: venue?.name || 'Unknown Venue',
          onboarding_completed: true,
          venue_mode: defaultConfig.venue_mode,
          authority_mode: defaultConfig.authority_mode,
          pos_integration_enabled: defaultConfig.pos_integration_enabled,
          printer_required: defaultConfig.printer_required,
          authority_configured_at: defaultConfig.authority_configured_at,
          mode_last_changed_at: defaultConfig.mode_last_changed_at
        } as VenueData;
        
        // Log successful migration with fallback data
        await logMigrationEvent('configuration_migration_completed', {
          bar_id: barId,
          migration_type: 'automatic_migration',
          venues_affected: 1,
          migration_id: migration.migration_id,
          default_config: defaultConfig,
          ...userContext,
          operation_duration_ms: Date.now() - startTime
        });
        
        return {
          migrationCompleted: true,
          venue: fallbackVenue
        };
      }

      // Log successful migration with comprehensive details
      await logMigrationEvent('configuration_migration_completed', {
        bar_id: barId,
        migration_type: 'automatic_migration',
        venues_affected: migration.venues_migrated,
        migration_id: migration.migration_id,
        default_config: {
          venue_mode: defaultConfig.venue_mode,
          authority_mode: defaultConfig.authority_mode,
          pos_integration_enabled: defaultConfig.pos_integration_enabled,
          printer_required: defaultConfig.printer_required
        },
        ...userContext,
        operation_duration_ms: Date.now() - startTime
      });

      return {
        migrationCompleted: true,
        venue: updatedVenue as VenueData
      };
    },
    'migrate_existing_venue',
    { barId }
  );
}

/**
 * Save onboarding progress to prevent data loss
 */
export function saveOnboardingProgress(progress: OnboardingProgress): void {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      const storage = (globalThis as any).localStorage;
      const progressKey = `tabeza_onboarding_progress_${progress.barId || 'default'}`;
      storage.setItem(progressKey, JSON.stringify(progress));
    }
  } catch (error) {
    console.warn('Failed to save onboarding progress:', error);
  }
}

/**
 * Restore onboarding progress
 */
export function restoreOnboardingProgress(barId?: string): OnboardingProgress | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      const storage = (globalThis as any).localStorage;
      const progressKey = `tabeza_onboarding_progress_${barId || 'default'}`;
      const savedProgress = storage.getItem(progressKey);
      
      if (!savedProgress) return null;

      const progress: OnboardingProgress = JSON.parse(savedProgress);
      
      // Check if progress is not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (Date.now() - progress.timestamp > maxAge) {
        clearOnboardingProgress(barId);
        return null;
      }

      return progress;
    }
    return null;
  } catch (error) {
    console.warn('Failed to restore onboarding progress:', error);
    clearOnboardingProgress(barId);
    return null;
  }
}

/**
 * Clear onboarding progress
 */
export function clearOnboardingProgress(barId?: string): void {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      const storage = (globalThis as any).localStorage;
      const progressKey = `tabeza_onboarding_progress_${barId || 'default'}`;
      storage.removeItem(progressKey);
    }
  } catch (error) {
    console.warn('Failed to clear onboarding progress:', error);
  }
}

/**
 * Create user-friendly error message for onboarding operations
 */
export function createOnboardingErrorMessage(
  result: DatabaseOperationResult,
  operation: string
): string {
  if (result.success) return '';
  
  const baseMessage = createUserErrorMessage(result, `Failed to ${operation}. Please try again.`);
  
  // Add specific guidance for onboarding errors
  if (isTemporaryError(result)) {
    return `${baseMessage}\n\nYour progress has been saved and you can continue where you left off.`;
  }
  
  return `${baseMessage}\n\nIf this problem persists, please contact support for assistance with your venue setup.`;
}

/**
 * Validate onboarding prerequisites
 */
export async function validateOnboardingPrerequisites(
  supabaseClient: any,
  barId: string
): Promise<DatabaseOperationResult<{ canProceed: boolean; issues: string[] }>> {
  return withOnboardingErrorHandling(
    async () => {
      const issues: string[] = [];
      
      // Check if venue exists and has basic information
      const { data: venue, error } = await supabaseClient
        .from('bars')
        .select('id, name, active')
        .eq('id', barId)
        .single();

      if (error) throw error;

      if (!venue) {
        issues.push('Venue not found');
      } else {
        if (!venue.name || venue.name.trim() === '') {
          issues.push('Venue name is required');
        }
        
        if (venue.active === false) {
          issues.push('Venue is inactive');
        }
      }

      return {
        canProceed: issues.length === 0,
        issues
      };
    },
    'validate_prerequisites',
    { barId }
  );
}