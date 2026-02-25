# Show Installation Summary with Checklist
param(
    [Parameter(Mandatory=$false)]
    [string]$StatusFile = "C:\ProgramData\Tabeza\logs\installation-status.json"
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   INSTALLATION SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Read status file
if (-not (Test-Path $StatusFile)) {
    Write-Host "ERROR: Status file not found!" -ForegroundColor Red
    Write-Host "Installation may not have completed properly." -ForegroundColor Yellow
    exit 1
}

try {
    $status = Get-Content $StatusFile | ConvertFrom-Json
    
    $allSuccess = $true
    
    foreach ($entry in $status) {
        if ($entry.success) {
            Write-Host "[✓]" -ForegroundColor Green -NoNewline
            Write-Host " $($entry.step). $($entry.name)" -ForegroundColor White
            if ($entry.details) {
                Write-Host "    $($entry.details)" -ForegroundColor Gray
            }
        } else {
            Write-Host "[✗]" -ForegroundColor Red -NoNewline
            Write-Host " $($entry.step). $($entry.name)" -ForegroundColor White
            if ($entry.details) {
                Write-Host "    $($entry.details)" -ForegroundColor Yellow
            }
            $allSuccess = $false
        }
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    
    if ($allSuccess) {
        Write-Host "   ✓ INSTALLATION COMPLETE!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Your Tabeza POS Connect is ready to use." -ForegroundColor White
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor White
        Write-Host "  1. Check the Tabeza staff app" -ForegroundColor Gray
        Write-Host "  2. Verify your printer appears" -ForegroundColor Gray
        Write-Host "  3. Send a test print from your POS" -ForegroundColor Gray
    } else {
        Write-Host "   ⚠ INSTALLATION COMPLETED WITH WARNINGS" -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Some steps failed. Please check the details above." -ForegroundColor Yellow
        Write-Host "The service may still work, but some features may be unavailable." -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Press any key to continue..." -ForegroundColor Cyan
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    
    exit 0
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to read status file" -ForegroundColor Red
    Write-Host "Details: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to continue..." -ForegroundColor Cyan
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}
