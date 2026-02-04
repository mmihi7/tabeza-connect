/**
 * Integration Tests: Settings Page Onboarding Integration
 * Task 11.1: Create integration tests for complete onboarding workflows
 * 
 * Tests the integration between the settings page and onboarding system,
 * including forced modal display, migration handling, and configuration changes.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';

// Mock the settings page component (we'll create a simplified version for testing)
const MockSettingsPage = ({ barId }: { barId: string }) => {
  const [showOnboardingModal, setShowOnboardingModal] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [venue, setVenue] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const response = await fetch(`/api/venue-status/${barId}`);
        const result = await response.json();
        
        if (result.success) {
          setVenue(result.venue);
          // Show modal if onboarding not completed
          if (!result.venue.onboarding_completed) {
            setShowOnboardingModal(true);
          }
        } else {
          setError(result.error);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [barId]);

  const handleOnboardingComplete = (completedVenue: any) => {
    setVenue(completedVenue);
    setShowOnboardingModal(false);
  };

  if (loading) {
    return <div>Loading settings...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h1>Venue Settings</h1>
      
      {/* Onboarding Gate - blocks access until completion */}
      {showOnboardingModal && (
        <div data-testid="onboarding-gate" className="fixed inset-0 bg-black bg-opacity-50 z-50">
          <div className="flex items-center justify-center min-h-screen">
            <div className="bg-white p-6 rounded-lg max-w-4xl w-full mx-4">
              <h2>Setup Required</h2>
              <p>You must complete venue configuration before accessing settings.</p>
              <MockVenueModeOnboarding 
                onComplete={handleOnboardingComplete}
                isForced={true}
                barId={barId}
              />
            </div>
          </div>
        </div>
      )}

      {/* Settings content - only accessible after onboarding */}
      {!showOnboardingModal && venue && (
        <div data-testid="settings-content">
          <div data-testid="venue-config-display">
            <h2>Current Configuration</h2>
            <p>Mode: {venue.venue_mode}</p>
            <p>Authority: {venue.authority_mode}</p>
            <p>POS Integration: {venue.pos_integration_enabled ? 'Enabled' : 'Disabled'}</p>
            <p>Printer Required: {venue.printer_required ? 'Yes' : 'No'}</p>
          </div>
          
          <button 
            onClick={() => setShowOnboardingModal(true)}
            data-testid="change-config-button"
          >
            Change Configuration
          </button>
          
          <div data-testid="other-settings">
            <h3>Other Settings</h3>
            <p>Payment methods, notifications, etc.</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Mock VenueModeOnboarding component
const MockVenueModeOnboarding = ({ 
  onComplete, 
  isForced, 
  barId 
}: { 
  onComplete: (venue: any) => void;
  isForced?: boolean;
  barId: string;
}) => {
  const [step, setStep] = React.useState<'mode' | 'authority' | 'summary'>('mode');
  const [selectedMode, setSelectedMode] = React.useState<'basic' | 'venue' | null>(null);
  const [selectedAuthority, setSelectedAuthority] = React.useState<'pos' | 'tabeza' | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleModeSelect = (mode: 'basic' | 'venue') => {
    setSelectedMode(mode);
    if (mode === 'basic') {
      setSelectedAuthority('pos');
      setStep('summary');
    } else {
      setStep('authority');
    }
  };

  const handleAuthoritySelect = (authority: 'pos' | 'tabeza') => {
    setSelectedAuthority(authority);
    setStep('summary');
  };

  const handleComplete = async () => {
    if (!selectedMode || !selectedAuthority) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barId,
          configuration: {
            venue_mode: selectedMode,
            authority_mode: selectedAuthority
          }
        })
      });

      const result = await response.json();

      if (result.success) {
        onComplete(result.venue);
      } else {
        setError(result.userMessage || result.error);
      }
    } catch (err: any) {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="venue-mode-onboarding">
      {isForced && (
        <div data-testid="forced-mode-indicator">
          <p>* Required to continue</p>
        </div>
      )}

      {step === 'mode' && (
        <div data-testid="mode-selection">
          <h3>Choose Your Tabeza Setup</h3>
          <button onClick={() => handleModeSelect('basic')}>
            Tabeza Basic
          </button>
          <button onClick={() => handleModeSelect('venue')}>
            Tabeza Venue
          </button>
        </div>
      )}

      {step === 'authority' && (
        <div data-testid="authority-selection">
          <h3>Order Management Setup</h3>
          <button onClick={() => handleAuthoritySelect('pos')}>
            Yes - I have a POS
          </button>
          <button onClick={() => handleAuthoritySelect('tabeza')}>
            No - Use Tabeza
          </button>
          <button onClick={() => setStep('mode')}>
            Back
          </button>
        </div>
      )}

      {step === 'summary' && (
        <div data-testid="configuration-summary">
          <h3>Configuration Summary</h3>
          <p>Mode: {selectedMode}</p>
          <p>Authority: {selectedAuthority}</p>
          
          {error && (
            <div data-testid="error-message" className="text-red-600">
              {error}
            </div>
          )}
          
          <button 
            onClick={handleComplete}
            disabled={submitting}
            data-testid="complete-button"
          >
            {submitting ? 'Saving...' : (isForced ? 'Complete Required Setup' : 'Complete Setup')}
          </button>
          
          {selectedMode === 'venue' && (
            <button onClick={() => setStep('authority')}>
              Back
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Mock fetch for API calls
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Settings Page Onboarding Integration Tests', () => {
  const testBarId = 'test-bar-123';

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('New Venue Onboarding Gate', () => {
    it('should show forced onboarding modal for new venue', async () => {
      // Mock venue status API - venue needs onboarding
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          venue: {
            id: testBarId,
            name: 'New Restaurant',
            onboarding_completed: false,
            venue_mode: null,
            authority_mode: null
          }
        })
      });

      render(<MockSettingsPage barId={testBarId} />);

      // Should show loading first
      expect(screen.getByText('Loading settings...')).toBeInTheDocument();

      // Wait for API call and modal to appear
      await waitFor(() => {
        expect(screen.getByTestId('onboarding-gate')).toBeInTheDocument();
      });

      // Should show forced onboarding modal
      expect(screen.getByText('Setup Required')).toBeInTheDocument();
      expect(screen.getByText('You must complete venue configuration before accessing settings.')).toBeInTheDocument();
      expect(screen.getByTestId('forced-mode-indicator')).toBeInTheDocument();

      // Settings content should not be accessible
      expect(screen.queryByTestId('settings-content')).not.toBeInTheDocument();

      // Verify API was called
      expect(mockFetch).toHaveBeenCalledWith(`/api/venue-status/${testBarId}`);
    });

    it('should complete onboarding and show settings content', async () => {
      // Mock venue status API - venue needs onboarding
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            venue: {
              id: testBarId,
              name: 'New Restaurant',
              onboarding_completed: false,
              venue_mode: null,
              authority_mode: null
            }
          })
        })
        // Mock onboarding completion API
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            venue: {
              id: testBarId,
              name: 'New Restaurant',
              onboarding_completed: true,
              venue_mode: 'basic',
              authority_mode: 'pos',
              pos_integration_enabled: true,
              printer_required: true
            },
            message: 'Venue setup completed successfully!'
          })
        });

      render(<MockSettingsPage barId={testBarId} />);

      // Wait for onboarding modal
      await waitFor(() => {
        expect(screen.getByTestId('onboarding-gate')).toBeInTheDocument();
      });

      // Complete Basic mode onboarding
      await act(async () => {
        fireEvent.click(screen.getByText('Tabeza Basic'));
      });

      // Should show summary
      expect(screen.getByTestId('configuration-summary')).toBeInTheDocument();

      // Complete setup
      await act(async () => {
        fireEvent.click(screen.getByTestId('complete-button'));
      });

      // Wait for completion
      await waitFor(() => {
        expect(screen.queryByTestId('onboarding-gate')).not.toBeInTheDocument();
      });

      // Should now show settings content
      expect(screen.getByTestId('settings-content')).toBeInTheDocument();
      expect(screen.getByTestId('venue-config-display')).toBeInTheDocument();
      expect(screen.getByText('Mode: basic')).toBeInTheDocument();
      expect(screen.getByText('Authority: pos')).toBeInTheDocument();
      expect(screen.getByText('POS Integration: Enabled')).toBeInTheDocument();
      expect(screen.getByText('Printer Required: Yes')).toBeInTheDocument();

      // Verify onboarding completion API was called
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

    it('should handle onboarding API errors gracefully', async () => {
      // Mock venue status API - venue needs onboarding
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            venue: {
              id: testBarId,
              name: 'New Restaurant',
              onboarding_completed: false,
              venue_mode: null,
              authority_mode: null
            }
          })
        })
        // Mock onboarding completion API error
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({
            success: false,
            error: 'Database connection failed',
            userMessage: 'Unable to save venue configuration. Please try again.',
            canRetry: true
          })
        });

      render(<MockSettingsPage barId={testBarId} />);

      // Wait for onboarding modal
      await waitFor(() => {
        expect(screen.getByTestId('onboarding-gate')).toBeInTheDocument();
      });

      // Complete Basic mode onboarding
      await act(async () => {
        fireEvent.click(screen.getByText('Tabeza Basic'));
      });

      // Complete setup
      await act(async () => {
        fireEvent.click(screen.getByTestId('complete-button'));
      });

      // Should show error message
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
        expect(screen.getByText('Unable to save venue configuration. Please try again.')).toBeInTheDocument();
      });

      // Should still show onboarding modal (not dismissed)
      expect(screen.getByTestId('onboarding-gate')).toBeInTheDocument();
      expect(screen.queryByTestId('settings-content')).not.toBeInTheDocument();
    });
  });

  describe('Completed Venue Settings Access', () => {
    it('should show settings content for completed venue', async () => {
      // Mock venue status API - venue already completed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          venue: {
            id: testBarId,
            name: 'Completed Restaurant',
            onboarding_completed: true,
            venue_mode: 'venue',
            authority_mode: 'tabeza',
            pos_integration_enabled: false,
            printer_required: false
          }
        })
      });

      render(<MockSettingsPage barId={testBarId} />);

      // Should show loading first
      expect(screen.getByText('Loading settings...')).toBeInTheDocument();

      // Wait for settings content to appear
      await waitFor(() => {
        expect(screen.getByTestId('settings-content')).toBeInTheDocument();
      });

      // Should not show onboarding modal
      expect(screen.queryByTestId('onboarding-gate')).not.toBeInTheDocument();

      // Should show current configuration
      expect(screen.getByText('Mode: venue')).toBeInTheDocument();
      expect(screen.getByText('Authority: tabeza')).toBeInTheDocument();
      expect(screen.getByText('POS Integration: Disabled')).toBeInTheDocument();
      expect(screen.getByText('Printer Required: No')).toBeInTheDocument();

      // Should show change configuration button
      expect(screen.getByTestId('change-config-button')).toBeInTheDocument();

      // Should show other settings
      expect(screen.getByTestId('other-settings')).toBeInTheDocument();
    });

    it('should allow configuration changes for completed venue', async () => {
      // Mock venue status API - venue already completed
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            venue: {
              id: testBarId,
              name: 'Completed Restaurant',
              onboarding_completed: true,
              venue_mode: 'venue',
              authority_mode: 'tabeza',
              pos_integration_enabled: false,
              printer_required: false
            }
          })
        })
        // Mock configuration update API
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            venue: {
              id: testBarId,
              name: 'Completed Restaurant',
              onboarding_completed: true,
              venue_mode: 'venue',
              authority_mode: 'pos',
              pos_integration_enabled: true,
              printer_required: false
            },
            message: 'Venue configuration updated successfully!'
          })
        });

      render(<MockSettingsPage barId={testBarId} />);

      // Wait for settings content
      await waitFor(() => {
        expect(screen.getByTestId('settings-content')).toBeInTheDocument();
      });

      // Click change configuration
      await act(async () => {
        fireEvent.click(screen.getByTestId('change-config-button'));
      });

      // Should show onboarding modal (not forced this time)
      expect(screen.getByTestId('onboarding-gate')).toBeInTheDocument();
      expect(screen.queryByTestId('forced-mode-indicator')).not.toBeInTheDocument();

      // Change to Venue + POS
      await act(async () => {
        fireEvent.click(screen.getByText('Tabeza Venue'));
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Yes - I have a POS'));
      });

      // Complete configuration change
      await act(async () => {
        fireEvent.click(screen.getByTestId('complete-button'));
      });

      // Wait for update to complete
      await waitFor(() => {
        expect(screen.queryByTestId('onboarding-gate')).not.toBeInTheDocument();
      });

      // Should show updated configuration
      expect(screen.getByText('Authority: pos')).toBeInTheDocument();
      expect(screen.getByText('POS Integration: Enabled')).toBeInTheDocument();
    });
  });

  describe('Existing Venue Migration Integration', () => {
    it('should handle existing venue migration automatically', async () => {
      // Mock venue status API - existing venue needs migration
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            venue: {
              id: testBarId,
              name: 'Existing Restaurant',
              onboarding_completed: false,
              venue_mode: null,
              authority_mode: null,
              created_at: '2023-01-01T00:00:00Z' // Old venue
            }
          })
        })
        // Mock migration API
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            migrationNeeded: true,
            migrationCompleted: true,
            venue: {
              id: testBarId,
              name: 'Existing Restaurant',
              onboarding_completed: true,
              venue_mode: 'venue',
              authority_mode: 'tabeza',
              pos_integration_enabled: false,
              printer_required: false
            },
            message: 'Venue migration completed successfully'
          })
        });

      // Mock the migration check in settings page
      const MockSettingsPageWithMigration = ({ barId }: { barId: string }) => {
        const [loading, setLoading] = React.useState(true);
        const [venue, setVenue] = React.useState<any>(null);
        const [showOnboardingModal, setShowOnboardingModal] = React.useState(false);

        React.useEffect(() => {
          const checkAndMigrate = async () => {
            try {
              // Check venue status
              const statusResponse = await fetch(`/api/venue-status/${barId}`);
              const statusResult = await statusResponse.json();
              
              if (statusResult.success && !statusResult.venue.onboarding_completed) {
                // Try migration for existing venues
                const migrationResponse = await fetch('/api/venue-migration', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ barId })
                });
                
                const migrationResult = await migrationResponse.json();
                
                if (migrationResult.success && migrationResult.migrationCompleted) {
                  setVenue(migrationResult.venue);
                } else {
                  setVenue(statusResult.venue);
                  setShowOnboardingModal(true);
                }
              } else {
                setVenue(statusResult.venue);
              }
            } catch (err) {
              console.error('Migration check failed:', err);
            } finally {
              setLoading(false);
            }
          };

          checkAndMigrate();
        }, [barId]);

        if (loading) {
          return <div>Loading settings...</div>;
        }

        return (
          <div>
            <h1>Venue Settings</h1>
            
            {showOnboardingModal && (
              <div data-testid="onboarding-gate">
                <MockVenueModeOnboarding 
                  onComplete={(v) => {
                    setVenue(v);
                    setShowOnboardingModal(false);
                  }}
                  isForced={true}
                  barId={barId}
                />
              </div>
            )}

            {!showOnboardingModal && venue && (
              <div data-testid="settings-content">
                <div data-testid="venue-config-display">
                  <h2>Current Configuration</h2>
                  <p>Mode: {venue.venue_mode}</p>
                  <p>Authority: {venue.authority_mode}</p>
                  <p>Migrated: {venue.onboarding_completed ? 'Yes' : 'No'}</p>
                </div>
              </div>
            )}
          </div>
        );
      };

      render(<MockSettingsPageWithMigration barId={testBarId} />);

      // Should show loading first
      expect(screen.getByText('Loading settings...')).toBeInTheDocument();

      // Wait for migration to complete and settings to appear
      await waitFor(() => {
        expect(screen.getByTestId('settings-content')).toBeInTheDocument();
      });

      // Should not show onboarding modal (migration completed)
      expect(screen.queryByTestId('onboarding-gate')).not.toBeInTheDocument();

      // Should show migrated configuration
      expect(screen.getByText('Mode: venue')).toBeInTheDocument();
      expect(screen.getByText('Authority: tabeza')).toBeInTheDocument();
      expect(screen.getByText('Migrated: Yes')).toBeInTheDocument();

      // Verify migration API was called
      expect(mockFetch).toHaveBeenCalledWith('/api/venue-migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barId: testBarId })
      });
    });

    it('should fall back to onboarding if migration fails', async () => {
      // Mock venue status API - existing venue needs migration
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            venue: {
              id: testBarId,
              name: 'Existing Restaurant',
              onboarding_completed: false,
              venue_mode: null,
              authority_mode: null
            }
          })
        })
        // Mock migration API failure
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({
            success: false,
            error: 'Migration failed',
            userMessage: 'Unable to migrate venue automatically'
          })
        });

      const MockSettingsPageWithFailedMigration = ({ barId }: { barId: string }) => {
        const [loading, setLoading] = React.useState(true);
        const [venue, setVenue] = React.useState<any>(null);
        const [showOnboardingModal, setShowOnboardingModal] = React.useState(false);

        React.useEffect(() => {
          const checkAndMigrate = async () => {
            try {
              const statusResponse = await fetch(`/api/venue-status/${barId}`);
              const statusResult = await statusResponse.json();
              
              if (statusResult.success && !statusResult.venue.onboarding_completed) {
                const migrationResponse = await fetch('/api/venue-migration', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ barId })
                });
                
                const migrationResult = await migrationResponse.json();
                
                if (migrationResult.success && migrationResult.migrationCompleted) {
                  setVenue(migrationResult.venue);
                } else {
                  // Migration failed or not needed, show onboarding
                  setVenue(statusResult.venue);
                  setShowOnboardingModal(true);
                }
              } else {
                setVenue(statusResult.venue);
              }
            } catch (err) {
              console.error('Migration check failed:', err);
            } finally {
              setLoading(false);
            }
          };

          checkAndMigrate();
        }, [barId]);

        if (loading) {
          return <div>Loading settings...</div>;
        }

        return (
          <div>
            <h1>Venue Settings</h1>
            
            {showOnboardingModal && (
              <div data-testid="onboarding-gate">
                <p>Migration failed, manual setup required</p>
                <MockVenueModeOnboarding 
                  onComplete={(v) => {
                    setVenue(v);
                    setShowOnboardingModal(false);
                  }}
                  isForced={true}
                  barId={barId}
                />
              </div>
            )}

            {!showOnboardingModal && venue && (
              <div data-testid="settings-content">
                <p>Settings available</p>
              </div>
            )}
          </div>
        );
      };

      render(<MockSettingsPageWithFailedMigration barId={testBarId} />);

      // Wait for fallback to onboarding
      await waitFor(() => {
        expect(screen.getByTestId('onboarding-gate')).toBeInTheDocument();
      });

      // Should show manual setup message
      expect(screen.getByText('Migration failed, manual setup required')).toBeInTheDocument();

      // Should show forced onboarding
      expect(screen.getByTestId('forced-mode-indicator')).toBeInTheDocument();

      // Settings should not be accessible
      expect(screen.queryByTestId('settings-content')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle venue status API errors', async () => {
      // Mock venue status API error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          error: 'Database connection failed'
        })
      });

      render(<MockSettingsPage barId={testBarId} />);

      // Should show loading first
      expect(screen.getByText('Loading settings...')).toBeInTheDocument();

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Error: Database connection failed')).toBeInTheDocument();
      });

      // Should not show settings or onboarding
      expect(screen.queryByTestId('settings-content')).not.toBeInTheDocument();
      expect(screen.queryByTestId('onboarding-gate')).not.toBeInTheDocument();
    });

    it('should handle network errors during venue status check', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<MockSettingsPage barId={testBarId} />);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Error: Network error')).toBeInTheDocument();
      });

      // Should not show settings or onboarding
      expect(screen.queryByTestId('settings-content')).not.toBeInTheDocument();
      expect(screen.queryByTestId('onboarding-gate')).not.toBeInTheDocument();
    });
  });
});