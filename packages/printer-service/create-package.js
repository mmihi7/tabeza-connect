#!/usr/bin/env node
/**
 * Create deployment package for Tabeza Printer Service
 * Bundles all necessary files for distribution
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGE_NAME = 'tabeza-printer-service';
const VERSION = require('./package.json').version;
const OUTPUT_DIR = path.join(__dirname, '../../dist');
const PACKAGE_DIR = path.join(OUTPUT_DIR, `${PACKAGE_NAME}-v${VERSION}`);

console.log('╔════════════════════════════════════════╗');
console.log('║  Creating Tabeza Printer Service      ║');
console.log('║  Deployment Package                    ║');
console.log('╚════════════════════════════════════════╝\n');

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

if (fs.existsSync(PACKAGE_DIR)) {
  console.log('Cleaning old package...');
  fs.rmSync(PACKAGE_DIR, { recursive: true, force: true });
}

fs.mkdirSync(PACKAGE_DIR, { recursive: true });

console.log(`Creating package in: ${PACKAGE_DIR}\n`);

// Files to include
const files = [
  'index.js',
  'install-service.js',
  'uninstall-service.js',
  'test-service.js',
  'package.json',
  'README.md'
];

// Copy files
console.log('Copying files...');
files.forEach(file => {
  const src = path.join(__dirname, file);
  const dest = path.join(PACKAGE_DIR, file);
  
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  ✓ ${file}`);
  } else {
    console.log(`  ⚠ ${file} not found, skipping`);
  }
});

// Create installation instructions
const installInstructions = `
# Tabeza Printer Service Installation

## Quick Start

1. Extract this folder to: C:\\Program Files\\Tabeza\\printer-service
2. Open Command Prompt as Administrator
3. Navigate to the folder:
   cd "C:\\Program Files\\Tabeza\\printer-service"
4. Install dependencies:
   npm install
5. Install as Windows service:
   npm run install-service
6. Follow the prompts to configure

## Manual Testing

To test without installing as a service:

npm start

Then visit: http://localhost:8765/api/status

## Configuration

After installation, you can reconfigure by editing:
C:\\Program Files\\Tabeza\\printer-service\\config.json

Or use the API:
curl -X POST http://localhost:8765/api/configure -H "Content-Type: application/json" -d "{\\"barId\\":\\"your-bar-id\\"}"

## Support

Email: support@tabeza.co.ke
Website: https://tabeza.co.ke
`;

fs.writeFileSync(path.join(PACKAGE_DIR, 'INSTALL.txt'), installInstructions.trim());
console.log('  ✓ INSTALL.txt');

// Create batch file for easy installation
const installBatch = `@echo off
echo ========================================
echo Tabeza Printer Service Installer
echo ========================================
echo.

REM Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo Installing dependencies...
call npm install
if %errorLevel% neq 0 (
    echo ERROR: Failed to install dependencies
    echo Make sure Node.js is installed
    pause
    exit /b 1
)

echo.
echo Installing Windows service...
call npm run install-service

pause
`;

fs.writeFileSync(path.join(PACKAGE_DIR, 'install.bat'), installBatch);
console.log('  ✓ install.bat');

// Create uninstall batch file
const uninstallBatch = `@echo off
echo ========================================
echo Tabeza Printer Service Uninstaller
echo ========================================
echo.

REM Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo Uninstalling Windows service...
call npm run uninstall-service

echo.
echo Service uninstalled successfully!
echo You can now delete this folder.
pause
`;

fs.writeFileSync(path.join(PACKAGE_DIR, 'uninstall.bat'), uninstallBatch);
console.log('  ✓ uninstall.bat');

// Create ZIP archive if possible
console.log('\nCreating ZIP archive...');
try {
  const zipFile = path.join(OUTPUT_DIR, `${PACKAGE_NAME}-v${VERSION}.zip`);
  
  // Try to use PowerShell to create ZIP (Windows)
  if (process.platform === 'win32') {
    const psCommand = `Compress-Archive -Path "${PACKAGE_DIR}\\*" -DestinationPath "${zipFile}" -Force`;
    execSync(`powershell -Command "${psCommand}"`, { stdio: 'inherit' });
    console.log(`  ✓ Created: ${zipFile}`);
  } else {
    // Use zip command on Unix-like systems
    execSync(`cd "${OUTPUT_DIR}" && zip -r "${PACKAGE_NAME}-v${VERSION}.zip" "${PACKAGE_NAME}-v${VERSION}"`, { stdio: 'inherit' });
    console.log(`  ✓ Created: ${zipFile}`);
  }
} catch (error) {
  console.log('  ⚠ Could not create ZIP archive automatically');
  console.log('  You can manually ZIP the folder:', PACKAGE_DIR);
}

console.log('\n╔════════════════════════════════════════╗');
console.log('║  Package Created Successfully!         ║');
console.log('╠════════════════════════════════════════╣');
console.log(`║  Location: ${OUTPUT_DIR.padEnd(26)} ║`);
console.log(`║  Version:  ${VERSION.padEnd(26)} ║`);
console.log('╚════════════════════════════════════════╝\n');

console.log('Next steps:');
console.log('1. Test the package on a clean Windows machine');
console.log('2. Upload to https://tabeza.co.ke/downloads');
console.log('3. Update documentation with download link\n');
