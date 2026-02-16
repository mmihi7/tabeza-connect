# Detect Physical Printers
# Identifies receipt/thermal printers for dual-printer setup

param(
    [switch]$Verbose
)

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Tabeza Connect - Printer Detection   ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Get all installed printers
$allPrinters = Get-Printer -ErrorAction SilentlyContinue

if ($null -eq $allPrinters -or $allPrinters.Count -eq 0) {
    Write-Host "⚠️  No printers detected on this system" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "This is OK if you're setting up Tabeza-only mode." -ForegroundColor Gray
    Write-Host "For POS integration, you'll need to install a physical printer first." -ForegroundColor Gray
    exit 0
}

Write-Host "Found $($allPrinters.Count) printer(s) installed:" -ForegroundColor Green
Write-Host ""

# Identify potential receipt/thermal printers
$receiptPrinters = @()
$receiptKeywords = @(
    "Receipt", "Thermal", "POS", "Star", "Epson TM", 
    "Bixolon", "Citizen", "Zebra", "TSP", "RP"
)

foreach ($printer in $allPrinters) {
    $isReceiptPrinter = $false
    
    # Check printer name and driver for receipt printer keywords
    foreach ($keyword in $receiptKeywords) {
        if ($printer.Name -like "*$keyword*" -or $printer.DriverName -like "*$keyword*") {
            $isReceiptPrinter = $true
            break
        }
    }
    
    if ($isReceiptPrinter) {
        $receiptPrinters += $printer
        Write-Host "  🖨️  $($printer.Name)" -ForegroundColor Green
        if ($Verbose) {
            Write-Host "      Driver: $($printer.DriverName)" -ForegroundColor Gray
            Write-Host "      Port: $($printer.PortName)" -ForegroundColor Gray
            Write-Host "      Status: $($printer.PrinterStatus)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  📄 $($printer.Name)" -ForegroundColor Gray
        if ($Verbose) {
            Write-Host "      Driver: $($printer.DriverName)" -ForegroundColor DarkGray
        }
    }
}

Write-Host ""

if ($receiptPrinters.Count -gt 0) {
    Write-Host "✅ Detected $($receiptPrinters.Count) receipt/thermal printer(s)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Recommended Configuration:" -ForegroundColor Cyan
    Write-Host "  Primary (Physical): $($receiptPrinters[0].Name)" -ForegroundColor White
    Write-Host "  Secondary (Tabeza): Tabeza Receipt Printer" -ForegroundColor White
    Write-Host ""
    Write-Host "Your POS should print to BOTH printers:" -ForegroundColor Yellow
    Write-Host "  1. $($receiptPrinters[0].Name) - for customer receipts" -ForegroundColor Gray
    Write-Host "  2. Tabeza Receipt Printer - for digital capture" -ForegroundColor Gray
} else {
    Write-Host "⚠️  No receipt/thermal printers detected" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Detected printers appear to be standard document printers." -ForegroundColor Gray
    Write-Host "You may need to:" -ForegroundColor Gray
    Write-Host "  1. Install your receipt printer driver" -ForegroundColor Gray
    Write-Host "  2. Configure your POS to use the Tabeza virtual printer" -ForegroundColor Gray
}

Write-Host ""

# Export results to JSON for installer
$result = @{
    totalPrinters = $allPrinters.Count
    receiptPrinters = @($receiptPrinters | ForEach-Object {
        @{
            name = $_.Name
            driver = $_.DriverName
            port = $_.PortName
            status = $_.PrinterStatus.ToString()
        }
    })
    timestamp = (Get-Date).ToString("o")
}

$resultPath = Join-Path $env:TEMP "tabeza-printer-detection.json"
$result | ConvertTo-Json -Depth 10 | Out-File -FilePath $resultPath -Encoding UTF8

Write-Host "Detection results saved to: $resultPath" -ForegroundColor DarkGray
Write-Host ""

exit 0
