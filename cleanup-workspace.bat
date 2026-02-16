@echo off
REM ========================================
REM Clean up TabezaConnect workspace
REM Removes development files and keeps only production code
REM ========================================

echo.
echo Cleaning up TabezaConnect workspace...
echo.

REM Remove all development batch files (except this one and build scripts)
echo Removing development batch files...
for %%f in (
    ADD-*.bat
    ANTIVIRUS-*.bat
    BUILD-ERROR-*.bat
    BUILD-INSTALLER-*.bat
    BUILD-LOCKED-*.bat
    BUILD-NSSM-*.bat
    BUILD-PRODUCTION.bat
    BUILD-SCRIPT-*.bat
    BUILD-SUCCESS.bat
    BUILD-WITH-*.bat
    CHECK-*.bat
    COPY-*.bat
    DIAGNOSE-*.bat
    ENABLE-*.bat
    FIX-*.bat
    MANUAL-*.bat
    REBUILD-*.bat
    REGISTER-*.bat
    TEST-*.bat
    VERIFY-*.bat
) do (
    if exist "%%f" (
        echo   Deleting %%f
        del /q "%%f"
    )
)

REM Remove development markdown files
echo.
echo Removing development markdown files...
for %%f in (
    *-SOLUTION.md
    *-SOLUTION.txt
    *-GUIDE.md
    *-ISSUE*.md
    *-FIXED.md
    *-COMPLETE.md
    *-SUCCESS.md
    *-DIAGNOSIS.md
    *-TROUBLESHOOTING.md
    *-REPORT.md
    *-READY.md
    *-CHECKLIST.md
    *-SUMMARY.md
    *-SUMMARY.txt
    *-FIX.txt
    *-VERIFICATION.md
    QUICK-*.md
    QUICK-*.txt
) do (
    if exist "%%f" (
        echo   Deleting %%f
        del /q "%%f"
    )
)

REM Remove test files
echo.
echo Removing test files...
for %%f in (
    test-*.js
    run-with-error.js
    *.wsb
) do (
    if exist "%%f" (
        echo   Deleting %%f
        del /q "%%f"
    )
)

REM Remove development directories
echo.
echo Removing development directories...
if exist "Plan" (
    echo   Deleting Plan directory
    rmdir /s /q "Plan"
)
if exist "Fix" (
    echo   Deleting Fix directory
    rmdir /s /q "Fix"
)

REM Remove duplicate license
echo.
echo Removing duplicate license files...
if exist "LICENSE.txt" (
    echo   Deleting LICENSE.txt (keeping LICENSE)
    del /q "LICENSE.txt"
)

echo.
echo ========================================
echo Cleanup complete!
echo ========================================
echo.
echo Workspace is now clean and ready for GitHub.
echo.
pause
