# Printer Service Auto-Start Implementation Plan

## Overview
Implement automatic startup of the Tabeza Printer Service on Windows using Bar ID configuration during first-run setup.

## Architecture Decision: First-Run Setup + Auto-Start

### User Flow
```
1. User downloads tabeza-printer-service.exe from Staff Dashboard
   ↓
2. User double-clicks EXE (first run)
   ↓
3. Setup window opens (Electron or HTML window)
   - "Enter your Bar ID from Staff Dashboard"
   - [Text input field]
   - [Save & Start Service] button
   ↓
4. User copies Bar ID from dashboard, pastes, clicks Save
   ↓
5. EXE saves config.json with Bar ID
   ↓
6. EXE creates startup shortcut automatically
   ↓
7. Service starts, minimizes to system tray
   ↓
8. On next Windows login: Service auto-starts from Startup folder
```

## Implementation Components

### 1. Config File Structure
**Location:** `%APPDATA%\Tabeza\config.json`

```json
{
  "bar_id": "venue_abc123",
  "api_url": "https://staff.tabeza.co.ke/api/printer/relay",
  "version": "1.0.0",
  "installed_at": "2026-02-11T10:30:00Z",
  "auto_start": true
}
```

### 2. First-Run Setup Window

**Technology Options:**

#### Option A: Electron (Recommended for full control)
```javascript
// main.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(app.getPath('appData'), 'Tabeza', 'config.json');

function hasConfig() {
  return fs.existsSync(CONFIG_PATH);
}

function createSetupWindow() {
  const win = new BrowserWindow({
    width: 500,
    height: 400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  win.loadFile('setup.html');
}

app.whenReady().then(() => {
  if (!hasConfig()) {
    createSetupWindow();
  } else {
    startPrinterService();
    createTrayIcon();
  }
});
```

**setup.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Tabeza Printer Service Setup</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 40px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
    }
    .info {
      color: #666;
      margin-bottom: 20px;
      font-size: 14px;
    }
    input {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      margin-bottom: 20px;
    }
    button {
      width: 100%;
      padding: 12px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      cursor: pointer;
    }
    button:hover {
      background: #45a049;
    }
    .error {
      color: #f44336;
      font-size: 14px;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Tabeza Printer Service Setup</h1>
    <p class="info">
      ℹ️ Find your Bar ID in Staff Dashboard → Settings → Bar ID
    </p>
    
    <label for="barId">Bar ID:</label>
    <input 
      type="text" 
      id="barId" 
      placeholder="e.g., venue_abc123"
      autofocus
    />
    
    <button onclick="saveConfig()">Save & Start Service</button>
    
    <div id="error" class="error"></div>
  </div>

  <script>
    const { ipcRenderer } = require('electron');
    
    function saveConfig() {
      const barId = document.getElementById('barId').value.trim();
      const errorDiv = document.getElementById('error');
      
      if (!barId) {
        errorDiv.textContent = 'Please enter a Bar ID';
        return;
      }
      
      if (barId.length < 5) {
        errorDiv.textContent = 'Bar ID seems too short. Please check and try again.';
        return;
      }
      
      // Send to main process
      ipcRenderer.send('save-config', barId);
    }
    
    // Listen for errors from main process
    ipcRenderer.on('config-error', (event, message) => {
      document.getElementById('error').textContent = message;
    });
  </script>
</body>
</html>
```

#### Option B: Simple HTML + Node Window (Lighter weight)
Use `node-window-manager` or similar to create a simple window without full Electron.

### 3. Auto-Start Implementation

**Create Startup Shortcut:**
```javascript
// auto-start.js
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

function createStartupShortcut() {
  const startupFolder = path.join(
    process.env.APPDATA,
    'Microsoft\\Windows\\Start Menu\\Programs\\Startup'
  );
  
  const exePath = process.execPath;
  const shortcutPath = path.join(startupFolder, 'Tabeza Printer Service.lnk');
  
  // Create VBS script to create shortcut
  const vbsScript = `
    Set oWS = WScript.CreateObject("WScript.Shell")
    sLinkFile = "${shortcutPath.replace(/\\/g, '\\\\')}"
    Set oLink = oWS.CreateShortcut(sLinkFile)
    oLink.TargetPath = "${exePath.replace(/\\/g, '\\\\')}"
    oLink.WorkingDirectory = "${path.dirname(exePath).replace(/\\/g, '\\\\')}"
    oLink.Description = "Tabeza Printer Service"
    oLink.Save
  `;
  
  const vbsPath = path.join(process.env.TEMP, 'create-shortcut.vbs');
  fs.writeFileSync(vbsPath, vbsScript);
  
  exec(`cscript //nologo "${vbsPath}"`, (error) => {
    fs.unlinkSync(vbsPath);
    if (error) {
      console.error('Failed to create startup shortcut:', error);
    } else {
      console.log('✅ Startup shortcut created');
    }
  });
}

module.exports = { createStartupShortcut };
```

### 4. System Tray Icon

```javascript
// tray.js
const { Tray, Menu } = require('electron');
const path = require('path');

function createTrayIcon(config) {
  const tray = new Tray(path.join(__dirname, 'icon.png'));
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Bar: ${config.bar_id}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: '● Running',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Open Configuration',
      click: () => {
        require('electron').shell.openExternal('http://localhost:3456/configure');
      }
    },
    {
      label: 'View Logs',
      click: () => {
        // Open logs folder
      }
    },
    {
      label: 'Restart Service',
      click: () => {
        // Restart printer service
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
  
  tray.setToolTip('Tabeza Printer Service');
  tray.setContextMenu(contextMenu);
  
  return tray;
}

module.exports = { createTrayIcon };
```

### 5. Main Service Integration

```javascript
// main.js (complete)
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { createStartupShortcut } = require('./auto-start');
const { createTrayIcon } = require('./tray');
const { startPrinterService } = require('./printer-service');

const CONFIG_DIR = path.join(app.getPath('appData'), 'Tabeza');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

let setupWindow = null;
let tray = null;

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (error) {
    console.error('Failed to load config:', error);
    return null;
  }
}

function saveConfig(barId) {
  ensureConfigDir();
  
  const config = {
    bar_id: barId,
    api_url: 'https://staff.tabeza.co.ke/api/printer/relay',
    version: '1.0.0',
    installed_at: new Date().toISOString(),
    auto_start: true
  };
  
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  return config;
}

function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 500,
    height: 400,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  setupWindow.loadFile('setup.html');
  
  setupWindow.on('closed', () => {
    setupWindow = null;
  });
}

