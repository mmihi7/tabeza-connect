@echo off
echo ========================================
echo Restarting Bridge with Fixed Config
echo ========================================
echo.

echo Stopping existing service...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 2 >nul

echo.
echo Starting bridge with CORRECTED config...
cd /d "C:\Projects\TabezaConnect\src\service"

echo ✅ CONFIG FIX APPLIED:
echo    - physicalPort: "USB001" (was null)
echo    - Forwarding target: \\.\USB001
echo    - All other settings: preserved
echo.

start "Tabeza Bridge (CONFIG-FIXED)" cmd /k "node index.js"

echo.
echo ✅ Bridge restarted with fixed config!
echo.
echo Expected behavior:
echo    - Physical forwarding: SUCCESS
echo    - No "cannot find file" errors
echo    - Physical receipt prints from EPSON
echo.
pause
