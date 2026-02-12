@echo off
echo Checking for heartbeats in database...
echo.
cd /d C:\Projects\Tabz
node dev-tools/scripts/check-printer-heartbeats.js
pause
