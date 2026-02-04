/**
 * Visual Regression Tests for Venue Configuration Display
 * 
 * Tests visual consistency of the venue configuration display component
 * across all venue modes, authority settings, and screen sizes.
 * 
 * Implements Requirements 5.1, 5.2, 5.3, 5.4, 5.5 from onboarding-flow-fix specification.
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 */

import { test, expect, Page } from '@playwright/test';

// Configuration test cases
const CONFIGURATION_TEST_CASES = [
  {
    name: 'Basic Mode Configuration',
    config: {
      venue_mode: 'basic',
      authority_mode: 'pos',
      pos_integration_enabled: true,
      printer_required: true,
      onboarding_completed: true
    },
    expectedTheme: 'blue',
    expectedFeatures: {
      enabled: ['POS Integration', 'Digital Receipts', 'Payment Processing'],
      disabled: ['Customer Menus', 'Customer Ordering', 'Staff Ordering', 'Two-way Messaging']
    },
    expectedLimitations: [
      'POS-Only Order Creation',
      'Traditional Service Required',
      'Printer Setup Required'
    ]
  },
  {
    name: 'Venue Mode with POS Authority',
    config: {
      venue_mode: 'venue',
      authority_mode: 'pos',
      pos_integration_enabled: true,
      printer_required: false,
      onboarding_completed: true
    },
    expectedTheme: 'yellow',
    expectedFeatures: {
      enabled: ['Customer Menus', 'Two-way Messaging', 'Payment Processing', 'POS Integration', 'Customer Order Requests', 'Digital Receipts'],
      disabled: ['Staff Ordering']
    },
    expectedLimitations: [
      'POS Confirmation Required',
      'Dual System Workflow',
      'POS Integration Setup'
    ]
  },
  {
    name: 'Venue Mode with Tabeza Authority',
    config: {
      venue_mode: 'venue',
      authority_mode: 'tabeza',
      pos_integration_enabled: false,
      printer_required: false,
      onboarding_completed: true
    },
    expectedTheme: 'green',
    expectedFeatures: {
      enabled: ['Customer Menus', 'Two-way Messaging', 'Payment Processing', 'Customer Ordering', 'Staff Ordering', 'Digital Receipts', 'Analytics & Reports'],
      disabled: ['POS Integration']
    },
    expectedLimitations: [
      'Tabeza-Only Order Processing',
      'No External POS Integration'
    ]
  }
] as const;

// Helper function to set up configuration display
async function setupConfigurationDisplay(page: Page, config: any) {
  // Mock the venue configuration API
  await page.route('**/api/venue-configuration/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(config)
    });
  });
  
  // Navigate to settings page where configuration display is shown
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  
  // Wait for configuration display to load
  const configDisplay = page.locator('[data-testid="venue-configuration-display"]');
  await expect(configDisplay).toBeVisible({ timeout: 10000 });
  
  return configDisplay;
}

