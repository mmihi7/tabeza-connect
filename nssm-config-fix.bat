@echo off
echo ========================================
echo NSSM SERVICE CONFIGURATION FIX
echo ========================================
echo.

echo Step 1: Check current NSSM configuration...
echo Application Path:
cmd /c "nssm\win64\nssm.exe get TabezaConnect Application"
echo.
echo Directory:
cmd /c "nssm\win64\nssm.exe get TabezaConnect AppDirectory"
echo.
echo Step 2: Check if executable exists...
powershell -Command "if (Test-Path 'C:\Program Files\TabezaConnect\TabezaConnect.exe') { Write-Output '✅ Executable exists' } else { Write-Output '❌ Executable missing' }"

echo.
echo Step 3: Remove and reinstall service to fix registry...
cmd /c "nssm\win64\nssm.exe remove TabezaConnect confirm"
timeout /t 2 /nobreak >nul

echo Step 4: Reinstall service with correct configuration...
cmd /c "nssm\win64\nssm.exe install TabezaConnect \"C:\Program Files\TabezaConnect\TabezaConnect.exe\""
timeout /t 2 /nobreak >nul

echo Step 5: Set service properties...
cmd /c "nssm\win64\nssm.exe set TabezaConnect DisplayName \"Tabeza POS Connect\""
cmd /c "nssm\win64\nssm.exe set TabezaConnect Description \"Tabeza POS Connect - Receipt capture and upload service\""
cmd /c "nssm\win64\nssm.exe set TabezaConnect AppDirectory \"C:\Program Files\TabezaConnect\""
cmd /c "nssm\win64\nssm.exe set TabezaConnect Start SERVICE_AUTO_START"

echo Step 6: Verify configuration...
echo Application:
cmd /c "nssm\win64\nssm.exe get TabezaConnect Application"
echo.
echo Directory:
cmd /c "nssm\win64\nssm.exe get TabezaConnect AppDirectory"

echo.
echo Step 7: Start service...
cmd /c "sc start TabezaConnect"
timeout /t 5 /nobreak >nul

echo Step 8: Check service status...
cmd /c "sc query TabezaConnect" | find "RUNNING" >nul
if %errorlevel% equ 0 (
    echo ✅ SERVICE IS RUNNING!
    echo.
    echo Step 9: Test Management UI...
    powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8765/api/status' -TimeoutSec 5 -UseBasicParsing; Write-Output '✅ MANAGEMENT UI WORKING!' } catch { Write-Output '❌ Management UI error:' $_.Exception.Message }"
) else (
    echo ❌ Service failed to start
    echo Current status:
    cmd /c "sc query TabezaConnect"
)

echo.
echo ========================================
echo NSSM CONFIGURATION COMPLETE
echo ========================================
echo.
echo The service should now be properly configured with:
echo ✅ Correct executable path
echo ✅ Correct working directory  
echo ✅ Proper service registration
echo ✅ Auto-start enabled
echo.
pause
