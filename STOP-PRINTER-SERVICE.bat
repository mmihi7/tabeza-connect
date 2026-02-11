@echo off
echo ========================================
echo Stopping Tabeza Printer Service
echo ========================================
echo.
echo Finding and stopping process on port 8765...
echo.

REM Find the process using port 8765
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8765') do (
    echo Found process: %%a
    taskkill /F /PID %%a
)

echo.
echo ========================================
echo Service stopped!
echo You can now run START-PRINTER-SERVICE.bat
echo ========================================
echo.
pause
