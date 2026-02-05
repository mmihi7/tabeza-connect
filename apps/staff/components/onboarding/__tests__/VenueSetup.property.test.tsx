/**
 * Property-Based Tests for VenueSetup Component
 * Feature: onboarding-flow-redesign, Property 6: Venue Setup POS Decision Sequence
 * Validates: Requirements 3.1, 3.2
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fc from 'fast-check';
import VenueSetup from '../VenueSetup';

describe('VenueSetup Property Tests', () => {
  /**
   * Property 6: Venue Setup POS Decision Sequence
   * For any Venue setup flow, after collecting basic information (name and location), 
   * the next step should be the POS system question
   * Validates: Requirements 3.1, 3.2
   */
  it('Property 6: Venue Setup POS Decision Sequence - should follow correct step sequence', () => {
    fc.assert(
      fc.property(
        fc.record({
          venueName: fc.string({ minLength: 1, maxLength: 50 }),
          venueLocation: fc.string({ minLength: 1, maxLength: 50 }),
          testIteration: fc.integer({ min: 1, max: 2 })
        }),
        async (testData) => {
          // Arrange: Mock handlers
          const mockOnComplete = jest.fn();
          const mockOnBack = jest.fn();
          const user = userEvent.setup();

          // Act: Render the component
          render(
            <VenueSetup
              onComplete={mockOnComplete}
              onBack={mockOnBack}
            />
          );

          // Assert: Should start with venue info step
          expect(screen.getByText('Venue Information')).toBeInTheDocument();
          expect(screen.getByText("Let's start with basic information about your venue")).toBeInTheDocument();

          // Assert: Should have venue name and location fields
          expect(screen.getByLabelText(/Venue Name/)).toBeInTheDocument();
          expect(screen.getByLabelText(/Location/)).toBeInTheDocument();

          // Assert: POS decision step should not be visible yet
          expect(screen.queryByText('POS System Integration')).not.toBeInTheDocument();
          expect(screen.queryByText('Do you have an existing POS system?')).not.toBeInTheDocument();

          // Act: Fill venue information
          const venueNameInput = screen.getByLabelText(/Venue Name/);
          const locationInput = screen.getByLabelText(/Location/);
          
          await user.clear(venueNameInput);
          await user.type(venueNameInput, testData.venueName);
          await user.clear(locationInput);
          await user.type(locationInput, testData.venueLocation);

          // Act: Continue to next step
          const continueButton = screen.getByText('Continue');
          await user.click(continueButton);

          // Assert: Should now be on POS decision step
          expect(screen.getByText('POS System Integration')).toBeInTheDocument();
          expect(screen.getByText('Do you have an existing POS system?')).toBeInTheDocument();

          // Assert: Should have exactly two POS options
          expect(screen.getByText('Yes, I have a POS system')).toBeInTheDocument();
          expect(screen.getByText("No, I don't have a POS system")).toBeInTheDocument();

          // Assert: Should not show M-Pesa config yet
          expect(screen.queryByText('M-Pesa Configuration')).not.toBeInTheDocument();

          // Assert: Should not show summary yet
          expect(screen.queryByText('Setup Summary')).not.toBeInTheDocument();
        }
      ),
      { numRuns: 2 }
    );
  });

  /**
   * Property 6.1: POS Decision Options Consistency
   * Both POS options should always be present with correct implications
   */
  it('Property 6.1: POS Decision Options Consistency - should display both POS options with correct details', () => {
    fc.assert(
      fc.property(
        fc.record({
          testRun: fc.integer({ min: 1, max: 2 })
        }),
        async (testData) => {
          // Arrange
          const mockOnComplete = jest.fn();
          const mockOnBack = jest.fn();
          const user = userEvent.setup();

          // Act: Navigate to POS decision step
          render(
            <VenueSetup
              onComplete={mockOnComplete}
              onBack={mockOnBack}
            />
          );

          // Fill venue info and navigate to POS decision
          await user.type(screen.getByLabelText(/Venue Name/), 'Test Venue');
          await user.type(screen.getByLabelText(/Location/), 'Test Location');
          await user.click(screen.getByText('Continue'));

          // Assert: POS option (Yes) should have correct details
          expect(screen.getByText('Yes, I have a POS system')).toBeInTheDocument();
          expect(screen.getByText('Integrate with existing POS')).toBeInTheDocument();
          expect(screen.getByText(/Your POS system creates all financial orders/)).toBeInTheDocument();
          expect(screen.getByText(/Staff ordering in Tabeza is disabled/)).toBeInTheDocument();

          // Assert: No POS option should have correct details
          expect(screen.getByText("No, I don't have a POS system")).toBeInTheDocument();
          expect(screen.getByText('Tabeza as complete solution')).toBeInTheDocument();
          expect(screen.getByText(/Tabeza creates all orders and receipts/)).toBeInTheDocument();
          expect(screen.getByText(/Staff can build orders directly in Tabeza/)).toBeInTheDocument();

          // Assert: Both options should be clickable
          const yesOption = screen.getByText('Yes, I have a POS system').closest('[class*="cursor-pointer"]');
          const noOption = screen.getByText("No, I don't have a POS system").closest('[class*="cursor-pointer"]');
          
          expect(yesOption).toBeInTheDocument();
          expect(noOption).toBeInTheDocument();
        }
      ),
      { numRuns: 2 }
    );
  });

  /**
   * Property 6.2: POS Decision Authority Configuration
   * POS decision should correctly configure authority mode
   */
  it('Property 6.2: POS Decision Authority Configuration - should configure authority based on POS decision', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(true, false), // hasPOS decision
        async (hasPOS) => {
          // Arrange
          const mockOnComplete = jest.fn();
          const mockOnBack = jest.fn();
          const user = userEvent.setup();

          // Act: Navigate through complete flow
          render(
            <VenueSetup
              onComplete={mockOnComplete}
              onBack={mockOnBack}
            />
          );

          // Fill venue info
          await user.type(screen.getByLabelText(/Venue Name/), 'Test Venue');
          await user.type(screen.getByLabelText(/Location/), 'Test Location');
          await user.click(screen.getByText('Continue'));

          // Make POS decision
          const posOption = hasPOS 
            ? screen.getByText('Yes, I have a POS system')
            : screen.getByText("No, I don't have a POS system");
          
          await user.click(posOption.closest('[class*="cursor-pointer"]')!);
          await user.click(screen.getByText('Continue'));

          // Fill M-Pesa config
          await user.type(screen.getByLabelText(/Business Shortcode/), '123456');
          await user.type(screen.getByLabelText(/Consumer Key/), 'test-key');
          await user.type(screen.getByLabelText(/Consumer Secret/), 'test-secret');
          await user.type(screen.getByLabelText(/Passkey/), 'test-passkey');
          await user.click(screen.getByText('Continue'));

          // Assert: Summary should show correct authority configuration
          if (hasPOS) {
            expect(screen.getByText('POS System')).toBeInTheDocument();
            expect(screen.getByText('Requests Only')).toBeInTheDocument();
            expect(screen.getByText('Disabled')).toBeInTheDocument(); // Staff Ordering
            expect(screen.getByText('Recommended')).toBeInTheDocument(); // Printer
          } else {
            expect(screen.getByText('Tabeza System')).toBeInTheDocument();
            expect(screen.getByText('Full Orders')).toBeInTheDocument();
            expect(screen.getByText('Enabled')).toBeInTheDocument(); // Staff Ordering
            expect(screen.getByText('Optional')).toBeInTheDocument(); // Printer
          }

          // Complete setup and verify configuration
          await user.click(screen.getByText('Complete Setup'));
          
          expect(mockOnComplete).toHaveBeenCalledWith(
            expect.objectContaining({
              venue_mode: 'venue',
              authority_mode: hasPOS ? 'pos' : 'tabeza',
              hasPOS: hasPOS
            })
          );
        }
      ),
      { numRuns: 2 }
    );
  });

  /**
   * Property 6.3: Step Navigation Validation
   * Navigation should require POS decision before proceeding
   */
  it('Property 6.3: Step Navigation Validation - should require POS decision before proceeding', () => {
    fc.assert(
      fc.property(
        fc.record({
          testScenario: fc.constantFrom('no-selection', 'with-selection')
        }),
        async (testData) => {
          // Arrange
          const mockOnComplete = jest.fn();
          const mockOnBack = jest.fn();
          const user = userEvent.setup();

          // Act: Navigate to POS decision step
          render(
            <VenueSetup
              onComplete={mockOnComplete}
              onBack={mockOnBack}
            />
          );

          // Fill venue info and navigate to POS decision
          await user.type(screen.getByLabelText(/Venue Name/), 'Test Venue');
          await user.type(screen.getByLabelText(/Location/), 'Test Location');
          await user.click(screen.getByText('Continue'));

          if (testData.testScenario === 'with-selection') {
            // Make a POS selection
            const yesOption = screen.getByText('Yes, I have a POS system').closest('[class*="cursor-pointer"]');
            await user.click(yesOption!);
          }

          // Try to continue
          await user.click(screen.getByText('Continue'));

          if (testData.testScenario === 'no-selection') {
            // Assert: Should show validation error and stay on POS decision step
            expect(screen.getByText('Please select whether you have a POS system')).toBeInTheDocument();
            expect(screen.getByText('POS System Integration')).toBeInTheDocument();
            expect(screen.queryByText('M-Pesa Configuration')).not.toBeInTheDocument();
          } else {
            // Assert: Should proceed to M-Pesa configuration
            expect(screen.getByText('M-Pesa Configuration')).toBeInTheDocument();
            expect(screen.queryByText('POS System Integration')).not.toBeInTheDocument();
          }
        }
      ),
      { numRuns: 2 }
    );
  });

  /**
   * Property 6.4: Progress Indicator Consistency
   * Progress indicator should correctly reflect current step
   */
  it('Property 6.4: Progress Indicator Consistency - should show correct progress through steps', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('venue-info', 'pos-decision', 'mpesa-config', 'summary'),
        async (targetStep) => {
          // Arrange
          const mockOnComplete = jest.fn();
          const mockOnBack = jest.fn();
          const user = userEvent.setup();

          // Act
          render(
            <VenueSetup
              onComplete={mockOnComplete}
              onBack={mockOnBack}
            />
          );

          // Navigate to target step
          if (targetStep !== 'venue-info') {
            // Fill venue info
            await user.type(screen.getByLabelText(/Venue Name/), 'Test Venue');
            await user.type(screen.getByLabelText(/Location/), 'Test Location');
            await user.click(screen.getByText('Continue'));
          }

          if (targetStep === 'mpesa-config' || targetStep === 'summary') {
            // Make POS decision
            const yesOption = screen.getByText('Yes, I have a POS system').closest('[class*="cursor-pointer"]');
            await user.click(yesOption!);
            await user.click(screen.getByText('Continue'));
          }

          if (targetStep === 'summary') {
            // Fill M-Pesa config
            await user.type(screen.getByLabelText(/Business Shortcode/), '123456');
            await user.type(screen.getByLabelText(/Consumer Key/), 'test-key');
            await user.type(screen.getByLabelText(/Consumer Secret/), 'test-secret');
            await user.type(screen.getByLabelText(/Passkey/), 'test-passkey');
            await user.click(screen.getByText('Continue'));
          }

          // Assert: Progress indicator should show correct step as active
          const progressSteps = screen.getAllByText(/^[1-4]$/);
          expect(progressSteps).toHaveLength(4);

          const expectedActiveStep = {
            'venue-info': 1,
            'pos-decision': 2,
            'mpesa-config': 3,
            'summary': 4
          }[targetStep];

          // Check that the correct step is active (green background)
          const activeStep = progressSteps[expectedActiveStep - 1];
          expect(activeStep).toHaveClass('bg-green-500');
          expect(activeStep).toHaveClass('text-white');

          // Check that previous steps are also active
          for (let i = 0; i < expectedActiveStep - 1; i++) {
            expect(progressSteps[i]).toHaveClass('bg-green-500');
          }

          // Check that future steps are inactive
          for (let i = expectedActiveStep; i < 4; i++) {
            expect(progressSteps[i]).toHaveClass('bg-gray-200');
          }
        }
      ),
      { numRuns: 2 }
    );
  });

  /**
   * Property 6.5: Venue Mode Auto-Configuration
   * Venue setup should always configure venue_mode as 'venue'
   */
  it('Property 6.5: Venue Mode Auto-Configuration - should always set venue_mode to venue', () => {
    fc.assert(
      fc.property(
        fc.record({
          hasPOS: fc.boolean(),
          venueName: fc.string({ minLength: 1, maxLength: 30 }),
          location: fc.string({ minLength: 1, maxLength: 30 })
        }),
        async (testData) => {
          // Arrange
          const mockOnComplete = jest.fn();
          const mockOnBack = jest.fn();
          const user = userEvent.setup();

          // Act: Complete entire flow
          render(
            <VenueSetup
              onComplete={mockOnComplete}
              onBack={mockOnBack}
            />
          );

          // Fill venue info
          await user.type(screen.getByLabelText(/Venue Name/), testData.venueName);
          await user.type(screen.getByLabelText(/Location/), testData.location);
          await user.click(screen.getByText('Continue'));

          // Make POS decision
          const posOption = testData.hasPOS 
            ? screen.getByText('Yes, I have a POS system')
            : screen.getByText("No, I don't have a POS system");
          
          await user.click(posOption.closest('[class*="cursor-pointer"]')!);
          await user.click(screen.getByText('Continue'));

          // Fill M-Pesa config
          await user.type(screen.getByLabelText(/Business Shortcode/), '123456');
          await user.type(screen.getByLabelText(/Consumer Key/), 'test-key');
          await user.type(screen.getByLabelText(/Consumer Secret/), 'test-secret');
          await user.type(screen.getByLabelText(/Passkey/), 'test-passkey');
          await user.click(screen.getByText('Continue'));

          // Assert: Summary should always show Venue mode
          expect(screen.getByText(/Venue \(/)).toBeInTheDocument();
          expect(screen.getByText('Tabeza Venue Configuration')).toBeInTheDocument();

          // Complete setup
          await user.click(screen.getByText('Complete Setup'));

          // Assert: Configuration should always have venue_mode as 'venue'
          expect(mockOnComplete).toHaveBeenCalledWith(
            expect.objectContaining({
              venue_mode: 'venue',
              venueName: testData.venueName,
              location: testData.location
            })
          );
        }
      ),
      { numRuns: 2 }
    );
  });
});