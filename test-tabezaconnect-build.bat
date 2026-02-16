@echo off
REM Test TabezaConnect Build Script

echo.
echo ========================================
echo Testing TabezaConnect Build
echo ========================================
echo.

REM Navigate to TabezaConnect
cd c:\Projects\TabezaConnect

REM Check if we're in the right directory
echo Current directory:
cd

echo.
echo Checking package.json...
if exist package.json (
    echo ✅ package.json found
) else (
    echo ❌ package.json not found
    pause
    exit /b 1
)

echo.
echo Checking src directory...
if exist src (
    echo ✅ src directory found
) else (
    echo ❌ src directory not found
    pause
    exit /b 1
)

echo.
echo ========================================
echo Running npm run build...
echo ========================================
echo.

npm run build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo ✅ Build completed successfully!
    echo ========================================
    echo.
    echo Checking output...
    if exist dist\TabezaConnect-Setup-v1.0.0.zip (
        echo ✅ Installer created: dist\TabezaConnect-Setup-v1.0.0.zip
        dir dist\TabezaConnect-Setup-v1.0.0.zip
    ) else (
        echo ⚠️  Installer file not found
    )
) else (
    echo.
    echo ========================================
    echo ❌ Build failed!
    echo ========================================
    echo.
)

pause
