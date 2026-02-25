# Tabeza Connect - Thermal Printer Detection Script
# Automatically detects thermal/POS printers on the system

param(
    [Parameter(Mandatory=$true)]
    [string]$OutputFile
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Tabeza Connect - Printer Detection" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    # Get all printers, excluding obvious non-receipt printers
    $excluded = "Microsoft|OneNote|Fax|PDF|AnyDesk|XPS|Send To|Adobe"
    
    Write-Host "Scanning for printers..." -ForegroundColor Yellow
    
    $printers = Get-Printer | Where-Object { 
        $_.Name -notmatch $excluded -and 
        $_.PrinterStatus -ne "Offline"
    }
    
    if ($printers.Count -eq 0) {
        Write-Host ""
        Write-Host "ERROR: No printers found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please ensure:" -ForegroundColor Yellow
        Write-Host "  1. Your printer is powered on" -ForegroundColor Yellow
        Write-Host "  2. Printer drivers are installed" -ForegroundColor Yellow
        Write-Host "  3. Printer is connected (USB/Network)" -ForegroundColor Yellow
        Write-Host ""
        exit 1
    }
    
    # Prefer printers with receipt-related keywords
    $receiptKeywords = "Receipt|Thermal|POS|TM-|RP-|Epson|Star|Citizen|Bixolon|Sam4s"
    $preferredPrinter = $printers | Where-Object { $_.Name -match $receiptKeywords } | Select-Object -First 1
    
    # Fall back to first available printer if no keyword matches
    if (-not $preferredPrinter) {
        $preferredPrinter = $printers | Select-Object -First 1
    }
    
    Write-Host "Found printer: $($preferredPrinter.Name)" -ForegroundColor Green
    Write-Host "  Port: $($preferredPrinter.PortName)" -ForegroundColor Gray
    Write-Host "  Status: $($preferredPrinter.PrinterStatus)" -ForegroundColor Gray
    Write-Host "  Driver: $($preferredPrinter.DriverName)" -ForegroundColor Gray
    Write-Host ""
    
    # Create output JSON - save original USB port, not current TabezaCapturePort
    $originalPort = $preferredPrinter.PortName
    if ($originalPort -eq "TabezaCapturePort") {
        # Printer was already configured, try to find the original USB port
        $usbPorts = Get-PrinterPort | Where-Object { $_.Name -match "USB" }
        if ($usbPorts.Count -gt 0) {
            $originalPort = $usbPorts[0].Name
        }
    }
    
    $output = @{
        printerName = $preferredPrinter.Name
        originalPortName = $originalPort
        originalPortPath = $originalPort
        status = $preferredPrinter.PrinterStatus.ToString()
        driverName = $preferredPrinter.DriverName
    }
    
    # Ensure output directory exists
    $outputDir = Split-Path -Parent $OutputFile
    if (-not (Test-Path $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    }
    
    # Write JSON to file
    $output | ConvertTo-Json | Set-Content -Path $OutputFile -Encoding UTF8
    
    Write-Host "Printer information saved to: $OutputFile" -ForegroundColor Green
    Write-Host ""
    
    # Write status
    & "$PSScriptRoot\write-status.ps1" -StepNumber 2 -StepName "Printer detected" -Success $true -Details "Found: $($preferredPrinter.Name)"
    
    exit 0
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to detect printers" -ForegroundColor Red
    Write-Host "Details: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    
    # Write status
    & "$PSScriptRoot\write-status.ps1" -StepNumber 2 -StepName "Printer detected" -Success $false -Details $_.Exception.Message
    
    exit 1
}
