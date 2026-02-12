@echo off
echo Testing Environment Variables
echo ========================================
echo.

REM Set test environment variables
set TABEZA_BAR_ID=438c80c1-fe11-4ac5-8a48-2fc45104ba31
set TABEZA_API_URL=https://tabz-kikao.vercel.app

echo Environment variables set:
echo   TABEZA_BAR_ID=%TABEZA_BAR_ID%
echo   TABEZA_API_URL=%TABEZA_API_URL%
echo.

REM Test if Node.js can read them
echo Testing if Node.js can read environment variables...
node -e "console.log('Bar ID from env:', process.env.TABEZA_BAR_ID); console.log('API URL from env:', process.env.TABEZA_API_URL);"

echo.
echo If you see the Bar ID and API URL above, environment variables work!
echo.
pause
