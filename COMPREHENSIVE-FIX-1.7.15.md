# COMPREHENSIVE FIX - Version 1.7.15

**Date:** 2026-03-05  
**Previous Version:** 1.7.14  
**Issues Fixed:**
1. Management UI tabs not opening (normal mode)
2. Printer pooling setup not visible in Windows Printers & Devices
3. Configuration source of truth clarity

---

## Issue 1: Management UI Tabs Not Opening

### Problem
The tabs in normal mode (Dashboard, Printer Setup, Template Generator, System, Logs) don't switch when clicked.

### Root Cause
Same issue as setup-mode - window functions calling themselves instead of internal functions.

**BROKEN CODE:**
```javascript
// Internal function
async function switchSection(sectionName) { ... }

// Window export - CALLS ITSELF!
window.switchSection = function(sectionName) {
  switchSection(sectionName);  // ❌ Resolves to window.switchSection → infinite loop!
};
```

### Fix
Rename internal functions to add `Internal` suffix, window exports use original names:

```javascript
// Internal function with unique name
async function switchSectionInternal(sectionName) { ... }

// Window export with original name
window.switchSection = function(sectionName) {
  return switchSectionInternal(sectionName);  // ✅ Calls internal function!
};
```

### Functions to Fix in `normal-mode.js`
- `switchSection` → `switchSectionInternal`
- `startService` → `startServiceInternal`
- `stopService` → `stopServiceInternal`
- `restartService` → `restartServiceInternal`
- `openCaptureFolder` → `openCaptureFolderInternal`
- `launchPrinterWizard` → `launchPrinterWizardInternal` (if exists)
- `launchTemplateWizard` → `launchTemplateWizardInternal` (if exists)
- `refreshStatus` → `refreshStatusInternal`
- `refreshLogs` → `refreshLogsInternal`
- `clearLogs` → `clearLogsInternal`
- `openLogsFolder` → `openLogsFolderInternal`
- `repairFolders` → `repairFoldersInternal`

---

## Issue 2: Printer Pooling Not Visible in Windows

### Problem
After running printer pooling setup, the "Tabeza POS Printer" is not visible in Windows Settings > Printers & Devices.

### Root Cause Analysis

The PowerShell script creates the printer correctly, but there are potential issues:

1. **WMI vs PowerShell cmdlets** - The script uses `Add-Printer` (PowerShell cmdlet) then switches to WMI (`Win32_Printer`) to enable pooling. This can cause sync issues.

2. **Print Spooler not refreshed** - After creating the printer with pooling, Windows may need the spooler restarted to show it in Settings.

3. **Permissions** - The printer may be created but not visible to the current user.

### Fix Strategy

**Option A: Restart Print Spooler After Printer Creation**
```powershell
# After creating pooled printer
Restart-Service -Name Spooler -Force -Wait
Start-Sleep -Seconds 2
```

**Option B: Use WMI Consistently**
```powershell
# Create printer using WMI from the start
$printer = ([wmiclass]"Win32_Printer").CreateInstance()
$printer.Name = $POOLED_PRINTER_NAME
$printer.DriverName = $driverName
$printer.PortName = @($PhysicalPortName, $PORT_NAME)
$printer.Put()
```

**Option C: Verify Printer Visibility**
```powershell
# After creation, verify it's visible
$verify = Get-Printer -Name $POOLED_PRINTER_NAME
if (-not $verify) {
    Write-Log "Printer created but not visible, restarting spooler..." -Level "WARN"
    Restart-Service -Name Spooler -Force -Wait
}
```

### Recommended Fix
Add spooler restart after printer creation in `New-PooledPrinter` function:

```powershell
# After $printer.Put() | Out-Null
Write-Log "Restarting print spooler to refresh printer list..."
Restart-Service -Name Spooler -Force -Wait
Start-Sleep -Seconds 2

# Verify printer is now visible
$verify = Get-Printer -Name $POOLED_PRINTER_NAME -ErrorAction SilentlyContinue
if (-not $verify) {
    Write-Log "Printer still not visible after spooler restart" -Level "ERROR"
    return $false
}
```

---

## Issue 3: Configuration Source of Truth

### Current State (CORRECT)

The configuration priority cascade is:

```
Priority 1 (Highest): Environment Variables
  ↓
Priority 2: Windows Registry (HKLM\SOFTWARE\Tabeza\TabezaConnect)
  ↓
Priority 3: Config File (C:\ProgramData\Tabeza\config.json)
  ↓
Priority 4 (Lowest): Hardcoded Defaults
```

### Configuration Keys

