#!/usr/bin/env node

/**
 * TABEZA Architectural Restructure - Complete Rollback
 * 
 * Performs a complete rollback of all migration phases in reverse order.
 * This script safely reverts all changes made during the architectural restructure.
 * 
 * Requirements: 7.5
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Configuration
const ROOT_DIR = path.resolve(__dirname, '../..');
const ROLLBACK_DIR = __dirname;
const BACKUP_DIR = path.join(ROLLBACK_DIR, 'backups');
const LOG_DIR = path.join(ROLLBACK_DIR, 'logs');

// Rollback phases in reverse order (last phase first)
const ROLLBACK_PHASES = [
  {
    name: 'Agent Repository Rollback',
    script: 'rollback-agent-repository.js',
    description: 'Remove agent repository and restore components',
    critical: false // Agent might not exist yet
  },
  {
    name: 'Build Configuration Rollback',
    script: 'rollback-build-configuration.js',
    description: 'Restore original build and deployment configurations',
    critical: true
  },
  {
    name: 'Package Publishing Rollback',
    script: 'rollback-package-publishing.js',
    description: 'Unpublish packages and revert to workspace dependencies',
    critical: true
  },
  {
    name: 'Infrastructure Component Rollback',
    script: 'rollback-infrastructure-removal.js',
    description: 'Restore removed infrastructure components',
    critical: true
  },
  {
    name: 'Pure Logic Extraction Rollback',
    script: 'rollback-pure-logic-extraction.js',
    description: 'Restore extracted pure logic to original packages',
    critical: true
  }
];

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(level, message) {
  const color = colors[level] || colors.reset;
  const timestamp = new Date().toISOString();
  const logMessage = `${color}[${level.toUpperCase()}]${colors.reset} ${timestamp} ${message}`;
  console.log(logMessage);
  
  // Also write to log file
  const logFile = path.join(LOG_DIR, 'rollback-all-phases.log');
  fs.appendFileSync(logFile, `[${level.toUpperCase()}] ${timestamp} ${message}\n`);
}

function ensureDirectories() {
  [BACKUP_DIR, LOG_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function validatePreRollbackState() {
  const issues = [];
  
  // Check if git repository is clean
  try {
    const gitStatus = execSync('git status --porcelain', { cwd: ROOT_DIR, encoding: 'utf8' });
    if (gitStatus.trim()) {
      issues.push('Git repository has uncommitted changes. Please commit or stash changes before rollback.');
    }
  } catch (error) {
    issues.push('Unable to check git status. Ensure you are in a git repository.');
  }
  
  // Check if backups exist
  if (!fs.existsSync(BACKUP_DIR)) {
    issues.push('Backup directory not found. Cannot perform rollback without backups.');
  }
  
  // Check if migration was actually performed
  const migrationMarker = path.join(ROOT_DIR, '.migration-in-progress');
  if (!fs.existsSync(migrationMarker)) {
    log('yellow', 'No migration marker found. System may not have been migrated.');
  }
  
  return issues;
}

function createRollbackCheckpoint() {
  const checkpointDir = path.join(BACKUP_DIR, 'pre-rollback-checkpoint');
  if (!fs.existsSync(checkpointDir)) {
    fs.mkdirSync(checkpointDir, { recursive: true });
  }
  
  // Create git commit for rollback checkpoint
  try {
    execSync('git add -A', { cwd: ROOT_DIR });
    execSync('git commit -m "Pre-rollback checkpoint - automated backup"', { cwd: ROOT_DIR });
    log('green', 'Created pre-rollback checkpoint commit');
  } catch (error) {
    log('yellow', 'Could not create git checkpoint (may be no changes to commit)');
  }
  
  // Save current package.json files
  const packageFiles = [
    'package.json',
    'apps/customer/package.json',
    'apps/staff/package.json',
    'packages/shared/package.json'
  ];
  
  for (const packageFile of packageFiles) {
    const sourcePath = path.join(ROOT_DIR, packageFile);
    if (fs.existsSync(sourcePath)) {
      const targetPath = path.join(checkpointDir, packageFile);
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
  
  log('green', 'Created rollback checkpoint');
}

function runRollbackPhase(phase) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(ROLLBACK_DIR, phase.script);
    
    if (!fs.existsSync(scriptPath)) {
      if (phase.critical) {
        reject(new Error(`Critical rollback script not found: ${phase.script}`));
      } else {
        log('yellow', `Optional rollback script not found: ${phase.script} - skipping`);
        resolve({ success: true, skipped: true });
      }
      return;
    }
    
    log('blue', `Starting ${phase.name}...`);
    
    const child = spawn('node', [scriptPath], {
      cwd: ROOT_DIR,
      stdio: ['inherit', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        log('green', `${phase.name} completed successfully`);
        resolve({ success: true, stdout, stderr });
      } else {
        log('red', `${phase.name} failed with exit code ${code}`);
        if (phase.critical) {
          reject(new Error(`Critical rollback phase failed: ${phase.name}`));
        } else {
          resolve({ success: false, stdout, stderr, exitCode: code });
        }
      }
    });
    
    child.on('error', (error) => {
      log('red', `${phase.name} error: ${error.message}`);
      if (phase.critical) {
        reject(error);
      } else {
        resolve({ success: false, error: error.message });
      }
    });
  });
}

function validatePostRollbackState() {
  const issues = [];
  
  // Check that original structure is restored
  const expectedFiles = [
    'packages/shared/package.json',
    'apps/customer/package.json',
    'apps/staff/package.json'
  ];
  
  for (const file of expectedFiles) {
    const filePath = path.join(ROOT_DIR, file);
    if (!fs.existsSync(filePath)) {
      issues.push(`Expected file not found after rollback: ${file}`);
    }
  }
  
  // Check that migration artifacts are removed
  const migrationArtifacts = [
    '.migration-in-progress',
    'packages/escpos-parser',
    'packages/tax-rules',
    'packages/validation'
  ];
  
  for (const artifact of migrationArtifacts) {
    const artifactPath = path.join(ROOT_DIR, artifact);
    if (fs.existsSync(artifactPath)) {
      // This might be expected if rollback was partial
      log('yellow', `Migration artifact still exists: ${artifact}`);
    }
  }
  
  return issues;
}

function generateRollbackReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    success: results.every(r => r.success),
    phases: results,
    summary: {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      skipped: results.filter(r => r.skipped).length
    }
  };
  
  // Write report to file
  const reportPath = path.join(LOG_DIR, 'rollback-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  return report;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const forceRollback = process.argv.includes('--force');
  
  log('cyan', '='.repeat(60));
  log('cyan', 'TABEZA ARCHITECTURAL RESTRUCTURE - COMPLETE ROLLBACK');
  log('cyan', '='.repeat(60));
  
  if (isDryRun) {
    log('yellow', 'DRY RUN MODE - No changes will be made');
  }
  
  // Ensure directories exist
  ensureDirectories();
  
  // Validate pre-rollback state
  log('blue', 'Validating pre-rollback state...');
  const preRollbackIssues = validatePreRollbackState();
  
  if (preRollbackIssues.length > 0 && !forceRollback) {
    log('red', 'Pre-rollback validation failed:');
    preRollbackIssues.forEach(issue => log('red', `  - ${issue}`));
    log('red', 'Use --force flag to proceed anyway');
    process.exit(1);
  }
  
  if (preRollbackIssues.length > 0) {
    log('yellow', 'Pre-rollback issues found but proceeding due to --force flag:');
    preRollbackIssues.forEach(issue => log('yellow', `  - ${issue}`));
  }
  
  // Create rollback checkpoint
  if (!isDryRun) {
    log('blue', 'Creating rollback checkpoint...');
    createRollbackCheckpoint();
  }
  
  // Execute rollback phases
  const results = [];
  
  for (const phase of ROLLBACK_PHASES) {
    try {
      if (isDryRun) {
        log('blue', `[DRY RUN] Would execute: ${phase.name}`);
        results.push({ 
          phase: phase.name, 
          success: true, 
          dryRun: true 
        });
      } else {
        const result = await runRollbackPhase(phase);
        results.push({ 
          phase: phase.name, 
          ...result 
        });
      }
    } catch (error) {
      log('red', `Critical error in ${phase.name}: ${error.message}`);
      results.push({ 
        phase: phase.name, 
        success: false, 
        error: error.message 
      });
      
      // Stop on critical errors
      if (phase.critical) {
        log('red', 'Stopping rollback due to critical error');
        break;
      }
    }
  }
  
  // Validate post-rollback state
  if (!isDryRun) {
    log('blue', 'Validating post-rollback state...');
    const postRollbackIssues = validatePostRollbackState();
    
    if (postRollbackIssues.length > 0) {
      log('yellow', 'Post-rollback validation issues:');
      postRollbackIssues.forEach(issue => log('yellow', `  - ${issue}`));
    } else {
      log('green', 'Post-rollback validation passed');
    }
  }
  
  // Generate report
  const report = generateRollbackReport(results);
  
  // Summary
  log('cyan', '='.repeat(60));
  log('cyan', 'ROLLBACK SUMMARY');
  log('cyan', '='.repeat(60));
  
  log('blue', `Total phases: ${report.summary.total}`);
  log('green', `Successful: ${report.summary.successful}`);
  log('red', `Failed: ${report.summary.failed}`);
  log('yellow', `Skipped: ${report.summary.skipped}`);
  
  if (report.success) {
    log('green', '🎉 Complete rollback SUCCESSFUL!');
    log('green', 'System has been restored to pre-migration state');
    
    // Clean up migration marker
    const migrationMarker = path.join(ROOT_DIR, '.migration-in-progress');
    if (fs.existsSync(migrationMarker)) {
      fs.unlinkSync(migrationMarker);
    }
    
  } else {
    log('red', '❌ Rollback completed with errors');
    log('red', 'Some phases failed - manual intervention may be required');
    log('blue', `Check detailed report: ${path.join(LOG_DIR, 'rollback-report.json')}`);
  }
  
  log('cyan', '='.repeat(60));
  
  process.exit(report.success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    log('red', `Rollback failed with error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runRollbackPhase,
  validatePreRollbackState,
  validatePostRollbackState,
  generateRollbackReport
};