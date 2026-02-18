#!/usr/bin/env node
/**
 * Tabeza Connect Installer Builder
 * Creates a complete Windows installer with bundled Node.js runtime
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
const VERSION = packageJson.version;

console.log('╔════════════════════════════════════════╗');
console.log('║  Tabeza Connect Installer Builder     ║');
console.log(`║  Version: ${VERSION.padEnd(28)} ║`);
console.log('╚════════════════════════════════════════╝\n');

const ROOT_DIR = path.join(__dirname, '..', '..');  // Go up to repository root
const INSTALLER_DIR = __dirname;
const SERVICE_SRC_DIR = path.join(ROOT_DIR, 'src', 'service');
const PUBLIC_SRC_DIR = path.join(ROOT_DIR, 'src', 'public');
const NODEJS_BUNDLE_DIR = path.join(INSTALLER_DIR, 'nodejs-bundle');
const OUTPUT_DIR = path.join(ROOT_DIR, 'dist');

// Step 1: Download Node.js runtime
console.log('Step 1: Downloading Node.js runtime...\n');
try {
  execSync('node download-nodejs.js', {
    cwd: INSTALLER_DIR,
    stdio: 'inherit'
  });
  console.log('');
} catch (error) {
  console.error('❌ Failed to download Node.js');
  process.exit(1);
}

// Step 2: Prepare service files
console.log('Step 2: Preparing service files...\n');

const SERVICE_DIR = path.join(NODEJS_BUNDLE_DIR, 'service');
if (!fs.existsSync(SERVICE_DIR)) {
  fs.mkdirSync(SERVICE_DIR, { recursive: true });
}

// Copy service files
const filesToCopy = [
  'index.js',
  'package.json',
  'config.example.json'
];

console.log('Copying service files:');
for (const file of filesToCopy) {
  const src = path.join(SERVICE_SRC_DIR, file);
  const dest = path.join(SERVICE_DIR, file);
  
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  ✅ ${file}`);
  } else {
    console.warn(`  ⚠️  ${file} not found at ${src}`);
  }
}

// Copy public folder
const publicSrc = PUBLIC_SRC_DIR;
const publicDest = path.join(SERVICE_DIR, 'public');

if (fs.existsSync(publicSrc)) {
  copyDirectory(publicSrc, publicDest);
  console.log('  ✅ public/');
}

console.log('');

// Step 3: Install service dependencies
console.log('Step 3: Installing service dependencies...\n');

try {
  // Create minimal package.json for production dependencies only
  const packageJson = JSON.parse(fs.readFileSync(path.join(SERVICE_SRC_DIR, 'package.json'), 'utf8'));
  const productionPackage = {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    main: packageJson.main,
    dependencies: packageJson.dependencies
  };
  
  fs.writeFileSync(
    path.join(SERVICE_DIR, 'package.json'),
    JSON.stringify(productionPackage, null, 2)
  );
  
  // Install dependencies using bundled npm
  const npmPath = path.join(NODEJS_BUNDLE_DIR, 'nodejs', 'npm.cmd');
  execSync(`"${npmPath}" install --production --no-optional`, {
    cwd: SERVICE_DIR,
    stdio: 'inherit'
  });
  
  console.log('\n✅ Dependencies installed\n');
} catch (error) {
  console.error('❌ Failed to install dependencies');
  console.error(error.message);
  process.exit(1);
}

// Step 4: Copy installer scripts
console.log('Step 4: Copying installer scripts...\n');

const SCRIPTS_SRC = path.join(INSTALLER_DIR, 'scripts');
const SCRIPTS_DEST = path.join(NODEJS_BUNDLE_DIR, 'scripts');

if (fs.existsSync(SCRIPTS_SRC)) {
  copyDirectory(SCRIPTS_SRC, SCRIPTS_DEST);
  console.log('✅ Installer scripts copied\n');
}

// Step 5: Create installer package
console.log('Step 5: Creating installer package...\n');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Create installer batch file with dynamic version
const installerBatch = `@echo off
REM Tabeza Connect Installer
REM Version ${VERSION}

echo ========================================
echo Tabeza Connect Installer
echo ========================================
echo.

REM Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This installer must be run as Administrator
    echo.
    echo Right-click this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo This installer will:
echo   1. Install Tabeza Connect to C:\\Program Files\\Tabeza
echo   2. Create watch folder at C:\\TabezaPrints
echo   3. Configure virtual printer
echo   4. Register Windows service
echo.

set /p CONTINUE="Continue with installation? (Y/N): "
if /i not "%CONTINUE%"=="Y" (
    echo Installation cancelled.
    pause
    exit /b 0
)

echo.
echo ========================================
echo Step 1: Collecting Configuration
echo ========================================
echo.

set /p BAR_ID="Enter your Bar ID: "
if "%BAR_ID%"=="" (
    echo ERROR: Bar ID is required
    pause
    exit /b 1
)

set API_URL=https://tabeza.co.ke
echo Using API URL: %API_URL%
echo.

echo ========================================
echo Step 2: Installing Files
echo ========================================
echo.

set INSTALL_DIR=C:\\Program Files\\Tabeza

REM Create installation directory
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

REM Copy Node.js runtime
echo Copying Node.js runtime...
xcopy /E /I /Y "%~dp0nodejs" "%INSTALL_DIR%\\nodejs" >nul
if %errorLevel% neq 0 (
    echo ERROR: Failed to copy Node.js runtime
    pause
    exit /b 1
)
echo   Done

REM Copy service files
echo Copying service files...
xcopy /E /I /Y "%~dp0service" "%INSTALL_DIR%\\nodejs\\service" >nul
if %errorLevel% neq 0 (
    echo ERROR: Failed to copy service files
    pause
    exit /b 1
)
echo   Done

REM Copy scripts
echo Copying installer scripts...
xcopy /E /I /Y "%~dp0scripts" "%INSTALL_DIR%\\scripts" >nul
echo   Done

echo.
echo ========================================
echo Step 3: Creating Watch Folder
echo ========================================
echo.

powershell -ExecutionPolicy Bypass -File "%INSTALL_DIR%\\scripts\\create-folders.ps1"
if %errorLevel% neq 0 (
    echo WARNING: Watch folder creation had issues
    echo You may need to create C:\\TabezaPrints manually
)

echo.
echo ========================================
echo Step 4: Configuring Printer
echo ========================================
echo.

powershell -ExecutionPolicy Bypass -File "%INSTALL_DIR%\\scripts\\configure-printer.ps1"
if %errorLevel% neq 0 (
    echo WARNING: Printer configuration had issues
    echo You may need to configure the printer manually
)

echo.
echo ========================================
echo Step 5: Registering Service
echo ========================================
echo.

powershell -ExecutionPolicy Bypass -File "%INSTALL_DIR%\\scripts\\register-service.ps1" -InstallPath "%INSTALL_DIR%" -BarId "%BAR_ID%" -ApiUrl "%API_URL%"
if %errorLevel% neq 0 (
    echo ERROR: Service registration failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Tabeza Connect has been installed successfully.
echo.
echo Service Status: http://localhost:8765/api/status
echo Configuration: http://localhost:8765/configure.html
echo.
echo Next Steps:
echo   1. Configure your POS to print to "Tabeza Receipt Printer"
echo   2. Test by printing a receipt from your POS
echo   3. Check the service status in your browser
echo.
echo The service will start automatically on system boot.
echo.
pause
`;

fs.writeFileSync(
  path.join(NODEJS_BUNDLE_DIR, 'install.bat'),
  installerBatch
);

console.log('✅ Installer batch file created');

// Create README
const readme = `# Tabeza Connect Installer

## Installation Instructions

1. **Extract this ZIP file** to a temporary location
2. **Right-click install.bat** and select "Run as administrator"
3. **Follow the prompts** to complete installation

## What Gets Installed

- Node.js runtime (private installation)
- Tabeza Connect service
- Virtual printer configuration
- Watch folder structure
- Windows service registration

## System Requirements

- Windows 10 or later
- Administrator privileges
- 100 MB free disk space

## After Installation

The service will be available at:
- Status: http://localhost:8765/api/status
- Configuration: http://localhost:8765/configure.html

## Support

Email: support@tabeza.co.ke
Website: https://tabeza.co.ke
`;

fs.writeFileSync(
  path.join(NODEJS_BUNDLE_DIR, 'README.txt'),
  readme
);

console.log('✅ README created\n');

// Step 6: Create ZIP package
console.log('Step 6: Creating ZIP package...\n');

const zipName = `TabezaConnect-Setup-v${VERSION}.zip`;
const zipPath = path.join(OUTPUT_DIR, zipName);

let zipCreated = false;

try {
  // Use PowerShell .NET method for large directories
  execSync('node create-zip.js', {
    cwd: INSTALLER_DIR,
    stdio: 'inherit'
  });
  
  zipCreated = fs.existsSync(zipPath);
  console.log('');
} catch (error) {
  console.error('\n⚠️  ZIP creation failed (this is common with large directories)\n');
  zipCreated = false;
}

// Final summary
console.log('╔════════════════════════════════════════╗');
if (zipCreated) {
  console.log('║  Build Complete!                       ║');
} else {
  console.log('║  Build Partially Complete              ║');
}
console.log('╚════════════════════════════════════════╝\n');

if (zipCreated) {
  const stats = fs.statSync(zipPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

  console.log('Output:');
  console.log(`  File: ${zipName}`);
  console.log(`  Size: ${sizeMB} MB`);
  console.log(`  Path: ${zipPath}\n`);

  console.log('Next Steps:');
  console.log('  1. Test the installer on a clean Windows VM');
  console.log('  2. Upload to GitHub releases or download server');
  console.log('  3. Update download link in staff app\n');
} else {
  console.log('✅ Installer files ready at:');
  console.log(`   ${NODEJS_BUNDLE_DIR}\n`);
  
  console.log('⚠️  Manual ZIP creation required:\n');
  console.log('Option 1 - Windows Explorer (Easiest):');
  console.log(`  1. Navigate to: ${path.dirname(NODEJS_BUNDLE_DIR)}`);
  console.log('  2. Right-click "nodejs-bundle" folder');
  console.log('  3. Select "Send to" > "Compressed (zipped) folder"');
  console.log(`  4. Rename to: ${zipName}`);
  console.log(`  5. Move to: ${OUTPUT_DIR}\n`);
  
  console.log('Option 2 - 7-Zip (If installed):');
  console.log(`  "C:\\Program Files\\7-Zip\\7z.exe" a -tzip "${zipPath}" "${NODEJS_BUNDLE_DIR}\\*"\n`);
  
  console.log('Option 3 - Distribute without ZIP:');
  console.log('  Copy the entire nodejs-bundle folder to your distribution location\n');
  
  console.log('Option 4 - Use GitHub Actions:');
  console.log('  Push to GitHub and create a release - GitHub will handle ZIP creation\n');
}

// Helper function to copy directory recursively
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
