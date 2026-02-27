# Design Document: TabezaConnect Tray App Conversion

## Overview

This design converts TabezaConnect from a Windows Service running in Session 0 to a System Tray Application running in Session 1 (user session). The conversion resolves two critical Windows architecture issues:

1. **Error 1053 Service Timeout**: Windows Services running as Local System have strict 30-second startup limits
2. **Printer Access Failure**: Session 0 isolation prevents services from accessing USB printers in user sessions

The tray app approach provides:
- Direct access to USB printer hardware (Session 1)
- Visual status feedback via tray icon
- User-friendly configuration interface
- Automatic startup on user login
- Graceful window management (minimize to tray)

### Core Design Principle

**Minimal Code Changes**: The conversion uses a wrapper pattern to add tray functionality while preserving 100% of the existing service logic. The core receipt capture, upload, and forwarding code remains untouched.

### Core Operating Principle: Physical Print Authority

**TabezaConnect is a passive bridge, not the source of truth.** The POS system is the authority - it prints physical receipts directly to the thermal printer. TabezaConnect captures these receipts and uploads them to the cloud as a secondary function. This means:

- **Physical receipts always print** - Even if TabezaConnect crashes or is misconfigured, the POS continues printing normally
- **Cloud upload gaps are acceptable** - The physical receipt already exists; digital delivery is a convenience enhancement
- **TabezaConnect never blocks POS operations** - It observes and forwards, never intercepts or controls

This architecture ensures business continuity: venues can operate normally even if TabezaConnect has issues.

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Windows User Session (Session 1)          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Tray App Wrapper (tray-app.js)            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │ │
│  │  │  Tray Icon   │  │    Window    │  │ Context Menu│  │ │
│  │  │  Management  │  │  Management  │  │   Handler   │  │ │
│  │  └──────────────┘  └──────────────┘  └─────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         Service Core (index.js) - UNCHANGED            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │ │
│  │  │   Express    │  │    Folder    │  │    Spool    │  │ │
│  │  │   Server     │  │   Monitor    │  │   Monitor   │  │ │
│  │  │  :8765       │  │  (Chokidar)  │  │             │  │ │
│  │  └──────────────┘  └──────────────┘  └─────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │      Print Bridge (final-bridge.js) - UNCHANGED        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │ │
│  │  │  Cloud       │  │   Physical   │  │   Printer   │  │ │
│  │  │  Upload      │  │   Printer    │  │  Detection  │  │ │
│  │  │              │  │  Forwarding  │  │             │  │ │
│  │  └──────────────┘  └──────────────┘  └─────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │   USB Thermal Printer       │
              │   (Accessible in Session 1) │
              └─────────────────────────────┘
```


### Session 0 vs Session 1 Comparison

| Aspect | Session 0 (Windows Service) | Session 1 (Tray App) |
|--------|----------------------------|----------------------|
| **Startup Context** | System boot, before user login | User login |
| **Printer Access** | ❌ Blocked by session isolation | ✅ Direct USB access |
| **Startup Timeout** | ⚠️ 30 seconds (Error 1053) | ✅ No timeout limit |
| **User Interaction** | ❌ No UI allowed | ✅ Full UI support |
| **Status Visibility** | ❌ Hidden (Services.msc only) | ✅ Tray icon with colors |
| **Configuration** | ⚠️ Registry/file editing | ✅ GUI interface |
| **Auto-Start** | ✅ Service Control Manager | ✅ Registry Run key |
| **Privileges** | System/LocalService | User account |

## Component Design

### 1. Tray App Wrapper (tray-app.js)

**Purpose**: Provides system tray integration and window management without modifying core service logic.

**Responsibilities**:
- Create and manage system tray icon
- Handle tray icon state (green/yellow/red)
- Manage context menu
- Handle window show/hide/minimize
- Import and start existing service (index.js)
- Handle graceful shutdown
- **First-run configuration check**: Auto-open config page if no valid Bar ID exists
- **Watch folder creation**: Ensure C:\TabezaPrints\ exists on startup

**Technology**: Node.js with `node-systray`

**Key Methods**:
```javascript
class TrayApp {
  constructor()
  createTrayIcon()
  updateTrayIcon(status)  // 'connected', 'error', 'starting'
  createContextMenu()
  showWindow()
  hideWindow()
  startService()
  stopService()
  handleExit()
  ensureWatchFolder()  // Create C:\TabezaPrints\ if missing
  checkFirstRun()      // Open config if no Bar ID
}
```

**State Management**:
```javascript
const AppState = {
  STARTING: 'starting',      // Yellow icon
  CONNECTED: 'connected',    // Green icon
  ERROR: 'error',            // Red icon
  SHUTTING_DOWN: 'shutting_down'
}
```


### 2. Service Core (index.js) - UNCHANGED

**Purpose**: Existing Express server and business logic.

**Preservation Strategy**: Zero modifications to core logic. The tray wrapper imports and starts this module as-is.

**Key Components** (existing):
- Express HTTP server (localhost:8765)
- API endpoints (/api/status, /api/configure, /api/test-print, etc.)
- Configuration management
- Heartbeat service
- Cloud polling for print jobs

**Log Management Enhancement**:
- **Implementation**: Winston with winston-daily-rotate-file
- **Configuration**:
  ```javascript
  const winston = require('winston');
  require('winston-daily-rotate-file');
  
  const transport = new winston.transports.DailyRotateFile({
    filename: 'C:\\ProgramData\\Tabeza\\logs\\tabezaconnect-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '10m',      // 10MB max per file
    maxFiles: '5',       // Keep last 5 files
    zippedArchive: false // Don't compress old logs
  });
  
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [transport]
  });
  ```
- **Behavior**: Automatic rotation when file reaches 10MB or daily, whichever comes first
- **Retention**: Last 5 log files preserved, older files automatically deleted
- **Location**: C:\ProgramData\Tabeza\logs\

**Integration Point**:
```javascript
// In tray-app.js
const service = require('./index.js');
// Service starts automatically when required
```

### 3. Print Bridge (final-bridge.js) - UNCHANGED

**Purpose**: Existing printer forwarding logic with 3-strategy approach.

**Preservation Strategy**: Zero modifications. Already handles Session 1 printing correctly.

**Existing Strategies**:
1. **TCP/IP Direct** (port 9100) - Network printers
2. **USB/COM Direct** - Device file write (bypasses spooler)
3. **Windows Spooler** - WinAPI WritePrinter (fallback)

**Why It Works in Session 1**: The USB/COM direct strategy writes to `\\.\USB001` device files, which are accessible in user sessions.

### 4. Auto-Start Mechanism

**Implementation**: Windows Registry Run key (HKCU - single user only)

**Registry Location**:
```
HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run
```

**Registry Entry**:
```
Name: TabezaConnect
Type: REG_SZ
Value: "C:\Program Files\Tabeza\TabezaConnect\TabezaConnect.exe" --minimized
```

**Behavior**:
- Launches when user logs into Windows
- `--minimized` flag prevents window from showing
- Starts directly in system tray
- No console window displayed

**CRITICAL LIMITATION - User Login Requirement**:
- **POS machines MUST have Windows auto-login configured**
- TabezaConnect only starts after user login (HKCU registry key)
- **If machine reboots without login, TabezaConnect won't start**
- **Physical receipts will still print** (POS is authority, prints directly)
- **Cloud upload will be delayed** until user logs in and TabezaConnect starts
- This is acceptable because physical receipt already exists

**Single-User Account Requirement**:
- HKCU registry = single user account only
- **Install TabezaConnect on the dedicated POS user account**
- If multiple Windows users exist, each needs separate installation
- Recommended: Use single dedicated POS account with auto-login


## Technology Stack

### Core Technologies

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **Tray Icon** | node-systray or Electron | Native Windows tray support |
| **Service Core** | Node.js + Express | Existing, proven implementation |
| **File Monitoring** | Chokidar | Existing, reliable file watcher |
| **Print Bridge** | Node.js + PowerShell | Existing, multi-strategy approach |
| **Compilation** | pkg | Creates standalone .exe |
| **Installer** | Inno Setup | Windows installer with registry support |

### Technology Decision: node-systray (CONFIRMED)

**Selected: node-systray**
- ✅ Lightweight (~5MB compiled vs Electron's 150MB)
- ✅ Fast startup (critical for user experience)
- ✅ Simple API
- ✅ Works with pkg compilation
- ✅ Sufficient for tray icon and basic UI needs

**Rejected: Electron**
- ❌ Large bundle size (~150MB) - unacceptable for a background utility
- ❌ Slower startup - poor user experience
- ❌ Overkill for tray app requirements

**Log Management**: Winston with winston-daily-rotate-file
- Automatic log rotation (10MB max per file)
- Keep last 5 rotated files
- Daily rotation with date-stamped filenames
- Prevents disk space issues from unbounded log growth

## Data Flow

### Receipt Capture Flow

```
POS System
    │
    ▼
