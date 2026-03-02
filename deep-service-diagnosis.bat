@echo off
echo ========================================
echo Deep Service Diagnosis and Fix
echo ========================================
echo.

cd /d "C:\Projects\tabeza-connect"

echo Step 1: Check Windows Event Viewer for service errors...
echo ----------------------------------------------------
echo Checking recent application logs...
powershell -Command "Get-WinEvent -FilterHashtable @{LogName='Application'; ProviderName='TabezaConnect'} -MaxEvents 5 | Format-Table TimeCreated, LevelDisplayName, Message -Wrap"

echo.
echo Step 2: Check service registration...
echo ----------------------------------------------------
sc query TabezaConnect
echo.
echo Service configuration:
sc qc TabezaConnect

echo.
echo Step 3: Test service executable directly...
echo ----------------------------------------------------
echo Testing if TabezaConnect.exe runs outside of service context...
echo This will help identify if the issue is with the service or the executable
echo.

echo Running executable directly (will timeout after 10 seconds)...
timeout /t 2 /nobreak >nul
start "TabezaConnect Test" /MIN "C:\Program Files\TabezaConnect\TabezaConnect.exe"
timeout /t 5 /nobreak >nul
taskkill /f /im TabezaConnect.exe 2>nul

echo.
echo Step 4: Re-register service with correct parameters...
echo ----------------------------------------------------
echo Removing existing service...
sc delete TabezaConnect 2>nul
timeout /t 2 /nobreak >nul

echo Creating new service with proper configuration...
sc create TabezaConnect binPath= "\"C:\Program Files\TabezaConnect\TabezaConnect.exe\"" start= auto DisplayName= "Tabeza POS Connect" type= own

echo Configuring service...
sc config TabezaConnect start= delayed-auto
sc config TabezaConnect depend= Tcpip
sc config TabezaConnect error= normal
sc config TabezaConnect obj= ".\LocalSystem" password= ""

echo.
echo Step 5: Set proper permissions...
echo ----------------------------------------------------
echo Granting service necessary permissions...
sc sdset TabezaConnect "D:(A;;CC;;;AU)(A;;CC;;;SY)(A;;CCLCSWRPWPDTLOCRSDRCWO;;;BA)"

echo.
echo Step 6: Start service with detailed logging...
echo ----------------------------------------------------
echo Starting service...
sc start TabezaConnect

echo Waiting for service to initialize...
timeout /t 10 /nobreak >nul

echo Checking service status...
sc query TabezaConnect | find "STATE"

echo.
echo Step 7: Test core functionality...
echo ----------------------------------------------------
echo Creating test receipt...
echo TEST RECEIPT - %date% %time% > "C:\ProgramData\Tabeza\TabezaPrints\order.prn"

echo Waiting for processing...
timeout /t 5 /nobreak >nul

echo Checking results...
if exist "C:\ProgramData\Tabeza\queue\pending\*.json" (
    echo ✅ SUCCESS: Receipt capture is working!
    dir "C:\ProgramData\Tabeza\queue\pending"
) else (
    echo ❌ No receipts captured - checking logs
    echo Last 10 log entries:
    powershell -Command "Get-Content 'C:\ProgramData\Tabeza\logs\service.log' | Select-Object -Last 10"
)

echo.
echo ========================================
echo FINAL DIAGNOSIS
echo ========================================
echo.
echo Service Status:
sc query TabezaConnect | find "STATE"
echo.
echo Recent Service Logs:
powershell -Command "Get-Content 'C:\ProgramData\Tabeza\logs\service.log' | Select-Object -Last 5"
echo.
echo Queue Status:
dir "C:\ProgramData\Tabeza\queue\pending" 2>nul || echo No pending receipts
echo.
echo ========================================
echo.
echo If service is still not running:
echo 1. Check Windows Event Viewer for detailed errors
echo 2. Verify TabezaConnect.exe has proper permissions
echo 3. Try running as a console application for debugging
echo 4. Consider running as a scheduled task instead of service
echo.
pause
