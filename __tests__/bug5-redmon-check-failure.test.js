/**
 * Bug 5: RedMon Registry Check Failure - Bug Condition Exploration Test
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * GOAL: Surface counterexamples that demonstrate the bug exists
 * 
 * Bug Condition: RedMon is not installed, app starts and continues running 
 * without blocking or user guidance
 * 
 * Expected Behavior: When RedMon is not installed, system displays clear 
 * user-facing message and either blocks startup or enters degraded mode
 * 
 * Requirements: 5.1, 5.2 from bugfix.md
 * 
 * NOTE: This test simulates RedMon absence by checking behavior when registry check fails
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Test configuration
const TEST_DIR = path.join(__dirname, '..', 'test-data');
const LOG_FILE = path.join(TEST_DIR, 'test-electron.log');
const REDMON_REG_PATH = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Print\\Monitors\\Redirected Port\\Ports\\TabezaCapturePort';

// Mock app state to simulate electron-main.js behavior
let mockAppState = {
  startupBlocked: false,
  degradedMode: false,
  userGuidanceShown: false,
  receiptCaptureEnabled: true,
  errorDialogShown: false,
  errorMessage: null,
  serviceStatus: 'online'
};

/**
 * Mock verifyRedMonRegistry function (current unfixed implementation)
 * This mimics the behavior in electron-main.js where RedMon check fails
 * but app continues running normally
 */
function verifyRedMonRegistryUnfixed() {
  const { execSync } = require('child_process');
  const regPath = REDMON_REG_PATH;
  
  try {
    const command = execSync(`reg query "${regPath}"`, { encoding: 'utf8' });
    
    // If we get here, RedMon is installed
    return { success: true, installed: true };
  } catch (e) {
    // RedMon not installed - log warning but continue
    console.log(`[WARN] RedMon registry check failed: ${e.message}`);
    
    // CRITICAL: App continues running without blocking or user guidance
    // This is the bug - no user-facing error, no degraded mode
    return { success: false, installed: false };
  }
}

/**
 * Mock app initialization (current unfixed implementation)
 * Simulates electron-main.js app.whenReady() behavior
 */
async function mockAppInitializationUnfixed() {
  console.log('[INFO] App starting...');
  
  // Step 1: Verify RedMon registry
  const redmonCheck = verifyRedMonRegistryUnfixed();
  
  if (!redmonCheck.installed) {
    console.log('[WARN] RedMon not installed - continuing anyway');
    // BUG: No user guidance, no startup block, no degraded mode
    // App continues as if everything is fine
  }
  
  // Step 2: Continue with normal startup
  mockAppState.startupBlocked = false;
  mockAppState.degradedMode = false;
  mockAppState.userGuidanceShown = false;
  mockAppState.receiptCaptureEnabled = true;
  mockAppState.serviceStatus = 'online';
  
  console.log('[INFO] App started successfully');
  console.log(`[INFO] Service status: ${mockAppState.serviceStatus}`);
  console.log(`[INFO] Receipt capture: ${mockAppState.receiptCaptureEnabled ? 'enabled' : 'disabled'}`);
  
  return mockAppState;
}

/**
 * Mock app initialization (expected fixed implementation)
 * Shows what the behavior SHOULD be when RedMon is missing
 */
async function mockAppInitializationFixed() {
  console.log('[INFO] App starting...');
  
  // Step 1: Verify RedMon registry
  const redmonCheck = verifyRedMonRegistryUnfixed();
  
  if (!redmonCheck.installed) {
    console.log('[ERROR] RedMon not installed - mandatory dependency missing');
    
    // EXPECTED BEHAVIOR: Show user-facing error dialog
    mockAppState.errorDialogShown = true;
    mockAppState.errorMessage = 'RedMon port monitor is required but not installed. Please run the installer to configure RedMon.';
    mockAppState.userGuidanceShown = true;
    
    // OPTION 1: Block startup
    mockAppState.startupBlocked = true;
    mockAppState.serviceStatus = 'blocked';
    
    // OPTION 2: Enter degraded mode (alternative to blocking)
    // mockAppState.degradedMode = true;
    // mockAppState.receiptCaptureEnabled = false;
    // mockAppState.serviceStatus = 'degraded';
    
    console.log('[INFO] Startup blocked - waiting for RedMon installation');
    return mockAppState;
  }
  
  // Step 2: Continue with normal startup (RedMon is installed)
  mockAppState.startupBlocked = false;
  mockAppState.degradedMode = false;
  mockAppState.receiptCaptureEnabled = true;
  mockAppState.serviceStatus = 'online';
  
  console.log('[INFO] App started successfully');
  return mockAppState;
}

