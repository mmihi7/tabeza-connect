@echo off
echo Checking for processes using port 8765...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8765') do (
    echo Found process: %%a
    taskkill /F /PID %%a 2>nul
    if errorlevel 1 (
        echo Could not kill process %%a
    ) else (
        echo Killed process %%a
    )
)

echo.
echo Port 8765 should now be free
echo.
pause
