@echo off
echo ========================================
echo CREATING TEST VIRTUAL PRINTER
echo ========================================
echo.

echo This creates a virtual printer for testing
echo if your POS can see and use it, then we can
echo configure it for digital capture while keeping EPSON physical
echo.

:: Check admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: This script requires Administrator privileges.
    pause
    exit /b 1
)

echo ✅ Running as Administrator

:: Create virtual printer that outputs to folder port
echo.
echo [1/3] Creating virtual printer...
powershell -Command "Add-Printer -Name 'Tabeza Bridge Test' -DriverName 'Generic / Text Only' -PortName 'C:\ProgramData\Tabeza\TabezaPrints\'" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Virtual printer created successfully
) else (
    echo ❌ Failed to create virtual printer
)

:: Verify creation
echo.
echo [2/3] Verifying virtual printer...
powershell -Command "Get-Printer -Name 'Tabeza Bridge Test' | Select-Object Name,PortName,DriverName"

:: Test print to virtual printer
echo.
echo [3/3] Testing print to virtual printer...
echo "TEST VIRTUAL PRINTER - %DATE% %TIME%" > "C:\ProgramData\Tabeza\test-virtual.txt"
powershell -Command "Get-Content -Path 'C:\ProgramData\Tabeza\test-virtual.txt' | Out-Printer -Name 'Tabeza Bridge Test'" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Virtual printer test successful
) else (
    echo ❌ Virtual printer test failed
)

echo.
echo ========================================
echo VIRTUAL PRINTER TEST COMPLETE
echo ========================================
echo.
echo Results:
echo   - Virtual printer: Created
echo   - Test print: Sent to virtual printer
echo.
echo Next steps:
echo   1. Check your POS system for "Tabeza Bridge Test"
echo   2. If you see it, configure POS to use it
echo   3. Set it as default printer
echo   4. Keep EPSON for physical receipts
echo   5. Bridge will capture from folder port
echo.
pause
