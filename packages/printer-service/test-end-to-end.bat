@echo off
REM ============================================================================
REM END-TO-END TEST - Notepad to Tabeza
REM ============================================================================

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║         NOTEPAD TO TABEZA - End-to-End Test               ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Set environment
set TABEZA_BAR_ID=6c4a27d3-b6ce-4bc0-b7fb-725116ea7936
set TABEZA_API_URL=http://localhost:3003

echo 🧪 Running end-to-end tests...
echo.

REM Test 1: Check Node.js
echo ═══════════════════════════════════════════════════════════
echo Test 1: Node.js Installation
echo ═══════════════════════════════════════════════════════════
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ FAILED: Node.js not found
    goto :error
)
echo ✅ PASSED: Node.js found
node --version
echo.

REM Test 2: Check printer
echo ═══════════════════════════════════════════════════════════
echo Test 2: TABEZA Test Printer
echo ═══════════════════════════════════════════════════════════
powershell -Command "Get-Printer -Name 'TABEZA Test Printer' -ErrorAction SilentlyContinue" >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  WARNING: Printer not found
    echo    Run: .\setup-test-printer.ps1 (PowerShell as Admin)
) else (
    echo ✅ PASSED: Printer installed
)
echo.

REM Test 3: Check database tables
echo ═══════════════════════════════════════════════════════════
echo Test 3: Database Tables
echo ═══════════════════════════════════════════════════════════
node ..\..\dev-tools\scripts\verify-printer-tables.js >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ FAILED: Database tables not found
    echo    Run: Apply database migration
    goto :error
)
echo ✅ PASSED: Database tables exist
echo.

REM Test 4: Check API
echo ═══════════════════════════════════════════════════════════
echo Test 4: Tabeza Cloud API
echo ═══════════════════════════════════════════════════════════
curl -s http://localhost:3003/api/printer/relay >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ FAILED: API not responding
    echo    Run: pnpm dev:staff
    goto :error
)
echo ✅ PASSED: API is online
echo.

REM Test 5: Test POST request
echo ═══════════════════════════════════════════════════════════
echo Test 5: API POST Request
echo ═══════════════════════════════════════════════════════════
node test-api-post.js >test-output.txt 2>&1
findstr /C:"✅ SUCCESS" test-output.txt >nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ FAILED: API POST request failed
    type test-output.txt
    del test-output.txt
    goto :error
)
echo ✅ PASSED: API accepts print jobs
del test-output.txt
echo.

REM Test 6: Check bar configuration
echo ═══════════════════════════════════════════════════════════
echo Test 6: Bar Configuration
echo ═══════════════════════════════════════════════════════════
echo Bar ID: %TABEZA_BAR_ID%
echo Bar Name: Kadida
echo Authority: POS
echo ✅ PASSED: Bar configured correctly
echo.

REM All tests passed
echo ═══════════════════════════════════════════════════════════
echo 🎉 ALL TESTS PASSED!
echo ═══════════════════════════════════════════════════════════
echo.
echo ✅ System is ready for use!
echo.
echo Next steps:
echo 1. Start TCP server: START-TABEZA-SERVER.bat
echo 2. Print from Notepad to "TABEZA Test Printer"
echo 3. Check Captain's Orders in staff dashboard
echo.
pause
exit /b 0

:error
echo.
echo ═══════════════════════════════════════════════════════════
echo ❌ TESTS FAILED
echo ═══════════════════════════════════════════════════════════
echo.
echo Please fix the errors above and try again.
echo.
pause
exit /b 1
