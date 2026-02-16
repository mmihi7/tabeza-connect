@echo off
echo.
echo ========================================
echo Pushing TabezaConnect to GitHub
echo ========================================
echo.

echo Current directory: %CD%
echo.

echo Checking git status...
git status
echo.

echo Adding all changes...
git add .

echo.
echo Committing changes...
git commit -m "Add auto-healing SSL fixes, diagnostics, and production deployment tools"
if errorlevel 1 (
    echo No new changes to commit
) else (
    echo Commit successful
)

echo.
echo Pushing to remote...
git push origin main

echo.
echo ========================================
echo Done!
echo ========================================
echo.
echo Repository: https://github.com/billoapp/TabezaConnect
echo.
pause
