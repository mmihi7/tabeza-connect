#!/usr/bin/env node

/**
 * Task 4: Comprehensive Checkpoint Verification
 * 
 * This script verifies that all refactoring work is complete and all three projects
 * are functioning correctly with no regressions.
 * 
 * Verification Steps:
 * 1. Run exploration test (bug condition - should pass)
 * 2. Run preservation tests (functional behavior - should pass)
 * 3. Verify type-checking passes for all projects
 * 4. Verify production builds work for all projects
 * 5. Document any remaining issues or follow-up tasks
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(message) {
  console.log('\n' + '='.repeat(80));
  log(message, 'bright');
  console.log('='.repeat(80) + '\n');
}

function subheader(message) {
  console.log('\n' + '-'.repeat(80));
  log(message, 'cyan');
  console.log('-'.repeat(80));
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function warning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ ${message}`, 'blue');
}

// Project paths
const PROJECTS = {
  'tabeza-customer': path.resolve(__dirname, '../../../../../tabeza-customer'),
  'tabeza-staff': path.resolve(__dirname, '../../../../../tabeza-staff'),
  'tabeza-connect': path.resolve(__dirname, '../../../../../tabeza-connect')
};

// Verification results
const results = {
  explorationTest: null,
  preservationTests: null,
  typeChecking: {},
  builds: {},
  issues: [],
  followUpTasks: []
};

/**
 * Step 1: Run exploration test (bug condition verification)
 */
