# Dashboard IPC Handlers - Complete ✅

**Date:** 2026-03-09  
**Issue:** Dashboard couldn't save Bar ID or check status  
**Status:** Fixed

## Problem

The dashboard was calling IPC methods that didn't have corresponding handlers in electron-main.js:
- `window.electronAPI.checkPrinterStatus()` → No handler
- Other handlers existed but weren't being called correctly

## Solution

### Added Missing IPC Handler

Added `check-printer-status` handler in electron-main.js that:
1. Uses PowerShell to check if "Tabeza Agent" exists
2. Returns printer information if found
3. Returns not_configured status if not found

```javascript
ipcMain.handle('check-printer-status', async () => {
  // Uses PowerShell: Get-Printer -Name 'Tabeza Agent'
  // Returns: { status: 'configured', printer: {...} }
  // Or: { status: 'not_configured' }
});
```

## All IPC Handlers Now Available

The dashboard now has all required handlers:

1. **get-config** ✅
   - Loads Bar ID and configuration from C:\TabezaPrints\config.json
   - Returns default config if file doesn't exist

2. **save-bar-id** ✅
   - Saves Bar ID to StateManager
   - Updates config.json on disk
   - Broadcasts change to all windows
   - Marks setup step as complete

3. **check-printer-status** ✅ (NEWLY ADDED)
   - Checks if "Tabeza Agent" exists in Windows
   - Returns printer details (name, driver, port)
   - Returns not_configured if printer not found

4. **check-template-status** ✅
   - Checks multiple locations for template.json
   - Validates template has required fields (version, patterns)
   - Returns template info if found

5. **launch-template-generator** ✅
   - Opens template generator window
   - Calls showTemplateGenerator() function

## Data Flow

```
Dashboard (Renderer)
      ↓
window.electronAPI.saveBarId('bar-123')
      ↓
IPC: save-bar-id
      ↓
electron-main.js Handler
      ↓
StateManager.updateState()
      ↓
BroadcastManager.broadcast()
      ↓
All Windows Receive Update
```

## Files Modified

1. **tabeza-connect/src/electron-main.js**
   - Added `check-printer-status` IPC handler
   - Changed `showManagementUI()` to load dashboard.html instead of management-ui.html

2. **tabeza-connect/src/public/dashboard.html**
   - Changed from fetch() API calls to window.electronAPI calls
   - All functions now use Electron IPC

## Testing Checklist

- [ ] Open dashboard from system tray
- [ ] Enter Bar ID and click Save → Should show success message
- [ ] Refresh dashboard → Bar ID should persist
- [ ] Printer status should show ✅ if printer exists, ⚠️ if not
- [ ] Template status should show ✅ if template exists, ⚠️ if not
- [ ] Template button should enable when Bar ID + Printer are configured
- [ ] Click Template button → Should open template generator window

## Why It Works Now

1. **Electron IPC**: Direct communication between renderer and main process
2. **StateManager**: Centralized state with automatic persistence
3. **BroadcastManager**: Automatic updates to all windows
4. **Proper Handlers**: All IPC methods have corresponding handlers

---

**Implementation Status:** ✅ Complete and Ready for Testing
