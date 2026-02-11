@echo off
echo ========================================
echo Testing Printer Service Locally
echo ========================================
echo.
echo This script will:
echo 1. Start the printer service
echo 2. Start the staff app locally
echo 3. Open the settings page
echo.
echo ========================================
echo.

echo Step 1: Starting Printer Service...
echo.
start "Tabeza Printer Service" cmd /k "cd packages\printer-service && node index.js"

echo Waiting 3 seconds for service to start...
timeout /t 3 /nobreak > nul

echo.
echo Step 2: Starting Staff App...
echo.
start "Tabeza Staff App" cmd /k "cd apps\staff && pnpm dev"

echo Waiting 10 seconds for staff app to start...
timeout /t 10 /nobreak > nul

echo.
echo Step 3: Opening Settings Page...
echo.
start http://localhost:3003/settings

echo.
echo ========================================
echo ✅ Done!
echo.
echo Two terminal windows should be open:
echo 1. Printer Service (port 8765)
echo 2. Staff App (port 3003)
echo.
echo Your browser should open to:
echo http://localhost:3003/settings
echo.
echo You should see "Printer Service: Connected"
echo Click "Auto-Configure Printer Service" to complete setup
echo.
echo ⚠️  Keep both terminal windows open!
echo ========================================
pause
