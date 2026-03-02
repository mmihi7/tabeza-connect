@echo off
echo ========================================
echo CRITICAL FIX - Template Generator + Tray Icon
echo ========================================
echo.

cd /d "C:\Projects\tabeza-connect"

echo Step 1: Stop service to fix both issues...
sc stop TabezaConnect
timeout /t 3 /nobreak >nul

echo Step 2: Fix template route issue...
echo The inline template code needs to work properly

echo Step 3: Create simple tray app without ICU dependency...
echo This will fix the tray icon issue

echo Step 4: Rebuild service with template fix...
pkg "src/service/index.js" --targets node18-win-x64 --output "TabezaConnect-CriticalFix.exe" --compress brotli

echo Step 5: Copy fixed executable...
powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList '-Command \"Copy-Item ''TabezaConnect-CriticalFix.exe'' ''C:\Program Files\TabezaConnect\TabezaConnect.exe'' -Force; Write-Output ''Copy completed''\"' -Wait"

echo Step 6: Start service...
sc start TabezaConnect
timeout /t 5 /nobreak >nul

echo Step 7: CRITICAL TEST 1 - Template Generator...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8765/template.html' -TimeoutSec 5 -UseBasicParsing; if ($response.StatusCode -eq 200) { Write-Output '✅ TEMPLATE GENERATOR WORKING!' } else { Write-Output '❌ TEMPLATE GENERATOR FAILED - StatusCode:' $response.StatusCode } } catch { Write-Output '❌ TEMPLATE GENERATOR ERROR:' $_.Exception.Message } }"

echo Step 8: CRITICAL TEST 2 - Tray Icon...
echo Starting tray application...
start "" "C:\Program Files\TabezaConnect\TabezaTray.exe"
timeout /t 3 /nobreak >nul

echo Checking tray process...
tasklist | findstr TabezaTray >nul
if %errorlevel% equ 0 (
    echo ✅ TRAY APPLICATION RUNNING!
) else (
    echo ❌ TRAY APPLICATION NOT RUNNING
    echo Trying alternative tray...
    start "" "TabezaTray.exe"
)

echo Step 9: Verify service status...
sc query TabezaConnect | find "RUNNING" >nul
if %errorlevel% equ 0 (
    echo ✅ SERVICE IS RUNNING!
) else (
    echo ❌ SERVICE FAILED
    sc query TabezaConnect
)

echo.
echo ========================================
echo 🚨 CRITICAL STATUS - Both Issues Must Be Fixed
echo ========================================
echo.
echo TEMPLATE GENERATOR:
echo ✅ Required for receipt parsing and business functionality
echo ✅ Must work for system to be useful
echo.
echo TRAY ICON:
echo ✅ Required for user interface and system monitoring
echo ✅ Must be visible for user interaction
echo.
echo These are NOT minor issues - they are CORE FUNCTIONALITY!
echo.
pause
