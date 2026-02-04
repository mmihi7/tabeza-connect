/**
 * Venue Configuration Validation Service
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This service enforces the Core Truth constraint validation for venue mode combinations
 * as defined in the onboarding-flow-fix specification.
 */

// Venue configuration types
export type VenueMode = 'basic' | 'venue';
export type AuthorityMode = 'pos' | 'tabeza';

export interface VenueConfiguration {
  venue_mode: VenueMode;
  authority_mode: AuthorityMode;
  pos_integration_enabled: boolean;
  printer_required: boolean;
  onboarding_completed: boolean;
  authority_configured_at?: string;
  mode_last_changed_at?: string;
}

export interface VenueConfigurationInput {
  venue_mode: VenueMode;
  authority_mode?: AuthorityMode;
  pos_integration_enabled?: boolean;
  printer_required?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  correctedConfig?: VenueConfiguration;
}

/**
 * Core Truth Constraint Validation
 * 
 * Validates that venue configurations conform to the Core Truth model:
 * - Basic mode MUST use POS authority with printer required
 * - Venue mode MUST use exactly one digital authority (POS OR Tabeza)
 * - Manual ordering always coexists (implicit, not validated here)
 */
export function validateVenueConfiguration(input: VenueConfigurationInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Core Truth Constraint 1: Basic mode requires POS authority
  if (input.venue_mode === 'basic' && input.authority_mode !== 'pos') {
    errors.push('Basic mode requires POS authority');
  }

  // Core Truth Constraint 2: Venue mode requires valid authority selection
  if (input.venue_mode === 'venue' && input.authority_mode && !['pos', 'tabeza'].includes(input.authority_mode)) {
    errors.push('Venue mode requires valid authority selection (pos or tabeza)');
  }

  // Core Truth Constraint 3: Authority mode is required
  if (!input.authority_mode) {
    errors.push('Authority mode is required');
  }

  // If there are validation errors, return early
  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      warnings
    };
  }

  // Generate corrected configuration with proper defaults
  const correctedConfig = generateCorrectedConfiguration(input);

  return {
    isValid: true,
    errors: [],
    warnings,
    correctedConfig
  };
}

/**
 * Generate Corrected Configuration
 * 
 * Applies the Core Truth rules to generate a valid configuration:
 * - Basic mode: Sets authority_mode='pos', printer_required=true
 * - Venue+POS: Sets pos_integration_enabled=true, printer_required=false (optional)
 * - Venue+Tabeza: Sets pos_integration_enabled=false, printer_required=false
 */
export function generateCorrectedConfiguration(input: VenueConfigurationInput): VenueConfiguration {
  const now = new Date().toISOString();

  // Base configuration
  const config: VenueConfiguration = {
    venue_mode: input.venue_mode,
    authority_mode: input.authority_mode || 'pos', // Default to POS if not specified
    pos_integration_enabled: false,
    printer_required: false,
    onboarding_completed: true,
    authority_configured_at: now,
    mode_last_changed_at: now
  };

  // Apply Core Truth rules based on venue mode
  if (config.venue_mode === 'basic') {
    // Basic mode: POS-Authoritative only
    config.authority_mode = 'pos';
    config.pos_integration_enabled = true; // POS integration required
    config.printer_required = true; // Printer mandatory for Basic mode
  } else if (config.venue_mode === 'venue') {
    // Venue mode: Apply authority-specific rules
    if (config.authority_mode === 'pos') {
      // Venue + POS: POS-Authoritative + Manual
      config.pos_integration_enabled = true;
      config.printer_required = false; // Optional for Venue mode
    } else if (config.authority_mode === 'tabeza') {
      // Venue + Tabeza: Tabeza-Authoritative + Manual
      config.pos_integration_enabled = false;
      config.printer_required = false; // Not used in Tabeza authority
    }
  }

  return config;
}

/**
 * Validate Configuration Change
 * 
 * Validates configuration changes and checks for potentially destructive operations
 */
