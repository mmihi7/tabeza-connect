@echo off
echo Testing Electron child process spawn...
echo.

cd /d "%~dp0"

echo Step 1: Testing with node directly
echo =====================================
node debug-electron.js

echo.
echo.
echo Step 2: Testing simple service with Electron
echo =============================================
electron -e "require('child_process').spawn('node', ['test-service-simple.js'], {stdio: 'inherit'})"

pause