test.describe('Venue Configuration Display Visual Tests', () => {
  
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

  test.describe('Configuration Display by Mode', () => {
    
    for (const testCase of CONFIGURATION_TEST_CASES) {
      test(`should display ${testCase.name} correctly`, async ({ page }) => {
        const configDisplay = await setupConfigurationDisplay(page, testCase.config);
        
        // Take screenshot of entire configuration display
        await expect(configDisplay).toHaveScreenshot(
          `config-display-${testCase.config.venue_mode}-${testCase.config.authority_mode}.png`
        );
        
        // Test header section with theme
        const header = configDisplay.locator('[data-testid="config-header"]');
        if (await header.count() > 0) {
          await expect(header).toHaveScreenshot(
            `config-header-${testCase.config.venue_mode}-${testCase.config.authority_mode}.png`
          );
        }
        
        // Test enabled features section
        const enabledFeatures = configDisplay.locator('[data-testid="enabled-features"]');
        if (await enabledFeatures.count() > 0) {
          await expect(enabledFeatures).toHaveScreenshot(
            `enabled-features-${testCase.config.venue_mode}-${testCase.config.authority_mode}.png`
          );
        }
        
        // Test disabled features section
        const disabledFeatures = configDisplay.locator('[data-testid="disabled-features"]');
        if (await disabledFeatures.count() > 0) {
          await expect(disabledFeatures).toHaveScreenshot(
            `disabled-features-${testCase.config.venue_mode}-${testCase.config.authority_mode}.png`
          );
        }
        
        // Test workflow limitations section
        const limitations = configDisplay.locator('[data-testid="workflow-limitations"]');
        if (await limitations.count() > 0) {
          await expect(limitations).toHaveScreenshot(
            `limitations-${testCase.config.venue_mode}-${testCase.config.authority_mode}.png`
          );
        }
        
        // Test configuration summary section
        const summary = configDisplay.locator('[data-testid="configuration-summary"]');
        if (await summary.count() > 0) {
          await expect(summary).toHaveScreenshot(
            `summary-${testCase.config.venue_mode}-${testCase.config.authority_mode}.png`
          );
        }
        
        // Test theme indicator
        const themeIndicator = configDisplay.locator('[data-testid="theme-indicator"]');
        if (await themeIndicator.count() > 0) {
          await expect(themeIndicator).toHaveScreenshot(
            `theme-indicator-${testCase.config.venue_mode}-${testCase.config.authority_mode}.png`
          );
        }
      });
    }
  });

  test.describe('Feature Display Consistency', () => {
    
    test('should display enabled features with correct styling', async ({ page }) => {
      for (const testCase of CONFIGURATION_TEST_CASES) {
        const configDisplay = await setupConfigurationDisplay(page, testCase.config);
        
        // Check each expected enabled feature
        for (const feature of testCase.expectedFeatures.enabled) {
          const featureElement = configDisplay.locator(`text="${feature}"`).first();
          if (await featureElement.count() > 0) {
            // Get the parent container to capture the full feature display
            const featureContainer = featureElement.locator('..').locator('..');
            await expect(featureContainer).toHaveScreenshot(
              `feature-enabled-${feature.toLowerCase().replace(/\s+/g, '-')}-${testCase.config.venue_mode}-${testCase.config.authority_mode}.png`
            );
          }
        }
      }
    });

    test('should display disabled features with correct styling', async ({ page }) => {
      for (const testCase of CONFIGURATION_TEST_CASES) {
        const configDisplay = await setupConfigurationDisplay(page, testCase.config);
        
        // Check each expected disabled feature
        for (const feature of testCase.expectedFeatures.disabled) {
          const featureElement = configDisplay.locator(`text="${feature}"`).first();
          if (await featureElement.count() > 0) {
            // Get the parent container to capture the full feature display
            const featureContainer = featureElement.locator('..').locator('..');
            await expect(featureContainer).toHaveScreenshot(
              `feature-disabled-${feature.toLowerCase().replace(/\s+/g, '-')}-${testCase.config.venue_mode}-${testCase.config.authority_mode}.png`
            );
          }
        }
      }
    });
  });

  test.describe('Responsive Configuration Display', () => {
    
    const breakpoints = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1440, height: 900 }
    ];

    for (const breakpoint of breakpoints) {
      test(`should display correctly on ${breakpoint.name}`, async ({ page }) => {
        // Set viewport size
        await page.setViewportSize({ 
          width: breakpoint.width, 
          height: breakpoint.height 
        });
        
        for (const testCase of CONFIGURATION_TEST_CASES) {
          const configDisplay = await setupConfigurationDisplay(page, testCase.config);
          
          // Take screenshot at this breakpoint
          await expect(configDisplay).toHaveScreenshot(
            `config-display-${testCase.config.venue_mode}-${testCase.config.authority_mode}-${breakpoint.name.toLowerCase()}.png`
          );
          
          // Test grid layout responsiveness
          const featuresGrid = configDisplay.locator('[data-testid="features-grid"]');
          if (await featuresGrid.count() > 0) {
            await expect(featuresGrid).toHaveScreenshot(
              `features-grid-${testCase.config.venue_mode}-${testCase.config.authority_mode}-${breakpoint.name.toLowerCase()}.png`
            );
          }
        }
      });
    }
  });

  test.describe('Interactive Elements', () => {
    
    test('should display tooltips correctly', async ({ page }) => {
      const configDisplay = await setupConfigurationDisplay(page, CONFIGURATION_TEST_CASES[0].config);
      
      // Find tooltip triggers
      const tooltipTriggers = configDisplay.locator('[data-testid="tooltip-trigger"]');
      const triggerCount = await tooltipTriggers.count();
      
      for (let i = 0; i < Math.min(triggerCount, 3); i++) {
        const trigger = tooltipTriggers.nth(i);
        
        // Hover to show tooltip
        await trigger.hover();
        await page.waitForTimeout(500);
        
        // Take screenshot with tooltip visible
        await expect(configDisplay).toHaveScreenshot(
          `tooltip-${i}-visible.png`
        );
        
        // Move away to hide tooltip
        await page.mouse.move(0, 0);
        await page.waitForTimeout(300);
      }
    });

    test('should display expandable sections correctly', async ({ page }) => {
      const configDisplay = await setupConfigurationDisplay(page, CONFIGURATION_TEST_CASES[1].config);
      
      // Find expandable sections
      const expandableSections = configDisplay.locator('[data-testid="expandable-section"]');
      const sectionCount = await expandableSections.count();
      
      for (let i = 0; i < sectionCount; i++) {
        const section = expandableSections.nth(i);
        
        // Take screenshot in collapsed state
        await expect(section).toHaveScreenshot(
          `expandable-section-${i}-collapsed.png`
        );
        
        // Click to expand
        const expandButton = section.locator('[data-testid="expand-button"]');
        if (await expandButton.count() > 0) {
          await expandButton.click();
          await page.waitForTimeout(300);
          
          // Take screenshot in expanded state
          await expect(section).toHaveScreenshot(
            `expandable-section-${i}-expanded.png`
          );
        }
      }
    });
  });

  test.describe('Theme Integration', () => {
    
    test('should apply theme colors consistently', async ({ page }) => {
      for (const testCase of CONFIGURATION_TEST_CASES) {
        const configDisplay = await setupConfigurationDisplay(page, testCase.config);
        
        // Test theme-specific color elements
        const themeElements = configDisplay.locator(`[class*="bg-${testCase.expectedTheme}"]`);
        const elementCount = await themeElements.count();
        
        for (let i = 0; i < Math.min(elementCount, 5); i++) {
          const element = themeElements.nth(i);
          await expect(element).toHaveScreenshot(
            `theme-element-${testCase.expectedTheme}-${i}.png`
          );
        }
        
        // Test theme-specific text colors
        const textElements = configDisplay.locator(`[class*="text-${testCase.expectedTheme}"]`);
        const textCount = await textElements.count();
        
        for (let i = 0; i < Math.min(textCount, 3); i++) {
          const element = textElements.nth(i);
          await expect(element).toHaveScreenshot(
            `theme-text-${testCase.expectedTheme}-${i}.png`
          );
        }
      }
    });

    test('should display theme icons correctly', async ({ page }) => {
      for (const testCase of CONFIGURATION_TEST_CASES) {
        const configDisplay = await setupConfigurationDisplay(page, testCase.config);
        
        // Test theme icon container
        const iconContainer = configDisplay.locator('[data-testid="theme-icons"]');
        if (await iconContainer.count() > 0) {
          await expect(iconContainer).toHaveScreenshot(
            `theme-icons-${testCase.config.venue_mode}-${testCase.config.authority_mode}.png`
          );
        }
        
        // Test individual feature icons
        const featureIcons = configDisplay.locator('[data-testid="feature-icon"]');
        const iconCount = await featureIcons.count();
        
        for (let i = 0; i < Math.min(iconCount, 5); i++) {
          const icon = featureIcons.nth(i);
          await expect(icon).toHaveScreenshot(
            `feature-icon-${i}-${testCase.config.venue_mode}-${testCase.config.authority_mode}.png`
          );
        }
      }
    });
  });

  test.describe('Error and Loading States', () => {
    
    test('should display loading state correctly', async ({ page }) => {
      // Mock slow API response
      await page.route('**/api/venue-configuration/**', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(CONFIGURATION_TEST_CASES[0].config)
        });
      });
      
      // Navigate to settings
      await page.goto('/settings');
      
      // Take screenshot of loading state
      const loadingElement = page.locator('[data-testid="config-loading"]');
      if (await loadingElement.count() > 0) {
        await expect(loadingElement).toHaveScreenshot('config-display-loading.png');
      }
    });

    test('should display error state correctly', async ({ page }) => {
      // Mock API error
      await page.route('**/api/venue-configuration/**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to load configuration' })
        });
      });
      
      // Navigate to settings
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      // Take screenshot of error state
      const errorElement = page.locator('[data-testid="config-error"]');
      if (await errorElement.count() > 0) {
        await expect(errorElement).toHaveScreenshot('config-display-error.png');
      }
    });
  });
});