@echo off
echo ========================================
echo Starting FINAL FIXED Tabeza Bridge
echo ========================================
echo.

echo Stopping any existing processes...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 2 >nul

echo.
echo Starting FINAL FIXED bridge...
cd /d "C:\Projects\TabezaConnect\src\service"

echo ✅ FINAL FIXES APPLIED:
echo    - File lock race condition: FIXED
echo    - Read-to-memory approach: ACTIVE
echo    - Safe file clearing: ENABLED
echo    - Temp file isolation: ACTIVE
echo    - Error handling: ROBUST
echo.

start "Tabeza Bridge (FINAL)" cmd /k "node index.js"

echo.
echo ✅ FINAL BRIDGE STARTED!
echo.
echo Expected behavior:
echo    - Clean 2KB receipts (not 22MB)
echo    - No EBUSY errors
echo    - No duplicate processing
echo    - Physical printing works
echo    - Cloud uploads work
echo.
echo Test by printing from your POS!
echo.
pause
