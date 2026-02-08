@'
# TABEZA PRINTER MODAL - Test Printer Setup
Write-Host ""
Write-Host "Checking admin privileges..." -ForegroundColor Cyan

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script requires Administrator privileges" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "Running as Administrator" -ForegroundColor Green

$printerName = "TABEZA Test Printer"
$portName = "TABEZA_TEST_PORT"
$printerHost = "127.0.0.1"
$printerPort = 9100
$driverName = "Generic / Text Only"

Write-Host "Creating printer: $printerName" -ForegroundColor Cyan

# Remove existing if present
Get-Printer -Name $printerName -ErrorAction SilentlyContinue | Remove-Printer -Confirm:$false
Get-PrinterPort -Name $portName -ErrorAction SilentlyContinue | Remove-PrinterPort -Confirm:$false

# Create port
Add-PrinterPort -Name $portName -PrinterHostAddress $printerHost -PortNumber $printerPort
Write-Host "Created port: $portName -> ${printerHost}:${printerPort}" -ForegroundColor Green

# Create printer
Add-Printer -Name $printerName -DriverName $driverName -PortName $portName
Write-Host "Created printer: $printerName" -ForegroundColor Green

Write-Host ""
Write-Host "SETUP COMPLETE!" -ForegroundColor Green
Write-Host "Test by printing from Notepad to: $printerName" -ForegroundColor Cyan
'@ | Set-Content setup-test-printer-clean.ps1

.\setup-test-printer-clean.ps1