// Handle config save from setup window
ipcMain.on('save-config', (event, barId) => {
  try {
    const config = saveConfig(barId);
    
    // Create startup shortcut
    createStartupShortcut();
    
    // Close setup window
    if (setupWindow) {
      setupWindow.close();
    }
    
    // Start service
    startPrinterService(config);
    
    // Create tray icon
    tray = createTrayIcon(config);
    
  } catch (error) {
    event.reply('config-error', 'Failed to save configuration: ' + error.message);
  }
});

app.whenReady().then(() => {
  const config = loadConfig();
  
  if (!config) {
    // First run - show setup
    createSetupWindow();
  } else {
    // Config exists - start service
    startPrinterService(config);
    tray = createTrayIcon(config);
  }
});

app.on('window-all-closed', () => {
  // Don't quit on window close - keep running in tray
});
```

## Build Process

### Using `electron-builder`

**package.json:**
```json
{
  "name": "tabeza-printer-service",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder"
  },
  "build": {
    "appId": "com.tabeza.printer-service",
    "productName": "Tabeza Printer Service",
    "win": {
      "target": "nsis",
      "icon": "icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  },
  "dependencies": {
    "electron": "^28.0.0"
  },
  "devDependencies": {
    "electron-builder": "^24.0.0"
  }
}
```

**Build command:**
```bash
npm run build
```

Output: `dist/Tabeza Printer Service Setup 1.0.0.exe`

## Staff Dashboard Integration

### Add Download Section

```typescript
// apps/staff/app/settings/page.tsx

<div className="printer-service-section">
  <h2>Printer Service Setup</h2>
  
  <div className="bar-id-display">
    <label>Your Bar ID:</label>
    <div className="bar-id-value">
      <code>{barId}</code>
      <button onClick={() => navigator.clipboard.writeText(barId)}>
        📋 Copy
      </button>
    </div>
  </div>
  
  <div className="download-section">
    <h3>Download Printer Service</h3>
    <a 
      href="/downloads/tabeza-printer-service.exe" 
      className="download-button"
      download
    >
      ⬇️ Download for Windows
    </a>
    
    <div className="instructions">
      <h4>Installation Steps:</h4>
      <ol>
        <li>Run the downloaded EXE file</li>
        <li>Copy your Bar ID above</li>
        <li>Paste it when prompted</li>
        <li>Click "Save & Start Service"</li>
        <li>Look for green tray icon = ready ✅</li>
      </ol>
    </div>
  </div>
</div>
```

## Testing Checklist

### Before Release:

- [ ] First run shows setup window
- [ ] Valid Bar ID saves successfully
- [ ] Invalid/empty Bar ID shows error
- [ ] Startup shortcut created in Startup folder
- [ ] Service starts after setup
- [ ] Tray icon appears with correct Bar ID
- [ ] Service auto-starts on Windows restart
- [ ] Receipts sent with correct Bar ID
- [ ] Config persists across restarts
- [ ] Uninstall removes startup shortcut

## Alternative: Simpler VBS Approach (No Electron)

If Electron is too heavy, use a VBS launcher:

**tabeza-service-launcher.vbs:**
```vbs
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Check for config
configPath = WshShell.ExpandEnvironmentStrings("%APPDATA%") & "\Tabeza\config.json"

If Not fso.FileExists(configPath) Then
  ' First run - open setup page in browser
  WshShell.Run "http://localhost:3456/setup", 1, False
  
  ' Wait for config to be created
  Do While Not fso.FileExists(configPath)
    WScript.Sleep 1000
  Loop
End If

' Start Node service silently
WshShell.Run "node """ & fso.GetParentFolderName(WScript.ScriptFullName) & "\index.js""", 0, False
```

## Recommendation

Use **Electron approach** for:
- Professional appearance
- Better error handling
- System tray integration
- Easier updates

This provides the best user experience for non-technical venue staff.
