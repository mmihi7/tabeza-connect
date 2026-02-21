@echo off
echo ========================================
echo INSTALLING GENERIC/TEXT ONLY DRIVER
echo ========================================
echo.

echo Installing the missing "Generic / Text Only" driver
echo This will allow us to create virtual printers for bridge
echo.

:: Check admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: This script requires Administrator privileges.
    pause
    exit /b 1
)

echo ✅ Running as Administrator

:: Step 1: Install Generic/Text Only driver
echo.
echo [1/3] Installing Generic/Text Only driver...
powershell -Command "Add-PrinterDriver -Name 'Generic / Text Only'" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Generic/Text Only driver installed successfully
) else (
    echo ❌ Failed to install Generic/Text Only driver
    echo Trying alternative method...
    powershell -Command "pnputil /add-driver C:\Windows\inf\ntprint.inf /install" 2>nul
    if %errorlevel% equ 0 (
        echo ✅ Driver installed via pnputil
    ) else (
        echo ❌ Driver installation failed
    )
)

:: Step 2: Verify driver installation
echo.
echo [2/3] Verifying installed drivers...
powershell -Command "Get-PrinterDriver | Where-Object {$_.Name -like '*Generic*' -or $_.Name -like '*Text*'} | Select-Object Name"

:: Step 3: Create virtual printer with installed driver
echo.
echo [3/3] Creating virtual printer...
powershell -Command "Add-Printer -Name 'Tabeza Bridge' -DriverName 'Generic / Text Only' -PortName 'C:\ProgramData\Tabeza\TabezaPrints\'" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Virtual printer created successfully!
    goto :success
) else (
    echo ❌ Still failed to create virtual printer
    goto :troubleshoot
)

:success
echo.
echo Verifying virtual printer...
powershell -Command "Get-Printer -Name 'Tabeza Bridge' | Select-Object Name,PortName,DriverName"

echo.
echo ========================================
echo ✅ SUCCESS! Virtual Printer Ready
echo ========================================
echo.
echo What was accomplished:
echo   - Generic/Text Only driver: INSTALLED
echo   - Virtual printer: CREATED
echo   - Port: C:\ProgramData\Tabeza\TabezaPrints\
echo.
echo Next steps:
echo   1. Check your POS for "Tabeza Bridge" printer
echo   2. Configure POS to use "Tabeza Bridge"
echo   3. Keep EPSON for physical receipts
echo   4. Bridge will capture from folder port
echo.
goto :end

:troubleshoot
echo.
echo ========================================
echo TROUBLESHOOTING
echo ========================================
echo.
echo If driver installation failed:
echo   1. Try Windows Update for printer drivers
echo   2. Install Windows printer drivers from Control Panel
echo   3. Use "Add a printer" wizard in Windows Settings
echo.
echo Alternative approach:
echo   - Configure POS to use EPSON (already on folder port)
echo   - Bridge should detect prints directly
echo.

:end
echo.
pause
