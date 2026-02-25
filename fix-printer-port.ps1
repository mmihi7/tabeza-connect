# Fix Printer Port Configuration
# Restores printer to its original physical port

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fix Printer Port" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Load config to get original port
$configFile = "C:\ProgramData\Tabeza\config.json"
if (-not (Test-Path $configFile)) {
    Write-Host "ERROR: config.json not found!" -ForegroundColor Red
    Write-Host "Cannot determine original port." -ForegroundColor Red
    exit 1
}

$config = Get-Content $configFile | ConvertFrom-Json
$printerName = $config.bridge.printerName
$originalPort = $config.bridge.originalPort

Write-Host "Printer: $printerName" -ForegroundColor Yellow
Write-Host "Original Port: $originalPort" -ForegroundColor Yellow
Write-Host ""

# Get current printer
$printer = Get-Printer -Name $printerName -ErrorAction SilentlyContinue
if (-not $printer) {
    Write-Host "ERROR: Printer not found: $printerName" -ForegroundColor Red
    exit 1
}

Write-Host "Current Port: $($printer.PortName)" -ForegroundColor Gray
Write-Host ""

# Check if already on correct port
if ($printer.PortName -eq $originalPort) {
    Write-Host "✅ Printer is already on the correct port!" -ForegroundColor Green
    Write-Host ""
    exit 0
}

# Restore original port
Write-Host "Restoring original port..." -ForegroundColor Yellow
try {
    Set-Printer -Name $printerName -PortName $originalPort -ErrorAction Stop
    Write-Host "✅ Port restored successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Restart spooler to clear error state
    Write-Host "Restarting print spooler..." -ForegroundColor Yellow
    Restart-Service Spooler -Force
    Start-Sleep -Seconds 3
    Write-Host "✅ Spooler restarted" -ForegroundColor Green
    Write-Host ""
    
    # Verify
    $printer = Get-Printer -Name $printerName
    Write-Host "Verification:" -ForegroundColor Yellow
    Write-Host "  Port: $($printer.PortName)" -ForegroundColor Gray
    Write-Host "  Status: $($printer.PrinterStatus)" -ForegroundColor $(if ($printer.PrinterStatus -eq "Normal") { "Green" } else { "Yellow" })
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Port Fixed Successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "The printer should now work normally." -ForegroundColor Green
    Write-Host "Try printing a test page from your POS." -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host "❌ ERROR: Failed to restore port" -ForegroundColor Red
    Write-Host "Details: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    exit 1
}
