@echo off
echo Debugging TabezaConnect Download Issue
echo =====================================
echo.

echo Testing GitHub repository access...
curl -I "https://github.com/billoapp/TabezaConnect"
echo.

echo Testing releases page...
curl -I "https://github.com/billoapp/TabezaConnect/releases"
echo.

echo Testing specific download URLs...
echo.
echo URL 1: TabezaConnect.exe
curl -I "https://github.com/billoapp/TabezaConnect/releases/download/v1.1.1/TabezaConnect.exe"
echo.
echo URL 2: tabezaconnect.exe  
curl -I "https://github.com/billoapp/TabezaConnect/releases/download/v1.1.1/tabezaconnect.exe"
echo.

echo Testing if file exists in release...
curl -s "https://api.github.com/repos/billoapp/TabezaConnect/releases/tags/v1.1.1" | findstr "TabezaConnect.exe"
echo.

pause
