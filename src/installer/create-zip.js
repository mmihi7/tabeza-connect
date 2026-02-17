#!/usr/bin/env node
/**
 * Create ZIP package using native PowerShell .NET method
 * Most reliable for large directories on Windows
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
const VERSION = packageJson.version;

const NODEJS_BUNDLE_DIR = path.join(__dirname, 'nodejs-bundle');
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'dist');
const ZIP_NAME = `TabezaConnect-Setup-v${VERSION}.zip`;
const ZIP_PATH = path.join(OUTPUT_DIR, ZIP_NAME);

console.log('Creating ZIP package...\n');
console.log(`Source: ${NODEJS_BUNDLE_DIR}`);
console.log(`Output: ${ZIP_PATH}\n`);

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Delete existing ZIP if present
if (fs.existsSync(ZIP_PATH)) {
  console.log('Removing existing ZIP file...');
  fs.unlinkSync(ZIP_PATH);
}

try {
  console.log('Compressing files (this may take 1-2 minutes)...\n');
  
  // Use PowerShell with .NET compression - most reliable for large directories
  const psScript = `
    Add-Type -Assembly System.IO.Compression.FileSystem
    $compressionLevel = [System.IO.Compression.CompressionLevel]::Optimal
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
      '${NODEJS_BUNDLE_DIR.replace(/\\/g, '\\\\')}',
      '${ZIP_PATH.replace(/\\/g, '\\\\')}',
      $compressionLevel,
      $false
    )
  `;
  
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, {
    stdio: 'inherit',
    maxBuffer: 50 * 1024 * 1024 // 50MB buffer
  });
  
  // Verify ZIP was created
  if (!fs.existsSync(ZIP_PATH)) {
    throw new Error('ZIP file was not created');
  }
  
  // Get file size
  const stats = fs.statSync(ZIP_PATH);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  
  console.log(`\n✅ ZIP package created successfully`);
  console.log(`   Size: ${sizeMB} MB`);
  console.log(`   Path: ${ZIP_PATH}\n`);
  
} catch (error) {
  console.error('\n❌ Failed to create ZIP package');
  console.error(error.message);
  console.error('\n⚠️  WORKAROUND: You can manually create the ZIP:');
  console.error('   1. Navigate to: ' + path.dirname(NODEJS_BUNDLE_DIR));
  console.error('   2. Right-click "nodejs-bundle" folder');
  console.error('   3. Select "Send to" > "Compressed (zipped) folder"');
  console.error('   4. Rename to: ' + ZIP_NAME);
  console.error('   5. Move to: ' + OUTPUT_DIR);
  console.error('\n   Or use 7-Zip if installed:');
  console.error('   "C:\\Program Files\\7-Zip\\7z.exe" a -tzip "' + ZIP_PATH + '" "' + NODEJS_BUNDLE_DIR + '\\*"');
  process.exit(1);
}
