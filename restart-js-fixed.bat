@echo off
echo ========================================
echo Restarting Bridge with JavaScript Fix
echo ========================================
echo.

echo Stopping existing service...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 2 >nul

echo.
echo Starting FIXED bridge (JavaScript error resolved)...
cd /d "C:\Projects\TabezaConnect\src\service"

echo ✅ JavaScript fix applied:
echo    - uploadToCloud() now returns proper Promise
echo    - No more 'undefined catch' errors
echo    - Clean error handling
echo.

start "Tabeza Bridge (JS-FIXED)" cmd /k "node index.js"

echo.
echo ✅ Bridge restarted with JavaScript fix!
echo.
echo Expected behavior:
echo    - Clean capture cycles
echo    - No JavaScript errors
echo    - Physical printing works
echo    - Cloud uploads complete
echo.
pause
