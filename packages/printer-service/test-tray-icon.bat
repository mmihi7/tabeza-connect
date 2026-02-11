@echo off
echo Testing Tray Icon Visibility
echo =============================
echo.
echo This will start Electron and check if the tray icon appears.
echo.
echo INSTRUCTIONS:
echo 1. Look at your system tray (bottom-right corner near clock)
echo 2. You should see a green Tabeza icon
echo 3. Right-click it to see the menu
echo 4. If you don't see it, click the up arrow (^) to show hidden icons
echo.
echo Press any key to start the test...
pause > nul

cd /d "%~dp0"
pnpm start

echo.
echo Did you see the tray icon? (Check hidden icons too)
pause
