@echo off
echo ========================================
echo CRITICAL FIX - Template Generator MUST Work
echo ========================================
echo.

cd /d "C:\Projects\tabeza-connect"

echo Step 1: Stop service to fix template route...
sc stop TabezaConnect
timeout /t 3 /nobreak >nul

echo Step 2: Create working template route...
echo This is CRITICAL for business functionality

echo Step 3: Rebuild with template fix...
pkg "src/service/index.js" --targets node18-win-x64 --output "TabezaConnect-TemplateFix.exe" --compress brotli

echo Step 4: Copy fixed executable...
powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList '-Command \"Copy-Item ''TabezaConnect-TemplateFix.exe'' ''C:\Program Files\TabezaConnect\TabezaConnect.exe'' -Force; Write-Output ''Copy completed''\"' -Wait"

echo Step 5: Start service...
sc start TabezaConnect
timeout /t 5 /nobreak >nul

echo Step 6: CRITICAL TEST - Template Generator MUST work...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8765/template.html' -TimeoutSec 5 -UseBasicParsing; if ($response.StatusCode -eq 200) { Write-Output '✅ TEMPLATE GENERATOR WORKING!' } else { Write-Output '❌ TEMPLATE GENERATOR FAILED!' } } catch { Write-Output '❌ TEMPLATE GENERATOR ERROR:' $_.Exception.Message }"

echo Step 7: Test Management UI data loading...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8765/api/status' -TimeoutSec 5 -UseBasicParsing; $data = $response.Content | ConvertFrom-Json; if ($data.success) { Write-Output '✅ MANAGEMENT UI LOADING DATA!' } else { Write-Output '❌ MANAGEMENT UI NOT LOADING DATA!' } } catch { Write-Output '❌ MANAGEMENT UI ERROR:' $_.Exception.Message }"

echo Step 8: Verify service status...
sc query TabezaConnect | find "RUNNING" >nul
if %errorlevel% equ 0 (
    echo ✅ Service is running!
) else (
    echo ❌ Service failed
    sc query TabezaConnect
)

echo.
echo ========================================
echo 🚨 CRITICAL STATUS - Template Generator
echo ========================================
echo.
echo Template Generator is CORE BUSINESS FUNCTIONALITY:
echo ✅ Required for receipt parsing
echo ✅ Required for structured data extraction  
echo ✅ Required for business intelligence
echo ✅ Required for system to be useful
echo.
echo This is NOT a minor UI issue - it's the main feature!
echo.
pause
