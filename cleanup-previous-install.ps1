# Cleanup Previous TabezaConnect Installation
# Removes config files and data from previous installations

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Cleaning Up Previous Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$tabezaDataPath = "C:\ProgramData\Tabeza"

if (Test-Path $tabezaDataPath) {
    Write-Host "Found Tabeza data directory: $tabezaDataPath" -ForegroundColor Yellow
    Write-Host ""
    
    # List what will be deleted
    Write-Host "Files and folders to be deleted:" -ForegroundColor Yellow
    Get-ChildItem -Path $tabezaDataPath -Recurse | ForEach-Object {
        Write-Host "  - $($_.FullName)" -ForegroundColor Gray
    }
    Write-Host ""
    
    # Confirm deletion
    $confirm = Read-Host "Delete all files? (yes/no)"
    
    if ($confirm -eq "yes") {
        try {
            Remove-Item -Path $tabezaDataPath -Recurse -Force
            Write-Host ""
            Write-Host "✅ Successfully deleted all previous installation files" -ForegroundColor Green
            Write-Host ""
        }
        catch {
            Write-Host ""
            Write-Host "❌ Error deleting files: $_" -ForegroundColor Red
            Write-Host ""
        }
    }
    else {
        Write-Host ""
        Write-Host "Cleanup cancelled" -ForegroundColor Yellow
        Write-Host ""
    }
}
else {
    Write-Host "No previous installation data found at $tabezaDataPath" -ForegroundColor Green
    Write-Host ""
}

Write-Host "Done!" -ForegroundColor Cyan