Prints to Folder Port (C:\TabezaPrints\receipt.prn)
    │
    ▼
Chokidar File Watcher (in index.js)
    │
    ▼
Receipt Detected Event
    │
    ├─────────────────────┬─────────────────────┐
    ▼                     ▼                     ▼
Cloud Upload      Physical Printer      Local Queue
(HTTPS POST)      (final-bridge.js)     (if offline)
    │                     │                     │
    ▼                     ▼                     ▼
Tabeza API        USB Thermal Printer   Retry Worker
```


### Cloud Upload Flow

```
Receipt Data (Buffer)
    │
    ▼
Base64 Encode
    │
    ▼
Build JSON Payload
{
  barId: "...",
  timestamp: "...",
  receiptData: "base64...",
  source: "tray-app"
}
    │
    ▼
HTTPS POST to ${apiUrl}/api/printer/relay
    │
    ├─────────────┬─────────────┐
    ▼             ▼             ▼
Success       Network Error   Server Error
    │             │             │
    ▼             ▼             ▼
Delete File   Queue Locally   Log Error
              Retry Later     Continue
```

### Physical Printer Forwarding Flow

```
Receipt Data (Buffer)
    │
    ▼
Get Printer Port (PowerShell: Get-Printer)
    │
    ├──────────────┬──────────────┬──────────────┐
    ▼              ▼              ▼              ▼
TCP/IP Port    USB Port       COM Port       Folder Port
192.168.x.x    USB001         COM3           C:\...
    │              │              │              │
    ▼              ▼              ▼              ▼
Strategy 1     Strategy 2     Strategy 2     Resolve USB
TCP Socket     Device File    Device File    via PnP
Port 9100      Write          Write          │
    │              │              │              ▼
    │              │              │          Strategy 2
    │              │              │          Device File
    │              │              │              │
    └──────────────┴──────────────┴──────────────┘
                        │
                        ▼
                Physical Receipt Printed
```

### Configuration Management Flow

```
User Action (Settings Menu)
    │
    ▼
Open Configuration UI
    │
    ▼
User Edits Values
(Bar ID, API URL, Printer, Mode)
    │
    ▼
Validate Input
    │
    ├─────────────┬─────────────┐
    ▼             ▼             ▼
Valid         Invalid       Printer Check
    │             │             │
    ▼             ▼             ▼
Save to       Show Error    Verify Access
config.json   Message       (Get-Printer)
    │                             │
    ▼                             ▼
Restart Express Server        Success/Fail
    │                             │
    ▼                             ▼
Update Tray Icon Status       Save Config
```


## State Management

### Application States

```javascript
const ApplicationState = {
  // Initial state during startup
  STARTING: {
    icon: 'yellow',
    tooltip: 'TabezaConnect starting...',
    canExit: false
  },
  
  // Healthy operational state
  CONNECTED: {
    icon: 'green',
    tooltip: 'TabezaConnect - Connected',
    canExit: true
  },
  
  // Configuration incomplete
  UNCONFIGURED: {
    icon: 'yellow',
    tooltip: 'TabezaConnect - Configuration required',
    canExit: true
  },
  
  // Server running but cloud unreachable
  DISCONNECTED: {
    icon: 'yellow',
    tooltip: 'TabezaConnect - Cloud disconnected',
    canExit: true
  },
  
  // Critical error (port conflict, etc.)
  ERROR: {
    icon: 'red',
    tooltip: 'TabezaConnect - Error',
    canExit: true
  },
  
  // Graceful shutdown in progress
  SHUTTING_DOWN: {
    icon: 'yellow',
    tooltip: 'TabezaConnect - Shutting down...',
    canExit: false
  }
};
```

### State Transitions

```
         ┌─────────────┐
         │  STARTING   │
         └──────┬──────┘
                │
      ┌─────────┼─────────┐
      │         │         │
      ▼         ▼         ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│  ERROR   │ │UNCONFIG  │ │CONNECTED │
└──────────┘ └──────────┘ └────┬─────┘
      │         │               │
      │         │               ▼
      │         │         ┌──────────────┐
      │         │         │DISCONNECTED  │
      │         │         └──────┬───────┘
      │         │                │
      └─────────┴────────────────┘
                │
                ▼
         ┌──────────────┐
         │SHUTTING_DOWN │
         └──────────────┘
                │
                ▼
            [Process Exit]
