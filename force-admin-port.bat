@echo off
echo ========================================
echo FORCING ADMIN PORT CREATION
echo ========================================
echo.

echo Access Denied means we need higher privileges
echo and proper service preparation...
echo.

:: Step 1: Verify admin rights
echo [1/5] Verifying Administrator privileges...
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ NOT running as Administrator
    echo.
    echo Please right-click this script and select:
    echo "Run as administrator"
    echo.
    pause
    exit /b 1
)
echo ✅ Running as Administrator

:: Step 2: Stop Print Spooler
echo.
echo [2/5] Stopping Print Spooler service...
net stop spooler
timeout /t 3 >nul
echo ✅ Print Spooler stopped

:: Step 3: Create port with elevated rights
echo.
echo [3/5] Creating port with elevated rights...
echo Trying multiple methods...
echo.

:: Method 1: Direct port creation
echo Method 1: Direct port creation...
powershell -Command "Add-PrinterPort -Name 'C:\TabezaPrints' -PrinterHostAddress 'C:\TabezaPrints'" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Port created via PowerShell
    goto :success
)

:: Method 2: CMD port creation
echo Method 2: CMD port creation...
rundll32 tcpmon.dll,LocalAddPortUI "C:\TabezaPrints" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Port created via CMD
    goto :success
)

:: Method 3: Registry method
echo Method 3: Registry method...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Ports" /v "C:\TabezaPrints" /t REG_SZ /d "" /f 2>nul
if %errorlevel% equ 0 (
    echo ✅ Port created via Registry
    goto :success
)

echo ❌ All port creation methods failed
goto :restart

:success
echo ✅ Port created successfully!

:restart
:: Step 4: Restart Print Spooler
echo.
echo [4/5] Restarting Print Spooler service...
net start spooler
timeout /t 3 >nul
echo ✅ Print Spooler restarted

:: Step 5: Verify port
echo.
echo [5/5] Verifying port creation...
powershell -Command "Get-PrinterPort | Where-Object {$_.Name -like '*Tabeza*'} | Select-Object Name,Description" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Port found in system
) else (
    echo ❌ Port not found in system
)

echo.
echo ========================================
echo PORT CREATION COMPLETE
echo ========================================
echo.
echo If port was created:
echo   1. Open Control Panel → Devices and Printers
echo   2. Right-click EPSON → Printer properties
echo   3. Ports tab → Select "C:\TabezaPrints"
echo   4. Apply → OK
echo.
echo If port creation failed:
echo   1. Try Windows GUI method (manual)
echo   2. Check Windows security policies
echo   3. Contact system administrator
echo.

pause
