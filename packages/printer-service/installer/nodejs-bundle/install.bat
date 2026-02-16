@echo off
REM Tabeza Connect Installer
REM Version 1.0.0

echo ========================================
echo Tabeza Connect Installer
echo ========================================
echo.

REM Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This installer must be run as Administrator
    echo.
    echo Right-click this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo This installer will:
echo   1. Install Tabeza Connect to C:\Program Files\Tabeza
echo   2. Create watch folder at C:\TabezaPrints
echo   3. Configure virtual printer
echo   4. Register Windows service
echo.

set /p CONTINUE="Continue with installation? (Y/N): "
if /i not "%CONTINUE%"=="Y" (
    echo Installation cancelled.
    pause
    exit /b 0
)

echo.
echo ========================================
echo Step 1: Collecting Configuration
echo ========================================
echo.

set /p BAR_ID="Enter your Bar ID: "
if "%BAR_ID%"=="" (
    echo ERROR: Bar ID is required
    pause
    exit /b 1
)

set API_URL=https://staff.tabeza.co.ke
echo Using API URL: %API_URL%
echo.

echo ========================================
echo Step 2: Installing Files
echo ========================================
echo.

set INSTALL_DIR=C:\Program Files\Tabeza

REM Create installation directory
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

REM Copy Node.js runtime
echo Copying Node.js runtime...
xcopy /E /I /Y "%~dp0nodejs" "%INSTALL_DIR%\nodejs" >nul
if %errorLevel% neq 0 (
    echo ERROR: Failed to copy Node.js runtime
    pause
    exit /b 1
)
echo   Done

REM Copy service files
echo Copying service files...
xcopy /E /I /Y "%~dp0service" "%INSTALL_DIR%\nodejs\service" >nul
if %errorLevel% neq 0 (
    echo ERROR: Failed to copy service files
    pause
    exit /b 1
)
echo   Done

REM Copy scripts
echo Copying installer scripts...
xcopy /E /I /Y "%~dp0scripts" "%INSTALL_DIR%\scripts" >nul
echo   Done

echo.
echo ========================================
echo Step 3: Creating Watch Folder
echo ========================================
echo.

powershell -ExecutionPolicy Bypass -File "%INSTALL_DIR%\scripts\create-folders.ps1"
if %errorLevel% neq 0 (
    echo WARNING: Watch folder creation had issues
    echo You may need to create C:\TabezaPrints manually
)

echo.
echo ========================================
echo Step 4: Configuring Printer
echo ========================================
echo.

powershell -ExecutionPolicy Bypass -File "%INSTALL_DIR%\scripts\configure-printer.ps1"
if %errorLevel% neq 0 (
    echo WARNING: Printer configuration had issues
    echo You may need to configure the printer manually
)

echo.
echo ========================================
echo Step 5: Registering Service
echo ========================================
echo.

powershell -ExecutionPolicy Bypass -File "%INSTALL_DIR%\scripts\register-service.ps1" -InstallPath "%INSTALL_DIR%" -BarId "%BAR_ID%" -ApiUrl "%API_URL%"
if %errorLevel% neq 0 (
    echo ERROR: Service registration failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Tabeza Connect has been installed successfully.
echo.
echo Service Status: http://localhost:8765/api/status
echo Configuration: http://localhost:8765/configure.html
echo.
echo Next Steps:
echo   1. Configure your POS to print to "Tabeza Receipt Printer"
echo   2. Test by printing a receipt from your POS
echo   3. Check the service status in your browser
echo.
echo The service will start automatically on system boot.
echo.
pause
