@echo off
echo Quick fix for tray application...
echo.

echo Stopping any existing tray processes...
taskkill /f /im TabezaTray.exe 2>nul

echo Copying current tray app to installation directory...
copy "TabezaTray.exe" "C:\Program Files\TabezaConnect\TabezaTray.exe" /Y

echo Starting tray application...
start "" "C:\Program Files\TabezaConnect\TabezaTray.exe"

echo.
echo Tray application started!
echo If tray icon doesn't appear, the app may need to be rebuilt.
echo.
echo Current status:
tasklist | findstr TabezaTray

echo.
pause
