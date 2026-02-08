@echo off
REM ============================================================================
REM TABEZA TCP SERVER - Quick Start
REM ============================================================================

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║         TABEZA TCP SERVER - Starting...                   ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Set environment variables
set TABEZA_BAR_ID=6c4a27d3-b6ce-4bc0-b7fb-725116ea7936
set TABEZA_API_URL=http://localhost:3003

echo ✅ Environment configured
echo    Bar ID: %TABEZA_BAR_ID%
echo    API URL: %TABEZA_API_URL%
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js found
echo.

REM Check if printer is installed
powershell -Command "Get-Printer -Name 'TABEZA Test Printer' -ErrorAction SilentlyContinue" >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  WARNING: TABEZA Test Printer not found!
    echo.
    echo To install the printer, run (PowerShell as Admin):
    echo    .\setup-test-printer.ps1
    echo.
    echo Press any key to continue anyway, or Ctrl+C to exit...
    pause >nul
)

echo ✅ Starting TCP server...
echo.
echo ═══════════════════════════════════════════════════════════
echo.

REM Start the server
node tabeza-tcp-server.js

REM If server exits, show error
echo.
echo.
echo ❌ Server stopped unexpectedly!
echo.
pause
