param([string]$BarID, [string]$ConfigFile)

# Read existing config
if (Test-Path $ConfigFile) {
    $cfg = Get-Content $ConfigFile | ConvertFrom-Json
} else {
    $cfg = @{}
}

# Update configuration
$cfg.barId = $BarID
$cfg.apiUrl = "https://bkaigyrrzsqbfscyznzw.supabase.co"
$cfg.driverId = "driver-$env:COMPUTERNAME"
$cfg.version = "1.7.0"

# Write back to file
$cfg | ConvertTo-Json -Depth 10 | Set-Content $ConfigFile

Write-Host "Configuration updated successfully"
Write-Host "Bar ID: $BarID"
Write-Host "Config File: $ConfigFile"
