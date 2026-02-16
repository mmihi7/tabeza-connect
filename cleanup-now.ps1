# Clean up TabezaConnect workspace - PowerShell version
Write-Host "Cleaning TabezaConnect workspace..." -ForegroundColor Cyan

# Development markdown files to delete
$mdFiles = @(
    "TESTING-WORKFLOW.md",
    "WHAT-TO-EXPECT-AFTER-INSTALL.md"
)

foreach ($file in $mdFiles) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "  Deleted $file" -ForegroundColor Green
    }
}

Write-Host "`nCleanup complete!" -ForegroundColor Green
