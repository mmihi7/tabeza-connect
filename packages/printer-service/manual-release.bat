@echo off
echo ========================================
echo Manual GitHub Release Instructions
echo ========================================
echo.
echo The .exe file has been built successfully!
echo Location: packages\printer-service\dist\tabeza-printer-service.exe
echo.
echo Now create the GitHub release manually:
echo.
echo 1. Go to: https://github.com/billoapp/tabeza-printer-service/releases/new
echo.
echo 2. Fill in:
echo    - Tag: v1.0.0
echo    - Title: Tabeza Printer Service v1.0.0
echo    - Description: Windows service for POS printer integration with Tabeza
echo.
echo 3. Upload file: dist\tabeza-printer-service.exe
echo.
echo 4. Click "Publish release"
echo.
echo 5. After publishing, press any key here to update URLs...
pause

echo.
echo Updating download URLs...
cd ..\..
node packages\printer-service\update-download-urls.js billoapp

if %errorlevel% neq 0 (
    echo ERROR: URL update failed
    pause
    exit /b 1
)

echo.
echo ✅ URLs updated successfully!
echo.
echo Next steps:
echo 1. git add .
echo 2. git commit -m "Update printer service download URLs"
echo 3. git push
echo 4. Apply database migration in Supabase
echo.
pause
