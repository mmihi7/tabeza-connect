@echo off
echo ========================================
echo   Test Printer Service
echo ========================================
echo.
echo This will:
echo   1. Generate a test receipt
echo   2. Save it to the watch folder
echo   3. Verify it was processed
echo.
pause

echo.
echo Step 1: Generating test receipt...
echo ========================================
node test-print-job.js

echo.
echo.
echo Waiting 5 seconds for processing...
timeout /t 5 /nobreak > nul

echo.
echo Step 2: Verifying receipt was processed...
echo ========================================
node dev-tools/scripts/verify-print-job-flow.js

echo.
echo ========================================
echo   Test Complete!
echo ========================================
echo.
echo Check the output above to see if everything worked.
echo.
pause
