# Diagnose Printer Port Configuration
# Shows current printer setup and identifies issues

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Printer Port Diagnostic" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get all printers
$printers = Get-Printer | Where-Object { $_.Name -like "*Epson*" -or $_.Name -like "*TM*" -or $_.Name -like "*Tabeza*" }

if ($printers.Count -eq 0) {
    Write-Host "No thermal printers found!" -ForegroundColor Red
    exit 1
}

foreach ($printer in $printers) {
    Write-Host "Printer: $($printer.Name)" -ForegroundColor Yellow
    Write-Host "  Status: $($printer.PrinterStatus)" -ForegroundColor $(if ($printer.PrinterStatus -eq "Normal") { "Green" } else { "Red" })
    Write-Host "  Port: $($printer.PortName)" -ForegroundColor Cyan
    Write-Host "  Driver: $($printer.DriverName)" -ForegroundColor Gray
    Write-Host ""
    
    # Check if port is a file port (problematic)
    if ($printer.PortName -like "*TabezaPrints*" -or $printer.PortName -like "*.prn") {
        Write-Host "  ⚠️  WARNING: Printer is using a FILE port!" -ForegroundColor Red
        Write-Host "  This will cause communication errors." -ForegroundColor Red
        Write-Host ""
    }
    
    # Get port details
    $port = Get-PrinterPort -Name $printer.PortName -ErrorAction SilentlyContinue
    if ($port) {
        Write-Host "  Port Details:" -ForegroundColor Yellow
        Write-Host "    Type: $($port.GetType().Name)" -ForegroundColor Gray
        Write-Host "    Description: $($port.Description)" -ForegroundColor Gray
        
        if ($port.PortMonitor) {
            Write-Host "    Monitor: $($port.PortMonitor)" -ForegroundColor Gray
        }
    }
    Write-Host ""
    Write-Host "----------------------------------------" -ForegroundColor Gray
    Write-Host ""
}

# Check config.json
$configFile = "C:\ProgramData\Tabeza\config.json"
if (Test-Path $configFile) {
    Write-Host "Current config.json:" -ForegroundColor Yellow
    $config = Get-Content $configFile | ConvertFrom-Json
    Write-Host "  Printer Name: $($config.bridge.printerName)" -ForegroundColor Gray
    Write-Host "  Original Port: $($config.bridge.originalPort)" -ForegroundColor Gray
    Write-Host "  Capture Folder: $($config.bridge.captureFolder)" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Recommended Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If printer is using a FILE port:" -ForegroundColor Yellow
Write-Host "1. Run: fix-printer-port.ps1" -ForegroundColor White
Write-Host "2. This will restore the original USB/network port" -ForegroundColor White
Write-Host ""
