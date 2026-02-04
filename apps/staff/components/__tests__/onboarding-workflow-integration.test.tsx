/**
 * Integration Tests: Staff App Onboarding Workflow Components
 * Task 11.1: Create integration tests for complete onboarding workflows
 * 
 * Tests the integration between UI components, API routes, and services
 * for complete onboarding workflows in the staff application.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import VenueModeOnboarding from '../VenueModeOnboarding';

// Mock fetch for API calls
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock console methods
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeEach(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
  mockLocalStorage.getItem.mockClear();
  mockLocalStorage.setItem.mockClear();
  mockLocalStorage.removeItem.mockClear();
  mockFetch.mockClear();
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

describe('Staff App Onboarding Workflow Integration Tests', () => {
  const testBarId = 'test-bar-123';
  const mockOnComplete = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete New Venue Onboarding Workflow', () => {
    it('should complete Basic mode onboarding with API integration', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          venue: {
            id: testBarId,
            name: 'Test Restaurant',
            onboarding_completed: true,
            venue_mode: 'basic',
            authority_mode: 'pos',
            pos_integration_enabled: true,
            printer_required: true
          },
          message: 'Venue setup completed successfully!'
        })
      });

      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          isForced={true}
          barId={testBarId}
        />
      );

      // Step 1: Select Basic mode
      expect(screen.getByText('Choose Your Tabeza Setup')).toBeInTheDocument();
      
      await act(async () => {
        fireEvent.click(screen.getByText('Tabeza Basic'));
      });

      // Should automatically proceed to summary for Basic mode
      expect(screen.getByText('Configuration Summary')).toBeInTheDocument();
      expect(screen.getByText('Tabeza Basic')).toBeInTheDocument();
      expect(screen.getByText('POS Integration Bridge')).toBeInTheDocument();

      // Step 2: Complete setup
      await act(async () => {
        fireEvent.click(screen.getByText('Complete Required Setup'));
      });

      // Wait for API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/onboarding/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            barId: testBarId,
            configuration: {
              venue_mode: 'basic',
              authority_mode: 'pos'
            }
          })
        });
      });

      // Should call onComplete with the venue data
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            venue_mode: 'basic',
            authority_mode: 'pos',
            pos_integration_enabled: true,
            printer_required: true
          })
        );
      });

      // Should clear localStorage progress
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        `tabeza_onboarding_progress_${testBarId}`
      );
    });

    it('should complete Venue + POS onboarding with API integration', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          venue: {
            id: testBarId,
            name: 'Test Restaurant',
            onboarding_completed: true,
            venue_mode: 'venue',
            authority_mode: 'pos',
            pos_integration_enabled: true,
            printer_required: false
          },
          message: 'Venue setup completed successfully!'
        })
      });

      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          barId={testBarId}
        />
      );

      // Step 1: Select Venue mode
      await act(async () => {
        fireEvent.click(screen.getByText('Tabeza Venue'));
      });

      expect(screen.getByText('Order Management Setup')).toBeInTheDocument();

      // Step 2: Select POS authority
      await act(async () => {
        fireEvent.click(screen.getByText('Yes - I have a POS'));
      });

      // Should show summary with warnings
      expect(screen.getByText('Configuration Summary')).toBeInTheDocument();
      expect(screen.getByText('Important Notice')).toBeInTheDocument();
      expect(screen.getByText(/staff ordering in Tabeza will be disabled/)).toBeInTheDocument();

      // Step 3: Complete setup
      await act(async () => {
        fireEvent.click(screen.getByText('Complete Setup'));
      });

      // Wait for API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/onboarding/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            barId: testBarId,
            configuration: {
              venue_mode: 'venue',
              authority_mode: 'pos'
            }
          })
        });
      });

      // Should call onComplete
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            venue_mode: 'venue',
            authority_mode: 'pos',
            pos_integration_enabled: true,
            printer_required: false
          })
        );
      });
    });

    it('should complete Venue + Tabeza onboarding with API integration', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          venue: {
            id: testBarId,
            name: 'Test Restaurant',
            onboarding_completed: true,
            venue_mode: 'venue',
            authority_mode: 'tabeza',
            pos_integration_enabled: false,
            printer_required: false
          },
          message: 'Venue setup completed successfully!'
        })
      });

      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          barId={testBarId}
        />
      );

      // Step 1: Select Venue mode
      await act(async () => {
        fireEvent.click(screen.getByText('Tabeza Venue'));
      });

      // Step 2: Select Tabeza authority
      await act(async () => {
        fireEvent.click(screen.getByText('No - Use Tabeza'));
      });

      // Should show summary with different warnings
      expect(screen.getByText('Configuration Summary')).toBeInTheDocument();
      expect(screen.getByText(/POS integration will be disabled/)).toBeInTheDocument();
      expect(screen.getByText(/full customer ordering and staff management/)).toBeInTheDocument();

      // Step 3: Complete setup
      await act(async () => {
        fireEvent.click(screen.getByText('Complete Setup'));
      });

      // Wait for API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/onboarding/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            barId: testBarId,
            configuration: {
              venue_mode: 'venue',
              authority_mode: 'tabeza'
            }
          })
        });
      });

      // Should call onComplete
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            venue_mode: 'venue',
            authority_mode: 'tabeza',
            pos_integration_enabled: false,
            printer_required: false
          })
        );
      });
    });
  });

  describe('Progress Persistence Integration', () => {
    it('should save and restore progress across page reloads', async () => {
      // Step 1: Start onboarding and save progress
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          barId={testBarId}
        />
      );

      // Select Venue mode
      await act(async () => {
        fireEvent.click(screen.getByText('Tabeza Venue'));
      });

      // Verify progress was saved
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        `tabeza_onboarding_progress_${testBarId}`,
        expect.stringContaining('"selectedMode":"venue"')
      );

      // Step 2: Simulate page reload by unmounting and remounting with saved progress
      const savedProgress = {
        step: 'authority',
        selectedMode: 'venue',
        selectedAuthority: null,
        timestamp: Date.now(),
        barId: testBarId
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedProgress));

      // Unmount and remount component
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          barId={testBarId}
        />
      );

      // Should restore to authority selection step
      expect(screen.getByText('Order Management Setup')).toBeInTheDocument();
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
        `tabeza_onboarding_progress_${testBarId}`
      );

      // Step 3: Continue from restored progress
      await act(async () => {
        fireEvent.click(screen.getByText('Yes - I have a POS'));
      });

      // Should proceed to summary
      expect(screen.getByText('Configuration Summary')).toBeInTheDocument();

      // Progress should be updated
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        `tabeza_onboarding_progress_${testBarId}`,
        expect.stringContaining('"selectedAuthority":"pos"')
      );
    });

    it('should handle corrupted progress data gracefully', async () => {
      // Mock corrupted localStorage data
      mockLocalStorage.getItem.mockReturnValue('invalid json data');

      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          barId={testBarId}
        />
      );

      // Should start from beginning
      expect(screen.getByText('Choose Your Tabeza Setup')).toBeInTheDocument();

      // Should have cleared corrupted data
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        `tabeza_onboarding_progress_${testBarId}`
      );

      // Should log warning
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to restore onboarding progress:',
        expect.any(Error)
      );
    });

    it('should clear expired progress automatically', async () => {
      // Mock expired progress (older than 24 hours)
      const expiredProgress = {
        step: 'authority',
        selectedMode: 'venue',
        selectedAuthority: null,
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        barId: testBarId
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(expiredProgress));

      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          barId={testBarId}
        />
      );

      // Should start from beginning
      expect(screen.getByText('Choose Your Tabeza Setup')).toBeInTheDocument();

      // Should have cleared expired data
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        `tabeza_onboarding_progress_${testBarId}`
      );
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle API errors during onboarding completion', async () => {
      // Mock API error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          error: 'Database connection failed',
          userMessage: 'Unable to save venue configuration. Please try again.',
          canRetry: true
        })
      });

      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          barId={testBarId}
        />
      );

      // Complete Basic mode setup
      await act(async () => {
        fireEvent.click(screen.getByText('Tabeza Basic'));
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Complete Setup'));
      });

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Unable to save venue configuration/)).toBeInTheDocument();
      });

      // Should show retry button
      expect(screen.getByText('Try Again')).toBeInTheDocument();

      // Should not call onComplete
      expect(mockOnComplete).not.toHaveBeenCalled();

      // Progress should be preserved for retry
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          barId={testBarId}
        />
      );

      // Complete Basic mode setup
      await act(async () => {
        fireEvent.click(screen.getByText('Tabeza Basic'));
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Complete Setup'));
      });

      // Should show network error message
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Should show retry option
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should retry failed API calls successfully', async () => {
      // Mock initial failure then success
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({
            success: false,
            error: 'Temporary database error',
            userMessage: 'Unable to save configuration. Please try again.',
            canRetry: true
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            venue: {
              id: testBarId,
              name: 'Test Restaurant',
              onboarding_completed: true,
              venue_mode: 'basic',
              authority_mode: 'pos',
              pos_integration_enabled: true,
              printer_required: true
            },
            message: 'Venue setup completed successfully!'
          })
        });

      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          barId={testBarId}
        />
      );

      // Complete Basic mode setup
      await act(async () => {
        fireEvent.click(screen.getByText('Tabeza Basic'));
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Complete Setup'));
      });

      // Should show error first
      await waitFor(() => {
        expect(screen.getByText(/Unable to save configuration/)).toBeInTheDocument();
      });

      // Retry
      await act(async () => {
        fireEvent.click(screen.getByText('Try Again'));
      });

      // Should succeed on retry
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            venue_mode: 'basic',
            authority_mode: 'pos'
          })
        );
      });

      // Should clear progress after successful retry
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        `tabeza_onboarding_progress_${testBarId}`
      );
    });
  });

  describe('Validation Integration', () => {
    it('should prevent invalid configuration submissions', async () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          barId={testBarId}
        />
      );

      // This test verifies that the UI prevents invalid configurations
      // from being submitted to the API in the first place

      // Select Basic mode (valid)
      await act(async () => {
        fireEvent.click(screen.getByText('Tabeza Basic'));
      });

      // Basic mode should automatically set POS authority
      expect(screen.getByText('Configuration Summary')).toBeInTheDocument();
      expect(screen.getByText('POS Integration Bridge')).toBeInTheDocument();

      // Complete button should be enabled for valid configuration
      const completeButton = screen.getByText('Complete Setup');
      expect(completeButton).not.toBeDisabled();

      // Mock successful API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          venue: {
            id: testBarId,
            onboarding_completed: true,
            venue_mode: 'basic',
            authority_mode: 'pos'
          }
        })
      });

      await act(async () => {
        fireEvent.click(completeButton);
      });

      // Should make API call with valid configuration
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/onboarding/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            barId: testBarId,
            configuration: {
              venue_mode: 'basic',
              authority_mode: 'pos'
            }
          })
        });
      });
    });

    it('should show validation warnings for configuration implications', async () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          barId={testBarId}
        />
      );

      // Select Venue mode
      await act(async () => {
        fireEvent.click(screen.getByText('Tabeza Venue'));
      });

      // Select POS authority
      await act(async () => {
        fireEvent.click(screen.getByText('Yes - I have a POS'));
      });

      // Should show warnings about POS authority implications
      expect(screen.getByText('Important Notice')).toBeInTheDocument();
      expect(screen.getByText(/staff ordering in Tabeza will be disabled/)).toBeInTheDocument();
      expect(screen.getByText(/customers can only submit order requests/)).toBeInTheDocument();

      // Go back and select Tabeza authority
      await act(async () => {
        fireEvent.click(screen.getByText('Back'));
      });

      await act(async () => {
        fireEvent.click(screen.getByText('No - Use Tabeza'));
      });

      // Should show different warnings for Tabeza authority
      expect(screen.getByText(/POS integration will be disabled/)).toBeInTheDocument();
      expect(screen.getByText(/full customer ordering and staff management/)).toBeInTheDocument();
    });
  });

  describe('Forced Mode Integration', () => {
    it('should prevent dismissal in forced mode', async () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          isForced={true}
          barId={testBarId}
        />
      );

      // Should show forced mode indicators
      expect(screen.getByText('Setup Required')).toBeInTheDocument();
      expect(screen.getByText('* Required to continue')).toBeInTheDocument();

      // Should not show cancel button
      expect(screen.queryByText('Cancel Setup')).not.toBeInTheDocument();

      // Should prevent ESC key dismissal
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      
      // Modal should still be visible
      expect(screen.getByText('Choose Your Tabeza Setup')).toBeInTheDocument();

      // onCancel should not be called
      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('should show required completion button text in forced mode', async () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          isForced={true}
          barId={testBarId}
        />
      );

      // Select Basic mode
      await act(async () => {
        fireEvent.click(screen.getByText('Tabeza Basic'));
      });

      // Should show forced completion button text
      expect(screen.getByText('Complete Required Setup')).toBeInTheDocument();
      expect(screen.queryByText('Complete Setup')).not.toBeInTheDocument();
    });
  });

  describe('Theme Integration', () => {
    it('should apply correct theme based on configuration selection', async () => {
      render(
        <VenueModeOnboarding 
          onComplete={mockOnComplete} 
          onCancel={mockOnCancel}
          barId={testBarId}
        />
      );

      // Select Basic mode
      await act(async () => {
        fireEvent.click(screen.getByText('Tabeza Basic'));
      });

      // Should show Basic mode theme elements
      expect(screen.getByText('POS Integration Bridge')).toBeInTheDocument();
      expect(screen.getByText(/printer integration/i)).toBeInTheDocument();

      // Go back and select Venue mode
      await act(async () => {
        fireEvent.click(screen.getByText('Back'));
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Tabeza Venue'));
      });

      // Select POS authority
      await act(async () => {
        fireEvent.click(screen.getByText('Yes - I have a POS'));
      });

      // Should show Venue + POS theme elements
      expect(screen.getByText('Hybrid Workflow')).toBeInTheDocument();

      // Go back and select Tabeza authority
      await act(async () => {
        fireEvent.click(screen.getByText('Back'));
      });

      await act(async () => {
        fireEvent.click(screen.getByText('No - Use Tabeza'));
      });

      // Should show Venue + Tabeza theme elements
      expect(screen.getByText('Full Service Platform')).toBeInTheDocument();
    });
  });
});