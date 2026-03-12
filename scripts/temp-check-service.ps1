$svc = Get-WmiObject -Class Win32_Service -Filter "Name LIKE '%Tabeza%'" 
if ($svc) {
    $svc | Format-List Name,DisplayName,State
} else {
    Write-Host "No Tabeza service found"
}

Write-Host "`nChecking for node process..."
Get-Process -Name node -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,WorkingSet64 | Format-Table