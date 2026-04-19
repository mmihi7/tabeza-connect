#!/usr/bin/env node
/**
 * TabezaConnect Standalone Tray Application
 * 
 * This tray app monitors the existing Windows service
 * and provides system tray status without running the service internally.
 */

'use strict';

const { app, Tray, Menu, BrowserWindow, nativeImage, ipcMain, shell } = require('electron');
const path = require('path');
const axios = require('axios');

// ── Application state ───────────────────────────────────────────────────
const ApplicationState = {
  STARTING: 'starting',
  CONNECTED: 'connected',
  UNCONFIGURED: 'unconfigured',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  SHUTTING_DOWN: 'shutting_down',
};

// ── Icon paths ────────────────────────────────────────────────────────
const ICON_PATHS = {
  green: path.join(__dirname, '../../assets/icon-green.ico'),
  grey: path.join(__dirname, '../../assets/icon-grey.ico'),
};

// ── Global variables ───────────────────────────────────────────────────
let tray = null;
let statusWindow = null;
let currentState = ApplicationState.STARTING;
let statusPollingInterval = null;
const API_BASE = 'http://localhost:8765';

// ── State management ───────────────────────────────────────────────────
function updateState(newState) {
  const validTransitions = {
    [ApplicationState.STARTING]: ['connected', 'unconfigured', 'error', 'shutting_down'],
    [ApplicationState.CONNECTED]: ['disconnected', 'error', 'shutting_down'],
    [ApplicationState.UNCONFIGURED]: ['connected', 'error', 'shutting_down'],
    [ApplicationState.DISCONNECTED]: ['connected', 'error', 'shutting_down'],
    [ApplicationState.ERROR]: ['connected', 'unconfigured', 'starting', 'shutting_down'],
    [ApplicationState.SHUTTING_DOWN]: [],
  };

  if (validTransitions[currentState].includes(newState)) {
    currentState = newState;
    updateTrayIcon();
    console.log(`State changed to: ${newState}`);
  } else {
    console.warn(`Invalid state transition: ${currentState} -> ${newState}`);
  }
}

// ── Tray icon management ─────────────────────────────────────────────────
function updateTrayIcon() {
  if (!tray) return;

  const iconPath = currentState === ApplicationState.CONNECTED ? ICON_PATHS.green : ICON_PATHS.grey;
  
  try {
    const icon = nativeImage.createFromPath(iconPath);
    tray.setImage(icon);
    tray.setToolTip(`TabezaConnect - ${currentState.toUpperCase()}`);
  } catch (err) {
    console.error('Failed to update tray icon:', err);
  }
}

function createTray() {
  try {
    tray = new Tray(ICON_PATHS.grey);
    tray.setToolTip('TabezaConnect - Starting...');
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Status',
        click: () => showStatusWindow()
      },
      {
        label: 'Open Management UI',
        click: () => {
          shell.openExternal(API_BASE);
        }
      },
      { type: 'separator' },
      {
        label: 'Service Status',
        click: () => {
          checkServiceStatus();
        }
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          updateState(ApplicationState.SHUTTING_DOWN);
          app.quit();
        }
      }
    ]);
    
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => showStatusWindow());
    
    updateTrayIcon();
    console.log('Tray icon created successfully');
  } catch (err) {
    console.error('Failed to create tray icon:', err);
  }
}

