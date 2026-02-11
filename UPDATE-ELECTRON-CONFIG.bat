@echo off
echo ========================================
echo Update Tabeza Connect (Electron) Config
echo ========================================
echo.

set CONFIG_DIR=%APPDATA%\Tabeza
set CONFIG_FILE=%CONFIG_DIR%\config.json

echo Config location: %CONFIG_FILE%
echo.

if not exist "%CONFIG_DIR%" (
    echo Creating config directory...
    mkdir "%CONFIG_DIR%"
)

if exist "%CONFIG_FILE%" (
    echo Current config:
    type "%CONFIG_FILE%"
    echo.
    echo.
    set /p CONFIRM="Do you want to update this config? (Y/N): "
    if /i not "%CONFIRM%"=="Y" (
        echo Cancelled.
        pause
        exit /b
    )
)

echo.
echo Writing new config...
(
echo {
echo   "barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
echo   "apiUrl": "https://tabz-kikao.vercel.app",
echo   "driverId": "driver-MIHI-PC-1770655896151",
echo   "watchFolder": "C:\\Users\\mwene\\TabezaPrints"
echo }
) > "%CONFIG_FILE%"

echo.
echo ✅ Config updated successfully!
echo.
echo New config:
type "%CONFIG_FILE%"
echo.
echo.
echo Now restart Tabeza Connect (the .exe app)
echo.
pause
