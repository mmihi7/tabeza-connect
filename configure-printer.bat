@echo off
echo Configuring Printer Service for Local Development...
echo.

curl -X POST http://localhost:8765/api/configure ^
  -H "Content-Type: application/json" ^
  -d "{\"barId\": \"438c80c1-fe11-4ac5-8a48-2fc45104ba31\", \"apiUrl\": \"http://localhost:3003\"}"

echo.
echo.
echo Configuration complete!
echo.
echo Now try the Test Print button again.
pause
