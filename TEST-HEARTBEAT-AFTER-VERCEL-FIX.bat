@echo off
echo ========================================
echo   Test Heartbeat with Vercel Bypass
echo ========================================
echo.

REM Set environment variables
set TABEZA_BAR_ID=438c80c1-fe11-4ac5-8a48-2fc45104ba31
set TABEZA_API_URL=https://tabz-kikao.vercel.app
set VERCEL_BYPASS_TOKEN=%1

if "%VERCEL_BYPASS_TOKEN%"=="" (
    REM Try to get from environment
    if defined VERCEL_AUTOMATION_BYPASS_SECRET (
        set VERCEL_BYPASS_TOKEN=%VERCEL_AUTOMATION_BYPASS_SECRET%
    )
)

echo Testing heartbeat with Vercel bypass...
echo.
echo Configuration:
echo   Bar ID: %TABEZA_BAR_ID%
echo   API URL: %TABEZA_API_URL%
echo   Token: %VERCEL_BYPASS_TOKEN%
echo.

REM Generate a test driver ID
set DRIVER_ID=driver-test-%USERNAME%-%RANDOM%
echo Driver ID: %DRIVER_ID%
echo.

REM Send test heartbeat
echo Sending heartbeat...
curl -X POST "%TABEZA_API_URL%/api/printer/heartbeat" ^
  -H "Content-Type: application/json" ^
  -H "x-vercel-protection-bypass: %VERCEL_BYPASS_TOKEN%" ^
  -d "{\"barId\":\"%TABEZA_BAR_ID%\",\"driverId\":\"%DRIVER_ID%\",\"version\":\"1.0.0\",\"status\":\"online\",\"metadata\":{\"hostname\":\"test-host\",\"platform\":\"test\"}}"

echo.
echo.
echo Checking driver status...
curl -X GET "%TABEZA_API_URL%/api/printer/driver-status?barId=%TABEZA_BAR_ID%" ^
  -H "x-vercel-protection-bypass: %VERCEL_BYPASS_TOKEN%"

echo.
echo.
echo Done!
pause
