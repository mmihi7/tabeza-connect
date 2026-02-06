/**
 * Unit Tests for Printer Service Manager
 * 
 * Tests printer service initialization, configuration, and authority-based service activation
 */

import {
  createPrinterServiceManager,
  shouldInitializePrinterService
} from '../printer-service-manager';

import { VenueConfiguration } from '../venue-configuration-validation';
import { PrinterConfig } from '../printer-service-types';

describe('Printer Service Manager', () => {
  describe('Initialization', () => {
    it('should initialize with Basic mode configuration', () => {
      const config: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(config);
      const serviceConfig = manager.getServiceConfig();

      expect(serviceConfig.venueMode).toBe('basic');
      expect(serviceConfig.authorityMode).toBe('pos');
      expect(serviceConfig.printerRequired).toBe(true);
      expect(serviceConfig.posIntegrationEnabled).toBe(true);
    });

    it('should initialize with Venue + POS configuration', () => {
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(config);
      const serviceConfig = manager.getServiceConfig();

      expect(serviceConfig.venueMode).toBe('venue');
      expect(serviceConfig.authorityMode).toBe('pos');
      expect(serviceConfig.posIntegrationEnabled).toBe(true);
    });

    it('should initialize with Venue + Tabeza configuration', () => {
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(config);
      const serviceConfig = manager.getServiceConfig();

      expect(serviceConfig.venueMode).toBe('venue');
      expect(serviceConfig.authorityMode).toBe('tabeza');
      expect(serviceConfig.posIntegrationEnabled).toBe(false);
    });

    it('should throw error for invalid configuration', () => {
      const config: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: false, // Invalid!
        printer_required: true,
        onboarding_completed: true
      };

      expect(() => createPrinterServiceManager(config)).toThrow();
    });
  });

  describe('isServiceRequired', () => {
    it('should return true for Basic mode', () => {
      const config: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(config);
      const required = manager.isServiceRequired('basic', 'pos');

      expect(required).toBe(true);
    });

    it('should return true for Venue + POS mode', () => {
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(config);
      const required = manager.isServiceRequired('venue', 'pos');

      expect(required).toBe(true);
    });

    it('should return false for Venue + Tabeza mode', () => {
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(config);
      const required = manager.isServiceRequired('venue', 'tabeza');

      expect(required).toBe(false);
    });
  });

  describe('detectDrivers', () => {
    it('should detect drivers for POS authority mode', async () => {
      const config: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(config);
      const result = await manager.detectDrivers();

      expect(result.driversRequired).toBe(true);
      expect(result.platform).toBeDefined();
      expect(result.platform.os).toBeDefined();
      expect(result.installationGuidance).toBeDefined();
    });

    it('should skip driver detection for Tabeza authority mode', async () => {
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(config);
      const result = await manager.detectDrivers();

      expect(result.driversRequired).toBe(false);
      expect(result.driversDetected).toBe(false);
    });
  });

  describe('getInstallationGuidance', () => {
    it('should provide Windows installation guidance', () => {
      const config: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(config);
      const platform = { os: 'windows' as const, browser: 'chrome', version: '1.0', supportsDrivers: true };
      const guidance = manager.getInstallationGuidance(platform);

      expect(guidance.downloadUrl).toContain('tabeza.co.ke');
      expect(guidance.downloadUrl).toContain('windows');
      expect(guidance.instructions.length).toBeGreaterThan(0);
      expect(guidance.troubleshootingSteps.length).toBeGreaterThan(0);
      expect(guidance.verificationSteps.length).toBeGreaterThan(0);
    });

    it('should provide macOS installation guidance', () => {
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(config);
      const platform = { os: 'macos' as const, browser: 'safari', version: '1.0', supportsDrivers: true };
      const guidance = manager.getInstallationGuidance(platform);

      expect(guidance.downloadUrl).toContain('tabeza.co.ke');
      expect(guidance.downloadUrl).toContain('macos');
      expect(guidance.instructions.length).toBeGreaterThan(0);
    });

    it('should provide Linux installation guidance', () => {
      const config: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(config);
      const platform = { os: 'linux' as const, browser: 'firefox', version: '1.0', supportsDrivers: true };
      const guidance = manager.getInstallationGuidance(platform);

      expect(guidance.downloadUrl).toContain('tabeza.co.ke');
      expect(guidance.downloadUrl).toContain('linux');
      expect(guidance.instructions.some(instruction => instruction.includes('CUPS'))).toBe(true);
    });

    it('should provide mobile platform guidance (iOS)', () => {
      const config: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(config);
      const platform = { os: 'ios' as const, browser: 'safari', version: '1.0', supportsDrivers: false };
      const guidance = manager.getInstallationGuidance(platform);

      expect(guidance.instructions.some(instruction => 
        instruction.includes('does not support printer driver installation')
      )).toBe(true);
      expect(guidance.instructions.some(instruction => 
        instruction.includes('desktop computer')
      )).toBe(true);
    });

    it('should provide mobile platform guidance (Android)', () => {
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(config);
      const platform = { os: 'android' as const, browser: 'chrome', version: '1.0', supportsDrivers: false };
      const guidance = manager.getInstallationGuidance(platform);

      expect(guidance.instructions.some(instruction => 
        instruction.includes('does not support printer driver installation')
      )).toBe(true);
    });
  });

  describe('establishConnection', () => {
    it('should allow connection for POS authority mode', async () => {
      const config: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(config);
      const printerConfig: PrinterConfig = {
        printerName: 'Test Printer',
        connectionType: 'network',
        ipAddress: '192.168.1.100',
        port: 9100,
        tested: false
      };

      // Should not throw error (even though implementation is placeholder)
      const connection = await manager.establishConnection(printerConfig);
      expect(connection).toBeDefined();
      expect(connection.config).toEqual(printerConfig);
    });

    it('should reject connection for Tabeza authority mode', async () => {
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(config);
      const printerConfig: PrinterConfig = {
        printerName: 'Test Printer',
        connectionType: 'usb',
        tested: false
      };

      await expect(manager.establishConnection(printerConfig))
        .rejects
        .toThrow('Printer connection not available for tabeza authority mode');
    });
  });

  describe('testPrinter', () => {
    it('should allow testing for POS authority mode', async () => {
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(config);
      const connection = {
        id: 'test-conn',
        config: {
          printerName: 'Test Printer',
          connectionType: 'network' as const,
          tested: false
        },
        status: 'connected' as const
      };

      // Should not throw error (even though implementation is placeholder)
      const result = await manager.testPrinter(connection);
      expect(result).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should reject testing for Tabeza authority mode', async () => {
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(config);
      const connection = {
        id: 'test-conn',
        config: {
          printerName: 'Test Printer',
          connectionType: 'usb' as const,
          tested: false
        },
        status: 'connected' as const
      };

      await expect(manager.testPrinter(connection))
        .rejects
        .toThrow('Printer testing not available for tabeza authority mode');
    });
  });

  describe('monitorStatus', () => {
    it('should allow monitoring for POS authority mode', async () => {
      const config: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(config);
      const connection = {
        id: 'test-conn',
        config: {
          printerName: 'Test Printer',
          connectionType: 'network' as const,
          tested: true
        },
        status: 'connected' as const
      };

      // Should not throw error (even though implementation is placeholder)
      const statusIterator = manager.monitorStatus(connection);
      
      // Get the async iterator
      const iterator = statusIterator[Symbol.asyncIterator]();
      const firstStatus = await iterator.next();
      
      expect(firstStatus.value).toBeDefined();
      expect(firstStatus.value.timestamp).toBeInstanceOf(Date);
    });

    it('should reject monitoring for Tabeza authority mode', async () => {
      const config: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(config);
      const connection = {
        id: 'test-conn',
        config: {
          printerName: 'Test Printer',
          connectionType: 'usb' as const,
          tested: false
        },
        status: 'connected' as const
      };

      const statusIterator = manager.monitorStatus(connection);
      const iterator = statusIterator[Symbol.asyncIterator]();
      
      await expect(iterator.next())
        .rejects
        .toThrow('Printer status monitoring not available for tabeza authority mode');
    });
  });

  describe('updateConfiguration', () => {
    it('should update configuration successfully', () => {
      const initialConfig: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(initialConfig);
      
      const newConfig: VenueConfiguration = {
        venue_mode: 'venue',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false,
        onboarding_completed: true
      };

      manager.updateConfiguration(newConfig);
      const serviceConfig = manager.getServiceConfig();

      expect(serviceConfig.authorityMode).toBe('pos');
      expect(serviceConfig.posIntegrationEnabled).toBe(true);
    });

    it('should reject invalid configuration update', () => {
      const initialConfig: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true,
        onboarding_completed: true
      };

      const manager = createPrinterServiceManager(initialConfig);
      
      const invalidConfig: VenueConfiguration = {
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: false, // Invalid!
        printer_required: true,
        onboarding_completed: true
      };

      expect(() => manager.updateConfiguration(invalidConfig)).toThrow();
    });
  });

  describe('Utility Functions', () => {
    describe('shouldInitializePrinterService', () => {
      it('should return true for Basic mode', () => {
        expect(shouldInitializePrinterService('basic', 'pos')).toBe(true);
      });

      it('should return true for Venue + POS mode', () => {
        expect(shouldInitializePrinterService('venue', 'pos')).toBe(true);
      });

      it('should return false for Venue + Tabeza mode', () => {
        expect(shouldInitializePrinterService('venue', 'tabeza')).toBe(false);
      });
    });
  });
});
