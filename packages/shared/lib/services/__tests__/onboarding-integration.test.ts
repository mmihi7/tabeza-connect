/**
 * Integration Tests: Complete Onboarding Workflows
 * Task 11.1: Create integration tests for complete onboarding workflows
 * 
 * Tests complete end-to-end onboarding workflows including:
 * - New venue onboarding from start to finish
 * - Existing venue migration scenarios
 * - Configuration change workflows
 * - Error handling and recovery scenarios
 * - Audit logging integration
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 */

import { NextRequest } from 'next/server';

// Import API route handlers for integration testing
import { POST as OnboardingCompletePOST } from '../../../../../apps/staff/app/api/onboarding/complete/route';
import { POST as VenueConfigUpdatePOST } from '../../../../../apps/staff/app/api/venue-configuration/update/route';
import { POST as VenueMigrationPOST } from '../../../../../apps/staff/app/api/venue-migration/route';

// Import services for direct testing
import {
  checkOnboardingStatus,
  completeOnboarding,
  updateVenueConfiguration,
  migrateExistingVenue,
  saveOnboardingProgress,
  restoreOnboardingProgress,
  clearOnboardingProgress,
  validateOnboardingPrerequisites,
  type OnboardingProgress,
  type VenueData,
  type VenueConfigurationInput
} from '../onboarding-operations';

import { logOnboardingCompletion, logConfigurationChange } from '../audit-logger';

// Mock environment variables
const originalEnv = process.env;

// Mock localStorage for progress persistence tests
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        limit: jest.fn(),
        in: jest.fn(() => ({
          limit: jest.fn()
        }))
      })),
      in: jest.fn(() => ({
        order: jest.fn(() => ({
          limit: jest.fn()
        }))
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    }))
  })),
  rpc: jest.fn()
};

// Mock the Supabase imports
jest.mock('../../../../../apps/staff/lib/supabase', () => ({
  supabase: mockSupabaseClient
}));

// Mock the shared services
jest.mock('../database-error-handler', () => ({
  withOnboardingErrorHandling: jest.fn((operation) => operation()),
  withVenueConfigErrorHandling: jest.fn((operation) => operation()),
  withMigrationErrorHandling: jest.fn((operation) => operation()),
  createUserErrorMessage: jest.fn((result, fallback) => result.userMessage || result.error || fallback),
  isTemporaryError: jest.fn((result) => result.shouldRetry === true)
}));

jest.mock('../audit-logger', () => ({
  logOnboardingCompletion: jest.fn(),
  logConfigurationChange: jest.fn(),
  logOnboardingFailure: jest.fn(),
  logValidationFailure: jest.fn()
}));

