@echo off
echo ========================================
echo COMPLETE BRIDGE DIAGNOSTIC
echo ========================================
echo.

echo Step 1: Check EPSON current configuration
echo Current EPSON settings:
powershell -Command "Get-Printer -Name 'EPSON L3210 Series' | Select-Object Name,PortName,DriverName,PrinterStatus"

echo.
echo Step 2: Check bridge configuration
if exist "C:\ProgramData\Tabeza\bridge-config.json" (
    echo Bridge config found:
    type "C:\ProgramData\Tabeza\bridge-config.json"
) else (
    echo ❌ Bridge config NOT found
)

echo.
echo Step 3: Check folder port exists
if exist "C:\ProgramData\Tabeza\TabezaPrints\" (
    echo ✅ Folder port exists
    echo Folder contents:
    dir "C:\ProgramData\Tabeza\TabezaPrints\" /B
) else (
    echo ❌ Folder port does NOT exist
)

echo.
echo Step 4: Check old file port
if exist "C:\ProgramData\Tabeza\capture.prn" (
    echo ⚠️  Old file port still exists
    echo File size:
    dir "C:\ProgramData\Tabeza\capture.prn" /B
) else (
    echo ✅ Old file port cleaned up
)

echo.
echo Step 5: Test manual print to folder
echo Creating test print in folder port...
echo "MANUAL TEST - %DATE% %TIME%" > "C:\ProgramData\Tabeza\TabezaPrints\bridge-test.prn"

echo.
echo Step 6: Check bridge service status
echo Checking if bridge is running...
tasklist | findstr /i "node.exe" >nul
if %errorlevel% equ 0 (
    echo ✅ Bridge service is running
) else (
    echo ❌ Bridge service is NOT running
)

echo.
echo Step 7: Test bridge detection
echo Waiting 5 seconds for bridge to detect test file...
timeout /t 5 >nul

echo.
echo Checking if bridge detected test file...
if exist "C:\ProgramData\Tabeza\TabezaPrints\bridge-test.prn" (
    echo ❌ Test file still exists - bridge not detecting
) else (
    echo ✅ Test file was processed - bridge working
)

echo.
echo ========================================
echo DIAGNOSTIC COMPLETE
echo ========================================
echo.
echo Results Analysis:
echo.
echo If EPSON PortName shows "C:\ProgramData\Tabeza\capture.prn":
echo    → EPSON still using old file port - RE-RUN SETUP
echo.
echo If bridge config shows wrong captureFolder:
echo    → Bridge watching wrong location - UPDATE CONFIG
echo.
echo If folder port doesn't exist:
echo    → Folder not created - CREATE MANUALLY
echo.
echo If test file still exists:
echo    → Bridge not watching folder - RESTART SERVICE
echo.
pause
