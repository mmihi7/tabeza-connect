# Check RedMon monitor
$redmonPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\RedMon"
if (Test-Path $redmonPath) {
    Write-Host "RedMon is installed"
    Get-ItemProperty -Path $redmonPath | Format-List *
} else {
    Write-Host "RedMon NOT installed"
    # Check what monitors are installed
    Write-Host "`nInstalled monitors:"
    Get-ChildItem "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors" | Select-Object Name
}