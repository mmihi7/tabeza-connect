# Kill all electron processes
Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "All processes killed"
Start-Sleep 2
Get-Process | Where-Object { $_.ProcessName -like '*electron*' -or $_.ProcessName -like '*node*' } | Select-Object Id,ProcessName