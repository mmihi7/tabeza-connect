@echo off
echo.
echo ========================================
echo Pushing TabezaConnect to GitHub
echo ========================================
echo.

echo Adding all changes...
git add .

echo.
echo Committing...
git commit -m "Add auto-healing SSL fixes, diagnostics, and web-based troubleshooting"

echo.
echo Pushing to remote...
git push origin main

echo.
echo ========================================
echo Done! Check GitHub for changes.
echo ========================================
pause
