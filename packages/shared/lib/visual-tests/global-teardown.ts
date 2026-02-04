/**
 * Global Teardown for Visual Regression Tests
 * 
 * Cleans up test environment after visual regression testing is complete.
 */

import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up visual regression test environment...');
  
  try {
    // Clean up any test data or resources
    delete process.env.VISUAL_TEST_SETUP_COMPLETE;
    
    console.log('✅ Visual regression test environment cleaned up');
    
  } catch (error) {
    console.error('❌ Failed to clean up visual regression test environment:', error);
    // Don't throw here as it would fail the entire test run
  }
}

export default globalTeardown;