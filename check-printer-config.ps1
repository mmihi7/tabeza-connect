# Check TABEZA Virtual Printer Configuration
# This script helps verify and configure the printer to work with Tabeza service

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TABEZA Printer Configuration Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if printer exists
$printerName = "TABEZA Virtual Printer"
$printer = Get-Printer -Name $printerName -ErrorAction SilentlyContinue

if ($null -eq $printer) {
    Write-Host "❌ Printer '$printerName' not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Available printers:" -ForegroundColor Yellow
    Get-Printer | Select-Object Name, DriverName, PortName | Format-Table -AutoSize
    exit 1
}

Write-Host "✅ Printer found: $printerName" -ForegroundColor Green
Write-Host ""

# Display current configuration
Write-Host "📋 Current Configuration:" -ForegroundColor Cyan
Write-Host "  Name:        $($printer.Name)"
Write-Host "  Driver:      $($printer.DriverName)"
Write-Host "  Port:        $($printer.PortName)"
Write-Host "  Status:      $($printer.PrinterStatus)"
Write-Host "  Shared:      $($printer.Shared)"
Write-Host ""

# Check port details
$port = Get-PrinterPort -Name $printer.PortName -ErrorAction SilentlyContinue
if ($port) {
    Write-Host "📍 Port Details:" -ForegroundColor Cyan
    Write-Host "  Port Name:   $($port.Name)"
    Write-Host "  Description: $($port.Description)"
    
    if ($port.Name -like "FILE:*") {
        Write-Host "  Type:        File Port" -ForegroundColor Green
        Write-Host ""
        Write-Host "✅ Printer is configured to print to file!" -ForegroundColor Green
    } else {
        Write-Host "  Type:        $($port.Name)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "⚠️  Printer is NOT configured to print to file!" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "📋 To configure printer to print to folder:" -ForegroundColor Cyan
        Write-Host "  1. Open Control Panel → Devices and Printers"
        Write-Host "  2. Right-click '$printerName' → Printer properties"
        Write-Host "  3. Go to 'Ports' tab"
        Write-Host "  4. Click 'Add Port...'"
        Write-Host "  5. Select 'Local Port' → New Port"
        Write-Host "  6. Enter: C:\Users\$env:USERNAME\TabezaPrints\receipt.prn"
        Write-Host "  7. Click OK and select the new port"
        Write-Host "  8. Click Apply"
    }
} else {
    Write-Host "⚠️  Could not retrieve port details" -ForegroundColor Yellow
}

Write-Host ""

# Check if Tabeza service is running
Write-Host "🔍 Checking Tabeza Printer Service..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8765/api/status" -Method GET -TimeoutSec 5 -ErrorAction Stop
    $status = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ Tabeza service is running!" -ForegroundColor Green
    Write-Host "  Watch Folder: $($status.watchFolder)"
    Write-Host "  Bar ID:       $($status.barId)"
    Write-Host "  Configured:   $($status.configured)"
    Write-Host ""
    
    if (-not $status.configured) {
        Write-Host "⚠️  Service is not configured with Bar ID!" -ForegroundColor Yellow
        Write-Host "  Visit: http://localhost:3003/settings" -ForegroundColor Cyan
        Write-Host "  Go to Configuration tab → Printer Setup section" -ForegroundColor Cyan
    }
} catch {
    Write-Host "❌ Tabeza service is not running!" -ForegroundColor Red
    Write-Host "  Please start the service: tabeza-printer-service.exe" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Configuration Check Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
