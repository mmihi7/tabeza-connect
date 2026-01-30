/**
 * Windows Service Uninstaller
 * Removes TABEZA Printer Agent Windows Service
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
import { ServiceConfig } from './config/service-config';

const config = ServiceConfig.load();

// Create a new service object
const svc = new Service.Service({
  name: config.serviceName,
  script: require('path').join(__dirname, 'service.js')
});

// Listen for the "uninstall" event
svc.on('uninstall', () => {
  console.log('✅ TABEZA Printer Agent service uninstalled successfully');
  console.log('');
  console.log('Note: Virtual printer and data files are preserved');
  console.log('To remove virtual printer, run: uninstall-printer.ps1');
  console.log('To remove data files, manually delete: ' + config.dataDirectory);
  process.exit(0);
});

svc.on('error', (error: any) => {
  console.error('❌ Error uninstalling service:', error);
  process.exit(1);
});

svc.on('doesnotexist', () => {
  console.log('⚠️  TABEZA Printer Agent service is not installed');
  process.exit(0);
});

// Main uninstallation process
async function uninstallService(): Promise<void> {
  console.log('🗑️  Uninstalling TABEZA Printer Agent Windows Service...');
  console.log('');

  // Stop the service first if it's running
  try {
    console.log('Stopping service...');
    svc.stop();
    
    // Wait a moment for the service to stop
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    console.log('Service was not running or already stopped');
  }

  // Uninstall the service
  console.log('Uninstalling service...');
  svc.uninstall();
}

// Run uninstallation
uninstallService().catch((error) => {
  console.error('❌ Uninstallation failed:', error);
  process.exit(1);
});