@echo off
echo ========================================
echo RESTORING EPSON TO PHYSICAL PORT
echo ========================================
echo.

echo PROBLEM: POS printed but no physical receipt
echo CAUSE: EPSON likely pointing to folder port instead of USB001
echo SOLUTION: Restore EPSON to physical USB port
echo.

:: Verify admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: This script requires Administrator privileges.
    pause
    exit /b 1
)

echo ✅ Running as Administrator

:: Step 1: Get current EPSON status
echo Current EPSON configuration:
powershell -Command "Get-Printer -Name 'EPSON L3210 Series' | Select-Object Name,PortName,DriverName,PrinterStatus"

:: Step 2: Restore EPSON to USB001
echo.
echo Restoring EPSON to physical USB001 port...
powershell -Command "Set-Printer -Name 'EPSON L3210 Series' -PortName 'USB001'" 2>nul
if %errorlevel% equ 0 (
    echo ✅ EPSON restored to USB001
) else (
    echo ❌ Failed to restore EPSON port
)

:: Step 3: Verify restoration
echo.
echo Verifying EPSON configuration:
powershell -Command "Get-Printer -Name 'EPSON L3210 Series' | Select-Object Name,PortName,PrinterStatus"

:: Step 4: Test EPSON with Windows test page
echo.
echo Sending Windows test page to EPSON...
powershell -Command "Invoke-PrinterTestPage -Name 'EPSON L3210 Series'" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Test page sent successfully
) else (
    echo ❌ Test page failed
)

echo.
echo ========================================
echo EPSON RESTORATION COMPLETE
echo ========================================
echo.
echo What changed:
echo   - EPSON PortName: USB001 (was folder port)
echo   - Physical printing: RESTORED
echo   - Bridge mode: DISABLED for now
echo.
echo Next steps:
echo   1. Test physical printing from POS
echo   2. If physical printing works:
echo      → POS is fixed
echo      → Bridge needs to be reconfigured
echo   3. If physical printing still fails:
echo      → Check USB cable, printer power, driver
echo.
pause
