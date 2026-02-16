# Customer-Friendly Installer - Design Document

## 1. Architecture Overview

### 1.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    INSTALLER PACKAGE                        │
│  • Inno Setup Script                                        │
│  • Bundled Node.js Runtime                                  │
│  • Printer Service Code                                     │
│  • System Tray Application                                  │
│  • PowerShell Configuration Scripts                         │
│  • EV Code Signed Executable                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 INSTALLATION PROCESS                        │
│  1. Extract bundled Node.js to Program Files               │
│  2. Install printer service as Windows service              │
│  3. Configure Generic/Text Only printer with FILE: port     │
│  4. Create watch folder structure                           │
│  5. Register system tray application                        │
│  6. Configure auto-update mechanism                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  RUNTIME ARCHITECTURE                       │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   POS        │───▶│   Virtual    │───▶│    Watch     │ │
│  │   System     │    │   Printer    │    │    Folder    │ │
│  └──────────────┘    └──────────────┘    └──────┬───────┘ │
│                                                   │         │
│  ┌──────────────┐                                │         │
│  │   Physical   │                                │         │
│  │   Printer    │                                ▼         │
│  └──────────────┘                      ┌──────────────┐   │
│                                        │   Printer    │   │
│                                        │   Service    │   │
│                                        └──────┬───────┘   │
│                                               │           │
│                                               ▼           │
│                                        ┌──────────────┐   │
│                                        │   System     │   │
│                                        │   Tray       │   │
│                                        └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Core Principles


**Principle 1: Never Block POS Operations**
- Tabeza operates as secondary output alongside physical printer
- Physical printer continues working if Tabeza fails
- Dual-printer architecture is non-negotiable
- Aligns with Parser Advisory: "Tabeza must never block, delay, reject, or interfere with a print job"

**Principle 2: Installer-First Development**
- Installer is the primary deliverable, not an afterthought
- Customer's first interaction with product
- Automation over documentation
- Progressive configuration (basic → advanced)

**Principle 3: Self-Healing Architecture**
- Detect and recover from common failures automatically
- Recreate watch folder if deleted
- Queue and retry failed uploads
- Windows service recovery on crash

**Principle 4: Offline-First Design**
- POS always runs, always prints, always records sales
- Tabeza enhances when online, doesn't impede when offline
- Local queue with cloud sync when available
- No data loss during connectivity issues

**Principle 5: Security by Default**
- EV code signing for trusted distribution
- Signature verification for all updates
- HTTPS-only communications
- Audit logging for security events

### 1.3 Mode-Based Architecture

The installer must respect Tabeza's venue modes and authority configurations:

```typescript
// CORE TRUTH: Manual service always exists. 
// Digital authority is singular. 
// Tabeza adapts to the venue — never the reverse.

interface VenueConfiguration {
  venue_mode: 'basic' | 'venue';
  authority_mode: 'pos' | 'tabeza';
  pos_integration_enabled: boolean;
  printer_required: boolean;
}

// Configuration Matrix
const VALID_CONFIGURATIONS = [
  { venue_mode: 'basic', authority_mode: 'pos', printer_required: true },
  { venue_mode: 'venue', authority_mode: 'pos', printer_required: true },
  { venue_mode: 'venue', authority_mode: 'tabeza', printer_required: false }
];
```

**Installer Behavior by Mode:**

- **Basic Mode**: Always install printer integration (mandatory)
- **Venue + POS**: Always install printer integration (mandatory)
- **Venue + Tabeza**: Skip printer installation (not used)

## 2. Component Design

### 2.1 Installer Package Structure

```
TabezaConnect-Setup.exe (EV Code Signed)
├── inno-setup-script.iss
├── bundled-nodejs/
│   ├── node.exe
│   ├── npm/
│   └── node_modules/
├── printer-service/
│   ├── index.js
│   ├── package.json
│   └── node_modules/
├── system-tray/
│   ├── tray-app.js
│   └── icons/
├── scripts/
│   ├── configure-printer.ps1
│   ├── register-service.ps1
│   └── create-folders.ps1
└── assets/
    ├── icon.ico
    └── license.txt
```