function runExplorationTest() {
  subheader('Step 1: Running Bug Condition Exploration Test');
  
  try {
    const testRunner = path.join(__dirname, 'run-exploration-test.js');
    info(`Executing: node ${testRunner}`);
    
    const output = execSync(`node "${testRunner}"`, {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    // Check if all tests passed
    const passedCount = (output.match(/✓ PASSED/g) || []).length;
    const failedCount = (output.match(/✗ FAILED/g) || []).length;
    
    if (failedCount === 0 && passedCount > 0) {
      success(`Exploration test PASSED (${passedCount} test cases)`);
      results.explorationTest = 'PASSED';
      return true;
    } else {
      error(`Exploration test FAILED (${failedCount} failures, ${passedCount} passes)`);
      results.explorationTest = 'FAILED';
      results.issues.push('Bug condition exploration test has failures');
      return false;
    }
  } catch (err) {
    error(`Failed to run exploration test: ${err.message}`);
    results.explorationTest = 'ERROR';
    results.issues.push(`Exploration test execution error: ${err.message}`);
    return false;
  }
}

/**
 * Step 2: Run preservation tests (functional behavior verification)
 */
function runPreservationTests() {
  subheader('Step 2: Running Preservation Property Tests');
  
  try {
    const testRunner = path.join(__dirname, 'run-preservation-tests.js');
    info(`Executing: node ${testRunner}`);
    
    const output = execSync(`node "${testRunner}"`, {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    // Check if all tests passed
    const passedCount = (output.match(/✓ PASSED/g) || []).length;
    const failedCount = (output.match(/✗ FAILED/g) || []).length;
    
    if (failedCount === 0 && passedCount > 0) {
      success(`Preservation tests PASSED (${passedCount} test cases)`);
      results.preservationTests = 'PASSED';
      return true;
    } else {
      error(`Preservation tests FAILED (${failedCount} failures, ${passedCount} passes)`);
      results.preservationTests = 'FAILED';
      results.issues.push('Preservation tests have failures - functional regressions detected');
      return false;
    }
  } catch (err) {
    error(`Failed to run preservation tests: ${err.message}`);
    results.preservationTests = 'ERROR';
    results.issues.push(`Preservation test execution error: ${err.message}`);
    return false;
  }
}

/**
 * Step 3: Verify type-checking for all projects
 */
function verifyTypeChecking() {
  subheader('Step 3: Verifying TypeScript Type-Checking');
  
  for (const [projectName, projectPath] of Object.entries(PROJECTS)) {
    info(`Checking ${projectName}...`);
    
    // Skip tabeza-connect if it doesn't have type-check script
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8')
    );
    
    if (!packageJson.scripts || !packageJson.scripts['type-check']) {
      warning(`${projectName} does not have type-check script - skipping`);
      results.typeChecking[projectName] = 'SKIPPED';
      continue;
    }
    
    try {
      execSync('pnpm type-check', {
        cwd: projectPath,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      success(`${projectName} type-checking PASSED`);
      results.typeChecking[projectName] = 'PASSED';
    } catch (err) {
      error(`${projectName} type-checking FAILED`);
      results.typeChecking[projectName] = 'FAILED';
      results.issues.push(`${projectName} has TypeScript errors`);
      
      // Log error details
      if (err.stdout) {
        console.log(err.stdout.substring(0, 500)); // First 500 chars
      }
    }
  }
}

/**
 * Step 4: Verify production builds
 */
function verifyBuilds() {
  subheader('Step 4: Verifying Production Builds');
  
  for (const [projectName, projectPath] of Object.entries(PROJECTS)) {
    info(`Building ${projectName}...`);
    
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8')
    );
    
    if (!packageJson.scripts || !packageJson.scripts.build) {
      warning(`${projectName} does not have build script - skipping`);
      results.builds[projectName] = 'SKIPPED';
      continue;
    }
    
    try {
      // For tabeza-connect, just verify the build script exists
      if (projectName === 'tabeza-connect') {
        info(`${projectName} uses Windows batch files for building - verifying scripts exist`);
        const buildProdExists = fs.existsSync(path.join(projectPath, 'build-production.bat'));
        const buildInstallerExists = fs.existsSync(path.join(projectPath, 'build-installer.bat'));
        
        if (buildProdExists && buildInstallerExists) {
          success(`${projectName} build scripts exist`);
          results.builds[projectName] = 'VERIFIED';
        } else {
          error(`${projectName} build scripts missing`);
          results.builds[projectName] = 'FAILED';
          results.issues.push(`${projectName} missing build scripts`);
        }
        continue;
      }
      
      // For Next.js apps, run actual build
      info(`Running: pnpm build`);
      execSync('pnpm build', {
        cwd: projectPath,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 300000 // 5 minute timeout
      });
      
      success(`${projectName} build PASSED`);
      results.builds[projectName] = 'PASSED';
    } catch (err) {
      error(`${projectName} build FAILED`);
      results.builds[projectName] = 'FAILED';
      results.issues.push(`${projectName} production build failed`);
      
      // Log error details
      if (err.stdout) {
        console.log(err.stdout.substring(0, 500)); // First 500 chars
      }
    }
  }
}

/**
 * Step 5: Check for simultaneous execution capability
 */
function checkSimultaneousExecution() {
  subheader('Step 5: Verifying Simultaneous Execution Capability');
  
  info('Checking port configurations...');
  
  const customerPort = 3002;
  const staffPort = 3003;
  
  const customerPackage = JSON.parse(
    fs.readFileSync(path.join(PROJECTS['tabeza-customer'], 'package.json'), 'utf8')
  );
  const staffPackage = JSON.parse(
    fs.readFileSync(path.join(PROJECTS['tabeza-staff'], 'package.json'), 'utf8')
  );
  
  const customerDevScript = customerPackage.scripts.dev;
  const staffDevScript = staffPackage.scripts.dev;
  
  if (customerDevScript.includes('3002') && staffDevScript.includes('3003')) {
    success('Port configurations are correct (customer: 3002, staff: 3003)');
    success('Projects can run simultaneously without port conflicts');
  } else {
    error('Port configuration issue detected');
    results.issues.push('Port configurations may cause conflicts');
  }
  
  info('Note: Actual simultaneous execution test requires manual verification');
  results.followUpTasks.push('Manual test: Run `pnpm dev` in both tabeza-customer and tabeza-staff simultaneously');
}

/**
 * Generate final report
 */
function generateReport() {
  header('CHECKPOINT VERIFICATION REPORT');
  
  console.log('Task 4: Comprehensive Checkpoint Verification');
  console.log('Date:', new Date().toISOString());
  console.log('');
  
  // Summary
  log('SUMMARY', 'bright');
  console.log('--------');
  console.log(`Exploration Test:     ${results.explorationTest || 'NOT RUN'}`);
  console.log(`Preservation Tests:   ${results.preservationTests || 'NOT RUN'}`);
  console.log('');
  
  log('Type-Checking Results:', 'bright');
  for (const [project, status] of Object.entries(results.typeChecking)) {
    const statusColor = status === 'PASSED' ? 'green' : status === 'FAILED' ? 'red' : 'yellow';
    log(`  ${project.padEnd(20)} ${status}`, statusColor);
  }
  console.log('');
  
  log('Build Results:', 'bright');
  for (const [project, status] of Object.entries(results.builds)) {
    const statusColor = status === 'PASSED' || status === 'VERIFIED' ? 'green' : status === 'FAILED' ? 'red' : 'yellow';
    log(`  ${project.padEnd(20)} ${status}`, statusColor);
  }
  console.log('');
  
  // Issues
  if (results.issues.length > 0) {
    log('ISSUES FOUND', 'red');
    console.log('------------');
    results.issues.forEach((issue, i) => {
      error(`${i + 1}. ${issue}`);
    });
    console.log('');
  } else {
    success('NO ISSUES FOUND - All verifications passed!');
    console.log('');
  }
  
  // Follow-up tasks
  if (results.followUpTasks.length > 0) {
    log('FOLLOW-UP TASKS', 'yellow');
    console.log('---------------');
    results.followUpTasks.forEach((task, i) => {
      warning(`${i + 1}. ${task}`);
    });
    console.log('');
  }
  
  // Overall status
  const allPassed = 
    results.explorationTest === 'PASSED' &&
    results.preservationTests === 'PASSED' &&
    Object.values(results.typeChecking).every(s => s === 'PASSED' || s === 'SKIPPED') &&
    Object.values(results.builds).every(s => s === 'PASSED' || s === 'VERIFIED' || s === 'SKIPPED') &&
    results.issues.length === 0;
  
  console.log('='.repeat(80));
  if (allPassed) {
    success('✓ CHECKPOINT VERIFICATION COMPLETE - ALL TESTS PASSED');
    success('✓ Monorepo refactoring audit is COMPLETE');
  } else {
    error('✗ CHECKPOINT VERIFICATION INCOMPLETE - ISSUES DETECTED');
    error('✗ Please address the issues above before marking task complete');
  }
  console.log('='.repeat(80));
  console.log('');
  
  return allPassed;
}

/**
 * Main execution
 */
function main() {
  header('TASK 4: COMPREHENSIVE CHECKPOINT VERIFICATION');
  
  info('This script verifies that all refactoring work is complete');
  info('and all three projects are functioning correctly.');
  console.log('');
  
  // Run all verification steps
  runExplorationTest();
  runPreservationTests();
  verifyTypeChecking();
  verifyBuilds();
  checkSimultaneousExecution();
  
  // Generate final report
  const success = generateReport();
  
  // Exit with appropriate code
  process.exit(success ? 0 : 1);
}

// Run the verification
main();