```

### Tray Icon State Mapping

| Application State | Icon Color | Tooltip Text | Menu Actions |
|------------------|------------|--------------|--------------|
| STARTING | 🟡 Yellow | "Starting..." | Settings (disabled), Exit (disabled) |
| CONNECTED | 🟢 Green | "Connected - Bar: {barId}" | All enabled |
| UNCONFIGURED | 🟡 Yellow | "Configuration required" | Settings, Exit |
| DISCONNECTED | 🟡 Yellow | "Cloud disconnected" | All enabled |
| ERROR | 🔴 Red | "Error: {message}" | Settings, View Logs, Exit |
| SHUTTING_DOWN | 🟡 Yellow | "Shutting down..." | All disabled |


## User Interface

### Tray Icon Design

**Icon States**:
- **Green**: `icon-green.ico` - Connected and operational
- **Yellow**: `icon-yellow.ico` - Starting, warning, or disconnected
- **Red**: `icon-red.ico` - Error state

**Icon Requirements**:
- Format: .ICO (Windows native)
- Sizes: 16x16, 32x32, 48x48 (multi-resolution)
- Style: Simple, recognizable at small sizes
- Design: Tabeza logo with colored background

### Context Menu Structure

```
┌─────────────────────────────────────┐
│ TabezaConnect                       │  (disabled, title)
├─────────────────────────────────────┤
│ Bar: 12345                          │  (disabled, info)
│ ● Connected                         │  (disabled, status)
├─────────────────────────────────────┤
│ Open Configuration                  │  → http://localhost:8765/configure.html
│ Open Staff Dashboard                │  → {apiUrl}
├─────────────────────────────────────┤
│ Test Print                          │  → Send test receipt
│ View Logs                           │  → Open log file
├─────────────────────────────────────┤
│ Restart Service                     │  → Kill and restart
│ About                               │  → Show version info
├─────────────────────────────────────┤
│ Exit                                │  → Graceful shutdown
└─────────────────────────────────────┘
```

### Main Window Layout (Optional)

**Purpose**: Detailed status display when user clicks tray icon

**Layout**:
```
┌────────────────────────────────────────────┐
│  TabezaConnect Status                  [_][□][X]
├────────────────────────────────────────────┤
│                                            │
│  Status: ● Connected                       │
│  Bar ID: 12345                             │
│  API URL: https://tabeza.co.ke             │
│  Driver ID: driver-DESKTOP-ABC123          │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │ Service Information                  │ │
│  │                                      │ │
│  │ Port: 8765                           │ │
│  │ Capture Mode: spooler                │ │
│  │ Watch Folder: C:\TabezaPrints\       │ │
│  │ Physical Printer: EPSON TM-T20       │ │
│  │                                      │ │
│  │ Last Activity: 2 minutes ago         │ │
│  │ Receipts Processed: 47               │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  [Open Configuration]  [Test Print]  [OK] │
│                                            │
└────────────────────────────────────────────┘
```

**Window Behavior**:
- Opens on single-click of tray icon
- Minimize button → Hide to tray
- Close button (X) → Hide to tray
- Always on top: No
- Resizable: No
- Size: 500x400px


### Notification Design

**Windows Toast Notifications**:

```javascript
// Startup notification
{
  title: 'TabezaConnect',
  message: 'Service started successfully',
  icon: 'icon-green.ico',
  sound: false
}

// Configuration required
{
  title: 'TabezaConnect',
  message: 'Configuration required. Click to set up.',
  icon: 'icon-yellow.ico',
  sound: true,
  onClick: () => openConfiguration()
}

// Test print success
{
  title: 'Test Print',
  message: 'Test receipt sent successfully',
  icon: 'icon-green.ico',
  sound: false
}

// Error notification
{
  title: 'TabezaConnect Error',
  message: 'Port 8765 is already in use',
  icon: 'icon-red.ico',
  sound: true,
  onClick: () => showErrorDetails()
}
```

**Notification Rate Limiting**:
- Maximum 1 notification per minute
- Queue notifications if rate exceeded
- Priority: Error > Warning > Info

## Installation & Deployment

### Code Signing Considerations

**Windows Defender/SmartScreen Protection**:
- Unsigned .exe files trigger Windows SmartScreen warnings
- Users see "Windows protected your PC" message
- **Production requirement**: Code signing certificate (~$300-500/year)
- Certificate providers: DigiCert, Sectigo, GlobalSign
- Signing process adds trusted publisher identity to executable

**Workaround for Unsigned Builds** (development/testing):
```
User sees: "Windows protected your PC"
Instructions:
1. Click "More info"
2. Click "Run anyway"
3. Proceed with installation

Note: This is normal for unsigned software and safe for TabezaConnect.
```

**TODO**: Acquire code signing certificate before production release

### Installer Flow (Inno Setup)

```
┌─────────────────────────────────────────┐
│ 1. Welcome Screen                       │
│    - Product name and version           │
│    - Brief description                  │
├─────────────────────────────────────────┤
│ 2. License Agreement                    │
│    - Standard EULA                      │
├─────────────────────────────────────────┤
│ 3. Installation Type                    │
│    ☑ Create desktop shortcut (optional)│
│    ☑ Start on Windows login (default)  │
├─────────────────────────────────────────┤
│ 4. Detect Old Installation              │
│    IF Windows Service detected:        │
│    - Stop service                       │
│    - Uninstall service                  │
│    - Preserve config.json               │
├─────────────────────────────────────────┤
│ 5. Copy Files                           │
│    → C:\Program Files\Tabeza\           │
│      TabezaConnect\                     │
│      ├── TabezaConnect.exe              │
│      ├── node_modules\                  │
│      ├── src\                           │
│      └── assets\                        │
├─────────────────────────────────────────┤
│ 6. Create Registry Entry                │
│    HKCU\...\Run\TabezaConnect           │
│    = "...\TabezaConnect.exe --minimized"│
├─────────────────────────────────────────┤
│ 7. Create Desktop Shortcut (optional)   │
│    → Desktop\TabezaConnect.lnk          │
├─────────────────────────────────────────┤
│ 8. Launch Application                   │
│    Start TabezaConnect.exe --minimized  │
├─────────────────────────────────────────┤
│ 9. Completion                           │
│    - Show success message               │
│    - "TabezaConnect is now running"     │
│    - "Look for icon in system tray"     │
└─────────────────────────────────────────┘
```

### Uninstall Behavior

**What Gets Removed**:
- All files in C:\Program Files\Tabeza\TabezaConnect\
- Registry entry: HKCU\Software\Microsoft\Windows\CurrentVersion\Run\TabezaConnect
- Desktop shortcut (if created)
- Start Menu entries

**What Gets Preserved**:
- Configuration: C:\ProgramData\Tabeza\config.json (preserved for reinstall)
- Logs: C:\ProgramData\Tabeza\logs\ (preserved for troubleshooting)
- Watch folder: C:\TabezaPrints\ (may contain POS receipts)

**Rationale**: Preserving config and logs allows seamless reinstallation and post-uninstall troubleshooting.


### File Structure in Program Files

```
C:\Program Files\Tabeza\TabezaConnect\
├── TabezaConnect.exe           # Main executable (pkg compiled)
├── package.json                # Package metadata
├── node_modules\               # Dependencies (if not bundled)
├── src\
│   ├── service\
│   │   ├── index.js           # Service core (UNCHANGED)
│   │   ├── final-bridge.js    # Print bridge (UNCHANGED)
│   │   ├── spoolMonitor.js    # Spool monitoring
│   │   ├── localQueue.js      # Offline queue
│   │   ├── uploadWorker.js    # Upload retry logic
│   │   └── public\            # Web UI files
│   └── tray\
│       ├── tray-app.js        # NEW: Tray wrapper
│       └── main.js            # NEW: Entry point
├── assets\
│   ├── icon.ico               # Base icon
│   ├── icon-green.ico         # Connected state
│   ├── icon-yellow.ico        # Warning state
│   └── icon-red.ico           # Error state
└── README.txt                 # Quick start guide
```

### Registry Entry Format

**Auto-Start Entry**:
```ini
[HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run]
"TabezaConnect"="\"C:\\Program Files\\Tabeza\\TabezaConnect\\TabezaConnect.exe\" --minimized"
```

**Uninstaller Entry**:
```ini
[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\TabezaConnect]
"DisplayName"="TabezaConnect"
"DisplayVersion"="2.0.0"
"Publisher"="Tabeza"
"UninstallString"="\"C:\\Program Files\\Tabeza\\TabezaConnect\\unins000.exe\""
"DisplayIcon"="C:\\Program Files\\Tabeza\\TabezaConnect\\assets\\icon.ico"
```

### Upgrade Path from Service to Tray App

**Detection Logic** (in Inno Setup):
```pascal
function IsServiceInstalled(): Boolean;
var
  ResultCode: Integer;
