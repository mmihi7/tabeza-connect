@echo off
echo ========================================
echo Starting TabezaConnect as Administrator
echo ========================================
echo.

REM Kill any existing processes on port 8765
echo Killing existing processes on port 8765...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8765 2^>nul') do (
    echo Killing PID %%a...
    taskkill /F /PID %%a 2>nul
)

REM Navigate to service directory
cd /d "c:\Projects\TabezaConnect\src\service"

REM Check if running as Administrator
net session >nul 2>&1
if %errorlevel% equ 0 (
    echo Running as Administrator - Good!
    echo.
    echo Starting TabezaConnect service...
    echo This will monitor Windows Print Spooler for receipts.
    echo.
    node index.js
) else (
    echo ERROR: Not running as Administrator!
    echo.
    echo TabezaConnect needs Administrator privileges to:
    echo - Access Windows Print Spooler directory
    echo - Monitor .SPL print files
    echo - Capture receipt data
    echo.
    echo Please right-click this file and select "Run as administrator"
    pause
)

echo.
echo If service stopped unexpectedly, check:
echo 1. Print Spooler service is running: net start Spooler
echo 2. EPSON printer is available and online
echo 3. Firewall allows port 8765
echo.
pause
