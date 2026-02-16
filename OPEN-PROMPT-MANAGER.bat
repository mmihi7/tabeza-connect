@echo off
echo ========================================
echo   Receipt Parser Prompt Manager
echo ========================================
echo.
echo Opening prompt manager in your browser...
echo.
echo This tool allows you to:
echo   - Edit DeepSeek AI system prompts
echo   - Test prompts with sample receipts
echo   - Configure temperature and token limits
echo.

REM Open the prompt manager in default browser
start http://localhost:8765/prompt-manager.html

echo.
echo ========================================
echo   Prompt Manager opened in browser
echo ========================================
echo.
echo Make sure the printer service is running!
echo If not, run: START-PRINTER-SERVICE-WORKING.bat
echo.
pause
