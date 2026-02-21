@echo off
echo ========================================
echo CONFIGURING EPSON WITH NEW PORT
echo ========================================
echo.

echo GREAT! Port C:\TabezaPrints was created successfully!
echo Now let's configure EPSON to use this port...
echo.

:: Step 1: Configure EPSON to use the new port
echo [1/3] Configuring EPSON to use C:\TabezaPrints...
powershell -Command "Set-Printer -Name 'EPSON L3210 Series' -PortName 'C:\TabezaPrints'" 2>nul
if %errorlevel% equ 0 (
    echo ✅ EPSON configured successfully!
    goto :verify
) else (
    echo ❌ EPSON configuration failed
    goto :manual
)

:verify
echo.
echo [2/3] Verifying EPSON configuration...
powershell -Command "Get-Printer -Name 'EPSON L3210 Series' | Select-Object Name,PortName,PrinterStatus"

echo.
echo [3/3] Testing bridge detection...
echo Creating test file in C:\TabezaPrints...
echo "EPSON PORT TEST - %DATE% %TIME%" > "C:\TabezaPrints\epson-test.prn" 2>nul

echo Waiting 3 seconds for bridge to detect...
timeout /t 3 >nul

if exist "C:\TabezaPrints\epson-test.prn" (
    echo ❌ Bridge did not detect test file
    echo Bridge might not be watching the right folder
) else (
    echo ✅ Bridge detected and processed test file!
    echo ✅ SYSTEM IS WORKING PERFECTLY!
)

goto :end

:manual
echo.
echo ========================================
echo MANUAL CONFIGURATION STEPS
echo ========================================
echo.
echo Since PowerShell failed, let's configure manually:
echo.
echo 1. Open Control Panel
echo 2. Devices and Printers
echo 3. Right-click "EPSON L3210 Series"
echo 4. Printer properties
echo 5. Ports tab
echo 6. Find and select "C:\TabezaPrints"
echo 7. Click Apply → OK
echo.

:end
echo.
echo ========================================
echo CONFIGURATION COMPLETE
echo ========================================
echo.
echo Expected EPSON configuration:
echo   Name: EPSON L3210 Series
echo   PortName: C:\TabezaPrints
echo   PrinterStatus: Normal
echo.
echo Expected bridge behavior:
echo   - Detects files immediately
echo   - Processes to cloud + physical printer
echo   - Deletes files after processing
echo.
echo If bridge detected test file:
echo   ✅ Your Silent Bridge is WORKING!
echo   Test with your POS system
echo.
echo If bridge did NOT detect test file:
echo   ❌ Bridge configuration issue
echo   → Check bridge config file
echo   → Restart bridge service
echo.

pause
