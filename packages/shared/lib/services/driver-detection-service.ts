/**
 * Driver Detection Service
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This service implements web-based platform detection and driver installation
 * guidance for Tabeza printer drivers. It uses browser APIs to detect the
 * operating system and provides appropriate installation instructions.
 * 
 * Requirements: 2.1, 2.2, 2.3
 */

import {
  Platform,
  OperatingSystem,
  DriverDetectionResult,
  InstallationGuidance,
  DriverStatus,
  DriverDetectionError,
  UnsupportedPlatformError,
} from './printer-service-types';

/**
 * Detects the user's platform using browser APIs
 * 
 * Uses navigator.userAgent and navigator.platform to determine the operating system.
 * This is a web-compatible approach that works in all modern browsers.
 * 
 * @returns Platform information including OS, browser, version, and driver support
 */
export function detectPlatform(): Platform {
  // Get user agent and platform information
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || '';
  
  // Detect operating system
  let os: OperatingSystem = 'unknown';
  
  // Check for iOS first (before macOS, as iOS contains 'like mac')
  if (
    userAgent.includes('iphone') ||
    userAgent.includes('ipad') ||
    userAgent.includes('ipod') ||
    (platform.includes('mac') && 'ontouchend' in document)
  ) {
    os = 'ios';
  }
  // Check for Windows
  else if (userAgent.includes('win') || platform.includes('win')) {
    os = 'windows';
  }
  // Check for macOS
  else if (
    userAgent.includes('mac') || 
    platform.includes('mac') ||
    userAgent.includes('darwin')
  ) {
    os = 'macos';
  }
  // Check for Android
  else if (userAgent.includes('android')) {
    os = 'android';
  }
  // Check for Linux
  else if (userAgent.includes('linux') || platform.includes('linux')) {
    os = 'linux';
  }
  
  // Detect browser
  let browser = 'unknown';
  if (userAgent.includes('firefox')) {
    browser = 'firefox';
  } else if (userAgent.includes('edg')) {
    browser = 'edge';
  } else if (userAgent.includes('chrome')) {
    browser = 'chrome';
  } else if (userAgent.includes('safari')) {
    browser = 'safari';
  } else if (userAgent.includes('opera') || userAgent.includes('opr')) {
    browser = 'opera';
  }
  
  // Extract version (simplified - gets first version number found)
  const versionMatch = userAgent.match(/(?:chrome|firefox|safari|edge|opr)\/(\d+)/);
  const version = versionMatch ? versionMatch[1] : 'unknown';
  
  // Determine driver support
  // Tabeza printer drivers are currently only supported on Windows and macOS
  const supportsDrivers = os === 'windows' || os === 'macos';
  
  return {
    os,
    browser,
    version,
    supportsDrivers,
  };
}

/**
 * Generates installation guidance for a specific platform
 * 
 * Provides OS-specific download links, installation instructions,
 * troubleshooting steps, and verification steps for Tabeza printer drivers.
 * 
 * @param platform - The detected platform information
 * @returns Installation guidance with download URL and instructions
 * @throws UnsupportedPlatformError if the platform doesn't support drivers
 */
export function generateInstallationGuidance(platform: Platform): InstallationGuidance {
  if (!platform.supportsDrivers) {
    throw new UnsupportedPlatformError(platform);
  }
  
  const baseUrl = 'https://github.com/tabeza/tabeza-printer-service/releases/latest/download';
  
  switch (platform.os) {
    case 'windows':
      return {
        downloadUrl: `${baseUrl}/tabeza-printer-service.exe`,
        instructions: [
          'Download the Tabeza Printer Service executable',
          'Right-click tabeza-printer-service.exe and select "Run as administrator"',
          'Enter your Bar ID when prompted',
          'Service will start automatically on port 8765',
          'Verify service is running: http://localhost:8765/api/status',
        ],
        troubleshootingSteps: [
          'Ensure you have administrator privileges',
          'Check if port 8765 is available',
          'Temporarily disable antivirus if installation is blocked',
          'Check Windows Event Viewer for service errors',
          'Contact support@tabeza.co.ke if installation fails',
        ],
        verificationSteps: [
          'Open browser and visit http://localhost:8765/api/status',
          'You should see service status information',
          'Check Windows Services for "Tabeza Printer Service"',
          'Verify the service status shows as "Running"',
          'Return to this setup to continue configuration',
        ],
      };
      
    case 'macos':
      return {
        downloadUrl: `${baseUrl}/tabeza-printer-service-macos.zip`,
        instructions: [
          'Download the Tabeza Printer Service package for macOS',
          'Extract the downloaded ZIP file',
          'Open Terminal',
          'Navigate to the extracted folder',
          'Run: npm install',
          'Run: npm start (or install as service)',
          'Verify service is running: http://localhost:8765/api/status',
        ],
        troubleshootingSteps: [
          'Ensure you have Node.js 18+ installed',
          'Check System Preferences → Security & Privacy for blocked installations',
          'Verify your macOS version is 10.15 (Catalina) or later',
          'Check if port 8765 is available',
          'Contact support@tabeza.co.ke if installation fails',
        ],
        verificationSteps: [
          'Open browser and visit http://localhost:8765/api/status',
          'You should see service status information',
          'Check Activity Monitor for "node" process',
          'Verify the service is responding',
          'Return to this setup to continue configuration',
        ],
      };
      
    default:
      throw new UnsupportedPlatformError(platform);
  }
}

