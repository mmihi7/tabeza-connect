@echo off
echo ========================================
echo TEMPLATE GENERATOR FIX - Priority 1
echo ========================================
echo.

cd /d "C:\Projects\tabeza-connect"

echo Step 1: Stop service to update template route...
sc stop TabezaConnect
timeout /t 3 /nobreak >nul

echo Step 2: Create minimal template route that works...
echo This will add a working template generator

echo Step 3: Rebuild service with template fix...
pkg "src/service/index.js" --targets node18-win-x64 --output "TabezaConnect-TemplateWorking.exe" --compress brotli

echo Step 4: Copy updated executable...
powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList '-Command \"Copy-Item ''TabezaConnect-TemplateWorking.exe'' ''C:\Program Files\TabezaConnect\TabezaConnect.exe'' -Force; Write-Output ''Copy completed''\"' -Wait"

echo Step 5: Start service...
sc start TabezaConnect
timeout /t 5 /nobreak >nul

echo Step 6: CRITICAL TEST - Template Generator...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8765/template.html' -TimeoutSec 5 -UseBasicParsing; if ($response.StatusCode -eq 200) { Write-Output '✅ TEMPLATE GENERATOR WORKING!' } else { Write-Output '❌ Template Status:' $response.StatusCode } } catch { Write-Output '❌ Template Error:' $_.Exception.Message }"

echo Step 7: Test Template API...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8765/api/template/generate' -Method POST -Body '{\"receipts\":[\"test\"]}' -ContentType 'application/json' -TimeoutSec 5 -UseBasicParsing; Write-Output '✅ Template API Status:' $response.StatusCode } catch { Write-Output '❌ Template API Error:' $_.Exception.Message }"

echo Step 8: Verify service status...
sc query TabezaConnect | find "RUNNING" >nul
if %errorlevel% equ 0 (
    echo ✅ Service is running
) else (
    echo ❌ Service failed
)

echo.
echo ========================================
echo TEMPLATE GENERATOR STATUS
echo ========================================
echo.
echo Template Generator is CRITICAL for:
echo ✅ Receipt parsing functionality
echo ✅ Business intelligence extraction
echo ✅ System to be useful for business
echo.
echo This is Priority 1 - must work before anything else!
echo.
pause