export function validateConfigurationChange(
  currentConfig: VenueConfiguration,
  newConfig: VenueConfigurationInput
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // First validate the new configuration itself
  const baseValidation = validateVenueConfiguration(newConfig);
  if (!baseValidation.isValid) {
    return baseValidation;
  }

  // Check for potentially destructive changes
  if (currentConfig.venue_mode === 'venue' && newConfig.venue_mode === 'basic') {
    warnings.push(
      'Switching from Venue to Basic mode will disable customer ordering and menus. ' +
      'This change requires confirmation and may affect existing customer workflows.'
    );
  }

  if (currentConfig.authority_mode === 'tabeza' && newConfig.authority_mode === 'pos') {
    warnings.push(
      'Switching from Tabeza to POS authority will require POS integration setup. ' +
      'Ensure your POS system is ready before making this change.'
    );
  }

  if (currentConfig.authority_mode === 'pos' && newConfig.authority_mode === 'tabeza') {
    warnings.push(
      'Switching from POS to Tabeza authority will disable POS integration. ' +
      'Orders will be managed entirely within Tabeza.'
    );
  }

  // Generate the corrected configuration
  const correctedConfig = generateCorrectedConfiguration(newConfig);
  
  // Preserve timestamps from current config, update mode_last_changed_at
  correctedConfig.authority_configured_at = currentConfig.authority_configured_at;
  correctedConfig.mode_last_changed_at = new Date().toISOString();

  return {
    isValid: true,
    errors,
    warnings,
    correctedConfig
  };
}

/**
 * Check if configuration is valid for the Core Truth model
 */
export function isValidCoreConfiguration(config: VenueConfiguration): boolean {
  // Basic mode must have POS authority and printer required
  if (config.venue_mode === 'basic') {
    return config.authority_mode === 'pos' && 
           config.pos_integration_enabled === true && 
           config.printer_required === true;
  }

  // Venue mode must have valid authority
  if (config.venue_mode === 'venue') {
    if (config.authority_mode === 'pos') {
      return config.pos_integration_enabled === true;
    }
    if (config.authority_mode === 'tabeza') {
      return config.pos_integration_enabled === false;
    }
  }

  return false;
}

/**
 * Get configuration description for UI display
 */
export function getConfigurationDescription(config: VenueConfiguration): string {
  if (config.venue_mode === 'basic') {
    return 'Basic mode: POS integration with digital receipts and customer payments. ' +
           'Customer ordering and menus are disabled.';
  }

  if (config.venue_mode === 'venue') {
    if (config.authority_mode === 'pos') {
      return 'Venue mode with POS authority: Customer order requests are sent to staff, ' +
             'who enter them into the POS system. Staff ordering in Tabeza is disabled.';
    }
    if (config.authority_mode === 'tabeza') {
      return 'Venue mode with Tabeza authority: Full customer ordering and staff management ' +
             'within Tabeza. POS integration is disabled.';
    }
  }

  return 'Unknown configuration';
}

/**
 * Get theme configuration based on venue setup
 */
export function getThemeConfiguration(config: VenueConfiguration): {
  theme: 'blue' | 'yellow' | 'green';
  description: string;
  icons: string[];
} {
  if (config.venue_mode === 'basic') {
    return {
      theme: 'blue',
      description: 'POS Bridge Mode',
      icons: ['🖨️', '📱', '💳']
    };
  }

  if (config.venue_mode === 'venue') {
    if (config.authority_mode === 'pos') {
      return {
        theme: 'yellow',
        description: 'Hybrid Workflow Mode',
        icons: ['📋', '🖨️', '💬']
      };
    }
    if (config.authority_mode === 'tabeza') {
      return {
        theme: 'green',
        description: 'Full Service Mode',
        icons: ['📋', '💬', '💳', '📊']
      };
    }
  }

  return {
    theme: 'blue',
    description: 'Unknown Mode',
    icons: ['❓']
  };
}

/**
 * Migration helper for existing venues
 */
export function getDefaultMigrationConfiguration(): VenueConfiguration {
  return generateCorrectedConfiguration({
    venue_mode: 'venue',
    authority_mode: 'tabeza'
  });
}