@echo off
echo ========================================
echo   Tabeza Printer Service Setup
echo ========================================
echo.

REM Navigate to Downloads folder
cd /d "%USERPROFILE%\Downloads"

REM Check if exe exists
if not exist "tabeza-printer-service.exe" (
    echo ERROR: tabeza-printer-service.exe not found in Downloads folder
    echo.
    echo Please make sure the file is in: %USERPROFILE%\Downloads
    pause
    exit /b 1
)

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

REM Check for Vercel bypass token (optional but recommended)
if defined VERCEL_BYPASS_TOKEN (
    echo   Vercel Bypass: Configured
) else (
    echo   Vercel Bypass: Not configured (optional)
)

echo.
echo Keep this window open while the service is running.
echo Press Ctrl+C to stop the service.
echo.
pause

REM Set environment variables for the service
set TABEZA_BAR_ID=%BAR_ID%
set TABEZA_API_URL=https://tabz-kikao.vercel.app

REM Set Vercel bypass token if available
if defined VERCEL_AUTOMATION_BYPASS_SECRET (
    set VERCEL_BYPASS_TOKEN=%VERCEL_AUTOMATION_BYPASS_SECRET%
)
else if defined VERCEL_BYPASS_TOKEN (
    set VERCEL_BYPASS_TOKEN=%VERCEL_BYPASS_TOKEN%
)

echo Starting printer service with environment variables...
echo.

REM Start the service with environment variables
tabeza-printer-service.exe

pause
