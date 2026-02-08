@echo off
echo ========================================
echo Tabeza Printer Service - Complete Release
echo ========================================
echo.

echo Step 1: Killing any running instances...
taskkill /F /IM tabeza-printer-service.exe /T 2>nul
timeout /t 2 /nobreak >nul

echo Step 2: Cleaning old build...
if exist dist\tabeza-printer-service.exe del /F /Q dist\tabeza-printer-service.exe 2>nul
timeout /t 1 /nobreak >nul

echo Step 3: Building executable...
call pnpm run build-exe
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo Step 4: Verifying build...
if not exist dist\tabeza-printer-service.exe (
    echo ERROR: Executable not found after build
    pause
    exit /b 1
)

echo.
echo ✅ Build successful!
echo.

echo Step 5: Creating GitHub release...
gh release create v1.0.0 ^
  dist\tabeza-printer-service.exe ^
  --title "Tabeza Printer Service v1.0.0" ^
  --notes "Windows service for POS printer integration with Tabeza.^n^nInstallation:^n1. Download tabeza-printer-service.exe^n2. Run as Administrator^n3. Service will start on http://localhost:8765^n^nRequirements:^n- Windows 10 or later^n- Administrator privileges^n^nConfiguration:^n- Visit http://localhost:8765/api/configure^n- Enter your Bar ID and API URL"

if %errorlevel% neq 0 (
    echo ERROR: GitHub release failed
    pause
    exit /b 1
)

echo.
echo ✅ GitHub release created!
echo.

echo Step 6: Updating download URLs in app...
cd ..\..
node packages\printer-service\update-download-urls.js billoapp

if %errorlevel% neq 0 (
    echo ERROR: URL update failed
    pause
    exit /b 1
)

echo.
echo ✅ Download URLs updated!
echo.

echo ========================================
echo Release Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Commit the URL changes: git add . ^&^& git commit -m "Update printer service download URLs"
echo 2. Push to GitHub: git push
echo 3. Test download in app
echo 4. Apply database migration in Supabase
echo.
pause
