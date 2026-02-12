@echo off
echo ========================================
echo   Tabeza Printer Service Setup
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
echo ========================================
echo   Starting Printer Service
echo ========================================
echo.
echo Configuration:
echo   Bar ID: %BAR_ID%
echo   API URL: https://tabz-kikao.vercel.app
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

echo Starting printer service with your configuration...
echo.

REM Set environment variables for the service
set TABEZA_BAR_ID=%BAR_ID%
set TABEZA_API_URL=https://tabz-kikao.vercel.app

REM Start the service
tabeza-printer-service.exe

pause
