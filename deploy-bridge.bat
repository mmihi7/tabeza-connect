@echo off
echo ========================================
echo Deploying Tabeza Silent Bridge
echo ========================================
echo.

echo This will set up the Silent Bridge architecture
echo that enables parallel digital capture + physical printing
echo.

REM Check if running as Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: This script must be run as Administrator
    echo.
    echo Right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

echo ✅ Running as Administrator - Good!
echo.

echo Step 1: Setting up printer bridge...
powershell -ExecutionPolicy Bypass -File "c:\Projects\TabezaConnect\setup-bridge.ps1"

if %errorlevel% neq 0 (
    echo ❌ Bridge setup failed
    pause
    exit /b 1
)

echo ✅ Bridge setup complete!
echo.

echo Step 2: Updating configuration...
reg add "HKLM\SOFTWARE\Tabeza\TabezaConnect" /v CaptureMode /t REG_SZ /d bridge /f >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Updated to bridge mode
) else (
    echo ❌ Failed to update registry
)

echo.
echo ========================================
echo ✅ DEPLOYMENT COMPLETE!
echo ========================================
echo.
echo Architecture: Silent Bridge
echo - Digital Capture: File Port monitoring
echo - Physical Printing: Direct port forwarding
echo - Parallel Operation: Yes
echo - Service Dependency: Critical (must stay running)
echo.
echo.
echo NEXT STEPS:
echo 1. Restart TabezaConnect service
echo 2. Print from POS to "EPSON L3210 Series"
echo 3. Verify both cloud upload AND physical receipt
echo.
echo The restaurant can now operate normally even if internet fails!
echo.
pause
