# Dashboard Electron Window Fix ✅

**Date:** 2026-03-09  
**Issue:** Dashboard was opening in browser instead of as Electron window  
**Status:** Fixed

## Problem

The dashboard was configured to open in the browser using `shell.openExternal('http://localhost:8765')` instead of opening as an Electron BrowserWindow.

## Root Cause

The dashboard.html was using fetch() API calls to communicate with the HTTP server at localhost:8765, which only works when opened in a browser. When opened as an Electron window, it needs to use Electron IPC (Inter-Process Communication) via the preload script.

## Solution

### 1. Updated dashboard.html to use Electron IPC

Changed all communication from fetch() API calls to `window.electronAPI` methods:

**Before (Browser-based):**
```javascript
const response = await fetch(`${API_BASE}/api/config`);
const result = await response.json();
```

**After (Electron IPC):**
```javascript
const result = await window.electronAPI.getConfig();
```

### 2. IPC Methods Used

The dashboard now uses these Electron IPC methods (defined in preload.js):

- `window.electronAPI.getConfig()` - Load Bar ID and settings
- `window.electronAPI.saveBarId(barId)` - Save Bar ID
- `window.electronAPI.checkPrinterStatus()` - Check if Tabeza POS Printer exists
- `window.electronAPI.checkTemplateStatus()` - Check if template.json exists
- `window.electronAPI.launchTemplateGenerator()` - Open template generator window

### 3. System Tray Configuration

The system tray is already configured to open the dashboard as an Electron window via the `showManagementUI()` function in electron-main.js. This function:

1. Creates a BrowserWindow with proper dimensions
2. Loads dashboard.html from the file system
3. Registers the window with the Window Registry for state synchronization
4. Sets up focus event listeners for real-time state updates

## Architecture

```
System Tray Icon
      ↓
   (click)
      ↓
showManagementUI()
      ↓
Creates BrowserWindow
      ↓
Loads dashboard.html
      ↓
Uses window.electronAPI (IPC)
      ↓
Main Process Handlers
      ↓
StateManager / Config Files
```

## Files Modified

1. **tabeza-connect/src/public/dashboard.html**
   - Removed fetch() API calls
   - Added window.electronAPI calls
   - Updated all async functions to use IPC

## Testing Checklist

- [ ] Click system tray icon → Dashboard opens as Electron window (not browser)
- [ ] Enter Bar ID and save → Configuration persists
- [ ] Verify Bar ID displays correctly after page refresh
- [ ] Check printer status displays correctly
- [ ] Check template status displays correctly
- [ ] Verify template button enables when prerequisites met
- [ ] Test auto-refresh (wait 10 seconds)
- [ ] Close and reopen dashboard → State persists

## Benefits of Electron Window

1. **Native Integration**: Proper window management, taskbar integration
2. **Security**: No CORS issues, no need for HTTP server for UI
3. **Performance**: Direct IPC is faster than HTTP requests
4. **Offline**: Works without HTTP server running
5. **State Sync**: Automatic state synchronization across windows
6. **User Experience**: Feels like a native desktop app

## Next Steps

1. Test the dashboard opens as Electron window from system tray
2. Verify all IPC handlers are working correctly
3. Test state synchronization when multiple windows are open
4. Ensure window state (size, position) persists across sessions

---

**Implementation Status:** ✅ Complete and Ready for Testing