describe('Complete Onboarding Workflows Integration Tests', () => {
  let testBarId: string;
  let testUserId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up test environment
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SECRET_KEY: 'test-secret-key'
    };

    // Generate test IDs
    testBarId = `bar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    testUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Clear localStorage mocks
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.removeItem.mockClear();

    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('New Venue Onboarding Workflows', () => {
    describe('Basic Mode Onboarding Flow', () => {
      it('should complete full Basic mode onboarding workflow', async () => {
        // Step 1: Check initial onboarding status
        const initialVenue: VenueData = {
          id: testBarId,
          name: 'Test Restaurant',
          onboarding_completed: false,
          venue_mode: null,
          authority_mode: null,
          pos_integration_enabled: null,
          printer_required: null,
          active: true
        };

        mockSupabaseClient.from().select().eq().single
          .mockResolvedValueOnce({
            data: initialVenue,
            error: null
          });

        const statusResult = await checkOnboardingStatus(mockSupabaseClient, testBarId);
        
        expect(statusResult.success).toBe(true);
        expect(statusResult.data?.needsOnboarding).toBe(true);
        expect(statusResult.data?.venue).toEqual(initialVenue);

        // Step 2: Validate prerequisites
        mockSupabaseClient.from().select().eq().single
          .mockResolvedValueOnce({
            data: {
              id: testBarId,
              name: 'Test Restaurant',
              active: true
            },
            error: null
          });

        const prerequisitesResult = await validateOnboardingPrerequisites(mockSupabaseClient, testBarId);
        
        expect(prerequisitesResult.success).toBe(true);
        expect(prerequisitesResult.data?.canProceed).toBe(true);
        expect(prerequisitesResult.data?.issues).toHaveLength(0);

        // Step 3: Save progress during onboarding
        const progress: OnboardingProgress = {
          step: 'mode',
          selectedMode: 'basic',
          selectedAuthority: null,
          timestamp: Date.now(),
          barId: testBarId
        };

        saveOnboardingProgress(progress);
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          `tabeza_onboarding_progress_${testBarId}`,
          JSON.stringify(progress)
        );

        // Step 4: Complete onboarding with Basic mode configuration
        const basicConfig: VenueConfigurationInput = {
          venue_mode: 'basic',
          authority_mode: 'pos'
        };

        const completedVenue: VenueData = {
          ...initialVenue,
          onboarding_completed: true,
          venue_mode: 'basic',
          authority_mode: 'pos',
          pos_integration_enabled: true,
          printer_required: true,
          authority_configured_at: new Date().toISOString(),
          mode_last_changed_at: new Date().toISOString()
        };

        mockSupabaseClient.from().update().eq().select().single
          .mockResolvedValueOnce({
            data: completedVenue,
            error: null
          });

        mockSupabaseClient.from().insert
          .mockResolvedValueOnce({
            data: null,
            error: null
          });

        const completionResult = await completeOnboarding(
          mockSupabaseClient,
          testBarId,
          basicConfig
        );

        expect(completionResult.success).toBe(true);
        expect(completionResult.data).toEqual(completedVenue);

        // Verify audit logging
        expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith([
          expect.objectContaining({
            bar_id: testBarId,
            action: 'onboarding_completed',
            details: expect.objectContaining({
              venue_mode: 'basic',
              authority_mode: 'pos',
              pos_integration_enabled: true,
              printer_required: true
            })
          })
        ]);

        // Step 5: Clear progress after successful completion
        clearOnboardingProgress(testBarId);
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
          `tabeza_onboarding_progress_${testBarId}`
        );

        // Step 6: Verify final status
        mockSupabaseClient.from().select().eq().single
          .mockResolvedValueOnce({
            data: completedVenue,
            error: null
          });

        const finalStatusResult = await checkOnboardingStatus(mockSupabaseClient, testBarId);
        
        expect(finalStatusResult.success).toBe(true);
        expect(finalStatusResult.data?.needsOnboarding).toBe(false);
        expect(finalStatusResult.data?.venue.onboarding_completed).toBe(true);
        expect(finalStatusResult.data?.venue.venue_mode).toBe('basic');
        expect(finalStatusResult.data?.venue.authority_mode).toBe('pos');
      });

      it('should complete Basic mode onboarding via API endpoint', async () => {
        const basicConfig = {
          venue_mode: 'basic',
          authority_mode: 'pos'
        };

        const completedVenue: VenueData = {
          id: testBarId,
          name: 'Test Restaurant',
          onboarding_completed: true,
          venue_mode: 'basic',
          authority_mode: 'pos',
          pos_integration_enabled: true,
          printer_required: true,
          authority_configured_at: new Date().toISOString(),
          mode_last_changed_at: new Date().toISOString()
        };

        mockSupabaseClient.from().update().eq().select().single
          .mockResolvedValueOnce({
            data: completedVenue,
            error: null
          });

        mockSupabaseClient.from().insert
          .mockResolvedValueOnce({
            data: null,
            error: null
          });

        const request = new NextRequest('http://localhost:3003/api/onboarding/complete', {
          method: 'POST',
          body: JSON.stringify({
            barId: testBarId,
            configuration: basicConfig
          }),
          headers: { 
            'Content-Type': 'application/json',
            'x-user-id': testUserId,
            'x-request-id': `req_${Date.now()}`
          }
        });

        const response = await OnboardingCompletePOST(request);
        const result = await response.json();

        expect(response.status).toBe(200);
        expect(result.success).toBe(true);
        expect(result.venue).toEqual(completedVenue);
        expect(result.message).toBe('Venue setup completed successfully!');
      });
    });

    describe('Venue Mode Onboarding Flows', () => {
      it('should complete Venue + POS authority onboarding workflow', async () => {
        // Step 1: Progress through onboarding steps
        const modeProgress: OnboardingProgress = {
          step: 'mode',
          selectedMode: 'venue',
          selectedAuthority: null,
          timestamp: Date.now(),
          barId: testBarId
        };

        saveOnboardingProgress(modeProgress);

        const authorityProgress: OnboardingProgress = {
          step: 'authority',
          selectedMode: 'venue',
          selectedAuthority: 'pos',
          timestamp: Date.now(),
          barId: testBarId
        };

        saveOnboardingProgress(authorityProgress);

        const summaryProgress: OnboardingProgress = {
          step: 'summary',
          selectedMode: 'venue',
          selectedAuthority: 'pos',
          timestamp: Date.now(),
          barId: testBarId
        };

        saveOnboardingProgress(summaryProgress);

        expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(3);

        // Step 2: Complete onboarding
        const venueConfig: VenueConfigurationInput = {
          venue_mode: 'venue',
          authority_mode: 'pos'
        };

        const completedVenue: VenueData = {
          id: testBarId,
          name: 'Test Restaurant',
          onboarding_completed: true,
          venue_mode: 'venue',
          authority_mode: 'pos',
          pos_integration_enabled: true,
          printer_required: false,
          authority_configured_at: new Date().toISOString(),
          mode_last_changed_at: new Date().toISOString()
        };

        mockSupabaseClient.from().update().eq().select().single
          .mockResolvedValueOnce({
            data: completedVenue,
            error: null
          });

        mockSupabaseClient.from().insert
          .mockResolvedValueOnce({
            data: null,
            error: null
          });

        const completionResult = await completeOnboarding(
          mockSupabaseClient,
          testBarId,
          venueConfig
        );

        expect(completionResult.success).toBe(true);
        expect(completionResult.data?.venue_mode).toBe('venue');
        expect(completionResult.data?.authority_mode).toBe('pos');
        expect(completionResult.data?.pos_integration_enabled).toBe(true);
        expect(completionResult.data?.printer_required).toBe(false);
      });

      it('should complete Venue + Tabeza authority onboarding workflow', async () => {
        const venueConfig: VenueConfigurationInput = {
          venue_mode: 'venue',
          authority_mode: 'tabeza'
        };

        const completedVenue: VenueData = {
          id: testBarId,
          name: 'Test Restaurant',
          onboarding_completed: true,
          venue_mode: 'venue',
          authority_mode: 'tabeza',
          pos_integration_enabled: false,
          printer_required: false,
          authority_configured_at: new Date().toISOString(),
          mode_last_changed_at: new Date().toISOString()
        };

        mockSupabaseClient.from().update().eq().select().single
          .mockResolvedValueOnce({
            data: completedVenue,
            error: null
          });

        mockSupabaseClient.from().insert
          .mockResolvedValueOnce({
            data: null,
            error: null
          });

        const completionResult = await completeOnboarding(
          mockSupabaseClient,
          testBarId,
          venueConfig
        );

        expect(completionResult.success).toBe(true);
        expect(completionResult.data?.venue_mode).toBe('venue');
        expect(completionResult.data?.authority_mode).toBe('tabeza');
        expect(completionResult.data?.pos_integration_enabled).toBe(false);
        expect(completionResult.data?.printer_required).toBe(false);
      });
    });

    describe('Progress Persistence Integration', () => {
      it('should restore and continue onboarding from saved progress', async () => {
        // Step 1: Save progress at authority selection step
        const savedProgress: OnboardingProgress = {
          step: 'authority',
          selectedMode: 'venue',
          selectedAuthority: null,
          timestamp: Date.now() - 1000, // 1 second ago
          barId: testBarId
        };

        mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedProgress));

        // Step 2: Restore progress
        const restoredProgress = restoreOnboardingProgress(testBarId);
        
        expect(restoredProgress).toEqual(savedProgress);
        expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
          `tabeza_onboarding_progress_${testBarId}`
        );

        // Step 3: Continue from restored progress
        const updatedProgress: OnboardingProgress = {
          ...savedProgress,
          selectedAuthority: 'tabeza',
          step: 'summary',
          timestamp: Date.now()
        };

        saveOnboardingProgress(updatedProgress);

        // Step 4: Complete onboarding
        const venueConfig: VenueConfigurationInput = {
          venue_mode: 'venue',
          authority_mode: 'tabeza'
        };

        const completedVenue: VenueData = {
          id: testBarId,
          name: 'Test Restaurant',
          onboarding_completed: true,
          venue_mode: 'venue',
          authority_mode: 'tabeza',
          pos_integration_enabled: false,
          printer_required: false
        };

        mockSupabaseClient.from().update().eq().select().single
          .mockResolvedValueOnce({
            data: completedVenue,
            error: null
          });

        mockSupabaseClient.from().insert
          .mockResolvedValueOnce({
            data: null,
            error: null
          });

        const completionResult = await completeOnboarding(
          mockSupabaseClient,
          testBarId,
          venueConfig
        );

        expect(completionResult.success).toBe(true);

        // Step 5: Verify progress was cleared
        clearOnboardingProgress(testBarId);
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
          `tabeza_onboarding_progress_${testBarId}`
        );
      });

      it('should handle expired progress gracefully', async () => {
        // Step 1: Mock expired progress (older than 24 hours)
        const expiredProgress: OnboardingProgress = {
          step: 'authority',
          selectedMode: 'venue',
          selectedAuthority: null,
          timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
          barId: testBarId
        };

        mockLocalStorage.getItem.mockReturnValue(JSON.stringify(expiredProgress));

        // Step 2: Attempt to restore expired progress
        const restoredProgress = restoreOnboardingProgress(testBarId);
        
        expect(restoredProgress).toBeNull();
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
          `tabeza_onboarding_progress_${testBarId}`
        );

        // Step 3: Start fresh onboarding
        const freshProgress: OnboardingProgress = {
          step: 'mode',
          selectedMode: null,
          selectedAuthority: null,
          timestamp: Date.now(),
          barId: testBarId
        };

        saveOnboardingProgress(freshProgress);
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          `tabeza_onboarding_progress_${testBarId}`,
          JSON.stringify(freshProgress)
        );
      });
    });
  });

  describe('Existing Venue Migration Scenarios', () => {
    it('should migrate existing venue without configuration', async () => {
      // Step 1: Check venue that needs migration
      const existingVenue: VenueData = {
        id: testBarId,
        name: 'Existing Restaurant',
        onboarding_completed: false,
        venue_mode: null,
        authority_mode: null,
        pos_integration_enabled: null,
        printer_required: null,
        active: true,
        created_at: '2023-01-01T00:00:00Z' // Old venue
      };

      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: existingVenue,
          error: null
        });

      const statusResult = await checkOnboardingStatus(mockSupabaseClient, testBarId);
      
      expect(statusResult.success).toBe(true);
      expect(statusResult.data?.needsOnboarding).toBe(true);

      // Step 2: Perform migration
      const migratedVenue: VenueData = {
        ...existingVenue,
        onboarding_completed: true,
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        authority_configured_at: new Date().toISOString(),
        mode_last_changed_at: new Date().toISOString()
      };

      // Mock migration function call
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: [{
          migration_id: `mig_${Date.now()}`,
          venues_migrated: 1,
          migration_status: 'completed',
          error_message: null
        }],
        error: null
      });

      // Mock post-migration venue lookup
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: migratedVenue,
          error: null
        });

      // Mock audit log insertion
      mockSupabaseClient.from().insert
        .mockResolvedValueOnce({
          data: null,
          error: null
        });

      const migrationResult = await migrateExistingVenue(mockSupabaseClient, testBarId);

      expect(migrationResult.success).toBe(true);
      expect(migrationResult.data?.migrationCompleted).toBe(true);
      expect(migrationResult.data?.venue.onboarding_completed).toBe(true);
      expect(migrationResult.data?.venue.venue_mode).toBe('venue');
      expect(migrationResult.data?.venue.authority_mode).toBe('tabeza');

      // Verify migration was logged
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith([
        expect.objectContaining({
          bar_id: testBarId,
          action: 'venue_migrated',
          details: expect.objectContaining({
            migration_type: 'existing_venue_default_config',
            venue_mode: 'venue',
            authority_mode: 'tabeza'
          })
        })
      ]);
    });

    it('should handle venue that does not need migration', async () => {
      // Step 1: Check venue that already has configuration
      const configuredVenue: VenueData = {
        id: testBarId,
        name: 'Configured Restaurant',
        onboarding_completed: true,
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true,
        active: true
      };

      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: configuredVenue,
          error: null
        });

      const migrationResult = await migrateExistingVenue(mockSupabaseClient, testBarId);

      expect(migrationResult.success).toBe(true);
      expect(migrationResult.data?.migrationCompleted).toBe(false);
      expect(migrationResult.data?.venue).toEqual(configuredVenue);

      // Verify no migration function was called
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });

    it('should complete migration via API endpoint', async () => {
      const existingVenue: VenueData = {
        id: testBarId,
        name: 'Existing Restaurant',
        onboarding_completed: false,
        venue_mode: null,
        authority_mode: null
      };

      const migratedVenue: VenueData = {
        ...existingVenue,
        onboarding_completed: true,
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false
      };

      // Mock initial status check
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: existingVenue,
          error: null
        });

      // Mock migration function
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: [{
          migration_id: `mig_${Date.now()}`,
          venues_migrated: 1,
          migration_status: 'completed',
          error_message: null
        }],
        error: null
      });

      // Mock post-migration lookup
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: migratedVenue,
          error: null
        });

      // Mock audit logging
      mockSupabaseClient.from().insert
        .mockResolvedValueOnce({
          data: null,
          error: null
        });

      const request = new NextRequest('http://localhost:3003/api/venue-migration', {
        method: 'POST',
        body: JSON.stringify({
          barId: testBarId
        }),
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': testUserId
        }
      });

      const response = await VenueMigrationPOST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.migrationNeeded).toBe(true);
      expect(result.migrationCompleted).toBe(true);
      expect(result.venue).toEqual(migratedVenue);
    });
  });

  describe('Configuration Change Workflows', () => {
    it('should complete configuration change from Venue+Tabeza to Venue+POS', async () => {
      // Step 1: Setup current configuration
      const currentVenue: VenueData = {
        id: testBarId,
        name: 'Test Restaurant',
        onboarding_completed: true,
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        authority_configured_at: '2024-01-01T00:00:00Z',
        mode_last_changed_at: '2024-01-01T00:00:00Z'
      };

      const currentConfig = {
        venue_mode: 'venue' as const,
        authority_mode: 'tabeza' as const,
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true,
        authority_configured_at: '2024-01-01T00:00:00Z',
        mode_last_changed_at: '2024-01-01T00:00:00Z'
      };

      // Step 2: Update configuration
      const newConfig: VenueConfigurationInput = {
        venue_mode: 'venue',
        authority_mode: 'pos'
      };

      const updatedVenue: VenueData = {
        ...currentVenue,
        authority_mode: 'pos',
        pos_integration_enabled: true,
        mode_last_changed_at: new Date().toISOString()
      };

      mockSupabaseClient.from().update().eq().select().single
        .mockResolvedValueOnce({
          data: updatedVenue,
          error: null
        });

      mockSupabaseClient.from().insert
        .mockResolvedValueOnce({
          data: null,
          error: null
        });

      const updateResult = await updateVenueConfiguration(
        mockSupabaseClient,
        testBarId,
        currentConfig,
        newConfig
      );

      expect(updateResult.success).toBe(true);
      expect(updateResult.data?.authority_mode).toBe('pos');
      expect(updateResult.data?.pos_integration_enabled).toBe(true);

      // Verify configuration change was logged
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith([
        expect.objectContaining({
          bar_id: testBarId,
          action: 'venue_configuration_changed',
          details: expect.objectContaining({
            previous_config: expect.objectContaining({
              authority_mode: 'tabeza',
              pos_integration_enabled: false
            }),
            new_config: expect.objectContaining({
              authority_mode: 'pos',
              pos_integration_enabled: true
            })
          })
        })
      ]);
    });

    it('should complete configuration change from Venue to Basic mode', async () => {
      const currentConfig = {
        venue_mode: 'venue' as const,
        authority_mode: 'tabeza' as const,
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

      const updatedVenue: VenueData = {
        id: testBarId,
        name: 'Test Restaurant',
        onboarding_completed: true,
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true,
        mode_last_changed_at: new Date().toISOString()
      };

      mockSupabaseClient.from().update().eq().select().single
        .mockResolvedValueOnce({
          data: updatedVenue,
          error: null
        });

      mockSupabaseClient.from().insert
        .mockResolvedValueOnce({
          data: null,
          error: null
        });

      const updateResult = await updateVenueConfiguration(
        mockSupabaseClient,
        testBarId,
        currentConfig,
        newConfig
      );

      expect(updateResult.success).toBe(true);
      expect(updateResult.data?.venue_mode).toBe('basic');
      expect(updateResult.data?.authority_mode).toBe('pos');
      expect(updateResult.data?.pos_integration_enabled).toBe(true);
      expect(updateResult.data?.printer_required).toBe(true);
    });

    it('should complete configuration change via API endpoint', async () => {
      const currentVenue: VenueData = {
        id: testBarId,
        name: 'Test Restaurant',
        onboarding_completed: true,
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false
      };

      const newConfig = {
        venue_mode: 'venue',
        authority_mode: 'pos'
      };

      const updatedVenue: VenueData = {
        ...currentVenue,
        authority_mode: 'pos',
        pos_integration_enabled: true,
        mode_last_changed_at: new Date().toISOString()
      };

      // Mock current venue lookup
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: currentVenue,
          error: null
        });

      // Mock configuration update
      mockSupabaseClient.from().update().eq().select().single
        .mockResolvedValueOnce({
          data: updatedVenue,
          error: null
        });

      // Mock audit logging
      mockSupabaseClient.from().insert
        .mockResolvedValueOnce({
          data: null,
          error: null
        });

      const request = new NextRequest('http://localhost:3003/api/venue-configuration/update', {
        method: 'POST',
        body: JSON.stringify({
          barId: testBarId,
          configuration: newConfig,
          changeReason: 'User requested POS integration'
        }),
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': testUserId,
          'x-request-id': `req_${Date.now()}`
        }
      });

      const response = await VenueConfigUpdatePOST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.venue).toEqual(updatedVenue);
      expect(result.message).toBe('Venue configuration updated successfully!');
    });
  });

  describe('Error Handling and Recovery Scenarios', () => {
    it('should handle database connection failures during onboarding', async () => {
      const config: VenueConfigurationInput = {
        venue_mode: 'basic',
        authority_mode: 'pos'
      };

      // Mock database connection failure
      mockSupabaseClient.from().update().eq().select().single
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Connection timeout', code: 'CONNECTION_ERROR' }
        });

      const result = await completeOnboarding(mockSupabaseClient, testBarId, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection timeout');
      expect(result.shouldRetry).toBe(true);
    });

    it('should handle validation errors during configuration changes', async () => {
      const currentConfig = {
        venue_mode: 'venue' as const,
        authority_mode: 'pos' as const,
        pos_integration_enabled: true,
        printer_required: false,
        onboarding_completed: true,
        authority_configured_at: '2024-01-01T00:00:00Z',
        mode_last_changed_at: '2024-01-01T00:00:00Z'
      };

      // Invalid configuration: Basic mode with Tabeza authority
      const invalidConfig: VenueConfigurationInput = {
        venue_mode: 'basic',
        authority_mode: 'tabeza'
      };

      const result = await updateVenueConfiguration(
        mockSupabaseClient,
        testBarId,
        currentConfig,
        invalidConfig
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid configuration change');
      expect(result.error).toContain('Basic mode requires POS authority');
      expect(result.shouldRetry).toBe(false);
    });

    it('should handle API validation errors gracefully', async () => {
      const request = new NextRequest('http://localhost:3003/api/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          barId: '', // Missing bar ID
          configuration: {
            venue_mode: 'basic',
            authority_mode: 'pos'
          }
        }),
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': testUserId
        }
      });

      const response = await OnboardingCompletePOST(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Bar ID is required');
      expect(result.userMessage).toBe('Invalid request. Please refresh the page and try again.');
    });

    it('should handle migration function failures', async () => {
      const existingVenue: VenueData = {
        id: testBarId,
        name: 'Existing Restaurant',
        onboarding_completed: false,
        venue_mode: null,
        authority_mode: null
      };

      // Mock initial status check
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: existingVenue,
          error: null
        });

      // Mock migration function failure
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Migration function failed', code: 'FUNCTION_ERROR' }
      });

      const migrationResult = await migrateExistingVenue(mockSupabaseClient, testBarId);

      expect(migrationResult.success).toBe(false);
      expect(migrationResult.error).toContain('Migration function failed');
      expect(migrationResult.shouldRetry).toBe(true);
    });

    it('should handle localStorage errors during progress persistence', async () => {
      // Mock localStorage to throw errors
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const progress: OnboardingProgress = {
        step: 'mode',
        selectedMode: 'basic',
        selectedAuthority: null,
        timestamp: Date.now(),
        barId: testBarId
      };

      // Should not throw error
      expect(() => saveOnboardingProgress(progress)).not.toThrow();
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to save onboarding progress:',
        expect.any(Error)
      );
    });
  });

  describe('Audit Logging Integration', () => {
    it('should log all onboarding completion events', async () => {
      const config: VenueConfigurationInput = {
        venue_mode: 'basic',
        authority_mode: 'pos'
      };

      const completedVenue: VenueData = {
        id: testBarId,
        name: 'Test Restaurant',
        onboarding_completed: true,
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true
      };

      mockSupabaseClient.from().update().eq().select().single
        .mockResolvedValueOnce({
          data: completedVenue,
          error: null
        });

      mockSupabaseClient.from().insert
        .mockResolvedValueOnce({
          data: null,
          error: null
        });

      await completeOnboarding(mockSupabaseClient, testBarId, config);

      // Verify audit log was created
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith([
        expect.objectContaining({
          bar_id: testBarId,
          action: 'onboarding_completed',
          details: expect.objectContaining({
            venue_mode: 'basic',
            authority_mode: 'pos',
            pos_integration_enabled: true,
            printer_required: true,
            completion_timestamp: expect.any(String)
          })
        })
      ]);
    });

    it('should log configuration change events with before/after states', async () => {
      const currentConfig = {
        venue_mode: 'venue' as const,
        authority_mode: 'tabeza' as const,
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

      const updatedVenue: VenueData = {
        id: testBarId,
        name: 'Test Restaurant',
        onboarding_completed: true,
        venue_mode: 'venue',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false
      };

      mockSupabaseClient.from().update().eq().select().single
        .mockResolvedValueOnce({
          data: updatedVenue,
          error: null
        });

      mockSupabaseClient.from().insert
        .mockResolvedValueOnce({
          data: null,
          error: null
        });

      await updateVenueConfiguration(
        mockSupabaseClient,
        testBarId,
        currentConfig,
        newConfig
      );

      // Verify configuration change was logged with before/after states
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith([
        expect.objectContaining({
          bar_id: testBarId,
          action: 'venue_configuration_changed',
          details: expect.objectContaining({
            previous_config: expect.objectContaining({
              authority_mode: 'tabeza',
              pos_integration_enabled: false
            }),
            new_config: expect.objectContaining({
              authority_mode: 'pos',
              pos_integration_enabled: true
            }),
            change_timestamp: expect.any(String)
          })
        })
      ]);
    });

    it('should log migration events with migration details', async () => {
      const existingVenue: VenueData = {
        id: testBarId,
        name: 'Existing Restaurant',
        onboarding_completed: false,
        venue_mode: null,
        authority_mode: null
      };

      const migratedVenue: VenueData = {
        ...existingVenue,
        onboarding_completed: true,
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false
      };

      // Mock initial status check
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: existingVenue,
          error: null
        });

      // Mock migration function
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: [{
          migration_id: `mig_${Date.now()}`,
          venues_migrated: 1,
          migration_status: 'completed',
          error_message: null
        }],
        error: null
      });

      // Mock post-migration lookup
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: migratedVenue,
          error: null
        });

      // Mock audit logging
      mockSupabaseClient.from().insert
        .mockResolvedValueOnce({
          data: null,
          error: null
        });

      await migrateExistingVenue(mockSupabaseClient, testBarId);

      // Verify migration was logged
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith([
        expect.objectContaining({
          bar_id: testBarId,
          action: 'venue_migrated',
          details: expect.objectContaining({
            migration_type: 'existing_venue_default_config',
            venue_mode: 'venue',
            authority_mode: 'tabeza',
            pos_integration_enabled: false,
            printer_required: false,
            migration_timestamp: expect.any(String)
          })
        })
      ]);
    });

    it('should log validation failures with detailed error information', async () => {
      const request = new NextRequest('http://localhost:3003/api/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          barId: testBarId,
          configuration: {
            venue_mode: 'basic',
            authority_mode: 'tabeza' // Invalid combination
          }
        }),
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': testUserId,
          'x-request-id': `req_${Date.now()}`
        }
      });

      const response = await OnboardingCompletePOST(request);
      await response.json();

      expect(response.status).toBe(500);

      // Verify validation failure was logged (mocked)
      // In real implementation, this would be called by the audit logger
      expect(console.error).toHaveBeenCalledWith(
        '❌ Onboarding completion failed:',
        expect.stringContaining('Invalid configuration')
      );
    });
  });

  describe('Core Truth Constraint Enforcement', () => {
    it('should enforce Basic mode requires POS authority', async () => {
      const invalidConfig: VenueConfigurationInput = {
        venue_mode: 'basic',
        authority_mode: 'tabeza'
      };

      const result = await completeOnboarding(mockSupabaseClient, testBarId, invalidConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid configuration');
      expect(result.error).toContain('Basic mode requires POS authority');
    });

    it('should enforce Venue mode allows both POS and Tabeza authority', async () => {
      // Test Venue + POS
      const venuePosConfig: VenueConfigurationInput = {
        venue_mode: 'venue',
        authority_mode: 'pos'
      };

      const completedVenuePOS: VenueData = {
        id: testBarId,
        name: 'Test Restaurant',
        onboarding_completed: true,
        venue_mode: 'venue',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false
      };

      mockSupabaseClient.from().update().eq().select().single
        .mockResolvedValueOnce({
          data: completedVenuePOS,
          error: null
        });

      mockSupabaseClient.from().insert
        .mockResolvedValueOnce({
          data: null,
          error: null
        });

      const posResult = await completeOnboarding(mockSupabaseClient, testBarId, venuePosConfig);
      expect(posResult.success).toBe(true);

      // Test Venue + Tabeza
      const venueTabezaConfig: VenueConfigurationInput = {
        venue_mode: 'venue',
        authority_mode: 'tabeza'
      };

      const completedVenueTabeza: VenueData = {
        id: testBarId,
        name: 'Test Restaurant',
        onboarding_completed: true,
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false
      };

      mockSupabaseClient.from().update().eq().select().single
        .mockResolvedValueOnce({
          data: completedVenueTabeza,
          error: null
        });

      mockSupabaseClient.from().insert
        .mockResolvedValueOnce({
          data: null,
          error: null
        });

      const tabezaResult = await completeOnboarding(mockSupabaseClient, testBarId, venueTabezaConfig);
      expect(tabezaResult.success).toBe(true);
    });

    it('should set correct dependent fields based on configuration', async () => {
      // Test Basic mode sets printer_required=true and pos_integration_enabled=true
      const basicConfig: VenueConfigurationInput = {
        venue_mode: 'basic',
        authority_mode: 'pos'
      };

      const basicVenue: VenueData = {
        id: testBarId,
        name: 'Test Restaurant',
        onboarding_completed: true,
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true
      };

      mockSupabaseClient.from().update().eq().select().single
        .mockResolvedValueOnce({
          data: basicVenue,
          error: null
        });

      mockSupabaseClient.from().insert
        .mockResolvedValueOnce({
          data: null,
          error: null
        });

      const basicResult = await completeOnboarding(mockSupabaseClient, testBarId, basicConfig);
      
      expect(basicResult.success).toBe(true);
      expect(basicResult.data?.pos_integration_enabled).toBe(true);
      expect(basicResult.data?.printer_required).toBe(true);

      // Test Venue + Tabeza sets pos_integration_enabled=false
      const venueTabezaConfig: VenueConfigurationInput = {
        venue_mode: 'venue',
        authority_mode: 'tabeza'
      };

      const venueTabezaVenue: VenueData = {
        id: testBarId,
        name: 'Test Restaurant',
        onboarding_completed: true,
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false
      };

      mockSupabaseClient.from().update().eq().select().single
        .mockResolvedValueOnce({
          data: venueTabezaVenue,
          error: null
        });

      mockSupabaseClient.from().insert
        .mockResolvedValueOnce({
          data: null,
          error: null
        });

      const venueTabezaResult = await completeOnboarding(mockSupabaseClient, testBarId, venueTabezaConfig);
      
      expect(venueTabezaResult.success).toBe(true);
      expect(venueTabezaResult.data?.pos_integration_enabled).toBe(false);
      expect(venueTabezaResult.data?.printer_required).toBe(false);
    });
  });
});