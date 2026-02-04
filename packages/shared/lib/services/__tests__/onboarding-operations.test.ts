/**
 * Onboarding Operations Service Tests
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 */

import {
  checkOnboardingStatus,
  completeOnboarding,
  updateVenueConfiguration,
  migrateExistingVenue,
  saveOnboardingProgress,
  restoreOnboardingProgress,
  clearOnboardingProgress,
  createOnboardingErrorMessage,
  validateOnboardingPrerequisites,
  type OnboardingProgress,
  type VenueData
} from '../onboarding-operations';

// Mock the database error handler
jest.mock('../database-error-handler', () => ({
  withOnboardingErrorHandling: jest.fn((operation, name, context) => operation()),
  withVenueConfigErrorHandling: jest.fn((operation, name, context) => operation()),
  withMigrationErrorHandling: jest.fn((operation, name, context) => operation()),
  createUserErrorMessage: jest.fn((result, fallback) => result.userMessage || result.error || fallback),
  isTemporaryError: jest.fn((result) => result.shouldRetry === true)
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock console methods
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  mockLocalStorage.getItem.mockClear();
  mockLocalStorage.setItem.mockClear();
  mockLocalStorage.removeItem.mockClear();
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

describe('Onboarding Operations Service', () => {
  const mockSupabaseClient = {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      })),
      insert: jest.fn()
    })),
    rpc: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkOnboardingStatus', () => {
    it('should identify venue that needs onboarding', async () => {
      const mockVenue: VenueData = {
        id: '123',
        name: 'Test Venue',
        onboarding_completed: false,
        venue_mode: null,
        authority_mode: null
      };

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockVenue,
        error: null
      });

      const result = await checkOnboardingStatus(mockSupabaseClient, '123');

      expect(result.success).toBe(true);
      expect(result.data?.needsOnboarding).toBe(true);
      expect(result.data?.venue).toEqual(mockVenue);
    });

    it('should identify venue that does not need onboarding', async () => {
      const mockVenue: VenueData = {
        id: '123',
        name: 'Test Venue',
        onboarding_completed: true,
        venue_mode: 'venue',
        authority_mode: 'tabeza'
      };

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockVenue,
        error: null
      });

      const result = await checkOnboardingStatus(mockSupabaseClient, '123');

      expect(result.success).toBe(true);
      expect(result.data?.needsOnboarding).toBe(false);
      expect(result.data?.venue).toEqual(mockVenue);
    });

    it('should handle venue not found error', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await checkOnboardingStatus(mockSupabaseClient, '123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Venue not found');
    });

    it('should handle database errors', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const result = await checkOnboardingStatus(mockSupabaseClient, '123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });
  });

  describe('completeOnboarding', () => {
    it('should complete onboarding with valid configuration', async () => {
      const mockUpdatedVenue: VenueData = {
        id: '123',
        name: 'Test Venue',
        onboarding_completed: true,
        venue_mode: 'venue',
        authority_mode: 'tabeza',
        pos_integration_enabled: false,
        printer_required: false
      };

      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue({
        data: mockUpdatedVenue,
        error: null
      });

      mockSupabaseClient.from().insert.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await completeOnboarding(mockSupabaseClient, '123', {
        venue_mode: 'venue',
        authority_mode: 'tabeza'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdatedVenue);
      
      // Should have logged the completion
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith([
        expect.objectContaining({
          bar_id: '123',
          action: 'onboarding_completed'
        })
      ]);
    });

    it('should reject invalid configuration', async () => {
      const result = await completeOnboarding(mockSupabaseClient, '123', {
        venue_mode: 'basic',
        authority_mode: 'tabeza' // Invalid: Basic mode requires POS authority
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid configuration');
      expect(result.error).toContain('Basic mode requires POS authority');
    });

    it('should handle database update errors', async () => {
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' }
      });

      const result = await completeOnboarding(mockSupabaseClient, '123', {
        venue_mode: 'venue',
        authority_mode: 'tabeza'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Update failed');
    });
  });

  describe('updateVenueConfiguration', () => {
    it('should update venue configuration with valid change', async () => {
      const currentConfig = {
        venue_mode: 'venue' as const,
        authority_mode: 'tabeza' as const,
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: true,
        authority_configured_at: '2024-01-01T00:00:00Z',
        mode_last_changed_at: '2024-01-01T00:00:00Z'
      };

      const mockUpdatedVenue: VenueData = {
        id: '123',
        name: 'Test Venue',
        onboarding_completed: true,
        venue_mode: 'venue',
        authority_mode: 'pos',
        pos_integration_enabled: true,
        printer_required: false
      };

      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue({
        data: mockUpdatedVenue,
        error: null
      });

      mockSupabaseClient.from().insert.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await updateVenueConfiguration(
        mockSupabaseClient,
        '123',
        currentConfig,
        {
          venue_mode: 'venue',
          authority_mode: 'pos'
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdatedVenue);
      
      // Should have logged the configuration change
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith([
        expect.objectContaining({
          bar_id: '123',
          action: 'venue_configuration_changed'
        })
      ]);
    });

    it('should reject invalid configuration changes', async () => {
      const currentConfig = {
        venue_mode: 'venue' as const,
        authority_mode: 'pos' as const,
        pos_integration_enabled: true,
        printer_required: false,
        onboarding_completed: true,
        authority_configured_at: '2024-01-01T00:00:00Z',
        mode_last_changed_at: '2024-01-01T00:00:00Z'
      };

      const result = await updateVenueConfiguration(
        mockSupabaseClient,
        '123',
        currentConfig,
        {
          venue_mode: 'basic',
          authority_mode: 'tabeza' // Invalid combination
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid configuration change');
    });
  });

  describe('migrateExistingVenue', () => {
    it('should migrate venue that needs migration', async () => {
      // Mock checkOnboardingStatus to return needs migration
      const mockVenue: VenueData = {
        id: '123',
        name: 'Test Venue',
        onboarding_completed: false,
        venue_mode: null,
        authority_mode: null
      };

      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: mockVenue,
          error: null
        })
        .mockResolvedValueOnce({
          data: {
            ...mockVenue,
            onboarding_completed: true,
            venue_mode: 'venue',
            authority_mode: 'tabeza',
            pos_integration_enabled: false,
            printer_required: false
          },
          error: null
        });

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{
          migration_id: 'mig_123',
          venues_migrated: 1,
          migration_status: 'completed',
          error_message: null
        }],
        error: null
      });

      mockSupabaseClient.from().insert.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await migrateExistingVenue(mockSupabaseClient, '123');

      expect(result.success).toBe(true);
      expect(result.data?.migrationCompleted).toBe(true);
      expect(result.data?.venue.onboarding_completed).toBe(true);
    });

    it('should handle venue that does not need migration', async () => {
      const mockVenue: VenueData = {
        id: '123',
        name: 'Test Venue',
        onboarding_completed: true,
        venue_mode: 'venue',
        authority_mode: 'tabeza'
      };

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockVenue,
        error: null
      });

      const result = await migrateExistingVenue(mockSupabaseClient, '123');

      expect(result.success).toBe(true);
      expect(result.data?.migrationCompleted).toBe(false);
      expect(result.data?.venue).toEqual(mockVenue);
    });

    it('should handle migration function errors', async () => {
      const mockVenue: VenueData = {
        id: '123',
        name: 'Test Venue',
        onboarding_completed: false,
        venue_mode: null,
        authority_mode: null
      };

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockVenue,
        error: null
      });

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Migration function failed' }
      });

      const result = await migrateExistingVenue(mockSupabaseClient, '123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Migration function failed');
    });
  });

  describe('Progress Management', () => {
    describe('saveOnboardingProgress', () => {
      it('should save progress to localStorage', () => {
        const progress: OnboardingProgress = {
          step: 'authority',
          selectedMode: 'venue',
          selectedAuthority: 'pos',
          timestamp: Date.now(),
          barId: '123'
        };

        saveOnboardingProgress(progress);

        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'tabeza_onboarding_progress_123',
          JSON.stringify(progress)
        );
      });

      it('should handle localStorage errors gracefully', () => {
        mockLocalStorage.setItem.mockImplementation(() => {
          throw new Error('Storage full');
        });

        const progress: OnboardingProgress = {
          step: 'mode',
          selectedMode: null,
          selectedAuthority: null,
          timestamp: Date.now()
        };

        expect(() => saveOnboardingProgress(progress)).not.toThrow();
        expect(console.warn).toHaveBeenCalledWith('Failed to save onboarding progress:', expect.any(Error));
      });
    });

    describe('restoreOnboardingProgress', () => {
      it('should restore valid progress from localStorage', () => {
        const progress: OnboardingProgress = {
          step: 'authority',
          selectedMode: 'venue',
          selectedAuthority: 'pos',
          timestamp: Date.now() - 1000, // 1 second ago
          barId: '123'
        };

        mockLocalStorage.getItem.mockReturnValue(JSON.stringify(progress));

        const restored = restoreOnboardingProgress('123');

        expect(restored).toEqual(progress);
        expect(mockLocalStorage.getItem).toHaveBeenCalledWith('tabeza_onboarding_progress_123');
      });

      it('should return null for expired progress', () => {
        const progress: OnboardingProgress = {
          step: 'mode',
          selectedMode: null,
          selectedAuthority: null,
          timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
          barId: '123'
        };

        mockLocalStorage.getItem.mockReturnValue(JSON.stringify(progress));

        const restored = restoreOnboardingProgress('123');

        expect(restored).toBeNull();
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tabeza_onboarding_progress_123');
      });

      it('should handle corrupted localStorage data', () => {
        mockLocalStorage.getItem.mockReturnValue('invalid json');

        const restored = restoreOnboardingProgress('123');

        expect(restored).toBeNull();
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tabeza_onboarding_progress_123');
        expect(console.warn).toHaveBeenCalledWith('Failed to restore onboarding progress:', expect.any(Error));
      });

      it('should return null when no progress exists', () => {
        mockLocalStorage.getItem.mockReturnValue(null);

        const restored = restoreOnboardingProgress('123');

        expect(restored).toBeNull();
      });
    });

    describe('clearOnboardingProgress', () => {
      it('should clear progress from localStorage', () => {
        clearOnboardingProgress('123');

        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tabeza_onboarding_progress_123');
      });

      it('should handle localStorage errors gracefully', () => {
        mockLocalStorage.removeItem.mockImplementation(() => {
          throw new Error('Storage error');
        });

        expect(() => clearOnboardingProgress('123')).not.toThrow();
        expect(console.warn).toHaveBeenCalledWith('Failed to clear onboarding progress:', expect.any(Error));
      });
    });
  });

  describe('validateOnboardingPrerequisites', () => {
    it('should validate venue with all prerequisites met', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: {
          id: '123',
          name: 'Test Venue',
          active: true
        },
        error: null
      });

      const result = await validateOnboardingPrerequisites(mockSupabaseClient, '123');

      expect(result.success).toBe(true);
      expect(result.data?.canProceed).toBe(true);
      expect(result.data?.issues).toHaveLength(0);
    });

    it('should identify missing venue name', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: {
          id: '123',
          name: '',
          active: true
        },
        error: null
      });

      const result = await validateOnboardingPrerequisites(mockSupabaseClient, '123');

      expect(result.success).toBe(true);
      expect(result.data?.canProceed).toBe(false);
      expect(result.data?.issues).toContain('Venue name is required');
    });

    it('should identify inactive venue', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: {
          id: '123',
          name: 'Test Venue',
          active: false
        },
        error: null
      });

      const result = await validateOnboardingPrerequisites(mockSupabaseClient, '123');

      expect(result.success).toBe(true);
      expect(result.data?.canProceed).toBe(false);
      expect(result.data?.issues).toContain('Venue is inactive');
    });

    it('should handle venue not found', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await validateOnboardingPrerequisites(mockSupabaseClient, '123');

      expect(result.success).toBe(true);
      expect(result.data?.canProceed).toBe(false);
      expect(result.data?.issues).toContain('Venue not found');
    });
  });

  describe('createOnboardingErrorMessage', () => {
    it('should create user-friendly error message for temporary errors', () => {
      const result = {
        success: false,
        error: 'Connection failed',
        userMessage: 'Unable to connect',
        shouldRetry: true
      };

      const message = createOnboardingErrorMessage(result, 'complete setup');

      expect(message).toContain('Unable to connect');
      expect(message).toContain('Your progress has been saved');
    });

    it('should create error message for permanent errors', () => {
      const result = {
        success: false,
        error: 'Invalid data',
        userMessage: 'Invalid configuration',
        shouldRetry: false
      };

      const message = createOnboardingErrorMessage(result, 'save configuration');

      expect(message).toContain('Invalid configuration');
      expect(message).toContain('contact support');
    });

    it('should return empty string for successful results', () => {
      const result = {
        success: true,
        data: { id: '123' }
      };

      const message = createOnboardingErrorMessage(result, 'test operation');

      expect(message).toBe('');
    });
  });
});