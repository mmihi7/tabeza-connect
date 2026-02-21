@echo off
echo ========================================
echo USING CORRECT PORT CREATION METHOD
echo ========================================
echo.

echo tcpmon.dll is for TCP/IP ports, not local ports
echo Let's use the correct Windows method...
echo.

:: Step 1: Try PowerShell Local Port method
echo [1/3] Using PowerShell Local Port method...
powershell -Command "Add-PrinterPort -Name 'C:\TabezaPrints' -PrinterHostAddress 'C:\TabezaPrints'" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Port created via PowerShell Local Port
    goto :verify
)

:: Step 2: Try using printui.dll with correct parameters
echo.
echo [2/3] Using printui.dll with correct parameters...
rundll32 printui.dll,PrintUIEntry /if /b "EPSON Bridge" /f "%windir%\inf\ntprint.inf" /r "C:\TabezaPrints" /m "Generic / Text Only" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Port created via printui.dll
    goto :verify
)

:: Step 3: Try using WMI method
echo.
echo [3/3] Using WMI method...
powershell -Command "wmic printer call AddPrinterPort('C:\TabezaPrints')" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Port created via WMI
    goto :verify
)

echo ❌ All methods failed, trying manual approach...
goto :manual

:verify
echo.
echo Verifying port creation...
powershell -Command "Get-PrinterPort | Where-Object {$_.Name -like '*Tabeza*'} | Select-Object Name,Description"
goto :end

:manual
echo.
echo ========================================
echo MANUAL PORT CREATION
echo ========================================
echo.
echo Since automatic methods failed, let's create port manually:
echo.
echo 1. Open Command Prompt as Administrator
echo 2. Type: net port create "C:\TabezaPrints" /local
echo 3. Press Enter
echo 4. Type: net stop spooler && net start spooler
echo 5. Press Enter
echo.
echo This should create the port manually
echo.

:end
echo.
echo ========================================
echo PORT CREATION ATTEMPT COMPLETE
echo ========================================
echo.
echo Next steps:
echo   1. If port was created: Configure EPSON to use it
echo   2. If port creation failed: Try alternative approach
echo   3. If all fails: Use USB001 + virtual printer
echo.

pause
