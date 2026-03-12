# Test Receipt Print Script
# This simulates a POS printing a receipt to test TabezaConnect

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TabezaConnect Receipt Print Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will print a test receipt to trigger TabezaConnect capture." -ForegroundColor Yellow
Write-Host ""

# Create a test receipt
$receiptContent = @"
========================================
           TEST RECEIPT
========================================

Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Receipt #: TEST-$(Get-Random -Minimum 1000 -Maximum 9999)

----------------------------------------
ITEMS:
----------------------------------------
1x Coffee                        $3.50
1x Sandwich                      $7.00
1x Water                         $2.00
----------------------------------------
Subtotal:                       $12.50
Tax (8%):                        $1.00
----------------------------------------
TOTAL:                          $13.50
----------------------------------------

Thank you for your business!

========================================
"@

# Save to temp file
$tempFile = "$env:TEMP\tabeza-test-receipt.txt"
$receiptContent | Out-File -FilePath $tempFile -Encoding ASCII

Write-Host "Test receipt created: $tempFile" -ForegroundColor Green
Write-Host ""

# Get available printers
Write-Host "Available printers:" -ForegroundColor Cyan
$printers = Get-Printer | Select-Object -ExpandProperty Name
$printers | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
Write-Host ""

# Prompt for printer selection
Write-Host "Enter printer name (or press Enter for default printer):" -ForegroundColor Yellow
$selectedPrinter = Read-Host

if ([string]::IsNullOrWhiteSpace($selectedPrinter)) {
    $selectedPrinter = (Get-Printer | Where-Object { $_.Default -eq $true }).Name
    Write-Host "Using default printer: $selectedPrinter" -ForegroundColor Green
}

Write-Host ""
Write-Host "Printing to: $selectedPrinter" -ForegroundColor Cyan
Write-Host ""
Write-Host "Watch the TabezaConnect console for receipt detection..." -ForegroundColor Yellow
Write-Host ""

# Print the file
try {
    Start-Process -FilePath "notepad.exe" -ArgumentList "/p `"$tempFile`"" -Wait -WindowStyle Hidden
    Write-Host "Print job sent successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "TabezaConnect should now capture this from the Windows spooler." -ForegroundColor Green
} catch {
    Write-Host "Error printing: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
