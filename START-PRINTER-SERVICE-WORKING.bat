@echo off
echo ========================================
echo   Tabeza Printer Service
echo ========================================
echo.

REM Set environment variables for configuration
set TABEZA_BAR_ID=438c80c1-fe11-4ac5-8a48-2fc45104ba31
set TABEZA_API_URL=https://tabz-kikao.vercel.app

echo Starting printer service with:
echo   Bar ID: %TABEZA_BAR_ID%
echo   API URL: %TABEZA_API_URL%
echo.
echo Keep this window open while the service is running.
echo Press Ctrl+C to stop the service.
echo.

REM Run the Node.js service from source
cd /d "%~dp0"
node packages/printer-service/index.js

pause