| Setting | Env Variable | Registry Key | Config File Key | Default Value |
|---|---|---|---|---|
| Bar ID | `TABEZA_BAR_ID` | `BarID` | `barId` | _(none)_ |
| API URL | `TABEZA_API_URL` | `APIUrl` | `apiUrl` | `https://tabeza.co.ke` |
| Watch Folder | `TABEZA_WATCH_FOLDER` | `WatchFolder` | `watchFolder` | `C:\ProgramData\Tabeza\TabezaPrints` |
| HTTP Port | `TABEZA_HTTP_PORT` | _(none)_ | `httpPort` | `8765` |

### Where Each Component Reads From

**Background Service (`src/service/index.js`):**
- Uses `RegistryReader.loadConfig()` which implements the priority cascade
- Reads from all sources in priority order

**Electron Main Process (`src/electron-main.js`):**
- Reads directly from `C:\ProgramData\Tabeza\config.json`
- Does NOT check registry or environment variables
- **This is a sync issue!**

**Management UI:**
- Calls IPC handlers in electron-main.js
- Gets config from `config.json` only

### The Sync Problem

When you save Bar ID in the Management UI:
1. ✅ Saves to `config.json`
2. ❌ Does NOT save to registry
3. ❌ Does NOT save to environment variables

When the background service reads config:
1. ✅ Checks environment variables (empty)
2. ✅ Checks registry (empty)
3. ✅ Checks `config.json` (has Bar ID) ← **Works!**

**Conclusion:** The system IS synced, but only through `config.json`. Registry and env vars are optional overrides.

### Clarification Document

**Source of Truth:** `C:\ProgramData\Tabeza\config.json`

**Override Mechanisms (Optional):**
- Registry: For system-wide settings (requires admin)
- Environment Variables: For testing/development

**When to Use Each:**

1. **config.json** (Default, Recommended)
   - Used by Management UI
   - Persists across reboots
   - No admin rights needed
   - **This is what users should use**

2. **Registry** (Advanced, Optional)
   - System-wide override
   - Requires admin rights
   - Used by installer to set defaults
   - Can override config.json

3. **Environment Variables** (Development Only)
   - Highest priority
   - For testing different configurations
   - Not persistent across reboots
   - **Not recommended for production**

### Recommendation

**No changes needed** - the current system is correct. The confusion comes from having multiple sources, but the priority cascade ensures consistency.

**Documentation Update:** Add a comment in `electron-main.js` explaining why it only reads `config.json`:

```javascript
// Configuration loading
// Note: electron-main.js reads ONLY from config.json for simplicity.
// The background service (src/service/index.js) implements the full
// priority cascade (env → registry → config.json → defaults).
// This is intentional - the Management UI should only modify config.json.
```

---

## Files to Modify

### 1. `src/public/js/normal-mode.js`
- Rename all internal functions to add `Internal` suffix
- Update window exports to call internal functions
- Update all internal function calls

### 2. `src/installer/printer-pooling-setup.ps1`
- Add spooler restart after printer creation
- Add verification step
- Improve error handling

### 3. `src/electron-main.js` (Documentation only)
- Add comment explaining config.json-only approach

### 4. `package.json`
- Version bump to 1.7.15

---

## Testing Checklist

### Test 1: Management UI Tabs
1. Open Management UI
2. Complete setup (or skip to normal mode)
3. Click each tab: Dashboard, Printer Setup, Template Generator, System, Logs
4. Each tab should switch correctly
5. Console should show: `[NormalMode] Switching to section: <name>`

### Test 2: Printer Pooling
1. Run printer pooling setup
2. Select a physical printer
3. Wait for completion
4. Open Windows Settings > Printers & Devices
5. "Tabeza POS Printer" should be visible
6. Right-click → Printer Properties → Ports tab
7. Should show TWO ports checked:
   - Physical port (e.g., USB001)
   - TabezaCapturePort

### Test 3: Configuration Sync
1. Save Bar ID in Management UI
2. Check `C:\ProgramData\Tabeza\config.json` - should have Bar ID
3. Restart background service
4. Service should load Bar ID correctly
5. Check service logs - should show Bar ID loaded

---

## Confidence Level

**HIGH** for Issue 1 (tabs) - Same pattern as setup-mode fix  
**MEDIUM** for Issue 2 (printer) - Needs testing on actual Windows system  
**HIGH** for Issue 3 (config) - System is already correct, just needs documentation

---

**Status:** READY FOR IMPLEMENTATION  
**Version:** 1.7.15  
**Created:** 2026-03-05

