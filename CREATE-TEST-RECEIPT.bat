@echo off
echo ========================================
echo   Quick Test Receipt Creator
echo ========================================
echo.
echo This will create a test receipt and save it
echo directly to the watch folder (no printing needed)
echo.
pause

node test-print-job.js

echo.
echo ========================================
echo   Done! Check your printer service terminal
echo ========================================
pause
