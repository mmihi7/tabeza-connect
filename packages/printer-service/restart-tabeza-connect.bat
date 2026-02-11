@echo off
echo.
echo ====================================
echo   Tabeza Connect - Restart Script
echo ====================================
echo.

echo Checking for existing printer service...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8765') do (
    echo Found process %%a using port 8765
    echo Killing process...
    taskkill /PID %%a /F >nul 2>&1
    echo Process killed
    timeout /t 1 >nul
)

echo.
echo Starting Tabeza Connect...
echo.

cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron
