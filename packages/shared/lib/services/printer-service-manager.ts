/**
 * Printer Service Manager
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This service manages printer driver detection, ESC/POS communication,
 * and printer testing based on venue authority configuration.
 * 
 * Printer services are ONLY active for POS authority modes:
 * - Basic mode (POS authority): Printer services REQUIRED
 * - Venue + POS authority: Printer services REQUIRED
 * - Venue + Tabeza authority: Printer services BYPASSED
 */

import {
  VenueMode,
  AuthorityMode,
  VenueConfiguration
} from './venue-configuration-validation';

import {
  Platform,
  DriverDetectionResult,
  InstallationGuidance,
  PrinterConfig,
  PrinterConnection,
  TestResult,
  PrinterStatus,
  PrinterServiceConfig
} from './printer-service-types';

import {
  AuthorityModeValidator,
  createAuthorityModeValidator,
  isPrinterDriverRequired,
  isESCPOSActive,
  isPrintQueueActive,
  isPrinterStatusMonitoringActive
} from './printer-authority-validator';

/**
 * Printer Service Manager Interface
 * 
 * Main interface for managing printer services with authority-based activation
 */
export interface PrinterServiceManager {
  /**
   * Check if printer service is required for a given configuration
   * 
   * @param venueMode - Venue mode (basic or venue)
   * @param authorityMode - Authority mode (pos or tabeza)
   * @returns true if printer service is required, false otherwise
   */
  isServiceRequired(venueMode: VenueMode, authorityMode: AuthorityMode): boolean;

  /**
   * Detect printer drivers on the current platform
   * 
   * @returns DriverDetectionResult with platform info and driver status
   */
  detectDrivers(): Promise<DriverDetectionResult>;

  /**
   * Get installation guidance for a specific platform
   * 
   * @param platform - Platform information
   * @returns InstallationGuidance with download links and instructions
   */
  getInstallationGuidance(platform: Platform): InstallationGuidance;

  /**
   * Establish connection to a printer (POS authority only)
   * 
   * @param config - Printer configuration
   * @returns PrinterConnection if successful
   * @throws Error if authority mode doesn't support printer connection
   */
  establishConnection(config: PrinterConfig): Promise<PrinterConnection>;

  /**
   * Test printer connection and print quality (POS authority only)
   * 
   * @param connection - Printer connection to test
   * @returns TestResult with success status and print quality
   * @throws Error if authority mode doesn't support printer testing
   */
  testPrinter(connection: PrinterConnection): Promise<TestResult>;

  /**
   * Monitor printer status (POS authority only)
   * 
   * @param connection - Printer connection to monitor
   * @returns Observable stream of printer status updates
   * @throws Error if authority mode doesn't support status monitoring
   */
  monitorStatus(connection: PrinterConnection): AsyncIterable<PrinterStatus>;

  /**
   * Get current service configuration
   * 
   * @returns PrinterServiceConfig
   */
  getServiceConfig(): PrinterServiceConfig;

  /**
   * Update service configuration based on venue configuration
   * 
   * @param config - New venue configuration
   */
  updateConfiguration(config: VenueConfiguration): void;
}

/**
 * Default implementation of PrinterServiceManager
 */
export class DefaultPrinterServiceManager implements PrinterServiceManager {
  private authorityValidator: AuthorityModeValidator;
  private serviceConfig: PrinterServiceConfig;

  constructor(initialConfig: VenueConfiguration) {
    this.authorityValidator = createAuthorityModeValidator();
    this.serviceConfig = this.authorityValidator.getPrinterServiceConfig(initialConfig);
    
    // Validate configuration on initialization
    this.authorityValidator.validateConfiguration(initialConfig);
  }

  /**
   * Check if printer service is required based on authority mode
   * 
   * Core Truth Rule: Printer service required ONLY for POS authority
   */
  isServiceRequired(venueMode: VenueMode, authorityMode: AuthorityMode): boolean {
    return isPrinterDriverRequired(venueMode, authorityMode);
  }

  /**
   * Detect printer drivers on the current platform
   * 
   * This is a placeholder implementation that will be enhanced in subsequent tasks
   */
  async detectDrivers(): Promise<DriverDetectionResult> {
    // Check if drivers are required for current configuration
    const driversRequired = this.isServiceRequired(
      this.serviceConfig.venueMode,
      this.serviceConfig.authorityMode
    );

    // If drivers not required, return early
    if (!driversRequired) {
      return {
        platform: this.detectPlatform(),
        driversRequired: false,
        driversDetected: false,
        manualVerificationRequired: false
      };
    }

    // Detect platform
    const platform = this.detectPlatform();

    // For now, return that manual verification is required
    // This will be enhanced with actual driver detection in Task 2
    return {
      platform,
      driversRequired: true,
      driversDetected: false,
      installationGuidance: this.getInstallationGuidance(platform),
      manualVerificationRequired: true
    };
  }

