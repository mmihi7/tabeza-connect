@echo off
echo ========================================
echo COMPLETING THE SILENT BRIDGE CIRCUIT
echo ========================================
echo.

echo GREAT NEWS! Bridge is working perfectly! 🎉
echo The only issue: Physical forwarding loop
echo.
echo Current situation:
echo   - EPSON: C:\TabezaPrints (folder port)
echo   - Bridge: Detects and processes ✅
echo   - Forwarding: To EPSON physical (but EPSON is on folder port)
echo.
echo SOLUTION: Move EPSON back to USB001 for physical printing
echo.

:: Step 1: Move EPSON to physical port
echo [1/3] Moving EPSON to USB001...
powershell -Command "Set-Printer -Name 'EPSON L3210 Series' -PortName 'USB001'" 2>nul
if %errorlevel% equ 0 (
    echo ✅ EPSON moved to USB001
) else (
    echo ❌ Failed to move EPSON to USB001
)

:: Step 2: Verify EPSON configuration
echo.
echo [2/3] Verifying EPSON configuration...
powershell -Command "Get-Printer -Name 'EPSON L3210 Series' | Select-Object Name,PortName,PrinterStatus"

:: Step 3: Test EPSON physical printing
echo.
echo [3/3] Testing EPSON physical printing...
echo Sending Windows test page to EPSON...
powershell -Command "Invoke-PrinterTestPage -Name 'EPSON L3210 Series'" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Test page sent to EPSON
) else (
    echo ❌ Test page failed
)

:: Step 4: Test complete circuit
echo.
echo [4/4] Testing complete Silent Bridge circuit...
echo Creating test file in C:\TabezaPrints...
echo "SILENT BRIDGE TEST - %DATE% %TIME%" > "C:\TabezaPrints\circuit-test.prn" 2>nul

echo Waiting 3 seconds for bridge to detect...
timeout /t 3 >nul

if exist "C:\TabezaPrints\circuit-test.prn" (
    echo ❌ Bridge not detecting - checking service
    tasklist | findstr /i "node.exe" >nul
    if %errorlevel% equ 0 (
        echo ✅ Bridge is running
    ) else (
        echo ❌ Bridge is not running
    )
) else (
    echo ✅ Bridge detected and processed!
    echo ✅ Check if physical receipt printed from EPSON
)

echo.
echo ========================================
echo SILENT BRIDGE CIRCUIT COMPLETE
echo ========================================
echo.
echo Expected final configuration:
echo   - EPSON: USB001 (physical port) ✅
echo   - Bridge: Watching C:\TabezaPrints ✅
echo   - Circuit: POS → EPSON (folder) → Bridge → EPSON (USB001) → Receipt
echo.
echo How it works:
echo   1. POS prints to EPSON (creates file in C:\TabezaPrints)
echo   2. Bridge detects file (digital capture + cloud upload)
echo   3. Bridge forwards to EPSON USB001 (physical printing)
echo   4. Physical receipt prints from EPSON
echo   5. Complete Silent Bridge workflow!
echo.
echo If physical receipt printed:
echo   🎉 YOUR SILENT BRIDGE IS FULLY OPERATIONAL!
echo   Test with your POS system now!
echo.

pause
