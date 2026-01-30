/**
 * Windows Service Installer
 * Installs TABEZA Printer Agent as a Windows Service
 */

import * as Service from 'node-windows';

// Type declaration for node-windows
declare module 'node-windows' {
  export class Service {
    constructor(options: any);
    on(event: string, callback: (error?: any) => void): void;
    install(): void;
    uninstall(): void;
  }
}
import * as path from 'path';
import * as fs from 'fs';
import { ServiceConfig } from './config/service-config';

const config = ServiceConfig.load();

// Create a new service object
const svc = new Service.Service({
  name: config.serviceName,
  description: config.description,
  script: path.join(__dirname, 'service.js'),
  nodeOptions: [
    '--max_old_space_size=4096'
  ],
  //@ts-ignore
  workingDirectory: path.dirname(__dirname),
  allowServiceLogon: true
});

// Listen for the "install" event, which indicates the process is available as a service.
svc.on('install', () => {
  console.log('✅ TABEZA Printer Agent service installed successfully');
  console.log(`Service Name: ${config.serviceName}`);
  console.log(`Display Name: ${config.displayName}`);
  console.log('Starting service...');
  svc.start();
});

svc.on('start', () => {
  console.log('✅ TABEZA Printer Agent service started successfully');
  console.log('');
  console.log('Next steps:');
  console.log('1. Install the virtual printer by running: install-printer.ps1');
  console.log('2. Check service status in Windows Services (services.msc)');
  console.log('3. View logs in: ' + config.logDirectory);
  process.exit(0);
});

svc.on('alreadyinstalled', () => {
  console.log('⚠️  TABEZA Printer Agent service is already installed');
  console.log('To reinstall, first run: npm run uninstall-service');
  process.exit(1);
});

svc.on('error', (error: any) => {
  console.error('❌ Error installing service:', error);
  process.exit(1);
});

// Check if running as administrator
function isAdmin(): boolean {
  try {
    // Try to access a system directory that requires admin rights
    fs.accessSync('C:\\Windows\\System32\\drivers\\etc', fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

// Main installation process
async function installService(): Promise<void> {
  console.log('🚀 Installing TABEZA Printer Agent as Windows Service...');
  console.log('');

  // Check administrator privileges
  if (!isAdmin()) {
    console.error('❌ Administrator privileges required');
    console.error('Please run this command as Administrator');
    process.exit(1);
  }

  // Ensure directories exist
  config.ensureDirectories();
  console.log('✅ Created required directories');

  // Check if service script exists
  const serviceScript = path.join(__dirname, 'service.js');
  if (!fs.existsSync(serviceScript)) {
    console.error('❌ Service script not found:', serviceScript);
    console.error('Please run "npm run build" first');
    process.exit(1);
  }

  console.log('✅ Service script found');
  console.log('Installing service...');

  // Install the service
  svc.install();
}

// Run installation
installService().catch((error) => {
  console.error('❌ Installation failed:', error);
  process.exit(1);
});