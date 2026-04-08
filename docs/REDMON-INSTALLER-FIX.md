# Redmon Installer Fix - Summary

## Changes Made

### 1. Updated NSIS Installer Script (`src/installer/installer.nsh`)

**Removed:** References to non-existent `printer-pooling-setup.ps1`

**Added:** Proper Redmon installation flow:

```
Installation Steps:
1. Create TabezaPrints folder structure (using create-folders.ps1)
2. Ask user if they want to install Redmon and configure printer
3. If yes:
   - Copy Redmon files from src/installer/redmon19/
   - Run install-redmon.ps1 to install Redmon port monitor
   - Run configure-redmon-printer.ps1 to create Tabeza Agent
4. Show completion message
```

### 2. Updated package.json Build Configuration

**Changed:** `extraResources` to properly include Redmon files:

```json
{
  "from": "src/installer/scripts",
  "to": "scripts",
  "filter": ["**/*.ps1"]
},
{
  "from": "src/installer/redmon19",
  "to": "redmon19",
  "filter": ["**/*"]
}
```

This ensures:
- All PowerShell scripts are copied to `resources/scripts/`
- All Redmon installation files are copied to `resources/redmon19/`

### 3. Removed Incorrect File

Deleted `src/installer/printer-pooling-setup.ps1` - this was mixing printer pooling concepts with Redmon virtual printer approach.

## How Redmon Installation Works Now

### During Installation:

1. **Installer asks**: "Would you like to install Redmon and configure the Tabeza Agent?"

2. **If user clicks Yes**:
   - Copies Redmon files to `$INSTDIR\redmon19\`
   - Copies scripts to `$INSTDIR\scripts\`
   - Runs `install-redmon.ps1`:
     - Installs Redmon port monitor (redmonnt.dll, redmon.hlp)
     - Registers with Windows Print Spooler
     - Creates registry entries
   - Runs `configure-redmon-printer.ps1`:
     - Creates "Tabeza Agent" using Generic/Text Only driver
     - Creates "TabezaCapturePort" Redmon port
     - Configures port to pipe print jobs to capture script
     - Sets Bar ID to "UNCONFIGURED" (user configures later in dashboard)

3. **If user clicks No**:
   - Skips printer setup
   - User can configure later from system tray menu

### After Installation:

User can verify installation by:
1. Opening Windows Settings → Printers & Scanners
2. Looking for "Tabeza Agent"
3. Checking printer properties to see it uses "TabezaCapturePort"

## Files Involved

### Installer Files:
- `src/installer/installer.nsh` - NSIS installer script (UPDATED)
- `src/installer/scripts/install-redmon.ps1` - Installs Redmon
- `src/installer/scripts/configure-redmon-printer.ps1` - Creates printer
- `src/installer/scripts/create-folders.ps1` - Creates folder structure
- `src/installer/redmon19/` - Redmon installation files

### Build Configuration:
- `package.json` - electron-builder configuration (UPDATED)

## Testing Checklist

After rebuilding the installer:

- [ ] Install on clean Windows VM
- [ ] Verify installer asks about Redmon installation
- [ ] Click "Yes" to install Redmon
- [ ] Check Windows Event Viewer for any errors
- [ ] Verify "Tabeza Agent" appears in Printers & Scanners
- [ ] Check printer properties:
  - [ ] Driver: Generic / Text Only
  - [ ] Port: TabezaCapturePort
- [ ] Open dashboard and configure Bar ID
- [ ] Print test page to Tabeza Agent
- [ ] Verify print job is captured (check C:\TabezaPrints\order.prn)

## Known Requirements

For Redmon installation to work:
1. **Administrator privileges** - Required to install print monitor
2. **Generic/Text Only driver** - Built into Windows
3. **Print Spooler service** - Must be running
4. **Windows 10/11** - Redmon compatible

## Troubleshooting

If printer doesn't appear after installation:

1. Check installer log for errors
2. Manually run: `powershell -ExecutionPolicy Bypass -File "C:\Program Files\TabezaConnect\scripts\install-redmon.ps1"`
3. Check if Redmon is registered: `Get-PrinterPort | Where-Object {$_.Name -like "*Redmon*"}`
4. Restart Print Spooler: `Restart-Service Spooler`
5. Try manual printer configuration from dashboard

## Next Steps

1. Rebuild installer: `npm run build:installer`
2. Test on clean Windows VM
3. Verify Redmon installation works
4. Verify printer capture works
5. Test full receipt flow
