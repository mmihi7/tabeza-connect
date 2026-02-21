@echo off
echo ========================================
echo FORCING BRIDGE MODE DIRECTLY
echo ========================================
echo.

echo This will start the bridge directly, bypassing registry issues...
echo.

cd /d "C:\Projects\TabezaConnect\src\service"

echo Stopping any existing services...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 2 >nul

echo.
echo Starting bridge directly...
echo ✅ FORCING BRIDGE MODE:
echo    - Bypassing registry check
echo    - Direct bridge initialization
echo    - Folder port active
echo    - Final bridge code
echo.

start "Tabeza Direct Bridge" cmd /k "node final-bridge.js"

echo.
echo ✅ DIRECT BRIDGE STARTED!
echo.
echo Expected output:
echo    🌉 Tabeza Universal Bridge v4.0 - FINAL EDITION
echo    ✅ Final Universal Bridge Active
echo    📁 Folder port: One file per print job
echo    ⏱️  awaitWriteFinish: Single trigger per job
echo    🖨️  Out-Printer: Universal physical forwarding
echo.
echo Test by printing from your POS now!
echo.
pause
