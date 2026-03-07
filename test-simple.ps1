# Simple printer test
$printers = Get-Printer | Where-Object { 
    $_.Name -notmatch "Microsoft.*PDF|XPS|OneNote|Fax|Tabeza|AnyDesk|TeamViewer|Remote|Virtual" -and
    $_.PortName -ne "FILE:" -and
    ![string]::IsNullOrWhiteSpace($_.PortName)
} | Sort-Object Name

Write-Host "Found $($printers.Count) printers:"
foreach ($p in $printers) {
    Write-Host "  - $($p.Name) [Port: $($p.PortName)]"
}

$printers | Select-Object Name, PortName, DriverName | ConvertTo-Json -Compress
