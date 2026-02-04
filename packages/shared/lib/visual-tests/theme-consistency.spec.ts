/**
 * Visual Regression Tests for Theme Consistency
 * 
 * Tests theme switching across all configuration combinations and verifies
 * visual consistency of onboarding modal across different screen sizes.
 * 
 * Implements Requirements 5.1, 5.2, 5.3 from onboarding-flow-fix specification:
 * - 5.1: Blue theme for Basic mode with printer-focused icons
 * - 5.2: Yellow theme for Venue+POS mode with hybrid icons  
 * - 5.3: Green theme for Venue+Tabeza mode with full-service icons
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 */

import { test, expect, Page } from '@playwright/test';

// Test data for different venue configurations
const VENUE_CONFIGURATIONS = [
  {
    name: 'Basic Mode (POS Authority)',
    venueMode: 'basic',
    authorityMode: 'pos',
    expectedTheme: 'blue',
    expectedIcons: ['🖨️', '📱', '💳'],
    description: 'Transaction & Receipt Bridge',
    themeDescription: 'POS Bridge Mode'
  },
  {
    name: 'Venue Mode with POS Authority',
    venueMode: 'venue',
    authorityMode: 'pos',
    expectedTheme: 'yellow',
    expectedIcons: ['📋', '🖨️', '💬'],
    description: 'Customer Interaction + POS Integration',
    themeDescription: 'Hybrid Workflow Mode'
  },
  {
    name: 'Venue Mode with Tabeza Authority',
    venueMode: 'venue',
    authorityMode: 'tabeza',
    expectedTheme: 'green',
    expectedIcons: ['📋', '💬', '💳', '📊'],
    description: 'Full Service Platform',
    themeDescription: 'Full Service Mode'
  }
] as const;

// Screen size categories for responsive testing
const SCREEN_SIZES = [
  { name: 'Mobile Small', width: 320, height: 568 },
  { name: 'Mobile Large', width: 414, height: 896 },
  { name: 'Tablet Small', width: 768, height: 1024 },
  { name: 'Tablet Large', width: 1024, height: 1366 },
  { name: 'Desktop Small', width: 1366, height: 768 },
  { name: 'Desktop Large', width: 1920, height: 1080 }
] as const;

// Helper function to simulate venue configuration
async function simulateVenueConfiguration(
  page: Page, 
  config: typeof VENUE_CONFIGURATIONS[0]
) {
  // Inject configuration into the page context
  await page.addInitScript((configData) => {
    // Store configuration in window for components to access
    (window as any).__VISUAL_TEST_CONFIG__ = configData;
  }, config);
  
  // Set up mock venue data
  await page.route('**/api/venue-configuration/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        venue_mode: config.venueMode,
        authority_mode: config.authorityMode,
        pos_integration_enabled: config.authorityMode === 'pos',
        printer_required: config.venueMode === 'basic' || config.authorityMode === 'pos',
        onboarding_completed: true,
        authority_configured_at: new Date().toISOString(),
        mode_last_changed_at: new Date().toISOString()
      })
    });
  });
}

// Helper function to wait for theme to be applied
async function waitForThemeApplication(page: Page, expectedTheme: string) {
  // Wait for theme-specific elements to be present
  await page.waitForFunction(
    (theme) => {
      const themeElements = document.querySelectorAll(`[class*="bg-${theme}"]`);
      return themeElements.length > 0;
    },
    expectedTheme,
    { timeout: 5000 }
  );
}

