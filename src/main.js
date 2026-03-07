#!/usr/bin/env node
/**
 * Tabeza Connect - Electron Main Process
 * 
 * Electron entry point that:
 * - Creates system tray icon
 * - Starts the capture service
 * - Manages app lifecycle
 * - Handles first-run setup
 */

const { app, BrowserWindow, Tray, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Global references
let tray = null;
let mainWindow = null;
let service = null;

// Paths
const isDev = !app.isPackaged;
const SRC_DIR = isDev ? __dirname : path.join(process.resourcesPath, 'app', 'src');
const ASSETS_DIR = isDev ? path.join(__dirname, 'assets') : path.join(process.resourcesPath, 'assets');
const CONFIG_DIR = path.join(app.getPath('userData'), 'Tabeza');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const TEMPLATES_DIR = path.join(CONFIG_DIR, 'templates');

// Ensure directories exist
function ensureDirectories() {
  [CONFIG_DIR, TEMPLATES_DIR, path.join(CONFIG_DIR, 'logs'), path.join(CONFIG_DIR, 'queue')].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Load configuration
function loadConfig() {
  ensureDirectories();
  if (!fs.existsSync(CONFIG_PATH)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    console.error('Failed to load config:', e);
    return null;
  }
}

// Save configuration
function saveConfig(config) {
  ensureDirectories();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// Create main window (for setup first-run)
function createSetupWindow() {
  mainWindow = new BrowserWindow({
    width: 550,
    height: 500,
    resizable: false,
    center: true,
    title: 'Tabeza Connect Setup',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load setup HTML
  const setupPath = path.join(SRC_DIR, 'public', 'setup.html');
  if (fs.existsSync(setupPath)) {
    mainWindow.loadFile(setupPath);
  } else {
    // Fallback: create minimal setup UI
    mainWindow.loadURL(`data:text/html,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial; padding: 40px; text-align: center; }
          input { padding: 10px; width: 80%; margin: 10px 0; }
          button { padding: 10px 30px; background: #4CAF50; color: white; border: none; cursor: pointer; }
        </style>
      </head>
      <body>
        <h1>Tabeza Connect Setup</h1>
        <p>Enter your Bar ID from Tabeza dashboard</p>
        <input type="text" id="barId" placeholder="Bar ID (e.g., bar-123)">
        <br>
        <button onclick="save()">Connect</button>
        <p id="status"></p>
        <script>
          function save() {
            const barId = document.getElementById('barId').value.trim();
            if (!barId) {
              document.getElementById('status').textContent = 'Please enter a Bar ID';
              return;
            }
            document.getElementById('status').textContent = 'Saving...';
            fetch('save-config', { method: 'POST', body: JSON.stringify({ barId }) })
              .then(r => r.json())
              .then(d => {
                if (d.success) document.getElementById('status').textContent = 'Saved!';
                else document.getElementById('status').textContent = d.error;
              })
              .catch(e => document.getElementById('status').textContent = e.message);
          }
        </script>
      </body>
      </html>
    `)}`);
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// Create system tray
function createTray(config) {
  const iconPath = path.join(ASSETS_DIR, 'icon-green.ico');
  
  // Fallback to PNG if ICO doesn't exist
  const fallbackIcon = path.join(ASSETS_DIR, 'icon.png');
  const finalIcon = fs.existsSync(iconPath) ? iconPath : (fs.existsSync(fallbackIcon) ? fallbackIcon : null);
  
  if (!finalIcon) {
    console.error('No icon found in:', ASSETS_DIR);
    dialog.showErrorBox('Missing Icon', 'Application icon not found. Please add icon-green.ico to assets folder.');
    return null;
  }

  tray = new Tray(finalIcon);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Tabeza Connect', enabled: false },
    { type: 'separator' },
    { label: `Bar: ${config.barId || 'Not configured'}`, enabled: false },
    { label: '● Running', enabled: false },
    { type: 'separator' },
    { 
      label: 'Open Dashboard', 
      click: () => shell.openExternal('http://localhost:8765')
    },
    { 
      label: 'Staff Portal', 
      click: () => shell.openExternal(config.apiUrl || 'https://tabeza.co.ke')
    },
    { type: 'separator' },
    { 
      label: 'View Logs', 
      click: () => shell.openPath(path.join(CONFIG_DIR, 'logs'))
    },
    { type: 'separator' },
    { label: 'Exit', click: () => app.quit() }
  ]);

  tray.setToolTip('Tabeza Connect - Running');
  tray.setContextMenu(contextMenu);
  
  // Double-click opens dashboard
  tray.on('double-click', () => shell.openExternal('http://localhost:8765'));
  
  return tray;
}

// Start the capture service
async function startService(config) {
  try {
    // Set environment variables
    process.env.TABEZA_BAR_ID = config.barId;
    process.env.TABEZA_API_URL = config.apiUrl || 'https://tabeza.co.ke';
    process.env.TABEZA_WATCH_FOLDER = config.watchFolder || path.join(CONFIG_DIR, 'TabezaPrints');

    // Import and start the service
    const IntegratedCaptureService = require(path.join(SRC_DIR, 'service', 'index.js'));
    service = IntegratedCaptureService;
    
    console.log('✅ Service module loaded');
    console.log('📁 Config:', JSON.stringify(config, null, 2));
    
  } catch (error) {
    console.error('❌ Failed to start service:', error);
    dialog.showErrorBox('Service Error', `Failed to start capture service:\n${error.message}`);
  }
}

// IPC handlers
ipcMain.handle('get-config', () => loadConfig());
ipcMain.handle('get-status', async () => {
  if (service && service.getStats) {
    return await service.getStats();
  }
  return { running: !!service };
});

ipcMain.on('save-config', (event, data) => {
  try {
    const config = {
      barId: data.barId,
      apiUrl: 'https://tabeza.co.ke',
      driverId: `driver-${require('os').hostname()}`,
      watchFolder: path.join(CONFIG_DIR, 'TabezaPrints'),
      installedAt: new Date().toISOString()
    };
    
    saveConfig(config);
    event.reply('config-saved', { success: true });
    
    // Restart with new config
    if (tray) {
      tray.destroy();
      createTray(config);
    }
    startService(config);
    
  } catch (error) {
    event.reply('config-saved', { success: false, error: error.message });
  }
});

// App ready
app.whenReady().then(async () => {
  console.log('🚀 Tabeza Connect starting...');
  console.log('📦 Mode:', isDev ? 'Development' : 'Production');
  console.log('📁 User data:', app.getPath('userData'));
  
  const config = loadConfig();
  
  if (!config || !config.barId) {
    // First run - show setup
    console.log('📝 First run - showing setup');
    createSetupWindow();
  } else {
    // Start service
    console.log('⚙️  Config found, starting service...');
    await startService(config);
    createTray(config);
  }
  
  console.log('✅ Tabeza Connect ready');
});

// Handle second instance
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Cleanup on quit
app.on('before-quit', () => {
  if (service && service.stop) {
    service.stop();
  }
});

app.on('window-all-closed', () => {
  // Don't quit on window close - keep running in tray
});
