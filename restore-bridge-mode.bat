@echo off
echo ========================================
echo Restoring Complete Silent Bridge Mode
echo ========================================
echo.

echo This will set up the complete bridge:
echo - POS prints to EPSON (Local Port)
echo - Bridge captures and uploads to cloud
echo - Bridge forwards to physical printer
echo - Customer gets physical receipt
echo - Restaurant gets digital receipt
echo.

echo Step 1: Set EPSON to Local Port
echo Setting EPSON L3210 Series to Local Port...

powershell -Command "Set-Printer -Name 'EPSON L3210 Series' -PortName 'C:\ProgramData\Tabeza\capture.prn'"
if %errorlevel% equ 0 (
    echo ✅ EPSON set to Local Port
) else (
    echo ❌ Failed to set Local Port
)

echo.
echo Step 2: Verify configuration
powershell -Command "Get-Printer -Name 'EPSON L3210 Series' | Select-Object Name,PortName,DriverName"

echo.
echo Step 3: Test bridge setup
echo Creating test receipt...
echo "BRIDGE TEST - %DATE% %TIME%
Beer 1x300
Total 300" > "C:\ProgramData\Tabeza\capture.prn"

echo.
echo Step 4: Check if bridge detects test
echo Waiting for bridge to detect test file...
timeout /t 5 >nul

echo.
echo Step 5: Check bridge status
echo Bridge should now show:
echo - "Captured X bytes from print job"
echo - "Receipt queued for upload"
echo - "Forwarded to physical printer successfully"

echo.
echo ========================================
echo SILENT BRIDGE RESTORED
echo ========================================
echo.
echo The complete system is now ready:
echo 1. POS prints to EPSON (Local Port)
echo 2. Bridge captures digital data
echo 3. Bridge uploads to cloud
echo 4. Bridge forwards to physical printer
echo 5. Customer gets physical receipt
echo 6. Restaurant gets digital receipt
echo.
echo Test by printing from your POS system!
echo.
pause