### 2.2 Installation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Welcome Screen                                      │
│  • Display Tabeza branding                                  │
│  • Show installation requirements                           │
│  • License agreement                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Bar Code Entry                                      │
│  • Input field for bar ID                                   │
│  • Validate format (UUID)                                   │
│  • Optional: Fetch bar name from API                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Mode Detection (from cloud API)                     │
│  • Query bar configuration                                  │
│  • Determine if printer required                            │
│  • Show appropriate next steps                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Installation (Automated)                            │
│  • Extract Node.js to Program Files\Tabeza                  │
│  • Copy printer service files                               │
│  • Register Windows service                                 │
│  • Configure printer (if required by mode)                  │
│  • Create watch folder structure                            │
│  • Register system tray application                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Verification                                        │
│  • Test printer configuration                               │
│  • Verify service is running                                │
│  • Send test heartbeat to cloud                             │
│  • Display success message                                  │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Dual-Printer Configuration

**Critical Implementation Detail:**

The installer MUST configure Tabeza as a SECONDARY printer, not a replacement:

```powershell
# configure-printer.ps1

# Step 1: Verify physical printer exists
$physicalPrinter = Get-Printer | Where-Object { $_.DriverName -like "*Receipt*" -or $_.DriverName -like "*Thermal*" }

if (-not $physicalPrinter) {
    Write-Warning "No physical receipt printer detected. POS may need manual configuration."
}

# Step 2: Create Tabeza virtual printer (secondary)
Add-PrinterDriver -Name "Generic / Text Only"
Add-Printer -Name "Tabeza Receipt Printer" -DriverName "Generic / Text Only" -PortName "FILE:"

# Step 3: Configure FILE: port to watch folder
$watchFolder = "C:\TabezaPrints"
New-Item -ItemType Directory -Path $watchFolder -Force

# Registry configuration for FILE: port default path
$regPath = "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Devices"
Set-ItemProperty -Path $regPath -Name "Tabeza Receipt Printer" -Value "FILE:,$watchFolder"

# Step 4: Verify dual-printer setup
Write-Host "✅ Physical printer: $($physicalPrinter.Name) (PRIMARY)"
Write-Host "✅ Tabeza printer: Tabeza Receipt Printer (SECONDARY)"
Write-Host ""
Write-Host "IMPORTANT: Configure your POS to print to BOTH printers:"
Write-Host "  1. Primary: $($physicalPrinter.Name) - for customer receipts"
Write-Host "  2. Secondary: Tabeza Receipt Printer - for digital capture"
```

### 2.4 Node.js Bundling Strategy

**Avoid pkg tool** - it cannot handle runtime file paths and native modules.

**Correct Approach:**

```javascript
// Bundle full Node.js runtime in private location
const INSTALL_PATH = "C:\\Program Files\\Tabeza\\nodejs";

// Installation script
function bundleNodeJS() {
  // 1. Download portable Node.js (or include in installer)
  const nodeVersion = "v18.19.0";
  const nodeUrl = `https://nodejs.org/dist/${nodeVersion}/node-${nodeVersion}-win-x64.zip`;
  
  // 2. Extract to private location
  extractZip(nodeUrl, INSTALL_PATH);
  
  // 3. Copy printer service to installation directory
  copyDirectory("printer-service", `${INSTALL_PATH}\\service`);
  
  // 4. Install dependencies in private location
  execSync(`"${INSTALL_PATH}\\node.exe" "${INSTALL_PATH}\\npm" install`, {
    cwd: `${INSTALL_PATH}\\service`
  });
  
  // 5. Create service wrapper
  createServiceWrapper();
}

function createServiceWrapper() {
  const wrapperScript = `
    @echo off
    REM Tabeza Printer Service Wrapper
    SET NODE_PATH=${INSTALL_PATH}
    SET SERVICE_PATH=${INSTALL_PATH}\\service
    
    REM Start service with bundled Node.js
    "${INSTALL_PATH}\\node.exe" "${SERVICE_PATH}\\index.js"
  `;
  
  fs.writeFileSync(`${INSTALL_PATH}\\start-service.bat`, wrapperScript);
}
```

### 2.5 Windows Service Registration

```powershell
# register-service.ps1

$serviceName = "TabezaPrinterService"
$displayName = "Tabeza Printer Service"
$description = "Monitors print jobs and relays receipts to Tabeza cloud"
$binaryPath = "C:\Program Files\Tabeza\nodejs\start-service.bat"

