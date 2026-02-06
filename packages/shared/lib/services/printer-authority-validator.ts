/**
 * Printer Authority Mode Validator
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This service validates printer requirements based on venue authority configuration
 * and enforces the Core Truth constraint that printer services are only required
 * for POS authority modes (Basic mode and Venue+POS mode).
 */

import {
  VenueMode,
  AuthorityMode,
  VenueConfiguration,
  isValidCoreConfiguration
} from './venue-configuration-validation';

import {
  PrinterRequirement,
  PrinterServiceConfig,
  InvalidAuthorityConfigurationError,
  PrinterRequirementMismatchError
} from './printer-service-types';

/**
 * Authority Mode Validator Interface
 * 
 * Validates printer requirements based on venue authority configuration
 */
export interface AuthorityModeValidator {
  /**
   * Validate printer requirement for a given venue configuration
   * 
   * @param config - Venue configuration to validate
   * @returns PrinterRequirement indicating if printer is required and why
   */
  validatePrinterRequirement(config: VenueConfiguration): PrinterRequirement;

  /**
   * Check if printer setup should be skipped for a given configuration
   * 
   * @param venueMode - Venue mode (basic or venue)
   * @param authorityMode - Authority mode (pos or tabeza)
   * @returns true if printer setup should be skipped, false otherwise
   */
  shouldSkipPrinterSetup(venueMode: VenueMode, authorityMode: AuthorityMode): boolean;

  /**
   * Validate that a configuration is valid for printer service activation
   * 
   * @param config - Venue configuration to validate
   * @throws InvalidAuthorityConfigurationError if configuration is invalid
   * @throws PrinterRequirementMismatchError if printer requirement doesn't match authority mode
   */
  validateConfiguration(config: VenueConfiguration): void;

  /**
   * Get printer service configuration from venue configuration
   * 
   * @param config - Venue configuration
   * @returns PrinterServiceConfig for service initialization
   */
  getPrinterServiceConfig(config: VenueConfiguration): PrinterServiceConfig;
}

/**
 * Default implementation of AuthorityModeValidator
 */
export class DefaultAuthorityModeValidator implements AuthorityModeValidator {
  /**
   * Validate printer requirement based on venue configuration
   * 
   * Core Truth Rules:
   * - Basic mode (POS authority): Printer REQUIRED
   * - Venue + POS authority: Printer REQUIRED
   * - Venue + Tabeza authority: Printer NOT REQUIRED
   */
  validatePrinterRequirement(config: VenueConfiguration): PrinterRequirement {
    // Basic mode always requires printer (POS authority)
    if (config.venue_mode === 'basic') {
      return {
        required: true,
        reason: 'basic_mode',
        description: 'Basic mode requires Tabeza printer drivers for POS receipt mirroring. ' +
                    'Download drivers from tabeza.co.ke and configure your POS to print to Tabeza.'
      };
    }

    // Venue mode: Check authority mode
    if (config.venue_mode === 'venue') {
      if (config.authority_mode === 'pos') {
        return {
          required: true,
          reason: 'venue_pos_integration',
          description: 'Venue mode with POS authority requires Tabeza printer drivers for receipt mirroring. ' +
                      'Download drivers from tabeza.co.ke to enable POS integration.'
        };
      }

      if (config.authority_mode === 'tabeza') {
        return {
          required: false,
          reason: 'venue_tabeza_mode',
          description: 'Venue mode with Tabeza authority uses digital-only receipts. ' +
                      'Printer drivers are not required.'
        };
      }
    }

    // Default: Not required (should not reach here with valid config)
    return {
      required: false,
      reason: 'venue_tabeza_mode',
      description: 'Printer not required for this configuration'
    };
  }

  /**
   * Check if printer setup should be skipped
   * 
   * Printer setup is skipped only for Venue + Tabeza authority mode
   */
  shouldSkipPrinterSetup(venueMode: VenueMode, authorityMode: AuthorityMode): boolean {
    // Skip printer setup only for Venue + Tabeza
    return venueMode === 'venue' && authorityMode === 'tabeza';
  }

  /**
   * Validate configuration for printer service activation
   * 
   * Ensures configuration is valid according to Core Truth constraints
   * and printer requirements match authority mode
   */
  validateConfiguration(config: VenueConfiguration): void {
    // First check printer requirement mismatches (more specific errors)
    
    // Basic mode must have printer required
    if (config.venue_mode === 'basic' && !config.printer_required) {
      throw new PrinterRequirementMismatchError(config);
    }

    // Venue + Tabeza should NOT have printer required
    if (config.venue_mode === 'venue' && 
        config.authority_mode === 'tabeza' && 
        config.printer_required) {
      throw new PrinterRequirementMismatchError(config);
    }

    // Then check if configuration is valid according to Core Truth
    if (!isValidCoreConfiguration(config)) {
      throw new InvalidAuthorityConfigurationError(
        config.venue_mode,
        config.authority_mode
      );
    }
  }

  /**
   * Get printer service configuration from venue configuration
   */
  getPrinterServiceConfig(config: VenueConfiguration): PrinterServiceConfig {
    return {
      venueMode: config.venue_mode,
      authorityMode: config.authority_mode,
      printerRequired: config.printer_required,
      posIntegrationEnabled: config.pos_integration_enabled
    };
  }
}

/**
 * Create a new authority mode validator instance
 */
export function createAuthorityModeValidator(): AuthorityModeValidator {
  return new DefaultAuthorityModeValidator();
}

/**
 * Utility function to check if printer drivers are required for a configuration
 * 
 * @param venueMode - Venue mode
 * @param authorityMode - Authority mode
 * @returns true if printer drivers are required, false otherwise
 */
export function isPrinterDriverRequired(
  venueMode: VenueMode,
  authorityMode: AuthorityMode
): boolean {
  // Printer drivers required for POS authority (Basic or Venue+POS)
  return authorityMode === 'pos';
}

/**
 * Utility function to check if ESC/POS communication should be active
 * 
 * @param authorityMode - Authority mode
 * @returns true if ESC/POS communication should be active, false otherwise
 */
export function isESCPOSActive(authorityMode: AuthorityMode): boolean {
  // ESC/POS communication only active for POS authority
  return authorityMode === 'pos';
}

/**
 * Utility function to check if print queue should be active
 * 
 * @param authorityMode - Authority mode
 * @returns true if print queue should be active, false otherwise
 */
export function isPrintQueueActive(authorityMode: AuthorityMode): boolean {
  // Print queue only active for POS authority
  return authorityMode === 'pos';
}

/**
 * Utility function to check if printer status monitoring should be active
 * 
 * @param authorityMode - Authority mode
 * @returns true if status monitoring should be active, false otherwise
 */
export function isPrinterStatusMonitoringActive(authorityMode: AuthorityMode): boolean {
  // Status monitoring only active for POS authority
  return authorityMode === 'pos';
}

/**
 * Get printer requirement description for UI display
 * 
 * @param config - Venue configuration
 * @returns Human-readable description of printer requirements
 */
export function getPrinterRequirementDescription(config: VenueConfiguration): string {
  const validator = createAuthorityModeValidator();
  const requirement = validator.validatePrinterRequirement(config);
  return requirement.description;
}
