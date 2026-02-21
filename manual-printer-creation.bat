@echo off
echo ========================================
echo WINDOWS GUI PRINTER CREATION
echo ========================================
echo.

echo Since PowerShell failed, let's use Windows GUI
echo to create the virtual printer manually
echo.

echo Driver is installed: Generic / Text Only ✅
echo Now we'll create the printer using Windows interface
echo.

echo ========================================
echo MANUAL PRINTER CREATION STEPS
echo ========================================
echo.
echo Please follow these steps EXACTLY:
echo.
echo 1. Open Windows Settings (Win + I)
echo 2. Go to "Devices" -> "Printers & scanners"
echo 3. Click "Add a printer or scanner"
echo 4. Wait for it to search, then click
echo    "The printer that I want isn't listed"
echo 5. Select "Add a local printer or network printer with manual settings"
echo 6. Choose "Create a new port"
echo 7. Select "Local Port" and click Next
echo 8. Enter this EXACT port name:
echo    C:\ProgramData\Tabeza\TabezaPrints\
echo    (Include the trailing backslash!)
echo 9. Click Next
echo 10. Select "Generic" from manufacturer list
echo 11. Select "Generic / Text Only" from printers list
echo 12. Click Next
echo 13. Name the printer: Tabeza Bridge
echo 14. Choose "Do not share this printer"
echo 15. Click Finish
echo.

echo ========================================
echo VERIFICATION STEPS
echo ========================================
echo.
echo After creating the printer:
echo.
echo 1. Open Control Panel -> Devices and Printers
echo 2. Look for "Tabeza Bridge" printer
echo 3. Right-click -> Printer properties
echo 4. Check "Ports" tab shows:
echo    C:\ProgramData\Tabeza\TabezaPrints\
echo 5. Check "Advanced" tab shows:
echo    Driver: Generic / Text Only
echo.

echo ========================================
echo TESTING THE PRINTER
echo ========================================
echo.
echo To test the printer:
echo.
echo 1. Open Notepad
echo 2. Type: TEST TABEZA BRIDGE
echo 3. File -> Print
echo 4. Select "Tabeza Bridge" printer
echo 5. Click Print
echo 6. Check if file appears in:
echo    C:\ProgramData\Tabeza\TabezaPrints\
echo.

echo ========================================
echo NEXT STEPS
echo ========================================
echo.
echo Once printer is created and working:
echo.
echo 1. Check your POS system for "Tabeza Bridge"
echo 2. Configure POS to use "Tabeza Bridge"
echo 3. Keep EPSON for physical receipts
echo 4. Bridge will capture from folder port
echo 5. Test complete system
echo.

pause
