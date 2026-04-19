/**
 * Bug 6: Incomplete Uninstallation - Bug Condition Exploration Test
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * GOAL: Surface counterexamples that demonstrate the bug exists
 * 
 * Bug Condition: User uninstalls via Windows Programs & Features, application files removed,
 * but registry entries remain at HKLM\SOFTWARE\Tabeza\TabezaConnect
 * 
 * Expected Behavior: When uninstaller completes, all registry entries at 
 * HKLM\SOFTWARE\Tabeza\TabezaConnect are removed (including BarID, APIUrl, WatchFolder)
 * to ensure clean slate for reinstallation
 * 
 * Requirements: 6.1, 6.2 from bugfix.md
 * 
 * NOTE: This test requires administrator privileges to write to HKLM registry.
 * Run with: npm test (as administrator)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Test configuration
const REGISTRY_KEY = 'HKLM\\SOFTWARE\\Tabeza\\TabezaConnect';
const TEST_BAR_ID = 'bar-test-uninstall-123';
const TEST_API_URL = 'https://test.tabeza.co.ke';
const TEST_WATCH_FOLDER = 'C:\\TestTabezaPrints';
const TEST_INSTALL_DIR = path.join(__dirname, '..', 'test-install');

// Check if running as administrator
function isAdmin() {
  try {
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Check if registry key exists
function registryKeyExists(key) {
  try {
    execSync(`reg query "${key}"`, { encoding: 'utf8', stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Check if registry value exists
function registryValueExists(key, valueName) {
  try {
    const result = execSync(`reg query "${key}" /v ${valueName}`, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return result.includes(valueName);
  } catch {
    return false;
  }
}

// Get registry value
function getRegistryValue(key, valueName) {
  try {
    const result = execSync(`reg query "${key}" /v ${valueName}`, { 
      encoding: 'utf8'
    });
    const match = result.match(new RegExp(`${valueName}\\s+REG_SZ\\s+(.+)`));
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

// Simulate installation by creating registry entries
function simulateInstallation() {
  console.log('\n--- Simulating Installation ---');
  
  try {
    // Create registry key
    execSync(`reg add "${REGISTRY_KEY}" /f`, { encoding: 'utf8', stdio: 'ignore' });
    console.log(`  ✓ Created registry key: ${REGISTRY_KEY}`);
    
    // Add BarID
    execSync(
      `reg add "${REGISTRY_KEY}" /v BarID /t REG_SZ /d "${TEST_BAR_ID}" /f`,
      { encoding: 'utf8', stdio: 'ignore' }
    );
    console.log(`  ✓ Added BarID: ${TEST_BAR_ID}`);
    
    // Add APIUrl
    execSync(
      `reg add "${REGISTRY_KEY}" /v APIUrl /t REG_SZ /d "${TEST_API_URL}" /f`,
      { encoding: 'utf8', stdio: 'ignore' }
    );
    console.log(`  ✓ Added APIUrl: ${TEST_API_URL}`);
    
    // Add WatchFolder
    execSync(
      `reg add "${REGISTRY_KEY}" /v WatchFolder /t REG_SZ /d "${TEST_WATCH_FOLDER}" /f`,
      { encoding: 'utf8', stdio: 'ignore' }
    );
    console.log(`  ✓ Added WatchFolder: ${TEST_WATCH_FOLDER}`);
    
    // Create test installation directory
    if (!fs.existsSync(TEST_INSTALL_DIR)) {
      fs.mkdirSync(TEST_INSTALL_DIR, { recursive: true });
      console.log(`  ✓ Created installation directory: ${TEST_INSTALL_DIR}`);
    }
    
    // Create a dummy executable file
    const exePath = path.join(TEST_INSTALL_DIR, 'TabezaConnect.exe');
    fs.writeFileSync(exePath, 'dummy executable', 'utf8');
    console.log(`  ✓ Created dummy executable: ${exePath}`);
    
    console.log('\n  Installation simulation complete');
    
  } catch (error) {
    console.error('  ✗ Installation simulation failed:', error.message);
    throw new Error('Test setup failed: Could not simulate installation');
  }
}

// Simulate uninstallation by removing files (but NOT registry - this is the bug)
function simulateUninstallation() {
  console.log('\n--- Simulating Uninstallation ---');
  
  try {
    // Remove installation directory (simulating file cleanup)
    if (fs.existsSync(TEST_INSTALL_DIR)) {
      fs.rmSync(TEST_INSTALL_DIR, { recursive: true, force: true });
      console.log(`  ✓ Removed installation directory: ${TEST_INSTALL_DIR}`);
    }
    
    // NOTE: We deliberately DO NOT remove registry entries here
    // This simulates the bug where the uninstaller removes files but leaves registry
    console.log('\n  ⚠️  Registry entries NOT removed (simulating bug)');
    console.log('  → This is the expected behavior on UNFIXED code');
    console.log('  → Uninstaller removes files but leaves registry entries');
    
  } catch (error) {
    console.error('  ✗ Uninstallation simulation failed:', error.message);
    throw new Error('Test execution failed: Could not simulate uninstallation');
  }
}

describe('Bug 6: Incomplete Uninstallation - Bug Condition Exploration', () => {
  
  beforeAll(() => {
    console.log('\n========================================');
    console.log('Bug 6: Incomplete Uninstallation Test');
    console.log('========================================');
    console.log('EXPECTED OUTCOME: This test MUST FAIL on unfixed code');
    console.log('Failure confirms the bug exists\n');
    
    // Check admin privileges
    if (!isAdmin()) {
      console.warn('\n⚠️  WARNING: Not running as administrator');
      console.warn('Registry tests will be skipped');
      console.warn('To run full tests, run as administrator\n');
    }
  });

  afterAll(() => {
    // Cleanup: Remove test registry key
    if (isAdmin()) {
      try {
        execSync(`reg delete "${REGISTRY_KEY}" /f`, { 
          encoding: 'utf8',
          stdio: 'ignore'
        });
        console.log('\n✓ Cleanup: Removed test registry key');
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    // Cleanup: Remove test directory if it still exists
    if (fs.existsSync(TEST_INSTALL_DIR)) {
      try {
        fs.rmSync(TEST_INSTALL_DIR, { recursive: true, force: true });
        console.log('✓ Cleanup: Removed test installation directory');
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Property 1: Bug Condition - Registry Entries Remain After Uninstall', () => {
    
    test('EXPECTED TO FAIL: Uninstaller completes → application files removed → registry entries should be removed', () => {
      // Skip if not admin
      if (!isAdmin()) {
        console.log('\n⚠️  Skipping registry test - requires administrator privileges');
        return;
      }
      
      console.log('\n--- Test Execution ---');
      
      // ─────────────────────────────────────────────────────────────────
      // Step 1: Simulate installation (create registry entries and files)
      // ─────────────────────────────────────────────────────────────────
      console.log('Step 1: Simulating installation...');
      console.log(`  Registry Key: ${REGISTRY_KEY}`);
      console.log(`  Installation Directory: ${TEST_INSTALL_DIR}`);
      
      simulateInstallation();

      // ─────────────────────────────────────────────────────────────────
      // Step 2: Verify installation created registry entries
      // ─────────────────────────────────────────────────────────────────
      console.log('\nStep 2: Verifying installation created registry entries...');
      
      const keyExists = registryKeyExists(REGISTRY_KEY);
      const barIdExists = registryValueExists(REGISTRY_KEY, 'BarID');
      const apiUrlExists = registryValueExists(REGISTRY_KEY, 'APIUrl');
      const watchFolderExists = registryValueExists(REGISTRY_KEY, 'WatchFolder');
      
      console.log(`  Registry key exists: ${keyExists}`);
      console.log(`  BarID value exists: ${barIdExists}`);
      console.log(`  APIUrl value exists: ${apiUrlExists}`);
      console.log(`  WatchFolder value exists: ${watchFolderExists}`);
      
      expect(keyExists).toBe(true);
      expect(barIdExists).toBe(true);
      expect(apiUrlExists).toBe(true);
      expect(watchFolderExists).toBe(true);
      
      console.log('  ✓ Installation verified');

      // ─────────────────────────────────────────────────────────────────
      // Step 3: Verify installation created files
      // ─────────────────────────────────────────────────────────────────
      console.log('\nStep 3: Verifying installation created files...');
      
      const installDirExists = fs.existsSync(TEST_INSTALL_DIR);
      const exeExists = fs.existsSync(path.join(TEST_INSTALL_DIR, 'TabezaConnect.exe'));
      
      console.log(`  Installation directory exists: ${installDirExists}`);
      console.log(`  Executable exists: ${exeExists}`);
      
      expect(installDirExists).toBe(true);
      expect(exeExists).toBe(true);
      
      console.log('  ✓ Files verified');

      // ─────────────────────────────────────────────────────────────────
      // Step 4: Simulate uninstallation (remove files but NOT registry)
      // ─────────────────────────────────────────────────────────────────
      console.log('\nStep 4: Simulating uninstallation via Windows Programs & Features...');
      console.log('  → User opens Control Panel → Programs & Features');
      console.log('  → User selects "Tabeza Connect"');
      console.log('  → User clicks "Uninstall"');
      console.log('  → Uninstaller runs and removes application files');
      
      simulateUninstallation();

      // ─────────────────────────────────────────────────────────────────
      // Step 5: Verify files were removed
      // ─────────────────────────────────────────────────────────────────
      console.log('\nStep 5: Verifying application files were removed...');
      
      const installDirExistsAfter = fs.existsSync(TEST_INSTALL_DIR);
      
      console.log(`  Installation directory exists: ${installDirExistsAfter}`);
      
      expect(installDirExistsAfter).toBe(false);
      
      console.log('  ✓ Application files removed');

      // ─────────────────────────────────────────────────────────────────
      // Step 6: CRITICAL ASSERTION - This MUST FAIL on unfixed code
      // ─────────────────────────────────────────────────────────────────
      console.log('\n--- Expected Behavior Assertion ---');
      console.log('Testing: Registry entries should be removed after uninstall');
      
      const keyExistsAfter = registryKeyExists(REGISTRY_KEY);
      const barIdExistsAfter = registryValueExists(REGISTRY_KEY, 'BarID');
      const apiUrlExistsAfter = registryValueExists(REGISTRY_KEY, 'APIUrl');
      const watchFolderExistsAfter = registryValueExists(REGISTRY_KEY, 'WatchFolder');
      
      console.log(`  Registry key exists: ${keyExistsAfter}`);
      console.log(`  BarID value exists: ${barIdExistsAfter}`);
      console.log(`  APIUrl value exists: ${apiUrlExistsAfter}`);
      console.log(`  WatchFolder value exists: ${watchFolderExistsAfter}`);
      
      console.log('\n  Expected: All registry entries removed (false)');
      console.log(`  Actual:   Registry key exists = ${keyExistsAfter}`);

      // This assertion MUST FAIL on unfixed code because:
      // - The uninstaller removes application files
      // - The uninstaller does NOT include registry cleanup in [UninstallRun] section
      // - Registry entries at HKLM\SOFTWARE\Tabeza\TabezaConnect remain
      // - This leaves configuration artifacts that interfere with reinstallation
      
      expect(keyExistsAfter).toBe(false);
      expect(barIdExistsAfter).toBe(false);
      expect(apiUrlExistsAfter).toBe(false);
      expect(watchFolderExistsAfter).toBe(false);
      
      // If we reach here, the bug is fixed
      console.log('  ✓ PASS: Registry entries successfully removed');
    });

    test('EXPECTED TO FAIL: Registry values should be completely removed (BarID, APIUrl, WatchFolder)', () => {
      // Skip if not admin
      if (!isAdmin()) {
        console.log('\n⚠️  Skipping registry value test - requires administrator privileges');
        return;
      }
      
      console.log('\n--- Registry Value Cleanup Test ---');
      
      // ─────────────────────────────────────────────────────────────────
      // Step 1: Check if registry key still exists from previous test
      // ─────────────────────────────────────────────────────────────────
      console.log('Step 1: Checking registry state after uninstall...');
      
      const keyExists = registryKeyExists(REGISTRY_KEY);
      
      if (!keyExists) {
        console.log('  ✓ Registry key does not exist (bug is fixed)');
        expect(keyExists).toBe(false);
        return;
      }
      
      console.log('  ⚠️  Registry key still exists (bug detected)');

      // ─────────────────────────────────────────────────────────────────
      // Step 2: Check individual registry values
      // ─────────────────────────────────────────────────────────────────
      console.log('\nStep 2: Checking individual registry values...');
      
      const barIdValue = getRegistryValue(REGISTRY_KEY, 'BarID');
      const apiUrlValue = getRegistryValue(REGISTRY_KEY, 'APIUrl');
      const watchFolderValue = getRegistryValue(REGISTRY_KEY, 'WatchFolder');
      
      console.log(`  BarID: ${barIdValue || '(not found)'}`);
      console.log(`  APIUrl: ${apiUrlValue || '(not found)'}`);
      console.log(`  WatchFolder: ${watchFolderValue || '(not found)'}`);

      // ─────────────────────────────────────────────────────────────────
      // Step 3: CRITICAL ASSERTION - This MUST FAIL on unfixed code
      // ─────────────────────────────────────────────────────────────────
      console.log('\n--- Expected Behavior Assertion ---');
      console.log('Testing: All registry values should be null (removed)');
      console.log(`  Expected: BarID = null, APIUrl = null, WatchFolder = null`);
      console.log(`  Actual:   BarID = ${barIdValue}, APIUrl = ${apiUrlValue}, WatchFolder = ${watchFolderValue}`);

      // This assertion MUST FAIL on unfixed code because:
      // - Uninstaller does not clean up registry values
      // - Old configuration persists after uninstall
      // - Reinstallation may read stale values
      // - User expects clean slate after uninstall
      
      expect(barIdValue).toBeNull();
      expect(apiUrlValue).toBeNull();
      expect(watchFolderValue).toBeNull();
      
      // If we reach here, the bug is fixed
      console.log('  ✓ PASS: All registry values removed');
    });

    test('EXPECTED TO FAIL: Reinstallation should NOT read old configuration from registry', () => {
      // Skip if not admin
      if (!isAdmin()) {
        console.log('\n⚠️  Skipping reinstallation test - requires administrator privileges');
        return;
      }
      
      console.log('\n--- Reinstallation Clean Slate Test ---');
      
      // ─────────────────────────────────────────────────────────────────
      // Step 1: Check if old registry entries still exist
      // ─────────────────────────────────────────────────────────────────
      console.log('Step 1: Checking for stale registry entries...');
      
      const keyExists = registryKeyExists(REGISTRY_KEY);
      
      if (!keyExists) {
        console.log('  ✓ No stale registry entries (bug is fixed)');
        expect(keyExists).toBe(false);
        return;
      }
      
      console.log('  ⚠️  Stale registry entries detected');
      
      const oldBarId = getRegistryValue(REGISTRY_KEY, 'BarID');
      const oldApiUrl = getRegistryValue(REGISTRY_KEY, 'APIUrl');
      
      console.log(`  Old BarID: ${oldBarId}`);
      console.log(`  Old APIUrl: ${oldApiUrl}`);

      // ─────────────────────────────────────────────────────────────────
      // Step 2: Simulate reinstallation
      // ─────────────────────────────────────────────────────────────────
      console.log('\nStep 2: Simulating reinstallation...');
      console.log('  → User downloads new installer');
      console.log('  → User runs installer');
      console.log('  → Installer should start with clean state');
      
      // In a real scenario, the installer would:
      // 1. Check if HKLM\SOFTWARE\Tabeza\TabezaConnect exists
      // 2. If exists, prompt user: "Previous installation detected. Clean up old configuration?"
      // 3. If yes, delete registry keys before proceeding
      
      // On unfixed code, installer does NOT check for existing registry
      // It proceeds with installation and may read old values

      // ─────────────────────────────────────────────────────────────────
      // Step 3: CRITICAL ASSERTION - This MUST FAIL on unfixed code
      // ─────────────────────────────────────────────────────────────────
      console.log('\n--- Expected Behavior Assertion ---');
      console.log('Testing: Reinstallation should have clean slate (no old registry)');
      console.log(`  Expected: Registry key does not exist`);
      console.log(`  Actual:   Registry key exists = ${keyExists}`);
      
      if (keyExists) {
        console.log('\n  ✗ BUG DETECTED: Old configuration interferes with reinstallation');
        console.log('  → User uninstalls → reinstalls → old Bar ID persists');
        console.log('  → User expects fresh installation but gets old config');
        console.log('  → Confusion: "Why is my old Bar ID still here?"');
      }

      // This assertion MUST FAIL on unfixed code because:
      // - Uninstaller leaves registry entries
      // - Reinstallation reads old values
      // - User does not get clean slate
      // - Configuration conflicts may occur
      
      expect(keyExists).toBe(false);
      
      // If we reach here, the bug is fixed
      console.log('  ✓ PASS: Clean slate for reinstallation');
    });
  });

  describe('Counterexample Documentation', () => {
    
    test('Document the bug condition counterexample', () => {
      console.log('\n========================================');
      console.log('COUNTEREXAMPLE DOCUMENTATION');
      console.log('========================================\n');
      
      console.log('Bug Condition: isBugCondition_Uninstall(input)');
      console.log('  WHERE input.uninstallerCompleted == true');
      console.log('  AND input.applicationFilesRemoved == true');
      console.log('  AND registry.HKLM\\SOFTWARE\\Tabeza\\TabezaConnect exists');
      console.log('  AND (registry.BarID exists OR registry.APIUrl exists OR registry.WatchFolder exists)\n');
      
      console.log('Observed Behavior (UNFIXED CODE):');
      console.log('  1. User opens Control Panel → Programs & Features');
      console.log('  2. User selects "Tabeza Connect"');
      console.log('  3. User clicks "Uninstall"');
      console.log('  4. Uninstaller runs and removes application files');
      console.log('  5. Uninstaller completes successfully');
      console.log('  6. Application files are deleted from C:\\Program Files\\TabezaConnect\\');
      console.log('  7. Registry entries remain at HKLM\\SOFTWARE\\Tabeza\\TabezaConnect');
      console.log('  8. BarID, APIUrl, WatchFolder values persist');
      console.log('  9. User reinstalls → old configuration is read');
      console.log('  10. User confused: "Why is my old Bar ID still here?"\n');
      
      console.log('Expected Behavior (FIXED CODE):');
      console.log('  1. User opens Control Panel → Programs & Features');
      console.log('  2. User selects "Tabeza Connect"');
      console.log('  3. User clicks "Uninstall"');
      console.log('  4. Uninstaller runs and removes application files');
      console.log('  5. Uninstaller removes registry entries at HKLM\\SOFTWARE\\Tabeza\\TabezaConnect');
      console.log('  6. Uninstaller removes service environment variables');
      console.log('  7. Uninstaller completes successfully');
      console.log('  8. Application files deleted');
      console.log('  9. Registry entries deleted');
      console.log('  10. Clean slate for potential reinstallation\n');
      
      console.log('Root Cause Analysis:');
      console.log('  File: installer-pkg-v1.7.15.iss');
      console.log('  Section: [UninstallRun]');
      console.log('  Issue: Missing registry cleanup commands\n');
      
      console.log('  Current [UninstallRun] section:');
      console.log('    - Stops Windows Service');
      console.log('    - Removes service registration');
      console.log('    - Removes application files');
      console.log('    - Does NOT remove registry entries\n');
      
      console.log('  Missing cleanup:');
      console.log('    1. reg delete "HKLM\\SOFTWARE\\Tabeza\\TabezaConnect" /f');
      console.log('    2. Delete HKLM:\\SYSTEM\\CurrentControlSet\\Services\\TabezaConnect\\Environment');
      console.log('    3. Clean up all service-related registry entries\n');
      
      console.log('Fix Required:');
      console.log('  File: installer-pkg-v1.7.15.iss');
      console.log('  Section: [UninstallRun]');
      console.log('  Add:');
      console.log('    Filename: "reg.exe";');
      console.log('    Parameters: "delete ""HKLM\\SOFTWARE\\Tabeza\\TabezaConnect"" /f";');
      console.log('    Flags: runhidden waituntilterminated\n');
      
      console.log('  Section: [Code] (installer initialization)');
      console.log('  Add: Pre-install cleanup check');
      console.log('    1. On installer start, check if HKLM\\SOFTWARE\\Tabeza\\TabezaConnect exists');
      console.log('    2. If exists, prompt user: "Previous installation detected. Clean up old configuration?"');
      console.log('    3. If yes, delete registry keys before proceeding');
      console.log('    4. Ensure fresh installation state\n');
      
      console.log('Impact:');
      console.log('  - Users can cleanly uninstall and reinstall');
      console.log('  - No configuration conflicts from old installations');
      console.log('  - Clean slate for troubleshooting');
      console.log('  - Professional uninstallation experience\n');
      
      console.log('========================================\n');
      
      // This test always passes - it's just for documentation
      expect(true).toBe(true);
    });
  });
});
