@echo off
echo ========================================
echo ALTERNATIVE VIRTUAL PRINTER SETUP
echo ========================================
echo.

echo Since virtual printer creation failed, let's try
echo alternative approaches to get your POS to print to folder port
echo.

:: Check admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: This script requires Administrator privileges.
    pause
    exit /b 1
)

echo ✅ Running as Administrator

:: Step 1: Check available printer drivers
echo.
echo [1/4] Checking available printer drivers...
powershell -Command "Get-PrinterDriver | Select-Object Name | Where-Object {$_.Name -like '*Generic*' -or $_.Name -like '*Microsoft*' -or $_.Name -like '*Text*'}"

:: Step 2: Try Microsoft XPS Document Writer approach
echo.
echo [2/4] Trying Microsoft XPS approach...
powershell -Command "Add-Printer -Name 'Tabeza Bridge' -DriverName 'Microsoft XPS Document Writer' -PortName 'C:\ProgramData\Tabeza\TabezaPrints\'" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Microsoft XPS printer created successfully
    goto :verify
)

:: Step 3: Try Print to PDF approach
echo.
echo [3/4] Trying Print to PDF approach...
powershell -Command "Add-Printer -Name 'Tabeza Bridge' -DriverName 'Microsoft Print to PDF' -PortName 'C:\ProgramData\Tabeza\TabezaPrints\'" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Print to PDF printer created successfully
    goto :verify
)

:: Step 4: Try creating port first, then printer
echo.
echo [4/4] Creating port first, then printer...
powershell -Command "Add-PrinterPort -Name 'TabezaPort' -PrinterHostAddress 'C:\ProgramData\Tabeza\TabezaPrints\'" 2>nul
powershell -Command "Add-Printer -Name 'Tabeza Bridge' -DriverName 'Generic / Text Only' -PortName 'TabezaPort'" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Port + printer created successfully
    goto :verify
)

echo ❌ All virtual printer creation methods failed
goto :alternative

:verify
echo.
echo Verifying created printer...
powershell -Command "Get-Printer -Name 'Tabeza Bridge' | Select-Object Name,PortName,DriverName"
goto :end

:alternative
echo.
echo ========================================
echo ALTERNATIVE APPROACHES
echo ========================================
echo.
echo Since virtual printer creation failed, here are alternatives:
echo.
echo Option 1: Manual POS Configuration
echo   - Check your POS for "Add Printer" or "New Printer"
echo   - Look for "File" or "Folder" port options
echo   - Configure to print to: C:\ProgramData\Tabeza\TabezaPrints\
echo.
echo Option 2: Use Existing Printers
echo   - Check if POS has "Microsoft Print to PDF" option
echo   - Set output folder to: C:\ProgramData\Tabeza\TabezaPrints\
echo.
echo Option 3: Direct File Port
echo   - Configure EPSON to use file port (already done)
echo   - Configure POS to use EPSON (should work now)
echo.
echo Option 4: Windows Default Printer
echo   - Set EPSON as Windows default printer
echo   - Configure POS to use "Default Printer"
echo.

:end
echo.
pause
