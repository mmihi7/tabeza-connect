@echo off
REM TabezaConnect Launcher - One Click Setup
REM For bar owners - simple, automatic, user-friendly

title TabezaConnect v1.7.0

echo.
echo ========================================
echo     TabezaConnect v1.7.0 Launcher
echo ========================================
echo.

REM Check if already configured
if exist "C:\ProgramData\Tabeza\configured.flag" (
    echo TabezaConnect is already configured.
    echo Starting service and tray app...
    goto :start_services
)

echo Welcome to TabezaConnect!
echo.
echo This will automatically:
echo 1. Configure your Bar ID
echo 2. Setup printer detection
echo 3. Start the service
echo 4. Launch the tray app
echo.

REM Step 1: Get Bar ID
echo [Step 1/4] Bar ID Setup
echo --------------------
echo.
echo Please find your Bar ID in Tabeza Staff App:
echo  - Open Tabeza Staff App
echo  - Go to Settings → Printer Setup  
echo  - Copy your Bar ID
echo.

:input_barid
set /p BARID="Enter your Bar ID: "
if "%BARID%"=="" (
    echo ERROR: Bar ID is required!
    goto :input_barid
)

echo Bar ID configured: %BARID%
echo.

REM Step 2: Create configuration
echo [Step 2/4] Creating Configuration...
echo ------------------------------

if not exist "C:\ProgramData\Tabeza" mkdir "C:\ProgramData\Tabeza"

REM Create config file
echo { > "C:\ProgramData\Tabeza\config.json"
echo   "barId": "%BARID%", >> "C:\ProgramData\Tabeza\config.json"
echo   "apiUrl": "https://api.tabeza.co.ke", >> "C:\ProgramData\Tabeza\config.json"
echo   "captureMode": "pooling", >> "C:\ProgramData\Tabeza\config.json"
echo   "version": "1.7.0" >> "C:\ProgramData\Tabeza\config.json"
echo } >> "C:\ProgramData\Tabeza\config.json"

echo Configuration created successfully!
echo.

REM Step 3: Printer setup guidance
echo [Step 3/4] Printer Setup
echo -------------------------
echo.
echo TabezaConnect will automatically detect your thermal printer.
echo Please ensure:
echo - Printer is connected and powered on
echo - Printer drivers are installed
echo.

echo Printer setup will be handled automatically...
echo.

REM Mark as configured
echo configured > "C:\ProgramData\Tabeza\configured.flag"

REM Step 4: Start services
:start_services
echo [Step 4/4] Starting TabezaConnect
echo --------------------------------

echo Starting TabezaConnect service...
cd /d "C:\Program Files\TabezaConnect"
start /B "" "tabeza-service.exe"

REM Wait a moment for service to start
timeout /t 3 /nobreak >nul

echo Starting TabezaConnect tray app...
start "" "TabezaConnect.exe" --minimized

REM Add tray app to Windows startup for future logins
echo Adding TabezaConnect to Windows startup...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "TabezaConnect" /t REG_SZ /d "\"C:\Program Files\TabezaConnect\TabezaConnect.exe\"" /f >nul 2>&1

echo.
echo ✅ TabezaConnect is now running!
echo.
echo You should see the TabezaConnect icon in your system tray.
echo TabezaConnect will automatically start when you log in to Windows.
echo.
echo Next steps:
echo - Print a test receipt from your POS system
echo - Right-click the tray icon for options
echo - Use "Template Generator" to setup AI parsing
echo.
echo For support: support@tabeza.co.ke
echo.

REM Auto-close after 10 seconds
echo Closing this window in 10 seconds...
timeout /t 10 /nobreak >nul

exit
