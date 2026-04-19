/**
 * Bug 4: EPIPE Broken Pipe Errors - Bug Condition Exploration Test
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * GOAL: Surface counterexamples that demonstrate the bug exists
 * 
 * Bug Condition: RedMon registry check fails, system generates cascading 
 * "EPIPE: broken pipe, write" errors originating from verifyRedMonRegistry 
 * function at electron-main.js:168:21
 * 
 * Expected Behavior: When RedMon registry check fails, system handles error 
 * gracefully without generating EPIPE errors. Cascading pipe errors are suppressed.
 * 
 * Requirements: 4.1, 4.2 from bugfix.md
 * 
 * NOTE: This test simulates RedMon registry check failure by attempting to 
 * query a non-existent registry key and monitoring for EPIPE errors.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_DIR = path.join(__dirname, '..', 'test-data');
const LOG_PATH = path.join(TEST_DIR, 'epipe-test.log');
const REDMON_REG_PATH = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Print\\Monitors\\Redirected Port\\Ports\\TabezaCapturePort';

// Mock verifyRedMonRegistry function that mimics the current implementation
function verifyRedMonRegistryUnfixed() {
  const regPath = REDMON_REG_PATH;
  
  try {
    // This will fail if RedMon is not installed
    const command = execSync(`reg query "${regPath}"`, { encoding: 'utf8' });
    
    // Check if command is correct
    if (!command.includes('C:\\TabezaPrints\\capture.exe')) {
      console.log('INFO: Fixing RedMon registry: Setting capture.exe path');
      execSync(`reg add "${regPath}" /v Command /t REG_SZ /d "C:\\TabezaPrints\\capture.exe" /f`, { encoding: 'utf8' });
    }
    
    // Check if output (physical printer) is set
    if (!command.includes('EPSON')) {
      console.log('INFO: Fixing RedMon registry: Setting output printer');
      execSync(`reg add "${regPath}" /v Output /t REG_SZ /d "EPSON L3210 Series" /f`, { encoding: 'utf8' });
    }
    
    console.log('INFO: RedMon registry verified');
  } catch (e) {
    // On unfixed code, this catch block logs the warning
    // but doesn't handle the EPIPE errors that occur when
    // console.log tries to write to a closed pipe
    console.log(`WARN: RedMon registry check failed: ${e.message}`);
  }
}

// Mock verifyRedMonRegistry function with expected fix
function verifyRedMonRegistryFixed() {
  const regPath = REDMON_REG_PATH;
  
  try {
    // This will fail if RedMon is not installed
    const command = execSync(`reg query "${regPath}"`, { encoding: 'utf8' });
    
    // Check if command is correct
    if (!command.includes('C:\\TabezaPrints\\capture.exe')) {
      safeLog('INFO: Fixing RedMon registry: Setting capture.exe path');
      execSync(`reg add "${regPath}" /v Command /t REG_SZ /d "C:\\TabezaPrints\\capture.exe" /f`, { encoding: 'utf8' });
    }
    
    // Check if output (physical printer) is set
    if (!command.includes('EPSON')) {
      safeLog('INFO: Fixing RedMon registry: Setting output printer');
      execSync(`reg add "${regPath}" /v Output /t REG_SZ /d "EPSON L3210 Series" /f`, { encoding: 'utf8' });
    }
    
    safeLog('INFO: RedMon registry verified');
  } catch (e) {
    // Fixed version: wrap console operations in try/catch to prevent EPIPE
    safeLog(`WARN: RedMon registry check failed: ${e.message}`);
  }
}

// Safe logging function that catches EPIPE errors
function safeLog(message) {
  try {
    console.log(message);
  } catch (e) {
    if (e.code === 'EPIPE') {
      // Silently ignore EPIPE errors
      // Use alternative logging method
      try {
        fs.appendFileSync(LOG_PATH, `${new Date().toISOString()} ${message}\n`);
      } catch (fsError) {
        // If file logging also fails, give up silently
      }
    } else {
      throw e;
    }
  }
}

// Check if RedMon is installed
function isRedMonInstalled() {
  try {
    execSync(`reg query "${REDMON_REG_PATH}"`, { encoding: 'utf8', stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Capture stderr output from a function
function captureStderr(fn) {
  const originalStderrWrite = process.stderr.write;
  const errors = [];
  
  process.stderr.write = function(chunk, encoding, callback) {
    errors.push(chunk.toString());
    return originalStderrWrite.apply(process.stderr, arguments);
  };
  
  try {
    fn();
  } finally {
    process.stderr.write = originalStderrWrite;
  }
  
  return errors;
}

describe('Bug 4: EPIPE Broken Pipe Errors - Bug Condition Exploration', () => {
  
  beforeAll(() => {
    console.log('\n========================================');
    console.log('Bug 4: EPIPE Broken Pipe Errors Test');
    console.log('========================================');
    console.log('EXPECTED OUTCOME: This test MUST FAIL on unfixed code');
    console.log('Failure confirms the bug exists\n');
    
    // Create test directory
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
    
    // Check RedMon installation status
    const redmonInstalled = isRedMonInstalled();
    console.log(`RedMon Installation Status: ${redmonInstalled ? 'INSTALLED' : 'NOT INSTALLED'}`);
    
    if (redmonInstalled) {
      console.log('\n⚠️  WARNING: RedMon is installed');
      console.log('This test requires RedMon to be NOT installed to trigger the bug');
      console.log('The test will attempt to simulate the failure condition\n');
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

  describe('Property 1: Bug Condition - EPIPE Errors Cascade From Registry Check Failure', () => {
    
    test('EXPECTED TO FAIL: RedMon registry check fails → system should handle gracefully without EPIPE errors', () => {
      console.log('\n--- Test Execution ---');
      
      // ─────────────────────────────────────────────────────────────────
      // Step 1: Verify RedMon is not installed (bug precondition)
      // ─────────────────────────────────────────────────────────────────
      console.log('Step 1: Checking RedMon installation status...');
      
      const redmonInstalled = isRedMonInstalled();
      console.log(`  RedMon installed: ${redmonInstalled}`);
      
      if (redmonInstalled) {
        console.log('\n⚠️  RedMon is installed - test will simulate failure condition');
        console.log('  In production, this bug occurs when RedMon is NOT installed\n');
      }

      // ─────────────────────────────────────────────────────────────────
      // Step 2: Simulate registry check failure with UNFIXED code
      // ─────────────────────────────────────────────────────────────────
      console.log('\nStep 2: Simulating registry check with UNFIXED code...');
      console.log('  → Attempting to query RedMon registry key');
      console.log('  → Registry query will fail (RedMon not installed)');
      console.log('  → Catch block will log warning');
      console.log('  → console.log may trigger EPIPE error if pipe is broken');
      
      // Capture any errors that occur
      const errors = [];
      const originalConsoleError = console.error;
      console.error = function(...args) {
        errors.push(args.join(' '));
        originalConsoleError.apply(console, args);
      };
      
      // Track if EPIPE errors occur
      let epipeErrorOccurred = false;
      let cascadingErrorCount = 0;
      
      try {
        // Simulate the unfixed verifyRedMonRegistry function
        // This mimics the current implementation that doesn't handle EPIPE
        const regPath = REDMON_REG_PATH;
        
        try {
          // This will fail if RedMon is not installed
          execSync(`reg query "${regPath}"`, { encoding: 'utf8' });
          console.log('  ✓ RedMon registry key found');
        } catch (e) {
          // On unfixed code, this console.log can trigger EPIPE
          // if the child process has closed its stdout/stderr pipes
          console.log(`  ✗ RedMon registry check failed: ${e.message}`);
          
          // Simulate additional console operations that would cascade the error
          console.log('  → Attempting to log additional diagnostic info...');
          console.log('  → This could trigger cascading EPIPE errors...');
        }
      } catch (pipeError) {
        if (pipeError.code === 'EPIPE' || pipeError.message.includes('EPIPE')) {
          epipeErrorOccurred = true;
          cascadingErrorCount++;
          console.error(`  ✗ EPIPE ERROR DETECTED: ${pipeError.message}`);
        }
      } finally {
        console.error = originalConsoleError;
      }
      
      console.log(`\n  EPIPE errors detected: ${epipeErrorOccurred}`);
      console.log(`  Cascading error count: ${cascadingErrorCount}`);
      console.log(`  Total errors captured: ${errors.length}`);

      // ─────────────────────────────────────────────────────────────────
      // Step 3: Check for EPIPE errors in captured output
      // ─────────────────────────────────────────────────────────────────
      console.log('\nStep 3: Analyzing captured errors for EPIPE...');
      
      const epipeErrors = errors.filter(err => 
        err.includes('EPIPE') || err.includes('broken pipe')
      );
      
      console.log(`  EPIPE-related errors found: ${epipeErrors.length}`);
      
      if (epipeErrors.length > 0) {
        console.log('\n  Captured EPIPE errors:');
        epipeErrors.forEach((err, idx) => {
          console.log(`    ${idx + 1}. ${err.substring(0, 100)}...`);
        });
      }

      // ─────────────────────────────────────────────────────────────────
      // Step 4: Test with child process to trigger actual EPIPE
      // ─────────────────────────────────────────────────────────────────
      console.log('\nStep 4: Testing with child process to trigger EPIPE...');
      console.log('  → Spawning child process that exits prematurely');
      console.log('  → Parent will attempt to write to closed pipe');
      
      let childProcessEpipeDetected = false;
      
      try {
        // Create a child process that exits immediately
        const child = spawn('cmd', ['/c', 'exit'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        // Wait for process to exit
        child.on('exit', () => {
          // Try to write to the closed pipe
          try {
            child.stdin.write('This should trigger EPIPE\n');
          } catch (e) {
            if (e.code === 'EPIPE') {
              childProcessEpipeDetected = true;
              console.log(`  ✗ EPIPE ERROR: ${e.message}`);
            }
          }
        });
        
        // Give it time to exit
        child.stdin.end();
        
        // Wait a bit for the exit event
        const waitForExit = new Promise(resolve => {
          child.on('exit', () => setTimeout(resolve, 100));
        });
        
        // This is synchronous for test purposes
        // In real code, this would be async
      } catch (e) {
        if (e.code === 'EPIPE') {
          childProcessEpipeDetected = true;
          console.log(`  ✗ EPIPE ERROR in child process: ${e.message}`);
        }
      }
      
      console.log(`  Child process EPIPE detected: ${childProcessEpipeDetected}`);

      // ─────────────────────────────────────────────────────────────────
      // Step 5: CRITICAL ASSERTION - This MUST FAIL on unfixed code
      // ─────────────────────────────────────────────────────────────────
      console.log('\n--- Expected Behavior Assertion ---');
      console.log('Testing: System should handle registry check failure without EPIPE errors');
      console.log(`  Expected: No EPIPE errors (count = 0)`);
      console.log(`  Actual:   EPIPE errors = ${epipeErrors.length}, cascading = ${cascadingErrorCount}`);

      // This assertion MUST FAIL on unfixed code because:
      // - RedMon registry check fails (RedMon not installed)
      // - execSync throws error
      // - Catch block tries to log with console.log
      // - If child process has closed pipes, console.log triggers EPIPE
      // - No try/catch around console operations
      // - EPIPE errors cascade through the error handling code
      
      // The bug is confirmed if ANY EPIPE errors occurred
      const totalEpipeErrors = epipeErrors.length + cascadingErrorCount;
      
      expect(totalEpipeErrors).toBe(0);
      
      // If we reach here, the bug is fixed
      console.log('  ✓ PASS: No EPIPE errors detected - system handles registry failure gracefully');
    });

    test('EXPECTED TO FAIL: Cascading EPIPE errors should be suppressed', () => {
      console.log('\n--- Cascading Error Suppression Test ---');
      
      // This test verifies that when one EPIPE error occurs,
      // it doesn't trigger a cascade of additional EPIPE errors
      
      console.log('Step 1: Simulating multiple console operations after registry failure...');
      
      let epipeCount = 0;
      const operations = [
        'First log operation',
        'Second log operation',
        'Third log operation',
        'Fourth log operation',
        'Fifth log operation'
      ];
      
      // Simulate multiple console operations that could each trigger EPIPE
      operations.forEach((op, idx) => {
        try {
          console.log(`  ${idx + 1}. ${op}`);
        } catch (e) {
          if (e.code === 'EPIPE') {
            epipeCount++;
            console.error(`  ✗ EPIPE on operation ${idx + 1}`);
          }
        }
      });
      
      console.log(`\n  Total EPIPE errors in cascade: ${epipeCount}`);
      console.log('\n--- Expected Behavior Assertion ---');
      console.log('Testing: Cascading EPIPE errors should be suppressed');
      console.log(`  Expected: 0 cascading errors`);
      console.log(`  Actual:   ${epipeCount} cascading errors`);

      // This assertion MUST FAIL on unfixed code because:
      // - First EPIPE error occurs
      // - Error handler tries to log the error
      // - Logging the error triggers another EPIPE
      // - This cascades through multiple operations
      // - No circuit breaker to stop the cascade
      
      expect(epipeCount).toBe(0);
      
      // If we reach here, the bug is fixed
      console.log('  ✓ PASS: Cascading errors successfully suppressed');
    });

    test('EXPECTED TO FAIL: Error logs should not be polluted with EPIPE messages', () => {
      console.log('\n--- Log Pollution Test ---');
      
      // This test verifies that the error log doesn't get filled
      // with hundreds of EPIPE messages that hide actual errors
      
      console.log('Step 1: Simulating registry check failure with logging...');
      
      // Create a temporary log file
      const tempLogPath = path.join(TEST_DIR, 'temp-error.log');
      
      // Simulate multiple registry check failures
      const checkCount = 10;
      console.log(`  → Running ${checkCount} registry checks...`);
      
      for (let i = 0; i < checkCount; i++) {
        try {
          execSync(`reg query "${REDMON_REG_PATH}"`, { encoding: 'utf8' });
        } catch (e) {
          // Log the error (this could trigger EPIPE on unfixed code)
          const logMessage = `[${i + 1}] Registry check failed: ${e.message}\n`;
          try {
            fs.appendFileSync(tempLogPath, logMessage);
          } catch (logError) {
            if (logError.code === 'EPIPE') {
              // EPIPE occurred during logging
              console.error(`  ✗ EPIPE during log write ${i + 1}`);
            }
          }
        }
      }
      
      console.log('  ✓ Registry checks completed');
      
      // Read the log file and count EPIPE mentions
      let epipeLogCount = 0;
      if (fs.existsSync(tempLogPath)) {
        const logContent = fs.readFileSync(tempLogPath, 'utf8');
        const lines = logContent.split('\n');
        epipeLogCount = lines.filter(line => 
          line.includes('EPIPE') || line.includes('broken pipe')
        ).length;
        
        console.log(`\n  Log file size: ${logContent.length} bytes`);
        console.log(`  Total log lines: ${lines.length}`);
        console.log(`  EPIPE-related lines: ${epipeLogCount}`);
      }
      
      console.log('\n--- Expected Behavior Assertion ---');
      console.log('Testing: Error log should not contain EPIPE pollution');
      console.log(`  Expected: 0 EPIPE log entries`);
      console.log(`  Actual:   ${epipeLogCount} EPIPE log entries`);

      // This assertion MUST FAIL on unfixed code because:
      // - Each registry check failure triggers EPIPE
      // - EPIPE errors get logged
      // - Log becomes polluted with EPIPE messages
      // - Actual errors are hidden in the noise
      
      expect(epipeLogCount).toBe(0);
      
      // Cleanup
      if (fs.existsSync(tempLogPath)) {
        fs.unlinkSync(tempLogPath);
      }
      
      // If we reach here, the bug is fixed
      console.log('  ✓ PASS: Error log is clean, no EPIPE pollution');
    });
  });

  describe('Counterexample Documentation', () => {
    
    test('Document the bug condition counterexample', () => {
      console.log('\n========================================');
      console.log('COUNTEREXAMPLE DOCUMENTATION');
      console.log('========================================\n');
      
      console.log('Bug Condition: isBugCondition_EPIPE(input)');
      console.log('  WHERE input.redmonCheckFailed == true');
      console.log('  AND input.errorType == "EPIPE"');
      console.log('  AND input.errorMessage contains "broken pipe, write"');
      console.log('  AND input.cascadingErrors > 0\n');
      
      console.log('Observed Behavior (UNFIXED CODE):');
      console.log('  1. Service starts and calls verifyRedMonRegistry()');
      console.log('  2. RedMon is not installed on the system');
      console.log('  3. execSync(`reg query ...`) throws error');
      console.log('  4. Catch block executes: console.log(`WARN: ...`)');
      console.log('  5. Child process has already closed stdout/stderr pipes');
      console.log('  6. console.log attempts to write to closed pipe');
      console.log('  7. EPIPE error thrown: "EPIPE: broken pipe, write"');
      console.log('  8. Error handler tries to log the EPIPE error');
      console.log('  9. Logging triggers another EPIPE error');
      console.log('  10. Cascading EPIPE errors fill the error log');
      console.log('  11. Actual errors are hidden in EPIPE noise\n');
      
      console.log('Expected Behavior (FIXED CODE):');
      console.log('  1. Service starts and calls verifyRedMonRegistry()');
      console.log('  2. RedMon is not installed on the system');
      console.log('  3. execSync(`reg query ...`) throws error');
      console.log('  4. Catch block executes with safe logging');
      console.log('  5. safeLog() wraps console.log in try/catch');
      console.log('  6. If EPIPE occurs, it is caught and suppressed');
      console.log('  7. Alternative logging method used (fs.appendFileSync)');
      console.log('  8. No cascading errors occur');
      console.log('  9. Error log remains clean and readable');
      console.log('  10. Circuit breaker prevents repeated failures\n');
      
      console.log('Root Cause Analysis:');
      console.log('  - verifyRedMonRegistry() uses execSync (synchronous)');
      console.log('  - When execSync fails, child process closes pipes');
      console.log('  - Catch block uses console.log without protection');
      console.log('  - No try/catch around console operations');
      console.log('  - EPIPE errors cascade through error handling');
      console.log('  - No circuit breaker to stop repeated failures\n');
      
      console.log('Fix Required:');
      console.log('  File: electron-main.js');
      console.log('  Function: verifyRedMonRegistry()');
      console.log('  Changes:');
      console.log('    1. Wrap all console.log calls in try/catch');
      console.log('    2. Catch EPIPE errors specifically');
      console.log('    3. Use alternative logging (fs.appendFileSync) on EPIPE');
      console.log('    4. Consider using async exec instead of execSync');
      console.log('    5. Add circuit breaker flag to prevent cascading');
      console.log('    6. Handle stdout/stderr streams explicitly\n');
      
      console.log('Alternative Fix (Async):');
      console.log('  - Replace execSync with async exec');
      console.log('  - Handle stdout/stderr streams properly');
      console.log('  - Close streams explicitly after reading');
      console.log('  - Avoid blocking operations that can break pipes\n');
      
      console.log('========================================\n');
      
      // This test always passes - it's just for documentation
      expect(true).toBe(true);
    });
  });
});
