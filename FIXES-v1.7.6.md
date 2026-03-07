# Tabeza Connect v1.7.6 - State Synchronization Fixes

## Issues Fixed

### 1. Bar ID Configuration Not Saving
**Problem**: Dashboard was showing "Unexpected token ''" error when saving Bar ID configuration.

**Root Cause**: 
- UTF-8 BOM (Byte Order Mark) was being written to config.json
- JSON parser couldn't handle the BOM character

**Fix**:
- Updated `save-config` IPC handler to write with explicit encoding flags: `{ encoding: 'utf8', flag: 'w' }`
- This prevents BOM from being added to the file

### 2. Printer Setup Not Reflecting Across UI
**Problem**: When printer pooling setup completed, the status didn't update in dashboard or template generator.

**Root Cause**:
- Printer setup ran in elevated PowerShell process
- No communication back to Electron main process
- No broadcast to open windows

**Fix**:
- Added broadcast events after printer setup completes
- Main process sends `printer-setup-complete` event to all open windows
- Dashboard and template generator listen for this event and refresh status
- Added event listeners in both HTML files

### 3. Config Changes Not Syncing Across Windows
**Problem**: Saving Bar ID in dashboard didn't update template generator or tray menu.

**Root Cause**:
- No inter-window communication
- Each window operated independently

**Fix**:
- Added `config-updated` broadcast event when config is saved
- All windows listen for this event and reload their config
- Tray menu updates automatically via `updateTrayMenu()` call

### 4. Service Path Mismatch
**Problem**: Service was using `C:\ProgramData\Tabeza` while Electron app used `C:\TabezaPrints`.

**Root Cause**:
- Inconsistent path constants between service and main process

**Fix**:
- Updated service `DATA_DIR` constant from `C:\ProgramData\Tabeza` to `C:\TabezaPrints`
- Updated all template paths in service to use `C:\TabezaPrints\templates`
- Now both service and Electron app use the same data directory

## Changes Made

### Files Modified

1. **src/electron-main.js**
   - Incremented version to 1.7.6
   - Added broadcast events in `setup-printer` IPC handler
   - Added broadcast events in `save-config` IPC handler
   - Broadcasts `printer-setup-complete` to all windows after successful setup
   - Broadcasts `config-updated` to all windows after config save

2. **src/public/dashboard.html**
   - Added event listener for `config-updated` event
   - Added event listener for `printer-setup-complete` event
   - Auto-refreshes status when events are received
   - Shows success alert when printer setup completes

3. **src/public/template-generator.html**
   - Added event listener for `config-updated` event
   - Added event listener for `printer-setup-complete` event
   - Auto-refreshes printer status when events are received
   - Shows success alert when printer setup completes

4. **src/service/index.js**
   - Changed `DATA_DIR` from `C:\ProgramData\Tabeza` to `C:\TabezaPrints`
   - Updated template paths to use `C:\TabezaPrints\templates`
   - Fixed template generation endpoint to save to correct location

5. **package.json**
   - Incremented version from 1.7.5 to 1.7.6

## How State Synchronization Works Now

### Event Flow Diagram

```
User Action (Dashboard)
    ↓
Save Bar ID
    ↓
IPC: save-config
    ↓
Main Process:
  - Writes config.json
  - Broadcasts 'config-updated' to all windows
  - Calls updateTrayMenu()
    ↓
All Windows Receive Event:
  - Dashboard: reloads config, updates UI
  - Template Generator: reloads config, updates UI
  - Tray Menu: updates status indicators
```

```
User Action (Printer Setup Wizard)
    ↓
Complete Printer Setup
    ↓
IPC: setup-printer
    ↓
Main Process:
  - Runs elevated PowerShell script
  - Waits for completion
  - Broadcasts 'printer-setup-complete' to all windows
  - Calls updateTrayMenu()
    ↓
All Windows Receive Event:
  - Dashboard: checks printer status, shows success
  - Template Generator: checks printer status, shows success
  - Tray Menu: updates printer status indicator
```

## Testing Checklist

- [ ] Save Bar ID in dashboard → verify it appears in template generator
- [ ] Complete printer setup → verify status updates in dashboard
- [ ] Complete printer setup → verify status updates in template generator
- [ ] Complete printer setup → verify tray menu shows correct status
- [ ] Save Bar ID → verify tray menu updates
- [ ] Open multiple windows → verify all sync when changes are made
- [ ] Check service logs at `C:\TabezaPrints\logs\service.log`
- [ ] Verify config.json has no BOM (open in hex editor, should start with `{` not `EF BB BF`)

## Known Remaining Issues

1. **Background Service Crashing**: The service may still crash on startup due to missing dependencies. Need to investigate:
   - Check if all required modules are bundled correctly
   - Verify paths to service components are correct
   - Check service logs for specific error messages

2. **Service HTTP Server**: The HTTP server in the service may not start correctly. This is non-fatal (receipt capture continues), but management UI won't be accessible via http://localhost:8765.

## Next Steps

1. Test the installer with version 1.7.6
2. Verify all state synchronization works correctly
3. Investigate background service crash (check logs at `C:\TabezaPrints\logs\service.log`)
4. If service crashes, check for missing dependencies or path issues in service components

## Version History

- **1.7.0**: Initial version
- **1.7.1**: Fixed JSON output parsing
- **1.7.2**: Added elevation (had syntax errors)
- **1.7.3**: Fixed elevation syntax errors
- **1.7.4**: Fixed JSON BOM error, added IPC handlers
- **1.7.5**: Fixed printer setup notification
- **1.7.6**: Fixed state synchronization across all windows, fixed path mismatch (CURRENT)
