@echo off
echo ========================================
echo Push Printer Service to GitHub
echo ========================================
echo.

REM Initialize git repo
echo Step 1: Initializing git repository...
git init
if %errorlevel% neq 0 (
    echo ERROR: Git init failed
    pause
    exit /b 1
)

REM Add remote
echo Step 2: Adding GitHub remote...
git remote add origin https://github.com/billoapp/tabeza-printer-service.git
if %errorlevel% neq 0 (
    echo Note: Remote might already exist, continuing...
    git remote set-url origin https://github.com/billoapp/tabeza-printer-service.git
)

REM Create .gitignore
echo Step 3: Creating .gitignore...
echo node_modules/ > .gitignore
echo dist/ >> .gitignore
echo *.log >> .gitignore

REM Add all files
echo Step 4: Adding files...
git add .
if %errorlevel% neq 0 (
    echo ERROR: Git add failed
    pause
    exit /b 1
)

REM Commit
echo Step 5: Creating initial commit...
git commit -m "Initial commit: Tabeza Printer Service v1.0.0"
if %errorlevel% neq 0 (
    echo ERROR: Git commit failed
    pause
    exit /b 1
)

REM Set branch name
echo Step 6: Setting branch to main...
git branch -M main
if %errorlevel% neq 0 (
    echo ERROR: Branch rename failed
    pause
    exit /b 1
)

REM Push to GitHub
echo Step 7: Pushing to GitHub...
git push -u origin main --force
if %errorlevel% neq 0 (
    echo ERROR: Git push failed
    echo.
    echo Make sure you're logged into GitHub
    echo Run: gh auth login
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ SUCCESS! Code pushed to GitHub
echo ========================================
echo.
echo Now you can create the release:
echo 1. Go to: https://github.com/billoapp/tabeza-printer-service/releases/new
echo 2. Tag: v1.0.0
echo 3. Target: main
echo 4. Upload: dist\tabeza-printer-service.exe
echo 5. Publish
echo.
pause
