/**
 * Visual Testing Utilities
 * 
 * Shared utilities for visual regression tests to ensure consistency
 * across all test files and provide common functionality.
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 */

import { Page, expect } from '@playwright/test';

// Standard venue configurations for testing
export const STANDARD_CONFIGURATIONS = {
  BASIC_MODE: {
    venue_mode: 'basic',
    authority_mode: 'pos',
    pos_integration_enabled: true,
    printer_required: true,
    onboarding_completed: true,
    authority_configured_at: new Date().toISOString(),
    mode_last_changed_at: new Date().toISOString()
  },
  VENUE_POS: {
    venue_mode: 'venue',
    authority_mode: 'pos',
    pos_integration_enabled: true,
    printer_required: false,
    onboarding_completed: true,
    authority_configured_at: new Date().toISOString(),
    mode_last_changed_at: new Date().toISOString()
  },
  VENUE_TABEZA: {
    venue_mode: 'venue',
    authority_mode: 'tabeza',
    pos_integration_enabled: false,
    printer_required: false,
    onboarding_completed: true,
    authority_configured_at: new Date().toISOString(),
    mode_last_changed_at: new Date().toISOString()
  },
  INCOMPLETE: {
    venue_mode: null,
    authority_mode: null,
    pos_integration_enabled: false,
    printer_required: false,
    onboarding_completed: false
  }
} as const;

// Standard screen sizes for responsive testing
export const SCREEN_SIZES = {
  MOBILE_SMALL: { width: 320, height: 568, name: 'Mobile Small' },
  MOBILE_LARGE: { width: 414, height: 896, name: 'Mobile Large' },
  TABLET_SMALL: { width: 768, height: 1024, name: 'Tablet Small' },
  TABLET_LARGE: { width: 1024, height: 1366, name: 'Tablet Large' },
  DESKTOP_SMALL: { width: 1366, height: 768, name: 'Desktop Small' },
  DESKTOP_LARGE: { width: 1920, height: 1080, name: 'Desktop Large' }
} as const;

// Theme expectations for each configuration
export const THEME_EXPECTATIONS = {
  basic: {
    theme: 'blue',
    icons: ['🖨️', '📱', '💳'],
    description: 'POS Bridge Mode',
    primaryColor: 'bg-blue-500'
  },
  'venue-pos': {
    theme: 'yellow',
    icons: ['📋', '🖨️', '💬'],
    description: 'Hybrid Workflow Mode',
    primaryColor: 'bg-yellow-500'
  },
  'venue-tabeza': {
    theme: 'green',
    icons: ['📋', '💬', '💳', '📊'],
    description: 'Full Service Mode',
    primaryColor: 'bg-green-500'
  }
} as const;

/**
 * Disable animations for consistent visual testing
 */
