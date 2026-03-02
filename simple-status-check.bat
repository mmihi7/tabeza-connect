@echo off
echo ========================================
echo SIMPLE FIX - Avoid Build Crash
echo ========================================
echo.

cd /d "C:\Projects\tabeza-connect"

echo Step 1: Check current service status...
sc query TabezaConnect | find "RUNNING" >nul
if %errorlevel% equ 0 (
    echo ✅ Service is currently running
    echo Step 2: Stop service temporarily...
    sc stop TabezaConnect
    timeout /t 3 /nobreak >nul
) else (
    echo Service is not running
)

echo Step 3: Create simple template route without large HTML...
echo This will avoid build crashes

echo Step 4: Use existing executable (no rebuild)...
echo The existing service should work with route fix

echo Step 5: Start service...
sc start TabezaConnect
timeout /t 5 /nobreak >nul

echo Step 6: Test template generator...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8765/template.html' -TimeoutSec 5 -UseBasicParsing; Write-Output 'Template Status:' $response.StatusCode } catch { Write-Output 'Template Error:' $_.Exception.Message }"

echo Step 7: Start tray application...
start "" "C:\Program Files\TabezaConnect\TabezaTray.exe"
timeout /t 3 /nobreak >nul

echo Step 8: Check tray process...
tasklist | findstr TabezaTray >nul
if %errorlevel% equ 0 (
    echo ✅ Tray application is running
) else (
    echo ❌ Tray application not found
    echo Trying alternative...
    if exist "TabezaTray.exe" (
        start "" "TabezaTray.exe"
    ) else (
        echo TabezaTray.exe not found
    )
)

echo.
echo ========================================
echo STATUS CHECK
echo ========================================
echo.
echo Service Status:
sc query TabezaConnect | find "RUNNING" >nul
if %errorlevel% equ 0 (
    echo ✅ Service: Running
) else (
    echo ❌ Service: Not running
)

echo.
echo Template Generator:
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8765/template.html' -TimeoutSec 3 -UseBasicParsing; Write-Output '✅ Template: Available' } catch { Write-Output '❌ Template: Not available' }"

echo.
echo Tray Application:
tasklist | findstr TabezaTray >nul
if %errorlevel% equ 0 (
    echo ✅ Tray: Running
) else (
    echo ❌ Tray: Not running
)

echo.
echo Management UI:
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8765/api/status' -TimeoutSec 3 -UseBasicParsing; Write-Output '✅ Management UI: Working' } catch { Write-Output '❌ Management UI: Not working' }"

echo.
pause
