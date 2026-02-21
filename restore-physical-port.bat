@echo off
echo ========================================
echo Restoring EPSON Physical Port
echo ========================================
echo.

echo Current printer configuration:
powershell -Command "Get-Printer -Name 'EPSON L3210 Series' | Select-Object Name,PortName,DriverName"

echo.
echo The EPSON printer is currently pointing to FILE PORT
echo We need to restore it to USB001 for physical printing
echo.

echo Step 1: Check bridge config for original port
if exist "C:\ProgramData\Tabeza\bridge-config.json" (
    echo Found bridge config:
    powershell -Command "Get-Content 'C:\ProgramData\Tabeza\bridge-config.json' | ConvertFrom-Json | Select-Object physicalPort"
) else (
    echo Bridge config not found, assuming USB001
)

echo.
echo Step 2: Restore EPSON to physical USB port
echo Setting EPSON L3210 Series back to USB001...

powershell -Command "Set-Printer -Name 'EPSON L3210 Series' -PortName 'USB001'"
if %errorlevel% equ 0 (
    echo ✅ Port restored to USB001
) else (
    echo ❌ Failed to restore port
)

echo.
echo Step 3: Verify new configuration
powershell -Command "Get-Printer -Name 'EPSON L3210 Series' | Select-Object Name,PortName,DriverName"

echo.
echo Step 4: Test physical printing
echo Sending test print to USB001...
echo "TEST PRINT - %DATE% %TIME%" > \\.\USB001 2>nul
if %errorlevel% equ 0 (
    echo ✅ Direct USB001 access: SUCCESS
) else (
    echo ❌ Direct USB001 access: FAILED
)

echo.
echo Step 5: Test with Notepad
echo Try printing from Notepad to verify physical printing works
echo.
echo INSTRUCTIONS:
echo 1. Open Notepad
echo 2. Type "TEST RECEIPT - RESTORED"
echo 3. Print to "EPSON L3210 Series"
echo 4. Should print to physical printer now
echo.

echo ========================================
echo PORT RESTORATION COMPLETE
echo ========================================
echo.
echo If physical printing works now:
echo - Bridge will work correctly
echo - Digital capture + physical printing will work
echo.
echo If still no printing:
echo - Check USB cable connection
echo - Check printer power and paper
echo - Restart printer
echo.
pause
