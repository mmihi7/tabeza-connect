#!/usr/bin/env node
/**
 * Configure Printer Service for Production
 * 
 * This script updates the printer service configuration to point to production
 * Run this when you want the printer service to send heartbeats to production
 */

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');

// Read current config
let config = {};
if (fs.existsSync(configPath)) {
  const data = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(data);
}

// Update to production URL
config.apiUrl = 'https://staff.tabeza.co.ke';

// Save config
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log('✅ Printer service configured for production!');
console.log('');
console.log('Configuration:');
console.log(`  Bar ID: ${config.barId}`);
console.log(`  API URL: ${config.apiUrl}`);
console.log(`  Driver ID: ${config.driverId}`);
console.log('');
console.log('⚠️  IMPORTANT: Restart the printer service for changes to take effect!');
console.log('');
console.log('Next steps:');
console.log('1. Stop the printer service (Ctrl+C in the terminal)');
console.log('2. Start it again: node index.js');
console.log('3. Heartbeats will now be sent to production');
