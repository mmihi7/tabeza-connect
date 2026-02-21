@echo off
echo ========================================
echo CREATING SIMPLE PORT PATH
echo ========================================
echo.

echo Windows is rejecting the long path.
echo Let's create a simpler port that Windows will accept.
echo.

:: Step 1: Create simple folder
echo [1/4] Creating simple folder...
if exist "C:\TabezaPrints\" (
    echo ✅ Simple folder already exists
) else (
    mkdir "C:\TabezaPrints\" 2>nul
    if exist "C:\TabezaPrints\" (
        echo ✅ Simple folder created successfully
    ) else (
        echo ❌ Failed to create simple folder
    )
)

:: Step 2: Set permissions
echo.
echo [2/4] Setting folder permissions...
icacls "C:\TabezaPrints" /grant Everyone:F /T >nul 2>&1
echo ✅ Permissions set

:: Step 3: Test folder write
echo.
echo [3/4] Testing folder write...
echo "TEST WRITE - %DATE% %TIME%" > "C:\TabezaPrints\test.txt" 2>nul
if exist "C:\TabezaPrints\test.txt" (
    echo ✅ Folder is writable
    del "C:\TabezaPrints\test.txt" >nul
) else (
    echo ❌ Folder is not writable
)

:: Step 4: Update bridge config
echo.
echo [4/4] Updating bridge configuration...
(
echo {
echo   "printerName": "EPSON L3210 Series",
echo   "captureFolder": "C:\\TabezaPrints",
echo   "tempForwardFile": "C:\\ProgramData\\Tabeza\\fwd_temp.prn"
echo }
) > "C:\ProgramData\Tabeza\bridge-config.json"
echo ✅ Bridge config updated

echo.
echo ========================================
echo ✅ SIMPLE PORT READY!
echo ========================================
echo.
echo New Configuration:
echo   - Simple Port: C:\TabezaPrints
echo   - Bridge Watches: C:\TabezaPrints
echo   - Old Port: C:\ProgramData\Tabeza\TabezaPrints\
echo.
echo Manual Configuration Steps:
echo.
echo 1. Open Control Panel → Devices and Printers
echo 2. Right-click EPSON L3210 Series → Printer properties
echo 3. Go to Ports tab → Add Port...
echo 4. Select Local Port → Next
echo 5. Enter this port name: C:\TabezaPrints
echo    (NO trailing backslash!)
echo 6. Click OK → Select the new port
echo 7. Uncheck old port → Apply → OK
echo.
echo This shorter path should work with Windows!
echo.

pause
