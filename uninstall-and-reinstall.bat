@echo off
echo ========================================
echo Uninstalling Old TabezaConnect
echo ========================================
echo.

echo Stopping TabezaConnect processes...
taskkill /F /IM TabezaConnect.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo Checking if TabezaConnect is installed...
if exist "C:\Program Files\TabezaConnect\unins000.exe" (
    echo Found existing installation, uninstalling...
    "C:\Program Files\TabezaConnect\unins000.exe" /SILENT
    timeout /t 5 /nobreak >nul
    echo Uninstall complete.
) else (
    echo No existing installation found.
)

echo.
echo ========================================
echo Installing New Version
echo ========================================
echo.

if exist "installer-output\TabezaConnect-Setup-v1.7.15-PRODUCTION.exe" (
    echo Starting installer...
    start /wait installer-output\TabezaConnect-Setup-v1.7.15-PRODUCTION.exe
    echo.
    echo Installation complete!
) else (
    echo ERROR: Installer not found at installer-output\TabezaConnect-Setup-v1.7.15-PRODUCTION.exe
    pause
    exit /b 1
)

echo.
echo ========================================
echo Testing Service
echo ========================================
echo.
echo Waiting 5 seconds for service to start...
timeout /t 5 /nobreak >nul

echo.
echo Running manual service test...
call test-service-manually.bat

