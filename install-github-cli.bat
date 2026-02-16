@echo off
echo.
echo ========================================
echo Installing GitHub CLI
echo ========================================
echo.

echo Checking if winget is available...
winget --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ❌ winget is not available on your system
    echo.
    echo Please install GitHub CLI manually:
    echo 1. Go to: https://cli.github.com/
    echo 2. Download the Windows installer
    echo 3. Run the installer
    echo.
    echo Opening download page...
    start https://cli.github.com/
    pause
    exit /b 1
)

echo ✅ winget found
echo.
echo Installing GitHub CLI...
echo.

winget install --id GitHub.cli

if errorlevel 1 (
    echo.
    echo ❌ Installation failed
    echo.
    echo Please try manual installation:
    echo https://cli.github.com/
    pause
    exit /b 1
)

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo GitHub CLI has been installed.
echo.
echo ⚠️  IMPORTANT: Close and reopen your terminal
echo    for the 'gh' command to be available.
echo.
echo After reopening terminal, authenticate with:
echo   gh auth login
echo.
pause
