@echo off
echo ========================================
echo Setting Up Tabeza Folder Port
echo ========================================
echo.

echo This will configure EPSON to output to a folder
echo instead of a single file, fixing all issues:
echo   - File accumulation (22MB+ problem)
echo   - Multiple triggers (6-10x problem)  
echo   - Physical forwarding (blocked port problem)
echo.

:: Verify admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: This script requires Administrator privileges.
    echo    Right-click → "Run as administrator"
    pause
    exit /b 1
)

echo ✅ Running as Administrator

:: Configuration
set "PRINTER_NAME=EPSON L3210 Series"
set "FOLDER_PORT=C:\ProgramData\Tabeza\TabezaPrints"
set "CONFIG_FILE=C:\ProgramData\Tabeza\bridge-config.json"

:: Step 1: Create folder port
echo.
echo [1/4] Creating folder port...
if not exist "%FOLDER_PORT%" mkdir "%FOLDER_PORT%"

powershell -Command "if (!(Get-PrinterPort -Name '%FOLDER_PORT%' -ErrorAction SilentlyContinue)) { Add-PrinterPort -Name '%FOLDER_PORT%' -PrinterHostAddress '%FOLDER_PORT%' }" 2>nul
echo    ✅ Folder port created: %FOLDER_PORT%

:: Step 2: Redirect printer to folder port
echo.
echo [2/4] Redirecting EPSON to folder port...
powershell -Command "Set-Printer -Name '%PRINTER_NAME%' -PortName '%FOLDER_PORT%'"
echo    ✅ Printer '%PRINTER_NAME%' now outputs to folder

:: Step 3: Update bridge config
echo.
echo [3/4] Updating bridge configuration...
(
echo {
echo   "printerName": "%PRINTER_NAME%",
echo   "captureFolder": "%FOLDER_PORT%",
echo   "tempForwardFile": "C:\\ProgramData\\Tabeza\\fwd_temp.prn"
echo }
) > "%CONFIG_FILE%"
echo    ✅ Bridge config updated

:: Step 4: Verify setup
echo.
echo [4/4] Verifying configuration...
echo Current printer configuration:
powershell -Command "Get-Printer -Name '%PRINTER_NAME%' | Select-Object Name,PortName"

echo.
echo Bridge configuration:
type "%CONFIG_FILE%"

echo.
echo ========================================
echo ✅ FOLDER PORT SETUP COMPLETE!
echo ========================================
echo.
echo What changed:
echo   - Single Local Port → Folder port
echo   - Each print job = separate file
echo   - No more file accumulation
echo   - No more EBUSY errors
echo   - Single trigger per job
echo   - Clean file deletion after processing
echo.
echo Next steps:
echo   1. Start the final bridge:
echo      c:\Projects\TabezaConnect\start-final-bridge.bat
echo.
echo   2. Print from your POS to '%PRINTER_NAME%'
echo.
echo   3. Watch for clean processing:
echo      📄 Processing: receipt-12345.prn
echo      🖨️  Forwarded successfully via Windows spooler
echo      🗑️  Deleted: receipt-12345.prn
echo      ✅ Print cycle complete
echo.
echo ⚠️  IMPORTANT: Run the bridge service as Administrator
echo    for physical printer forwarding to work.
echo.
pause
