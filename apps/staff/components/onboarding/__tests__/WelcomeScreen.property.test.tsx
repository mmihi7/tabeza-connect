/**
 * Property-Based Tests for WelcomeScreen Component
 * Feature: onboarding-flow-redesign, Property 1: Welcome Screen Mode Options
 * Validates: Requirements 1.1, 1.2
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fc from 'fast-check';
import WelcomeScreen from '../WelcomeScreen';

describe('WelcomeScreen Property Tests', () => {
  /**
   * Property 1: Welcome Screen Mode Options
   * For any onboarding session, when the welcome screen is displayed, 
   * it should contain exactly two mode options: Basic and Venue, 
   * each with learn more functionality
   * Validates: Requirements 1.1, 1.2
   */
  it('Property 1: Welcome Screen Mode Options - should always display exactly two mode options with learn more functionality', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary test data that doesn't affect the core property
        fc.record({
          testId: fc.string({ minLength: 1, maxLength: 10 }),
          renderCount: fc.integer({ min: 1, max: 3 })
        }),
        async (testData) => {
          // Arrange: Mock handlers
          const mockOnModeSelect = jest.fn();
          const mockOnLearnMore = jest.fn();

          // Act: Render the component multiple times to test consistency
          for (let i = 0; i < testData.renderCount; i++) {
            const { unmount } = render(
              <WelcomeScreen
                onModeSelect={mockOnModeSelect}
                onLearnMore={mockOnLearnMore}
              />
            );

            // Assert: Verify exactly two mode options exist
            const basicOption = screen.getByText('Tabeza Basic');
            const venueOption = screen.getByText('Tabeza Venue');
            
            expect(basicOption).toBeInTheDocument();
            expect(venueOption).toBeInTheDocument();

            // Assert: Verify both options have learn more functionality
            const learnMoreButtons = screen.getAllByText('Learn More');
            expect(learnMoreButtons).toHaveLength(2);

            // Assert: Verify mode options have required content
            expect(screen.getByText('Transaction & Receipt Bridge')).toBeInTheDocument();
            expect(screen.getByText('Customer Interaction & Service Layer')).toBeInTheDocument();

            // Assert: Verify both options are clickable for selection
            const basicCard = basicOption.closest('[class*="cursor-pointer"]');
            const venueCard = venueOption.closest('[class*="cursor-pointer"]');
            
            expect(basicCard).toBeInTheDocument();
            expect(venueCard).toBeInTheDocument();

            // Assert: Verify learn more buttons are functional
            const user = userEvent.setup();
            await user.click(learnMoreButtons[0]);
            expect(mockOnLearnMore).toHaveBeenCalled();

            // Clean up for next iteration
            unmount();
            mockOnModeSelect.mockClear();
            mockOnLearnMore.mockClear();
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property 1.1: Mode Option Content Consistency
   * Each mode option should always contain the same essential elements
   * regardless of rendering context
   */
  it('Property 1.1: Mode Option Content Consistency - should maintain consistent content structure', () => {
    fc.assert(
      fc.property(
        fc.record({
          containerWidth: fc.integer({ min: 320, max: 1920 }),
          testScenario: fc.constantFrom('desktop', 'mobile', 'tablet')
        }),
        (testData) => {
          // Arrange
          const mockOnModeSelect = jest.fn();
          const mockOnLearnMore = jest.fn();

          // Act
          render(
            <WelcomeScreen
              onModeSelect={mockOnModeSelect}
              onLearnMore={mockOnLearnMore}
            />
          );

          // Assert: Basic mode content
          expect(screen.getByText('Tabeza Basic')).toBeInTheDocument();
          expect(screen.getByText('Transaction & Receipt Bridge')).toBeInTheDocument();
          expect(screen.getByText(/Perfect for established venues with existing POS systems/)).toBeInTheDocument();
          expect(screen.getByText('Works with your existing POS system')).toBeInTheDocument();
          expect(screen.getByText('Digital receipt delivery to customers')).toBeInTheDocument();
          expect(screen.getByText('Customer payment processing')).toBeInTheDocument();
          expect(screen.getByText('Thermal printer integration required')).toBeInTheDocument();

          // Assert: Venue mode content
          expect(screen.getByText('Tabeza Venue')).toBeInTheDocument();
          expect(screen.getByText('Customer Interaction & Service Layer')).toBeInTheDocument();
          expect(screen.getByText(/Complete solution for customer interaction/)).toBeInTheDocument();
          expect(screen.getByText('Digital menus and customer ordering')).toBeInTheDocument();
          expect(screen.getByText('Two-way customer messaging')).toBeInTheDocument();
          expect(screen.getByText('Payment processing and receipts')).toBeInTheDocument();
          expect(screen.getByText('Works with or without POS systems')).toBeInTheDocument();
        }
      ),
      { numRuns: 3 }
    );
  });

  /**
   * Property 1.2: Learn More Modal Functionality
   * Learn more functionality should work for both mode options
   * and provide detailed information
   */
  it('Property 1.2: Learn More Modal Functionality - should provide detailed information for both modes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('basic', 'venue'),
        async (modeType) => {
          // Arrange
          const mockOnModeSelect = jest.fn();
          const mockOnLearnMore = jest.fn();
          const user = userEvent.setup();

          // Act
          render(
            <WelcomeScreen
              onModeSelect={mockOnModeSelect}
              onLearnMore={mockOnLearnMore}
            />
          );

          // Find and click the appropriate learn more button
          const learnMoreButtons = screen.getAllByText('Learn More');
          const buttonIndex = modeType === 'basic' ? 0 : 1;
          
          await user.click(learnMoreButtons[buttonIndex]);

          // Assert: Verify learn more callback was called
          expect(mockOnLearnMore).toHaveBeenCalledWith(modeType);

          // Assert: Verify modal appears with detailed content
          const modalTitle = modeType === 'basic' ? 'Tabeza Basic' : 'Tabeza Venue';
          expect(screen.getByText(modalTitle)).toBeInTheDocument();
          
          // Assert: Verify modal has required sections
          expect(screen.getByText('Key Benefits')).toBeInTheDocument();
          expect(screen.getByText('Requirements')).toBeInTheDocument();
          expect(screen.getByText('How It Works')).toBeInTheDocument();

          // Assert: Verify modal has action buttons
          expect(screen.getByText('Close')).toBeInTheDocument();
          expect(screen.getByText(`Choose ${modalTitle}`)).toBeInTheDocument();
        }
      ),
      { numRuns: 3 }
    );
  });

  /**
   * Property 1.3: Mode Selection Behavior
   * Mode selection should work correctly and provide visual feedback
   */
  it('Property 1.3: Mode Selection Behavior - should handle mode selection with visual feedback', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('basic', 'venue'),
        async (selectedMode) => {
          // Arrange
          const mockOnModeSelect = jest.fn();
          const mockOnLearnMore = jest.fn();
          const user = userEvent.setup();

          // Act
          render(
            <WelcomeScreen
              onModeSelect={mockOnModeSelect}
              onLearnMore={mockOnLearnMore}
            />
          );

          // Click on the mode option
          const modeTitle = selectedMode === 'basic' ? 'Tabeza Basic' : 'Tabeza Venue';
          const modeCard = screen.getByText(modeTitle).closest('[class*="cursor-pointer"]');
          
          expect(modeCard).toBeInTheDocument();
          await user.click(modeCard!);

          // Assert: Continue button should be enabled after selection
          const continueButton = screen.getByText('Continue');
          expect(continueButton).toBeInTheDocument();
          expect(continueButton).not.toHaveClass('cursor-not-allowed');

          // Act: Click continue button
          await user.click(continueButton);

          // Assert: Verify mode selection callback was called
          expect(mockOnModeSelect).toHaveBeenCalledWith(selectedMode);
        }
      ),
      { numRuns: 3 }
    );
  });

  /**
   * Property 1.4: Progress Indicator Consistency
   * Progress indicator should always show step 1 of 3 as active
   */
  it('Property 1.4: Progress Indicator Consistency - should always show correct progress state', () => {
    fc.assert(
      fc.property(
        fc.record({
          testRun: fc.integer({ min: 1, max: 5 })
        }),
        (testData) => {
          // Arrange
          const mockOnModeSelect = jest.fn();
          const mockOnLearnMore = jest.fn();

          // Act
          render(
            <WelcomeScreen
              onModeSelect={mockOnModeSelect}
              onLearnMore={mockOnLearnMore}
            />
          );

          // Assert: Verify progress indicator shows step 1 as active
          const progressSteps = screen.getAllByText(/^[123]$/);
          expect(progressSteps).toHaveLength(3);
          
          // Step 1 should be active (orange background)
          const step1 = progressSteps[0];
          expect(step1).toHaveClass('bg-orange-500');
          expect(step1).toHaveClass('text-white');

          // Steps 2 and 3 should be inactive (gray background)
          const step2 = progressSteps[1];
          const step3 = progressSteps[2];
          expect(step2).toHaveClass('bg-gray-200');
          expect(step3).toHaveClass('bg-gray-200');
        }
      ),
      { numRuns: 3 }
    );
  });
});