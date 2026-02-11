@echo off
echo ========================================
echo   Tabeza Connect - Electron Launcher
echo ========================================
echo.

REM Change to the printer-service directory
cd /d "%~dp0"

echo Current directory: %CD%
echo.
echo Starting Electron app...
echo.

REM Run electron from the printer-service directory
pnpm start

pause
