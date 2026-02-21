@echo off
echo ========================================
echo Restarting TabezaConnect with Spooler Fix
echo ========================================
echo.

REM Kill existing processes
echo Killing existing processes on port 8765...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8765 2^>nul') do (
    taskkill /F /PID %%a 2>nul
)

REM Navigate to service directory
cd /d "c:\Projects\TabezaConnect\src\service"

REM Check if running as Administrator
net session >nul 2>&1
if %errorlevel% equ 0 (
    echo Running as Administrator - Good!
    echo.
    echo Starting TabezaConnect with POLLING fix...
    echo This should now detect print jobs in spooler directory.
    echo.
    node index.js
) else (
    echo ERROR: Not running as Administrator!
    echo.
    echo Please right-click this file and select "Run as administrator"
    pause
)

echo.
pause
