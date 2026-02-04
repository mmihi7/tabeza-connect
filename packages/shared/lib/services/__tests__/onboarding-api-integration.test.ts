/**
 * Integration Tests: Complete Onboarding API Workflows
 * Task 11.1: Create integration tests for complete onboarding workflows
 * 
 * Tests complete API integration workflows including:
 * - End-to-end API call sequences for onboarding
 * - API error handling and recovery
 * - Database transaction integrity
 * - Audit logging verification
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

// Mock environment variables
const originalEnv = process.env;

// Mock Supabase client with transaction support
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

describe('Complete Onboarding API Integration Tests', () => {
  let testBarId: string;
  let testUserId: string;
  let testRequestId: string;

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
    testRequestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Complete New Venue Onboarding API Workflows', () => {
    it('should complete Basic mode onboarding with full API integration', async () => {
      const basicConfig = {
        venue_mode: 'basic',
        authority_mode: 'pos'
      };

      const completedVenue = {
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

      // Mock successful database operations
      mockSupabaseClient.from().update().eq().select().single
        .mockResolvedValueOnce({
          data: completedVenue,
          error: null
        });

      // Mock audit log insertion
      mockSupabaseClient.from().insert
        .mockResolvedValueOnce({
          data: null,
          error: null
        });

      // Create API request with full headers
      const request = new NextRequest('http://localhost:3003/api/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          barId: testBarId,
          configuration: basicConfig
        }),
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': testUserId,
          'x-request-id': testRequestId,
          'x-session-id': `session_${Date.now()}`,
          'user-agent': 'Mozilla/5.0 (Test Browser)',
          'x-forwarded-for': '192.168.1.100'
        }
      });

      const response = await OnboardingCompletePOST(request);
      const result = await response.json();

      // Verify successful response
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.venue).toEqual(completedVenue);
      expect(result.message).toBe('Venue setup completed successfully!');

      // Verify database operations were called correctly
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          onboarding_completed: true,
          venue_mode: 'basic',
          authority_mode: 'pos',
          pos_integration_enabled: true,
          printer_required: true,
          authority_configured_at: expect.any(String),
          mode_last_changed_at: expect.any(String)
        })
      );

      // Verify audit logging was called
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith([
        expect.objectContaining({
          bar_id: testBarId,
          action: 'onboarding_completed',
          details: expect.objectContaining({
            venue_mode: 'basic',
            authority_mode: 'pos',
            pos_integration_enabled: true,
            printer_required: true,
            completion_timestamp: expect.any(String),
            user_context: expect.objectContaining({
              user_id: testUserId,
              request_id: testRequestId,
              user_agent: 'Mozilla/5.0 (Test Browser)',
              ip_address: '192.168.1.100'
            })
          })
        })
      ]);
    });

    it('should complete Venue + POS onboarding with constraint enforcement', async () => {
      const venueConfig = {
        venue_mode: 'venue',
        authority_mode: 'pos'
      };

      const completedVenue = {
        id: testBarId,
        name: 'Test Restaurant',
        onboarding_completed: true,
        venue_mode: 'venue',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false, // Venue mode doesn't require printer
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
          configuration: venueConfig
        }),
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': testUserId,
          'x-request-id': testRequestId
        }
      });

      const response = await OnboardingCompletePOST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.venue.venue_mode).toBe('venue');
      expect(result.venue.authority_mode).toBe('pos');
      expect(result.venue.pos_integration_enabled).toBe(true);
      expect(result.venue.printer_required).toBe(false);

      // Verify Core Truth constraints are enforced
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          venue_mode: 'venue',
          authority_mode: 'pos',
          pos_integration_enabled: true, // POS authority enables integration
          printer_required: false // Venue mode doesn't require printer
        })
      );
    });

    it('should complete Venue + Tabeza onboarding with correct configuration', async () => {
      const venueConfig = {
        venue_mode: 'venue',
        authority_mode: 'tabeza'
      };

      const completedVenue = {
        id: testBarId,
        name: 'Test Restaurant',
        onboarding_completed: true,
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false, // Tabeza authority disables POS integration
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

      const request = new NextRequest('http://localhost:3003/api/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          barId: testBarId,
          configuration: venueConfig
        }),
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': testUserId
        }
      });

      const response = await OnboardingCompletePOST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.venue.venue_mode).toBe('venue');
      expect(result.venue.authority_mode).toBe('tabeza');
      expect(result.venue.pos_integration_enabled).toBe(false);
      expect(result.venue.printer_required).toBe(false);

      // Verify Tabeza authority configuration
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          venue_mode: 'venue',
          authority_mode: 'tabeza',
          pos_integration_enabled: false, // Tabeza authority disables POS
          printer_required: false
        })
      );
    });

    it('should reject invalid configuration combinations', async () => {
      // Invalid: Basic mode with Tabeza authority
      const invalidConfig = {
        venue_mode: 'basic',
        authority_mode: 'tabeza'
      };

      const request = new NextRequest('http://localhost:3003/api/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          barId: testBarId,
          configuration: invalidConfig
        }),
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': testUserId,
          'x-request-id': testRequestId
        }
      });

      const response = await OnboardingCompletePOST(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid configuration');
      expect(result.error).toContain('Basic mode requires POS authority');

      // Verify no database operations were performed
      expect(mockSupabaseClient.from().update).not.toHaveBeenCalled();

      // Verify validation failure was logged
      expect(console.error).toHaveBeenCalledWith(
        '❌ Onboarding completion failed:',
        expect.stringContaining('Invalid configuration')
      );
    });
  });

  describe('Existing Venue Migration API Workflows', () => {
    it('should complete venue migration with full API integration', async () => {
      const existingVenue = {
        id: testBarId,
        name: 'Existing Restaurant',
        onboarding_completed: false,
        venue_mode: null,
        authority_mode: null,
        pos_integration_enabled: null,
        printer_required: null,
        created_at: '2023-01-01T00:00:00Z'
      };

      const migratedVenue = {
        ...existingVenue,
        onboarding_completed: true,
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false,
        authority_configured_at: new Date().toISOString(),
        mode_last_changed_at: new Date().toISOString()
      };

      // Mock initial venue lookup
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: existingVenue,
          error: null
        })
        // Mock post-migration lookup
        .mockResolvedValueOnce({
          data: migratedVenue,
          error: null
        });

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

      // Mock audit log insertion
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
          'x-user-id': testUserId,
          'x-request-id': testRequestId
        }
      });

      const response = await VenueMigrationPOST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.migrationNeeded).toBe(true);
      expect(result.migrationCompleted).toBe(true);
      expect(result.venue).toEqual(migratedVenue);
      expect(result.message).toBe('Venue migration completed successfully');

      // Verify migration function was called
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'migrate_existing_venue',
        { target_bar_id: testBarId }
      );

      // Verify audit logging
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith([
        expect.objectContaining({
          bar_id: testBarId,
          action: 'venue_migrated',
          details: expect.objectContaining({
            migration_type: 'existing_venue_default_config',
            venue_mode: 'venue',
            authority_mode: 'tabeza',
            pos_integration_enabled: false,
            printer_required: false
          })
        })
      ]);
    });

    it('should handle venue that does not need migration', async () => {
      const configuredVenue = {
        id: testBarId,
        name: 'Already Configured Restaurant',
        onboarding_completed: true,
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true
      };

      // Mock venue lookup - already configured
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: configuredVenue,
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
      expect(result.migrationNeeded).toBe(false);
      expect(result.venue).toEqual(configuredVenue);
      expect(result.message).toBe('Venue does not need migration');

      // Verify migration function was not called
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();

      // Verify no audit logging for unnecessary migration
      expect(mockSupabaseClient.from().insert).not.toHaveBeenCalled();
    });

    it('should handle migration function failures with proper error handling', async () => {
      const existingVenue = {
        id: testBarId,
        name: 'Existing Restaurant',
        onboarding_completed: false,
        venue_mode: null,
        authority_mode: null
      };

      // Mock venue lookup
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: existingVenue,
          error: null
        });

      // Mock migration function failure
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { 
          message: 'Migration function failed: constraint violation',
          code: 'FUNCTION_ERROR'
        }
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

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Migration function failed');
      expect(result.userMessage).toContain('migrate venue configuration');
      expect(result.canRetry).toBe(true);

      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        '❌ Venue migration failed:',
        expect.stringContaining('Migration function failed')
      );
    });
  });

  describe('Configuration Change API Workflows', () => {
    it('should complete configuration change with full validation', async () => {
      const currentVenue = {
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

      const newConfig = {
        venue_mode: 'venue',
        authority_mode: 'pos'
      };

      const updatedVenue = {
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
          'x-request-id': testRequestId,
          'x-session-id': `session_${Date.now()}`
        }
      });

      const response = await VenueConfigUpdatePOST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.venue).toEqual(updatedVenue);
      expect(result.message).toBe('Venue configuration updated successfully!');

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
            change_reason: 'User requested POS integration',
            user_context: expect.objectContaining({
              user_id: testUserId,
              request_id: testRequestId
            })
          })
        })
      ]);
    });

    it('should prevent configuration changes for incomplete venues', async () => {
      const incompleteVenue = {
        id: testBarId,
        name: 'Incomplete Restaurant',
        onboarding_completed: false,
        venue_mode: null,
        authority_mode: null
      };

      // Mock venue lookup - incomplete venue
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: incompleteVenue,
          error: null
        });

      const request = new NextRequest('http://localhost:3003/api/venue-configuration/update', {
        method: 'POST',
        body: JSON.stringify({
          barId: testBarId,
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

      const response = await VenueConfigUpdatePOST(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Venue must complete onboarding first');
      expect(result.userMessage).toBe('Please complete the initial venue setup before making configuration changes.');

      // Verify no configuration update was attempted
      expect(mockSupabaseClient.from().update).not.toHaveBeenCalled();
    });

    it('should validate configuration changes against Core Truth constraints', async () => {
      const currentVenue = {
        id: testBarId,
        name: 'Test Restaurant',
        onboarding_completed: true,
        venue_mode: 'venue',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false
      };

      // Invalid change: Basic mode with Tabeza authority
      const invalidConfig = {
        venue_mode: 'basic',
        authority_mode: 'tabeza'
      };

      // Mock venue lookup
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: currentVenue,
          error: null
        });

      const request = new NextRequest('http://localhost:3003/api/venue-configuration/update', {
        method: 'POST',
        body: JSON.stringify({
          barId: testBarId,
          configuration: invalidConfig
        }),
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': testUserId
        }
      });

      const response = await VenueConfigUpdatePOST(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid configuration change');
      expect(result.error).toContain('Basic mode requires POS authority');

      // Verify no update was performed
      expect(mockSupabaseClient.from().update).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling and Recovery API Workflows', () => {
    it('should handle database connection failures with proper error responses', async () => {
      const config = {
        venue_mode: 'basic',
        authority_mode: 'pos'
      };

      // Mock database connection failure
      mockSupabaseClient.from().update().eq().select().single
        .mockResolvedValueOnce({
          data: null,
          error: { 
            message: 'Connection timeout',
            code: 'CONNECTION_ERROR'
          }
        });

      const request = new NextRequest('http://localhost:3003/api/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          barId: testBarId,
          configuration: config
        }),
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': testUserId,
          'x-request-id': testRequestId
        }
      });

      const response = await OnboardingCompletePOST(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection timeout');
      expect(result.canRetry).toBe(true);
      expect(result.userMessage).toContain('Your progress has been saved');

      // Verify error was logged with context
      expect(console.error).toHaveBeenCalledWith(
        '❌ Onboarding completion failed:',
        expect.stringContaining('Connection timeout')
      );
    });

    it('should handle malformed request data gracefully', async () => {
      const request = new NextRequest('http://localhost:3003/api/onboarding/complete', {
        method: 'POST',
        body: 'invalid json',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': testUserId
        }
      });

      const response = await OnboardingCompletePOST(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected token');
      expect(result.userMessage).toBe('An unexpected error occurred during venue setup. Please try again or contact support if the problem persists.');
      expect(result.canRetry).toBe(true);
    });

    it('should handle missing required parameters', async () => {
      const request = new NextRequest('http://localhost:3003/api/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          // Missing barId
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

    it('should handle audit logging failures gracefully', async () => {
      const config = {
        venue_mode: 'basic',
        authority_mode: 'pos'
      };

      const completedVenue = {
        id: testBarId,
        name: 'Test Restaurant',
        onboarding_completed: true,
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true
      };

      // Mock successful venue update
      mockSupabaseClient.from().update().eq().select().single
        .mockResolvedValueOnce({
          data: completedVenue,
          error: null
        });

      // Mock audit logging failure
      mockSupabaseClient.from().insert
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Audit log insertion failed' }
        });

      const request = new NextRequest('http://localhost:3003/api/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          barId: testBarId,
          configuration: config
        }),
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': testUserId
        }
      });

      const response = await OnboardingCompletePOST(request);
      const result = await response.json();

      // Should still succeed even if audit logging fails
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.venue).toEqual(completedVenue);

      // Should log the audit failure as a warning
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Audit logging failed'),
        expect.any(Object)
      );
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle concurrent onboarding requests for the same venue', async () => {
      const config = {
        venue_mode: 'basic',
        authority_mode: 'pos'
      };

      const completedVenue = {
        id: testBarId,
        name: 'Test Restaurant',
        onboarding_completed: true,
        venue_mode: 'basic',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: true
      };

      // Mock first request succeeds
      mockSupabaseClient.from().update().eq().select().single
        .mockResolvedValueOnce({
          data: completedVenue,
          error: null
        })
        // Mock second request gets constraint violation (already completed)
        .mockResolvedValueOnce({
          data: null,
          error: { 
            message: 'Venue already completed onboarding',
            code: '23505' // Unique constraint violation
          }
        });

      mockSupabaseClient.from().insert
        .mockResolvedValue({
          data: null,
          error: null
        });

      // Create two concurrent requests
      const request1 = new NextRequest('http://localhost:3003/api/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          barId: testBarId,
          configuration: config
        }),
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': testUserId,
          'x-request-id': `${testRequestId}_1`
        }
      });

      const request2 = new NextRequest('http://localhost:3003/api/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          barId: testBarId,
          configuration: config
        }),
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': testUserId,
          'x-request-id': `${testRequestId}_2`
        }
      });

      // Execute requests concurrently
      const [response1, response2] = await Promise.all([
        OnboardingCompletePOST(request1),
        OnboardingCompletePOST(request2)
      ]);

      const [result1, result2] = await Promise.all([
        response1.json(),
        response2.json()
      ]);

      // First request should succeed
      expect(response1.status).toBe(200);
      expect(result1.success).toBe(true);

      // Second request should fail gracefully
      expect(response2.status).toBe(500);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('already completed');
    });
  });
});