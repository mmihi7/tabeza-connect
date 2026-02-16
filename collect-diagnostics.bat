@echo off
REM ========================================
REM Tabeza Connect Diagnostics Collector
REM Collects system info for support
REM ========================================

echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║                                                           ║
echo ║   Tabeza Connect Diagnostics Collector                   ║
echo ║                                                           ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.
echo This tool collects diagnostic information to help support
echo troubleshoot your Tabeza Connect installation.
echo.
echo No sensitive information (passwords, receipts) will be collected.
echo.
pause

REM Create output file
set OUTPUT_FILE=tabeza-diagnostics-%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%.txt
set OUTPUT_FILE=%OUTPUT_FILE: =0%

echo Collecting diagnostics...
echo.

REM Start output file
echo Tabeza Connect Diagnostics Report > %OUTPUT_FILE%
echo Generated: %date% %time% >> %OUTPUT_FILE%
echo ======================================== >> %OUTPUT_FILE%
echo. >> %OUTPUT_FILE%

REM System Information
echo [1/8] Collecting system information...
echo === SYSTEM INFORMATION === >> %OUTPUT_FILE%
systeminfo | findstr /B /C:"OS Name" /C:"OS Version" /C:"System Type" >> %OUTPUT_FILE%
echo. >> %OUTPUT_FILE%

REM Node.js Version
echo [2/8] Checking Node.js version...
echo === NODE.JS VERSION === >> %OUTPUT_FILE%
node --version >> %OUTPUT_FILE% 2>&1
echo. >> %OUTPUT_FILE%

REM Environment Variables
echo [3/8] Checking environment variables...
echo === ENVIRONMENT VARIABLES === >> %OUTPUT_FILE%
echo NODE_OPTIONS: %NODE_OPTIONS% >> %OUTPUT_FILE%
reg query "HKLM\SYSTEM\CurrentControlSet\Services\TabezaConnect" /v Environment >> %OUTPUT_FILE% 2>&1
echo. >> %OUTPUT_FILE%

REM Service Status
echo [4/8] Checking service status...
echo === SERVICE STATUS === >> %OUTPUT_FILE%
sc query TabezaConnect >> %OUTPUT_FILE% 2>&1
echo. >> %OUTPUT_FILE%

REM Network Connectivity
echo [5/8] Testing network connectivity...
echo === NETWORK CONNECTIVITY === >> %OUTPUT_FILE%
echo Testing tabeza.co.ke... >> %OUTPUT_FILE%
ping -n 2 tabeza.co.ke >> %OUTPUT_FILE% 2>&1
echo. >> %OUTPUT_FILE%

REM Port Check
echo [6/8] Checking if port 8765 is in use...
echo === PORT STATUS === >> %OUTPUT_FILE%
netstat -ano | findstr :8765 >> %OUTPUT_FILE% 2>&1
echo. >> %OUTPUT_FILE%

REM Configuration File
echo [7/8] Reading configuration...
echo === CONFIGURATION === >> %OUTPUT_FILE%
if exist "C:\Program Files\Tabeza\config.json" (
    type "C:\Program Files\Tabeza\config.json" >> %OUTPUT_FILE% 2>&1
) else (
    echo Config file not found at C:\Program Files\Tabeza\config.json >> %OUTPUT_FILE%
)
echo. >> %OUTPUT_FILE%

REM Service Diagnostics API
echo [8/8] Fetching service diagnostics...
echo === SERVICE DIAGNOSTICS === >> %OUTPUT_FILE%
curl -s http://localhost:8765/api/diagnostics >> %OUTPUT_FILE% 2>&1
echo. >> %OUTPUT_FILE%

REM Firewall Rules
echo === FIREWALL RULES === >> %OUTPUT_FILE%
netsh advfirewall firewall show rule name=all | findstr /C:"Node" /C:"Tabeza" >> %OUTPUT_FILE% 2>&1
echo. >> %OUTPUT_FILE%

REM Recent Windows Event Logs (Errors only)
echo === RECENT EVENT LOG ERRORS === >> %OUTPUT_FILE%
wevtutil qe Application /c:10 /rd:true /f:text /q:"*[System[(Level=2)]]" >> %OUTPUT_FILE% 2>&1
echo. >> %OUTPUT_FILE%

echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║                                                           ║
echo ║   Diagnostics Collection Complete                         ║
echo ║                                                           ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.
echo Diagnostics saved to: %OUTPUT_FILE%
echo.
echo Please send this file to support@tabeza.co.ke
echo.
echo The file contains:
echo   - System information (OS version, etc.)
echo   - Service status
echo   - Network connectivity tests
echo   - Configuration (Bar ID visible, no passwords)
echo   - Recent error logs
echo.
echo NO sensitive information (receipts, passwords) is included.
echo.
pause

REM Open the file location
explorer /select,"%OUTPUT_FILE%"
