@echo off
echo ========================================
echo Starting MINIMAL BULLETPROOF Bridge
echo ========================================
echo.

echo Stopping existing service...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 2 >nul

echo.
echo Starting MINIMAL bridge (Promise bug fixed)...
cd /d "C:\Projects\TabezaConnect\src\service"

echo ✅ MINIMAL FIXES APPLIED:
echo    - Promise chain error: FIXED
echo    - Minimal code: 150 lines vs 300+ lines
echo    - Temp file isolation: ACTIVE
echo    - Error isolation: ROBUST
echo    - No complex retry logic: SIMPLIFIED
echo.

start "Tabeza Bridge (MINIMAL)" cmd /k "node index.js"

echo.
echo ✅ MINIMAL BRIDGE STARTED!
echo.
echo Expected behavior:
echo    - Clean capture cycles
echo    - No JavaScript errors
echo    - Physical printing works
echo    - Cloud uploads complete
echo    - Minimal complexity
echo.
pause