begin
  // Check if service exists
  Exec('sc', 'query TabezaConnect', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := (ResultCode = 0);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigPath: String;
begin
  if CurStep = ssInstall then
  begin
    if IsServiceInstalled() then
    begin
      // 1. Backup config.json
      ConfigPath := ExpandConstant('{commonappdata}\Tabeza\config.json');
      if FileExists(ConfigPath) then
        FileCopy(ConfigPath, ConfigPath + '.backup', False);
      
      // 2. Stop service
      Exec('sc', 'stop TabezaConnect', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Sleep(2000);
      
      // 3. Delete service
      Exec('sc', 'delete TabezaConnect', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      
      // 4. Restore config.json (will be read by tray app)
      // Config stays in same location - no move needed
    end;
  end;
end;
```


## Error Handling

### Port Conflict Detection

**Problem**: Port 8765 already in use (another instance running)

**Detection**:
```javascript
const net = require('net');

function checkPort(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err) => {
        resolve(err.code === 'EADDRINUSE' ? false : true);
      })
      .once('listening', () => {
        tester.close();
        resolve(true);
      })
      .listen(port);
  });
}
```

**Handling**:
1. Show error notification: "Port 8765 is already in use"
2. Update tray icon to red
3. Display resolution steps in tooltip
4. Provide "Kill Port" option in context menu
5. Log error to file

**User Actions**:
- Run `kill-port-8765.bat` (provided)
- Restart computer
- Check Task Manager for TabezaConnect.exe

### Printer Access Errors

**Problem**: USB printer not accessible

**Detection**:
```javascript
// In final-bridge.js (existing)
try {
  const printers = execSync('powershell Get-Printer', { encoding: 'utf8' });
  // Parse and validate
} catch (error) {
  // Printer access failed
}
```

**Handling**:
1. Log error with details
2. Continue cloud upload (don't block)
3. Show warning notification (rate-limited)
4. Update status in main window
5. Suggest printer troubleshooting

**Recovery**:
- Auto-retry printer detection every 30 seconds
- User can manually trigger "Refresh Printers"
- Provide printer setup guide link


### Cloud Connectivity Errors

**Problem**: Cannot reach Tabeza API

**Detection**:
```javascript
// In index.js (existing heartbeat)
async function sendHeartbeat() {
  try {
    const response = await fetch(`${config.apiUrl}/api/printer/heartbeat`, {
      method: 'POST',
      body: JSON.stringify({ barId, driverId })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    // Success - update state
    updateTrayIcon('connected');
  } catch (error) {
    // Failed - update state
    updateTrayIcon('disconnected');
    // Queue receipts locally
  }
}
```

**Handling**:
1. Switch to offline mode
2. Queue receipts in local storage
3. Update tray icon to yellow
4. Retry connection every 30 seconds
5. Show warning after 5 minutes

**Recovery**:
- Auto-reconnect when network available
- Upload queued receipts on reconnection
- Show success notification when restored

### Configuration Errors

**Problem**: config.json missing or invalid

**Detection**:
```javascript
function loadConfig() {
  try {
    const data = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(data);
    
    // Validate required fields
    if (!config.barId || !config.apiUrl) {
      throw new Error('Missing required fields');
    }
    
    return config;
  } catch (error) {
    return null; // Invalid config
  }
}
```

**Handling**:
1. Start in UNCONFIGURED state
2. Show yellow tray icon
3. Display notification: "Configuration required"
4. **Auto-open configuration page** (http://localhost:8765/configure.html)
5. Disable features until configured

**First-Run Behavior**:
- On first launch with no valid Bar ID, automatically open config page in default browser
- Prevents silent misconfiguration where app runs but doesn't work
- User immediately sees what needs to be configured

**User Actions**:
- Enter Bar ID and API URL
- Save configuration
- Service restarts automatically


## Implementation Strategy

### Phase 1: Tray Wrapper Development

**Goal**: Create minimal tray wrapper that starts existing service

**Tasks**:
1. Create `src/tray/tray-app.js` with basic tray icon
2. Import and start `src/service/index.js`
3. Implement state management (STARTING → CONNECTED → ERROR)
4. Add context menu with basic options
5. Handle graceful shutdown

**Success Criteria**:
- Tray icon appears in system tray
- Service starts and runs normally
- Context menu shows and responds
- Exit cleanly shuts down service

**Code Changes**: NEW files only, zero modifications to existing service

### Phase 2: Window Management

**Goal**: Add optional status window

**Tasks**:
1. Create status window HTML/UI
2. Implement show/hide on tray click
3. Handle minimize → hide to tray
4. Handle close (X) → hide to tray
5. Display service status information

**Success Criteria**:
- Window shows on tray click
- Minimize hides to tray (no taskbar)
- Close button hides to tray
- Status information updates in real-time

**Code Changes**: NEW window management code only

### Phase 3: Auto-Start Integration

**Goal**: Launch automatically on user login

**Tasks**:
1. Add `--minimized` command-line flag
2. Implement startup detection
3. Skip window display when minimized
4. Update installer to create registry entry
5. Test auto-start behavior

**Success Criteria**:
- Launches on Windows login
- Starts minimized to tray
- No console window visible
- No splash screen shown

**Code Changes**: Command-line parsing, installer script


### Phase 4: Installer Conversion

**Goal**: Convert from service installer to tray app installer

**Tasks**:
1. Remove service registration code
2. Add registry Run key creation
3. Implement service detection and removal
4. Preserve config.json during upgrade
5. Add desktop shortcut option
6. Launch app after installation

**Success Criteria**:
- Installer detects old service version
- Old service cleanly removed
- Config preserved during upgrade
- Registry entry created correctly
- App launches after install

**Code Changes**: Inno Setup script modifications

### Phase 5: Testing & Validation

**Goal**: Comprehensive testing of all scenarios

**Test Scenarios**:
1. Fresh installation (no prior version)
2. Upgrade from service version
3. Auto-start on login
4. Port conflict handling
5. Printer access in Session 1
6. Configuration changes
7. Graceful shutdown
8. Error recovery

**Success Criteria**:
- All test scenarios pass
- No regressions in core functionality
- Session 1 printer access works
- Error handling robust

### Minimal Code Changes Approach

**Principle**: Wrapper pattern - add functionality without modifying core

**What Changes**:
- ✅ NEW: `src/tray/tray-app.js` (tray wrapper)
- ✅ NEW: `src/tray/main.js` (entry point)
- ✅ NEW: `assets/icon-*.ico` (tray icons)
- ✅ MODIFIED: `installer-pkg.iss` (Inno Setup script)
- ✅ MODIFIED: `package.json` (entry point, scripts)

**What Stays Unchanged**:
- ❌ NO CHANGE: `src/service/index.js` (service core)
- ❌ NO CHANGE: `src/service/final-bridge.js` (print bridge)
- ❌ NO CHANGE: `src/service/spoolMonitor.js` (monitoring)
- ❌ NO CHANGE: `src/service/localQueue.js` (queue)
- ❌ NO CHANGE: `src/service/uploadWorker.js` (upload)
- ❌ NO CHANGE: All Express routes and API endpoints
- ❌ NO CHANGE: Configuration file format
- ❌ NO CHANGE: Receipt processing logic

**Integration Pattern**:
```javascript
// src/tray/main.js (NEW)
const TrayApp = require('./tray-app');
const service = require('../service/index'); // Starts automatically

const app = new TrayApp();
app.start();

// Service runs in background, tray provides UI
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: API Endpoint Preservation

*For any* API endpoint that existed in the Windows Service version, calling that endpoint in the tray app version should return responses with the same structure and behavior.

**Validates: Requirements 1.1, 1.8, 12.2**

### Property 2: Receipt Processing Consistency

*For any* receipt file detected in the watch folder, the tray app should process it identically to the service version (upload to cloud AND forward to printer).

**Validates: Requirements 1.2, 1.4, 1.5**

### Property 3: Configuration Format Compatibility

*For any* valid config.json file from the service version, the tray app should load and parse it correctly without errors (round-trip compatibility).

**Validates: Requirements 1.6, 7.6, 12.1**

### Property 4: Printer Forwarding Preservation

*For any* receipt data, forwarding to a physical printer should use the existing final-bridge.js logic without modification.

**Validates: Requirements 1.3, 14.2**

### Property 5: Session 1 Printer Access

*For any* USB thermal printer connected to the system, the tray app running in Session 1 should successfully detect and print to it without "local comm error".

**Validates: Requirements 5.2, 5.3, 5.4**

### Property 6: Tray Icon State Consistency

*For any* application state change (starting, connected, error, disconnected), the tray icon should update immediately to reflect the new state with the correct color.

**Validates: Requirements 6.4**

### Property 7: Tooltip Status Accuracy

*For any* application state, the tray icon tooltip should display text that accurately describes the current state.

**Validates: Requirements 6.5**

### Property 8: Configuration Persistence

*For any* configuration change saved through the UI, the config.json file should be updated with the new values and the Express server should restart with those settings.

**Validates: Requirements 7.4, 7.5**

### Property 9: Configuration Validation

*For any* invalid configuration value (empty Bar ID, malformed URL, inaccessible printer), the system should reject the save and display an appropriate error message.

**Validates: Requirements 7.7**


### Property 10: Offline Queue Behavior

*For any* receipt detected when cloud connectivity is lost, the system should queue it locally and upload it when connectivity is restored.

**Validates: Requirements 11.2, 11.3**

### Property 11: Error Isolation

*For any* print job where the physical printer is unavailable, the cloud upload should continue successfully (printer errors don't block cloud).

**Validates: Requirements 11.4**

### Property 12: Monitor Auto-Recovery

*For any* folder monitor error, the system should automatically restart the monitor without user intervention.

**Validates: Requirements 11.7**

### Property 13: Path Compatibility

*For any* file path used by the service version (watch folder, config location, log location), the tray app should use the identical path.

**Validates: Requirements 12.3**

### Property 14: POS Configuration Compatibility

*For any* existing POS configuration that prints to C:\TabezaPrints\, the tray app should capture and process those receipts identically to the service version.

**Validates: Requirements 12.6**

### Property 15: Command-Line Argument Support

*For any* command-line argument supported by the service version, passing it to the tray app should produce the same behavior.

**Validates: Requirements 12.7**

### Property 16: Notification Rate Limiting

*For any* sequence of events that trigger notifications, the system should display at most one notification per minute.

**Validates: Requirements 13.7**

### Property 17: Core Logic Preservation

*For any* core service file (index.js, final-bridge.js, spoolMonitor.js), comparing the file before and after tray conversion should show zero modifications.

**Validates: Requirements 14.1, 14.2, 14.3, 14.7**

### Property 18: Printer Selection Validation

*For any* printer selected by the user in configuration, the system should verify the printer is accessible via Get-Printer before saving the configuration.

**Validates: Requirements 5.6**


## Error Handling Strategy

### Error Categories

**1. Startup Errors** (Critical - prevent launch)
- Port 8765 already in use
- Missing required dependencies
- Corrupted executable

**2. Configuration Errors** (Warning - allow launch with limited functionality)
- Missing config.json
- Invalid Bar ID format
- Missing API URL

**3. Runtime Errors** (Recoverable - log and continue)
- Cloud connectivity lost
- Printer temporarily unavailable
- File system errors

**4. User Errors** (Validation - prevent with UI)
- Invalid configuration input
- Selecting non-existent printer
- Malformed API URL

### Error Recovery Strategies

| Error Type | Detection | Recovery | User Notification |
|------------|-----------|----------|-------------------|
| Port Conflict | Server start fails | Show error, provide kill-port script | Toast + Red icon |
| Cloud Offline | Heartbeat fails | Queue locally, retry every 30s | Toast after 5min |
| Printer Unavailable | Print fails | Log error, continue cloud upload | Warning in status |
| Config Missing | File not found | Show setup wizard | Toast + Yellow icon |
| Invalid Config | Parse error | Use defaults, prompt user | Toast + Yellow icon |
| Monitor Crash | Exception caught | Restart monitor automatically | Log only |

## Testing Strategy

### Unit Testing

**Focus**: Individual components in isolation

**Framework**: Jest

**Test Coverage**:
- Tray icon state management
- Configuration validation logic
- Error handling functions
- State transition logic
- Notification rate limiting
- Watch folder creation on startup
- First-run configuration detection

**Example Tests**:
```javascript
describe('TrayApp State Management', () => {
  test('should transition from STARTING to CONNECTED on successful server start', () => {
    const app = new TrayApp();
    app.setState('STARTING');
    app.onServerReady();
    expect(app.state).toBe('CONNECTED');
    expect(app.iconColor).toBe('green');
  });
  
  test('should transition to ERROR on port conflict', () => {
    const app = new TrayApp();
    app.onServerError({ code: 'EADDRINUSE' });
    expect(app.state).toBe('ERROR');
    expect(app.iconColor).toBe('red');
  });
  
  test('should create watch folder on startup if missing', () => {
    const app = new TrayApp();
    app.ensureWatchFolder();
    expect(fs.existsSync('C:\\TabezaPrints\\')).toBe(true);
  });
  
  test('should auto-open config page on first run with no Bar ID', () => {
    const app = new TrayApp();
    const openBrowserSpy = jest.spyOn(app, 'openBrowser');
    app.checkFirstRun(); // No config.json or empty barId
    expect(openBrowserSpy).toHaveBeenCalledWith('http://localhost:8765/configure.html');
  });
});
```


### Property-Based Testing

**Focus**: Universal properties across all inputs

**Framework**: fast-check

**Configuration**: Minimum 100 iterations per test

**Test Coverage**:
- API endpoint compatibility
- Configuration round-trip
- Receipt processing consistency
- Error recovery behavior

**Example Tests**:
```javascript
const fc = require('fast-check');

describe('Configuration Round-Trip Property', () => {
  test('any valid config should load and save identically', () => {
    // Feature: tray-app-conversion, Property 3: Configuration format compatibility
    fc.assert(
      fc.property(
        fc.record({
          barId: fc.string({ minLength: 5 }),
          apiUrl: fc.webUrl(),
          watchFolder: fc.string(),
          captureMode: fc.constantFrom('folder', 'spooler')
        }),
        (config) => {
          // Save config
          saveConfig(config);
          
          // Load config
          const loaded = loadConfig();
          
          // Should be identical
          expect(loaded).toEqual(config);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('API Endpoint Preservation Property', () => {
  test('all service endpoints should work identically in tray app', () => {
    // Feature: tray-app-conversion, Property 1: API endpoint preservation
    const endpoints = [
      '/api/status',
      '/api/configure',
      '/api/test-print',
      '/api/printers/list',
      '/api/diagnostics'
    ];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...endpoints),
        async (endpoint) => {
          // Call endpoint
          const response = await fetch(`http://localhost:8765${endpoint}`);
          
          // Should return valid response
          expect(response.ok).toBe(true);
          
          // Should return JSON
          const data = await response.json();
          expect(data).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Printer Access Property', () => {
  test('any USB printer should be accessible in Session 1', () => {
    // Feature: tray-app-conversion, Property 5: Session 1 printer access
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }), // Receipt data
        async (receiptData) => {
          // Get available printers
          const printers = await listPrinters();
          
          if (printers.length === 0) return true; // Skip if no printers
          
          // Try to print to first USB printer
          const usbPrinter = printers.find(p => p.port.startsWith('USB'));
          if (!usbPrinter) return true; // Skip if no USB printer
          
          // Should not throw "local comm error"
          const result = await printToPrinter(usbPrinter.name, receiptData);
          expect(result.error).not.toContain('local comm');
        }
      ),
      { numRuns: 100 }
    );
  });
});
```


### Integration Testing

**Focus**: Component interaction and end-to-end flows

**Test Scenarios**:

1. **Fresh Installation Flow**
   - Install tray app on clean system
   - Verify registry entry created
   - Verify files copied correctly
   - Launch app and verify tray icon appears
   - Configure Bar ID and verify service starts

2. **Upgrade from Service Flow**
   - Install service version
   - Configure with test Bar ID
   - Install tray app version
   - Verify service removed
   - Verify config preserved
   - Verify tray app uses preserved config

3. **Auto-Start Flow**
   - Install tray app
   - Restart Windows
   - Log in as user
   - Verify app launches automatically
   - Verify starts minimized to tray
   - Verify no console window

4. **Receipt Processing Flow**
   - Start tray app
   - Drop receipt file in watch folder
   - Verify cloud upload occurs
   - Verify physical print occurs
   - Verify file deleted after processing

5. **Error Recovery Flow**
   - Start tray app
   - Disconnect network
   - Drop receipt file
   - Verify queued locally
   - Reconnect network
   - Verify queued receipt uploaded

6. **Printer Access Flow**
   - Start tray app in Session 1
   - Connect USB thermal printer
   - Send test print
   - Verify print succeeds without "local comm error"

### Manual Testing Checklist

**UI/UX Testing**:
- [ ] Tray icon appears in correct location
- [ ] Icon colors match states (green/yellow/red)
- [ ] Tooltip shows correct status text
- [ ] Context menu displays all options
- [ ] Context menu items respond correctly
- [ ] Main window opens on tray click
- [ ] Minimize hides to tray (no taskbar)
- [ ] Close (X) hides to tray
- [ ] Exit completely terminates app

**Functionality Testing**:
- [ ] Service starts on app launch
- [ ] API endpoints respond correctly
- [ ] Configuration UI opens and saves
- [ ] Test print sends to cloud and printer
- [ ] Logs open in text editor
- [ ] About dialog displays version info
- [ ] Restart service works correctly
- [ ] Watch folder (C:\TabezaPrints\) created on first run
- [ ] Config page auto-opens when no Bar ID configured

**Error Handling Testing**:
- [ ] Port conflict shows error notification
- [ ] Missing config prompts setup
- [ ] Invalid config shows validation errors
- [ ] Cloud offline queues receipts
- [ ] Printer unavailable continues cloud upload
- [ ] Network restored uploads queued receipts

**Installation Testing**:
- [ ] Fresh install completes successfully
- [ ] Upgrade from service preserves config
- [ ] Desktop shortcut created (if selected)
- [ ] Registry entry created correctly
- [ ] App launches after install
- [ ] Uninstall removes all files and registry entries
- [ ] Uninstall preserves config.json and logs

**Windows Defender Testing** (2-day buffer):
- [ ] Test unsigned .exe on Windows 10 with Defender enabled
- [ ] Test unsigned .exe on Windows 11 with Defender enabled
- [ ] Verify SmartScreen warning appears and can be bypassed
- [ ] Test with various Defender sensitivity levels
- [ ] Document any false positive detections
- [ ] Test installer execution with Defender active
- [ ] Verify app runs normally after Defender scan


## Security Considerations

### Privilege Requirements

**Installation**: Requires Administrator privileges
- Write to Program Files directory
- Create registry entries in HKLM (uninstaller)
- Optionally create startup entry in HKCU

**Normal Operation**: Runs as current user (no elevation needed)
- Reads/writes to user-accessible folders
- Accesses USB printers in user session
- Creates registry entries in HKCU only

### Data Protection

**Configuration File** (config.json):
- Location: `C:\ProgramData\Tabeza\config.json`
- Permissions: User read/write
- Contains: Bar ID, API URL, printer settings
- No sensitive credentials stored

**Log Files**:
- Location: `C:\ProgramData\Tabeza\logs\`
- Permissions: User read/write
- Rotation: 10MB max, keep 5 files
- Contains: Operational logs, no PII

**Network Communication**:
- HTTPS only for cloud API
- Certificate validation enabled
- No credentials in transit (Bar ID is identifier, not secret)

### Attack Surface Reduction

**Compared to Windows Service**:
- ✅ Runs as user (not SYSTEM) - reduced privilege
- ✅ No network listening except localhost:8765
- ✅ No remote management interface
- ✅ User can see and control via tray icon

**Localhost API**:
- Bound to 127.0.0.1 only (not 0.0.0.0)
- No authentication required (localhost-only)
- CORS enabled for local web UI
- No sensitive operations exposed

## Performance Considerations

### Startup Performance

**Target**: < 5 seconds from launch to tray icon visible

**Optimization Strategy**:
1. Load tray icon immediately (< 500ms)
2. Start Express server asynchronously
3. Defer printer detection to background
4. Show yellow icon during initialization
5. Switch to green when ready

**Measurement**:
```javascript
const startTime = Date.now();

