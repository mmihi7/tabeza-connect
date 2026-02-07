@echo off
echo.
echo ========================================
echo   Test Receipt Delivery System
echo ========================================
echo.
echo Starting staff app on http://localhost:3003
echo.
echo Once started, open your browser to:
echo   http://localhost:3003/test-receipt-delivery.html
echo.
echo Press Ctrl+C to stop the server
echo.
echo ========================================
echo.

cd apps\staff
npm run dev
