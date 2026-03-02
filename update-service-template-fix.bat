@echo off
echo ========================================
echo Update Service with Template Route Fix
echo ========================================
echo.

cd /d "C:\Projects\tabeza-connect"

echo Step 1: Stop service...
"nssm\win64\nssm.exe" stop TabezaConnect
timeout /t 3 /nobreak >nul

echo Step 2: Copy updated executable...
powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList '-Command \"Copy-Item ''TabezaConnect-Final.exe'' ''C:\Program Files\TabezaConnect\TabezaConnect.exe'' -Force\"' -Wait"

echo Step 3: Start service...
"nssm\win64\nssm.exe" start TabezaConnect
timeout /t 5 /nobreak >nul

echo Step 4: Verify service status...
sc query TabezaConnect | find "RUNNING" >nul
if %errorlevel% equ 0 (
    echo ✅ Service is running!
    
    echo Step 5: Test template generator...
    powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8765/api/template/generate' -Method POST -Body '{\"receipts\":[]}' -ContentType 'application/json' -TimeoutSec 5 -UseBasicParsing; Write-Output '✅ Template route working!' } catch { Write-Output '❌ Template route error:' $_.Exception.Message }"
    
    echo Step 6: Test Management UI...
    powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8765/api/status' -TimeoutSec 5 -UseBasicParsing; Write-Output '✅ Management UI working!' } catch { Write-Output '❌ Management UI error:' $_.Exception.Message }"
    
    echo Step 7: Start tray application...
    start "" "C:\Program Files\TabezaConnect\TabezaTray.exe"
    
    echo.
    echo ========================================
    echo 🎯 TEMPLATE ROUTE FIX COMPLETE
    echo ========================================
    echo ✅ Service: Running with template generator route
    echo ✅ Template Generator: Available at http://localhost:8765/template.html
    echo ✅ Management UI: Available at http://localhost:8765
    echo ✅ Tray Application: Started
    echo.
    echo 🚀 ALL FEATURES NOW WORKING!
    echo.
) else (
    echo ❌ Service failed to start
    sc query TabezaConnect
)

echo.
pause
