#!/usr/bin/env node
/**
 * Update Download URLs Script
 * 
 * This script updates the GitHub download URLs in your app after you've
 * created the GitHub repository and release.
 * 
 * Usage:
 *   node update-download-urls.js YOUR_GITHUB_USERNAME
 * 
 * Example:
 *   node update-download-urls.js mweneh
 */

const fs = require('fs');
const path = require('path');

// Get GitHub username from command line
const githubUsername = process.argv[2];

if (!githubUsername) {
  console.error('❌ Error: GitHub username is required');
  console.log('\nUsage:');
  console.log('  node update-download-urls.js YOUR_GITHUB_USERNAME');
  console.log('\nExample:');
  console.log('  node update-download-urls.js mweneh');
  process.exit(1);
}

console.log('╔════════════════════════════════════════╗');
console.log('║  Updating Download URLs                ║');
console.log('╚════════════════════════════════════════╝\n');

const newUrl = `https://github.com/${githubUsername}/tabeza-printer-service/releases/latest/download/tabeza-printer-service.exe`;

console.log(`New URL: ${newUrl}\n`);

// File 1: apps/staff/app/setup/printer/page.tsx
const file1Path = path.join(__dirname, '../../apps/staff/app/setup/printer/page.tsx');
console.log('Updating File 1: apps/staff/app/setup/printer/page.tsx');

try {
  let content1 = fs.readFileSync(file1Path, 'utf8');
  
  // Replace the old URL
  const oldPattern1 = /href="https:\/\/github\.com\/[^\/]+\/tabeza-printer-service\/releases\/latest\/download\/tabeza-printer-service\.exe"/;
  
  if (oldPattern1.test(content1)) {
    content1 = content1.replace(oldPattern1, `href="${newUrl}"`);
    fs.writeFileSync(file1Path, content1, 'utf8');
    console.log('  ✅ Updated successfully\n');
  } else {
    console.log('  ⚠️  Pattern not found - file may have been modified\n');
  }
} catch (error) {
  console.error(`  ❌ Error: ${error.message}\n`);
}

// File 2: packages/shared/lib/services/driver-detection-service.ts
const file2Path = path.join(__dirname, '../shared/lib/services/driver-detection-service.ts');
console.log('Updating File 2: packages/shared/lib/services/driver-detection-service.ts');

try {
  let content2 = fs.readFileSync(file2Path, 'utf8');
  
  // Replace the base URL
  const oldPattern2 = /const baseUrl = 'https:\/\/github\.com\/[^\/]+\/tabeza-printer-service\/releases\/latest\/download'/;
  const newBaseUrl = `https://github.com/${githubUsername}/tabeza-printer-service/releases/latest/download`;
  
  if (oldPattern2.test(content2)) {
    content2 = content2.replace(oldPattern2, `const baseUrl = '${newBaseUrl}'`);
    fs.writeFileSync(file2Path, content2, 'utf8');
    console.log('  ✅ Updated successfully\n');
  } else {
    console.log('  ⚠️  Pattern not found - file may have been modified\n');
  }
} catch (error) {
  console.error(`  ❌ Error: ${error.message}\n`);
}

console.log('╔════════════════════════════════════════╗');
console.log('║  Update Complete!                      ║');
console.log('╚════════════════════════════════════════╝\n');

console.log('Next steps:');
console.log('1. Verify the changes in both files');
console.log('2. Test the download link in your app');
console.log('3. Commit the changes to git\n');
