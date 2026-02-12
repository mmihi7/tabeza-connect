@echo off
echo ========================================
echo   Tabeza Printer Service (From Source)
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
echo   Watch Folder: C:\Users\%USERNAME%\TabezaPrints
echo.
echo Keep this window open while the service is running.
echo Press Ctrl+C to stop the service.
echo.
pause

REM Navigate to printer service source folder
cd /d C:\Projects\Tabz\packages\printer-service

REM Set environment variables
set TABEZA_BAR_ID=%BAR_ID%
set TABEZA_API_URL=https://tabz-kikao.vercel.app

echo Starting printer service from source code...
echo.

REM Run from source using Node.js
node index.js

pause
