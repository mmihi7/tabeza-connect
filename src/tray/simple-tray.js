const { app, Tray, Menu, BrowserWindow, shell } = require('electron');
const path = require('path');
const axios = require('axios');

let tray = null;
let statusWindow = null;
let statusInterval = null;

async function checkServiceStatus() {
  try {
    const response = await axios.get('http://localhost:8765/api/status', { timeout: 5000 });
    return { running: true, data: response.data };
  } catch (error) {
    return { running: false, error: error.message };
  }
}

function updateTrayIcon(isRunning) {
  if (!tray) return;
  const iconPath = isRunning ? 
    path.join(__dirname, '../../assets/icon-green.ico') : 
    path.join(__dirname, '../../assets/icon-grey.ico');
  tray.setImage(iconPath);
  tray.setToolTip(isRunning ? 'TabezaConnect - Connected' : 'TabezaConnect - Disconnected');
}

function createTray() {
  const iconPath = path.join(__dirname, '../../assets/icon-grey.ico');
  tray = new Tray(iconPath);
  tray.setToolTip('TabezaConnect - Starting...');
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Status',
      click: () => showStatusWindow()
    },
    {
      label: 'Open Management UI',
      click: () => shell.openExternal('http://localhost:8765')
    },
    {
      label: 'Open Template Generator',
      click: () => shell.openExternal('http://localhost:8765/template.html')
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => app.quit()
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => showStatusWindow());
}

function showStatusWindow() {
  if (statusWindow) {
    statusWindow.focus();
    return;
  }
  
  statusWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
    icon: path.join(__dirname, '../../assets/icon-green.ico'),
    show: false,
    title: 'TabezaConnect Status'
  });
  
  statusWindow.loadURL('http://localhost:8765');
  statusWindow.once('ready-to-show', () => statusWindow.show());
  statusWindow.on('closed', () => statusWindow = null);
}

async function startStatusMonitoring() {
  createTray();
  
  // Initial status check
  const status = await checkServiceStatus();
  updateTrayIcon(status.running);
  
  // Monitor status every 10 seconds
  statusInterval = setInterval(async () => {
    const status = await checkServiceStatus();
    updateTrayIcon(status.running);
  }, 10000);
}

app.whenReady().then(startStatusMonitoring);

app.on('before-quit', () => {
  if (statusInterval) clearInterval(statusInterval);
});

console.log('TabezaConnect Tray Application started');
