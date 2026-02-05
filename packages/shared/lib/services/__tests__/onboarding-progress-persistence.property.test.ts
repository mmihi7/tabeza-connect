/**
 * Property-Based Tests for Onboarding Progress Persistence
 * 
 * **Property 13: Onboarding Progress Persistence**
 * **Validates: Requirements 7.1, 7.2, 7.4**
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 */

import fc from 'fast-check';
import {
  OnboardingStateManager,
  OnboardingProgress,
  OnboardingStep,
  createOnboardingProgress,
  saveOnboardingProgress,
  restoreOnboardingProgress,
  clearOnboardingProgress
} from '../onboarding-state-management';

// Mock localStorage for testing
interface MockStorage {
  store: Map<string, string>;
  getItem: jest.MockedFunction<(key: string) => string | null>;
  setItem: jest.MockedFunction<(key: string, value: string) => void>;
  removeItem: jest.MockedFunction<(key: string) => void>;
  clear: jest.MockedFunction<() => void>;
}

const mockLocalStorage: MockStorage = {
  store: new Map<string, string>(),
  getItem: jest.fn((key: string): string | null => mockLocalStorage.store.get(key) || null),
  setItem: jest.fn((key: string, value: string): void => {
    mockLocalStorage.store.set(key, value);
  }),
  removeItem: jest.fn((key: string): void => {
    mockLocalStorage.store.delete(key);
  }),
  clear: jest.fn((): void => {
    mockLocalStorage.store.clear();
  })
};

// Mock globalThis.localStorage
Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

