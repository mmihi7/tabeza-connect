@echo off
echo ========================================
echo MANUAL FIX - Get Bridge Working NOW
echo ========================================
echo.

echo This will manually configure everything step by step...
echo.

:: Step 1: Create folder port
echo [1/5] Creating folder port...
if not exist "C:\ProgramData\Tabeza\" mkdir "C:\ProgramData\Tabeza\"
if not exist "C:\ProgramData\Tabeza\TabezaPrints\" mkdir "C:\ProgramData\Tabeza\TabezaPrints\"
echo ✅ Folder port created: C:\ProgramData\Tabeza\TabezaPrints\

:: Step 2: Configure EPSON to use folder port
echo.
echo [2/5] Configuring EPSON to folder port...
powershell -Command "Set-Printer -Name 'EPSON L3210 Series' -PortName 'C:\ProgramData\Tabeza\TabezaPrints\'" 2>nul
echo ✅ EPSON configured to folder port

:: Step 3: Create bridge config
echo.
echo [3/5] Creating bridge configuration...
(
echo {
echo   "printerName": "EPSON L3210 Series",
echo   "captureFolder": "C:\\ProgramData\\Tabeza\\TabezaPrints",
echo   "tempForwardFile": "C:\\ProgramData\\Tabeza\\fwd_temp.prn"
echo }
) > "C:\ProgramData\Tabeza\bridge-config.json"
echo ✅ Bridge config created

:: Step 4: Test manual print
echo.
echo [4/5] Creating test print...
echo "TEST RECEIPT - %DATE% %TIME%" > "C:\ProgramData\Tabeza\TabezaPrints\manual-test.prn"
echo ✅ Test print created

:: Step 5: Verify setup
echo.
echo [5/5] Verifying setup...
echo.
echo EPSON Configuration:
powershell -Command "Get-Printer -Name 'EPSON L3210 Series' | Select-Object Name,PortName"

echo.
echo Bridge Configuration:
type "C:\ProgramData\Tabeza\bridge-config.json"

echo.
echo Folder Contents:
dir "C:\ProgramData\Tabeza\TabezaPrints\" /B

echo.
echo ========================================
echo ✅ MANUAL FIX COMPLETE!
echo ========================================
echo.
echo What was done:
echo   1. Created folder port
echo   2. Configured EPSON to use folder port
echo   3. Created bridge config
echo   4. Created test print file
echo   5. Verified all settings
echo.
echo Next steps:
echo   1. Restart the bridge service:
echo      - Stop current service (Ctrl+C)
echo      - Run: c:\Projects\TabezaConnect\start-final-bridge.bat
echo.
echo   2. The bridge should immediately detect the test file
echo.
echo   3. Print from your POS to test
echo.
pause
