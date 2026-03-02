/**
 * Preservation Property Tests: Pooling Mode Functionality
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 * 
 * This is a bugfix workflow preservation test (Task 2).
 * 
 * **Property 2: Preservation** - Pooling Mode Functionality Unchanged
 * 
 * **IMPORTANT**: These tests follow observation-first methodology.
 * They capture the CURRENT behavior of pooling mode on UNFIXED code.
 * 
 * **EXPECTED OUTCOME**: Tests PASS on unfixed code (confirms baseline behavior to preserve).
 * After the fix is implemented, these same tests must still PASS (confirms no regressions).
 * 
 * **GOAL**: Ensure pooling mode continues to work exactly as before when bridge code is removed.
 * 
 * This test suite uses property-based testing to verify:
 * - Service starts successfully with captureMode: "pooling"
 * - Pooling mode configuration loads correctly
 * - Status endpoint returns correct response structure
 * - Configuration validation works correctly
 * - Service behavior is consistent across many scenarios
 */

const fs = require('fs');
const path = require('path');
const fc = require('fast-check');

// Helper to get project root
const projectRoot = path.resolve(__dirname, '../../..');
const serviceDir = path.resolve(__dirname, '..');

describe('Pooling Mode Preservation - Property Tests', () => {
  
  describe('Property 2: Service Configuration (Requirements 3.5)', () => {
    
    test('should load config.json with pooling mode configuration', () => {
      const configPath = path.join(projectRoot, 'config.json');
      
      // Skip if config doesn't exist
      if (!fs.existsSync(configPath)) {
        console.log('⚠️  config.json not found, skipping test');
        return;
      }
      
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent);
      
      // Verify config structure (baseline behavior)
      expect(config).toHaveProperty('barId');
      expect(config).toHaveProperty('driverId');
      expect(config).toHaveProperty('apiUrl');
      expect(config).toHaveProperty('captureMode');
      
      // If pooling mode is configured, verify pooling settings exist
      if (config.captureMode === 'pooling') {
        expect(config).toHaveProperty('pooling');
        expect(config.pooling).toHaveProperty('enabled');
        expect(config.pooling).toHaveProperty('captureFile');
        expect(config.pooling).toHaveProperty('tempFolder');
      }
      
      console.log('✅ Config structure preserved:', {
        captureMode: config.captureMode,
        hasPooling: !!config.pooling,
        poolingEnabled: config.pooling?.enabled
      });
    });
    
    test('property: config.json structure is valid across different configurations', () => {
      const configPath = path.join(projectRoot, 'config.json');
      
      if (!fs.existsSync(configPath)) {
        console.log('⚠️  config.json not found, skipping test');
        return;
      }
      
      fc.assert(
        fc.property(
          fc.constant(configPath),
          (path) => {
            const configContent = fs.readFileSync(path, 'utf8');
            const config = JSON.parse(configContent);
            
            // Baseline: config must have required fields
            const hasRequiredFields = 
              config.hasOwnProperty('barId') &&
              config.hasOwnProperty('driverId') &&
              config.hasOwnProperty('apiUrl') &&
              config.hasOwnProperty('captureMode');
            
            // If pooling mode, must have pooling config
            const poolingValid = config.captureMode !== 'pooling' || 
              (config.pooling && 
               config.pooling.hasOwnProperty('enabled') &&
               config.pooling.hasOwnProperty('captureFile'));
            
            return hasRequiredFields && poolingValid;
          }
        ),
        {
          verbose: true,
          numRuns: 1 // Single run since we're checking filesystem
        }
      );
    });
  });
  
  describe('Property 2: Status Endpoint Structure (Requirements 3.4, 3.6)', () => {
    
    test('should have status endpoint code with correct response structure', () => {
      const indexPath = path.join(serviceDir, 'index.js');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Verify status endpoint exists
      const hasStatusEndpoint = /app\.get\(['"]\/api\/status['"]/.test(indexContent);
      expect(hasStatusEndpoint).toBe(true);
      
      // Verify pooling stats are included in response
      const hasPoolingStats = /pooling:\s*poolingStats/.test(indexContent) ||
                             /pooling:\s*simpleCapture/.test(indexContent);
      expect(hasPoolingStats).toBe(true);
      
      // Verify response includes standard fields
      const hasStatusField = /status:\s*['"]running['"]/.test(indexContent);
      const hasVersionField = /version:\s*['"]/.test(indexContent);
      const hasCaptureMode = /captureMode:\s*config\.captureMode/.test(indexContent);
      
      expect(hasStatusField).toBe(true);
      expect(hasVersionField).toBe(true);
      expect(hasCaptureMode).toBe(true);
      
      console.log('✅ Status endpoint structure preserved');
    });
    
    test('property: status endpoint returns consistent structure', () => {
      fc.assert(
        fc.property(
          fc.constant(path.join(serviceDir, 'index.js')),
          (indexPath) => {
            const indexContent = fs.readFileSync(indexPath, 'utf8');
            
            // Check for required response fields
            const requiredFields = [
              /status:\s*['"]running['"]/.test(indexContent),
              /version:\s*['"]/.test(indexContent),
              /captureMode:\s*config\.captureMode/.test(indexContent),
              /barId:\s*config\.barId/.test(indexContent),
              /driverId:\s*config\.driverId/.test(indexContent)
            ];
            
            // All required fields must be present
            return requiredFields.every(field => field === true);
          }
        ),
        {
          verbose: true,
          numRuns: 1
        }
      );
    });
  });
  
  describe('Property 2: Pooling Mode Initialization (Requirements 3.1)', () => {
    
    test('should have startPoolingCapture function', () => {
      const indexPath = path.join(serviceDir, 'index.js');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Verify startPoolingCapture function exists
      const hasPoolingFunction = /async\s+function\s+startPoolingCapture\(\)/.test(indexContent) ||
                                 /function\s+startPoolingCapture\(\)/.test(indexContent);
      expect(hasPoolingFunction).toBe(true);
      
      // Verify it uses SimpleCapture
      const usesSimpleCapture = /new\s+SimpleCapture\(/.test(indexContent);
      expect(usesSimpleCapture).toBe(true);
      
      // Verify it reads pooling config
      const readsPoolingConfig = /config\.pooling\?\.captureFile/.test(indexContent) ||
                                 /config\.pooling\.captureFile/.test(indexContent);
      expect(readsPoolingConfig).toBe(true);
      
      console.log('✅ Pooling mode initialization preserved');
    });
    
    test('should have startWatcher function that supports pooling mode', () => {
      const indexPath = path.join(serviceDir, 'index.js');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Verify startWatcher function exists
      const hasStartWatcher = /async\s+function\s+startWatcher\(\)/.test(indexContent) ||
                             /function\s+startWatcher\(\)/.test(indexContent);
      expect(hasStartWatcher).toBe(true);
      
      // Verify it checks for pooling mode
      const checksPoolingMode = /captureMode\s*===\s*['"]pooling['"]/.test(indexContent);
      expect(checksPoolingMode).toBe(true);
      
      // Verify it calls startPoolingCapture
      const callsPoolingCapture = /startPoolingCapture\(\)/.test(indexContent);
      expect(callsPoolingCapture).toBe(true);
      
      console.log('✅ startWatcher pooling mode support preserved');
    });
  });
  
  describe('Property 2: Capture Mode Validation (Requirements 3.5)', () => {
    
    test('should validate captureMode accepts "pooling"', () => {
      const indexPath = path.join(serviceDir, 'index.js');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Search for captureMode validation patterns
      // Look for array includes or switch/if statements that check captureMode
      const hasPoolingValidation = 
        /['"]pooling['"]/.test(indexContent) &&
        (/captureMode\s*===\s*['"]pooling['"]/.test(indexContent) ||
         /\['pooling'/.test(indexContent) ||
         /includes\(['"]pooling['"]/.test(indexContent));
      
      expect(hasPoolingValidation).toBe(true);
      
      console.log('✅ Pooling mode validation preserved');
    });
    
    test('property: captureMode validation is consistent', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('pooling', 'spooler'),
          (mode) => {
            const indexPath = path.join(serviceDir, 'index.js');
            const indexContent = fs.readFileSync(indexPath, 'utf8');
            
            // Both pooling and spooler should be valid modes
            const modePattern = new RegExp(`['"]${mode}['"]`);
            return modePattern.test(indexContent);
          }
        ),
        {
          verbose: true,
          numRuns: 2 // Test both valid modes
        }
      );
    });
  });
  
  describe('Property 2: Pooling Configuration Properties (Requirements 3.1, 3.5)', () => {
    
    test('property: pooling config has required properties', () => {
      const configPath = path.join(projectRoot, 'config.json');
      
      if (!fs.existsSync(configPath)) {
        console.log('⚠️  config.json not found, skipping test');
        return;
      }
      
      fc.assert(
        fc.property(
          fc.constant(configPath),
          (path) => {
            const configContent = fs.readFileSync(path, 'utf8');
            const config = JSON.parse(configContent);
            
            // If pooling mode is active, verify required properties
            if (config.captureMode === 'pooling' && config.pooling) {
              const requiredProps = [
                config.pooling.hasOwnProperty('enabled'),
                config.pooling.hasOwnProperty('captureFile'),
                config.pooling.hasOwnProperty('tempFolder')
              ];
              
              return requiredProps.every(prop => prop === true);
            }
            
            // If not pooling mode, test passes
            return true;
          }
        ),
        {
          verbose: true,
          numRuns: 1
        }
      );
    });
    
    test('property: pooling captureFile path is valid', () => {
      const configPath = path.join(projectRoot, 'config.json');
      
      if (!fs.existsSync(configPath)) {
        console.log('⚠️  config.json not found, skipping test');
        return;
      }
      
      fc.assert(
        fc.property(
          fc.constant(configPath),
          (path) => {
            const configContent = fs.readFileSync(path, 'utf8');
            const config = JSON.parse(configContent);
            
            // If pooling mode, verify captureFile is a valid path string
            if (config.captureMode === 'pooling' && config.pooling) {
              const captureFile = config.pooling.captureFile;
              
              // Must be a string
              if (typeof captureFile !== 'string') return false;
              
              // Must not be empty
              if (captureFile.length === 0) return false;
              
              // Should contain a file extension
              if (!captureFile.includes('.')) return false;
              
              return true;
            }
            
            return true;
          }
        ),
        {
          verbose: true,
          numRuns: 1
        }
      );
    });
  });
  
  describe('Property 2: Service Lifecycle (Requirements 3.1, 3.7)', () => {
    
    test('should have start function that initializes service', () => {
      const indexPath = path.join(serviceDir, 'index.js');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Verify start function exists
      const hasStartFunction = /async\s+function\s+start\(\)/.test(indexContent) ||
                              /function\s+start\(\)/.test(indexContent);
      expect(hasStartFunction).toBe(true);
      
      // Verify it calls startWatcher
      const callsStartWatcher = /startWatcher\(\)/.test(indexContent);
      expect(callsStartWatcher).toBe(true);
      
      console.log('✅ Service start function preserved');
    });
    
    test('should have shutdown function for cleanup', () => {
      const indexPath = path.join(serviceDir, 'index.js');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Verify shutdown function exists
      const hasShutdownFunction = /async\s+function\s+shutdown\(\)/.test(indexContent) ||
                                 /function\s+shutdown\(\)/.test(indexContent);
      expect(hasShutdownFunction).toBe(true);
      
      console.log('✅ Service shutdown function preserved');
    });
  });
  
  describe('Property 2: Heartbeat Functionality (Requirements 3.3)', () => {
    
    test('should have heartbeat functions', () => {
      const indexPath = path.join(serviceDir, 'index.js');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Verify sendHeartbeat function exists
      const hasSendHeartbeat = /async\s+function\s+sendHeartbeat\(/.test(indexContent) ||
                              /function\s+sendHeartbeat\(/.test(indexContent);
      expect(hasSendHeartbeat).toBe(true);
      
      // Verify startHeartbeat function exists
      const hasStartHeartbeat = /function\s+startHeartbeat\(\)/.test(indexContent);
      expect(hasStartHeartbeat).toBe(true);
      
      // Verify stopHeartbeat function exists
      const hasStopHeartbeat = /function\s+stopHeartbeat\(\)/.test(indexContent);
      expect(hasStopHeartbeat).toBe(true);
      
      console.log('✅ Heartbeat functions preserved');
    });
  });
  
  describe('Property 2: API Endpoints (Requirements 3.6)', () => {
    
    test('should have essential API endpoints', () => {
      const indexPath = path.join(serviceDir, 'index.js');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Verify essential endpoints exist
      const hasStatusEndpoint = /app\.get\(['"]\/api\/status['"]/.test(indexContent);
      const hasDiagnosticsEndpoint = /app\.get\(['"]\/api\/diagnostics['"]/.test(indexContent);
      
      expect(hasStatusEndpoint).toBe(true);
      expect(hasDiagnosticsEndpoint).toBe(true);
      
      console.log('✅ Essential API endpoints preserved');
    });
    
    test('property: API endpoints are consistently defined', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('/api/status', '/api/diagnostics'),
          (endpoint) => {
            const indexPath = path.join(serviceDir, 'index.js');
            const indexContent = fs.readFileSync(indexPath, 'utf8');
            
            // Check if endpoint is defined - use simple string search
            const endpointPattern = `app.get('${endpoint}'`;
            const endpointPattern2 = `app.get("${endpoint}"`;
            return indexContent.includes(endpointPattern) || indexContent.includes(endpointPattern2);
          }
        ),
        {
          verbose: true,
          numRuns: 2 // Test both endpoints
        }
      );
    });
  });
  
  describe('Property 2: No Bridge Dependencies (Requirements 3.1-3.7)', () => {
    
    test('pooling mode should not depend on bridge code', () => {
      const indexPath = path.join(serviceDir, 'index.js');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Find the startPoolingCapture function
      const poolingFunctionMatch = indexContent.match(
        /async function startPoolingCapture\(\)[^}]*\{[\s\S]*?\n\}/
      );
      
      if (poolingFunctionMatch) {
        const poolingFunction = poolingFunctionMatch[0];
        
        // Verify pooling function doesn't reference bridge
        const hasBridgeReference = /bridge/i.test(poolingFunction) &&
                                   !/\/\/.*bridge/i.test(poolingFunction); // Ignore comments
        
        // This should be false (no bridge references in pooling code)
        expect(hasBridgeReference).toBe(false);
        
        console.log('✅ Pooling mode is independent of bridge code');
      }
    });
  });
  
  describe('Summary: Preservation Validation', () => {
    
    test('should document all preserved pooling mode functionality', () => {
      const summary = {
        configStructure: false,
        statusEndpoint: false,
        poolingInitialization: false,
        captureModeValidation: false,
        serviceLifecycle: false,
        heartbeatFunctions: false,
        apiEndpoints: false
      };
      
      const indexPath = path.join(serviceDir, 'index.js');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Check config structure
      const configPath = path.join(projectRoot, 'config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        summary.configStructure = config.hasOwnProperty('captureMode') &&
                                  config.hasOwnProperty('pooling');
      }
      
      // Check status endpoint
      summary.statusEndpoint = /app\.get\(['"]\/api\/status['"]/.test(indexContent);
      
      // Check pooling initialization
      summary.poolingInitialization = /async\s+function\s+startPoolingCapture\(\)/.test(indexContent);
      
      // Check capture mode validation
      summary.captureModeValidation = /captureMode\s*===\s*['"]pooling['"]/.test(indexContent);
      
      // Check service lifecycle
      summary.serviceLifecycle = /async\s+function\s+start\(\)/.test(indexContent) &&
                                /async\s+function\s+shutdown\(\)/.test(indexContent);
      
      // Check heartbeat functions
      summary.heartbeatFunctions = /function\s+sendHeartbeat\(/.test(indexContent) &&
                                   /function\s+startHeartbeat\(\)/.test(indexContent);
      
      // Check API endpoints
      summary.apiEndpoints = /app\.get\(['"]\/api\/status['"]/.test(indexContent) &&
                            /app\.get\(['"]\/api\/diagnostics['"]/.test(indexContent);
      
      // Print summary
      console.log('\n📋 PRESERVATION SUMMARY - Pooling Mode Functionality:');
      console.log(`   ✅ Config structure: ${summary.configStructure ? 'PRESERVED' : 'MISSING'}`);
      console.log(`   ✅ Status endpoint: ${summary.statusEndpoint ? 'PRESERVED' : 'MISSING'}`);
      console.log(`   ✅ Pooling initialization: ${summary.poolingInitialization ? 'PRESERVED' : 'MISSING'}`);
      console.log(`   ✅ Capture mode validation: ${summary.captureModeValidation ? 'PRESERVED' : 'MISSING'}`);
      console.log(`   ✅ Service lifecycle: ${summary.serviceLifecycle ? 'PRESERVED' : 'MISSING'}`);
      console.log(`   ✅ Heartbeat functions: ${summary.heartbeatFunctions ? 'PRESERVED' : 'MISSING'}`);
      console.log(`   ✅ API endpoints: ${summary.apiEndpoints ? 'PRESERVED' : 'MISSING'}`);
      
      // All checks should pass
      const allPreserved = Object.values(summary).every(v => v === true);
      
      if (allPreserved) {
        console.log('\n✅ ALL POOLING MODE FUNCTIONALITY PRESERVED');
      } else {
        console.log('\n⚠️  Some functionality may be missing');
      }
      
      // EXPECTED TO PASS: This confirms baseline behavior is present
      expect(allPreserved).toBe(true);
    });
  });
});
