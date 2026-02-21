@echo off
echo ========================================
echo Restarting Bridge with Full Admin Rights
echo ========================================
echo.

echo Checking current privileges...
net session >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Running as Administrator
) else (
    echo ❌ NOT running as Administrator
    echo.
    echo Physical printer forwarding requires Administrator rights!
    echo.
    echo Right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

echo.
echo Stopping any existing bridge processes...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 2 >nul

echo.
echo Starting bridge with full admin rights...
cd /d "c:\Projects\TabezaConnect\src\service"

echo.
echo 🔑 ADMIN MODE ENABLED:
echo - Physical port access: GRANTED
echo - USB communication: ENABLED  
echo - Bridge forwarding: FULL RIGHTS
echo.

start "TabezaConnect Bridge (Admin)" cmd /k "node index.js"

echo.
echo ✅ Bridge started with Administrator privileges
echo.
echo Physical printer forwarding should now work!
echo.
echo Test by printing from your POS system.
echo.
pause
