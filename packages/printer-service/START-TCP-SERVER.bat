@echo off
REM Start Tabeza TCP Server with correct configuration

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║         TABEZA TCP SERVER - Starting...                   ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Set environment variables
set TABEZA_BAR_ID=438c80c1-fe11-4ac5-8a48-2fc45104ba31
set TABEZA_API_URL=http://localhost:3003

echo ✅ Configuration:
echo    Bar ID: %TABEZA_BAR_ID%
echo    API URL: %TABEZA_API_URL%
echo.
echo Starting server...
echo.

REM Start the server
node tabeza-tcp-server.js

pause
