/**
 * Build Preparation Script
 * 
 * This script prepares the project for building by:
 * 1. Cleaning old build artifacts
 * 2. Rebuilding native modules for Electron
 * 3. Verifying all required files are present
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('Tabeza Connect - Build Preparation');
console.log('========================================\n');

// Step 1: Clean old build artifacts
console.log('Step 1: Cleaning old build artifacts...');
try {
  if (fs.existsSync('dist')) {
    console.log('  - Removing dist folder...');
    fs.rmSync('dist', { recursive: true, force: true });
    console.log('  ✓ Cleaned dist folder');
  } else {
    console.log('  ✓ No dist folder to clean');
  }
} catch (error) {
  console.error('  ✗ Error cleaning dist folder:', error.message);
  process.exit(1);
}

// Step 2: Rebuild native modules for Electron
console.log('\nStep 2: Rebuilding native modules for Electron...');
try {
  console.log('  - Rebuilding better-sqlite3, usb, serialport...');
  execSync('npm run rebuild', { stdio: 'inherit' });
  console.log('  ✓ Native modules rebuilt successfully');
} catch (error) {
  console.error('  ✗ Error rebuilding native modules:', error.message);
  console.error('  Please run: npm install --save-dev electron-rebuild');
  process.exit(1);
}

// Step 3: Verify required files
console.log('\nStep 3: Verifying required files...');
const requiredFiles = [
  'src/electron-main.js',
  'src/service/index.js',
  'assets/icon-green.ico',
  'package.json'
];

let allFilesPresent = true;
for (const file of requiredFiles) {
  if (fs.existsSync(file)) {
    console.log(`  ✓ ${file}`);
  } else {
    console.error(`  ✗ Missing: ${file}`);
    allFilesPresent = false;
  }
}

if (!allFilesPresent) {
  console.error('\n✗ Some required files are missing!');
  process.exit(1);
}

// Step 4: Verify native modules are built
console.log('\nStep 4: Verifying native modules...');
const nativeModules = [
  'node_modules/better-sqlite3/build/Release/better_sqlite3.node',
  'node_modules/usb/build/Release/usb_bindings.node',
  'node_modules/serialport/build/Release/bindings.node'
];

let allModulesBuilt = true;
for (const module of nativeModules) {
  if (fs.existsSync(module)) {
    console.log(`  ✓ ${path.basename(path.dirname(path.dirname(module)))}`);
  } else {
    console.error(`  ✗ Not built: ${path.basename(path.dirname(path.dirname(module)))}`);
    allModulesBuilt = false;
  }
}

if (!allModulesBuilt) {
  console.error('\n✗ Some native modules are not built!');
  console.error('Run: npm run rebuild:all');
  process.exit(1);
}

console.log('\n========================================');
console.log('✓ Build preparation complete!');
console.log('========================================\n');
console.log('You can now run: npm run build:win:x64');
