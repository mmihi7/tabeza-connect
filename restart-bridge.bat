@echo off
echo ========================================
echo Restarting TabezaConnect Bridge Service
echo ========================================
echo.

echo Stopping current service...
taskkill /F /IM node.exe /T >nul 2>&1

echo Waiting for service to stop...
timeout /t 3 >nul

echo Starting bridge service...
cd /d "c:\Projects\TabezaConnect\src\service"
start "TabezaConnect Bridge" cmd /k "node index.js"

echo.
echo ✅ Service restarted with corrected physical printer forwarding!
echo.
echo The bridge should now:
echo 1. Capture print jobs digitally (working)
echo 2. Upload to cloud (working)  
echo 3. Forward to physical printer (FIXED!)
echo.
echo Test by printing from your POS system.
echo.
pause