describe('Property Tests: Onboarding Progress Persistence', () => {
  beforeEach(() => {
    mockLocalStorage.store.clear();
    jest.clearAllMocks();
  });

  /**
   * Property 13: Onboarding Progress Persistence
   * For any valid onboarding progress, saving and then restoring should yield identical data
   */
  test('Property 13: Onboarding Progress Persistence - Save/Restore Consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid onboarding progress
        fc.record({
          barId: fc.string({ minLength: 1, maxLength: 50 }),
          currentStep: fc.constantFrom(...Object.values(OnboardingStep)),
          venueMode: fc.option(fc.constantFrom('basic' as const, 'venue' as const), { nil: null }),
          authorityMode: fc.option(fc.constantFrom('pos' as const, 'tabeza' as const), { nil: null }),
          venueName: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
          venueLocation: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined })
        }),
        async ({ barId, currentStep, venueMode, authorityMode, venueName, venueLocation }) => {
          // Create progress with generated data
          const originalProgress = createOnboardingProgress(barId);
          originalProgress.currentStep = currentStep;
          originalProgress.venueMode = venueMode;
          originalProgress.authorityMode = authorityMode;
          originalProgress.venueInfo = {
            name: venueName || '',
            location: venueLocation || ''
          };

          // Save progress
          await saveOnboardingProgress(originalProgress);

          // Restore progress
          const restoredProgress = await restoreOnboardingProgress(barId);

          // Verify restoration
          expect(restoredProgress).not.toBeNull();
          expect(restoredProgress!.barId).toBe(originalProgress.barId);
          expect(restoredProgress!.currentStep).toBe(originalProgress.currentStep);
          expect(restoredProgress!.venueMode).toBe(originalProgress.venueMode);
          expect(restoredProgress!.authorityMode).toBe(originalProgress.authorityMode);
          expect(restoredProgress!.venueInfo.name).toBe(originalProgress.venueInfo.name);
          expect(restoredProgress!.venueInfo.location).toBe(originalProgress.venueInfo.location);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Progress Expiry Handling
   * Expired progress should not be restored
   */
  test('Property: Progress Expiry Handling', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (barId) => {
          // Create progress that's already expired
          const expiredProgress = createOnboardingProgress(barId);
          expiredProgress.expiresAt = new Date(Date.now() - 1000); // 1 second ago

          // Save expired progress
          await saveOnboardingProgress(expiredProgress);

          // Try to restore - should return null for expired progress
          const restoredProgress = await restoreOnboardingProgress(barId);

          expect(restoredProgress).toBeNull();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Step Transition Validation
   * Invalid step transitions should be rejected
   */
  test('Property: Step Transition Validation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom(...Object.values(OnboardingStep)),
        fc.constantFrom(...Object.values(OnboardingStep)),
        (barId, fromStep, toStep) => {
          const progress = createOnboardingProgress(barId);
          progress.currentStep = fromStep;

          // Define invalid transitions (transitions that should throw errors)
          const invalidTransitions = new Set([
            // Cannot go backwards or skip steps
            `${OnboardingStep.COMPLETE}-${OnboardingStep.WELCOME}`,
            `${OnboardingStep.COMPLETE}-${OnboardingStep.BASIC_INFO}`,
            `${OnboardingStep.COMPLETE}-${OnboardingStep.POS_DECISION}`,
            `${OnboardingStep.COMPLETE}-${OnboardingStep.MPESA_SETUP}`,
            `${OnboardingStep.COMPLETE}-${OnboardingStep.PRINTER_SETUP}`,
            `${OnboardingStep.PRINTER_SETUP}-${OnboardingStep.WELCOME}`,
            `${OnboardingStep.PRINTER_SETUP}-${OnboardingStep.BASIC_INFO}`,
            `${OnboardingStep.PRINTER_SETUP}-${OnboardingStep.POS_DECISION}`,
            `${OnboardingStep.PRINTER_SETUP}-${OnboardingStep.MPESA_SETUP}`,
            `${OnboardingStep.MPESA_SETUP}-${OnboardingStep.WELCOME}`,
            `${OnboardingStep.MPESA_SETUP}-${OnboardingStep.BASIC_INFO}`,
            `${OnboardingStep.MPESA_SETUP}-${OnboardingStep.POS_DECISION}`,
            `${OnboardingStep.POS_DECISION}-${OnboardingStep.WELCOME}`,
            `${OnboardingStep.POS_DECISION}-${OnboardingStep.BASIC_INFO}`,
            `${OnboardingStep.BASIC_INFO}-${OnboardingStep.WELCOME}`,
            // Cannot skip steps
            `${OnboardingStep.WELCOME}-${OnboardingStep.POS_DECISION}`,
            `${OnboardingStep.WELCOME}-${OnboardingStep.MPESA_SETUP}`,
            `${OnboardingStep.WELCOME}-${OnboardingStep.PRINTER_SETUP}`,
            `${OnboardingStep.WELCOME}-${OnboardingStep.COMPLETE}`,
            `${OnboardingStep.BASIC_INFO}-${OnboardingStep.PRINTER_SETUP}`,
            `${OnboardingStep.BASIC_INFO}-${OnboardingStep.COMPLETE}`,
            `${OnboardingStep.POS_DECISION}-${OnboardingStep.PRINTER_SETUP}`,
            `${OnboardingStep.POS_DECISION}-${OnboardingStep.COMPLETE}`
          ]);

          const transitionKey = `${fromStep}-${toStep}`;
          const shouldBeInvalid = invalidTransitions.has(transitionKey);

          if (shouldBeInvalid) {
            // Invalid transitions should throw an error
            expect(() => {
              OnboardingStateManager.updateStep(progress, toStep);
            }).toThrow();
          } else if (fromStep !== toStep) {
            // Valid transitions should succeed
            expect(() => {
              OnboardingStateManager.updateStep(progress, toStep);
            }).not.toThrow();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Core Truth Constraint Validation
   * Basic mode must always have POS authority
   */
  test('Property: Core Truth - Basic Mode Requires POS Authority', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom('pos' as const, 'tabeza' as const),
        (barId, authorityMode) => {
          const progress = createOnboardingProgress(barId);
          progress.venueMode = 'basic';
          progress.authorityMode = authorityMode;

          const validation = OnboardingStateManager.validateProgress(progress);

          if (authorityMode === 'pos') {
            // Basic + POS should be valid (or have other validation errors, but not authority-related)
            const hasAuthorityError = validation.errors.some(e => 
              e.code === 'BASIC_MODE_REQUIRES_POS' || e.field === 'authority_mode'
            );
            expect(hasAuthorityError).toBe(false);
          } else {
            // Basic + Tabeza should be invalid
            const hasAuthorityError = validation.errors.some(e => 
              e.code === 'BASIC_MODE_REQUIRES_POS' || e.field === 'authority_mode'
            );
            expect(hasAuthorityError).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Venue Mode Authority Flexibility
   * Venue mode can use either POS or Tabeza authority
   */
  test('Property: Core Truth - Venue Mode Authority Flexibility', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom('pos' as const, 'tabeza' as const),
        (barId, authorityMode) => {
          const progress = createOnboardingProgress(barId);
          progress.venueMode = 'venue';
          progress.authorityMode = authorityMode;
          progress.venueInfo = { name: 'Test Venue', location: 'Test Location' };

          const validation = OnboardingStateManager.validateProgress(progress);

          // Both POS and Tabeza should be valid for venue mode
          const hasInvalidAuthorityError = validation.errors.some(e => 
            e.code === 'VENUE_MODE_INVALID_AUTHORITY'
          );
          expect(hasInvalidAuthorityError).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Progress Completion Consistency
   * When currentStep is COMPLETE, isComplete should be true
   */
  test('Property: Progress Completion Consistency', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom(...Object.values(OnboardingStep)),
        (barId, step) => {
          const progress = createOnboardingProgress(barId);
          
          if (step === OnboardingStep.COMPLETE) {
            // To reach COMPLETE step, we need to go through valid transitions
            // Let's set up a valid path to COMPLETE
            progress.venueMode = 'basic'; // Basic mode for simplicity
            progress.authorityMode = 'pos'; // Required for basic mode
            progress.venueInfo = { name: 'Test Venue', location: 'Test Location' };
            
            // Go through valid steps to reach COMPLETE
            OnboardingStateManager.updateStep(progress, OnboardingStep.BASIC_INFO);
            OnboardingStateManager.updateStep(progress, OnboardingStep.MPESA_SETUP);
            OnboardingStateManager.updateStep(progress, OnboardingStep.PRINTER_SETUP);
            OnboardingStateManager.updateStep(progress, OnboardingStep.COMPLETE);
            
            expect(progress.isComplete).toBe(true);
            expect(progress.currentStep).toBe(OnboardingStep.COMPLETE);
          } else {
            // Non-complete steps should have isComplete = false
            expect(progress.isComplete).toBe(false);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Clear Progress Completeness
   * After clearing progress, restoration should return null
   */
  test('Property: Clear Progress Completeness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (barId) => {
          // Create and save progress
          const progress = createOnboardingProgress(barId);
          await saveOnboardingProgress(progress);

          // Verify it exists
          const beforeClear = await restoreOnboardingProgress(barId);
          expect(beforeClear).not.toBeNull();

          // Clear progress
          await clearOnboardingProgress(barId);

          // Verify it's gone
          const afterClear = await restoreOnboardingProgress(barId);
          expect(afterClear).toBeNull();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Timestamp Consistency
   * updatedAt should always be >= createdAt
   */
  test('Property: Timestamp Consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom(...Object.values(OnboardingStep)),
        async (barId, newStep) => {
          const progress = createOnboardingProgress(barId);
          const originalCreatedAt = progress.createdAt;
          const originalUpdatedAt = progress.updatedAt;

          // Ensure timestamps are consistent initially
          expect(progress.updatedAt.getTime()).toBeGreaterThanOrEqual(progress.createdAt.getTime());

          // Update step (if valid transition)
          try {
            OnboardingStateManager.updateStep(progress, newStep);
            
            // After update, updatedAt should be >= createdAt
            expect(progress.updatedAt.getTime()).toBeGreaterThanOrEqual(progress.createdAt.getTime());
            
            // createdAt should not change
            expect(progress.createdAt).toEqual(originalCreatedAt);
            
            // updatedAt should be >= original updatedAt
            expect(progress.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
          } catch (error) {
            // Invalid transitions are expected to throw, timestamps should remain unchanged
            expect(progress.createdAt).toEqual(originalCreatedAt);
            expect(progress.updatedAt).toEqual(originalUpdatedAt);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});