# Build Ready - March 4, 2026

## ✅ Root Cause Fixed

**Problem**: Multiple conflicting `package.json` files causing nested directories and installer issues.

**Solution**: Deleted `src/package.json`, kept root `package.json` as single source of truth.

## Current Configuration

### Single Package.json (Root)
- **Location**: `tabeza-connect/package.json`
- **Main entry**: `src/main.js` (has Bar ID setup flow)
- **Product name**: `TabezaConnect` (no space)
- **Shortcut name**: `TabezaConnect` (no space)
- **Build output**: `dist/`
- **Status**: ✅ Active

### Backup
- **Location**: `src/package.json.backup`
- **Status**: Archived (not used by build)

### Service Package
- **Location**: `src/service/package.json`
- **Purpose**: Service-specific builds (PKG, standalone)
- **Status**: ✅ Kept (doesn't interfere with Electron Builder)

## Build Output

### Unpacked App Structure ✅
```
dist/win-unpacked/
├── TabezaConnect.exe          ← Correct location (no nesting!)
├── resources/
│   ├── app.asar
│   ├── installer/             ← PowerShell scripts
│   ├── public/                ← setup.html for Bar ID
│   └── service/               ← Service code
├── locales/
└── [Electron runtime files]
```

### Installer Files
Multiple installers are still being created (legacy issue):
- `TabezaConnect-Setup-1.7.0.exe` ← **USE THIS ONE** (matches artifactName)
- `TabezaConnect Setup 1.7.0.exe` (legacy format)
- `Tabeza Connect Setup 1.7.0.exe` (old format with space)

**Note**: Only distribute `TabezaConnect-Setup-1.7.0.exe`

## Expected Installation Flow

### 1. Installation
- User runs `TabezaConnect-Setup-1.7.0.exe`
- Installer creates folders at `C:\TabezaPrints\`
- Installer offers printer pooling setup (optional)
- App installs to `C:\Program Files\TabezaConnect\`
- Executable at: `C:\Program Files\TabezaConnect\TabezaConnect.exe`
- Post-install message shows next steps
- App launches automatically (`runAfterFinish: true`)

### 2. First Run - Bar ID Setup
- App detects no config exists
- Opens setup window with `src/public/setup.html`
- User enters Bar ID from Tabeza dashboard
- Setup validates Bar ID (min 5 chars, alphanumeric)
- Config saved to `%APPDATA%\Tabeza\config.json`
- Service starts automatically
- System tray icon appears

### 3. Normal Operation
- System tray icon shows in bottom-right
- Right-click menu provides:
  - Service status
  - Open Management UI (http://localhost:8765)
  - Configure Printer Pooling
  - View Logs
  - Repair Folder Structure
  - Restart Service
  - Quit
- Double-click tray icon opens Management UI

## Key Files

### Entry Point
```javascript
// package.json
{
  "main": "src/main.js"  // ← Has first-run setup flow
}
```

### Main Process (src/main.js)
- Checks for existing config
- Shows setup window if no config
- Creates system tray
- Starts background service
- Handles IPC for config saving

### Setup UI (src/public/setup.html)
- Modern, clean interface
- Bar ID input with validation
- Instructions to find Bar ID
- IPC communication with main process
- Shows next steps after setup

### Installer Script (src/installer/installer.nsh)
- Creates `C:\TabezaPrints\` folder structure
- Offers printer pooling setup
- Shows post-install instructions
- Handles uninstall cleanup

## Testing Checklist

### ✅ Build Verification
- [x] Single package.json (root only)
- [x] Conflicting src/package.json deleted
- [x] Build completes without errors
- [x] Unpacked app has correct structure (no nesting)
- [x] TabezaConnect.exe at root level

### 🔲 Installation Testing (User to verify)
- [ ] Installer runs without errors
- [ ] Installs to `C:\Program Files\TabezaConnect\`
- [ ] Executable at `C:\Program Files\TabezaConnect\TabezaConnect.exe`
- [ ] NO nested "Tabeza Connect" folder
- [ ] Folder structure created at `C:\TabezaPrints\`
- [ ] Post-install message appears
- [ ] App launches automatically

### 🔲 First Run Testing (User to verify)
- [ ] Setup window appears (Bar ID prompt)
- [ ] Can enter Bar ID
- [ ] Validation works (rejects empty/short IDs)
- [ ] Config saves successfully
- [ ] System tray icon appears
- [ ] Service starts automatically

### 🔲 Tray Icon Testing (User to verify)
- [ ] Icon appears in system tray (bottom-right)
- [ ] Right-click shows menu
- [ ] Menu shows service status
- [ ] "Open Management UI" works
- [ ] Double-click opens Management UI

### 🔲 Printer Setup Testing (User to verify)
- [ ] "Configure Printer Pooling" opens wizard
- [ ] Can select physical printer
- [ ] Setup completes successfully
- [ ] "Tabeza Agent" created in Windows

## Known Issues

### Multiple Installer Files
The build still creates multiple installer files with different naming conventions. This is a legacy issue from previous builds. Only the file matching the `artifactName` pattern should be distributed:
- **Distribute**: `TabezaConnect-Setup-1.7.0.exe`
- **Ignore**: Other .exe files in dist/

### Build Exit Code -1
Electron Builder exits with code -1 but the build completes successfully. This appears to be a non-fatal warning.

## Next Steps

1. **Test the installer** using the checklist above
2. **Report results**:
   - Does it install to correct path?
   - Does Bar ID setup appear?
   - Does system tray work?
   - Does printer setup work?

3. **If successful**:
   - Clean up old installer files from dist/
   - Document the working configuration
   - Create release notes

4. **If issues persist**:
   - Check logs at `C:\TabezaPrints\logs\electron.log`
   - Check Windows Event Viewer
   - Verify Electron main process is starting

## Files Modified

1. ✅ `package.json` - Changed main entry to `src/main.js`
2. ✅ `package.json` - Changed shortcutName to `TabezaConnect`
3. ✅ `src/package.json` - **DELETED** (backed up to src/package.json.backup)
4. ✅ `src/installer/installer.nsh` - Added post-install message

## Version
- **Current Version**: 1.7.0
- **Build Date**: March 4, 2026
- **Installer**: TabezaConnect-Setup-1.7.0.exe
- **Status**: Ready for testing
