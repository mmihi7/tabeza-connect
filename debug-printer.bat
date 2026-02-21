@echo off
echo ========================================
echo Debugging Physical Printer Communication
echo ========================================
echo.

echo Checking bridge configuration...
if exist "C:\ProgramData\Tabeza\bridge-config.json" (
    echo ✅ Bridge config found
    powershell -Command "Get-Content 'C:\ProgramData\Tabeza\bridge-config.json' | ConvertFrom-Json"
) else (
    echo ❌ Bridge config not found
    pause
    exit /b 1
)

echo.
echo Testing direct printer communication...
echo Creating test print data...
echo "TEST PRINT - $(date)" > "C:\ProgramData\Tabeza\test-direct.prn"

echo Method 1: Direct copy to USB001
copy "C:\ProgramData\Tabeza\test-direct.prn" "\\.\USB001"
if %errorlevel% equ 0 (
    echo ✅ Direct copy to USB001: SUCCESS
) else (
    echo ❌ Direct copy to USB001: FAILED
)

echo.
echo Method 2: PowerShell Out-Printer
powershell -Command "Get-Content 'C:\ProgramData\Tabeza\test-direct.prn' | Out-Printer -Name 'EPSON L3210 Series'" 2>nul
if %errorlevel% equ 0 (
    echo ✅ PowerShell Out-Printer: SUCCESS
) else (
    echo ❌ PowerShell Out-Printer: FAILED
)

echo.
echo Method 3: Bridge service forwarding
echo Testing if bridge service can forward...
powershell -Command "Get-Content 'C:\ProgramData\Tabeza\test-direct.prn' | Out-Printer -Name 'EPSON L3210 Series'" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Bridge forwarding: SUCCESS
) else (
    echo ❌ Bridge forwarding: FAILED
)

echo.
echo Checking printer status...
powershell -Command "Get-Printer -Name 'EPSON L3210 Series' | Select-Object Name,PrinterStatus" 2>nul

echo.
echo Checking for print jobs in queue...
powershell -Command "Get-PrintJob -PrinterName 'EPSON L3210 Series'" 2>nul

echo.
echo ========================================
echo DEBUG COMPLETE
echo ========================================
echo.
echo Results Summary:
echo - Bridge Config: Found
echo - Direct Copy: [Result above]
echo - PowerShell Print: [Result above]
echo - Bridge Forwarding: [Result above]
echo - Printer Status: [Result above]
echo - Print Jobs: [Result above]
echo.
echo If bridge forwarding works but physical printer doesn't print:
echo 1. Check if EPSON is online and ready
echo 2. Check if USB001 is the correct port
echo 3. Check if printer has paper and is online
echo.
pause
