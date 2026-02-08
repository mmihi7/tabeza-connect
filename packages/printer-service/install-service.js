#!/usr/bin/env node
/**
 * Install Tabeza Printer Service as Windows Service
 * Uses node-windows to create a system service
 */

const Service = require('node-windows').Service;
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function install() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Tabeza Printer Service Installer     ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Get configuration
  const barId = await question('Enter your Bar ID: ');
  const apiUrl = await question('Enter API URL (press Enter for default): ') || 'https://your-app.vercel.app';

  console.log('\nInstalling service...\n');

  // Create a new service object
  const svc = new Service({
    name: 'Tabeza Printer Service',
    description: 'Captures POS print jobs and sends to Tabeza cloud',
    script: path.join(__dirname, 'index.js'),
    env: [
      {
        name: 'TABEZA_BAR_ID',
        value: barId
      },
      {
        name: 'TABEZA_API_URL',
        value: apiUrl
      }
    ]
  });

  // Listen for the "install" event
  svc.on('install', function() {
    console.log('✅ Service installed successfully!');
    console.log('\nStarting service...');
    svc.start();
  });

  // Listen for the "start" event
  svc.on('start', function() {
    console.log('✅ Service started successfully!');
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  Installation Complete!                ║');
    console.log('╠════════════════════════════════════════╣');
    console.log('║  Service is now running on:            ║');
    console.log('║  http://localhost:8765                 ║');
    console.log('║                                        ║');
    console.log('║  Configure your POS to print to:       ║');
    console.log('║  http://localhost:8765/api/print-job   ║');
    console.log('╚════════════════════════════════════════╝\n');
    rl.close();
    process.exit(0);
  });

  // Listen for errors
  svc.on('error', function(err) {
    console.error('❌ Installation error:', err);
    rl.close();
    process.exit(1);
  });

  // Install the service
  svc.install();
}

// Check if running on Windows
if (process.platform !== 'win32') {
  console.log('❌ This installer is for Windows only.');
  console.log('For macOS/Linux, see README.md for systemd instructions.');
  process.exit(1);
}

// Run installation
install().catch(err => {
  console.error('Installation failed:', err);
  process.exit(1);
});
