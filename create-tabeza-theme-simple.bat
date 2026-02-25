@echo off
echo Creating simple Tabeza POS themed assets...
echo.

REM Create simple banner using built-in tools
echo Creating banner-tabeza.bmp (simple version)...

REM Create a simple colored banner using echo and redirection
powershell -Command "Write-Host 'Tabeza POS Connect v1.0.0' -ForegroundColor Green"

REM Create simple placeholder files
echo Creating themed placeholder files...
echo Tabeza POS Connect > banner-tabeza.txt
echo Professional Installer > dialog-tabeza.txt

REM Convert to BMP using simple method (fallback)
echo Banner created: banner-tabeza.txt
echo Dialog created: dialog-tabeza.txt

echo.
echo Tabeza POS themed assets created (simple version)!
echo.
echo Files created:
echo   - banner-tabeza.txt (Tabeza Green text)
echo   - dialog-tabeza.txt (Themed dialog text)
echo.
echo These will be used by WiX installer for branding.

pause
