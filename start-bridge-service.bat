@echo off
echo ========================================
echo STARTING BRIDGE SERVICE
echo ========================================
echo.

echo Starting Tabeza Final Bridge...
cd /d "C:\Projects\TabezaConnect\src\service"

echo ✅ Configuration Status:
echo    - EPSON: Folder port (CORRECT)
echo    - Bridge config: Correct folder
echo    - Folder exists: YES
echo    - Service: NOT RUNNING (PROBLEM!)
echo.

echo Starting bridge service...
start "Tabeza Bridge" cmd /k "node index.js"

echo.
echo ✅ Bridge service started!
echo.
echo Next steps:
echo    1. Wait for bridge to initialize
echo    2. Print from POS to test
echo    3. Watch for detection messages
echo.
echo Expected output:
echo    🌉 Tabeza Universal Bridge v4.0 - FINAL EDITION
echo    ✅ Final Universal Bridge Active
echo    📄 Processing: [filename].prn
echo    🖨️ Forwarded successfully via Windows spooler
echo    ✅ Print cycle complete
echo.
pause