export async function disableAnimations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
      
      .animate-spin {
        animation: none !important;
      }
      
      .animate-pulse {
        animation: none !important;
      }
      
      .animate-bounce {
        animation: none !important;
      }
    `;
    document.head.appendChild(style);
  });
}

/**
 * Mock venue configuration API with specific config
 */
export async function mockVenueConfiguration(page: Page, config: any): Promise<void> {
  await page.route('**/api/venue-configuration/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(config)
    });
  });
}

/**
 * Mock onboarding API for testing onboarding flows
 */
export async function mockOnboardingAPI(page: Page, shouldFail = false): Promise<void> {
  await page.route('**/api/onboarding/**', async (route) => {
    if (shouldFail) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Onboarding failed' })
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    }
  });
}

/**
 * Wait for theme to be applied to the page
 */
export async function waitForThemeApplication(page: Page, expectedTheme: string): Promise<void> {
  await page.waitForFunction(
    (theme) => {
      const themeElements = document.querySelectorAll(`[class*="bg-${theme}"]`);
      return themeElements.length > 0;
    },
    expectedTheme,
    { timeout: 10000 }
  );
}

/**
 * Wait for component to be fully loaded and stable
 */
export async function waitForComponentStability(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector);
  await expect(element).toBeVisible();
  
  // Wait for any loading states to complete
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      
      // Check for loading indicators
      const loadingElements = el.querySelectorAll('[data-testid*="loading"], .animate-spin, .animate-pulse');
      return loadingElements.length === 0;
    },
    selector,
    { timeout: 10000 }
  );
  
  // Additional wait for any async operations
  await page.waitForTimeout(500);
}

/**
 * Set up standard test environment
 */
export async function setupTestEnvironment(page: Page): Promise<void> {
  // Disable animations
  await disableAnimations(page);
  
  // Set consistent timezone
  await page.emulateTimezone('UTC');
  
  // Set consistent locale
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9'
  });
  
  // Mock any external services that might cause flakiness
  await page.route('**/api/analytics/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true })
    });
  });
}

/**
 * Take a screenshot with consistent options
 */
export async function takeStandardScreenshot(
  element: any, 
  filename: string, 
  options: { fullPage?: boolean } = {}
): Promise<void> {
  await expect(element).toHaveScreenshot(filename, {
    animations: 'disabled',
    threshold: 0.2,
    mode: 'strict',
    ...options
  });
}

/**
 * Test responsive design at all standard breakpoints
 */
export async function testResponsiveDesign(
  page: Page,
  testCallback: (screenSize: typeof SCREEN_SIZES[keyof typeof SCREEN_SIZES]) => Promise<void>
): Promise<void> {
  for (const [key, screenSize] of Object.entries(SCREEN_SIZES)) {
    await page.setViewportSize({ 
      width: screenSize.width, 
      height: screenSize.height 
    });
    
    // Wait for responsive changes to take effect
    await page.waitForTimeout(300);
    
    await testCallback(screenSize);
  }
}

/**
 * Simulate network conditions for testing
 */
export async function simulateNetworkConditions(
  page: Page, 
  condition: 'offline' | 'slow' | 'fast' = 'fast'
): Promise<void> {
  switch (condition) {
    case 'offline':
      await page.setOffline(true);
      break;
    case 'slow':
      await page.route('**/*', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.continue();
      });
      break;
    case 'fast':
    default:
      await page.setOffline(false);
      break;
  }
}

/**
 * Generate test data for venue configurations
 */
export function generateTestData(overrides: Partial<any> = {}): any {
  return {
    id: 'test-venue-id',
    name: 'Test Venue',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Verify theme consistency across elements
 */
export async function verifyThemeConsistency(
  page: Page, 
  expectedTheme: keyof typeof THEME_EXPECTATIONS
): Promise<void> {
  const expectations = THEME_EXPECTATIONS[expectedTheme];
  
  // Check for theme color classes
  const themeElements = page.locator(`[class*="bg-${expectations.theme}"]`);
  await expect(themeElements.first()).toBeVisible();
  
  // Check for theme icons
  for (const icon of expectations.icons) {
    const iconElement = page.locator(`text="${icon}"`).first();
    if (await iconElement.count() > 0) {
      await expect(iconElement).toBeVisible();
    }
  }
  
  // Check for theme description
  const descriptionElement = page.locator(`text="${expectations.description}"`).first();
  if (await descriptionElement.count() > 0) {
    await expect(descriptionElement).toBeVisible();
  }
}

/**
 * Test accessibility features
 */
export async function testAccessibilityFeatures(page: Page): Promise<void> {
  // Test keyboard navigation
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  
  // Test focus visibility
  const focusedElement = page.locator(':focus');
  if (await focusedElement.count() > 0) {
    await expect(focusedElement).toBeVisible();
  }
  
  // Test high contrast mode
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(500);
  
  // Reset to light mode
  await page.emulateMedia({ colorScheme: 'light' });
}

/**
 * Clean up test environment
 */
export async function cleanupTestEnvironment(page: Page): Promise<void> {
  // Clear any mocked routes
  await page.unrouteAll();
  
  // Reset network conditions
  await page.setOffline(false);
  
  // Clear any stored data
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}