# Quick fix for smart quotes in setup-test-printer.ps1

$filePath = ".\setup-test-printer.ps1"

# Read the file
$content = Get-Content $filePath -Raw

# Replace smart quotes with straight quotes
$content = $content -replace '"', '"'
$content = $content -replace '"', '"'
$content = $content -replace ''', "'"
$content = $content -replace ''', "'"

# Write back
$content | Set-Content $filePath -NoNewline

Write-Host "Fixed! Now run: .\setup-test-printer.ps1" -ForegroundColor Green
