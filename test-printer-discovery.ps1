# Test script to verify printer discovery filter
# This tests the exact filter logic that will be used in the main script

Write-Host "Testing Printer Discovery Filter" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Get ALL printers first
$allPrinters = Get-Printer -ErrorAction SilentlyContinue
Write-Host "Total printers found: $($allPrinters.Count)" -ForegroundColor Yellow
Write-Host ""

# Show all printers with details
Write-Host "All Printers:" -ForegroundColor White
foreach ($p in $allPrinters) {
    Write-Host "  - $($p.Name)" -ForegroundColor Gray
    Write-Host "    Port: $($p.PortName)" -ForegroundColor DarkGray
    Write-Host "    Driver: $($p.DriverName)" -ForegroundColor DarkGray
}
Write-Host ""

# Apply filter
$filteredPrinters = Get-Printer | Where-Object { 
    $_.Name -notmatch "Microsoft.*PDF|XPS|OneNote|Fax|Tabeza|AnyDesk|TeamViewer|Remote|Virtual" -and
    $_.PortName -ne "FILE:" -and
    $_.PortName -notmatch "^AD_|^TS\d+:" -and
    ![string]::IsNullOrWhiteSpace($_.PortName)
} | Sort-Object Name

Write-Host "After Filter: $($filteredPrinters.Count) printers" -ForegroundColor Green
Write-Host ""

# Show filtered printers
Write-Host "Filtered Printers (Physical Only):" -ForegroundColor White
foreach ($p in $filteredPrinters) {
    Write-Host "  ✓ $($p.Name)" -ForegroundColor Green
    Write-Host "    Port: $($p.PortName)" -ForegroundColor DarkGray
    Write-Host "    Driver: $($p.DriverName)" -ForegroundColor DarkGray
}
Write-Host ""

# Show what was filtered out
$excluded = $allPrinters | Where-Object { 
    $_.Name -match "Microsoft.*PDF|XPS|OneNote|Fax|Tabeza|AnyDesk|TeamViewer|Remote|Virtual" -or
    $_.PortName -eq "FILE:" -or
    $_.PortName -match "^AD_|^TS\d+:" -or
    [string]::IsNullOrWhiteSpace($_.PortName)
}

if ($excluded.Count -gt 0) {
    Write-Host "Excluded Printers (Virtual/Remote):" -ForegroundColor Red
    foreach ($p in $excluded) {
        $reason = ""
        if ($p.Name -match "Microsoft.*PDF|XPS|OneNote|Fax") { $reason = "Microsoft virtual printer" }
        elseif ($p.Name -match "Tabeza") { $reason = "Tabeza printer" }
        elseif ($p.Name -match "AnyDesk") { $reason = "AnyDesk remote printer" }
        elseif ($p.Name -match "TeamViewer") { $reason = "TeamViewer remote printer" }
        elseif ($p.Name -match "Remote|Virtual") { $reason = "Remote/Virtual printer" }
        elseif ($p.PortName -eq "FILE:") { $reason = "FILE: port (save to file)" }
        elseif ($p.PortName -match "^AD_|^TS\d+:") { $reason = "Remote desktop port" }
        elseif ([string]::IsNullOrWhiteSpace($p.PortName)) { $reason = "No port configured" }
        
        Write-Host "  ✗ $($p.Name)" -ForegroundColor Red
        Write-Host "    Reason: $reason" -ForegroundColor DarkRed
        Write-Host "    Port: $($p.PortName)" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "Test Complete!" -ForegroundColor Cyan

# Output JSON for programmatic use
Write-Host ""
Write-Host "JSON Output:" -ForegroundColor Yellow
$filteredPrinters | Select-Object Name, PortName, DriverName | ConvertTo-Json -Compress