// ── Status window ───────────────────────────────────────────────────────
function showStatusWindow() {
  if (statusWindow) {
    statusWindow.focus();
    return;
  }

  statusWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: ICON_PATHS.green,
    show: false,
    title: 'TabezaConnect Status'
  });

  // Create status HTML content
  const statusHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>TabezaConnect Status</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .status { padding: 10px; margin: 10px 0; border-radius: 4px; }
        .status.connected { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .status.disconnected { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
        .refresh-btn { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
        .refresh-btn:hover { background: #0056b3; }
        .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 4px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; color: #007bff; }
        .metric-label { font-size: 12px; color: #6c757d; margin-top: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🧾 TabezaConnect Status</h1>
        <div id="status" class="status">Checking service status...</div>
        
        <button class="refresh-btn" onclick="location.reload()">🔄 Refresh Status</button>
        <button class="refresh-btn" onclick="window.open('${API_BASE}', '_blank')">🌐 Open Management UI</button>
        
        <div class="metrics" id="metrics">
          <div class="metric">
            <div class="metric-value" id="jobs-processed">-</div>
            <div class="metric-label">Jobs Processed</div>
          </div>
          <div class="metric">
            <div class="metric-value" id="queue-size">-</div>
            <div class="metric-label">Queue Size</div>
          </div>
          <div class="metric">
            <div class="metric-value" id="upload-status">-</div>
            <div class="metric-label">Upload Status</div>
          </div>
          <div class="metric">
            <div class="metric-value" id="uptime">-</div>
            <div class="metric-label">Uptime</div>
          </div>
        </div>
        
        <div id="details" style="margin-top: 20px;">
          <h3>Service Details</h3>
          <div id="service-details">Loading...</div>
        </div>
      </div>
      
      <script>
        async function updateStatus() {
          try {
            const response = await fetch('${API_BASE}/api/status');
            const data = await response.json();
            
            const statusDiv = document.getElementById('status');
            const metricsDiv = document.getElementById('metrics');
            const detailsDiv = document.getElementById('service-details');
            
            if (data.success) {
              statusDiv.className = 'status connected';
              statusDiv.textContent = '✅ Service Connected and Running';
              
              // Update metrics
              document.getElementById('jobs-processed').textContent = data.data.service.jobsProcessed || '0';
              document.getElementById('queue-size').textContent = data.data.queue.pending || '0';
              document.getElementById('upload-status').textContent = data.data.upload.isRunning ? 'Active' : 'Idle';
              document.getElementById('uptime').textContent = Math.floor(data.data.service.uptime / 60) + 'm';
              
              // Update details
              detailsDiv.innerHTML = \`
                <p><strong>Bar ID:</strong> \${data.data.service.barId || 'Not configured'}</p>
                <p><strong>Driver ID:</strong> \${data.data.service.driverId || 'Unknown'}</p>
                <p><strong>API URL:</strong> \${data.data.service.apiUrl || 'Unknown'}</p>
                <p><strong>Version:</strong> \${data.data.service.version || 'Unknown'}</p>
                <p><strong>Watch Folder:</strong> \${data.data.service.watchFolder || 'Unknown'}</p>
              \`;
            } else {
              statusDiv.className = 'status error';
              statusDiv.textContent = '❌ Service Error: ' + (data.error || 'Unknown error');
            }
          } catch (error) {
            const statusDiv = document.getElementById('status');
            statusDiv.className = 'status disconnected';
            statusDiv.textContent = '⚠️ Service Disconnected - Is the service running?';
            
            document.getElementById('jobs-processed').textContent = '-';
            document.getElementById('queue-size').textContent = '-';
            document.getElementById('upload-status').textContent = '-';
            document.getElementById('uptime').textContent = '-';
            
            document.getElementById('service-details').innerHTML = '<p>Cannot connect to service. Please ensure TabezaConnect service is running.</p>';
          }
        }
        
        // Update status immediately and then every 5 seconds
        updateStatus();
        setInterval(updateStatus, 5000);
      </script>
    </body>
    </html>
  `;

  statusWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(statusHTML)}`);
  
  statusWindow.once('ready-to-show', () => {
    statusWindow.show();
  });
  
  statusWindow.on('closed', () => {
    statusWindow = null;
  });
}

// ── Service status checking ─────────────────────────────────────────────────
async function checkServiceStatus() {
  try {
    const response = await axios.get(`${API_BASE}/api/status`, { timeout: 5000 });
    
    if (response.data && response.data.success) {
      updateState(ApplicationState.CONNECTED);
      return true;
    } else {
      updateState(ApplicationState.ERROR);
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      updateState(ApplicationState.DISCONNECTED);
    } else {
      updateState(ApplicationState.ERROR);
    }
    return false;
  }
}

// ── Application lifecycle ─────────────────────────────────────────────────
async function startApp() {
  console.log('Starting TabezaConnect Standalone Tray Application...');
  
  // Create tray icon
  createTray();
  
  // Check initial service status
  await checkServiceStatus();
  
  // Start status polling
  statusPollingInterval = setInterval(checkServiceStatus, 10000); // Check every 10 seconds
  
  console.log('Tray application started successfully');
}

async function shutdownApp() {
  console.log('Shutting down tray application...');
  
  if (statusPollingInterval) {
    clearInterval(statusPollingInterval);
  }
  
  if (statusWindow) {
    statusWindow.close();
  }
  
  if (tray) {
    tray.destroy();
  }
  
  console.log('Tray application shutdown complete');
}

// ── Electron app events ───────────────────────────────────────────────────
app.whenReady().then(startApp);

app.on('window-all-closed', () => {
  // Don't quit on macOS when all windows are closed
  // Keep the tray icon running
});

app.on('before-quit', async () => {
  await shutdownApp();
});

app.on('activate', () => {
  // On macOS, re-create the tray when dock icon is clicked
  if (!tray) {
    createTray();
  }
});

// Handle second instance
app.on('second-instance', () => {
  // Someone tried to run a second instance
  if (statusWindow) {
    statusWindow.focus();
  } else {
    showStatusWindow();
  }
});

console.log('TabezaConnect Standalone Tray Application loaded');
