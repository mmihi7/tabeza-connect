# Test capture with stdin
$env:TABEZA_BAR_ID = "438c80c1-fe11-4ac5-8a48-2fc45104ba31"
$env:TABEZA_CAPTURE_PATH = "C:\TabezaPrints"

$testData = "Test Receipt
Item 1      100.00
Item 2      200.00
Total       300.00"

$testData | & "C:\TabezaPrints\capture.exe"

Write-Host "`nDone. Checking output folders..."
Get-ChildItem "C:\TabezaPrints" -Recurse -File | Sort-Object LastWriteTime -Descending | Select-Object -First 10 FullName,Length