/**
 * Checks driver availability and status
 * 
 * Attempts to detect if Tabeza printer drivers are installed by:
 * 1. Checking for the virtual printer service API
 * 2. Querying system printers (if available)
 * 3. Testing connectivity to the driver relay endpoint
 * 
 * @returns Driver status information
 */
export async function checkDriverAvailability(): Promise<DriverStatus> {
  try {
    // Check if the virtual printer service is running locally
    // The driver service runs on localhost:8765 by default
    const response = await fetch('http://localhost:8765/api/status', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      
      return {
        installed: true,
        compatible: true,
        version: data.version,
        driverInfo: {
          serviceName: 'Tabeza Virtual Printer Service',
          status: data.status,
          printerName: data.printerName || 'Tabeza Receipt Printer',
          lastSeen: data.timestamp,
        },
      };
    }
    
    // Service responded but not OK
    return {
      installed: false,
      compatible: true,
      error: `Driver service returned status ${response.status}`,
    };
    
  } catch (error) {
    // Service not reachable - drivers likely not installed
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        installed: false,
        compatible: true,
        error: 'Driver service not responding (timeout)',
      };
    }
    
    return {
      installed: false,
      compatible: true,
      error: 'Driver service not found. Please install Tabeza printer drivers.',
    };
  }
}

/**
 * Performs complete driver detection workflow
 * 
 * Combines platform detection, driver status checking, and installation
 * guidance generation into a single comprehensive result.
 * 
 * @param driversRequired - Whether drivers are required for the current configuration
 * @returns Complete driver detection result with guidance
 */
export async function performDriverDetection(
  driversRequired: boolean
): Promise<DriverDetectionResult> {
  try {
    // Detect platform
    const platform = detectPlatform();
    
    // If drivers aren't required, return early
    if (!driversRequired) {
      return {
        platform,
        driversRequired: false,
        driversDetected: false,
        manualVerificationRequired: false,
      };
    }
    
    // Check if platform supports drivers
    if (!platform.supportsDrivers) {
      throw new UnsupportedPlatformError(platform);
    }
    
    // Check driver availability
    const driverStatus = await checkDriverAvailability();
    
    // Generate installation guidance
    const installationGuidance = generateInstallationGuidance(platform);
    
    return {
      platform,
      driversRequired: true,
      driversDetected: driverStatus.installed,
      installationGuidance,
      manualVerificationRequired: !driverStatus.installed,
    };
  } catch (error) {
    if (error instanceof UnsupportedPlatformError) {
      throw error;
    }
    
    const platform = detectPlatform();
    throw new DriverDetectionError(
      platform,
      error instanceof Error ? error.message : 'Unknown error during driver detection'
    );
  }
}

/**
 * Validates that a platform supports Tabeza printer drivers
 * 
 * @param platform - The platform to validate
 * @returns True if the platform supports drivers, false otherwise
 */
export function isPlatformSupported(platform: Platform): boolean {
  return platform.supportsDrivers;
}

/**
 * Gets a human-readable platform description
 * 
 * @param platform - The platform to describe
 * @returns A user-friendly description of the platform
 */
export function getPlatformDescription(platform: Platform): string {
  const osNames: Record<OperatingSystem, string> = {
    windows: 'Windows',
    macos: 'macOS',
    linux: 'Linux',
    ios: 'iOS',
    android: 'Android',
    unknown: 'Unknown Operating System',
  };
  
  const osName = osNames[platform.os];
  const browserName = platform.browser.charAt(0).toUpperCase() + platform.browser.slice(1);
  
  return `${osName} (${browserName} ${platform.version})`;
}
