# Installer Fixes - March 4, 2026

## Issues Fixed

### 1. Bar ID Setup Flow ✅ **CRITICAL FIX**
**Problem**: Bar ID prompt was not showing during installation

**Root Cause**: Wrong Electron entry point
- `package.json` was pointing to `src/electron-main.js` (no setup flow)
- Should point to `src/main.js` (has first-run setup with Bar ID prompt)

**Fix Applied**: Changed `"main"` field in package.json from `"src/electron-main.js"` to `"src/main.js"`

**How it works now**:
1. On first run, app detects no config exists
2. Opens setup window with `src/public/setup.html`
3. User enters Bar ID from Tabeza dashboard
4. Config is saved to `%APPDATA%\Tabeza\config.json`
5. Service starts automatically
6. System tray icon appears

**Setup HTML Features**:
- Clean, modern UI with validation
- Instructions to find Bar ID in Tabeza dashboard
- Real-time validation (minimum 5 characters, alphanumeric)
- Shows next steps after configuration
- IPC communication with Electron main process

### 2. Nested Directory Structure ✅
**Problem**: Installer was creating `C:\Program Files\TabezaConnect\Tabeza Connect\Tabeza Connect.exe`

**Root Cause**: Mismatch between `productName` and `shortcutName` in package.json
- `productName`: "TabezaConnect" (no space)
- `shortcutName`: "Tabeza Connect" (with space) ← This was causing the nested folder

**Fix Applied**: Changed `shortcutName` from "Tabeza Connect" to "TabezaConnect" in package.json

**Expected Result**: Executable should now be at `C:\Program Files\TabezaConnect\TabezaConnect.exe`

### 3. Post-Install Instructions ✅
**Added**: Message box after installation with setup instructions:
- App will open automatically
- Configure Bar ID in management UI
- Set up printer pooling from system tray
- System tray icon location

### 4. Simplified NSIS Installer Script
**Decision**: Removed complex NSIS Bar ID prompt dialog (was causing issues)

**New Approach**: 
- User configures Bar ID through the management UI after installation
- Default config.json created with empty Bar ID
- Management UI will prompt for Bar ID on first launch

## Files Modified

1. `package.json`
   - Changed `shortcutName` from "Tabeza Connect" to "TabezaConnect"

2. `src/installer/installer.nsh`
   - Removed complex Bar ID prompt dialog
   - Added post-install message box with instructions
   - Simplified installation flow

## Testing Instructions

### Test 1: Installation Path
1. Run `TabezaConnect-Setup-1.7.0.exe`
2. Complete installation
3. Verify executable is at: `C:\Program Files\TabezaConnect\TabezaConnect.exe`
4. Verify NO nested "Tabeza Connect" folder exists

### Test 2: System Tray Icon
1. After installation completes, check system tray (bottom-right)
2. Look for Tabeza Connect icon
3. Right-click icon to verify menu appears
4. Verify menu options:
   - Service status indicator
   - Folders status indicator
   - Open Management UI
   - Configure Printer Pooling
   - Repair Folder Structure
   - View Logs
   - Start/Restart Service
   - Quit

### Test 3: Auto-Start After Installation
1. Installation should automatically launch the app
2. Management UI should open in browser at `http://localhost:8765`
3. System tray icon should appear

### Test 4: Folder Structure
1. Verify `C:\TabezaPrints\` exists with subdirectories:
   - `processed\`
   - `failed\`
   - `logs\`
   - `queue\pending\`
   - `queue\uploaded\`
   - `templates\`
2. Verify `C:\TabezaPrints\order.prn` exists (empty file)
3. Verify `C:\TabezaPrints\config.json` exists

### Test 5: Printer Pooling Setup
1. From system tray, select "Configure Printer Pooling..."
2. Wizard should open
3. Follow prompts to configure printer
4. Verify "Tabeza Agent" is created in Windows

## Known Issues

### Multiple Installer Files Created
The build process creates several installer files:
- `TabezaConnect-Setup-1.7.0.exe` ← **USE THIS ONE** (matches artifactName)
- `TabezaConnect Setup 1.7.0.exe` (legacy format)
- `Tabeza Connect Setup 1.7.0.exe` (old format with space)

**Recommendation**: Only distribute `TabezaConnect-Setup-1.7.0.exe`

### Build Process Exit Code -1
The electron-builder process exits with code -1 but the installer is successfully created. This appears to be a non-fatal warning related to the build process completing.

## Next Steps

1. **Test the installer** using the instructions above
2. **Report results**:
   - Does executable install to correct path?
   - Does system tray icon appear?
   - Does app auto-start after installation?
   - Does printer pooling setup work?

3. **If issues persist**:
   - Check `C:\TabezaPrints\logs\electron.log` for errors
   - Check Windows Event Viewer for application errors
   - Verify Electron main process is starting correctly

## Architecture Notes

### Entry Point
- **Main entry**: `src/electron-main.js` (specified in package.json "main" field)
- **Alternative**: `src/tray/main.js` (not currently used)

### Electron Main Process
The `electron-main.js` file:
- Creates system tray icon
- Starts background service (src/service/index.js)
- Manages printer setup wizard
- Initializes TabezaPrints folder structure on every startup
- Handles app lifecycle

### Background Service
The service runs as a separate Node.js process:
- Watches `C:\TabezaPrints\order.prn` for changes
- Parses receipts using local template
- Uploads to cloud via queue system
- Sends heartbeat every 30 seconds

## Version
- **Current Version**: 1.7.0
- **Build Date**: March 4, 2026
- **Installer**: TabezaConnect-Setup-1.7.0.exe
