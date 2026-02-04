/**
 * Visual Regression Tests for Onboarding Modal
 * 
 * Tests visual consistency of the onboarding modal across different states,
 * configurations, and screen sizes. Ensures proper theme application and
 * responsive design throughout the onboarding flow.
 * 
 * Implements Requirements 5.1, 5.2, 5.3 from onboarding-flow-fix specification.
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 */

import { test, expect, Page } from '@playwright/test';

// Onboarding flow steps
const ONBOARDING_STEPS = [
  { step: 'mode', name: 'Mode Selection' },
  { step: 'authority', name: 'Authority Selection' },
  { step: 'summary', name: 'Configuration Summary' }
] as const;

// Modal states to test
const MODAL_STATES = [
  { name: 'Initial Load', forced: false },
  { name: 'Forced Mode', forced: true },
  { name: 'With Validation Errors', hasErrors: true },
  { name: 'With Network Issues', networkIssues: true }
] as const;

// Helper function to trigger onboarding modal
async function triggerOnboardingModal(page: Page, forced = false) {
  // Set up incomplete venue configuration
  await page.route('**/api/venue-configuration/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        venue_mode: null,
        authority_mode: null,
        pos_integration_enabled: false,
        printer_required: false,
        onboarding_completed: false
      })
    });
  });
  
  // Navigate to settings to trigger modal
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  
  // Wait for modal to appear
  const modal = page.locator('[data-testid="venue-mode-onboarding"]');
  await expect(modal).toBeVisible({ timeout: 10000 });
  
  return modal;
}

// Helper function to simulate validation errors
async function simulateValidationErrors(page: Page) {
  await page.addInitScript(() => {
    // Mock validation errors
    (window as any).__MOCK_VALIDATION_ERRORS__ = [
      'Basic mode requires POS authority',
      'Invalid configuration detected'
    ];
  });
}

// Helper function to simulate network issues
async function simulateNetworkIssues(page: Page) {
  // Intercept API calls and simulate network failures
  await page.route('**/api/onboarding/**', async (route) => {
    await route.abort('failed');
  });
}

