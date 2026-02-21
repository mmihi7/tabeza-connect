@echo off
echo ========================================
echo Starting FIXED Tabeza Silent Bridge
echo ========================================
echo.

echo Killing existing processes...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 2 >nul

echo.
echo Starting FIXED bridge service...
echo Fixes applied:
echo   - Port forwarding: Uses config.physicalPort
echo   - File locking: Retry logic with backoff
echo   - Debouncing: 2-second delay
echo   - Error handling: Clear actionable messages
echo.

cd /d "c:\Projects\TabezaConnect\src\service"
start "TabezaConnect Bridge (FIXED)" cmd /k "node index.js"

echo.
echo ✅ FIXED bridge started!
echo.
echo Test by printing from your POS system.
echo Expected console output:
echo   📄 Captured XXXX bytes from print job
echo   ☁️  Processing for cloud upload...
echo   📤  Receipt queued for upload (XXXX bytes)
echo   🖨️  Forwarding to physical printer: \\.\USB001
echo   🖨️  Forwarded to physical printer successfully
echo   ✅ Print cycle complete
echo.
pause
