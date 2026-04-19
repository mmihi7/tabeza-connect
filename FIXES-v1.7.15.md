# TabezaConnect v1.7.15 - Fixes Summary

## Installation Date
April 17, 2026

## Critical Fixes Implemented

### 1. Bar ID Configuration - Now Optional ✅
**Problem**: Installer was requiring Bar ID during installation, causing installation failures.

**Solution**: 
- Bar ID input page is now **optional** during installation
- Users can skip Bar ID and configure it later via the tray icon
- Clear instructions provided: "leave blank to configure later"
- If skipped, Bar ID defaults to `NOT_CONFIGURED`
- Tray app shows "Configuration required" state when Bar ID is not set
- Configuration page accessible via tray icon → "Open Configuration"

**Files Modified**:
- `installer-pkg-v1.7.15.iss` - Made Bar ID optional in wizard

---

### 2. Multiple Instance Prevention ✅
**Problem**: Multiple TabezaConnect instances running simultaneously causing:
- Duplicate API requests
- PowerShell windows opening repeatedly
- Queue corruption
- Wasted Supabase resources

**Solution**:
- Installer now checks for running instances before installation
- Automatically stops all TabezaConnect processes
- Cleans pending queue to prevent duplicate uploads
- Added 2-second wait for processes to fully terminate

**Files Modified**:
- `installer-pkg-v1.7.15.iss` - Added `InitializeSetup()` function with process detection

---

### 3. Native Module Compilation (USB/SerialPort) ✅
**Problem**: Service crashing with "No native build was found for platform=win32 arch=x64 runtime=node abi=137"

**Solution**:
- Moved `usb` and `serialport` to root `package.json`
- Rebuilt native modules for Electron 28 x64 using `electron-rebuild`
- Changed installer from ia32 to x64 build
- USB printer detection now works correctly

**Files Modified**:
- `package.json` - Added native modules to root dependencies
- `rebuild-native-modules.bat` - Corrected rebuild script for x64

---

### 4. Window Focus Stealing Fix ✅
**Problem**: TabezaConnect window staying on top of all other windows, couldn't be minimized

**Solution**:
- Removed unconditional `.focus()` calls in `_showWindow()` and `_showWizardWindow()`
- Let OS handle focus naturally when window is first shown
- Only call `.focus()` when window is already visible (user clicked tray again)

**Files Modified**:
- `src/tray/tray-app.js` - Lines 190-250

---

### 5. EPIPE Cascade Error Fix ✅
**Problem**: EPIPE errors causing cascade of error logs, service instability

**Solution**:
- Updated `uncaughtException` and `unhandledRejection` handlers
- Write directly to log file without using `error()` function
- Skip console logging in error handlers to prevent EPIPE cascade
- Silent failure if file logging fails

**Files Modified**:
- `src/service/index.js` - Lines 1670-1730

---

## Installation Instructions

### Option 1: Run the Batch File
```
install-new-version.bat
```

### Option 2: Manual Installation
1. Stop all TabezaConnect processes:
   ```powershell
   Stop-Process -Name "TabezaConnect" -Force
   ```

2. Run the installer:
   ```
   installer-output\TabezaConnect-Setup-v1.7.15-PRODUCTION.exe
   ```

3. During installation:
   - **Option A**: Enter your Bar ID from https://tabeza.co.ke
   - **Option B**: Leave blank and click Next to configure later

4. After installation:
   - If you skipped Bar ID, right-click tray icon → "Open Configuration"
   - Enter Bar ID and save
   - Service will automatically connect to cloud

---

## Testing Checklist

After installation, verify:

- [ ] Only ONE TabezaConnect process is running
- [ ] Service starts without crashing
- [ ] No "No native build was found" error in logs
- [ ] HTTP server binds to port 8765 successfully
- [ ] USB printer detection works (if applicable)
- [ ] No duplicate uploads occur
- [ ] No EPIPE cascade errors in logs
- [ ] Window doesn't stay on top of all other windows
- [ ] Can minimize/restore window normally
- [ ] Bar ID can be configured via tray icon
- [ ] Service connects to cloud after Bar ID is set

---

## Log Locations

- Service logs: `C:\ProgramData\Tabeza\logs\tabezaconnect.log`
- Queue pending: `C:\ProgramData\Tabeza\queue\pending\`
- Queue uploaded: `C:\ProgramData\Tabeza\queue\uploaded\`

---

## Rollback Instructions

If issues occur, uninstall via:
```
"C:\Program Files\TabezaConnect\unins000.exe" /SILENT
```

Then reinstall previous version if needed.

---

## Version History

- **v1.7.15** - Bar ID optional, multiple instance prevention, native modules fixed, focus stealing fixed, EPIPE cascade fixed
- **v1.7.14** - Previous version
- **v1.7.0** - Initial production release

---

## Support

If you encounter issues:
1. Check logs at `C:\ProgramData\Tabeza\logs\tabezaconnect.log`
2. Verify only one instance is running: `Get-Process -Name "TabezaConnect"`
3. Contact support@tabeza.co.ke with log file attached
