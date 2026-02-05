/**
 * Property-Based Tests for BasicSetup Component
 * Feature: onboarding-flow-redesign, Property 3: Basic Setup Field Restriction
 * Validates: Requirements 2.1
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fc from 'fast-check';
import BasicSetup from '../BasicSetup';

describe('BasicSetup Property Tests', () => {
  /**
   * Property 3: Basic Setup Field Restriction
   * For any Basic setup flow, the form should contain only the essential fields: 
   * venue name, location, and M-Pesa details, with no additional optional fields
   * Validates: Requirements 2.1
   */
  it('Property 3: Basic Setup Field Restriction - should contain only essential fields without optional extras', () => {
    fc.assert(
      fc.property(
        fc.record({
          testScenario: fc.constantFrom('venue-info', 'mpesa-config', 'printer-setup', 'summary'),
          renderCount: fc.integer({ min: 1, max: 3 })
        }),
        async (testData) => {
          // Arrange: Mock handlers
          const mockOnComplete = jest.fn();
          const mockOnBack = jest.fn();

          // Act: Render the component multiple times to test consistency
          for (let i = 0; i < testData.renderCount; i++) {
            const { unmount } = render(
              <BasicSetup
                onComplete={mockOnComplete}
                onBack={mockOnBack}
              />
            );

            // Assert: Verify venue info step contains only essential fields
            if (testData.testScenario === 'venue-info' || i === 0) {
              // Essential fields that MUST be present
              expect(screen.getByLabelText(/Venue Name/)).toBeInTheDocument();
              expect(screen.getByLabelText(/Location/)).toBeInTheDocument();

              // Optional fields that MUST NOT be present in Basic setup
              expect(screen.queryByLabelText(/Description/)).not.toBeInTheDocument();
              expect(screen.queryByLabelText(/Phone/)).not.toBeInTheDocument();
              expect(screen.queryByLabelText(/Email/)).not.toBeInTheDocument();
              expect(screen.queryByLabelText(/Website/)).not.toBeInTheDocument();
              expect(screen.queryByLabelText(/Business Hours/)).not.toBeInTheDocument();
              expect(screen.queryByLabelText(/Category/)).not.toBeInTheDocument();
              expect(screen.queryByLabelText(/Tags/)).not.toBeInTheDocument();
              expect(screen.queryByLabelText(/Logo/)).not.toBeInTheDocument();
              expect(screen.queryByLabelText(/Cover Image/)).not.toBeInTheDocument();
              expect(screen.queryByLabelText(/Social Media/)).not.toBeInTheDocument();
              expect(screen.queryByLabelText(/Additional Info/)).not.toBeInTheDocument();
              expect(screen.queryByLabelText(/Special Instructions/)).not.toBeInTheDocument();
            }

            // Navigate to M-Pesa config step to test its field restrictions
            if (testData.testScenario === 'mpesa-config' || i === 0) {
              // Fill venue info and proceed to M-Pesa config
              const venueNameInput = screen.getByLabelText(/Venue Name/);
              const locationInput = screen.getByLabelText(/Location/);
              const user = userEvent.setup();

              await user.type(venueNameInput, 'Test Venue');
              await user.type(locationInput, 'Test Location');
              
              const continueButton = screen.getByText('Continue');
              await user.click(continueButton);

              // Assert: M-Pesa config contains only essential fields
              expect(screen.getByLabelText(/Business Shortcode/)).toBeInTheDocument();
              expect(screen.getByLabelText(/Consumer Key/)).toBeInTheDocument();
              expect(screen.getByLabelText(/Consumer Secret/)).toBeInTheDocument();
              expect(screen.getByLabelText(/Passkey/)).toBeInTheDocument();
              expect(screen.getByText('Environment')).toBeInTheDocument();

              // Optional M-Pesa fields that MUST NOT be present
              expect(screen.queryByLabelText(/Callback URL/)).not.toBeInTheDocument();
              expect(screen.queryByLabelText(/Timeout URL/)).not.toBeInTheDocument();
              expect(screen.queryByLabelText(/Result URL/)).not.toBeInTheDocument();
              expect(screen.queryByLabelText(/Queue Timeout URL/)).not.toBeInTheDocument();
              expect(screen.queryByLabelText(/Initiator Name/)).not.toBeInTheDocument();
              expect(screen.queryByLabelText(/Security Credential/)).not.toBeInTheDocument();
              expect(screen.queryByLabelText(/Account Reference/)).not.toBeInTheDocument();
              expect(screen.queryByLabelText(/Transaction Description/)).not.toBeInTheDocument();
            }

            // Clean up for next iteration
            unmount();
            mockOnComplete.mockClear();
            mockOnBack.mockClear();
          }
        }
      ),
      { numRuns: 2 }
    );
  });

  /**
   * Property 3.1: Essential Field Validation
   * All essential fields should be required and validated
   */
  it('Property 3.1: Essential Field Validation - should require all essential fields', () => {
    fc.assert(
      fc.property(
        fc.record({
          venueNameEmpty: fc.boolean(),
          locationEmpty: fc.boolean(),
          testIteration: fc.integer({ min: 1, max: 2 })
        }),
        async (testData) => {
          // Arrange
          const mockOnComplete = jest.fn();
          const mockOnBack = jest.fn();
          const user = userEvent.setup();

          // Act
          render(
            <BasicSetup
              onComplete={mockOnComplete}
              onBack={mockOnBack}
            />
          );

          // Fill fields based on test data
          const venueNameInput = screen.getByLabelText(/Venue Name/);
          const locationInput = screen.getByLabelText(/Location/);

          if (!testData.venueNameEmpty) {
            await user.type(venueNameInput, 'Test Venue');
          }
          if (!testData.locationEmpty) {
            await user.type(locationInput, 'Test Location');
          }

          // Try to continue
          const continueButton = screen.getByText('Continue');
          await user.click(continueButton);

          // Assert: If any essential field is empty, should show validation error
          if (testData.venueNameEmpty || testData.locationEmpty) {
            // Should still be on venue info step with errors
            expect(screen.getByText('Venue Information')).toBeInTheDocument();
            
            if (testData.venueNameEmpty) {
              expect(screen.getByText('Venue name is required')).toBeInTheDocument();
            }
            if (testData.locationEmpty) {
              expect(screen.getByText('Location is required')).toBeInTheDocument();
            }
          } else {
            // Should proceed to next step
            expect(screen.getByText('M-Pesa Configuration')).toBeInTheDocument();
          }
        }
      ),
      { numRuns: 2 }
    );
  });

  /**
   * Property 3.2: Step Progression Restriction
   * Basic setup should follow a strict 4-step progression without optional steps
   */
  it('Property 3.2: Step Progression Restriction - should follow strict 4-step progression', () => {
    fc.assert(
      fc.property(
        fc.record({
          testRun: fc.integer({ min: 1, max: 2 })
        }),
        (testData) => {
          // Arrange
          const mockOnComplete = jest.fn();
          const mockOnBack = jest.fn();

          // Act
          render(
            <BasicSetup
              onComplete={mockOnComplete}
              onBack={mockOnBack}
            />
          );

          // Assert: Progress indicator should show exactly 4 steps
          const progressSteps = screen.getAllByText(/^[1-4]$/);
          expect(progressSteps).toHaveLength(4);

          // Assert: Step 1 should be active initially
          const step1 = progressSteps[0];
          expect(step1).toHaveClass('bg-blue-500');
          expect(step1).toHaveClass('text-white');

          // Assert: Steps 2, 3, 4 should be inactive initially
          const step2 = progressSteps[1];
          const step3 = progressSteps[2];
          const step4 = progressSteps[3];
          
          expect(step2).toHaveClass('bg-gray-200');
          expect(step3).toHaveClass('bg-gray-200');
          expect(step4).toHaveClass('bg-gray-200');

          // Assert: Should start with venue info step
          expect(screen.getByText('Venue Information')).toBeInTheDocument();
          expect(screen.getByText("Let's start with basic information about your venue")).toBeInTheDocument();

          // Assert: No optional steps should be present
          expect(screen.queryByText('Additional Settings')).not.toBeInTheDocument();
          expect(screen.queryByText('Optional Configuration')).not.toBeInTheDocument();
          expect(screen.queryByText('Advanced Options')).not.toBeInTheDocument();
          expect(screen.queryByText('Menu Setup')).not.toBeInTheDocument();
          expect(screen.queryByText('Staff Configuration')).not.toBeInTheDocument();
          expect(screen.queryByText('Business Hours')).not.toBeInTheDocument();
        }
      ),
      { numRuns: 2 }
    );
  });

  /**
   * Property 3.3: Auto-Configuration Enforcement
   * Basic setup should automatically configure venue_mode='basic' and authority_mode='pos'
   */
  it('Property 3.3: Auto-Configuration Enforcement - should auto-configure Basic mode settings', () => {
    fc.assert(
      fc.property(
        fc.record({
          testScenario: fc.constantFrom('summary-display', 'completion-config')
        }),
        async (testData) => {
          // Arrange
          const mockOnComplete = jest.fn();
          const mockOnBack = jest.fn();
          const user = userEvent.setup();

          // Act: Navigate through all steps to reach summary
          render(
            <BasicSetup
              onComplete={mockOnComplete}
              onBack={mockOnBack}
            />
          );

          // Fill venue info
          await user.type(screen.getByLabelText(/Venue Name/), 'Test Venue');
          await user.type(screen.getByLabelText(/Location/), 'Test Location');
          await user.click(screen.getByText('Continue'));

          // Fill M-Pesa config
          await user.type(screen.getByLabelText(/Business Shortcode/), '123456');
          await user.type(screen.getByLabelText(/Consumer Key/), 'test-key');
          await user.type(screen.getByLabelText(/Consumer Secret/), 'test-secret');
          await user.type(screen.getByLabelText(/Passkey/), 'test-passkey');
          await user.click(screen.getByText('Continue'));

          // Fill printer config
          await user.type(screen.getByLabelText(/Printer Name/), 'Test Printer');
          await user.click(screen.getByText('Test Printer'));
          
          // Wait for test to complete and continue
          await new Promise(resolve => setTimeout(resolve, 100));
          await user.click(screen.getByText('Continue'));

          // Assert: Summary should show auto-configured Basic mode settings
          expect(screen.getByText('Tabeza Basic Configuration')).toBeInTheDocument();
          expect(screen.getByText('Basic (POS Integration)')).toBeInTheDocument();
          expect(screen.getByText('POS System')).toBeInTheDocument();
          expect(screen.getByText('Disabled')).toBeInTheDocument(); // Customer Ordering
          expect(screen.getByText('Yes')).toBeInTheDocument(); // Printer Required

          // Assert: No user choice for mode or authority should be present
          expect(screen.queryByLabelText(/Venue Mode/)).not.toBeInTheDocument();
          expect(screen.queryByLabelText(/Authority Mode/)).not.toBeInTheDocument();
          expect(screen.queryByText('Choose Mode')).not.toBeInTheDocument();
          expect(screen.queryByText('Select Authority')).not.toBeInTheDocument();

          if (testData.testScenario === 'completion-config') {
            // Complete setup and verify configuration
            await user.click(screen.getByText('Complete Setup'));
            
            expect(mockOnComplete).toHaveBeenCalledWith(
              expect.objectContaining({
                venue_mode: 'basic',
                authority_mode: 'pos'
              })
            );
          }
        }
      ),
      { numRuns: 2 }
    );
  });

  /**
   * Property 3.4: Printer Requirement Enforcement
   * Basic setup should require printer configuration and testing
   */
  it('Property 3.4: Printer Requirement Enforcement - should require printer setup and testing', () => {
    fc.assert(
      fc.property(
        fc.record({
          printerTested: fc.boolean(),
          testRun: fc.integer({ min: 1, max: 2 })
        }),
        async (testData) => {
          // Arrange
          const mockOnComplete = jest.fn();
          const mockOnBack = jest.fn();
          const user = userEvent.setup();

          // Act: Navigate to printer setup step
          render(
            <BasicSetup
              onComplete={mockOnComplete}
              onBack={mockOnBack}
            />
          );

          // Navigate through venue info
          await user.type(screen.getByLabelText(/Venue Name/), 'Test Venue');
          await user.type(screen.getByLabelText(/Location/), 'Test Location');
          await user.click(screen.getByText('Continue'));

          // Navigate through M-Pesa config
          await user.type(screen.getByLabelText(/Business Shortcode/), '123456');
          await user.type(screen.getByLabelText(/Consumer Key/), 'test-key');
          await user.type(screen.getByLabelText(/Consumer Secret/), 'test-secret');
          await user.type(screen.getByLabelText(/Passkey/), 'test-passkey');
          await user.click(screen.getByText('Continue'));

          // Assert: Printer setup step should be present and required
          expect(screen.getByText('Printer Setup')).toBeInTheDocument();
          expect(screen.getByText('Configure your thermal printer for receipt printing')).toBeInTheDocument();
          
          // Assert: Printer fields should be required
          expect(screen.getByLabelText(/Printer Name/)).toBeInTheDocument();
          expect(screen.getByText('Connection Type')).toBeInTheDocument();
          expect(screen.getByText('Test Printer Connection')).toBeInTheDocument();

          // Fill printer name
          await user.type(screen.getByLabelText(/Printer Name/), 'Test Printer');

          if (testData.printerTested) {
            // Test printer
            await user.click(screen.getByText('Test Printer'));
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // Try to continue
          await user.click(screen.getByText('Continue'));

          // Assert: Should only proceed if printer is tested
          if (testData.printerTested) {
            expect(screen.getByText('Setup Summary')).toBeInTheDocument();
          } else {
            expect(screen.getByText('Please test the printer connection before continuing')).toBeInTheDocument();
            expect(screen.getByText('Printer Setup')).toBeInTheDocument(); // Still on printer step
          }
        }
      ),
      { numRuns: 2 }
    );
  });
});