test.describe('Onboarding Modal Visual Consistency', () => {
  
  test.beforeEach(async ({ page }) => {
    // Disable animations for consistent screenshots
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.innerHTML = `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `;
      document.head.appendChild(style);
    });
  });

  test.describe('Modal States', () => {
    
    for (const state of MODAL_STATES) {
      test(`should display correctly in ${state.name} state`, async ({ page }) => {
        // Set up specific state conditions
        if (state.hasErrors) {
          await simulateValidationErrors(page);
        }
        if (state.networkIssues) {
          await simulateNetworkIssues(page);
        }
        
        // Trigger modal
        const modal = await triggerOnboardingModal(page, state.forced);
        
        // Take screenshot of modal in this state
        await expect(modal).toHaveScreenshot(
          `onboarding-modal-${state.name.toLowerCase().replace(/\s+/g, '-')}.png`
        );
        
        // Test modal backdrop
        const backdrop = page.locator('[data-testid="modal-backdrop"]');
        if (await backdrop.count() > 0) {
          await expect(page).toHaveScreenshot(
            `onboarding-backdrop-${state.name.toLowerCase().replace(/\s+/g, '-')}.png`,
            { fullPage: true }
          );
        }
      });
    }
  });

  test.describe('Onboarding Flow Steps', () => {
    
    test('should display mode selection step correctly', async ({ page }) => {
      const modal = await triggerOnboardingModal(page);
      
      // Should be on mode selection step by default
      await expect(modal.locator('[data-testid="mode-selection"]')).toBeVisible();
      
      // Take screenshot of mode selection
      await expect(modal).toHaveScreenshot('onboarding-step-mode-selection.png');
      
      // Test individual mode options
      const basicOption = modal.locator('[data-testid="basic-mode-option"]');
      const venueOption = modal.locator('[data-testid="venue-mode-option"]');
      
      await expect(basicOption).toHaveScreenshot('mode-option-basic.png');
      await expect(venueOption).toHaveScreenshot('mode-option-venue.png');
      
      // Test hover states
      await basicOption.hover();
      await expect(basicOption).toHaveScreenshot('mode-option-basic-hover.png');
      
      await venueOption.hover();
      await expect(venueOption).toHaveScreenshot('mode-option-venue-hover.png');
      
      // Test selected states
      await basicOption.click();
      await page.waitForTimeout(300);
      await expect(basicOption).toHaveScreenshot('mode-option-basic-selected.png');
      
      // Reset and test venue selection
      await page.reload();
      await page.waitForLoadState('networkidle');
      const newModal = page.locator('[data-testid="venue-mode-onboarding"]');
      await expect(newModal).toBeVisible();
      
      const newVenueOption = newModal.locator('[data-testid="venue-mode-option"]');
      await newVenueOption.click();
      await page.waitForTimeout(300);
      await expect(newVenueOption).toHaveScreenshot('mode-option-venue-selected.png');
    });

    test('should display authority selection step correctly', async ({ page }) => {
      const modal = await triggerOnboardingModal(page);
      
      // Navigate to authority selection by selecting venue mode
      await modal.locator('[data-testid="venue-mode-option"]').click();
      await modal.locator('button:has-text("Continue")').click();
      await page.waitForTimeout(500);
      
      // Should now be on authority selection step
      await expect(modal.locator('[data-testid="authority-selection"]')).toBeVisible();
      
      // Take screenshot of authority selection
      await expect(modal).toHaveScreenshot('onboarding-step-authority-selection.png');
      
      // Test individual authority options
      const posOption = modal.locator('[data-testid="pos-authority-option"]');
      const tabezaOption = modal.locator('[data-testid="tabeza-authority-option"]');
      
      await expect(posOption).toHaveScreenshot('authority-option-pos.png');
      await expect(tabezaOption).toHaveScreenshot('authority-option-tabeza.png');
      
      // Test hover states
      await posOption.hover();
      await expect(posOption).toHaveScreenshot('authority-option-pos-hover.png');
      
      await tabezaOption.hover();
      await expect(tabezaOption).toHaveScreenshot('authority-option-tabeza-hover.png');
      
      // Test selected states
      await posOption.click();
      await page.waitForTimeout(300);
      await expect(posOption).toHaveScreenshot('authority-option-pos-selected.png');
    });

    test('should display summary step correctly', async ({ page }) => {
      const modal = await triggerOnboardingModal(page);
      
      // Navigate to summary by completing the flow
      await modal.locator('[data-testid="venue-mode-option"]').click();
      await modal.locator('button:has-text("Continue")').click();
      await page.waitForTimeout(500);
      
      await modal.locator('[data-testid="tabeza-authority-option"]').click();
      await modal.locator('button:has-text("Continue")').click();
      await page.waitForTimeout(500);
      
      // Should now be on summary step
      await expect(modal.locator('[data-testid="configuration-summary"]')).toBeVisible();
      
      // Take screenshot of summary step
      await expect(modal).toHaveScreenshot('onboarding-step-summary.png');
      
      // Test configuration display in summary
      const configDisplay = modal.locator('[data-testid="venue-configuration-display"]');
      if (await configDisplay.count() > 0) {
        await expect(configDisplay).toHaveScreenshot('summary-configuration-display.png');
      }
    });
  });

  test.describe('Error States', () => {
    
    test('should display validation errors correctly', async ({ page }) => {
      await simulateValidationErrors(page);
      const modal = await triggerOnboardingModal(page);
      
      // Try to trigger validation errors by making invalid selections
      await modal.locator('[data-testid="basic-mode-option"]').click();
      
      // Wait for validation to run
      await page.waitForTimeout(500);
      
      // Take screenshot with validation errors
      await expect(modal).toHaveScreenshot('onboarding-validation-errors.png');
      
      // Test error message display
      const errorContainer = modal.locator('[data-testid="validation-errors"]');
      if (await errorContainer.count() > 0) {
        await expect(errorContainer).toHaveScreenshot('validation-error-messages.png');
      }
    });

    test('should display network errors correctly', async ({ page }) => {
      await simulateNetworkIssues(page);
      const modal = await triggerOnboardingModal(page);
      
      // Complete the flow to trigger network error
      await modal.locator('[data-testid="basic-mode-option"]').click();
      await modal.locator('button:has-text("Continue")').click();
      await page.waitForTimeout(1000);
      
      // Try to complete setup (should fail due to network issues)
      await modal.locator('button:has-text("Complete")').click();
      await page.waitForTimeout(2000);
      
      // Take screenshot with network error
      await expect(modal).toHaveScreenshot('onboarding-network-error.png');
      
      // Test error display and retry button
      const errorDisplay = modal.locator('[data-testid="error-display"]');
      if (await errorDisplay.count() > 0) {
        await expect(errorDisplay).toHaveScreenshot('network-error-display.png');
      }
    });
  });

  test.describe('Responsive Modal Design', () => {
    
    const responsiveBreakpoints = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1440, height: 900 }
    ];

    for (const breakpoint of responsiveBreakpoints) {
      test(`should display correctly on ${breakpoint.name}`, async ({ page }) => {
        // Set viewport size
        await page.setViewportSize({ 
          width: breakpoint.width, 
          height: breakpoint.height 
        });
        
        const modal = await triggerOnboardingModal(page);
        
        // Take screenshot of modal at this breakpoint
        await expect(modal).toHaveScreenshot(
          `onboarding-modal-${breakpoint.name.toLowerCase()}.png`
        );
        
        // Test modal positioning and sizing
        await expect(page).toHaveScreenshot(
          `onboarding-modal-${breakpoint.name.toLowerCase()}-fullscreen.png`,
          { fullPage: true }
        );
        
        // Test each step at this breakpoint
        for (const step of ONBOARDING_STEPS) {
          if (step.step === 'mode') {
            // Already on mode step
            await expect(modal).toHaveScreenshot(
              `onboarding-${step.step}-${breakpoint.name.toLowerCase()}.png`
            );
          } else if (step.step === 'authority') {
            // Navigate to authority step
            await modal.locator('[data-testid="venue-mode-option"]').click();
            await modal.locator('button:has-text("Continue")').click();
            await page.waitForTimeout(500);
            
            await expect(modal).toHaveScreenshot(
              `onboarding-${step.step}-${breakpoint.name.toLowerCase()}.png`
            );
          } else if (step.step === 'summary') {
            // Navigate to summary step
            await modal.locator('[data-testid="tabeza-authority-option"]').click();
            await modal.locator('button:has-text("Continue")').click();
            await page.waitForTimeout(500);
            
            await expect(modal).toHaveScreenshot(
              `onboarding-${step.step}-${breakpoint.name.toLowerCase()}.png`
            );
          }
        }
      });
    }
  });

  test.describe('Accessibility and Focus States', () => {
    
    test('should display focus states correctly', async ({ page }) => {
      const modal = await triggerOnboardingModal(page);
      
      // Test keyboard navigation and focus states
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
      
      // Take screenshot with focus on first element
      await expect(modal).toHaveScreenshot('onboarding-focus-first-element.png');
      
      // Navigate through focusable elements
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
      await expect(modal).toHaveScreenshot('onboarding-focus-second-element.png');
      
      // Test focus on mode options
      const basicOption = modal.locator('[data-testid="basic-mode-option"]');
      await basicOption.focus();
      await expect(basicOption).toHaveScreenshot('mode-option-basic-focused.png');
      
      const venueOption = modal.locator('[data-testid="venue-mode-option"]');
      await venueOption.focus();
      await expect(venueOption).toHaveScreenshot('mode-option-venue-focused.png');
    });

    test('should display high contrast mode correctly', async ({ page }) => {
      // Enable high contrast mode
      await page.emulateMedia({ colorScheme: 'dark' });
      
      const modal = await triggerOnboardingModal(page);
      
      // Take screenshot in high contrast mode
      await expect(modal).toHaveScreenshot('onboarding-high-contrast.png');
      
      // Test each mode option in high contrast
      const basicOption = modal.locator('[data-testid="basic-mode-option"]');
      const venueOption = modal.locator('[data-testid="venue-mode-option"]');
      
      await expect(basicOption).toHaveScreenshot('mode-option-basic-high-contrast.png');
      await expect(venueOption).toHaveScreenshot('mode-option-venue-high-contrast.png');
    });
  });
});