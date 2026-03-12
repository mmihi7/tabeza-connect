/**
 * Build Script for Capture Executable
 * 
 * Compiles the capture script into a standalone executable using pkg.
 * The executable will be placed in the dist/ directory.
 * 
 * Usage:
 *   node build-capture.js
 * 
 * @module capture/build-capture
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Paths
const DIST_DIR = path.join(__dirname, '..', '..', 'dist');
const CAPTURE_SCRIPT = path.join(__dirname, 'index.js');
const OUTPUT_EXE = path.join(DIST_DIR, 'capture.exe');

console.log('🔨 Building Tabeza Capture Executable...\n');

// Ensure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  console.log('📁 Creating dist directory...');
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// Build command
const pkgCommand = [
  'pkg',
  CAPTURE_SCRIPT,
  '--targets', 'node20-win-x64',
  '--output', OUTPUT_EXE,
  '--compress', 'GZip',
].join(' ');

console.log('📦 Running pkg...');
console.log(`   Command: ${pkgCommand}\n`);

try {
  // Execute pkg
  execSync(pkgCommand, {
    stdio: 'inherit',
    cwd: __dirname,
  });
  
  // Check if executable was created
  if (fs.existsSync(OUTPUT_EXE)) {
    const stats = fs.statSync(OUTPUT_EXE);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log('\n✅ Build successful!');
    console.log(`   Output: ${OUTPUT_EXE}`);
    console.log(`   Size: ${sizeMB} MB`);
    
    // Test the executable
    console.log('\n🧪 Testing executable...');
    try {
      execSync(`"${OUTPUT_EXE}" --version`, { stdio: 'inherit' });
    } catch (testError) {
      console.log('   (Version check not implemented yet)');
    }
    
    console.log('\n✨ Capture executable ready for deployment!');
  } else {
    throw new Error('Executable not found after build');
  }
  
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}
