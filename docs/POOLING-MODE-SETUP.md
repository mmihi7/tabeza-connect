# Tabeza Connect - Pooling Mode Setup (Bridge Removed)

## Overview

Tabeza Connect now uses **Windows Print Pooling** exclusively. All bridge-related code and configuration has been removed.

## How Pooling Mode Works

1. **Virtual Printer Created**: "Tabeza POS Connect" printer is created during installation
2. **Port Configuration**: Printer uses a Local Port that writes to `C:\TabezaPrints\order.prn`
3. **File Monitoring**: Service watches the pooling file for changes
4. **Automatic Capture**: When POS prints, the file is captured and processed
5. **Cloud Upload**: Receipt data is sent to Tabeza API

## Configuration (Pooling Only)

```json
{
  "barId": "YOUR_BAR_ID",
  "driverId": "driver-COMPUTERNAME",
  "apiUrl": "https://tabeza.co.ke",
  "captureMode": "pooling",
  "printerName": "EPSON L3210 Series",
  "pooling": {
    "enabled": true,
    "captureFile": "C:\\TabezaPrints\\order.prn",
    "tempFolder": "C:\\ProgramData\\Tabeza\\captures",
    "stabilityChecks": 3,
    "stabilityDelay": 100
  }
}
```

## Installation Steps

### 1. Run Installer
```bash
TabezaConnect-Setup-v1.x.x.exe
```

### 2. Installer Creates:
- ✅ Virtual printer: "Tabeza POS Connect"
- ✅ Local Port pointing to: `C:\TabezaPrints\order.prn`
- ✅ Windows Service: "TabezaConnect"
- ✅ System Tray App (optional)

### 3. Configure POS
Point your POS system to print to: **"Tabeza POS Connect"**

## System Tray Icon

The system tray icon should show:
- 🟢 Green: Service running, capturing receipts
- 🔴 Red: Service stopped or error
- 📊 Status: Click to view capture statistics

**If tray icon is missing:**
1. Check if tray app is running: `tasklist | findstr "TabezaTray"`
2. Restart tray app: `C:\Program Files\TabezaConnect\TabezaTray.exe`

## Verification

### Check Service Status
```powershell
sc query TabezaConnect
```

### Check Printer Configuration
```powershell
Get-Printer -Name "Tabeza POS Connect" | Select-Object Name, PortName, PrinterStatus
```

### Check Capture File
```powershell
Get-Item "C:\TabezaPrints\order.prn"
```

### Test Print
1. Open Notepad
2. Type test receipt
3. Print to "Tabeza POS Connect"
4. Check if file size increases: `Get-Item "C:\TabezaPrints\order.prn" | Select-Object Length`

## Troubleshooting

### Issue: Wrong Printer Detected
**Problem**: Service shows "Microsoft Print to PDF" instead of "EPSON L3210 Series"

**Solution**: 
1. Update config.json:
   ```json
   "printerName": "EPSON L3210 Series"
   ```
2. Restart service:
   ```powershell
   Restart-Service TabezaConnect
   ```

### Issue: No System Tray Icon
**Problem**: Tray app not running

**Solution**:
1. Check if installed: `Test-Path "C:\Program Files\TabezaConnect\TabezaTray.exe"`
2. Run manually: `Start-Process "C:\Program Files\TabezaConnect\TabezaTray.exe"`
3. Add to startup (optional)

### Issue: Pooling File Not Updating
**Problem**: Prints don't update `order.prn`

**Solution**:
1. Verify printer port:
   ```powershell
   Get-PrinterPort -Name "TabezaCapturePort"
   ```
2. Should show: `PrinterHostAddress: C:\TabezaPrints\order.prn`
3. If wrong, reconfigure port in installer

## Architecture (Pooling Only)

```
┌─────────────────┐
│   POS System    │
└────────┬────────┘
         │ Print Job
         ▼
┌─────────────────────────┐
│ "Tabeza POS Connect"    │
│ (Virtual Printer)       │
└────────┬────────────────┘
         │ Local Port
         ▼
┌─────────────────────────┐
│ C:\TabezaPrints\        │
│ order.prn               │
│ (Pooling File)          │
└────────┬────────────────┘
         │ File Watch
         ▼
┌─────────────────────────┐
│ TabezaConnect Service   │
│ (Windows Service)       │
└────────┬────────────────┘
         │ HTTP POST
         ▼
┌─────────────────────────┐
│ Tabeza Cloud API        │
│ https://tabeza.co.ke    │
└─────────────────────────┘
```

## Removed Components

The following bridge-related components have been removed:

- ❌ `bridge.enabled` config
- ❌ `bridge.printerName` config
- ❌ `bridge.captureFolder` config
- ❌ `watchFolder` config (not needed for pooling)
- ❌ Bridge mode logic in service
- ❌ File watcher for bridge mode
- ❌ Printer port switching logic

## Benefits of Pooling-Only

1. **Simpler Configuration**: One capture method, less confusion
2. **More Reliable**: No printer port switching required
3. **Easier Installation**: Fewer steps for end users
4. **Better Performance**: Direct file monitoring is faster
5. **Clearer User Experience**: One-step setup

## Next Steps

1. ✅ Config cleaned (bridge removed)
2. ⏳ Rebuild installer with pooling-only setup
3. ⏳ Add system tray app to installer
4. ⏳ Improve user onboarding (show printer name, status)
5. ⏳ Add visual feedback during installation

---

**Last Updated**: 2026-02-28  
**Mode**: Pooling Only (Bridge Removed)
