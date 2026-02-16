@echo off
REM TabezaConnect Installer Builder - DEBUG VERSION
setlocal enabledelayedexpansion

echo.
echo ========================================
echo TabezaConnect Installer Builder (DEBUG)
echo ========================================
echo.

REM Change to TabezaConnect directory
cd /d c:\Projects\TabezaConnect 2>nul
if errorlevel 1 (
    echo ERROR: Could not change to c:\Projects\TabezaConnect
    echo.
    pause
    exit /b 1
)

echo Current directory: %CD%
echo.

REM Step 1: Check if npm exists
echo Step 1: Checking npm installation...
where npm >nul 2>&1
if errorlevel 1 (
    echo ❌ npm not found in PATH
    echo Please install Node.js and npm
    pause
    exit /b 1
) else (
    echo ✅ npm found
)
echo.

REM Step 2: Clean previous build
echo Step 2: Cleaning previous build...
if exist dist (
    echo Removing existing dist directory...
    rmdir /s /q dist 2>nul
    if errorlevel 1 (
        echo ⚠️  Could not remove dist directory - files might be in use
    ) else (
        echo ✅ dist directory removed
    )
) else (
    echo No dist directory to clean
)
echo.

REM Step 3: Run installer build
echo Step 3: Running installer build...
echo.
node src\installer\build-installer.js
set BUILD_RESULT=%errorlevel%
echo.
echo Build command exit code: %BUILD_RESULT%
echo.

if %BUILD_RESULT% neq 0 (
    echo ❌ Build failed with error code %BUILD_RESULT%
    pause
    exit /b 1
) else (
    echo ✅ Build completed successfully
)
echo.

REM Step 4: Check if installer bundle was created
echo Step 4: Checking installer bundle...
if not exist src\installer\nodejs-bundle (
    echo ❌ nodejs-bundle directory was NOT created after build
    echo.
    pause
    exit /b 1
) else (
    echo ✅ nodejs-bundle directory exists
)
echo.

REM Step 5: Check if ZIP was created
echo Step 5: Checking for ZIP file...
echo.
if exist dist\TabezaConnect-Setup-v1.0.0.zip (
    echo ✅ ZIP file created successfully!
    echo.
    cd dist
    dir TabezaConnect-Setup-v1.0.0.zip
    cd ..
    echo.
    echo ========================================
    echo Build Complete!
    echo ========================================
    echo.
    echo ZIP Location: %CD%\dist\TabezaConnect-Setup-v1.0.0.zip
    echo.
    echo Next Steps:
    echo 1. Test the installer on a clean Windows VM
    echo 2. Upload to GitHub releases
    echo 3. Update download link in staff app
    echo.
) else (
    echo ⚠️  ZIP file was not created automatically
    echo.
    echo The installer files are ready at:
    echo %CD%\src\installer\nodejs-bundle\
    echo.
    echo You can manually create the ZIP using:
    echo 1. Windows Explorer: Right-click nodejs-bundle ^> Send to ^> Compressed folder
    echo 2. 7-Zip: "C:\Program Files\7-Zip\7z.exe" a -tzip dist\TabezaConnect-Setup-v1.0.0.zip src\installer\nodejs-bundle\*
    echo.
    echo Or distribute the nodejs-bundle folder directly without ZIP.
    echo.
)

echo.
echo ========================================
echo Build Process Complete
echo ========================================
echo.
pause