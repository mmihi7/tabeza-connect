# Simple test script to list printers
$printers = Get-Printer | Where-Object { 
    $_.Name -notmatch "Microsoft.*PDF|XPS|OneNote|Fax|Tabeza|AnyDesk|TeamViewer|Remote|Virtual" -and
    $_.PortName -ne "FILE:" -and
    $_.PortName -notmatch "^AD_|^TS\d+:" -and
    ![string]::IsNullOrWhiteSpace($_.PortName)
} | Sort-Object Name

Write-Host "Found $($printers.Count) printers:"
foreach ($printer in $printers) {
    Write-Host "  - $($printer.Name) [Port: $($printer.PortName)]"
}

# Output JSON
$printers | Select-Object Name, PortName, DriverName | ConvertTo-Json -Compress
