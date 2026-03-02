/**
 * Bug Condition Exploration Test: Bridge Mode Code Removal
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
 * 
 * This is a bugfix workflow exploration test (Task 1).
 * 
 * **CRITICAL**: This test is EXPECTED TO FAIL on unfixed code - failure confirms the bug exists.
 * 
 * **Property 1: Fault Condition** - Bridge Code Exists in Codebase
 * 
 * The test encodes the expected behavior (no bridge code should exist).
 * When run on UNFIXED code, it will FAIL and surface counterexamples showing bridge code.
 * After the fix is implemented, this same test will PASS, validating the fix.
 * 
 * **GOAL**: Surface counterexamples that demonstrate bridge code still exists in the codebase.
 * 
 * This test uses property-based testing to systematically search for bridge-related:
 * - Implementation files in src/service/
 * - Batch scripts in root directory
 * - Imports in index.js and tray-app.js
 * - Initialization logic and status code
 * - API endpoints and configuration logic
 */

const fs = require('fs');
const path = require('path');
const fc = require('fast-check');

// Helper to get project root (go up from src/service/__tests__ to project root)
const projectRoot = path.resolve(__dirname, '../../..');
const serviceDir = path.resolve(__dirname, '..');

describe('Bridge Mode Removal - Bug Condition Exploration', () => {
  
  describe('Property 1: No Bridge Implementation Files (Requirement 2.2)', () => {
    
    test('should have NO bridge implementation files in src/service/', () => {
      // List of bridge files that should NOT exist (from design document)
      const bridgeFiles = [
        'final-bridge.js',
        'universal-bridge.js',
        'printBridge.js',
        'printBridge-final.js',
        'printBridge-final-fixed.js',
        'printBridge-fixed.js',
        'printBridge-minimal.js',
        'printBridge-production.js',
        'printBridge-v3.js'
      ];
      
      const existingBridgeFiles = [];
      
      // Check each bridge file
      for (const file of bridgeFiles) {
        const filePath = path.join(serviceDir, file);
        if (fs.existsSync(filePath)) {
          existingBridgeFiles.push(file);
        }
      }
      
      // EXPECTED TO FAIL on unfixed code: This will list all bridge files that exist
      expect(existingBridgeFiles).toEqual([]);
      
      // If this fails, the counterexample shows which bridge files still exist
      if (existingBridgeFiles.length > 0) {
        console.log('\n🔍 COUNTEREXAMPLE - Bridge files found:');
        existingBridgeFiles.forEach(file => console.log(`   - ${file}`));
      }
    });
    
    test('property: no files matching *bridge*.js pattern in src/service/', () => {
      // Property-based test: search for ANY file matching bridge pattern
      fc.assert(
        fc.property(
          fc.constant(serviceDir),
          (dir) => {
            const files = fs.readdirSync(dir);
            const bridgeFiles = files.filter(file => 
              file.includes('bridge') && 
              file.endsWith('.js') &&
              !file.includes('test') // exclude test files
            );
            
            // EXPECTED TO FAIL: Will show all bridge-related files
            return bridgeFiles.length === 0;
          }
        ),
        {
          verbose: true,
          numRuns: 1 // Single run since we're checking filesystem
        }
      );
    });
  });
  
  describe('Property 1: No Bridge Batch Scripts (Requirement 2.3)', () => {
    
    test('should have NO bridge batch scripts in root directory', () => {
      // List of bridge batch files that should NOT exist (from design document)
      const bridgeBatchFiles = [
        'start-bridge.bat',
        'start-bridge-admin.bat',
        'start-bridge-service.bat',
        'start-final-bridge.bat',
        'start-fixed-bridge.bat',
        'start-minimal-bridge.bat',
        'start-universal-bridge.bat',
        'test-bridge.bat',
        'deploy-bridge.bat',
        'restart-bridge.bat',
        'restore-bridge-mode.bat',
        'force-bridge-mode.bat',
        'fix-bridge-config.bat',
        'fix-bridge-config-final.bat',
        'fix-bridge-final.bat',
        'fix-epson-bridge-mismatch.bat',
        'complete-silent-bridge.bat',
        'test-complete-system.bat',
        'test-real-workflow.bat'
      ];
      
      const existingBatchFiles = [];
      
      // Check each batch file
      for (const file of bridgeBatchFiles) {
        const filePath = path.join(projectRoot, file);
        if (fs.existsSync(filePath)) {
          existingBatchFiles.push(file);
        }
      }
      
      // EXPECTED TO FAIL on unfixed code: This will list all bridge batch files that exist
      expect(existingBatchFiles).toEqual([]);
      
      // If this fails, the counterexample shows which batch files still exist
      if (existingBatchFiles.length > 0) {
        console.log('\n🔍 COUNTEREXAMPLE - Bridge batch files found:');
        existingBatchFiles.forEach(file => console.log(`   - ${file}`));
      }
    });
    
    test('property: no batch files matching *bridge*.bat pattern in root', () => {
      // Property-based test: search for ANY batch file matching bridge pattern
      fc.assert(
        fc.property(
          fc.constant(projectRoot),
          (dir) => {
            const files = fs.readdirSync(dir);
            const bridgeBatchFiles = files.filter(file => 
              file.includes('bridge') && 
              file.endsWith('.bat')
            );
            
            // EXPECTED TO FAIL: Will show all bridge-related batch files
            return bridgeBatchFiles.length === 0;
          }
        ),
        {
          verbose: true,
          numRuns: 1 // Single run since we're checking filesystem
        }
      );
    });
  });
  
  describe('Property 1: No Bridge Imports (Requirement 2.1)', () => {
    
    test('should have NO PrintBridge import in index.js', () => {
      const indexPath = path.join(serviceDir, 'index.js');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Check for bridge imports
      const hasPrintBridgeImport = indexContent.includes("require('./final-bridge')") ||
                                   indexContent.includes('require("./final-bridge")') ||
                                   indexContent.includes("require('./printBridge')") ||
                                   indexContent.includes('require("./printBridge")');
      
      const hasPrintBridgeVariable = /const\s+PrintBridge\s*=/.test(indexContent) ||
                                     /let\s+PrintBridge\s*=/.test(indexContent) ||
                                     /var\s+PrintBridge\s*=/.test(indexContent);
      
      // EXPECTED TO FAIL on unfixed code
      expect(hasPrintBridgeImport).toBe(false);
      expect(hasPrintBridgeVariable).toBe(false);
      
      if (hasPrintBridgeImport || hasPrintBridgeVariable) {
        console.log('\n🔍 COUNTEREXAMPLE - Bridge imports found in index.js');
        if (hasPrintBridgeImport) console.log('   - PrintBridge require() statement exists');
        if (hasPrintBridgeVariable) console.log('   - PrintBridge variable declaration exists');
      }
    });
    
    test('should have NO printBridge variable declaration in index.js', () => {
      const indexPath = path.join(serviceDir, 'index.js');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Check for printBridge variable (lowercase)
      const hasPrintBridgeVar = /let\s+printBridge\s*=/.test(indexContent) ||
                                /var\s+printBridge\s*=/.test(indexContent) ||
                                /const\s+printBridge\s*=/.test(indexContent);
      
      // EXPECTED TO FAIL on unfixed code
      expect(hasPrintBridgeVar).toBe(false);
      
      if (hasPrintBridgeVar) {
        console.log('\n🔍 COUNTEREXAMPLE - printBridge variable found in index.js');
      }
    });
  });
  
  describe('Property 1: No Bridge Initialization Logic (Requirement 2.5)', () => {
    
    test('should have NO bridge mode in captureMode validation', () => {
      const indexPath = path.join(serviceDir, 'index.js');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Check for bridge in captureMode validation
      const hasBridgeInValidation = /\['spooler',\s*'bridge'\]/.test(indexContent) ||
                                    /\["spooler",\s*"bridge"\]/.test(indexContent);
      
      // EXPECTED TO FAIL on unfixed code
      expect(hasBridgeInValidation).toBe(false);
      
      if (hasBridgeInValidation) {
        console.log('\n🔍 COUNTEREXAMPLE - Bridge mode in captureMode validation');
      }
    });
    
    test('should have NO bridge initialization in startWatcher()', () => {
      const indexPath = path.join(serviceDir, 'index.js');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Check for bridge initialization
      const hasBridgeInit = /captureMode\s*===\s*['"]bridge['"]/.test(indexContent) ||
                           /new\s+PrintBridge\(\)/.test(indexContent) ||
                           /printBridge\s*=\s*new\s+PrintBridge/.test(indexContent) ||
                           /printBridge\.start\(\)/.test(indexContent);
      
      // EXPECTED TO FAIL on unfixed code
      expect(hasBridgeInit).toBe(false);
      
      if (hasBridgeInit) {
        console.log('\n🔍 COUNTEREXAMPLE - Bridge initialization logic found in index.js');
      }
    });
    
    test('should have NO "Silent Bridge" in mode description', () => {
      const indexPath = path.join(serviceDir, 'index.js');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Check for "Silent Bridge" text
      const hasSilentBridge = indexContent.includes('Silent Bridge');
      
      // EXPECTED TO FAIL on unfixed code
      expect(hasSilentBridge).toBe(false);
      
      if (hasSilentBridge) {
        console.log('\n🔍 COUNTEREXAMPLE - "Silent Bridge" text found in index.js');
      }
    });
  });
  
  describe('Property 1: No Bridge Status Logic (Requirement 2.4)', () => {
    
    test('should have NO bridge stats calculation in status endpoint', () => {
      const indexPath = path.join(serviceDir, 'index.js');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Check for bridge stats
      const hasBridgeStats = /const\s+bridgeStats\s*=/.test(indexContent) ||
                            /let\s+bridgeStats\s*=/.test(indexContent) ||
                            /bridge:\s*bridgeStats/.test(indexContent);
      
      // EXPECTED TO FAIL on unfixed code
      expect(hasBridgeStats).toBe(false);
      
      if (hasBridgeStats) {
        console.log('\n🔍 COUNTEREXAMPLE - Bridge stats logic found in index.js');
      }
    });
    
    test('should have NO bridge printer name fallback', () => {
      const indexPath = path.join(serviceDir, 'index.js');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Check for config.bridge?.printerName fallback
      const hasBridgePrinterFallback = /config\.bridge\?\.printerName/.test(indexContent);
      
      // EXPECTED TO FAIL on unfixed code
      expect(hasBridgePrinterFallback).toBe(false);
      
      if (hasBridgePrinterFallback) {
        console.log('\n🔍 COUNTEREXAMPLE - Bridge printer name fallback found in index.js');
      }
    });
  });
  
  describe('Property 1: No Bridge API Endpoints (Requirement 2.6)', () => {
    
    test('should have NO bridge printer configuration logic', () => {
      const indexPath = path.join(serviceDir, 'index.js');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Check for bridge printer update logic
      const hasBridgePrinterUpdate = /config\.bridge\s*=\s*\{\}/.test(indexContent) ||
                                     /config\.bridge\.printerName\s*=/.test(indexContent) ||
                                     /printBridge\.restart/.test(indexContent);
      
      // EXPECTED TO FAIL on unfixed code
      expect(hasBridgePrinterUpdate).toBe(false);
      
      if (hasBridgePrinterUpdate) {
        console.log('\n🔍 COUNTEREXAMPLE - Bridge printer configuration logic found in index.js');
      }
    });
    
    test('should have NO bridge test print endpoint', () => {
      const indexPath = path.join(serviceDir, 'index.js');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      
      // Check for /api/printers/test endpoint (bridge-specific)
      const hasBridgeTestEndpoint = /app\.post\(['"]\/api\/printers\/test['"]/.test(indexContent);
      
      // EXPECTED TO FAIL on unfixed code
      expect(hasBridgeTestEndpoint).toBe(false);
      
      if (hasBridgeTestEndpoint) {
        console.log('\n🔍 COUNTEREXAMPLE - Bridge test print endpoint found in index.js');
      }
    });
  });
  
  describe('Property 1: No Bridge References in Tray App (Requirement 2.4)', () => {
    
    test('should have NO bridge status logic in tray-app.js', () => {
      const trayAppPath = path.join(projectRoot, 'src/tray/tray-app.js');
      
      // Skip if file doesn't exist
      if (!fs.existsSync(trayAppPath)) {
        console.log('⚠️  tray-app.js not found, skipping test');
        return;
      }
      
      const trayAppContent = fs.readFileSync(trayAppPath, 'utf8');
      
      // Check for bridge status logic
      const hasBridgeStatus = /captureMode\s*===\s*['"]bridge['"]/.test(trayAppContent) ||
                             /liveData\?\.bridge/.test(trayAppContent);
      
      // EXPECTED TO FAIL on unfixed code
      expect(hasBridgeStatus).toBe(false);
      
      if (hasBridgeStatus) {
        console.log('\n🔍 COUNTEREXAMPLE - Bridge status logic found in tray-app.js');
      }
    });
  });
  
  describe('Property 1: Comprehensive Bridge Code Search', () => {
    
    test('property: systematic search for bridge references in codebase', () => {
      // Property-based test: systematically search for bridge references
      fc.assert(
        fc.property(
          fc.constant({
            indexPath: path.join(serviceDir, 'index.js'),
            trayAppPath: path.join(projectRoot, 'src/tray/tray-app.js')
          }),
          (paths) => {
            const violations = [];
            
            // Check index.js
            if (fs.existsSync(paths.indexPath)) {
              const indexContent = fs.readFileSync(paths.indexPath, 'utf8');
              
              // Search for various bridge patterns
              const patterns = [
                { pattern: /require\(['"]\.\/.*bridge.*['"]\)/, name: 'bridge require()' },
                { pattern: /PrintBridge/, name: 'PrintBridge reference' },
                { pattern: /printBridge/, name: 'printBridge variable' },
                { pattern: /captureMode\s*===\s*['"]bridge['"]/, name: 'bridge captureMode check' },
                { pattern: /bridgeStats/, name: 'bridgeStats variable' },
                { pattern: /config\.bridge/, name: 'config.bridge reference' },
                { pattern: /Silent Bridge/, name: 'Silent Bridge text' }
              ];
              
              for (const { pattern, name } of patterns) {
                if (pattern.test(indexContent)) {
                  violations.push(`index.js: ${name}`);
                }
              }
            }
            
            // Check tray-app.js
            if (fs.existsSync(paths.trayAppPath)) {
              const trayContent = fs.readFileSync(paths.trayAppPath, 'utf8');
              
              if (/liveData\?\.bridge/.test(trayContent)) {
                violations.push('tray-app.js: bridge status reference');
              }
            }
            
            // EXPECTED TO FAIL: Will list all violations found
            if (violations.length > 0) {
              console.log('\n🔍 COUNTEREXAMPLE - Bridge code references found:');
              violations.forEach(v => console.log(`   - ${v}`));
            }
            
            return violations.length === 0;
          }
        ),
        {
          verbose: true,
          numRuns: 1 // Single run since we're checking filesystem
        }
      );
    });
  });
  
  describe('Summary: Bug Condition Validation', () => {
    
    test('should document all bridge code that needs removal', () => {
      const summary = {
        bridgeFiles: [],
        bridgeBatchFiles: [],
        codeReferences: []
      };
      
      // Check bridge implementation files
      const bridgeFiles = [
        'final-bridge.js',
        'universal-bridge.js',
        'printBridge.js',
        'printBridge-final.js',
        'printBridge-final-fixed.js',
        'printBridge-fixed.js',
        'printBridge-minimal.js',
        'printBridge-production.js',
        'printBridge-v3.js'
      ];
      
      for (const file of bridgeFiles) {
        if (fs.existsSync(path.join(serviceDir, file))) {
          summary.bridgeFiles.push(file);
        }
      }
      
      // Check bridge batch files
      const bridgeBatchFiles = [
        'start-bridge.bat',
        'start-bridge-admin.bat',
        'start-bridge-service.bat',
        'start-final-bridge.bat',
        'start-fixed-bridge.bat',
        'start-minimal-bridge.bat',
        'start-universal-bridge.bat',
        'test-bridge.bat',
        'deploy-bridge.bat',
        'restart-bridge.bat',
        'restore-bridge-mode.bat',
        'force-bridge-mode.bat',
        'fix-bridge-config.bat',
        'fix-bridge-config-final.bat',
        'fix-bridge-final.bat',
        'fix-epson-bridge-mismatch.bat',
        'complete-silent-bridge.bat',
        'test-complete-system.bat',
        'test-real-workflow.bat'
      ];
      
      for (const file of bridgeBatchFiles) {
        if (fs.existsSync(path.join(projectRoot, file))) {
          summary.bridgeBatchFiles.push(file);
        }
      }
      
      // Check code references
      const indexPath = path.join(serviceDir, 'index.js');
      if (fs.existsSync(indexPath)) {
        const indexContent = fs.readFileSync(indexPath, 'utf8');
        
        if (/require\(['"]\.\/.*bridge.*['"]\)/.test(indexContent)) {
          summary.codeReferences.push('index.js: bridge require()');
        }
        if (/PrintBridge/.test(indexContent)) {
          summary.codeReferences.push('index.js: PrintBridge reference');
        }
        if (/printBridge/.test(indexContent)) {
          summary.codeReferences.push('index.js: printBridge variable');
        }
        if (/captureMode\s*===\s*['"]bridge['"]/.test(indexContent)) {
          summary.codeReferences.push('index.js: bridge captureMode');
        }
      }
      
      // Print summary
      console.log('\n📋 BUG CONDITION SUMMARY - Bridge Code Found:');
      console.log(`   Bridge implementation files: ${summary.bridgeFiles.length}`);
      console.log(`   Bridge batch scripts: ${summary.bridgeBatchFiles.length}`);
      console.log(`   Code references: ${summary.codeReferences.length}`);
      
      if (summary.bridgeFiles.length > 0) {
        console.log('\n   Files to delete:');
        summary.bridgeFiles.forEach(f => console.log(`     - src/service/${f}`));
      }
      
      if (summary.bridgeBatchFiles.length > 0) {
        console.log('\n   Batch files to delete:');
        summary.bridgeBatchFiles.forEach(f => console.log(`     - ${f}`));
      }
      
      if (summary.codeReferences.length > 0) {
        console.log('\n   Code to remove:');
        summary.codeReferences.forEach(r => console.log(`     - ${r}`));
      }
      
      // EXPECTED TO FAIL: This documents the complete bug condition
      const totalViolations = summary.bridgeFiles.length + 
                             summary.bridgeBatchFiles.length + 
                             summary.codeReferences.length;
      
      expect(totalViolations).toBe(0);
    });
  });
});
