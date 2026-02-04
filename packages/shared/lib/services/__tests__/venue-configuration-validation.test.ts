/**
 * Unit tests for venue configuration validation service
 * Tests specific examples and edge cases for Core Truth constraint validation
 */

import {
  validateVenueConfiguration,
  generateCorrectedConfiguration,
  validateConfigurationChange,
  isValidCoreConfiguration,
  getConfigurationDescription,
  getThemeConfiguration,
  getDefaultMigrationConfiguration,
  type VenueConfiguration,
  type VenueConfigurationInput
} from '../venue-configuration-validation';

describe('Venue Configuration Validation Service', () => {
  describe('validateVenueConfiguration', () => {
    test('should validate Basic mode with POS authority', () => {
      const input: VenueConfigurationInput = {
        venue_mode: 'basic',
        authority_mode: 'pos'
      };

      const result = validateVenueConfiguration(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.correctedConfig).toBeDefined();
      expect(result.correctedConfig?.venue_mode).toBe('basic');
      expect(result.correctedConfig?.authority_mode).toBe('pos');
      expect(result.correctedConfig?.printer_required).toBe(true);
      expect(result.correctedConfig?.pos_integration_enabled).toBe(true);
    });

    test('should reject Basic mode with Tabeza authority', () => {
      const input: VenueConfigurationInput = {
        venue_mode: 'basic',
        authority_mode: 'tabeza'
      };

      const result = validateVenueConfiguration(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Basic mode requires POS authority');
      expect(result.correctedConfig).toBeUndefined();
    });

    test('should validate Venue mode with POS authority', () => {
      const input: VenueConfigurationInput = {
        venue_mode: 'venue',
        authority_mode: 'pos'
      };

      const result = validateVenueConfiguration(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.correctedConfig).toBeDefined();
      expect(result.correctedConfig?.venue_mode).toBe('venue');
      expect(result.correctedConfig?.authority_mode).toBe('pos');
      expect(result.correctedConfig?.printer_required).toBe(false);
      expect(result.correctedConfig?.pos_integration_enabled).toBe(true);
    });

    test('should validate Venue mode with Tabeza authority', () => {
      const input: VenueConfigurationInput = {
        venue_mode: 'venue',
        authority_mode: 'tabeza'
      };

      const result = validateVenueConfiguration(input);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.correctedConfig).toBeDefined();
      expect(result.correctedConfig?.venue_mode).toBe('venue');
      expect(result.correctedConfig?.authority_mode).toBe('tabeza');
      expect(result.correctedConfig?.printer_required).toBe(false);
      expect(result.correctedConfig?.pos_integration_enabled).toBe(false);
    });

    test('should reject invalid authority mode', () => {
      const input: VenueConfigurationInput = {
        venue_mode: 'venue',
        authority_mode: 'invalid' as any
      };

      const result = validateVenueConfiguration(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Venue mode requires valid authority selection (pos or tabeza)');
    });

    test('should reject missing authority mode', () => {
      const input: VenueConfigurationInput = {
        venue_mode: 'venue'
      };

      const result = validateVenueConfiguration(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Authority mode is required');
    });
  });

  describe('generateCorrectedConfiguration', () => {
    test('should generate correct Basic mode configuration', () => {
      const input: VenueConfigurationInput = {
        venue_mode: 'basic',
        authority_mode: 'pos'
      };

      const config = generateCorrectedConfiguration(input);

      expect(config.venue_mode).toBe('basic');
      expect(config.authority_mode).toBe('pos');
      expect(config.printer_required).toBe(true);
      expect(config.pos_integration_enabled).toBe(true);
      expect(config.onboarding_completed).toBe(true);
      expect(config.authority_configured_at).toBeDefined();
      expect(config.mode_last_changed_at).toBeDefined();
    });

    test('should force POS authority for Basic mode even if not specified', () => {
      const input: VenueConfigurationInput = {
        venue_mode: 'basic'
      };

      const config = generateCorrectedConfiguration(input);

      expect(config.venue_mode).toBe('basic');
      expect(config.authority_mode).toBe('pos');
      expect(config.printer_required).toBe(true);
      expect(config.pos_integration_enabled).toBe(true);
    });

    test('should generate correct Venue+POS configuration', () => {
      const input: VenueConfigurationInput = {
        venue_mode: 'venue',
        authority_mode: 'pos'
      };

      const config = generateCorrectedConfiguration(input);

      expect(config.venue_mode).toBe('venue');
      expect(config.authority_mode).toBe('pos');
      expect(config.printer_required).toBe(false);
      expect(config.pos_integration_enabled).toBe(true);
    });

    test('should generate correct Venue+Tabeza configuration', () => {
      const input: VenueConfigurationInput = {
        venue_mode: 'venue',
        authority_mode: 'tabeza'
      };

      const config = generateCorrectedConfiguration(input);

      expect(config.venue_mode).toBe('venue');
      expect(config.authority_mode).toBe('tabeza');
      expect(config.printer_required).toBe(false);
      expect(config.pos_integration_enabled).toBe(false);
    });
  });

  describe('validateConfigurationChange', () => {
    test('should validate valid configuration change', () => {
      const currentConfig: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true,
        authority_configured_at: '2024-01-01T00:00:00Z',
        mode_last_changed_at: '2024-01-01T00:00:00Z'
      };

      const newConfig: VenueConfigurationInput = {
        venue_mode: 'venue',
        authority_mode: 'pos'
      };

      const result = validateConfigurationChange(currentConfig, newConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toContain(
        'Switching from Tabeza to POS authority will require POS integration setup. ' +
        'Ensure your POS system is ready before making this change.'
      );
      expect(result.correctedConfig?.authority_configured_at).toBe(currentConfig.authority_configured_at);
      expect(result.correctedConfig?.mode_last_changed_at).not.toBe(currentConfig.mode_last_changed_at);
    });

    test('should warn about destructive Venue to Basic change', () => {
      const currentConfig: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true,
        authority_configured_at: '2024-01-01T00:00:00Z',
        mode_last_changed_at: '2024-01-01T00:00:00Z'
      };

      const newConfig: VenueConfigurationInput = {
        venue_mode: 'basic',
        authority_mode: 'pos'
      };

      const result = validateConfigurationChange(currentConfig, newConfig);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Switching from Venue to Basic mode will disable customer ordering and menus. ' +
        'This change requires confirmation and may affect existing customer workflows.'
      );
    });

    test('should reject invalid configuration change', () => {
      const currentConfig: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false,
        onboarding_completed: true
      };

      const newConfig: VenueConfigurationInput = {
        venue_mode: 'basic',
        authority_mode: 'tabeza'
      };

      const result = validateConfigurationChange(currentConfig, newConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Basic mode requires POS authority');
    });
  });

  describe('isValidCoreConfiguration', () => {
    test('should validate correct Basic mode configuration', () => {
      const config: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true,
        onboarding_completed: true
      };

      expect(isValidCoreConfiguration(config)).toBe(true);
    });

    test('should reject Basic mode without printer required', () => {
      const config: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false,
        onboarding_completed: true
      };

      expect(isValidCoreConfiguration(config)).toBe(false);
    });

    test('should validate correct Venue+POS configuration', () => {
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false,
        onboarding_completed: true
      };

      expect(isValidCoreConfiguration(config)).toBe(true);
    });

    test('should validate correct Venue+Tabeza configuration', () => {
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true
      };

      expect(isValidCoreConfiguration(config)).toBe(true);
    });

    test('should reject Venue+POS without POS integration', () => {
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'pos',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true
      };

      expect(isValidCoreConfiguration(config)).toBe(false);
    });

    test('should reject Venue+Tabeza with POS integration', () => {
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: true,
        printer_required: false,
        onboarding_completed: true
      };

      expect(isValidCoreConfiguration(config)).toBe(false);
    });
  });

  describe('getConfigurationDescription', () => {
    test('should return correct description for Basic mode', () => {
      const config: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true,
        onboarding_completed: true
      };

      const description = getConfigurationDescription(config);

      expect(description).toContain('Basic mode');
      expect(description).toContain('POS integration');
      expect(description).toContain('Customer ordering and menus are disabled');
    });

    test('should return correct description for Venue+POS mode', () => {
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false,
        onboarding_completed: true
      };

      const description = getConfigurationDescription(config);

      expect(description).toContain('Venue mode with POS authority');
      expect(description).toContain('Customer order requests');
      expect(description).toContain('Staff ordering in Tabeza is disabled');
    });

    test('should return correct description for Venue+Tabeza mode', () => {
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true
      };

      const description = getConfigurationDescription(config);

      expect(description).toContain('Venue mode with Tabeza authority');
      expect(description).toContain('Full customer ordering');
      expect(description).toContain('POS integration is disabled');
    });
  });

  describe('getThemeConfiguration', () => {
    test('should return blue theme for Basic mode', () => {
      const config: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true,
        onboarding_completed: true
      };

      const theme = getThemeConfiguration(config);

      expect(theme.theme).toBe('blue');
      expect(theme.description).toBe('POS Bridge Mode');
      expect(theme.icons).toContain('🖨️');
      expect(theme.icons).toContain('📱');
    });

    test('should return yellow theme for Venue+POS mode', () => {
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false,
        onboarding_completed: true
      };

      const theme = getThemeConfiguration(config);

      expect(theme.theme).toBe('yellow');
      expect(theme.description).toBe('Hybrid Workflow Mode');
      expect(theme.icons).toContain('📋');
      expect(theme.icons).toContain('🖨️');
      expect(theme.icons).toContain('💬');
    });

    test('should return green theme for Venue+Tabeza mode', () => {
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true
      };

      const theme = getThemeConfiguration(config);

      expect(theme.theme).toBe('green');
      expect(theme.description).toBe('Full Service Mode');
      expect(theme.icons).toContain('📋');
      expect(theme.icons).toContain('💬');
      expect(theme.icons).toContain('💳');
      expect(theme.icons).toContain('📊');
    });
  });

  describe('getDefaultMigrationConfiguration', () => {
    test('should return default Venue+Tabeza configuration for migration', () => {
      const config = getDefaultMigrationConfiguration();

      expect(config.venue_mode).toBe('venue');
      expect(config.authority_mode).toBe('tabeza');
      expect(config.pos_integration_enabled).toBe(false);
      expect(config.printer_required).toBe(false);
      expect(config.onboarding_completed).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle undefined authority mode gracefully', () => {
      const input: VenueConfigurationInput = {
        venue_mode: 'venue'
      };

      const result = validateVenueConfiguration(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Authority mode is required');
    });

    test('should preserve existing timestamps in configuration changes', () => {
      const originalTime = '2024-01-01T00:00:00Z';
      const currentConfig: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true,
        authority_configured_at: originalTime,
        mode_last_changed_at: originalTime
      };

      const newConfig: VenueConfigurationInput = {
        venue_mode: 'venue',
        authority_mode: 'pos'
      };

      const result = validateConfigurationChange(currentConfig, newConfig);

      expect(result.correctedConfig?.authority_configured_at).toBe(originalTime);
      expect(result.correctedConfig?.mode_last_changed_at).not.toBe(originalTime);
    });
  });
});