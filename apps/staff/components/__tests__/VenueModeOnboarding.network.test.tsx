/**
 * VenueModeOnboarding Network Error Handling Tests
 * 
 * Tests for network error handling and offline support in the onboarding component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VenueModeOnboarding from '../VenueModeOnboarding';

// Mock the network-aware onboarding hook
const mockNetworkState = {
  networkState: {
    isOnline: true,
    isSlowConnection: false,
    queuedOperations: 0,
    lastNetworkChange: Date.now(),
    connectionType: 'wifi',
    effectiveType: '4g'
  },
  isOnline: true,
  isSlowConnection: false,
  isProcessing: false,
  processingOperation: null,
  queuedOperations: 0,
  hasQueuedOperations: false,
  hasStoredProgress: false,
  storedProgress: null,
  lastError: null,
  canRetry: false,
  retryCount: 0
};

const mockNetworkActions = {
  checkOnboardingStatus: jest.fn(),
  completeOnboarding: jest.fn(),
  updateVenueConfiguration: jest.fn(),
  migrateExistingVenue: jest.fn(),
  saveProgress: jest.fn(),
  restoreProgress: jest.fn(),
  clearProgress: jest.fn(),
  processRetryQueue: jest.fn(),
  clearQueue: jest.fn(),
  clearError: jest.fn(),
  retry: jest.fn(),
  testConnectivity: jest.fn(),
  refreshNetworkStatus: jest.fn()
};

jest.mock('../hooks/useNetworkAwareOnboarding', () => ({
  useNetworkAwareOnboarding: jest.fn(() => ({
    state: mockNetworkState,
    actions: mockNetworkActions
  }))
}));

// Mock the themed components
jest.mock('../themed/VenueConfigurationDisplay', () => ({
  VenueConfigurationDisplay: ({ config }: any) => (
    <div data-testid="venue-config-display">
      Config: {config.venue_mode} - {config.authority_mode}
    </div>
  )
}));

jest.mock('../themed/ThemedButton', () => ({
  ThemedButton: ({ children, onClick, disabled, variant, className }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`themed-button ${variant} ${className}`}
      data-testid={`themed-button-${variant}`}
    >
      {children}
    </button>
  )
}));

jest.mock('../themed/ThemedCard', () => ({
  ThemedCard: ({ children }: any) => <div className="themed-card">{children}</div>
}));

// Mock the theme context
jest.mock('../contexts/ThemeContext', () => ({
  getVenueThemeConfig: jest.fn(() => ({ primary: 'blue' })),
  getVenueThemeClasses: jest.fn(() => 'theme-blue')
}));

// Mock the NetworkStatusIndicator
jest.mock('../NetworkStatusIndicator', () => ({
  NetworkStatusIndicator: ({ networkState, onRetryQueue, onRefreshStatus }: any) => (
    <div data-testid="network-status-indicator">
      <span data-testid="network-status">
        {networkState.isOnline ? 'Online' : 'Offline'}
      </span>
      <span data-testid="queued-operations">
        Queued: {networkState.queuedOperations}
      </span>
      {onRetryQueue && (
        <button onClick={onRetryQueue} data-testid="retry-queue-button">
          Retry Queue
        </button>
      )}
      {onRefreshStatus && (
        <button onClick={onRefreshStatus} data-testid="refresh-status-button">
          Refresh Status
        </button>
      )}
    </div>
  )
}));

describe('VenueModeOnboarding Network Error Handling', () => {
  const mockOnComplete = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock network state
    Object.assign(mockNetworkState, {
      networkState: {
        isOnline: true,
        isSlowConnection: false,
        queuedOperations: 0,
        lastNetworkChange: Date.now(),
        connectionType: 'wifi',
        effectiveType: '4g'
      },
      isOnline: true,
      isSlowConnection: false,
      isProcessing: false,
      processingOperation: null,
      queuedOperations: 0,
      hasQueuedOperations: false,
      hasStoredProgress: false,
      storedProgress: null,
      lastError: null,
      canRetry: false,
      retryCount: 0
    });
  });

  describe('network status display', () => {
    it('should display network status indicator', () => {
      render(
        <VenueModeOnboarding
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          barId="test-bar-id"
        />
      );

      expect(screen.getByTestId('network-status-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('network-status')).toHaveTextContent('Online');
      expect(screen.getByTestId('queued-operations')).toHaveTextContent('Queued: 0');
    });

    it('should show offline status when network is down', () => {
      mockNetworkState.networkState.isOnline = false;
      mockNetworkState.isOnline = false;

      render(
        <VenueModeOnboarding
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          barId="test-bar-id"
        />
      );

      expect(screen.getByTestId('network-status')).toHaveTextContent('Offline');
    });

    it('should show queued operations count', () => {
      mockNetworkState.networkState.queuedOperations = 3;
      mockNetworkState.queuedOperations = 3;
      mockNetworkState.hasQueuedOperations = true;

      render(
        <VenueModeOnboarding
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          barId="test-bar-id"
        />
      );

      expect(screen.getByTestId('queued-operations')).toHaveTextContent('Queued: 3');
    });
  });

  describe('network error handling', () => {
    it('should display network errors', () => {
      mockNetworkState.lastError = 'Connection lost during setup';
      mockNetworkState.canRetry = true;

      render(
        <VenueModeOnboarding
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          barId="test-bar-id"
        />
      );

      expect(screen.getByText('Setup Error')).toBeInTheDocument();
      expect(screen.getByText('Connection lost during setup')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should handle retry button click', async () => {
      mockNetworkState.lastError = 'Network error';
      mockNetworkState.canRetry = true;

      render(
        <VenueModeOnboarding
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          barId="test-bar-id"
        />
      );

      const retryButton = screen.getByText('Try Again');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockNetworkActions.clearError).toHaveBeenCalled();
        expect(mockNetworkActions.retry).toHaveBeenCalled();
      });
    });

    it('should show processing state during network operations', () => {
      mockNetworkState.isProcessing = true;
      mockNetworkState.processingOperation = 'complete_onboarding';

      render(
        <VenueModeOnboarding
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          barId="test-bar-id"
        />
      );

      // Should show processing indicator in network status
      expect(screen.getByTestId('network-status-indicator')).toBeInTheDocument();
    });
  });

  describe('progress persistence', () => {
    it('should restore progress on mount', () => {
      const mockProgress = {
        step: 'authority' as const,
        selectedMode: 'venue' as const,
        selectedAuthority: 'pos' as const,
        timestamp: Date.now(),
        barId: 'test-bar-id'
      };

      mockNetworkState.hasStoredProgress = true;
      mockNetworkState.storedProgress = mockProgress;

      render(
        <VenueModeOnboarding
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          barId="test-bar-id"
        />
      );

      // Should be on authority step based on restored progress
      expect(screen.getByText('Order Management Setup')).toBeInTheDocument();
    });

    it('should save progress when selections change', async () => {
      render(
        <VenueModeOnboarding
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          barId="test-bar-id"
        />
      );

      // Select Tabeza Venue
      const venueOption = screen.getByText('Tabeza Venue');
      fireEvent.click(venueOption);

      await waitFor(() => {
        expect(mockNetworkActions.saveProgress).toHaveBeenCalledWith(
          expect.objectContaining({
            step: 'authority',
            selectedMode: 'venue',
            selectedAuthority: null,
            barId: 'test-bar-id'
          })
        );
      });
    });
  });

  describe('queue management', () => {
    it('should show retry queue button when operations are queued', () => {
      mockNetworkState.queuedOperations = 2;
      mockNetworkState.hasQueuedOperations = true;

      render(
        <VenueModeOnboarding
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          barId="test-bar-id"
        />
      );

      expect(screen.getByTestId('retry-queue-button')).toBeInTheDocument();
    });

    it('should handle retry queue button click', async () => {
      mockNetworkState.queuedOperations = 1;
      mockNetworkState.hasQueuedOperations = true;

      render(
        <VenueModeOnboarding
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          barId="test-bar-id"
        />
      );

      const retryQueueButton = screen.getByTestId('retry-queue-button');
      fireEvent.click(retryQueueButton);

      await waitFor(() => {
        expect(mockNetworkActions.processRetryQueue).toHaveBeenCalled();
      });
    });

    it('should handle refresh status button click', async () => {
      render(
        <VenueModeOnboarding
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          barId="test-bar-id"
        />
      );

      const refreshButton = screen.getByTestId('refresh-status-button');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockNetworkActions.refreshNetworkStatus).toHaveBeenCalled();
      });
    });
  });

  describe('onboarding completion with network awareness', () => {
    it('should complete onboarding successfully when online', async () => {
      mockNetworkActions.completeOnboarding.mockResolvedValue({
        success: true,
        data: { id: 'test-bar-id', name: 'Test Bar' },
        networkStatus: mockNetworkState.networkState,
        canRetry: false
      });

      render(
        <VenueModeOnboarding
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          barId="test-bar-id"
        />
      );

      // Navigate to summary step
      const venueOption = screen.getByText('Tabeza Venue');
      fireEvent.click(venueOption);

      await waitFor(() => {
        expect(screen.getByText('Yes - I have a POS')).toBeInTheDocument();
      });

      const posOption = screen.getByText('Yes - I have a POS');
      fireEvent.click(posOption);

      await waitFor(() => {
        expect(screen.getByText('Configuration Summary')).toBeInTheDocument();
      });

      const completeButton = screen.getByTestId('themed-button-primary');
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(mockNetworkActions.completeOnboarding).toHaveBeenCalledWith(
          'test-bar-id',
          {
            venue_mode: 'venue',
            authority_mode: 'pos'
          }
        );
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });

    it('should queue onboarding when offline', async () => {
      mockNetworkActions.completeOnboarding.mockResolvedValue({
        success: false,
        error: 'No internet connection. Your setup will be completed automatically when connection is restored.',
        isQueued: true,
        queueId: 'queue-123',
        networkStatus: {
          ...mockNetworkState.networkState,
          isOnline: false,
          queuedOperations: 1
        },
        canRetry: true
      });

      render(
        <VenueModeOnboarding
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          barId="test-bar-id"
        />
      );

      // Navigate to summary and complete
      const venueOption = screen.getByText('Tabeza Venue');
      fireEvent.click(venueOption);

      await waitFor(() => {
        const posOption = screen.getByText('Yes - I have a POS');
        fireEvent.click(posOption);
      });

      await waitFor(() => {
        const completeButton = screen.getByTestId('themed-button-primary');
        fireEvent.click(completeButton);
      });

      await waitFor(() => {
        expect(mockNetworkActions.completeOnboarding).toHaveBeenCalled();
        expect(mockOnComplete).toHaveBeenCalled(); // Should still complete for queued operations
      });
    });

    it('should handle onboarding failure with retry option', async () => {
      mockNetworkActions.completeOnboarding.mockResolvedValue({
        success: false,
        error: 'Server error occurred',
        networkStatus: mockNetworkState.networkState,
        canRetry: true
      });

      render(
        <VenueModeOnboarding
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          barId="test-bar-id"
        />
      );

      // Navigate to summary and complete
      const venueOption = screen.getByText('Tabeza Venue');
      fireEvent.click(venueOption);

      await waitFor(() => {
        const posOption = screen.getByText('Yes - I have a POS');
        fireEvent.click(posOption);
      });

      await waitFor(() => {
        const completeButton = screen.getByTestId('themed-button-primary');
        fireEvent.click(completeButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Configuration Error')).toBeInTheDocument();
        expect(screen.getByText('Server error occurred')).toBeInTheDocument();
        expect(mockOnComplete).not.toHaveBeenCalled();
      });
    });
  });

  describe('forced mode with network handling', () => {
    it('should show forced mode indicator with network status', () => {
      render(
        <VenueModeOnboarding
          onComplete={mockOnComplete}
          isForced={true}
          barId="test-bar-id"
        />
      );

      expect(screen.getByText('Setup Required')).toBeInTheDocument();
      expect(screen.getByText('You must complete venue configuration before accessing settings.')).toBeInTheDocument();
      expect(screen.getByTestId('network-status-indicator')).toBeInTheDocument();
    });

    it('should not show cancel button in forced mode', () => {
      render(
        <VenueModeOnboarding
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          isForced={true}
          barId="test-bar-id"
        />
      );

      expect(screen.queryByText('Cancel Setup')).not.toBeInTheDocument();
    });
  });

  describe('accessibility and user experience', () => {
    it('should disable complete button when processing', () => {
      mockNetworkState.isProcessing = true;

      render(
        <VenueModeOnboarding
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          barId="test-bar-id"
        />
      );

      // Navigate to summary step
      const venueOption = screen.getByText('Tabeza Venue');
      fireEvent.click(venueOption);

      // Wait for authority step and select POS
      waitFor(() => {
        const posOption = screen.getByText('Yes - I have a POS');
        fireEvent.click(posOption);
      });

      // Wait for summary step
      waitFor(() => {
        const completeButton = screen.getByTestId('themed-button-primary');
        expect(completeButton).toBeDisabled();
      });
    });

    it('should show processing state in button text', () => {
      mockNetworkState.isProcessing = true;

      render(
        <VenueModeOnboarding
          onComplete={mockOnComplete}
          onCancel={mockOnCancel}
          isForced={true}
          barId="test-bar-id"
        />
      );

      // Navigate to summary step
      const venueOption = screen.getByText('Tabeza Venue');
      fireEvent.click(venueOption);

      waitFor(() => {
        const posOption = screen.getByText('Yes - I have a POS');
        fireEvent.click(posOption);
      });

      waitFor(() => {
        expect(screen.getByText('Completing Setup...')).toBeInTheDocument();
      });
    });
  });
});