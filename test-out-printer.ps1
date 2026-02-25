# Test Out-Printer Command
# This script tests if Out-Printer can send to your Epson printer

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Test Out-Printer to Epson" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Load config to get printer name
$configFile = "C:\ProgramData\Tabeza\config.json"
if (Test-Path $configFile) {
    $config = Get-Content $configFile | ConvertFrom-Json
    $printerName = $config.bridge.printerName
    Write-Host "Printer from config: $printerName" -ForegroundColor Yellow
} else {
    Write-Host "Config not found, using default" -ForegroundColor Yellow
    $printerName = "EPSON L3210 Series"
}
Write-Host ""

# Check if printer exists
Write-Host "Checking if printer exists..." -ForegroundColor Yellow
try {
    $printer = Get-Printer -Name $printerName -ErrorAction Stop
    Write-Host "  ✅ Printer found: $($printer.Name)" -ForegroundColor Green
    Write-Host "  Port: $($printer.PortName)" -ForegroundColor Gray
    Write-Host "  Status: $($printer.PrinterStatus)" -ForegroundColor Gray
    Write-Host "  Driver: $($printer.DriverName)" -ForegroundColor Gray
} catch {
    Write-Host "  ❌ Printer not found: $printerName" -ForegroundColor Red
    Write-Host ""
    Write-Host "Available printers:" -ForegroundColor Yellow
    Get-Printer | Where-Object { $_.Name -like "*Epson*" } | ForEach-Object {
        Write-Host "  - $($_.Name)" -ForegroundColor Cyan
    }
    exit 1
}
Write-Host ""

# Create test file
$testContent = @"
========================================
       TEST PRINT
========================================
Date: $(Get-Date)
Printer: $printerName

This is a test to verify Out-Printer
can send data to your Epson printer.

========================================
"@

$tempFile = "C:\ProgramData\Tabeza\temp\test-out-printer.txt"
$testContent | Set-Content -Path $tempFile -Encoding ASCII
Write-Host "Test file created: $tempFile" -ForegroundColor Gray
Write-Host ""

# Test 1: Out-Printer with printer name
Write-Host "Test 1: Out-Printer with printer name" -ForegroundColor Yellow
try {
    Get-Content -Path $tempFile -Raw | Out-Printer -Name $printerName -ErrorAction Stop
    Write-Host "  ✅ SUCCESS - Check your printer!" -ForegroundColor Green
} catch {
    Write-Host "  ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Out-Printer with -Encoding Byte (like bridge uses)
Write-Host "Test 2: Out-Printer with -Encoding Byte" -ForegroundColor Yellow
try {
    Get-Content -Path $tempFile -Encoding Byte -Raw | Out-Printer -Name $printerName -ErrorAction Stop
    Write-Host "  ✅ SUCCESS - Check your printer!" -ForegroundColor Green
} catch {
    Write-Host "  ❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 3: Check printer queue
Write-Host "Test 3: Check printer queue" -ForegroundColor Yellow
$jobs = Get-PrintJob -PrinterName $printerName -ErrorAction SilentlyContinue
if ($jobs) {
    Write-Host "  Print jobs in queue:" -ForegroundColor Cyan
    $jobs | ForEach-Object {
        Write-Host "    - $($_.DocumentName) | Status: $($_.JobStatus)" -ForegroundColor Gray
    }
} else {
    Write-Host "  No print jobs in queue" -ForegroundColor Gray
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Test Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If Test 1 or Test 2 succeeded, check your Epson printer" -ForegroundColor Yellow
Write-Host "for printed output. If nothing printed, the issue is" -ForegroundColor Yellow
Write-Host "with the printer itself, not the code." -ForegroundColor Yellow
Write-Host ""
