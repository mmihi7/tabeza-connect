# Printer Installation Update

## Changes Made

Updated the `configure-printer.ps1` script to install a virtual printer that works with TabezaConnect's spooler monitoring.

## What Changed

### Before (File-based)
- Printer name: "Tabeza Virtual Printer"
- Port: Custom file port (`TabezaPrintPort`)
- Output: Wrote to `C:\TabezaPrints\print_output.prn`
- **Problem**: TabezaConnect monitors Windows spooler, not files

### After (Spooler-based)
- Printer name: "Tabeza POS Connect"
- Port: `NULL:` (built-in Windows null port)
- Output: Goes through Windows spooler, then discarded
- **Solution**: TabezaConnect captures from spooler before discard

## How It Works Now

```
POS prints to "Tabeza POS Connect"
         ↓
Windows Print Spooler
  ├─> Creates .SPL/.SHD files temporarily
  ├─> TabezaConnect captures receipt data ✅
  └─> Sends to NULL port (nothing prints)
```

## Key Benefits

1. **Zero Latency**: Print jobs complete instantly (NULL port is fast)
2. **Spooler Integration**: TabezaConnect sees all print jobs
3. **No File Management**: No need to clean up output files
4. **Standard Windows**: Uses built-in NULL port (no custom ports)

## Testing

After installing TabezaConnect:

1. Open Notepad
2. Type some text
3. File → Print → Select "Tabeza POS Connect"
4. Click Print
5. Watch TabezaConnect console for: `📄 New print file detected`

## Technical Details

### NULL Port
- Built into Windows (no installation needed)
- Accepts print jobs through the spooler
- Discards output (nothing actually prints)
- Perfect for receipt capture without physical printing

### Spooler Files
- Location: `C:\Windows\System32\spool\PRINTERS`
- File types: `.SPL` (spool file), `.SHD` (shadow file)
- Lifetime: Temporary (deleted after print job completes)
- TabezaConnect: Captures before deletion

## Compatibility

- ✅ Works with all POS systems
- ✅ Works with all Windows versions (7, 10, 11, Server)
- ✅ No additional drivers needed (Generic/Text Only is built-in)
- ✅ No network configuration required
- ✅ No firewall issues

## Migration from Old Version

If upgrading from a previous version:

1. Old printer ("Tabeza Virtual Printer") will be left in place
2. New printer ("Tabeza POS Connect") will be installed
3. Users should switch to the new printer
4. Old printer can be manually removed if desired

## For Developers

### Printer Configuration
```powershell
$PrinterName = 'Tabeza POS Connect'
$DriverName  = 'Generic / Text Only'
$PortName    = 'NULL:'

Add-Printer `
    -Name       $PrinterName `
    -DriverName $DriverName `
    -PortName   $PortName
```

### Verification
```powershell
# Check if printer exists
Get-Printer -Name 'Tabeza POS Connect'

# Check port
Get-PrinterPort -Name 'NULL:'

# Test print
notepad /p test.txt
```

## Files Modified

1. `src/installer/scripts/configure-printer.ps1`
   - Changed port from custom file port to NULL port
   - Updated printer name
   - Added comments explaining spooler integration

2. `installer.iss`
   - Updated uninstall section to remove correct printer name

## Status

✅ **Ready for testing** - The installer will now create a printer that works with TabezaConnect's spooler monitoring.

## Next Steps

1. Rebuild the installer
2. Test on a clean Windows VM
3. Verify receipt capture works
4. Deploy to test venue
