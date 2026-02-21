@echo off
echo ========================================
echo Starting Tabeza UNIVERSAL Bridge
echo ========================================
echo.

echo Stopping existing service...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 2 >nul

echo.
echo Starting UNIVERSAL bridge...
cd /d "C:\Projects\TabezaConnect\src\service"

echo ✅ UNIVERSAL ARCHITECTURE:
echo    - Works with ANY printer type
echo    - Uses Windows spooler (no port fighting)
echo    - PowerShell Out-Printer forwarding
echo    - Minimal bulletproof code
echo    - Universal compatibility
echo.

start "Tabeza Universal Bridge" cmd /k "node index.js"

echo.
echo ✅ UNIVERSAL BRIDGE STARTED!
echo.
echo Expected behavior:
echo    - Clean capture cycles
echo    - Universal printer forwarding
echo    - No port access issues
echo    - Works with USB, Network, Bluetooth
echo.
echo Print from your POS to test!
echo.
pause
