@echo off
echo ========================================
echo   Update Printer Service Configuration
echo ========================================
echo.
echo This will update the printer service configuration
echo with the correct barId and API URL.
echo.

set BAR_ID=438c80c1-fe11-4ac5-8a48-2fc45104ba31
set API_URL=https://tabz-kikao.vercel.app

echo Configuration:
echo   Bar ID: %BAR_ID%
echo   API URL: %API_URL%
echo.

curl -X POST http://localhost:8765/api/configure ^
  -H "Content-Type: application/json" ^
  -d "{\"barId\":\"%BAR_ID%\",\"apiUrl\":\"%API_URL%\"}"

echo.
echo.
echo Configuration updated!
echo.
echo Next steps:
echo 1. The printer service should now be configured
echo 2. Check the printer service window for confirmation
echo 3. Go to https://tabz-kikao.vercel.app/settings to verify status
echo.
pause