# Create service with automatic recovery
New-Service -Name $serviceName `
            -DisplayName $displayName `
            -Description $description `
            -BinaryPathName $binaryPath `
            -StartupType Automatic

# Configure service recovery (restart on failure)
sc.exe failure $serviceName reset= 86400 actions= restart/5000/restart/10000/restart/30000

# Set service to run as LocalSystem (or NetworkService for non-admin)
sc.exe config $serviceName obj= "LocalSystem"

# Start service
Start-Service -Name $serviceName

Write-Host "✅ Service registered and started"
```

### 2.6 System Tray Application

**Use Node.js systray2 package** - single codebase, no C# dependency.

```javascript
// system-tray/tray-app.js

const SysTray = require('systray2').default;
const { exec } = require('child_process');
const fetch = require('node-fetch');

class TabezaTrayApp {
  constructor() {
    this.barId = process.env.TABEZA_BAR_ID;
    this.apiUrl = process.env.TABEZA_API_URL;
    this.status = 'unknown';
    
    this.initTray();
    this.startStatusMonitoring();
  }
  
  initTray() {
    this.systray = new SysTray({
      menu: {
        icon: this.getStatusIcon(),
        title: 'Tabeza',
        tooltip: 'Tabeza Printer Service',
        items: [
          {
            title: 'Status: Checking...',
            tooltip: 'Current service status',
            enabled: false
          },
          {
            title: '---'
          },
          {
            title: 'Test Print',
            tooltip: 'Send test receipt',
            enabled: true,
            click: () => this.testPrint()
          },
          {
            title: 'View Dashboard',
            tooltip: 'Open Tabeza dashboard',
            enabled: true,
            click: () => this.openDashboard()
          },
          {
            title: '---'
          },
          {
            title: 'Settings',
            tooltip: 'Configure service',
            enabled: true,
            click: () => this.openSettings()
          },
          {
            title: 'Exit',
            tooltip: 'Close tray application',
            enabled: true,
            click: () => this.exit()
          }
        ]
      }
    });
  }
  
  getStatusIcon() {
    switch (this.status) {
      case 'online': return './icons/green.ico';
      case 'offline': return './icons/yellow.ico';
      case 'error': return './icons/red.ico';
      default: return './icons/gray.ico';
    }
  }
  
  async startStatusMonitoring() {
    setInterval(async () => {
      try {
        // Check service status
        const response = await fetch(`http://localhost:8765/api/status`);
        const data = await response.json();
        
        // Check heartbeat status
        const heartbeat = await fetch(`${this.apiUrl}/api/printer/driver-status?barId=${this.barId}`);
        const heartbeatData = await heartbeat.json();
        
        // Update status
        if (data.status === 'running' && heartbeatData.status === 'online') {
          this.updateStatus('online', `Online - ${data.receiptsToday || 0} receipts today`);
        } else if (data.status === 'running') {
          this.updateStatus('offline', 'Service running - Cloud offline');
        } else {
          this.updateStatus('error', 'Service not running');
        }
      } catch (error) {
        this.updateStatus('error', 'Cannot connect to service');
      }
    }, 10000); // Check every 10 seconds
  }
  
  updateStatus(status, message) {
    this.status = status;
    this.systray.sendAction({
      type: 'update-item',
      item: {
        title: `Status: ${message}`,
        enabled: false
      },
      seq_id: 0
    });
    
    this.systray.sendAction({
      type: 'update-icon',
      icon: this.getStatusIcon()
    });
  }
  
  async testPrint() {
    try {
      const response = await fetch('http://localhost:8765/api/test-print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testMessage: 'System tray test' })
      });
      
      if (response.ok) {
        this.showNotification('Test print sent successfully');
      } else {
        this.showNotification('Test print failed', 'error');
      }
    } catch (error) {
      this.showNotification('Cannot connect to service', 'error');
    }
  }
  
  openDashboard() {
    exec(`start ${this.apiUrl}/settings`);
  }
  
  openSettings() {
    exec('start http://localhost:8765/configure.html');
  }
  
  showNotification(message, type = 'info') {
    // Windows notification
    exec(`powershell -Command "New-BurntToastNotification -Text 'Tabeza', '${message}'"`);
  }
  
  exit() {
    this.systray.kill();
    process.exit(0);
  }
}

