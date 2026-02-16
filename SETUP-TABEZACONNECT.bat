@echo off
REM TabezaConnect Repository Setup Script
REM This script automates the setup of the TabezaConnect standalone repository

echo.
echo ========================================
echo TabezaConnect Repository Setup
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Run the setup script
node setup-tabezaconnect.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Setup completed successfully!
    echo ========================================
    echo.
) else (
    echo.
    echo ========================================
    echo Setup failed! Check the error messages above.
    echo ========================================
    echo.
)

pause
