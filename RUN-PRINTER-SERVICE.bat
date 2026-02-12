@echo off
echo ========================================
echo   Starting Tabeza Printer Service
echo ========================================
echo.
echo This will start the printer service with your configuration.
echo Keep this window open while the service is running.
echo.
echo Press Ctrl+C to stop the service.
echo.
pause

cd /d "%USERPROFILE%\Downloads"

if not exist "tabeza-printer-service.exe" (
    echo ERROR: tabeza-printer-service.exe not found in Downloads folder
    echo.
    echo Please make sure the file is in: %USERPROFILE%\Downloads
    pause
    exit /b 1
)

echo Starting printer service...
echo.
tabeza-printer-service.exe

pause
