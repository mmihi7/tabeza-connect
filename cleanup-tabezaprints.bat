@echo off
echo ========================================
echo CLEANING UP TABEZAPRINTS FOLDER
echo ========================================
echo.

echo Cleaning up all existing files in TabezaPrints folder...
echo This will give us a fresh start for testing
echo.

:: Check if folder exists
if exist "C:\ProgramData\Tabeza\TabezaPrints\" (
    echo [1/3] Current folder contents:
    dir "C:\ProgramData\Tabeza\TabezaPrints\" /B
    
    echo.
    echo [2/3] Deleting all files...
    del "C:\ProgramData\Tabeza\TabezaPrints\*" /Q /F >nul 2>&1
    
    echo.
    echo [3/3] Verifying cleanup...
    if exist "C:\ProgramData\Tabeza\TabezaPrints\*" (
        echo ❌ Some files could not be deleted
        echo Trying force delete...
        rd /s /q "C:\ProgramData\Tabeza\TabezaPrints" 2>nul
        mkdir "C:\ProgramData\Tabeza\TabezaPrints" 2>nul
        echo ✅ Folder recreated
    ) else (
        echo ✅ All files deleted successfully
    )
    
    echo.
    echo Final folder status:
    dir "C:\ProgramData\Tabeza\TabezaPrints\" /B
    
) else (
    echo ❌ TabezaPrints folder does not exist
    echo Creating folder...
    mkdir "C:\ProgramData\Tabeza\TabezaPrints" 2>nul
    echo ✅ Folder created
)

echo.
echo ========================================
echo ✅ CLEANUP COMPLETE!
echo ========================================
echo.
echo Status:
echo   - Old files: DELETED
echo   - Folder: FRESH and EMPTY
echo   - Ready for: NEW TESTS
echo.
echo Next steps:
echo   1. Configure EPSON to folder port
echo   2. Test with POS prints
echo   3. Watch bridge process clean files
echo.
echo Your bridge is ready to detect new prints! 🚀
echo.

pause
