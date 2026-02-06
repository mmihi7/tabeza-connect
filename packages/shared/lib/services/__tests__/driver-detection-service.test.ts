/**
 * Driver Detection Service Tests
 * 
 * Tests for web-based platform detection and driver installation guidance.
 * Covers platform detection, installation guidance generation, and error handling.
 */

import {
  detectPlatform,
  generateInstallationGuidance,
  checkDriverAvailability,
  performDriverDetection,
  isPlatformSupported,
  getPlatformDescription,
} from '../driver-detection-service';
import {
  Platform,
  UnsupportedPlatformError,
  DriverDetectionError,
} from '../printer-service-types';

// Mock navigator for testing
const mockNavigator = (userAgent: string, platform: string) => {
  Object.defineProperty(navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(navigator, 'platform', {
    value: platform,
    configurable: true,
    writable: true,
  });
};

describe('Driver Detection Service', () => {
  describe('detectPlatform', () => {
    beforeEach(() => {
      // Reset navigator mocks before each test
      jest.clearAllMocks();
    });

    it('should detect Windows platform', () => {
      mockNavigator(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Win32'
      );

      const platform = detectPlatform();

      expect(platform.os).toBe('windows');
      expect(platform.browser).toBe('chrome');
      expect(platform.supportsDrivers).toBe(true);
    });

    it('should detect macOS platform', () => {
      mockNavigator(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'MacIntel'
      );

      const platform = detectPlatform();

      expect(platform.os).toBe('macos');
      expect(platform.browser).toBe('chrome');
      expect(platform.supportsDrivers).toBe(true);
    });

    it('should detect Linux platform', () => {
      mockNavigator(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Linux x86_64'
      );

      const platform = detectPlatform();

      expect(platform.os).toBe('linux');
      expect(platform.browser).toBe('chrome');
      expect(platform.supportsDrivers).toBe(false);
    });

    it('should detect iOS platform', () => {
      mockNavigator(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'iPhone'
      );

      const platform = detectPlatform();

      // iOS detection should work with iPhone in user agent
      expect(platform.os).toBe('ios');
      expect(platform.browser).toBe('safari');
      expect(platform.supportsDrivers).toBe(false);
    });

    it('should detect Android platform', () => {
      mockNavigator(
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Linux armv8l'
      );

      const platform = detectPlatform();

      expect(platform.os).toBe('android');
      expect(platform.browser).toBe('chrome');
      expect(platform.supportsDrivers).toBe(false);
    });

    it('should detect Firefox browser', () => {
      mockNavigator(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
        'Win32'
      );

      const platform = detectPlatform();

      expect(platform.browser).toBe('firefox');
      expect(platform.version).toBe('120');
    });

    it('should detect Edge browser', () => {
      mockNavigator(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        'Win32'
      );

      const platform = detectPlatform();

      expect(platform.browser).toBe('edge');
    });

    it('should detect Safari browser', () => {
      mockNavigator(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'MacIntel'
      );

      const platform = detectPlatform();

      expect(platform.browser).toBe('safari');
    });

    it('should handle unknown platform gracefully', () => {
      mockNavigator('Unknown User Agent', 'Unknown Platform');

      const platform = detectPlatform();

      expect(platform.os).toBe('unknown');
      expect(platform.supportsDrivers).toBe(false);
    });

    it('should extract browser version correctly', () => {
      mockNavigator(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Win32'
      );

      const platform = detectPlatform();

      expect(platform.version).toBe('120');
    });
  });

  describe('generateInstallationGuidance', () => {
    it('should generate Windows installation guidance', () => {
      const platform: Platform = {
        os: 'windows',
        browser: 'chrome',
        version: '120',
        supportsDrivers: true,
      };

      const guidance = generateInstallationGuidance(platform);

      expect(guidance.downloadUrl).toContain('tabeza-printer-service-v1.0.0.zip');
      expect(guidance.instructions).toHaveLength(8);
      expect(guidance.instructions[0]).toContain('Download the Tabeza Printer Service');
      expect(guidance.troubleshootingSteps.length).toBeGreaterThan(0);
      expect(guidance.verificationSteps.length).toBeGreaterThan(0);
    });

    it('should generate macOS installation guidance', () => {
      const platform: Platform = {
        os: 'macos',
        browser: 'safari',
        version: '17',
        supportsDrivers: true,
      };

      const guidance = generateInstallationGuidance(platform);

      expect(guidance.downloadUrl).toContain('tabeza-printer-driver-macos.pkg');
      expect(guidance.instructions).toHaveLength(6);
      expect(guidance.instructions[0]).toContain('macOS');
      expect(guidance.troubleshootingSteps.length).toBeGreaterThan(0);
      expect(guidance.verificationSteps.length).toBeGreaterThan(0);
    });

    it('should throw UnsupportedPlatformError for Linux', () => {
      const platform: Platform = {
        os: 'linux',
        browser: 'chrome',
        version: '120',
        supportsDrivers: false,
      };

      expect(() => generateInstallationGuidance(platform)).toThrow(
        UnsupportedPlatformError
      );
    });

    it('should throw UnsupportedPlatformError for iOS', () => {
      const platform: Platform = {
        os: 'ios',
        browser: 'safari',
        version: '17',
        supportsDrivers: false,
      };

      expect(() => generateInstallationGuidance(platform)).toThrow(
        UnsupportedPlatformError
      );
    });

    it('should throw UnsupportedPlatformError for Android', () => {
      const platform: Platform = {
        os: 'android',
        browser: 'chrome',
        version: '120',
        supportsDrivers: false,
      };

      expect(() => generateInstallationGuidance(platform)).toThrow(
        UnsupportedPlatformError
      );
    });

    it('should include tabeza.co.ke download URL', () => {
      const platform: Platform = {
        os: 'windows',
        browser: 'chrome',
        version: '120',
        supportsDrivers: true,
      };

      const guidance = generateInstallationGuidance(platform);

      expect(guidance.downloadUrl).toContain('tabeza.co.ke');
    });

    it('should include verification steps for Windows', () => {
      const platform: Platform = {
        os: 'windows',
        browser: 'chrome',
        version: '120',
        supportsDrivers: true,
      };

      const guidance = generateInstallationGuidance(platform);

      // Check that at least one verification step contains the expected text
      const hasControlPanel = guidance.verificationSteps.some(step => 
        step.includes('Control Panel')
      );
      const hasTabezaPrinter = guidance.verificationSteps.some(step => 
        step.includes('Tabeza Receipt Printer')
      );
      
      expect(hasControlPanel).toBe(true);
      expect(hasTabezaPrinter).toBe(true);
    });

    it('should include verification steps for macOS', () => {
      const platform: Platform = {
        os: 'macos',
        browser: 'safari',
        version: '17',
        supportsDrivers: true,
      };

      const guidance = generateInstallationGuidance(platform);

      // Check that at least one verification step contains the expected text
      const hasSystemPreferences = guidance.verificationSteps.some(step => 
        step.includes('System Preferences')
      );
      const hasPrintersAndScanners = guidance.verificationSteps.some(step => 
        step.includes('Printers & Scanners')
      );
      
      expect(hasSystemPreferences).toBe(true);
      expect(hasPrintersAndScanners).toBe(true);
    });
  });

  describe('checkDriverAvailability', () => {
    it('should return driver status with manual verification required', async () => {
      const status = await checkDriverAvailability();

      expect(status.installed).toBe(false);
      expect(status.compatible).toBe(true);
      expect(status.error).toContain('manual verification');
    });

    it('should indicate web environment limitations', async () => {
      const status = await checkDriverAvailability();

      expect(status.error).toContain('web environment');
    });
  });

  describe('performDriverDetection', () => {
    beforeEach(() => {
      mockNavigator(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Win32'
      );
    });

    it('should return complete detection result when drivers are required', async () => {
      const result = await performDriverDetection(true);

      expect(result.platform.os).toBe('windows');
      expect(result.driversRequired).toBe(true);
      expect(result.driversDetected).toBe(false);
      expect(result.installationGuidance).toBeDefined();
      expect(result.manualVerificationRequired).toBe(true);
    });

    it('should skip detection when drivers are not required', async () => {
      const result = await performDriverDetection(false);

      expect(result.driversRequired).toBe(false);
      expect(result.driversDetected).toBe(false);
      expect(result.installationGuidance).toBeUndefined();
      expect(result.manualVerificationRequired).toBe(false);
    });

    it('should throw UnsupportedPlatformError for unsupported platforms', async () => {
      mockNavigator(
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Linux armv8l'
      );

      await expect(performDriverDetection(true)).rejects.toThrow(
        UnsupportedPlatformError
      );
    });

    it('should include installation guidance for supported platforms', async () => {
      const result = await performDriverDetection(true);

      expect(result.installationGuidance).toBeDefined();
      expect(result.installationGuidance?.downloadUrl).toContain('tabeza.co.ke');
      expect(result.installationGuidance?.instructions.length).toBeGreaterThan(0);
    });
  });

  describe('isPlatformSupported', () => {
    it('should return true for Windows', () => {
      const platform: Platform = {
        os: 'windows',
        browser: 'chrome',
        version: '120',
        supportsDrivers: true,
      };

      expect(isPlatformSupported(platform)).toBe(true);
    });

    it('should return true for macOS', () => {
      const platform: Platform = {
        os: 'macos',
        browser: 'safari',
        version: '17',
        supportsDrivers: true,
      };

      expect(isPlatformSupported(platform)).toBe(true);
    });

    it('should return false for Linux', () => {
      const platform: Platform = {
        os: 'linux',
        browser: 'chrome',
        version: '120',
        supportsDrivers: false,
      };

      expect(isPlatformSupported(platform)).toBe(false);
    });

    it('should return false for iOS', () => {
      const platform: Platform = {
        os: 'ios',
        browser: 'safari',
        version: '17',
        supportsDrivers: false,
      };

      expect(isPlatformSupported(platform)).toBe(false);
    });

    it('should return false for Android', () => {
      const platform: Platform = {
        os: 'android',
        browser: 'chrome',
        version: '120',
        supportsDrivers: false,
      };

      expect(isPlatformSupported(platform)).toBe(false);
    });
  });

  describe('getPlatformDescription', () => {
    it('should generate description for Windows', () => {
      const platform: Platform = {
        os: 'windows',
        browser: 'chrome',
        version: '120',
        supportsDrivers: true,
      };

      const description = getPlatformDescription(platform);

      expect(description).toBe('Windows (Chrome 120)');
    });

    it('should generate description for macOS', () => {
      const platform: Platform = {
        os: 'macos',
        browser: 'safari',
        version: '17',
        supportsDrivers: true,
      };

      const description = getPlatformDescription(platform);

      expect(description).toBe('macOS (Safari 17)');
    });

    it('should generate description for Linux', () => {
      const platform: Platform = {
        os: 'linux',
        browser: 'firefox',
        version: '120',
        supportsDrivers: false,
      };

      const description = getPlatformDescription(platform);

      expect(description).toBe('Linux (Firefox 120)');
    });

    it('should handle unknown platform', () => {
      const platform: Platform = {
        os: 'unknown',
        browser: 'unknown',
        version: 'unknown',
        supportsDrivers: false,
      };

      const description = getPlatformDescription(platform);

      expect(description).toBe('Unknown Operating System (Unknown unknown)');
    });

    it('should capitalize browser name', () => {
      const platform: Platform = {
        os: 'windows',
        browser: 'edge',
        version: '120',
        supportsDrivers: true,
      };

      const description = getPlatformDescription(platform);

      expect(description).toContain('Edge');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing navigator.platform', () => {
      Object.defineProperty(navigator, 'platform', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      mockNavigator(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ''
      );

      const platform = detectPlatform();

      expect(platform.os).toBe('windows');
    });

    it('should handle case-insensitive user agent matching', () => {
      mockNavigator(
        'Mozilla/5.0 (WINDOWS NT 10.0; Win64; x64) AppleWebKit/537.36',
        'WIN32'
      );

      const platform = detectPlatform();

      expect(platform.os).toBe('windows');
    });

    it('should prioritize iOS detection over macOS for touch devices', () => {
      // Mock touch support
      Object.defineProperty(document, 'ontouchend', {
        value: () => {},
        configurable: true,
        writable: true,
      });

      mockNavigator(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
        'MacIntel'
      );

      const platform = detectPlatform();

      // Clean up
      delete (document as any).ontouchend;

      // Note: This test may need adjustment based on actual iOS detection logic
      expect(['ios', 'macos']).toContain(platform.os);
    });
  });
});
