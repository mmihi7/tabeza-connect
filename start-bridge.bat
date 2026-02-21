@echo off
echo ========================================
echo Starting TabezaConnect with Silent Bridge
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
    echo ✅ Running as Administrator - Required for bridge mode!
    echo.
    echo Starting TabezaConnect with Silent Bridge...
    echo.
    echo 🌉 BRIDGE MODE ENABLED:
    echo    - Digital capture: File port monitoring
    echo    - Physical printing: Direct port forwarding
    echo    - Parallel operation: Yes
    echo    - Service criticality: HIGH
    echo.
    echo ⚠️  IMPORTANT: Physical printing requires this service!
    echo    If service stops, physical printing stops working!
    echo.
    node index.js
) else (
    echo ❌ ERROR: Not running as Administrator!
    echo.
    echo Silent Bridge mode requires Administrator privileges to:
    echo - Access printer ports for physical forwarding
    echo - Monitor file port for digital capture
    echo.
    echo Please right-click this file and select "Run as administrator"
    pause
)

echo.
echo If service stopped unexpectedly, check:
echo 1. Bridge configuration exists: C:\ProgramData\Tabeza\bridge-config.json
echo 2. Physical printer is connected and online
echo 3. Service is running as Administrator
echo.
pause
