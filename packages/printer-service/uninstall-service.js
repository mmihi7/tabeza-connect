#!/usr/bin/env node
/**
 * Uninstall Tabeza Printer Service from Windows
 */

const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object
const svc = new Service({
  name: 'Tabeza Printer Service',
  script: path.join(__dirname, 'index.js')
});

// Listen for the "uninstall" event
svc.on('uninstall', function() {
  console.log('✅ Service uninstalled successfully!');
  console.log('The Tabeza Printer Service has been removed from your system.');
  process.exit(0);
});

// Listen for errors
svc.on('error', function(err) {
  console.error('❌ Uninstallation error:', err);
  process.exit(1);
});

console.log('Uninstalling Tabeza Printer Service...\n');

// Uninstall the service
svc.uninstall();
