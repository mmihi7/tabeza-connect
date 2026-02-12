@echo off
echo ========================================
echo   Tabeza Printer Service Setup
echo ========================================
echo.

REM Navigate to Downloads folder first
cd /d "%USERPROFILE%\Downloads"

REM Check if exe exists
if not exist "tabeza-printer-service.exe" (
    echo ERROR: tabeza-printer-service.exe not found in Downloads folder
    echo.
    echo Please make sure the file is in: %USERPROFILE%\Downloads
    pause
    exit /b 1
)

REM Config file should be in same folder as exe
set CONFIG_FILE=%USERPROFILE%\Downloads\config.json

if exist "%CONFIG_FILE%" (
    echo Configuration file found!
    echo.
    type "%CONFIG_FILE%"
    echo.
    echo.
    set /p RECONFIG="Do you want to reconfigure? (y/N): "
    if /i not "%RECONFIG%"=="y" goto START_SERVICE
)

echo.
echo ========================================
echo   Configuration Required
echo ========================================
echo.
echo Please enter your Bar ID from Tabeza Settings.
echo You can find it at: https://tabz-kikao.vercel.app/settings
echo.
echo Example: 438c80c1-fe11-4ac5-8a48-2fc45104ba31
echo.

set /p BAR_ID="Enter your Bar ID: "

if "%BAR_ID%"=="" (
    echo.
    echo ERROR: Bar ID is required!
    pause
    exit /b 1
)

echo.
echo Creating configuration file...

REM Create config.json in same folder as exe
(
echo {
echo   "barId": "%BAR_ID%",
echo   "apiUrl": "https://tabz-kikao.vercel.app",
echo   "watchFolder": "C:\\Users\\%USERNAME%\\TabezaPrints"
echo }
) > "%CONFIG_FILE%"

echo.
echo Configuration saved to: %CONFIG_FILE%
echo.

:START_SERVICE
echo ========================================
echo   Starting Printer Service
echo ========================================
echo.
echo Keep this window open while the service is running.
echo Press Ctrl+C to stop the service.
echo.
pause

cd /d "%USERPROFILE%\Downloads"

if not exist "tabeza-printer-service.exe" (
    echo ERROR: tabeza-printer-service.exe not found in Downloads folder
    echo.
    echo Please make sure the file is in: %USERPROFILE%\Downloads
    pause
    exit /b 1
)

echo Starting printer service...
echo.
tabeza-printer-service.exe

pause
