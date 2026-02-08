@echo off
REM Tabeza Printer Service - CLI Release Script (Windows)
REM This script automates the entire release process using GitHub CLI

echo ========================================
echo   Tabeza Printer Service Release
echo   CLI Automated Release
echo ========================================
echo.

REM Check if gh CLI is installed
where gh >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: GitHub CLI ^(gh^) is not installed
    echo.
    echo Install it from: https://cli.github.com/
    echo.
    echo Windows: winget install --id GitHub.cli
    echo Or download from: https://github.com/cli/cli/releases
    pause
    exit /b 1
)

REM Check if logged in to GitHub
gh auth status >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Not logged in to GitHub
    echo.
    echo Run: gh auth login
    pause
    exit /b 1
)

REM Get GitHub username
for /f "tokens=*" %%i in ('gh api user -q .login') do set GITHUB_USER=%%i
echo Logged in as: %GITHUB_USER%
echo.

REM Step 1: Build
echo Step 1: Building executable...
cd /d "%~dp0"
call pnpm install
call pnpm run build-installer

if not exist "dist\tabeza-printer-service.exe" (
    echo ERROR: Build failed - .exe not found
    pause
    exit /b 1
)
echo Build complete
echo.

REM Step 2: Create GitHub repository
echo Step 2: Creating GitHub repository...
gh repo view %GITHUB_USER%/tabeza-printer-service >nul 2>nul
if %errorlevel% equ 0 (
    echo Repository already exists, skipping creation
) else (
    gh repo create tabeza-printer-service --public --description "Local Windows service for Tabeza POS printer integration" --clone=false
    echo Repository created
)
echo.

REM Step 3: Initialize git and push
echo Step 3: Pushing code to GitHub...
if not exist ".git" (
    git init
    git add .
    git commit -m "Initial commit: Tabeza Printer Service v1.0.0"
    git branch -M main
    git remote add origin https://github.com/%GITHUB_USER%/tabeza-printer-service.git
)

git push -u origin main --force
echo Code pushed
echo.

REM Step 4: Create release
echo Step 4: Creating GitHub release...
gh release create v1.0.0 dist\tabeza-printer-service.exe dist\install.bat dist\README.txt --title "Tabeza Printer Service v1.0.0" --notes "# Tabeza Printer Service v1.0.0

Windows service for integrating POS systems with Tabeza digital receipts.

## Installation

1. Download tabeza-printer-service.exe
2. Run as Administrator
3. Service will start on http://localhost:8765

## Requirements

- Windows 10 or later
- Administrator privileges
- Internet connection

## What's Included

- Standalone executable (no Node.js installation required)
- Automatic configuration
- Health monitoring

## Support

- Email: support@tabeza.co.ke
- Website: https://tabeza.co.ke"

echo Release created
echo.

REM Step 5: Update download URLs
echo Step 5: Updating download URLs in app...
cd ..\..
node packages\printer-service\update-download-urls.js %GITHUB_USER%
echo.

REM Done!
echo ========================================
echo   Release Complete!
echo ========================================
echo.
echo Download URL:
echo https://github.com/%GITHUB_USER%/tabeza-printer-service/releases/latest/download/tabeza-printer-service.exe
echo.
echo Next steps:
echo 1. Test the download in your app
echo 2. Commit the URL changes: git add . ^&^& git commit -m "Update printer service URLs"
echo 3. Deploy your app
echo.
pause
