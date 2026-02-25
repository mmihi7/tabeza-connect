@echo off
echo Starting TabezaConnect Tray App with Debug...
echo.

REM Run electron and keep window open
.\node_modules\electron\dist\electron.exe test-tray-simple.js

echo.
echo Electron exited with code: %errorlevel%
echo.
pause
