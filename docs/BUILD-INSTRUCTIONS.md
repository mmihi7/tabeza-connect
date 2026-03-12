# Tabeza Connect - Build Instructions

## Quick Start

To build the installer with all fixes applied:

```bash
npm run build:complete
```

This single command will:
1. Kill any running TabezaConnect processes
2. Clean old build artifacts
3. Rebuild native modules for Electron
4. Run build preparation checks
5. Build the installer
6. Verify the build output

## Manual Build Process

If you prefer to run steps individually:

### 1. Kill Running Processes

```bash
npm run kill-processes
```

### 2. Rebuild Native Modules

```bash
npm run rebuild:all
```

This rebuilds:
- better-sqlite3
- usb
- serialport

### 3. Build the Installer

```bash
npm run build:win:x64
```

## Build Configuration

The build configuration in `package.json` has been updated to:

### Native Module Handling

- **npmRebuild**: `true` - Automatically rebuilds native modules
- **buildDependenciesFromSource**: `true` - Builds from source when needed
- **nodeGypRebuild**: `true` - Runs node-gyp rebuild

### File Inclusion

The build now properly includes:
- All Electron resources (chrome_100_percent.pak, etc.)
- Native module binaries
- Service files
- Installer scripts
- Public assets

### ASAR Unpacking

Native modules are unpacked from ASAR to ensure they work correctly:
- better-sqlite3
- usb
- serialport

## Troubleshooting

### Issue: "chrome_100_percent.pak not found"

**Solution**: Run `npm run rebuild:all` before building.

### Issue: "Multiple TabezaConnect.exe processes running"

**Solution**: Run `npm run kill-processes` or use the complete build script.

### Issue: "Native module not found"

**Solution**: 
1. Delete `node_modules` folder
2. Run `npm install`
3. Run `npm run rebuild:all`
4. Run `npm run build:complete`

### Issue: "Access denied when killing processes"

**Solution**: 
1. Close TabezaConnect from the system tray
2. Open Task Manager and manually end TabezaConnect processes
3. Run the build again

## Build Output

After a successful build, you'll find:

- **Installer**: `dist/TabezaConnect-Setup-{version}.exe`
- **Unpacked**: `dist/win-unpacked/` (for testing)

## Testing the Build

Before distributing the installer:

1. **Test the unpacked version**:
   ```bash
   dist\win-unpacked\TabezaConnect.exe
   ```

2. **Verify Electron resources**:
   - Check that `dist/win-unpacked/chrome_100_percent.pak` exists
   - Check that `dist/win-unpacked/chrome_200_percent.pak` exists
   - Check that `dist/win-unpacked/resources.pak` exists

3. **Test native modules**:
   - Verify printer detection works (USB, network, serial)
   - Verify database operations work (better-sqlite3)

4. **Test the installer**:
   - Install on a clean Windows machine
   - Verify all features work correctly
   - Test uninstallation

## Build Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run build:complete` | Complete build process (recommended) |
| `npm run build:win:x64` | Build installer only |
| `npm run rebuild` | Rebuild native modules |
| `npm run rebuild:all` | Rebuild + install app deps |
| `npm run kill-processes` | Kill running TabezaConnect processes |
| `npm run prepare-build` | Run build preparation checks |

## Requirements

- Node.js 18+ (specified in package.json)
- npm 9+
- Windows 10/11
- Visual Studio Build Tools (for native modules)
- Python 3.x (for node-gyp)

## CI/CD Integration

For automated builds, use:

```bash
npm ci
npm run rebuild:all
npm run build:win:x64
```

## Version Management

The version is managed in `package.json`. To create a new release:

1. Update version in `package.json`
2. Run `npm run build:complete`
3. Test the installer
4. Tag the release in git
5. Distribute the installer

## Support

If you encounter build issues:

1. Check this document first
2. Review the build logs in the console
3. Check `dist/builder-debug.yml` for detailed build configuration
4. Consult the Electron Builder documentation: https://www.electron.build/

## Recent Fixes (v1.7.14)

- ✅ Fixed missing Electron resources (chrome_100_percent.pak, etc.)
- ✅ Fixed native module rebuilding for Electron
- ✅ Added process cleanup before building
- ✅ Added comprehensive build verification
- ✅ Added automated build script
- ✅ Improved error handling and logging