// Start tray application
new TabezaTrayApp();
```

## 3. Security Implementation

### 3.1 EV Code Signing

**Certificate Requirements:**
- Extended Validation (EV) code signing certificate
- Cost: $300-500 annually
- Providers: DigiCert, Sectigo, GlobalSign
- Validation: 2-3 weeks for first-time purchase

**Signing Process:**

```bash
# Sign installer executable
signtool sign /f "TabezaEV.pfx" /p "password" /tr http://timestamp.digicert.com /td sha256 /fd sha256 "TabezaConnect-Setup.exe"

# Verify signature
signtool verify /pa /v "TabezaConnect-Setup.exe"
```

### 3.2 Auto-Update Security

```javascript
// auto-update/update-manager.js

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

class SecureUpdateManager {
  constructor() {
    this.updateServerUrl = 'https://updates.tabeza.co.ke';
    this.publicKey = fs.readFileSync('./public-key.pem', 'utf8');
    this.currentVersion = '1.0.0';
  }
  
  async checkForUpdates() {
    try {
      // 1. Fetch update manifest (HTTPS only)
      const manifest = await this.fetchManifest();
      
      // 2. Verify manifest signature
      if (!this.verifySignature(manifest, manifest.signature)) {
        throw new Error('Invalid manifest signature');
      }
      
      // 3. Check if update available
      if (this.compareVersions(manifest.version, this.currentVersion) > 0) {
        return manifest;
      }
      
      return null;
    } catch (error) {
      console.error('Update check failed:', error);
      return null;
    }
  }
  
