$echo "Test print" | & "C:\TabezaPrints\capture.exe"
if ($LASTEXITCODE -eq 0) {
    Write-Host "Capture script executed successfully"
} else {
    Write-Host "Capture script failed with exit code: $LASTEXITCODE"
}