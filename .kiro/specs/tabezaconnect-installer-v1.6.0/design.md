# Silent Bridge Installer - Design Document

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Inno Setup Installer                      │
│                                                              │
│  1. Welcome → 2. Terms → 3. Bar ID → 4. Silent Setup       │
│                                                              │
│  Silent Setup Phase:                                        │
│  ├─ Detect Printer (PowerShell)                            │
│  ├─ Configure Bridge (PowerShell)                          │
│  ├─ Register Service (PowerShell)                          │
│  ├─ Start Service (Windows SC)                             │
│  └─ Verify Installation (PowerShell + User Test)           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Unified Configuration (config.json)             │
│                                                              │
│  {                                                          │
│    "barId": "xxx",                                          │
│    "apiUrl": "https://tabeza.co.ke",                       │
│    "bridge": {                                              │
│      "enabled": true,                                       │
│      "printerName": "EPSON L3210 Series",                  │
│      "captureFolder": "C:\\ProgramData\\Tabeza\\...",      │
│      "tempFolder": "C:\\ProgramData\\Tabeza\\temp"         │
│    }                                                        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  TabezaConnect Service                       │
│                                                              │
│  ├─ Main Service (index.js)                                │
│  └─ Bridge Service (final-bridge.js)                       │
│                                                              │
│  Workflow:                                                  │
│  POS → Virtual Printer → Capture Folder → Bridge →         │
│  → Cloud Upload + Physical Printer → Receipt               │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Printer Detection Script

**File**: `src/installer/scripts/detect-thermal-printer.ps1`

**Purpose**: Automatically detect thermal/POS printers on the system

**Algorithm**:
```
1. Get all printers from Windows
2. Exclude non-receipt printers (PDF, Fax, OneNote, etc.)
3. Filter out offline printers
4. Prefer printers with receipt-related keywords
5. Select first available if no keyword matches
6. Save printer info to JSON file
7. Exit with error if no printers found
```

**Input**: None

**Output**: `C:\ProgramData\Tabeza\detected-printer.json`
```json
{
  "printerName": "EPSON L3210 Series",
  "originalPortName": "USB001",
  "originalPortPath": "USB001",
  "status": "Normal",
  "driverName": "EPSON L3210 Series"
}
```

**Error Handling**:
- No printers found → Exit code 1, show error message
- PowerShell execution fails → Exit code 1, log error
- JSON write fails → Exit code 1, log error

---

### 2. Bridge Configuration Script

**File**: `src/installer/scripts/configure-bridge.ps1`

**Purpose**: Configure the silent bridge with detected printer

**Algorithm**:
```
1. Load detected printer from JSON
2. Create capture folder (C:\ProgramData\Tabeza\TabezaPrints)
3. Create temp folder (C:\ProgramData\Tabeza\temp)
4. Set folder permissions (Everyone: Full Control)
5. Create folder port (TabezaCapturePort)
6. Reconfigure printer to use folder port
7. Restart print spooler (CRITICAL - clears error state)
8. Wait 3 seconds for spooler to stabilize
9. Verify printer status
10. Create unified config.json
11. Exit with success/error code
```

**Input**: 
- Bar ID (from installer)
- Detected printer JSON

**Output**: `C:\ProgramData\Tabeza\config.json`
```json
{
  "barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
  "apiUrl": "https://tabeza.co.ke",
  "bridge": {
    "enabled": true,
    "printerName": "EPSON L3210 Series",
    "originalPort": "USB001",
    "captureFolder": "C:\\ProgramData\\Tabeza\\TabezaPrints",
    "tempFolder": "C:\\ProgramData\\Tabeza\\temp",
    "autoConfigure": true
  },
  "service": {
    "name": "TabezaConnect",
    "displayName": "Tabeza POS Connect",
    "description": "Captures receipt data from POS and syncs with Tabeza staff app",
    "port": 8765
  },
  "sync": {
    "intervalSeconds": 30,
    "retryAttempts": 3,
    "retryDelaySeconds": 60
  }
}
```

**Critical Steps**:
1. **Spooler Restart**: Must happen after port reconfiguration
   ```powershell
   Restart-Service Spooler -Force
   Start-Sleep -Seconds 3
   ```
2. **Folder Permissions**: Must allow Everyone full control
   ```powershell
   $acl = Get-Acl $captureFolder
   $permission = "Everyone", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"
   $rule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
   $acl.SetAccessRule($rule)
   Set-Acl $captureFolder $acl
   ```

**Error Handling**:
- Printer not found → Exit code 1
- Folder creation fails → Exit code 1
- Port creation fails → Exit code 1
- Spooler restart fails → Exit code 1
- Config write fails → Exit code 1

---

### 3. Verification Script

**File**: `src/installer/scripts/verify-bridge.ps1`

**Purpose**: Verify complete system functionality with real test print

**Algorithm**:
```
1. Check service is running
2. Check config.json exists and is valid
3. Check bridge is enabled
4. Check printer exists and is configured
5. Display verification prompt to user
6. Watch capture folder for new files (30 second timeout)
7. Detect when file appears
8. Wait 5 seconds for processing
9. Verify file was deleted (processed)
10. Show success/failure message
11. Exit with appropriate code
```

**User Interaction**:
```
========================================
VERIFICATION TEST
========================================

Please send a test print from your POS system now.

The system will:
  1. Capture the receipt data
  2. Upload to Tabeza cloud
  3. Print physical receipt

Waiting for print job...
```

**Success Flow**:
```
✅ Print job detected!
   File: print_12345.prn
   Size: 2048 bytes

✅ Print job processed successfully

========================================
INSTALLATION COMPLETE
========================================
```

**Timeout Flow**:
```
⚠️  No print job detected within 30 seconds

Installation completed, but verification skipped.
Please test printing manually after installation.
```

**Error Handling**:
- Service not running → Exit code 1
- Config not found → Exit code 1
- Printer not found → Exit code 1
- File detected but not processed → Exit code 1
- Timeout → Exit code 0 (warning, not error)

---

### 4. Bridge Service Updates

**File**: `src/service/final-bridge.js`

**Changes Required**:

#### A. Read from Unified Config
```javascript
loadConfig() {
    const defaults = {
        bridge: {
            enabled: true,
            printerName: 'AUTO_DETECT',
            captureFolder: 'C:\\ProgramData\\Tabeza\\TabezaPrints',
            tempFolder: 'C:\\ProgramData\\Tabeza\\temp'
        }
    };

    try {
        if (fs.existsSync(this.configPath)) {
            const rawContent = fs.readFileSync(this.configPath, 'utf8');
            const content = rawContent.replace(/^\uFEFF/, '');
            const config = JSON.parse(content);
            
            // Merge bridge config with defaults
            return {
                ...defaults,
                bridge: { ...defaults.bridge, ...config.bridge },
                barId: config.barId,
                apiUrl: config.apiUrl
            };
        }
    } catch (err) {
        console.warn('⚠️ Config load failed, using defaults:', err.message);
    }
    return defaults;
}
```

#### B. Fix Race Condition with Unique Temp Files
```javascript
async forwardToPhysicalPrinter(data) {
    const printerName = this.config.bridge.printerName;
    
    // FIX: Use unique temp file per job
    const tempFile = path.join(
        this.config.bridge.tempFolder,
        `fwd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.prn`
    );
    
    console.log(`🖨️  Forwarding to ${printerName}...`);

    return new Promise((resolve) => {
        fs.writeFile(tempFile, data, (writeErr) => {
            if (writeErr) {
                console.error('⚠️  Failed to write temp file:', writeErr.message);
                resolve();
                return;
            }

            const psCommand = `Get-Content -Path '${tempFile}' -Encoding Byte -Raw | Out-Printer -Name '${printerName}'`;
            const cmd = `powershell -Command "${psCommand}"`;
            
            exec(cmd, { timeout: 15000 }, (err, stdout, stderr) => {
                // Clean up temp file
                try {
                    if (fs.existsSync(tempFile)) {
                        fs.unlinkSync(tempFile);
                    }
                } catch (cleanupErr) {
                    // Ignore cleanup errors
                }

                if (err) {
                    console.error('⚠️  Forward failed:', err.message);
                } else {
                    console.log('🖨️  Forwarded successfully');
                }
                resolve();
            });
        });
    });
}
```

---

### 5. Inno Setup Integration

**File**: `installer-pkg-v1.6.0.iss`

**Key Changes**:

#### A. Remove Bridge Wizard Page
- No custom wizard page for bridge configuration
- All bridge setup happens silently in [Run] section

#### B. Updated [Run] Section
```inno
[Run]
; Step 1: Create folders
Filename: "powershell.exe"; 
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\create-folders.ps1"""; 
  StatusMsg: "Creating folders..."; 
  Flags: runhidden waituntilterminated

; Step 2: Detect printer (SILENT)
Filename: "powershell.exe"; 
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\detect-thermal-printer.ps1"" -OutputFile ""C:\ProgramData\Tabeza\detected-printer.json"""; 
  StatusMsg: "Detecting your printer..."; 
  Flags: runhidden waituntilterminated

; Step 3: Configure bridge (SILENT - includes spooler restart)
Filename: "powershell.exe"; 
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\configure-bridge.ps1"" -BarId ""{code:GetBarId}"" -ConfigFile ""C:\ProgramData\Tabeza\config.json"""; 
  StatusMsg: "Setting up your printer..."; 
  Flags: runhidden waituntilterminated

; Step 4: Register service
Filename: "powershell.exe"; 
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\register-service-pkg.ps1"" -InstallPath ""{app}"" -BarId ""{code:GetBarId}"""; 
  StatusMsg: "Registering service..."; 
  Flags: runhidden waituntilterminated

; Step 5: Start service
Filename: "sc.exe"; 
  Parameters: "start TabezaConnect"; 
  StatusMsg: "Starting service..."; 
  Flags: runhidden waituntilterminated

; Step 6: Verify with REAL test print (NOT runhidden - user needs to see prompt)
Filename: "powershell.exe"; 
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\verify-bridge.ps1"" -InstallPath ""{app}"""; 
  StatusMsg: "Verifying installation..."; 
  Flags: waituntilterminated
```

#### C. Updated [Files] Section
```inno
[Files]
; Compiled Service Executable
Source: "TabezaConnect.exe"; DestDir: "{app}"; Flags: ignoreversion

; PowerShell Scripts (NEW SCRIPTS ADDED)
Source: "src\installer\scripts\detect-thermal-printer.ps1"; DestDir: "{app}\scripts"
Source: "src\installer\scripts\configure-bridge.ps1"; DestDir: "{app}\scripts"
Source: "src\installer\scripts\verify-bridge.ps1"; DestDir: "{app}\scripts"
Source: "src\installer\scripts\register-service-pkg.ps1"; DestDir: "{app}\scripts"
Source: "src\installer\scripts\create-folders.ps1"; DestDir: "{app}\scripts"

; Bridge Service (NEW)
Source: "src\service\final-bridge.js"; DestDir: "{app}\service"

; Configuration Template (UPDATED - unified config)
Source: "config.template.json"; DestDir: "{app}"; DestName: "config.json"; Flags: onlyifdoesntexist

; Terms and Privacy
Source: "src\installer\TERMS_AND_PRIVACY.txt"; DestDir: "{app}\docs"

; Documentation
Source: "Plan\README.txt"; DestDir: "{app}\docs"
Source: "Plan\AFTER-INSTALL.txt"; DestDir: "{app}\docs"

; Icon and License
Source: "icon-green.ico"; DestDir: "{app}"
Source: "LICENSE.txt"; DestDir: "{app}"
```

---

## Data Flow

### Installation Flow
```
1. User runs installer
   ↓
2. Welcome screen
   ↓
3. Terms acceptance (checkbox)
   ↓
4. Bar ID entry
   ↓
5. SILENT SETUP PHASE
   ├─ detect-thermal-printer.ps1
   │  └─ Saves: detected-printer.json
   ├─ configure-bridge.ps1
   │  ├─ Reads: detected-printer.json
   │  ├─ Creates: folders, ports
   │  ├─ Restarts: spooler
   │  └─ Saves: config.json (unified)
   ├─ register-service-pkg.ps1
   │  └─ Registers: Windows service
   └─ sc.exe start TabezaConnect
      └─ Starts: service
   ↓
6. VERIFICATION PHASE
   ├─ verify-bridge.ps1
   │  ├─ Prompts: "Send test print"
   │  ├─ Watches: capture folder
   │  └─ Verifies: processing
   ↓
7. Installation complete
```

### Runtime Flow
```
POS System
   ↓ (prints to)
Virtual Printer: "Tabeza POS Connect"
   ↓ (routes to)
Folder Port: C:\ProgramData\Tabeza\TabezaPrints
   ↓ (creates file)
File: print_12345.prn
   ↓ (detected by)
Bridge Service (chokidar watcher)
   ↓ (processes)
   ├─ Upload to Cloud (Supabase)
   └─ Forward to Physical Printer
       ↓ (via PowerShell Out-Printer)
       Physical Printer: EPSON L3210 Series
       ↓ (prints)
       Physical Receipt
```

---

## Error Handling Strategy

### Installation Errors

| Error | Detection | Recovery | User Message |
|-------|-----------|----------|--------------|
| No printer found | detect-thermal-printer.ps1 exit code 1 | Abort installation | "No printer detected. Please ensure printer is powered on and drivers are installed." |
| Folder creation fails | configure-bridge.ps1 exit code 1 | Abort installation | "Failed to create folders. Check permissions." |
| Port creation fails | configure-bridge.ps1 exit code 1 | Abort installation | "Failed to configure printer port. Contact support." |
| Spooler restart fails | configure-bridge.ps1 exit code 1 | Abort installation | "Failed to restart print spooler. Restart computer and try again." |
| Service registration fails | register-service-pkg.ps1 exit code 1 | Abort installation | "Failed to register service. Run as Administrator." |
| Service start fails | sc.exe exit code != 0 | Abort installation | "Failed to start service. Check Windows Event Log." |
| Verification timeout | verify-bridge.ps1 exit code 0 | Continue with warning | "Verification skipped. Test printing manually." |

### Runtime Errors

| Error | Detection | Recovery | Logging |
|-------|-----------|----------|---------|
| File read fails | fs.readFileSync throws | Skip file, continue | Log error, increment skip counter |
| Upload fails | fetch throws | Retry 3 times with backoff | Log error, queue for retry |
| Forward fails | exec callback error | Log error, continue | Log error, don't block upload |
| Temp file cleanup fails | fs.unlinkSync throws | Ignore, continue | Log warning only |
| Config load fails | JSON.parse throws | Use defaults | Log warning, use fallback config |

---

## Testing Strategy

### Unit Tests
- Printer detection logic (mock PowerShell output)
- Config file generation (validate JSON structure)
- Temp file naming (ensure uniqueness)
- Error handling (simulate failures)

### Integration Tests
- Full installer run on clean Windows VM
- Printer detection with various printer types
- Bridge configuration with real printer
- Service start and stop
- End-to-end print job processing

### Manual Tests
- Install on Windows 10 and Windows 11
- Test with different printer brands (Epson, Star, Citizen, Bixolon)
- Test with USB, network, and Bluetooth printers
- Test verification with real POS system
- Test printer replacement workflow

---

## Performance Considerations

### Installation Time
- Target: < 5 minutes total
- Printer detection: < 10 seconds
- Bridge configuration: < 30 seconds
- Service registration: < 10 seconds
- Verification: < 30 seconds (user dependent)

### Runtime Performance
- File detection: < 2 seconds after file creation
- Upload: < 1 second (network dependent)
- Forward: < 3 seconds (printer dependent)
- Total latency: < 6 seconds end-to-end

### Resource Usage
- Memory: < 50 MB for bridge service
- CPU: < 5% during idle, < 20% during processing
- Disk: < 100 MB for temp files (auto-cleanup)
- Network: < 10 KB per receipt upload

---

## Security Considerations

### Folder Permissions
- Capture folder: Everyone (Full Control) - required for POS to write
- Temp folder: Everyone (Full Control) - required for bridge to write
- Config file: SYSTEM + Administrators (Read/Write)
- Service executable: SYSTEM + Administrators (Read/Execute)

### Data Protection
- Receipt data encrypted in transit (HTTPS)
- No PII stored locally
- Temp files deleted immediately after processing
- Config file contains no sensitive data (Bar ID is not secret)

### Service Security
- Runs as Local System (required for spooler access)
- No network listening (only outbound HTTPS)
- No remote management interface
- Logs contain no sensitive data

---

## Deployment Strategy

### Version: v1.6.0

### Release Artifacts
- `TabezaConnect-Setup-v1.6.0.exe` (installer)
- `CHANGELOG.md` (release notes)
- `INSTALLATION_GUIDE.md` (user documentation)

### Rollout Plan
1. **Internal Testing** (1 week)
   - Test on development machines
   - Test with various printer types
   - Verify all error scenarios

2. **Beta Testing** (2 weeks)
   - Deploy to 5 pilot venues
   - Monitor for issues
   - Collect feedback

3. **Production Release**
   - Update download link on tabeza.co.ke
   - Notify existing users of update
   - Provide migration guide from v1.5.x

### Rollback Plan
- Keep v1.5.1 installer available
- Document manual bridge configuration steps
- Provide uninstall + reinstall instructions

---

## Success Criteria

### Installation Success
- ✅ Installer completes without errors
- ✅ Service starts automatically
- ✅ Printer configured correctly
- ✅ Bridge enabled and running
- ✅ Verification test passes

### Runtime Success
- ✅ Print jobs captured within 2 seconds
- ✅ Upload success rate > 99%
- ✅ Physical printing success rate > 99%
- ✅ No file accumulation in capture folder
- ✅ Service uptime > 99.9%

### User Experience Success
- ✅ Installation time < 5 minutes
- ✅ User actions < 5 total
- ✅ No technical knowledge required
- ✅ Clear error messages
- ✅ Support tickets reduced by 90%
