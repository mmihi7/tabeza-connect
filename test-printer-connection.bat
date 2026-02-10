@echo off
echo ========================================
echo Printer Connection Diagnostic Test
echo ========================================
echo.

echo [1/4] Testing if printer service is running...
curl -s http://localhost:8765/api/status
if %errorlevel% equ 0 (
    echo ✅ Printer service is responding on port 8765
) else (
    echo ❌ Printer service is NOT responding on port 8765
    echo.
    echo SOLUTION: Start the printer service first!
    echo Run: START-PRINTER-SERVICE.bat
    goto :end
)

echo.
echo [2/4] Checking if port 8765 is listening...
netstat -ano | findstr :8765
echo.

echo [3/4] Checking if staff app is running on port 3003...
netstat -ano | findstr :3003
if %errorlevel% equ 0 (
    echo ✅ Staff app is running on port 3003
    echo.
    echo You should access: http://localhost:3003/settings
) else (
    echo ❌ Staff app is NOT running on port 3003
    echo.
    echo SOLUTION: Start the staff app!
    echo Run: cd apps\staff && pnpm dev
)

echo.
echo [4/4] Summary
echo ========================================
echo.
echo If printer service is running (port 8765): ✅
echo If staff app is running (port 3003): ✅
echo Then visit: http://localhost:3003/settings
echo.
echo If you're on https://staff.tabeza.co.ke/settings:
echo ❌ This will NOT work with local printer service!
echo ✅ Use http://localhost:3003/settings instead
echo.

:end
pause
