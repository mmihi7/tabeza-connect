#!/usr/bin/env node
/**
 * Build Windows Installer for Tabeza Printer Service
 * Creates a standalone .exe that includes Node.js runtime
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('╔════════════════════════════════════════╗');
console.log('║  Building Tabeza Printer Service      ║');
console.log('║  Windows Installer                     ║');
console.log('╚════════════════════════════════════════╝\n');

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

console.log('Step 1: Installing dependencies...');
try {
  execSync('pnpm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed\n');
} catch (error) {
  console.error('❌ Failed to install dependencies');
  process.exit(1);
}

console.log('Step 2: Building executable with pkg...');
try {
  execSync('npm run build-exe', { stdio: 'inherit' });
  console.log('✅ Executable built\n');
} catch (error) {
  console.error('❌ Failed to build executable');
  process.exit(1);
}

console.log('Step 3: Creating installer package...');

// Copy additional files to dist
const filesToCopy = [
  'README.md',
  'install-service.js',
  'uninstall-service.js',
  'test-service.js',
];

filesToCopy.forEach(file => {
  const src = path.join(__dirname, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  ✓ Copied ${file}`);
  }
});

// Create installer batch file
const installerBatch = `@echo off
echo ========================================
echo Tabeza Printer Service Installer
echo ========================================
echo.

REM Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This installer must be run as Administrator
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo Starting Tabeza Printer Service...
echo.

REM Get Bar ID from user
set /p BAR_ID="Enter your Bar ID: "
set /p API_URL="Enter API URL (press Enter for default): "

if "%API_URL%"=="" set API_URL=https://your-app.vercel.app

echo.
echo Installing service with:
echo   Bar ID: %BAR_ID%
echo   API URL: %API_URL%
echo.

REM Start the service
start "" "%~dp0tabeza-printer-service.exe"

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Service is now running on:
echo   http://localhost:8765
echo.
echo Configure your POS to print to:
echo   http://localhost:8765/api/print-job
echo.
echo To stop the service, close the window or press Ctrl+C
echo.
pause
`;

fs.writeFileSync(path.join(distDir, 'install.bat'), installerBatch);
console.log('  ✓ Created install.bat');

// Create README for distribution
const distReadme = `# Tabeza Printer Service

## Quick Installation

1. **Run as Administrator**: Right-click \`install.bat\` and select "Run as administrator"
2. **Enter your Bar ID** when prompted
3. **Verify installation**: Visit http://localhost:8765/api/status

## Manual Installation

If you prefer to run the service manually:

1. Double-click \`tabeza-printer-service.exe\`
2. The service will start on port 8765
3. Configure your POS to send print jobs to: http://localhost:8765/api/print-job

## Configuration

After installation, you can configure the service by visiting:
http://localhost:8765/api/configure

Or edit the \`config.json\` file that will be created in the same directory.

## Testing

To test the service:
1. Visit http://localhost:8765/api/status in your browser
2. You should see service information

## Troubleshooting

### Service won't start
- Make sure port 8765 is not already in use
- Check Windows Firewall settings
- Run as Administrator

### Can't connect from POS
- Verify the service is running: http://localhost:8765/api/status
- Check firewall allows connections on port 8765
- Verify POS is configured with correct URL

## Support

Email: support@tabeza.co.ke
Website: https://tabeza.co.ke
`;

fs.writeFileSync(path.join(distDir, 'README.txt'), distReadme);
console.log('  ✓ Created README.txt');

console.log('\n╔════════════════════════════════════════╗');
console.log('║  Build Complete!                       ║');
console.log('╠════════════════════════════════════════╣');
console.log(`║  Output: ${distDir.padEnd(26)} ║`);
console.log('║                                        ║');
console.log('║  Files created:                        ║');
console.log('║  - tabeza-printer-service.exe          ║');
console.log('║  - install.bat                         ║');
console.log('║  - README.txt                          ║');
console.log('╚════════════════════════════════════════╝\n');

console.log('Next steps:');
console.log('1. Test the executable: cd dist && tabeza-printer-service.exe');
console.log('2. Upload to GitHub releases');
console.log('3. Update download link in the app\n');
