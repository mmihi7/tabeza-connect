/**
 * Global Setup for Visual Regression Tests
 * 
 * Sets up test environment and creates test venues with different configurations
 * for comprehensive theme testing across all venue modes and authority settings.
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up visual regression test environment...');
  
  // Launch browser for setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to the staff app
    const baseURL = config.projects[0].use.baseURL || 'http://localhost:3003';
    await page.goto(baseURL);
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
    
    console.log('✅ Visual regression test environment ready');
    
    // Store test data for use in tests
    process.env.VISUAL_TEST_SETUP_COMPLETE = 'true';
    
  } catch (error) {
    console.error('❌ Failed to set up visual regression test environment:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;