#!/usr/bin/env node
/**
 * Tabeza Connect - Electron Main Process
 * 
 * Handles first-run setup, system tray, and auto-start configuration
 */

const { app, BrowserWindow, ipcMain, Tray, Menu, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Paths
const CONFIG_DIR = path.join(app.getPath('appData'), 'Tabeza');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

let setupWindow = null;
let tray = null;
let printerService = null;

// Ensure config directory exists
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// Load configuration
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return null;
  }
  
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load config:', error);
    return null;
  }
}

// Save configuration
function saveConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// Create startup shortcut
function createStartupShortcut() {
  const startupFolder = path.join(
    process.env.APPDATA,
    'Microsoft\\Windows\\Start Menu\\Programs\\Startup'
  );
  
  const exePath = app.getPath('exe');
  const shortcutPath = path.join(startupFolder, 'Tabeza Connect.lnk');
  
  // Create VBS script to create shortcut
  const vbsScript = `
Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = "${shortcutPath.replace(/\\/g, '\\\\')}"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "${exePath.replace(/\\/g, '\\\\')}"
oLink.WorkingDirectory = "${path.dirname(exePath).replace(/\\/g, '\\\\')}"
oLink.Description = "Tabeza Connect - POS Bridge Service"
oLink.Save
  `.trim();
  
  const vbsPath = path.join(process.env.TEMP, 'create-tabeza-shortcut.vbs');
  fs.writeFileSync(vbsPath, vbsScript);
  
  exec(`cscript //nologo "${vbsPath}"`, (error) => {
    try {
      fs.unlinkSync(vbsPath);
    } catch (e) {
      // Ignore cleanup errors
    }
    
    if (error) {
      console.error('Failed to create startup shortcut:', error);
    } else {
      console.log('✅ Startup shortcut created');
    }
  });
}

// Create setup window
function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 550,
    height: 500,
    resizable: false,
    center: true,
    title: 'Tabeza Connect Setup',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  setupWindow.loadFile(path.join(__dirname, 'setup.html'));
  
  setupWindow.on('closed', () => {
    setupWindow = null;
  });
}

// Start printer service
function startPrinterService(config) {
  // Get the correct path to index.js
  const servicePath = path.join(__dirname, 'index.js');
  
  // Log the path we're trying to run
  console.log(`🔍 Attempting to start service from: ${servicePath}`);
  console.log(`📁 Service exists: ${fs.existsSync(servicePath)}`);
  console.log(`📂 Working directory: ${__dirname}`);
  
  // Set environment variables for the service
  const env = {
    ...process.env,
    TABEZA_BAR_ID: config.barId,
    TABEZA_API_URL: config.apiUrl || 'https://staff.tabeza.co.ke',
  };
  
  // Start the service as a child process
  const { spawn } = require('child_process');
  
  // Check if we're in development (running from source) or packaged
  const isDev = !app.isPackaged;
  let command;
  let args;
  
  if (isDev) {
    // In development: run node directly
    command = process.execPath; // Use the Electron/node executable
    args = [servicePath];
    console.log(`🛠️  Development mode: Using ${command} ${args.join(' ')}`);
  } else {
    // In production: run the standalone executable if it exists
    const exePath = path.join(path.dirname(process.execPath), 'tabeza-printer-service.exe');
    if (fs.existsSync(exePath)) {
      command = exePath;
      args = [];
      console.log(`📦 Production mode: Using ${command}`);
    } else {
      // Fallback to node
      command = 'node';
      args = [servicePath];
      console.log(`⚠️  Service exe not found, falling back to: ${command} ${args.join(' ')}`);
    }
  }
  
  // Capture output separately to see errors
  printerService = spawn(command, args, {
    env,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe', 'pipe'], // Capture all output
    cwd: __dirname // Set working directory to app directory
  });
  
  // Log service output immediately
  printerService.stdout.on('data', (data) => {
    const output = data.toString().trim();
    console.log(`[Service] ${output}`);
  });
  
  printerService.stderr.on('data', (data) => {
    const error = data.toString().trim();
    console.error(`[Service Error] ${error}`);
    
    // Show error dialog for critical errors
    if (error.includes('port') || error.includes('EADDRINUSE')) {
      const { dialog } = require('electron');
      dialog.showErrorBox(
        'Port Conflict',
        `Port 8765 is already in use.\n\nRun kill-port-8765.bat to free the port.`
      );
    }
  });
  
  printerService.on('error', (error) => {
    console.error('❌ Printer service spawn error:', error);
    
    // Show error dialog
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Service Start Failed',
      `Failed to start printer service:\n\n${error.message}\n\nPath: ${command}\n\nPlease check if Node.js is installed.`
    );
  });
  
  printerService.on('exit', (code, signal) => {
    console.log(`⚠️ Printer service exited with code ${code}, signal ${signal}`);
    
    if (code !== 0 && code !== null) {
      // Service crashed
      const { dialog } = require('electron');
      dialog.showErrorBox(
        'Service Crashed',
        `Printer service stopped unexpectedly (exit code: ${code}).\n\nCheck the console output for details.`
      );
    }
  });
  
  console.log('✅ Printer service process spawned');
}