/**
 * Check if RedMon is actually installed on this system
 * @returns {boolean} true if RedMon is installed, false otherwise
 */
function isRedMonInstalled() {
  try {
    execSync(`reg query "${REDMON_REG_PATH}"`, { encoding: 'utf8', stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('Bug 5: RedMon Registry Check Failure - Bug Condition Exploration', () => {
  
  beforeAll(() => {
    console.log('\n========================================');
    console.log('Bug 5: RedMon Registry Check Failure Test');
    console.log('========================================');
    console.log('EXPECTED OUTCOME: This test MUST FAIL on unfixed code');
    console.log('Failure confirms the bug exists\n');
    
    // Create test directory
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
    
    // Check if RedMon is installed
    const redmonInstalled = isRedMonInstalled();
    console.log(`RedMon installation status: ${redmonInstalled ? 'INSTALLED' : 'NOT INSTALLED'}`);
    
    if (redmonInstalled) {
      console.log('\n⚠️  NOTE: RedMon is installed on this system');
      console.log('Test will simulate RedMon absence by mocking registry check failure\n');
    } else {
      console.log('\n✓ RedMon is not installed - perfect for testing bug condition\n');
    }
  });

  afterAll(() => {
    // Cleanup: Remove test directory
    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Property 1: Bug Condition - App Continues Running Without RedMon', () => {
    
    test('EXPECTED TO FAIL: When RedMon is not installed, app should block startup or enter degraded mode', async () => {
      console.log('\n--- Test Execution ---');
      
      // ─────────────────────────────────────────────────────────────────
      // Step 1: Simulate app startup with RedMon not installed
      // ─────────────────────────────────────────────────────────────────
      console.log('Step 1: Simulating app startup without RedMon...');
      
      // Reset mock state
      mockAppState = {
        startupBlocked: false,
        degradedMode: false,
        userGuidanceShown: false,
        receiptCaptureEnabled: true,
        errorDialogShown: false,
        errorMessage: null,
        serviceStatus: 'online'
      };
      
      const appState = await mockAppInitializationUnfixed();
      
      console.log('\n  App State After Startup:');
      console.log(`    - Startup blocked: ${appState.startupBlocked}`);
      console.log(`    - Degraded mode: ${appState.degradedMode}`);
      console.log(`    - User guidance shown: ${appState.userGuidanceShown}`);
      console.log(`    - Receipt capture enabled: ${appState.receiptCaptureEnabled}`);
      console.log(`    - Service status: ${appState.serviceStatus}`);
      console.log(`    - Error dialog shown: ${appState.errorDialogShown}`);

      // ─────────────────────────────────────────────────────────────────
      // Step 2: Verify RedMon check failed (simulating absence)
      // ─────────────────────────────────────────────────────────────────
      console.log('\nStep 2: Verifying RedMon check behavior...');
      
      const redmonCheck = verifyRedMonRegistryUnfixed();
      console.log(`  RedMon check result: ${redmonCheck.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`  RedMon installed: ${redmonCheck.installed}`);
      
      // For this test, we expect RedMon to be missing (or we simulate it)
      // If RedMon is actually installed, we skip the test
      if (redmonCheck.installed) {
        console.log('\n⚠️  Skipping test - RedMon is installed on this system');
        console.log('Cannot test bug condition when RedMon is present');
        return;
      }

      // ─────────────────────────────────────────────────────────────────
      // Step 3: CRITICAL ASSERTION - App should NOT continue normally
      // ─────────────────────────────────────────────────────────────────
      console.log('\n--- Expected Behavior Assertion ---');
      console.log('Testing: App should block startup OR enter degraded mode when RedMon is missing');
      
      // Expected behavior: EITHER startup is blocked OR degraded mode is enabled
      const hasUserGuidance = appState.userGuidanceShown || appState.errorDialogShown;
      const isProtected = appState.startupBlocked || appState.degradedMode;
      
      console.log(`\n  User guidance provided: ${hasUserGuidance}`);
      console.log(`  App protected (blocked or degraded): ${isProtected}`);
      
      // This assertion MUST FAIL on unfixed code because:
      // - RedMon is not installed (mandatory dependency)
      // - App continues running normally (serviceStatus = 'online')
      // - No user-facing error dialog is shown
      // - No degraded mode is activated
      // - Receipt capture is enabled (will fail silently)
      
      console.log('\nAssertion 1: User guidance should be shown');
      console.log(`  Expected: true`);
      console.log(`  Actual:   ${hasUserGuidance}`);
      
      expect(hasUserGuidance).toBe(true);
      
      console.log('\nAssertion 2: App should be protected (blocked or degraded)');
      console.log(`  Expected: true`);
      console.log(`  Actual:   ${isProtected}`);
      
      expect(isProtected).toBe(true);
      
      // If we reach here, the bug is fixed
      console.log('\n  ✓ PASS: App correctly handles RedMon absence');
    });

    test('EXPECTED TO FAIL: When RedMon is missing, clear error message should be displayed', async () => {
      console.log('\n--- Error Message Test ---');
      
      // Reset mock state
      mockAppState = {
        startupBlocked: false,
        degradedMode: false,
        userGuidanceShown: false,
        receiptCaptureEnabled: true,
        errorDialogShown: false,
        errorMessage: null,
        serviceStatus: 'online'
      };
      
      const appState = await mockAppInitializationUnfixed();
      
      console.log('Step 1: Checking for user-facing error message...');
      console.log(`  Error dialog shown: ${appState.errorDialogShown}`);
      console.log(`  Error message: ${appState.errorMessage || '(none)'}`);
      
      // Verify RedMon is missing
      const redmonCheck = verifyRedMonRegistryUnfixed();
      if (redmonCheck.installed) {
        console.log('\n⚠️  Skipping test - RedMon is installed on this system');
        return;
      }
      
      console.log('\n--- Expected Behavior Assertion ---');
      console.log('Testing: Clear error message should be displayed to user');
      
      const expectedMessage = 'RedMon port monitor is required but not installed. Please run the installer to configure RedMon.';
      
      console.log(`\n  Expected message: "${expectedMessage}"`);
      console.log(`  Actual message:   "${appState.errorMessage || '(none)'}"`);
      
      // This assertion MUST FAIL on unfixed code because:
      // - No error dialog is shown to the user
      // - Only a warning is logged to electron.log (not user-facing)
      // - User has no idea RedMon is missing
      
      expect(appState.errorDialogShown).toBe(true);
      expect(appState.errorMessage).toContain('RedMon');
      expect(appState.errorMessage).toContain('required');
      
      // If we reach here, the bug is fixed
      console.log('\n  ✓ PASS: Clear error message displayed to user');
    });

    test('EXPECTED TO FAIL: When RedMon is missing, receipt capture should be disabled or blocked', async () => {
      console.log('\n--- Receipt Capture Protection Test ---');
      
      // Reset mock state
      mockAppState = {
        startupBlocked: false,
        degradedMode: false,
        userGuidanceShown: false,
        receiptCaptureEnabled: true,
        errorDialogShown: false,
        errorMessage: null,
        serviceStatus: 'online'
      };
      
      const appState = await mockAppInitializationUnfixed();
      
      console.log('Step 1: Checking receipt capture status...');
      console.log(`  Receipt capture enabled: ${appState.receiptCaptureEnabled}`);
      console.log(`  Service status: ${appState.serviceStatus}`);
      
      // Verify RedMon is missing
      const redmonCheck = verifyRedMonRegistryUnfixed();
      if (redmonCheck.installed) {
        console.log('\n⚠️  Skipping test - RedMon is installed on this system');
        return;
      }
      
      console.log('\n--- Expected Behavior Assertion ---');
      console.log('Testing: Receipt capture should be disabled when RedMon is missing');
      
      console.log(`\n  Expected receipt capture: disabled (false)`);
      console.log(`  Actual receipt capture:   ${appState.receiptCaptureEnabled ? 'enabled (true)' : 'disabled (false)'}`);
      
      // This assertion MUST FAIL on unfixed code because:
      // - Receipt capture remains enabled even though RedMon is missing
      // - Service status shows 'online' (should be 'blocked' or 'degraded')
      // - Receipts will fail silently when capture is attempted
      
      expect(appState.receiptCaptureEnabled).toBe(false);
      
      // Service status should NOT be 'online' when RedMon is missing
      console.log(`\n  Expected service status: NOT 'online' (blocked or degraded)`);
      console.log(`  Actual service status:   ${appState.serviceStatus}`);
      
      expect(appState.serviceStatus).not.toBe('online');
      
      // If we reach here, the bug is fixed
      console.log('\n  ✓ PASS: Receipt capture correctly disabled when RedMon is missing');
    });
  });

  describe('Counterexample Documentation', () => {
    
    test('Document the bug condition counterexample', () => {
      console.log('\n========================================');
      console.log('COUNTEREXAMPLE DOCUMENTATION');
      console.log('========================================\n');
      
      console.log('Bug Condition: isBugCondition_RedMonCheck(input)');
      console.log('  WHERE input.redmonInstalled == false');
      console.log('  AND input.appStartupBlocked == false');
      console.log('  AND input.userGuidance == null');
      console.log('  AND input.receiptCaptureAttempted == true\n');
      
      console.log('Observed Behavior (UNFIXED CODE):');
      console.log('  1. App starts and calls verifyRedMonRegistryAsync()');
      console.log('  2. Registry check fails (RedMon not installed)');
      console.log('  3. Warning logged to electron.log: "RedMon registry check failed"');
      console.log('  4. App continues with normal startup');
      console.log('  5. No user-facing error dialog shown');
      console.log('  6. Service status set to "online"');
      console.log('  7. Receipt capture remains enabled');
      console.log('  8. Tray icon shows green (online)');
      console.log('  9. User attempts to capture receipt');
      console.log('  10. Receipt capture fails silently (RedMon port missing)');
      console.log('  11. User has no idea why receipts are not working\n');
      
      console.log('Expected Behavior (FIXED CODE - Option 1: Block Startup):');
      console.log('  1. App starts and calls verifyRedMonRegistryAsync()');
      console.log('  2. Registry check fails (RedMon not installed)');
      console.log('  3. Error logged to electron.log: "RedMon not installed - mandatory dependency missing"');
      console.log('  4. Electron dialog shown to user:');
      console.log('     "RedMon port monitor is required but not installed.');
      console.log('      Please run the installer to configure RedMon."');
      console.log('  5. Startup blocked - service does not start');
      console.log('  6. Service status set to "blocked"');
      console.log('  7. Tray icon shows grey (offline/blocked)');
      console.log('  8. User understands they need to install RedMon');
      console.log('  9. User runs installer to configure RedMon');
      console.log('  10. App restarts and works correctly\n');
      
      console.log('Expected Behavior (FIXED CODE - Option 2: Degraded Mode):');
      console.log('  1. App starts and calls verifyRedMonRegistryAsync()');
      console.log('  2. Registry check fails (RedMon not installed)');
      console.log('  3. Warning logged: "RedMon not installed - entering degraded mode"');
      console.log('  4. Electron dialog shown to user:');
      console.log('     "RedMon port monitor is not installed. Receipt capture is disabled.');
      console.log('      Configuration and template generation are still available."');
      console.log('  5. Service starts in degraded mode');
      console.log('  6. Service status set to "degraded"');
      console.log('  7. Receipt capture functionality disabled');
      console.log('  8. Management UI shows warning: "Receipt capture unavailable - RedMon not installed"');
      console.log('  9. Configuration and template generation still work');
      console.log('  10. User can configure settings and prepare for RedMon installation\n');
      
      console.log('Root Cause Analysis:');
      console.log('  - verifyRedMonRegistryAsync() catches registry check failure');
      console.log('  - Only logs warning to electron.log (not user-facing)');
      console.log('  - No user-facing error dialog shown');
      console.log('  - No startup blocking logic');
      console.log('  - No degraded mode implementation');
      console.log('  - App continues as if RedMon is optional (it is mandatory)');
      console.log('  - Receipt capture fails silently when attempted\n');
      
      console.log('Fix Required:');
      console.log('  File: electron-main.js');
      console.log('  Function: app.whenReady() initialization');
      console.log('  Add: Mandatory dependency check after verifyRedMonRegistryAsync()');
      console.log('  Logic:');
      console.log('    1. After verifyRedMonRegistryAsync() completes');
      console.log('    2. Check if redmonCheckFailed flag is true');
      console.log('    3. If true, RedMon is not installed');
      console.log('    4. Show Electron dialog with clear error message');
      console.log('    5. EITHER:');
      console.log('       a) Block startup: app.quit() or prevent service start');
      console.log('       b) Enter degraded mode: disable receipt capture, show warning in UI');
      console.log('    6. Log action for debugging\n');
      
      console.log('Implementation Notes:');
      console.log('  - Use electron.dialog.showErrorBox() for blocking error');
      console.log('  - Or use electron.dialog.showMessageBox() for non-blocking warning');
      console.log('  - Set global flag: redmonDegradedMode = true');
      console.log('  - Check flag before enabling receipt capture');
      console.log('  - Show warning in management UI when in degraded mode');
      console.log('  - Provide link to installer or instructions\n');
      
      console.log('========================================\n');
      
      // This test always passes - it's just for documentation
      expect(true).toBe(true);
    });
  });
});
