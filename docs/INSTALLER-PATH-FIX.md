# Installer Path Fix - v1.7.14

## Problem
The NSIS installer and PowerShell scripts were looking for files in the wrong locations after electron-builder packaged the application. This caused:
1. Redmon installation to fail silently during setup
2. Printer configuration script to exit early because capture.exe wasn't found
3. "Tabeza POS Printer" not being created during installation

## Root Cause
Electron-builder's `extraResources` configuration copies files to `$INSTDIR\resources\` but the NSIS installer script and PowerShell scripts were looking for files directly in `$INSTDIR\`.

## Files Changed

### 1. `src/installer/installer.nsh`
**Changed:** All script paths to use `resources\` subdirectory

**Before:**
```nsis
nsExec::ExecToLog 'powershell.exe -ExecutionPolicy Bypass -File "$INSTDIR\scripts\create-folders.ps1"'
nsExec::ExecToLog 'powershell.exe -ExecutionPolicy Bypass -File "$INSTDIR\scripts\install-redmon.ps1"'
nsExec::ExecToLog 'powershell.exe -ExecutionPolicy Bypass -File "$INSTDIR\scripts\configure-redmon-printer.ps1" -BarId "UNCONFIGURED"'
```

**After:**
```nsis
nsExec::ExecToLog 'powershell.exe -ExecutionPolicy Bypass -File "$INSTDIR\resources\scripts\create-folders.ps1"'
nsExec::ExecToLog 'powershell.exe -ExecutionPolicy Bypass -File "$INSTDIR\resources\scripts\install-redmon.ps1"'
nsExec::ExecToLog 'powershell.exe -ExecutionPolicy Bypass -File "$INSTDIR\resources\scripts\configure-redmon-printer.ps1" -BarId "UNCONFIGURED"'
```

**Also removed:** Redundant `File` commands that were trying to copy files that electron-builder already handles via `extraResources`.

### 2. `src/installer/scripts/install-redmon.ps1`
**Changed:** Default RedmonPath parameter

**Before:**
```powershell
param(
    [string]$RedmonPath = "C:\Program Files\TabezaConnect\redmon19",
    [switch]$Detailed
)
```

**After:**
```powershell
param(
    [string]$RedmonPath = "C:\Program Files\TabezaConnect\resources\redmon19",
    [switch]$Detailed
)
```

### 3. `src/installer/scripts/configure-redmon-printer.ps1`
**Changed:** Default CaptureScriptPath parameter

**Before:**
```powershell
param(
    [Parameter(Mandatory = $false)]
    [string]$BarId = "UNCONFIGURED",
    
    [string]$CaptureScriptPath = "C:\Program Files\TabezaConnect\capture.exe",
    ...
)
```

**After:**
```powershell
param(
    [Parameter(Mandatory = $false)]
    [string]$BarId = "UNCONFIGURED",
    
    [string]$CaptureScriptPath = "C:\Program Files\TabezaConnect\resources\capture.exe",
    ...
)
```

## Installation Directory Structure (After Fix)

```
C:\Program Files\TabezaConnect\
├── TabezaConnect.exe                    (Electron app)
├── resources\
│   ├── app.asar                         (Electron app bundle)
│   ├── capture.exe                      ✅ (pkg-compiled capture script)
│   ├── assets\
│   │   └── icon-green.ico
│   ├── redmon19\                        ✅ (Redmon installer files)
│   │   ├── setup64.exe
│   │   ├── setup.exe
│   │   └── ...
│   ├── scripts\                         ✅ (PowerShell installation scripts)
│   │   ├── create-folders.ps1
│   │   ├── install-redmon.ps1
│   │   ├── configure-redmon-printer.ps1
│   │   └── ...
│   ├── service\                         (Node.js service files)
│   ├── public\                          (Management UI HTML files)
│   └── setup-wizard\
└── locales\
```

## Testing Instructions

### 1. Rebuild the installer
```bash
cd C:\Projects\tabeza-connect
pnpm run build:installer
```

### 2. Uninstall existing version
- Go to Windows Settings > Apps > Installed apps
- Find "TabezaConnect" and uninstall
- When prompted, choose to remove the printer and data (for clean test)

### 3. Install new version
```bash
"C:\Projects\tabeza-connect\dist\TabezaConnect-Setup-1.7.14.exe"
```

### 4. During installation
- When prompted "Would you like to install Redmon and configure the Tabeza POS Printer now?", click **Yes**
- Watch the installation log for:
  - ✓ Redmon installed successfully
  - ✓ Tabeza POS Printer configured successfully

### 5. Verify installation
```powershell
# Check if Redmon is installed
Test-Path "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port"
# Should return: True

# Check if capture.exe exists
Test-Path "C:\Program Files\TabezaConnect\resources\capture.exe"
# Should return: True

# Check if printer was created
Get-Printer -Name "Tabeza POS Printer"
# Should return printer details

# Check printer port configuration
Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port\Ports\TabezaCapturePort"
# Should show Command, Arguments, etc.
```

### 6. Manual printer configuration (if needed)
If the printer wasn't created during installation, you can run:
```powershell
powershell -ExecutionPolicy Bypass -File "C:\Program Files\TabezaConnect\resources\scripts\configure-redmon-printer.ps1" -BarId "438c80c1-fe11-4ac5-8a48-2fc45104ba31" -Detailed
```

## Expected Behavior After Fix

1. ✅ Installer prompts to install Redmon and configure printer
2. ✅ When user clicks "Yes", Redmon installs successfully
3. ✅ "Tabeza POS Printer" is created with Redmon port
4. ✅ Redmon port is configured to pipe to capture.exe
5. ✅ capture.exe exists at the expected location
6. ✅ Printer appears in Windows Settings > Printers & scanners

## Rollback Plan
If issues occur, the old installer is still available at:
```
C:\Projects\tabeza-connect\dist\TabezaConnect-Setup-v1.7.0.exe
```

## Next Steps After Successful Installation

1. Open TabezaConnect dashboard (should open automatically)
2. Configure Bar ID: `438c80c1-fe11-4ac5-8a48-2fc45104ba31`
3. Verify printer status shows "Configured"
4. Test print job capture by printing to "Tabeza POS Printer"

---

**Date:** 2026-03-09  
**Version:** 1.7.14  
**Status:** Ready for testing
