@echo off
echo Rebuilding installer...
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer-pkg-v1.7.15.iss
if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo Installer rebuilt successfully!
    echo ========================================
    echo.
    echo Location: installer-output\TabezaConnect-Setup-v1.7.15-PRODUCTION.exe
) else (
    echo.
    echo ========================================
    echo Installer build FAILED
    echo ========================================
)
pause
