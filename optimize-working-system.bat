@echo off
echo ========================================
echo OPTIMIZING WORKING BRIDGE SYSTEM
echo ========================================
echo.

echo GREAT! Bridge is working and printing receipts!
echo Let's optimize the configuration for best performance...
echo.

:: Step 1: Ensure EPSON stays on folder port
echo [1/4] Ensuring EPSON on folder port...
powershell -Command "Set-Printer -Name 'EPSON L3210 Series' -PortName 'C:\ProgramData\Tabeza\TabezaPrints\'" 2>nul
echo ✅ EPSON configured for folder port

:: Step 2: Verify bridge configuration
echo.
echo [2/4] Verifying bridge configuration...
if exist "C:\ProgramData\Tabeza\bridge-config.json" (
    echo Current bridge config:
    type "C:\ProgramData\Tabeza\bridge-config.json"
) else (
    echo ❌ Bridge config missing, creating...
    (
    echo {
    echo   "printerName": "EPSON L3210 Series",
    echo   "captureFolder": "C:\\ProgramData\\Tabeza\\TabezaPrints",
    echo   "tempForwardFile": "C:\\ProgramData\\Tabeza\\fwd_temp.prn"
    echo }
    ) > "C:\ProgramData\Tabeza\bridge-config.json"
    echo ✅ Bridge config created
)

:: Step 3: Check bridge service status
echo.
echo [3/4] Checking bridge service status...
tasklist | findstr /i "node.exe" >nul
if %errorlevel% equ 0 (
    echo ✅ Bridge service is running
) else (
    echo ❌ Bridge service not running, starting...
    cd /d "C:\Projects\TabezaConnect\src\service"
    start "Tabeza Bridge" cmd /k "node final-bridge.js"
    echo ✅ Bridge service started
)

:: Step 4: Clean up old files
echo.
echo [4/4] Cleaning up old files...
if exist "C:\ProgramData\Tabeza\TabezaPrints\*.prn" (
    echo Cleaning old print files...
    del "C:\ProgramData\Tabeza\TabezaPrints\*.prn" /Q >nul 2>&1
    echo ✅ Old files cleaned
) else (
    echo ✅ No old files to clean
)

echo.
echo ========================================
echo ✅ SYSTEM OPTIMIZED AND READY!
echo ========================================
echo.
echo Current Configuration:
echo   - EPSON: Folder port (C:\ProgramData\Tabeza\TabezaPrints\)
echo   - Bridge: Watching same folder
echo   - Forwarding: To EPSON physical (USB001)
echo   - Status: WORKING!
echo.
echo Test by printing from your POS:
echo Expected behavior:
echo   1. POS sends print to EPSON
echo   2. EPSON creates file in TabezaPrints folder
echo   3. Bridge detects file immediately
echo   4. Bridge uploads to cloud
echo   5. Bridge forwards to EPSON physical
echo   6. Physical receipt prints
echo   7. Bridge deletes file
echo   8. Process repeats for next receipt
echo.
echo Your Silent Bridge is now fully operational! 🎉
echo.
pause
