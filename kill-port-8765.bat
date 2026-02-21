@echo off
echo Killing processes on port 8765...

REM Find and kill Node.js processes using port 8765
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8765') do (
    echo Killing PID %%a...
    taskkill /F /PID %%a
)

echo Checking for remaining processes...
netstat -aon | findstr :8765
if %errorlevel% equ 0 (
    echo Warning: Port 8765 still in use
) else (
    echo Success: Port 8765 is now free
)

echo Done.