  async fetchManifest() {
    return new Promise((resolve, reject) => {
      https.get(`${this.updateServerUrl}/manifest.json`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
  }
  
  verifySignature(data, signature) {
    const verify = crypto.createVerify('SHA256');
    verify.update(JSON.stringify(data));
    verify.end();
    
    return verify.verify(this.publicKey, signature, 'base64');
  }
  
  async downloadUpdate(manifest) {
    // 1. Download update file
    const updateFile = await this.downloadFile(manifest.url);
    
    // 2. Verify file signature
    const fileSignature = await this.downloadFile(manifest.signatureUrl);
    if (!this.verifyFileSignature(updateFile, fileSignature)) {
      throw new Error('Invalid update file signature');
    }
    
    // 3. Return path to verified update
    return updateFile;
  }
  
  async installUpdate(updateFilePath) {
    // 1. Create backup of current installation
    await this.createBackup();
    
    // 2. Stop service
    await this.stopService();
    
    try {
      // 3. Run update installer
      await this.runInstaller(updateFilePath);
      
      // 4. Verify installation
      await this.verifyInstallation();
      
      // 5. Start service
      await this.startService();
      
      // 6. Clean up backup
      await this.removeBackup();
      
      return true;
    } catch (error) {
      // Rollback on failure
      console.error('Update failed, rolling back:', error);
      await this.rollback();
      throw error;
    }
  }
  
  async rollback() {
    // 1. Stop service
    await this.stopService();
    
    // 2. Restore from backup
    await this.restoreBackup();
    
    // 3. Start service
    await this.startService();
  }
  
  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
      if (parts1[i] > parts2[i]) return 1;
      if (parts1[i] < parts2[i]) return -1;
    }
    
    return 0;
  }
}

module.exports = SecureUpdateManager;
```



## 7. Troubleshooting and Known Issues

### 7.1 Node.js Download and Extraction

**Issue:** CMD shell compatibility
- **Problem:** The original download script used `timeout` command which doesn't exist in CMD shell
- **Solution:** Removed the problematic cleanup section; PowerShell's `Expand-Archive` handles file locking correctly
- **Status:** Fixed in download-nodejs.js

**Verification Steps:**
```bash
# From packages/printer-service directory
npm run download:nodejs

# Expected output:
# ✅ Download complete
# ✅ Extraction complete
# ✅ node.exe verified
# ✅ Node version: v18.19.0
```

**Common Issues:**

1. **Extraction folder already exists:**
   - Script automatically removes old folder before renaming
   - Retry logic handles file locking issues

2. **PowerShell execution policy:**
   - If extraction fails, run: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`
   - Installer will handle this automatically

3. **Antivirus interference:**
   - Some antivirus software may block extraction
   - Add exception for `packages/printer-service/installer/` directory

### 7.2 Installer Build Process

**Build Command:**
```bash
cd packages/printer-service
npm run build:installer:new
```

**Expected Steps:**
1. Download Node.js runtime (if not cached)
2. Prepare service files
3. Install service dependencies
4. Copy installer scripts
5. Create installer package (ZIP)

**Output Location:**
- `packages/printer-service/dist/TabezaConnect-Setup-v1.0.0.zip`

### 7.3 Testing the Installer

**Test Environment Requirements:**
- Clean Windows 10 or 11 VM
- No existing Node.js installation (to verify bundled runtime)
- Administrator privileges
- Internet connectivity (for initial bar configuration)

**Test Procedure:**
1. Extract ZIP to temporary location
2. Right-click `install.bat` → Run as administrator
3. Enter test bar ID
4. Verify printer configuration (if required by mode)
5. Check service status: http://localhost:8765/api/status
6. Test print from POS system

### 7.4 Debugging Failed Installations

**Log Locations:**
- Installer log: `C:\Program Files\Tabeza\install.log`
- Service log: `C:\Program Files\Tabeza\nodejs\service\logs\service.log`
- Windows Event Viewer: Application logs filtered by "Tabeza"

**Common Failure Points:**

1. **Service registration fails:**
   - Check if service name already exists: `sc query TabezaPrinterService`
   - Remove old service: `sc delete TabezaPrinterService`
   - Retry installation

2. **Printer configuration fails:**
   - Verify Generic/Text Only driver exists: `Get-PrinterDriver`
   - Check printer port: `Get-PrinterPort | Where-Object {$_.Name -eq "FILE:"}`
   - Manually configure printer using `scripts/configure-printer.ps1`

3. **Watch folder permission errors:**
   - Check folder exists: `Test-Path C:\TabezaPrints`
   - Check permissions: `Get-Acl C:\TabezaPrints`
   - Recreate with proper permissions: `scripts/create-folders.ps1`

4. **Node.js runtime issues:**
   - Verify node.exe: `"C:\Program Files\Tabeza\nodejs\node.exe" --version`
   - Check dependencies: `dir "C:\Program Files\Tabeza\nodejs\service\node_modules"`
   - Reinstall dependencies: `npm install --production` in service directory

### 7.5 Rollback Procedure

If installation fails and system is in inconsistent state:

```powershell
# Stop and remove service
Stop-Service -Name TabezaPrinterService -ErrorAction SilentlyContinue
sc.exe delete TabezaPrinterService

# Remove printer
Remove-Printer -Name "Tabeza Receipt Printer" -ErrorAction SilentlyContinue

# Remove installation directory
Remove-Item -Path "C:\Program Files\Tabeza" -Recurse -Force -ErrorAction SilentlyContinue

# Remove watch folder (optional - may contain data)
# Remove-Item -Path "C:\TabezaPrints" -Recurse -Force -ErrorAction SilentlyContinue
```

### 7.6 Mode-Specific Issues

**Basic Mode:**
- Printer installation is mandatory
- If printer setup fails, installation should abort
- Physical printer must exist for dual-printer setup

**Venue + POS Mode:**
- Printer installation is mandatory
- Service must connect to cloud for heartbeat
- Bar configuration must have `printer_required = true`

**Venue + Tabeza Mode:**
- Printer installation is skipped
- Service runs but doesn't monitor watch folder
- Bar configuration must have `printer_required = false`

### 7.7 Update Mechanism Issues

**Update fails to download:**
- Check internet connectivity
- Verify update server is accessible: `https://updates.tabeza.co.ke`
- Check firewall/proxy settings

**Update signature verification fails:**
- Update file may be corrupted
- Re-download update
- Check certificate expiration

**Update installation fails:**
- Backup is automatically created before update
- Rollback is triggered automatically
- Check rollback log: `C:\Program Files\Tabeza\update-rollback.log`

**Service doesn't start after update:**
- Check service status: `Get-Service TabezaPrinterService`
- Check service log for errors
- Manually rollback: Run `scripts/rollback-update.ps1`