  /**
   * Detect platform using browser APIs
   * 
   * This is a basic implementation that will be enhanced in Task 2
   */
  private detectPlatform(): Platform {
    // Basic platform detection (will be enhanced in Task 2)
    // Use type assertion to handle both browser and Node.js environments
    let userAgent = '';
    
    try {
      // Try to access navigator if available (browser environment)
      if (typeof (globalThis as any).navigator !== 'undefined') {
        userAgent = (globalThis as any).navigator.userAgent || '';
      }
    } catch {
      // In Node.js environment, navigator is not available
      userAgent = '';
    }
    
    let os: Platform['os'] = 'unknown';
    if (userAgent.includes('Windows')) os = 'windows';
    else if (userAgent.includes('Mac')) os = 'macos';
    else if (userAgent.includes('Linux')) os = 'linux';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'ios';
    else if (userAgent.includes('Android')) os = 'android';

    return {
      os,
      browser: 'unknown',
      version: 'unknown',
      supportsDrivers: os === 'windows' || os === 'macos' || os === 'linux'
    };
  }

  /**
   * Get installation guidance for a platform
   */
  getInstallationGuidance(platform: Platform): InstallationGuidance {
    const baseUrl = 'https://tabeza.co.ke/downloads/printer-drivers';
    
    // Platform-specific guidance
    const guidance: Record<Platform['os'], InstallationGuidance> = {
      windows: {
        downloadUrl: `${baseUrl}/windows`,
        instructions: [
          'Download the Tabeza Printer Driver installer for Windows',
          'Run the installer as Administrator',
          'Follow the installation wizard',
          'Restart your computer after installation',
          'Configure your POS system to print to "Tabeza Receipt Printer"'
        ],
        troubleshootingSteps: [
          'Ensure you have administrator privileges',
          'Disable antivirus temporarily during installation',
          'Check Windows Firewall settings',
          'Verify printer appears in "Printers & Scanners" settings'
        ],
        verificationSteps: [
          'Open Windows Settings > Devices > Printers & Scanners',
          'Look for "Tabeza Receipt Printer" in the list',
          'Print a test page from Windows',
          'Return to Tabeza setup to complete printer testing'
        ]
      },
      macos: {
        downloadUrl: `${baseUrl}/macos`,
        instructions: [
          'Download the Tabeza Printer Driver package for macOS',
          'Open the .pkg file',
          'Follow the installation wizard',
          'Grant necessary permissions when prompted',
          'Restart your computer after installation'
        ],
        troubleshootingSteps: [
          'Check System Preferences > Security & Privacy for blocked installations',
          'Ensure you have administrator privileges',
          'Verify printer appears in System Preferences > Printers & Scanners'
        ],
        verificationSteps: [
          'Open System Preferences > Printers & Scanners',
          'Look for "Tabeza Receipt Printer" in the list',
          'Print a test page from macOS',
          'Return to Tabeza setup to complete printer testing'
        ]
      },
      linux: {
        downloadUrl: `${baseUrl}/linux`,
        instructions: [
          'Download the Tabeza Printer Driver package for Linux',
          'Extract the archive',
          'Run the installation script with sudo',
          'Follow the on-screen instructions',
          'Restart CUPS service after installation'
        ],
        troubleshootingSteps: [
          'Ensure CUPS is installed and running',
          'Check permissions on /usr/share/cups',
          'Verify printer appears in CUPS web interface (localhost:631)'
        ],
        verificationSteps: [
          'Open CUPS web interface (localhost:631)',
          'Look for "Tabeza Receipt Printer" in printers list',
          'Print a test page from CUPS',
          'Return to Tabeza setup to complete printer testing'
        ]
      },
      ios: {
        downloadUrl: baseUrl,
        instructions: [
          'iOS does not support printer driver installation',
          'Please use a desktop computer (Windows, macOS, or Linux) to set up printer drivers',
          'You can continue using Tabeza on iOS after setup is complete'
        ],
        troubleshootingSteps: [
          'Use a desktop computer for printer setup',
          'Contact support if you need assistance'
        ],
        verificationSteps: [
          'Complete setup on a desktop computer',
          'Return to Tabeza on iOS to continue'
        ]
      },
      android: {
        downloadUrl: baseUrl,
        instructions: [
          'Android does not support printer driver installation',
          'Please use a desktop computer (Windows, macOS, or Linux) to set up printer drivers',
          'You can continue using Tabeza on Android after setup is complete'
        ],
        troubleshootingSteps: [
          'Use a desktop computer for printer setup',
          'Contact support if you need assistance'
        ],
        verificationSteps: [
          'Complete setup on a desktop computer',
          'Return to Tabeza on Android to continue'
        ]
      },
      unknown: {
        downloadUrl: baseUrl,
        instructions: [
          'Visit tabeza.co.ke/downloads to download the appropriate driver for your system',
          'Follow the platform-specific installation instructions',
          'Return to Tabeza setup after installation'
        ],
        troubleshootingSteps: [
          'Identify your operating system',
          'Download the correct driver package',
          'Contact support if you need assistance'
        ],
        verificationSteps: [
          'Verify printer appears in your system settings',
          'Return to Tabeza setup to complete printer testing'
        ]
      }
    };

    return guidance[platform.os];
  }

