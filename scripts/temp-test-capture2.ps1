# Test capture.exe manually
$env:TABEZA_BAR_ID = "438c80c1-fe11-4ac5-8a48-2fc45104ba31"
$env:TABEZA_CAPTURE_PATH = "C:\TabezaPrints"

Write-Host "Testing capture.exe..."
& "C:\TabezaPrints\capture.exe" 2>&1 | Select-Object -First 20

Write-Host "`nChecking logs..."
Get-ChildItem "C:\TabezaPrints\logs" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1