#!/usr/bin/env node
/**
 * Uninstall Tabeza Connect Windows Service
 * Run as Administrator: node uninstall-service.js
 */

const Service = require('node-windows').Service;

const svc = new Service({
  name:   'TabezaConnect',
  script: 'C:\\Projects\\tabeza-connect\\src\\service\\index.js'
});

svc.on('uninstall', function () {
  console.log('✅ TabezaConnect service uninstalled successfully.');
  process.exit(0);
});

svc.on('error', function (err) {
  console.error('❌ Uninstall error:', err);
  process.exit(1);
});

if (process.platform !== 'win32') {
  console.error('❌ Windows only.');
  process.exit(1);
}

console.log('Uninstalling TabezaConnect service...');
svc.uninstall();