  /**
   * Establish connection to a printer
   * 
   * Only available for POS authority modes
   * This is a placeholder that will be implemented in Task 3
   */
  async establishConnection(config: PrinterConfig): Promise<PrinterConnection> {
    // Verify ESC/POS communication is active for this authority mode
    if (!isESCPOSActive(this.serviceConfig.authorityMode)) {
      throw new Error(
        `Printer connection not available for ${this.serviceConfig.authorityMode} authority mode. ` +
        'Printer services are only active for POS authority modes.'
      );
    }

    // Placeholder implementation - will be enhanced in Task 3
    return {
      id: `conn-${Date.now()}`,
      config,
      status: 'disconnected',
      lastError: 'Connection not yet implemented'
    };
  }

  /**
   * Test printer connection
   * 
   * Only available for POS authority modes
   * This is a placeholder that will be implemented in Task 5
   */
  async testPrinter(connection: PrinterConnection): Promise<TestResult> {
    // Verify printer testing is active for this authority mode
    if (!isESCPOSActive(this.serviceConfig.authorityMode)) {
      throw new Error(
        `Printer testing not available for ${this.serviceConfig.authorityMode} authority mode. ` +
        'Printer testing is only active for POS authority modes.'
      );
    }

    // Placeholder implementation - will be enhanced in Task 5
    return {
      success: false,
      timestamp: new Date(),
      error: 'Printer testing not yet implemented'
    };
  }

  /**
   * Monitor printer status
   * 
   * Only available for POS authority modes
   * This is a placeholder that will be implemented in Task 6
   */
  async *monitorStatus(connection: PrinterConnection): AsyncIterable<PrinterStatus> {
    // Verify status monitoring is active for this authority mode
    if (!isPrinterStatusMonitoringActive(this.serviceConfig.authorityMode)) {
      throw new Error(
        `Printer status monitoring not available for ${this.serviceConfig.authorityMode} authority mode. ` +
        'Status monitoring is only active for POS authority modes.'
      );
    }

    // Placeholder implementation - will be enhanced in Task 6
    yield {
      status: 'offline',
      timestamp: new Date(),
      message: 'Status monitoring not yet implemented'
    };
  }

  /**
   * Get current service configuration
   */
  getServiceConfig(): PrinterServiceConfig {
    return { ...this.serviceConfig };
  }

  /**
   * Update service configuration
   */
  updateConfiguration(config: VenueConfiguration): void {
    // Validate new configuration
    this.authorityValidator.validateConfiguration(config);
    
    // Update service config
    this.serviceConfig = this.authorityValidator.getPrinterServiceConfig(config);
  }
}

/**
 * Create a new printer service manager instance
 * 
 * @param config - Initial venue configuration
 * @returns PrinterServiceManager instance
 */
export function createPrinterServiceManager(
  config: VenueConfiguration
): PrinterServiceManager {
  return new DefaultPrinterServiceManager(config);
}

/**
 * Utility function to check if printer service should be initialized
 * 
 * @param venueMode - Venue mode
 * @param authorityMode - Authority mode
 * @returns true if printer service should be initialized, false otherwise
 */
export function shouldInitializePrinterService(
  venueMode: VenueMode,
  authorityMode: AuthorityMode
): boolean {
  return isPrinterDriverRequired(venueMode, authorityMode);
}
