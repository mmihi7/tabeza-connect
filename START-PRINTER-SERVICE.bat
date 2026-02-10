@echo off
echo ========================================
echo Starting Tabeza Printer Service
echo ========================================
echo.
echo IMPORTANT: Keep this window open!
echo The service will stop if you close it.
echo.
echo ========================================
echo.

cd packages\printer-service
node index.js

pause
