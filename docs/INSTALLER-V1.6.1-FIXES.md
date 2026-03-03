# TabezaConnect Installer v1.6.1 - Fixes Applied

## Issues Fixed:

1. **Visual Checklist Not Showing**
   - Fixed write-status.ps1 PowerShell array handling bug that was causing scripts to fail
   - The installation summary (Step 8) now properly shows a checklist with ✓/✗ for each step

2. **No Test Print During Installation**
   - Restored test print prompt in verify-bridge.ps1
   - Step 7 now prompts user to send a test print from Notepad
   - Waits up to 30 seconds to detect the test print file

3. **Printer Communication Error**
   - Fixed originalPort in config.json (was set to "TabezaCapturePort" instead of "USB001")
   - Updated detect-thermal-printer.ps1 to properly detect and save the original USB port
   - This ensures the bridge can correctly forward print jobs to the original port

## Installation Flow (Working):

1. ✓ Create folders (C:\TabezaPrints)
2. ✓ Detect printer (saves original USB port)
3. ✓ Configure bridge (sets up TabezaCapturePort)
4. ✓ Register service
5. ✓ Start service
6. ✓ Register printer with Tabeza API
7. ✓ Test print verification (prompts user)
8. ✓ Show installation summary checklist

## Current Status:
- Installer ready at: dist\TabezaConnect-Setup-v1.6.1.exe
- Printer now shows as "Normal" status
- Config fixed with correct originalPort
- Test print prompt restored
- Visual checklist will show at end of installation

## To Test:
1. Run the new installer as admin
2. You should see a PowerShell window at the end showing the installation checklist
3. You'll be prompted to send a test print during verification
4. The printer should now work correctly with Notepad
