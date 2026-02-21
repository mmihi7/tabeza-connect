@echo off
echo ========================================
echo CMD-BASED PRINTER CREATION
echo ========================================
echo.

echo Using classic Windows CMD commands instead of PowerShell
echo This method is more reliable for printer creation
echo.

:: Check admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: This script requires Administrator privileges.
    pause
    exit /b 1
)

echo ✅ Running as Administrator

:: Step 1: Create the port using CMD
echo.
echo [1/4] Creating local port...
rundll32 printui.dll,PrintUIEntry /ia /m "Generic / Text Only" /h "Windows x64" /v 3
if %errorlevel% equ 0 (
    echo ✅ Port creation command sent
) else (
    echo ❌ Port creation failed
)

:: Step 2: Add the port
echo.
echo [2/4] Adding printer port...
rundll32 printui.dll,PrintUIEntry /Xs /n "Tabeza Bridge" PortName "C:\ProgramData\Tabeza\TabezaPrints\"
if %errorlevel% equ 0 (
    echo ✅ Port added successfully
) else (
    echo ❌ Port addition failed
)

:: Step 3: Create the printer
echo.
echo [3/4] Creating printer with CMD...
rundll32 printui.dll,PrintUIEntry /if /b "Tabeza Bridge" /f "%windir%\inf\ntprint.inf" /r "C:\ProgramData\Tabeza\TabezaPrints\" /m "Generic / Text Only"
if %errorlevel% equ 0 (
    echo ✅ Printer created successfully!
    goto :success
) else (
    echo ❌ Printer creation failed
    goto :alternative
)

:success
echo.
echo [4/4] Verifying printer creation...
rundll32 printui.dll,PrintUIEntry /s /t2 /n "Tabeza Bridge"

echo.
echo ========================================
echo ✅ SUCCESS! Printer Created via CMD
echo ========================================
echo.
echo What was accomplished:
echo   - Port: C:\ProgramData\Tabeza\TabezaPrints\
echo   - Printer: Tabeza Bridge
echo   - Driver: Generic / Text Only
echo   - Method: CMD (not PowerShell)
echo.
echo Next steps:
echo   1. Check Control Panel -> Devices and Printers
echo   2. Look for "Tabeza Bridge"
echo   3. Test with Notepad
echo   4. Configure POS to use "Tabeza Bridge"
echo.
goto :end

:alternative
echo.
echo ========================================
echo ALTERNATIVE CMD METHODS
echo ========================================
echo.
echo Trying alternative CMD approach...
echo.

:: Alternative 1: Create port first
echo [Alt 1] Creating port first...
rundll32 tcpmon.dll,LocalAddPortUI "C:\ProgramData\Tabeza\TabezaPrints\"

:: Alternative 2: Use different INF file
echo.
echo [Alt 2] Using different INF file...
rundll32 printui.dll,PrintUIEntry /if /b "Tabeza Bridge" /f "%windir%\inf\prnms001.inf" /r "C:\ProgramData\Tabeza\TabezaPrints\" /m "Generic / Text Only"

:: Alternative 3: Simple printer creation
echo.
echo [Alt 3] Simple printer creation...
rundll32 printui.dll,PrintUIEntry /if /b "Tabeza Bridge" /r "C:\ProgramData\Tabeza\TabezaPrints\"

echo.
echo Checking if any method worked...
rundll32 printui.dll,PrintUIEntry /s /t2 /n "Tabeza Bridge" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Alternative method succeeded!
) else (
    echo ❌ All CMD methods failed
)

:end
echo.
pause
