// CORE TRUTH: Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DriverInstallationGuidance from '../DriverInstallationGuidance';
import * as driverDetectionService from '@tabeza/shared/lib/services/driver-detection-service';

// Mock the driver detection service
jest.mock('@tabeza/shared/lib/services/driver-detection-service');

const mockDetectPlatform = driverDetectionService.detectPlatform as jest.MockedFunction<
  typeof driverDetectionService.detectPlatform
>;
const mockGenerateInstallationGuidance = driverDetectionService.generateInstallationGuidance as jest.MockedFunction<
  typeof driverDetectionService.generateInstallationGuidance
>;
const mockGetPlatformDescription = driverDetectionService.getPlatformDescription as jest.MockedFunction<
  typeof driverDetectionService.getPlatformDescription
>;
const mockIsPlatformSupported = driverDetectionService.isPlatformSupported as jest.MockedFunction<
  typeof driverDetectionService.isPlatformSupported
>;

describe('DriverInstallationGuidance', () => {
  const mockOnDriversConfirmed = jest.fn();
  const mockOnSkip = jest.fn();

  const windowsPlatform = {
    os: 'windows' as const,
    browser: 'chrome',
    version: '120',
    supportsDrivers: true,
  };

  const macOSPlatform = {
    os: 'macos' as const,
    browser: 'safari',
    version: '17',
    supportsDrivers: true,
  };

  const linuxPlatform = {
    os: 'linux' as const,
    browser: 'firefox',
    version: '120',
    supportsDrivers: false,
  };

  const windowsGuidance = {
    downloadUrl: 'https://tabeza.co.ke/downloads/printer-drivers/tabeza-printer-service-v1.0.0.zip',
    instructions: [
      'Download the Tabeza Printer Driver installer for Windows',
      'Run the installer as Administrator',
      'Follow the installation wizard steps',
      'Restart your computer after installation completes',
      'Verify the "Tabeza Receipt Printer" appears in your printer list',
    ],
    troubleshootingSteps: [
      'Ensure you have administrator privileges',
      'Temporarily disable antivirus software',
      'Check Windows Defender settings',
    ],
    verificationSteps: [
      'Open Control Panel → Devices and Printers',
      'Look for "Tabeza Receipt Printer"',
      'Verify the driver status shows as "Ready"',
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPlatformDescription.mockReturnValue('Windows (Chrome 120)');
  });

  describe('Platform Detection', () => {
    it('should detect Windows platform and display guidance', async () => {
      mockDetectPlatform.mockReturnValue(windowsPlatform);
      mockIsPlatformSupported.mockReturnValue(true);
      mockGenerateInstallationGuidance.mockReturnValue(windowsGuidance);

      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      await waitFor(() => {
        expect(screen.getByText('Platform Detected')).toBeInTheDocument();
      });

      expect(screen.getByText('Windows (Chrome 120)')).toBeInTheDocument();
      expect(screen.getByText(/Tabeza printer drivers are required/)).toBeInTheDocument();
    });

    it('should detect macOS platform and display guidance', async () => {
      mockDetectPlatform.mockReturnValue(macOSPlatform);
      mockIsPlatformSupported.mockReturnValue(true);
      mockGetPlatformDescription.mockReturnValue('macOS (Safari 17)');
      mockGenerateInstallationGuidance.mockReturnValue({
        ...windowsGuidance,
        downloadUrl: 'https://tabeza.co.ke/downloads/printer-drivers/tabeza-printer-driver-macos.pkg',
      });

      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      await waitFor(() => {
        expect(screen.getByText('macOS (Safari 17)')).toBeInTheDocument();
      });
    });

    it('should show error for unsupported platforms', async () => {
      mockDetectPlatform.mockReturnValue(linuxPlatform);
      mockIsPlatformSupported.mockReturnValue(false);

      render(
        <DriverInstallationGuidance
          onDriversConfirmed={mockOnDriversConfirmed}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Platform Not Supported')).toBeInTheDocument();
      });

      expect(screen.getByText(/not currently supported on linux/i)).toBeInTheDocument();
      expect(screen.getByText('Return to Setup')).toBeInTheDocument();
    });
  });

  describe('Download Functionality', () => {
    beforeEach(() => {
      mockDetectPlatform.mockReturnValue(windowsPlatform);
      mockIsPlatformSupported.mockReturnValue(true);
      mockGenerateInstallationGuidance.mockReturnValue(windowsGuidance);
      
      // Mock window.open
      global.open = jest.fn();
    });

    it('should display download button with correct URL', async () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      await waitFor(() => {
        expect(screen.getByText('Download Tabeza Printer Drivers')).toBeInTheDocument();
      });

      expect(screen.getByText(/tabeza-printer-driver-windows.exe/)).toBeInTheDocument();
    });

    it('should open download URL in new tab when clicked', async () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      await waitFor(() => {
        expect(screen.getByText('Download Tabeza Printer Drivers')).toBeInTheDocument();
      });

      const downloadButton = screen.getByText('Download Tabeza Printer Drivers');
      fireEvent.click(downloadButton);

      expect(global.open).toHaveBeenCalledWith(windowsGuidance.downloadUrl, '_blank');
    });

    it('should show installation instructions after download', async () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      await waitFor(() => {
        expect(screen.getByText('Download Tabeza Printer Drivers')).toBeInTheDocument();
      });

      const downloadButton = screen.getByText('Download Tabeza Printer Drivers');
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(screen.getByText('Step 2: Install the Drivers')).toBeInTheDocument();
      });

      windowsGuidance.instructions.forEach((instruction) => {
        expect(screen.getByText(instruction)).toBeInTheDocument();
      });
    });
  });

  describe('Installation Confirmation', () => {
    beforeEach(() => {
      mockDetectPlatform.mockReturnValue(windowsPlatform);
      mockIsPlatformSupported.mockReturnValue(true);
      mockGenerateInstallationGuidance.mockReturnValue(windowsGuidance);
      global.open = jest.fn();
    });

    it('should show confirmation button after instructions are displayed', async () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      await waitFor(() => {
        expect(screen.getByText('Download Tabeza Printer Drivers')).toBeInTheDocument();
      });

      const downloadButton = screen.getByText('Download Tabeza Printer Drivers');
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(screen.getByText('I have installed the drivers')).toBeInTheDocument();
      });
    });

    it('should show verification steps when drivers are confirmed', async () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      await waitFor(() => {
        expect(screen.getByText('Download Tabeza Printer Drivers')).toBeInTheDocument();
      });

      // Click download
      fireEvent.click(screen.getByText('Download Tabeza Printer Drivers'));

      await waitFor(() => {
        expect(screen.getByText('I have installed the drivers')).toBeInTheDocument();
      });

      // Click confirmation
      fireEvent.click(screen.getByText('I have installed the drivers'));

      await waitFor(() => {
        expect(screen.getByText('Step 3: Verify Installation')).toBeInTheDocument();
      });

      windowsGuidance.verificationSteps.forEach((step) => {
        expect(screen.getByText(step)).toBeInTheDocument();
      });
    });

    it('should call onDriversConfirmed when proceeding after verification', async () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      await waitFor(() => {
        expect(screen.getByText('Download Tabeza Printer Drivers')).toBeInTheDocument();
      });

      // Click download
      fireEvent.click(screen.getByText('Download Tabeza Printer Drivers'));

      await waitFor(() => {
        expect(screen.getByText('I have installed the drivers')).toBeInTheDocument();
      });

      // Click confirmation
      fireEvent.click(screen.getByText('I have installed the drivers'));

      await waitFor(() => {
        expect(screen.getByText('Continue to Printer Setup')).toBeInTheDocument();
      });

      // Click proceed
      fireEvent.click(screen.getByText('Continue to Printer Setup'));

      expect(mockOnDriversConfirmed).toHaveBeenCalledTimes(1);
    });

    it('should disable confirmation button after clicking', async () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      await waitFor(() => {
        expect(screen.getByText('Download Tabeza Printer Drivers')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Download Tabeza Printer Drivers'));

      await waitFor(() => {
        expect(screen.getByText('I have installed the drivers')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText('I have installed the drivers');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Drivers Installed')).toBeInTheDocument();
      });
    });
  });

  describe('Troubleshooting Section', () => {
    beforeEach(() => {
      mockDetectPlatform.mockReturnValue(windowsPlatform);
      mockIsPlatformSupported.mockReturnValue(true);
      mockGenerateInstallationGuidance.mockReturnValue(windowsGuidance);
    });

    it('should display troubleshooting section', async () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      await waitFor(() => {
        expect(screen.getByText('Troubleshooting')).toBeInTheDocument();
      });
    });

    it('should toggle troubleshooting steps when clicked', async () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      await waitFor(() => {
        expect(screen.getByText('Troubleshooting')).toBeInTheDocument();
      });

      const troubleshootingButton = screen.getByText('Troubleshooting');
      
      // Initially hidden
      expect(screen.queryByText(windowsGuidance.troubleshootingSteps[0])).not.toBeInTheDocument();

      // Click to show
      fireEvent.click(troubleshootingButton);

      await waitFor(() => {
        windowsGuidance.troubleshootingSteps.forEach((step) => {
          expect(screen.getByText(step)).toBeInTheDocument();
        });
      });

      // Click to hide
      fireEvent.click(troubleshootingButton);

      await waitFor(() => {
        expect(screen.queryByText(windowsGuidance.troubleshootingSteps[0])).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle detection errors gracefully', async () => {
      mockDetectPlatform.mockImplementation(() => {
        throw new Error('Detection failed');
      });

      render(
        <DriverInstallationGuidance
          onDriversConfirmed={mockOnDriversConfirmed}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Platform Not Supported')).toBeInTheDocument();
      });

      expect(screen.getByText(/Detection failed/)).toBeInTheDocument();
    });

    it('should call onSkip when return button is clicked on error', async () => {
      mockDetectPlatform.mockReturnValue(linuxPlatform);
      mockIsPlatformSupported.mockReturnValue(false);

      render(
        <DriverInstallationGuidance
          onDriversConfirmed={mockOnDriversConfirmed}
          onSkip={mockOnSkip}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Return to Setup')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Return to Setup'));

      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });
  });

  describe('Help Section', () => {
    beforeEach(() => {
      mockDetectPlatform.mockReturnValue(windowsPlatform);
      mockIsPlatformSupported.mockReturnValue(true);
      mockGenerateInstallationGuidance.mockReturnValue(windowsGuidance);
    });

    it('should display support contact information', async () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      await waitFor(() => {
        expect(screen.getByText(/Need help\?/)).toBeInTheDocument();
      });

      const supportLink = screen.getByText('support@tabeza.co.ke');
      expect(supportLink).toBeInTheDocument();
      expect(supportLink).toHaveAttribute('href', 'mailto:support@tabeza.co.ke');
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner while detecting platform', () => {
      // Delay the mock to simulate loading
      mockDetectPlatform.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(windowsPlatform), 100);
        }) as any;
      });

      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      // Should show loading spinner initially
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });
});
