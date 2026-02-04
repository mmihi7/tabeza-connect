/**
 * Playwright Configuration for Visual Regression Testing
 * 
 * Tests theme consistency across all venue configurations and screen sizes.
 * Implements Requirements 5.1, 5.2, 5.3 from onboarding-flow-fix specification.
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './lib/visual-tests',
  
  // Global test timeout
  timeout: 30 * 1000,
  
  // Expect timeout for assertions
  expect: {
    // Timeout for visual comparisons
    timeout: 10 * 1000,
    // Visual comparison threshold (0-1, where 0 is identical)
    toHaveScreenshot: { 
      threshold: 0.2,
      mode: 'strict',
      animations: 'disabled'
    },
    toMatchSnapshot: { 
      threshold: 0.2,
      mode: 'strict'
    }
  },

  // Fail the build on CI if the files are missing
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'visual-test-results' }],
    ['json', { outputFile: 'visual-test-results/results.json' }],
    ['list']
  ],

  // Global setup and teardown
  globalSetup: require.resolve('./lib/visual-tests/global-setup.ts'),
  globalTeardown: require.resolve('./lib/visual-tests/global-teardown.ts'),

  use: {
    // Base URL for testing
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3003',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Record video on failure
    video: 'retain-on-failure',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Disable animations for consistent screenshots
    reducedMotion: 'reduce',
    
    // Set viewport for consistent testing
    viewport: { width: 1280, height: 720 },
    
    // Ignore HTTPS errors for local testing
    ignoreHTTPSErrors: true,
    
    // Set user agent
    userAgent: 'Tabeza-Visual-Tests/1.0',
    
    // Set locale
    locale: 'en-US',
    
    // Set timezone
    timezoneId: 'UTC',
    
    // Color scheme
    colorScheme: 'light'
  },

  projects: [
    // Desktop browsers
    {
      name: 'Desktop Chrome',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
    },
    {
      name: 'Desktop Firefox',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      },
    },
    {
      name: 'Desktop Safari',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
    },

    // Tablet devices
    {
      name: 'iPad',
      use: { 
        ...devices['iPad'],
      },
    },
    {
      name: 'iPad Pro',
      use: { 
        ...devices['iPad Pro'],
      },
    },

    // Mobile devices
    {
      name: 'iPhone 12',
      use: { 
        ...devices['iPhone 12'],
      },
    },
    {
      name: 'iPhone 12 Pro',
      use: { 
        ...devices['iPhone 12 Pro'],
      },
    },
    {
      name: 'Pixel 5',
      use: { 
        ...devices['Pixel 5'],
      },
    },
    {
      name: 'Samsung Galaxy S21',
      use: { 
        ...devices['Galaxy S III'],
        viewport: { width: 360, height: 800 }
      },
    },

    // Custom breakpoints for responsive testing
    {
      name: 'Small Mobile',
      use: {
        viewport: { width: 320, height: 568 }
      },
    },
    {
      name: 'Large Mobile',
      use: {
        viewport: { width: 414, height: 896 }
      },
    },
    {
      name: 'Small Tablet',
      use: {
        viewport: { width: 768, height: 1024 }
      },
    },
    {
      name: 'Large Tablet',
      use: {
        viewport: { width: 1024, height: 1366 }
      },
    },
    {
      name: 'Small Desktop',
      use: {
        viewport: { width: 1366, height: 768 }
      },
    },
    {
      name: 'Large Desktop',
      use: {
        viewport: { width: 2560, height: 1440 }
      },
    }
  ],

  // Web server configuration for local testing
  webServer: process.env.CI ? undefined : {
    command: 'pnpm dev:staff',
    port: 3003,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});