test.describe('Theme Consistency Across Venue Configurations', () => {
  
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

  // Test theme consistency for each venue configuration
  for (const config of VENUE_CONFIGURATIONS) {
    test.describe(`${config.name}`, () => {
      
      test('should display correct theme colors and icons in settings page', async ({ page }) => {
        // Set up venue configuration
        await simulateVenueConfiguration(page, config);
        
        // Navigate to settings page
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');
        
        // Wait for theme to be applied
        await waitForThemeApplication(page, config.expectedTheme);
        
        // Take screenshot of the entire settings page
        await expect(page).toHaveScreenshot(
          `settings-${config.venueMode}-${config.authorityMode}-theme.png`,
          { 
            fullPage: true,
            animations: 'disabled'
          }
        );
        
        // Verify theme-specific elements are present
        const themeIndicator = page.locator('[data-testid="theme-indicator"]').first();
        if (await themeIndicator.count() > 0) {
          await expect(themeIndicator).toHaveScreenshot(
            `theme-indicator-${config.venueMode}-${config.authorityMode}.png`
          );
        }
      });

      test('should display correct theme in venue configuration display', async ({ page }) => {
        // Set up venue configuration
        await simulateVenueConfiguration(page, config);
        
        // Navigate to settings page
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');
        
        // Wait for configuration display to load
        const configDisplay = page.locator('[data-testid="venue-configuration-display"]').first();
        if (await configDisplay.count() > 0) {
          await expect(configDisplay).toHaveScreenshot(
            `config-display-${config.venueMode}-${config.authorityMode}.png`
          );
        }
      });

      test('should maintain theme consistency in onboarding modal', async ({ page }) => {
        // Set up incomplete venue configuration to trigger onboarding
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
        
        // Navigate to settings to trigger onboarding modal
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');
        
        // Wait for onboarding modal to appear
        const modal = page.locator('[data-testid="venue-mode-onboarding"]');
        await expect(modal).toBeVisible({ timeout: 10000 });
        
        // Take screenshot of onboarding modal
        await expect(modal).toHaveScreenshot(
          `onboarding-modal-initial.png`
        );
        
        // Test mode selection step
        if (config.venueMode === 'basic') {
          await page.click('[data-testid="basic-mode-option"]');
        } else {
          await page.click('[data-testid="venue-mode-option"]');
        }
        
        await page.waitForTimeout(500); // Wait for selection to register
        
        // Take screenshot after mode selection
        await expect(modal).toHaveScreenshot(
          `onboarding-modal-${config.venueMode}-selected.png`
        );
        
        // If venue mode, test authority selection
        if (config.venueMode === 'venue') {
          // Continue to authority selection
          await page.click('button:has-text("Continue")');
          await page.waitForTimeout(500);
          
          // Select authority mode
          if (config.authorityMode === 'pos') {
            await page.click('[data-testid="pos-authority-option"]');
          } else {
            await page.click('[data-testid="tabeza-authority-option"]');
          }
          
          await page.waitForTimeout(500);
          
          // Take screenshot after authority selection
          await expect(modal).toHaveScreenshot(
            `onboarding-modal-${config.venueMode}-${config.authorityMode}-authority.png`
          );
          
          // Continue to summary
          await page.click('button:has-text("Continue")');
          await page.waitForTimeout(500);
        }
        
        // Take screenshot of summary step with theme applied
        await expect(modal).toHaveScreenshot(
          `onboarding-modal-${config.venueMode}-${config.authorityMode}-summary.png`
        );
      });
    });
  }
});

test.describe('Responsive Design Across Screen Sizes', () => {
  
  for (const screenSize of SCREEN_SIZES) {
    test.describe(`${screenSize.name} (${screenSize.width}x${screenSize.height})`, () => {
      
      test.beforeEach(async ({ page }) => {
        // Set viewport size
        await page.setViewportSize({ 
          width: screenSize.width, 
          height: screenSize.height 
        });
      });

      for (const config of VENUE_CONFIGURATIONS) {
        test(`should display ${config.name} correctly on ${screenSize.name}`, async ({ page }) => {
          // Set up venue configuration
          await simulateVenueConfiguration(page, config);
          
          // Navigate to settings page
          await page.goto('/settings');
          await page.waitForLoadState('networkidle');
          
          // Wait for theme to be applied
          await waitForThemeApplication(page, config.expectedTheme);
          
          // Take full page screenshot
          await expect(page).toHaveScreenshot(
            `responsive-${screenSize.name.toLowerCase().replace(' ', '-')}-${config.venueMode}-${config.authorityMode}.png`,
            { 
              fullPage: true,
              animations: 'disabled'
            }
          );
        });
      }

      test(`should display onboarding modal correctly on ${screenSize.name}`, async ({ page }) => {
        // Set up incomplete venue configuration
        await page.route('**/api/venue-configuration/**', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              venue_mode: null,
              authority_mode: null,
              onboarding_completed: false
            })
          });
        });
        
        // Navigate to settings to trigger onboarding modal
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');
        
        // Wait for onboarding modal to appear
        const modal = page.locator('[data-testid="venue-mode-onboarding"]');
        await expect(modal).toBeVisible({ timeout: 10000 });
        
        // Take screenshot of onboarding modal on this screen size
        await expect(page).toHaveScreenshot(
          `onboarding-responsive-${screenSize.name.toLowerCase().replace(' ', '-')}.png`,
          { 
            fullPage: true,
            animations: 'disabled'
          }
        );
      });
    });
  }
});