// Create system tray icon
function createTrayIcon(config) {
  try {
    console.log('Creating tray icon...');
    
    // Use icon.ico for tray icon (Windows requires ICO format)
    const iconPath = path.join(__dirname, 'assets', 'icon.ico');
    console.log('Icon path:', iconPath);
    console.log('Icon exists:', fs.existsSync(iconPath));
    
    if (!fs.existsSync(iconPath)) {
      throw new Error(`Icon file not found at: ${iconPath}`);
    }
    
    tray = new Tray(iconPath);
    console.log('Tray object created');
    
    const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Tabeza Connect',
      enabled: false
    },
    { type: 'separator' },
    {
      label: `Bar: ${config.barId}`,
      enabled: false
    },
    {
      label: '● Connected',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Open Configuration',
      click: () => {
        shell.openExternal('http://localhost:8765/configure.html');
      }
    },
    {
      label: 'Open Staff Dashboard',
      click: () => {
        shell.openExternal(config.apiUrl || 'https://staff.tabeza.co.ke');
      }
    },
    { type: 'separator' },
    {
      label: 'Restart Service',
      click: () => {
        if (printerService) {
          printerService.kill();
        }
        startPrinterService(config);
      }
    },
    {
      label: 'View Logs',
      click: () => {
        const logsFolder = path.join(CONFIG_DIR, 'logs');
        if (!fs.existsSync(logsFolder)) {
          fs.mkdirSync(logsFolder, { recursive: true });
        }
        shell.openPath(logsFolder);
      }
    },
    { type: 'separator' },
    {
      label: 'About Tabeza Connect',
      click: () => {
        const aboutWindow = new BrowserWindow({
          width: 400,
          height: 300,
          resizable: false,
          title: 'About Tabeza Connect'
        });
        aboutWindow.loadURL(`data:text/html;charset=utf-8,
          <html>
            <head>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  padding: 40px;
                  text-align: center;
                  background: #f5f5f5;
                }
                h1 { color: #4CAF50; margin-bottom: 10px; }
                p { color: #666; line-height: 1.6; }
              </style>
            </head>
            <body>
              <h1>Tabeza Connect</h1>
              <p>Version 1.0.0</p>
              <p>Bridges your POS system with Tabeza cloud for digital receipts and customer engagement.</p>
              <p style="margin-top: 30px; font-size: 12px;">© 2026 Tabeza. All rights reserved.</p>
            </body>
          </html>
        `);
      }
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Tabeza Connect - POS Bridge Service');
  tray.setContextMenu(contextMenu);
  
  console.log('Tray menu set');
  
  // Show balloon notification on first run
  if (!config.notificationShown) {
    tray.displayBalloon({
      title: 'Tabeza Connect',
      content: 'Service is running. Right-click the tray icon for options.',
      icon: iconPath
    });
    
    config.notificationShown = true;
    saveConfig(config);
  }
  
  console.log('Tray icon setup complete');
  return tray;
  
  } catch (error) {
    console.error('Failed to create tray icon:', error);
    
    // Show error dialog
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Tray Icon Failed',
      `Failed to create system tray icon:\n\n${error.message}\n\nThe service is running but you won't see the tray icon.`
    );
    
    return null;
  }
}

// Handle config save from setup window
ipcMain.on('save-config', (event, barId) => {
  try {
    // Validate Bar ID
    if (!barId || barId.trim().length < 5) {
      event.reply('config-error', 'Please enter a valid Bar ID (at least 5 characters)');
      return;
    }
    
    const config = {
      barId: barId.trim(),
      apiUrl: 'https://staff.tabeza.co.ke',
      driverId: `driver-${require('os').hostname()}-${Date.now()}`,
      watchFolder: path.join(process.env.USERPROFILE || process.env.HOME, 'TabezaPrints'),
      installedAt: new Date().toISOString(),
      autoStart: true,
      notificationShown: false
    };
    
    // Save configuration
    saveConfig(config);
    
    // Create startup shortcut
    createStartupShortcut();
    
    // Close setup window
    if (setupWindow) {
      setupWindow.close();
    }
    
    // Start printer service
    startPrinterService(config);
    
    // Create tray icon
    tray = createTrayIcon(config);
    
    console.log('✅ Configuration complete');
    
  } catch (error) {
    console.error('Configuration error:', error);
    event.reply('config-error', 'Failed to save configuration: ' + error.message);
  }
});

// App ready
app.whenReady().then(() => {
  console.log('Electron app ready');
  const config = loadConfig();
  console.log('Config loaded:', config ? 'Found' : 'Not found');
  
  if (!config || !config.barId) {
    // First run - show setup window
    console.log('First run detected - showing setup window');
    createSetupWindow();
  } else {
    // Config exists - start service
    console.log('Configuration found - starting service');
    console.log('Bar ID:', config.barId);
    
    try {
      startPrinterService(config);
      console.log('Service started, creating tray icon...');
      tray = createTrayIcon(config);
      console.log('Tray icon created successfully');
    } catch (error) {
      console.error('Error during startup:', error);
    }
  }
});

// Prevent app from quitting when all windows are closed
app.on('window-all-closed', () => {
  // Keep running in tray
});

// Handle app quit
app.on('before-quit', () => {
  if (printerService) {
    printerService.kill();
  }
});

// Handle second instance (prevent multiple instances)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window if it exists
    if (setupWindow) {
      if (setupWindow.isMinimized()) setupWindow.restore();
      setupWindow.focus();
    }
  });
}
