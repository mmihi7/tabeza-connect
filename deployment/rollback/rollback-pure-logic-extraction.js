#!/usr/bin/env node

/**
 * TABEZA Pure Logic Extraction Rollback
 * 
 * Rolls back the extraction of pure logic packages by restoring the original
 * code to its pre-extraction locations and removing the extracted packages.
 * 
 * Requirements: 7.5
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const ROOT_DIR = path.resolve(__dirname, '../..');
const BACKUP_DIR = path.join(__dirname, 'backups', 'pure-logic-extraction');

// Packages that were extracted and need to be rolled back
const EXTRACTED_PACKAGES = [
  {
    name: 'escpos-parser',
    originalLocation: 'packages/virtual-printer/src/parsing',
    extractedLocation: 'packages/escpos-parser',
    backupLocation: 'virtual-printer-parsing'
  },
  {
    name: 'tax-rules',
    originalLocation: 'packages/shared/src/tax',
    extractedLocation: 'packages/tax-rules',
    backupLocation: 'shared-tax'
  },
  {
    name: 'validation',
    originalLocation: 'packages/shared/src/validation',
    extractedLocation: 'packages/validation',
    backupLocation: 'shared-validation'
  }
];

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(level, message) {
  const color = colors[level] || colors.reset;
  console.log(`${color}[${level.toUpperCase()}]${colors.reset} ${message}`);
}

function validateRollbackPreconditions() {
  const issues = [];
  
  // Check if backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    issues.push('Backup directory not found - cannot rollback without backups');
    return issues;
  }
  
  // Check if extracted packages exist (they should if extraction was performed)
  for (const pkg of EXTRACTED_PACKAGES) {
    const extractedPath = path.join(ROOT_DIR, pkg.extractedLocation);
    const backupPath = path.join(BACKUP_DIR, pkg.backupLocation);
    
    if (fs.existsSync(extractedPath) && !fs.existsSync(backupPath)) {
      issues.push(`Extracted package exists but backup missing: ${pkg.name}`);
    }
  }
  
  return issues;
}

function createRollbackBackup() {
  const rollbackBackupDir = path.join(BACKUP_DIR, 'pre-rollback');
  if (!fs.existsSync(rollbackBackupDir)) {
    fs.mkdirSync(rollbackBackupDir, { recursive: true });
  }
  
  // Backup current state of extracted packages
  for (const pkg of EXTRACTED_PACKAGES) {
    const extractedPath = path.join(ROOT_DIR, pkg.extractedLocation);
    if (fs.existsSync(extractedPath)) {
      const backupPath = path.join(rollbackBackupDir, pkg.name);
      copyDirectory(extractedPath, backupPath);
      log('blue', `Backed up current state of ${pkg.name}`);
    }
  }
  
  // Backup workspace configuration
  const workspaceFiles = ['package.json', 'pnpm-workspace.yaml', 'turbo.json'];
  for (const file of workspaceFiles) {
    const sourcePath = path.join(ROOT_DIR, file);
    if (fs.existsSync(sourcePath)) {
      const targetPath = path.join(rollbackBackupDir, file);
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
  
  log('green', 'Created rollback backup');
}

function restoreOriginalCode() {
  const restoredPackages = [];
  
  for (const pkg of EXTRACTED_PACKAGES) {
    const backupPath = path.join(BACKUP_DIR, pkg.backupLocation);
    const originalPath = path.join(ROOT_DIR, pkg.originalLocation);
    
    if (fs.existsSync(backupPath)) {
      // Ensure original directory exists
      const originalDir = path.dirname(originalPath);
      if (!fs.existsSync(originalDir)) {
        fs.mkdirSync(originalDir, { recursive: true });
      }
      
      // Restore original code
      if (fs.existsSync(originalPath)) {
        // Remove current content
        fs.rmSync(originalPath, { recursive: true, force: true });
      }
      
      copyDirectory(backupPath, originalPath);
      restoredPackages.push(pkg.name);
      log('green', `Restored ${pkg.name} to ${pkg.originalLocation}`);
    } else {
      log('yellow', `No backup found for ${pkg.name} - skipping restoration`);
    }
  }
  
  return restoredPackages;
}

function removeExtractedPackages() {
  const removedPackages = [];
  
  for (const pkg of EXTRACTED_PACKAGES) {
    const extractedPath = path.join(ROOT_DIR, pkg.extractedLocation);
    
    if (fs.existsSync(extractedPath)) {
      fs.rmSync(extractedPath, { recursive: true, force: true });
      removedPackages.push(pkg.name);
      log('green', `Removed extracted package: ${pkg.extractedLocation}`);
    } else {
      log('yellow', `Extracted package not found: ${pkg.extractedLocation}`);
    }
  }
  
  return removedPackages;
}

function restoreWorkspaceConfiguration() {
  const configBackupDir = path.join(BACKUP_DIR, 'workspace-config');
  
  if (!fs.existsSync(configBackupDir)) {
    log('yellow', 'No workspace configuration backup found');
    return false;
  }
  
  const configFiles = ['package.json', 'pnpm-workspace.yaml', 'turbo.json'];
  let restoredFiles = 0;
  
  for (const file of configFiles) {
    const backupPath = path.join(configBackupDir, file);
    const targetPath = path.join(ROOT_DIR, file);
    
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, targetPath);
      restoredFiles++;
      log('green', `Restored workspace configuration: ${file}`);
    }
  }
  
  return restoredFiles > 0;
}

function updateImportsInOriginalPackages() {
  // Update imports in packages that were using the extracted logic
  const packagesToUpdate = [
    'packages/shared',
    'packages/virtual-printer',
    'apps/customer',
    'apps/staff'
  ];
  
  for (const packagePath of packagesToUpdate) {
    const fullPath = path.join(ROOT_DIR, packagePath);
    if (fs.existsSync(fullPath)) {
      updateImportsInDirectory(fullPath, packagePath);
    }
  }
}

function updateImportsInDirectory(directory, packageName) {
  function scanDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!['node_modules', '.next', 'dist', 'build'].includes(entry.name)) {
          scanDirectory(fullPath);
        }
      } else if (entry.isFile() && /\.(js|ts|jsx|tsx)$/.test(entry.name)) {
        updateImportsInFile(fullPath);
      }
    }
  }
  
  scanDirectory(directory);
  log('blue', `Updated imports in ${packageName}`);
}

function updateImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Replace extracted package imports with original relative imports
    const importReplacements = [
      {
        from: /from ['"]@tabeza\/escpos-parser['"]/g,
        to: "from '../virtual-printer/src/parsing'"
      },
      {
        from: /from ['"]@tabeza\/tax-rules['"]/g,
        to: "from './tax'"
      },
      {
        from: /from ['"]@tabeza\/validation['"]/g,
        to: "from './validation'"
      },
      {
        from: /import.*from ['"]@tabeza\/escpos-parser['"]/g,
        to: match => match.replace('@tabeza/escpos-parser', '../virtual-printer/src/parsing')
      },
      {
        from: /import.*from ['"]@tabeza\/tax-rules['"]/g,
        to: match => match.replace('@tabeza/tax-rules', './tax')
      },
      {
        from: /import.*from ['"]@tabeza\/validation['"]/g,
        to: match => match.replace('@tabeza/validation', './validation')
      }
    ];
    
    for (const replacement of importReplacements) {
      if (replacement.from.test(content)) {
        content = content.replace(replacement.from, replacement.to);
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content);
    }
    
  } catch (error) {
    log('yellow', `Error updating imports in ${filePath}: ${error.message}`);
  }
}

function copyDirectory(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  
  const entries = fs.readdirSync(source, { withFileTypes: true });
  
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function validateRollbackSuccess() {
  const issues = [];
  
  // Check that original locations have been restored
  for (const pkg of EXTRACTED_PACKAGES) {
    const originalPath = path.join(ROOT_DIR, pkg.originalLocation);
    if (!fs.existsSync(originalPath)) {
      issues.push(`Original location not restored: ${pkg.originalLocation}`);
    }
  }
  
  // Check that extracted packages have been removed
  for (const pkg of EXTRACTED_PACKAGES) {
    const extractedPath = path.join(ROOT_DIR, pkg.extractedLocation);
    if (fs.existsSync(extractedPath)) {
      issues.push(`Extracted package still exists: ${pkg.extractedLocation}`);
    }
  }
  
  return issues;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  
  log('blue', 'Starting Pure Logic Extraction Rollback...');
  
  if (isDryRun) {
    log('yellow', 'DRY RUN MODE - No changes will be made');
  }
  
  // Validate preconditions
  log('blue', 'Validating rollback preconditions...');
  const preconditionIssues = validateRollbackPreconditions();
  
  if (preconditionIssues.length > 0) {
    log('red', 'Rollback preconditions failed:');
    preconditionIssues.forEach(issue => log('red', `  - ${issue}`));
    process.exit(1);
  }
  
  if (!isDryRun) {
    // Create rollback backup
    log('blue', 'Creating rollback backup...');
    createRollbackBackup();
    
    // Restore original code
    log('blue', 'Restoring original code...');
    const restoredPackages = restoreOriginalCode();
    log('green', `Restored ${restoredPackages.length} packages to original locations`);
    
    // Remove extracted packages
    log('blue', 'Removing extracted packages...');
    const removedPackages = removeExtractedPackages();
    log('green', `Removed ${removedPackages.length} extracted packages`);
    
    // Restore workspace configuration
    log('blue', 'Restoring workspace configuration...');
    const configRestored = restoreWorkspaceConfiguration();
    if (configRestored) {
      log('green', 'Workspace configuration restored');
    }
    
    // Update imports
    log('blue', 'Updating imports in original packages...');
    updateImportsInOriginalPackages();
    
    // Validate rollback success
    log('blue', 'Validating rollback success...');
    const validationIssues = validateRollbackSuccess();
    
    if (validationIssues.length > 0) {
      log('red', 'Rollback validation failed:');
      validationIssues.forEach(issue => log('red', `  - ${issue}`));
      process.exit(1);
    }
    
    log('green', '✓ Pure Logic Extraction Rollback completed successfully');
    log('green', 'Original package structure has been restored');
    
  } else {
    log('blue', '[DRY RUN] Would restore original code locations');
    log('blue', '[DRY RUN] Would remove extracted packages');
    log('blue', '[DRY RUN] Would restore workspace configuration');
    log('blue', '[DRY RUN] Would update imports');
  }
  
  process.exit(0);
}

if (require.main === module) {
  main().catch(error => {
    log('red', `Rollback failed with error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  validateRollbackPreconditions,
  restoreOriginalCode,
  removeExtractedPackages,
  restoreWorkspaceConfiguration,
  updateImportsInOriginalPackages
};