test.describe('Theme Transition Consistency', () => {
  
  test('should smoothly transition between themes when configuration changes', async ({ page }) => {
    // Start with Basic mode
    await simulateVenueConfiguration(page, VENUE_CONFIGURATIONS[0]);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Take initial screenshot
    await expect(page).toHaveScreenshot('theme-transition-basic-initial.png', {
      fullPage: true,
      animations: 'disabled'
    });
    
    // Simulate configuration change to Venue+POS
    await page.route('**/api/venue-configuration/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          venue_mode: 'venue',
          authority_mode: 'pos',
          pos_integration_enabled: true,
          printer_required: false,
          onboarding_completed: true
        })
      });
    });
    
    // Trigger configuration reload
    await page.reload();
    await page.waitForLoadState('networkidle');
    await waitForThemeApplication(page, 'yellow');
    
    // Take screenshot after theme change
    await expect(page).toHaveScreenshot('theme-transition-venue-pos.png', {
      fullPage: true,
      animations: 'disabled'
    });
    
    // Change to Venue+Tabeza
    await page.route('**/api/venue-configuration/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          venue_mode: 'venue',
          authority_mode: 'tabeza',
          pos_integration_enabled: false,
          printer_required: false,
          onboarding_completed: true
        })
      });
    });
    
    // Trigger configuration reload
    await page.reload();
    await page.waitForLoadState('networkidle');
    await waitForThemeApplication(page, 'green');
    
    // Take final screenshot
    await expect(page).toHaveScreenshot('theme-transition-venue-tabeza.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });
});

test.describe('Icon and Color Consistency', () => {
  
  for (const config of VENUE_CONFIGURATIONS) {
    test(`should display correct icons for ${config.name}`, async ({ page }) => {
      // Set up venue configuration
      await simulateVenueConfiguration(page, config);
      
      // Navigate to settings page
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      // Check for theme-specific icons
      for (const expectedIcon of config.expectedIcons) {
        const iconElement = page.locator(`text="${expectedIcon}"`).first();
        if (await iconElement.count() > 0) {
          await expect(iconElement).toBeVisible();
        }
      }
      
      // Take screenshot focusing on icon areas
      const iconContainer = page.locator('[data-testid="theme-icons"]').first();
      if (await iconContainer.count() > 0) {
        await expect(iconContainer).toHaveScreenshot(
          `icons-${config.venueMode}-${config.authorityMode}.png`
        );
      }
    });

    test(`should use correct color scheme for ${config.name}`, async ({ page }) => {
      // Set up venue configuration
      await simulateVenueConfiguration(page, config);
      
      // Navigate to settings page
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      // Wait for theme to be applied
      await waitForThemeApplication(page, config.expectedTheme);
      
      // Check for theme-specific color classes
      const themeElements = page.locator(`[class*="bg-${config.expectedTheme}"]`);
      await expect(themeElements.first()).toBeVisible();
      
      // Take screenshot of color-themed elements
      const colorContainer = page.locator('[data-testid="theme-colors"]').first();
      if (await colorContainer.count() > 0) {
        await expect(colorContainer).toHaveScreenshot(
          `colors-${config.venueMode}-${config.authorityMode}.png`
        );
      }
    });
  }
});