// Tray icon creation
createTrayIcon(); // Target: < 500ms
console.log(`Tray ready: ${Date.now() - startTime}ms`);

// Service start
startService(); // Target: < 3000ms
console.log(`Service ready: ${Date.now() - startTime}ms`);

// Total startup
console.log(`Total startup: ${Date.now() - startTime}ms`);
```


### Memory Usage

**Target**: < 100MB RAM usage during normal operation

**Components**:
- Node.js runtime: ~30MB
- Express server: ~20MB
- Chokidar file watcher: ~10MB
- Electron/Tray framework: ~30MB
- Application code: ~10MB

**Monitoring**:
```javascript
setInterval(() => {
  const usage = process.memoryUsage();
  console.log(`Memory: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
}, 60000); // Log every minute
```

### CPU Usage

**Target**: < 1% CPU during idle, < 5% during receipt processing

**Optimization**:
- Use event-driven architecture (no polling loops)
- Debounce file system events (1500ms stability threshold)
- Async I/O for all file operations
- Background printer detection (don't block main thread)

### Disk I/O

**Read Operations**:
- Config file: On startup and configuration changes only
- Receipt files: As detected by file watcher
- Log files: Append-only, buffered writes

**Write Operations**:
- Log files: Buffered, flush every 5 seconds
- Config file: Only on user save
- Queue files: On network failure only

**Optimization**:
- Use streams for large files
- Batch log writes
- Delete processed receipts immediately

## Deployment Strategy

### Build Process

**Step 1: Compile with pkg**
```bash
# Install pkg globally
npm install -g pkg

# Build for Windows x64
pkg package.json --targets node18-win-x64 --output dist/TabezaConnect.exe

# Result: Single executable with Node.js embedded
```

**Step 2: Prepare Assets**
```bash
# Copy required files
cp -r assets dist/
cp -r src/service/public dist/
cp README.txt dist/

# Create version file
echo "2.0.0" > dist/VERSION
```

**Step 3: Build Installer**
```bash
# Compile Inno Setup script
iscc installer-pkg-v2.0.0.iss

# Result: TabezaConnect-Setup-v2.0.0.exe
```


### Release Checklist

**Pre-Release**:
- [ ] All unit tests passing
- [ ] All property tests passing (100 iterations each)
- [ ] Integration tests completed
- [ ] Manual testing checklist completed
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Documentation updated

**Build**:
- [ ] Version number updated in package.json
- [ ] Changelog updated
- [ ] Build executable with pkg
- [ ] Test executable on clean Windows 10 VM
- [ ] Test executable on clean Windows 11 VM
- [ ] Build installer with Inno Setup
- [ ] Test installer on clean VM

**Testing**:
- [ ] Fresh install test
- [ ] Upgrade from service v1.6.2 test
- [ ] Auto-start test (restart Windows)
- [ ] Port conflict test
- [ ] Printer access test (USB thermal printer)
- [ ] Configuration change test
- [ ] Error recovery test
- [ ] Uninstall test (verify cleanup)

**Distribution**:
- [ ] Upload installer to distribution server
- [ ] Update download links on tabeza.co.ke
- [ ] Create release notes
- [ ] Notify existing users via email
- [ ] Update documentation site

### Rollback Plan

**If Critical Issues Found**:

1. **Immediate**: Remove download link for v2.0.0
2. **Restore**: Re-enable v1.6.2 service installer download
3. **Communicate**: Email users about temporary rollback
4. **Fix**: Address critical issues in v2.0.1
5. **Re-test**: Complete full testing cycle
6. **Re-release**: Deploy v2.0.1 when stable

**User Rollback Instructions**:
```
1. Uninstall TabezaConnect v2.0.0
2. Download TabezaConnect v1.6.2 service installer
3. Install v1.6.2
4. Your configuration will be preserved
5. Service will resume normal operation
```

## Migration Guide for Users

### CRITICAL: User Login Requirement for POS Machines

**⚠️ IMPORTANT - READ BEFORE INSTALLATION**

TabezaConnect runs as a tray application that starts when a user logs into Windows. This has important implications for POS machines:

**What This Means**:
- TabezaConnect only starts AFTER user login (not at system boot)
- If your POS machine reboots without auto-login, TabezaConnect won't start
- **Physical receipts will ALWAYS print normally** (POS prints directly to printer)
- Cloud upload will be delayed until someone logs in and TabezaConnect starts

**Why Physical Receipts Still Work**:
- Your POS system is the authority - it prints directly to the thermal printer
- TabezaConnect is a passive bridge that captures and uploads receipts
- Even if TabezaConnect is not running, your POS continues operating normally
- The physical receipt already exists; digital delivery is a convenience enhancement

**Required Setup for POS Machines**:
1. **Configure Windows Auto-Login** (CRITICAL):
   - Settings → Accounts → Sign-in options
   - Disable "Require sign-in" after restart
   - Or use `netplwiz` to configure automatic login
2. **Use a dedicated POS user account** (single account only)
3. **Install TabezaConnect on that dedicated account**
4. **Test auto-login** by restarting the machine

**Windows Fast Startup Troubleshooting**:
- If TabezaConnect doesn't start after reboot, Windows Fast Startup may be interfering
- Disable Fast Startup: Control Panel → Power Options → Choose what power buttons do → Uncheck "Turn on fast startup"
- This ensures clean user session initialization on every boot

**Single-User Account Limitation**:
- TabezaConnect uses HKCU registry (per-user settings)
- If multiple Windows users exist, each needs separate installation
- **Recommended**: Use single dedicated POS account for simplicity

### For New Installations

**Installation Steps**:
1. Download `TabezaConnect-Setup-v2.0.0.exe`
2. Run installer (requires Administrator)
3. Follow installation wizard
4. Check "Start on Windows login" (recommended)
5. Click Install
6. App launches automatically in system tray
7. Right-click tray icon → Open Configuration
8. Enter your Bar ID from Tabeza Settings
9. Click Save
10. Test print to verify setup

**Expected Behavior**:
- Green tray icon = Connected and working
- Yellow tray icon = Starting or configuration needed
- Red tray icon = Error (check logs)


### For Existing Service Users (Upgrade)

**Automatic Migration**:
The installer automatically handles migration from service to tray app.

**What Happens During Upgrade**:
1. Installer detects existing service installation
2. Service is stopped gracefully
3. Service is uninstalled from Windows
4. Your config.json is preserved (Bar ID, settings)
5. New tray app files are installed
6. Registry startup entry is created
7. Tray app launches automatically
8. Your configuration is loaded automatically

**Post-Upgrade Verification**:
1. Look for tray icon in system tray (bottom-right)
2. Icon should be green (connected)
3. Right-click icon → Open Configuration
4. Verify your Bar ID is still configured
5. Send a test print to verify functionality

**If Something Goes Wrong**:
1. Check tray icon color:
   - Red = Error (right-click → View Logs)
   - Yellow = Starting or disconnected
2. Right-click icon → View Logs for details
3. Try "Restart Service" from context menu
4. If still failing, contact support with log file

**Key Differences from Service Version**:
- ✅ Visible tray icon (was hidden before)
- ✅ Easy configuration via GUI (was registry editing)
- ✅ Visual status feedback (was invisible)
- ✅ Reliable USB printer access (was problematic)
- ⚠️ **Requires user login to start** (service started at boot)
- ⚠️ **Single user account only** (HKCU registry limitation)
- ✅ **Physical receipts always print** (POS is authority, TabezaConnect is bridge)

### Troubleshooting Guide

**Problem: Tray icon not visible**
- Check if app is running (Task Manager → TabezaConnect.exe)
- If not running, launch from Start Menu or Desktop shortcut
- If running but no icon, restart the app

**Problem: App doesn't start after reboot**
- **Most common cause**: User not logged in automatically
- Solution: Configure Windows auto-login (see User Login Requirement section above)
- Check registry entry exists:
  - Run `regedit`
  - Navigate to `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
  - Verify "TabezaConnect" entry exists
- If Windows Fast Startup is enabled, try disabling it (see Migration Guide)
- If missing, reinstall or manually create entry

**Problem: Red tray icon (error state)**
- Right-click icon → View Logs
- Common causes:
  - Port 8765 in use (run kill-port-8765.bat)
  - Invalid configuration (reconfigure Bar ID)
  - Network connectivity issues

**Problem: Yellow tray icon (warning state)**
- Check tooltip for specific message
- Common causes:
  - Cloud disconnected (check internet)
  - Configuration incomplete (enter Bar ID)
  - Printer not detected (check USB connection)

**Problem: Receipts not printing to physical printer**
- **Remember**: Physical receipts should print directly from POS even if TabezaConnect has issues
- If POS prints but TabezaConnect doesn't forward:
  - Verify printer is connected and powered on
  - Right-click icon → Open Configuration
  - Check physical printer selection
  - Try "Test Print" from context menu
  - Check printer appears in Windows (Settings → Printers)

**Problem: Port 8765 already in use**
- Another instance may be running
- Run `kill-port-8765.bat` (in installation folder)
- Or restart computer
- Then launch TabezaConnect again

## Future Enhancements (Out of Scope)

**Not Included in v2.0.0**:
- Multi-language support
- Custom tray icon colors/themes
- Advanced logging filters in UI
- Real-time receipt preview in window
- Multiple Bar ID support (multi-venue)
- Cloud-based configuration sync
- Automatic updates mechanism
- Detailed statistics dashboard

**Potential v2.1.0 Features**:
- In-app update notifications
- Enhanced error diagnostics
- Receipt history viewer
- Printer status monitoring
- Network diagnostics tool

## Conclusion

This design converts TabezaConnect from a Windows Service to a System Tray Application using a minimal-change wrapper pattern. The conversion resolves critical Session 0 isolation issues while preserving 100% of the existing service logic.

**Key Benefits**:
- ✅ Reliable USB printer access (Session 1)
- ✅ Visual status feedback (tray icon)
- ✅ User-friendly configuration (GUI)
- ✅ No service timeout issues (Error 1053)
- ✅ Minimal code changes (wrapper pattern)
- ✅ Backward compatible (config format preserved)

**Success Criteria**:
- All existing functionality preserved
- USB printer access works reliably
- User can see and control the application
- Smooth upgrade path from service version
- No regressions in core receipt processing

**Implementation Timeline**:
- Phase 1 (Tray Wrapper): 2-3 days
- Phase 2 (Window Management): 1-2 days
- Phase 3 (Auto-Start): 1 day
- Phase 4 (Installer): 2-3 days
- Phase 5 (Testing): 3-4 days
- Phase 6 (Windows Defender Testing): 2 days (buffer for unsigned .exe testing)
- **Total**: 11-15 days (updated from 9-13 days to include Windows Defender testing buffer)

