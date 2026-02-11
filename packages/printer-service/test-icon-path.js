// test-icon-path.js
const path = require('path');
const fs = require('fs');

console.log('Testing icon path resolution...\n');

console.log('Current directory:', process.cwd());
console.log('__dirname:', __dirname);

const iconPath = path.join(__dirname, 'assets', 'icon.ico');
console.log('\nIcon path:', iconPath);
console.log('Icon exists:', fs.existsSync(iconPath));

if (fs.existsSync(iconPath)) {
  const stats = fs.statSync(iconPath);
  console.log('Icon size:', stats.size, 'bytes');
} else {
  console.log('\n❌ Icon file not found!');
  console.log('Expected location:', iconPath);
  
  // Try to find it
  const altPath = path.join(process.cwd(), 'packages', 'printer-service', 'assets', 'icon.ico');
  console.log('\nTrying alternate path:', altPath);
  console.log('Exists:', fs.existsSync(altPath));
}
