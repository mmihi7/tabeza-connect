// Script to sync shared packages from source project (tabeza-staff)
// Usage: node dev-tools/scripts/sync-shared-packages.js <source-project-path>
//
// Note: tabeza-connect may not need all shared packages.
// This script is provided for consistency but may need customization.

const fs = require('fs');
const path = require('path');

// Helper function to recursively copy directory
function copyDirSync(src, dest) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  // Read source directory
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules directories
      if (entry.name === 'node_modules') {
        continue;
      }
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const sourceProject = process.argv[2];
if (!sourceProject) {
  console.error('Usage: node sync-shared-packages.js <source-project-path>');
  console.error('Example: node dev-tools/scripts/sync-shared-packages.js ../tabeza-staff');
  process.exit(1);
}

// Only sync packages that tabeza-connect actually uses
const packages = [
  'receipt-schema',
  'printer-service',
  // Add other packages as needed
];

// Source is always tabeza-staff with lib/packages/
const sourceBase = path.join(sourceProject, 'lib/packages');

// Target is tabeza-connect - adjust path as needed
const targetBase = path.join(__dirname, '../../lib');

console.log('Syncing shared packages from tabeza-staff...');
console.log(`Source: ${sourceBase}`);
console.log(`Target: ${targetBase}`);
console.log('');
console.log('Note: Only syncing packages used by tabeza-connect');
console.log('');

let syncedCount = 0;
let skippedCount = 0;

packages.forEach(pkg => {
  const source = path.join(sourceBase, pkg);
  const target = path.join(targetBase, pkg);
  
  if (fs.existsSync(source)) {
    console.log(`✓ Syncing ${pkg}...`);
    copyDirSync(source, target);
    syncedCount++;
  } else {
    console.warn(`⚠ Warning: ${pkg} not found in source`);
    skippedCount++;
  }
});

console.log('');
console.log(`Sync complete! ${syncedCount} packages synced, ${skippedCount} skipped.`);
console.log('');
console.log('Next steps:');
console.log('1. Run: pnpm install');
console.log('2. Test the application');
