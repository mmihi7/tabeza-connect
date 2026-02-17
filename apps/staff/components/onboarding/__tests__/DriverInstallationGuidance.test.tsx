// CORE TRUTH: Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DriverInstallationGuidance from '../DriverInstallationGuidance';

describe('DriverInstallationGuidance', () => {
  const mockOnDriversConfirmed = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.open = jest.fn();
  });

  describe('Automatic Connection Message', () => {
    it('should display automatic connection information', () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      expect(screen.getByText('Automatic Printer Connection')).toBeInTheDocument();
      expect(screen.getByText(/printer will connect automatically/i)).toBeInTheDocument();
      expect(screen.getByText(/No manual configuration needed/i)).toBeInTheDocument();
    });

    it('should explain that TabezaConnect handles setup automatically', () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      expect(screen.getByText(/TabezaConnect service handles all printer setup automatically/i)).toBeInTheDocument();
      expect(screen.getByText(/Just install and run the service/i)).toBeInTheDocument();
    });
  });

  describe('Download Functionality', () => {
    it('should display download button', () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      expect(screen.getByText('Download TabezaConnect')).toBeInTheDocument();
      expect(screen.getByText(/Available for Windows and macOS/i)).toBeInTheDocument();
    });

    it('should open download URL when clicked', () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      const downloadButton = screen.getByText('Download TabezaConnect');
      fireEvent.click(downloadButton);

      expect(global.open).toHaveBeenCalledWith(
        'https://tabeza.co.ke/downloads/tabezaconnect',
        '_blank'
      );
    });
  });

  describe('Installation Steps', () => {
    it('should display simplified installation steps', () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      expect(screen.getByText('Installation Steps')).toBeInTheDocument();
      expect(screen.getByText(/Download TabezaConnect from the link above/i)).toBeInTheDocument();
      expect(screen.getByText(/Run the installer as administrator/i)).toBeInTheDocument();
      expect(screen.getByText(/service will start automatically/i)).toBeInTheDocument();
      expect(screen.getByText(/printer will appear online in the dashboard within 30 seconds/i)).toBeInTheDocument();
    });

    it('should show exactly 4 installation steps', () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      const stepNumbers = screen.getAllByText(/^[1-4]$/);
      expect(stepNumbers).toHaveLength(4);
    });
  });

  describe('What Happens Next Section', () => {
    it('should explain automatic registration process', () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      expect(screen.getByText('What Happens Next')).toBeInTheDocument();
      expect(screen.getByText(/TabezaConnect reads your venue ID/i)).toBeInTheDocument();
      expect(screen.getByText(/automatically sends heartbeats/i)).toBeInTheDocument();
      expect(screen.getByText(/printer status will show as "Online"/i)).toBeInTheDocument();
      expect(screen.getByText(/POS receipts will automatically be mirrored/i)).toBeInTheDocument();
    });

    it('should have continue button', () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      expect(screen.getByText('Continue to Dashboard')).toBeInTheDocument();
    });

    it('should call onDriversConfirmed when continue button is clicked', () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      const continueButton = screen.getByText('Continue to Dashboard');
      fireEvent.click(continueButton);

      expect(mockOnDriversConfirmed).toHaveBeenCalledTimes(1);
    });
  });

  describe('Help Section', () => {
    it('should display support contact information', () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      expect(screen.getByText(/Need help\?/)).toBeInTheDocument();

      const supportLink = screen.getByText('support@tabeza.co.ke');
      expect(supportLink).toBeInTheDocument();
      expect(supportLink).toHaveAttribute('href', 'mailto:support@tabeza.co.ke');
    });
  });

  describe('Removed Manual Configuration', () => {
    it('should NOT show platform detection', () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      expect(screen.queryByText('Platform Detected')).not.toBeInTheDocument();
      expect(screen.queryByText(/Windows/)).not.toBeInTheDocument();
      expect(screen.queryByText(/macOS/)).not.toBeInTheDocument();
    });

    it('should NOT show manual installation instructions', () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      expect(screen.queryByText('Step 2: Install the Drivers')).not.toBeInTheDocument();
      expect(screen.queryByText('I have installed the drivers')).not.toBeInTheDocument();
    });

    it('should NOT show troubleshooting section', () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      expect(screen.queryByText('Troubleshooting')).not.toBeInTheDocument();
    });

    it('should NOT show verification steps', () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      expect(screen.queryByText('Step 3: Verify Installation')).not.toBeInTheDocument();
      expect(screen.queryByText('Continue to Printer Setup')).not.toBeInTheDocument();
    });

    it('should NOT show loading spinner', () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).not.toBeInTheDocument();
    });

    it('should NOT show platform not supported error', () => {
      render(<DriverInstallationGuidance onDriversConfirmed={mockOnDriversConfirmed} />);

      expect(screen.queryByText('Platform Not Supported')).not.toBeInTheDocument();
      expect(screen.queryByText('Return to Setup')).not.toBeInTheDocument();
    });
  });
});
