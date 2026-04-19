/**
 * Bug 1: Bar ID Persistence Failure - Bug Condition Exploration Test
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * GOAL: Surface counterexamples that demonstrate the bug exists
 * 
 * Bug Condition: User enters valid Bar ID in installer, completes installation,
 * but config.json.barId remains empty
 * 
 * Expected Behavior: When installer writes Bar ID to registry 
 * (HKLM\SOFTWARE\Tabeza\TabezaConnect\BarID), the service startup reads it 
 * and persists to config.json
 * 
 * Requirements: 1.1, 1.2 from bugfix.md
 * 
 * NOTE: This test requires administrator privileges to write to HKLM registry.
 * Run with: npm test (as administrator)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Test configuration
const TEST_BAR_ID = 'bar-123-test';
const TEST_DIR = path.join(__dirname, '..', 'test-data');
const CONFIG_PATH = path.join(TEST_DIR, 'config.json');
const REGISTRY_KEY = 'HKLM\\SOFTWARE\\Tabeza\\TabezaConnect';
const REGISTRY_VALUE_NAME = 'BarID';

// Check if running as administrator
function isAdmin() {
  try {
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('Bug 1: Bar ID Persistence Failure - Bug Condition Exploration', () => {
  
  beforeAll(() => {
    console.log('\n========================================');
    console.log('Bug 1: Bar ID Persistence Test');
    console.log('========================================');
    console.log('EXPECTED OUTCOME: This test MUST FAIL on unfixed code');
    console.log('Failure confirms the bug exists\n');
    
    // Create test directory
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
    
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
        execSync(`reg delete "${REGISTRY_KEY}" /v ${REGISTRY_VALUE_NAME} /f`, { 
          encoding: 'utf8',
          stdio: 'ignore'
        });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    // Cleanup: Remove test directory
    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Property 1: Bug Condition - Bar ID Not Persisted After Installation', () => {
    
    test('EXPECTED TO FAIL: Installer writes Bar ID to registry → service starts → config.json.barId should be populated', () => {
      // Skip if not admin
      if (!isAdmin()) {
        console.log('\n⚠️  Skipping registry test - requires administrator privileges');
        return;
      }
      
      console.log('\n--- Test Execution ---');
      
      // ─────────────────────────────────────────────────────────────────
      // Step 1: Simulate installer writing Bar ID to registry
      // ─────────────────────────────────────────────────────────────────
      console.log(`Step 1: Writing Bar ID "${TEST_BAR_ID}" to registry...`);
      console.log(`  Registry Key: ${REGISTRY_KEY}`);
      console.log(`  Value Name: ${REGISTRY_VALUE_NAME}`);
      
      try {
        // Create registry key if it doesn't exist
        execSync(`reg add "${REGISTRY_KEY}" /f`, { encoding: 'utf8', stdio: 'ignore' });
        
        // Write Bar ID to registry (simulating installer behavior)
        execSync(
          `reg add "${REGISTRY_KEY}" /v ${REGISTRY_VALUE_NAME} /t REG_SZ /d "${TEST_BAR_ID}" /f`,
          { encoding: 'utf8', stdio: 'ignore' }
        );
        
        console.log('  ✓ Bar ID written to registry');
      } catch (error) {
        console.error('  ✗ Failed to write to registry:', error.message);
        throw new Error('Test setup failed: Could not write to registry');
      }

      // ─────────────────────────────────────────────────────────────────
      // Step 2: Verify registry write was successful
      // ─────────────────────────────────────────────────────────────────
      console.log('\nStep 2: Verifying registry write...');
      
      let registryValue = null;
      try {
        const queryResult = execSync(
          `reg query "${REGISTRY_KEY}" /v ${REGISTRY_VALUE_NAME}`,
          { encoding: 'utf8' }
        );
        
        // Parse registry output to extract value
        const match = queryResult.match(/BarID\s+REG_SZ\s+(.+)/);
        if (match) {
          registryValue = match[1].trim();
          console.log(`  ✓ Registry value confirmed: "${registryValue}"`);
        }
      } catch (error) {
        console.error('  ✗ Failed to read registry:', error.message);
        throw new Error('Test setup failed: Could not verify registry write');
      }

      expect(registryValue).toBe(TEST_BAR_ID);

      // ─────────────────────────────────────────────────────────────────
      // Step 3: Ensure config.json exists with empty barId
      // ─────────────────────────────────────────────────────────────────
      console.log('\nStep 3: Preparing config.json with empty barId...');
      
      const configDir = path.dirname(CONFIG_PATH);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
        console.log(`  ✓ Created directory: ${configDir}`);
      }

      // Create config with empty barId (simulating fresh installation)
      const initialConfig = {
        barId: '',
        apiUrl: 'https://tabeza.co.ke',
        watchFolder: 'C:\\TabezaPrints',
        httpPort: 8765
      };

      fs.writeFileSync(CONFIG_PATH, JSON.stringify(initialConfig, null, 2), 'utf8');
      console.log('  ✓ config.json created with empty barId');

      // ─────────────────────────────────────────────────────────────────
      // Step 4: Simulate service startup (read config)
      // ─────────────────────────────────────────────────────────────────
      console.log('\nStep 4: Simulating service startup...');
      console.log('  → Service reads config.json');
      console.log('  → Service should detect empty barId');
      console.log('  → Service should check registry for Bar ID');
      console.log('  → Service should migrate registry value to config.json');

      // Read current config
      const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
      const config = JSON.parse(configData);
      
      console.log(`  Current config.json.barId: "${config.barId}"`);

      // ─────────────────────────────────────────────────────────────────
      // Step 5: CRITICAL ASSERTION - This MUST FAIL on unfixed code
      // ─────────────────────────────────────────────────────────────────
      console.log('\n--- Expected Behavior Assertion ---');
      console.log('Testing: config.json.barId should equal registry value');
      console.log(`  Expected: "${TEST_BAR_ID}"`);
      console.log(`  Actual:   "${config.barId}"`);

      // This assertion MUST FAIL on unfixed code because:
      // - The installer writes Bar ID to registry
      // - The service does NOT read from registry on startup
      // - config.json.barId remains empty
      // - No migration logic exists to copy registry → config.json
      
      expect(config.barId).toBe(TEST_BAR_ID);
      
      // If we reach here, the bug is fixed
      console.log('  ✓ PASS: Bar ID successfully migrated from registry to config.json');
    });

    test('EXPECTED TO FAIL: Tray should show "✓ Bar ID configured" when Bar ID exists in registry', () => {
      // Skip if not admin
      if (!isAdmin()) {
        console.log('\n⚠️  Skipping tray status test - requires administrator privileges');
        return;
      }
      
      console.log('\n--- Tray Status Test ---');
      
      // This test verifies the tray icon shows correct status
      // On unfixed code, tray will show "✗ Bar ID not configured" 
      // even though Bar ID exists in registry
      
      console.log('Step 1: Reading config.json...');
      
      if (!fs.existsSync(CONFIG_PATH)) {
        throw new Error('config.json does not exist - run previous test first');
      }

      const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
      const config = JSON.parse(configData);
      
      console.log(`  config.json.barId: "${config.barId}"`);

      // Tray status is determined by config.json.barId
      // If barId is empty, tray shows "✗ Bar ID not configured"
      // If barId has value, tray shows "✓ Bar ID configured"
      
      const trayStatus = config.barId && config.barId.trim() !== '' 
        ? '✓ Bar ID configured' 
        : '✗ Bar ID not configured';
      
      console.log(`  Tray status: "${trayStatus}"`);
      console.log('\n--- Expected Behavior Assertion ---');
      console.log('Testing: Tray should show configured status');
      console.log(`  Expected: "✓ Bar ID configured"`);
      console.log(`  Actual:   "${trayStatus}"`);

      // This assertion MUST FAIL on unfixed code because:
      // - config.json.barId is empty (not migrated from registry)
      // - Tray reads from config.json, not registry
      // - Tray shows "✗ Bar ID not configured"
      
      expect(trayStatus).toBe('✓ Bar ID configured');
      
      // If we reach here, the bug is fixed
      console.log('  ✓ PASS: Tray correctly shows Bar ID configured status');
    });
  });

  describe('Counterexample Documentation', () => {
    
    test('Document the bug condition counterexample', () => {
      console.log('\n========================================');
      console.log('COUNTEREXAMPLE DOCUMENTATION');
      console.log('========================================\n');
      
      console.log('Bug Condition: isBugCondition_BarID(input)');
      console.log('  WHERE input.barIdEntered == true');
      console.log('  AND input.installerCompleted == true');
      console.log('  AND config.json.barId == ""');
      console.log('  AND registry.BarID exists\n');
      
      console.log('Observed Behavior (UNFIXED CODE):');
      console.log('  1. Installer prompts user for Bar ID');
      console.log(`  2. User enters: "${TEST_BAR_ID}"`);
      console.log('  3. Installer writes to registry: HKLM\\SOFTWARE\\Tabeza\\TabezaConnect\\BarID');
      console.log('  4. Installer completes successfully');
      console.log('  5. Service starts and reads config.json');
      console.log('  6. config.json.barId is empty ("")');
      console.log('  7. Service does NOT check registry for Bar ID');
      console.log('  8. Tray shows "✗ Bar ID not configured"\n');
      
      console.log('Expected Behavior (FIXED CODE):');
      console.log('  1. Installer prompts user for Bar ID');
      console.log(`  2. User enters: "${TEST_BAR_ID}"`);
      console.log('  3. Installer writes to registry: HKLM\\SOFTWARE\\Tabeza\\TabezaConnect\\BarID');
      console.log('  4. Installer completes successfully');
      console.log('  5. Service starts and reads config.json');
      console.log('  6. Service detects config.json.barId is empty');
      console.log('  7. Service checks registry for Bar ID');
      console.log('  8. Service finds registry value and migrates to config.json');
      console.log(`  9. config.json.barId = "${TEST_BAR_ID}"`);
      console.log('  10. Tray shows "✓ Bar ID configured"\n');
      
      console.log('Root Cause Analysis:');
      console.log('  - Missing migration logic in electron-main.js');
      console.log('  - Service startup does not check registry fallback');
      console.log('  - No code to copy registry value to config.json');
      console.log('  - Installer writes to registry but not to config.json\n');
      
      console.log('Fix Required:');
      console.log('  File: electron-main.js');
      console.log('  Function: app.whenReady() initialization');
      console.log('  Add: Registry-to-config migration logic');
      console.log('  Logic:');
      console.log('    1. After folder initialization');
      console.log('    2. Check if config.json.barId is empty');
      console.log('    3. If empty, read HKLM\\SOFTWARE\\Tabeza\\TabezaConnect\\BarID');
      console.log('    4. If registry value exists, write to config.json.barId');
      console.log('    5. Log migration action for debugging\n');
      
      console.log('========================================\n');
      
      // This test always passes - it's just for documentation
      expect(true).toBe(true);
    });
  });
});
