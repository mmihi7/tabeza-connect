#!/usr/bin/env node
/**
 * Install Tabeza Connect as a Windows Service
 * Uses node-windows to create a native system service
 * Run this script as Administrator: node install-service.js
 */

const Service = require('node-windows').Service;
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query, defaultValue) {
  return new Promise(resolve => {
    const prompt = defaultValue ? `${query} [${defaultValue}]: ` : `${query}: `;
    rl.question(prompt, answer => resolve(answer.trim() || defaultValue || ''));
  });
}

async function install() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║    Tabeza Connect Service Installer    ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Load defaults from config.json
  let config = {};
  try {
    config = require('./config.json');
  } catch (e) {
    console.log('⚠️  config.json not found, using defaults.\n');
  }

  const barId    = await question('Enter your Bar ID',    config.barId    || '');
  const apiUrl   = await question('Enter API URL',        config.apiUrl   || 'https://tabeza.co.ke');
  const driverId = await question('Enter Driver ID',      config.driverId || `driver-${require('os').hostname()}`);
  const watchFolder = await question('Watch folder',      config.watchFolder || 'C:\\TabezaPrints');

  console.log('\nInstalling service...\n');

  const svc = new Service({
    name:        config.service?.name        || 'TabezaConnect',
    description: config.service?.description || 'Captures receipt data from POS and syncs with Tabeza staff app',
    script:      'C:\\Projects\\tabeza-connect\\src\\service\\index.js',
    env: [
      { name: 'TABEZA_BAR_ID',      value: barId },
      { name: 'TABEZA_API_URL',     value: apiUrl },
      { name: 'TABEZA_DRIVER_ID',   value: driverId },
      { name: 'TABEZA_WATCH_FOLDER',value: watchFolder },
      { name: 'TABEZA_HTTP_PORT',   value: String(config.httpPort || 8765) },
      { name: 'NODE_ENV',           value: 'production' }
    ]
  });

  svc.on('install', function () {
    console.log('✅ Service installed successfully!');
    console.log('Starting service...');
    svc.start();
  });

  svc.on('start', function () {
    console.log('✅ Service started!\n');
    console.log('╔════════════════════════════════════════╗');
    console.log('║         Installation Complete!         ║');
    console.log('╠════════════════════════════════════════╣');
    console.log('║  Dashboard: http://localhost:8765      ║');
    console.log('║  Verify in: services.msc               ║');
    console.log('║  Service:   TabezaConnect              ║');
    console.log('╚════════════════════════════════════════╝\n');
    rl.close();
    process.exit(0);
  });

  svc.on('error', function (err) {
    console.error('❌ Installation error:', err);
    rl.close();
    process.exit(1);
  });

  svc.install();
}

if (process.platform !== 'win32') {
  console.error('❌ This installer is for Windows only.');
  process.exit(1);
}

install().catch(err => {
  console.error('Installation failed:', err);
  process.exit(1);
});
