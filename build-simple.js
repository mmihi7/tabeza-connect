const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building TabezaConnect v1.1.0...');
console.log('========================================');

try {
  // Build with Inno Setup - use full path
  console.log('Step 1: Building professional installer...');
  
  // Try to find iscc in common locations
  const possiblePaths = [
    'C:\\Program Files (x86)\\Inno Setup 6\\iscc.exe',
    'C:\\Program Files\\Inno Setup 6\\iscc.exe',
    'C:\\Program Files (x86)\\Inno Setup 6\\iscc.exe'
  ];
  
  let isccPath = null;
  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      isccPath = path;
      break;
    }
  }
  
  if (!isccPath) {
    throw new Error('Inno Setup compiler (iscc.exe) not found. Please install Inno Setup 6 from https://jrsoftware.org/isdl.php');
  }
  
  console.log(`Using Inno Setup at: ${isccPath}`);
  
  execSync(`"${isccPath}" installer.iss`, {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  console.log('✅ Build Complete!');
  console.log('========================================');
  
  // Check for installer
  const installerPath = path.join(__dirname, 'Output', 'TabezaConnect-Setup.exe');
  
  if (fs.existsSync(installerPath)) {
    const stats = fs.statSync(installerPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log('🎉 Professional installer created successfully!');
    console.log(`File: ${installerPath}`);
    console.log(`Size: ${sizeMB} MB`);
    console.log('========================================');
    console.log('Ready for distribution!');
    console.log('🚀 Features:');
    console.log('  ✅ Professional Windows installer');
    console.log('  ✅ Spooler monitoring support');
    console.log('  ✅ Bar ID configuration wizard');
    console.log('  ✅ Windows service integration');
    console.log('  ✅ Desktop shortcuts');
    console.log('========================================');
    console.log(`Build complete! Installer ready at: ${installerPath}`);
  } else {
    console.log('❌ Installer not found!');
    console.log('Check the build output above for errors.');
  }
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
