/**
 * Unit Tests for Printer Authority Validator
 * 
 * Tests authority-based printer requirement validation and service activation logic
 */

import {
  createAuthorityModeValidator,
  isPrinterDriverRequired,
  isESCPOSActive,
  isPrintQueueActive,
  isPrinterStatusMonitoringActive,
  getPrinterRequirementDescription
} from '../printer-authority-validator';

import {
  InvalidAuthorityConfigurationError,
  PrinterRequirementMismatchError
} from '../printer-service-types';

import { VenueConfiguration } from '../venue-configuration-validation';

describe('Printer Authority Validator', () => {
  describe('validatePrinterRequirement', () => {
    it('should require printer for Basic mode', () => {
      const validator = createAuthorityModeValidator();
      const config: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true,
        onboarding_completed: true
      };

      const requirement = validator.validatePrinterRequirement(config);

      expect(requirement.required).toBe(true);
      expect(requirement.reason).toBe('basic_mode');
      expect(requirement.description).toContain('Basic mode requires');
      expect(requirement.description).toContain('tabeza.co.ke');
    });

    it('should require printer for Venue + POS mode', () => {
      const validator = createAuthorityModeValidator();
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false,
        onboarding_completed: true
      };

      const requirement = validator.validatePrinterRequirement(config);

      expect(requirement.required).toBe(true);
      expect(requirement.reason).toBe('venue_pos_integration');
      expect(requirement.description).toContain('POS authority');
      expect(requirement.description).toContain('tabeza.co.ke');
    });

    it('should NOT require printer for Venue + Tabeza mode', () => {
      const validator = createAuthorityModeValidator();
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true
      };

      const requirement = validator.validatePrinterRequirement(config);

      expect(requirement.required).toBe(false);
      expect(requirement.reason).toBe('venue_tabeza_mode');
      expect(requirement.description).toContain('digital-only');
    });
  });

  describe('shouldSkipPrinterSetup', () => {
    it('should NOT skip printer setup for Basic mode', () => {
      const validator = createAuthorityModeValidator();
      const shouldSkip = validator.shouldSkipPrinterSetup('basic', 'pos');

      expect(shouldSkip).toBe(false);
    });

    it('should NOT skip printer setup for Venue + POS mode', () => {
      const validator = createAuthorityModeValidator();
      const shouldSkip = validator.shouldSkipPrinterSetup('venue', 'pos');

      expect(shouldSkip).toBe(false);
    });

    it('should skip printer setup for Venue + Tabeza mode', () => {
      const validator = createAuthorityModeValidator();
      const shouldSkip = validator.shouldSkipPrinterSetup('venue', 'tabeza');

      expect(shouldSkip).toBe(true);
    });
  });

  describe('validateConfiguration', () => {
    it('should validate correct Basic mode configuration', () => {
      const validator = createAuthorityModeValidator();
      const config: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true,
        onboarding_completed: true
      };

      expect(() => validator.validateConfiguration(config)).not.toThrow();
    });

    it('should validate correct Venue + POS configuration', () => {
      const validator = createAuthorityModeValidator();
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false,
        onboarding_completed: true
      };

      expect(() => validator.validateConfiguration(config)).not.toThrow();
    });

    it('should validate correct Venue + Tabeza configuration', () => {
      const validator = createAuthorityModeValidator();
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true
      };

      expect(() => validator.validateConfiguration(config)).not.toThrow();
    });

    it('should throw error for Basic mode without printer required', () => {
      const validator = createAuthorityModeValidator();
      const config: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false, // Invalid!
        onboarding_completed: true
      };

      expect(() => validator.validateConfiguration(config))
        .toThrow(PrinterRequirementMismatchError);
    });

    it('should throw error for Venue + Tabeza with printer required', () => {
      const validator = createAuthorityModeValidator();
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: true, // Invalid!
        onboarding_completed: true
      };

      expect(() => validator.validateConfiguration(config))
        .toThrow(PrinterRequirementMismatchError);
    });

    it('should throw error for invalid authority configuration', () => {
      const validator = createAuthorityModeValidator();
      const config: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: false, // Invalid for Basic mode!
        printer_required: true,
        onboarding_completed: true
      };

      expect(() => validator.validateConfiguration(config))
        .toThrow(InvalidAuthorityConfigurationError);
    });
  });

  describe('getPrinterServiceConfig', () => {
    it('should extract service config from venue configuration', () => {
      const validator = createAuthorityModeValidator();
      const config: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true,
        onboarding_completed: true
      };

      const serviceConfig = validator.getPrinterServiceConfig(config);

      expect(serviceConfig.venueMode).toBe('basic');
      expect(serviceConfig.authorityMode).toBe('pos');
      expect(serviceConfig.printerRequired).toBe(true);
      expect(serviceConfig.posIntegrationEnabled).toBe(true);
    });
  });

  describe('Utility Functions', () => {
    describe('isPrinterDriverRequired', () => {
      it('should return true for Basic mode (POS authority)', () => {
        expect(isPrinterDriverRequired('basic', 'pos')).toBe(true);
      });

      it('should return true for Venue + POS mode', () => {
        expect(isPrinterDriverRequired('venue', 'pos')).toBe(true);
      });

      it('should return false for Venue + Tabeza mode', () => {
        expect(isPrinterDriverRequired('venue', 'tabeza')).toBe(false);
      });
    });

    describe('isESCPOSActive', () => {
      it('should return true for POS authority', () => {
        expect(isESCPOSActive('pos')).toBe(true);
      });

      it('should return false for Tabeza authority', () => {
        expect(isESCPOSActive('tabeza')).toBe(false);
      });
    });

    describe('isPrintQueueActive', () => {
      it('should return true for POS authority', () => {
        expect(isPrintQueueActive('pos')).toBe(true);
      });

      it('should return false for Tabeza authority', () => {
        expect(isPrintQueueActive('tabeza')).toBe(false);
      });
    });

    describe('isPrinterStatusMonitoringActive', () => {
      it('should return true for POS authority', () => {
        expect(isPrinterStatusMonitoringActive('pos')).toBe(true);
      });

      it('should return false for Tabeza authority', () => {
        expect(isPrinterStatusMonitoringActive('tabeza')).toBe(false);
      });
    });

    describe('getPrinterRequirementDescription', () => {
      it('should return description for Basic mode', () => {
        const config: VenueConfiguration = {
          venue_mode: 'basic',
          authority_mode: 'pos',
          pos_integration_enabled: true,
          printer_required: true,
          onboarding_completed: true
        };

        const description = getPrinterRequirementDescription(config);

        expect(description).toContain('Basic mode');
        expect(description).toContain('tabeza.co.ke');
      });

      it('should return description for Venue + Tabeza mode', () => {
        const config: VenueConfiguration = {
          venue_mode: 'venue',
          authority_mode: 'tabeza',
          pos_integration_enabled: false,
          printer_required: false,
          onboarding_completed: true
        };

        const description = getPrinterRequirementDescription(config);

        expect(description).toContain('digital-only');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle configuration with missing optional fields', () => {
      const validator = createAuthorityModeValidator();
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true
        // authority_configured_at and mode_last_changed_at are optional
      };

      expect(() => validator.validateConfiguration(config)).not.toThrow();
    });

    it('should provide meaningful error messages', () => {
      const validator = createAuthorityModeValidator();
      const config: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false,
        onboarding_completed: true
      };

      try {
        validator.validateConfiguration(config);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PrinterRequirementMismatchError);
        expect((error as Error).message).toContain('Printer requirement mismatch');
      }
    });
  });
});
