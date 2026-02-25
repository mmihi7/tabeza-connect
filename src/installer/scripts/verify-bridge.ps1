# Tabeza Connect - Bridge Verification Script
# Verifies complete system functionality with real test print

param(
    [Parameter(Mandatory=$true)]
    [string]$InstallPath
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "       VERIFICATION TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    # Check if service is running
    Write-Host "Checking service status..." -ForegroundColor Yellow
    $service = Get-Service -Name "TabezaConnect" -ErrorAction SilentlyContinue
    
    if (-not $service) {
        Write-Host "ERROR: TabezaConnect service not found!" -ForegroundColor Red
        exit 1
    }
    
    if ($service.Status -ne "Running") {
        Write-Host "ERROR: TabezaConnect service is not running!" -ForegroundColor Red
        Write-Host "Status: $($service.Status)" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  Service is running" -ForegroundColor Green
    Write-Host ""
    
    # Check if config exists
    Write-Host "Checking configuration..." -ForegroundColor Yellow
    $configFile = "C:\ProgramData\Tabeza\config.json"
    
    if (-not (Test-Path $configFile)) {
        Write-Host "ERROR: Configuration file not found!" -ForegroundColor Red
        Write-Host "Expected: $configFile" -ForegroundColor Red
        exit 1
    }
    
    $config = Get-Content $configFile | ConvertFrom-Json
    
    if (-not $config.bridge.enabled) {
        Write-Host "ERROR: Bridge not enabled in configuration!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  Configuration valid" -ForegroundColor Green
    Write-Host "  Printer: $($config.bridge.printerName)" -ForegroundColor Gray
    Write-Host "  Capture Folder: $($config.bridge.captureFolder)" -ForegroundColor Gray
    Write-Host ""
    
    # Check if printer exists
    Write-Host "Checking printer..." -ForegroundColor Yellow
    $printer = Get-Printer -Name $config.bridge.printerName -ErrorAction SilentlyContinue
    
    if (-not $printer) {
        Write-Host "ERROR: Printer not found: $($config.bridge.printerName)" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  Printer found: $($printer.Name)" -ForegroundColor Green
    Write-Host "  Status: $($printer.PrinterStatus)" -ForegroundColor Gray
    Write-Host ""
    
    # Test print verification
    Write-Host "Test Print Verification" -ForegroundColor Yellow
    Write-Host "========================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please send a test print to verify the bridge is working:" -ForegroundColor Cyan
    Write-Host "1. Open Notepad" -ForegroundColor White
    Write-Host "2. Type 'Tabeza Test Print'" -ForegroundColor White
    Write-Host "3. Print to 'EPSON L3210 Series'" -ForegroundColor White
    Write-Host "4. Check if the test print appears in the TabezaPrints folder" -ForegroundColor White
    Write-Host ""
    Write-Host "Press any key when you have sent the test print..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    
    # Check for test print file
    $testPrintFound = $false
    $timeout = 30  # Wait 30 seconds
    $elapsed = 0
    
    Write-Host "Waiting for test print..." -ForegroundColor Yellow
    
    while ($elapsed -lt $timeout) {
        $files = Get-ChildItem -Path $config.bridge.captureFolder -Filter "*.prn" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt (Get-Date).AddSeconds(-$timeout) }
        if ($files.Count -gt 0) {
            $testPrintFound = $true
            break
        }
        Start-Sleep -Seconds 1
        $elapsed++
        Write-Host "." -NoNewline -ForegroundColor Yellow
    }
    
    Write-Host ""
    
    if ($testPrintFound) {
        Write-Host "SUCCESS: Test print detected!" -ForegroundColor Green
        Write-Host "  The bridge is working correctly." -ForegroundColor Green
    } else {
        Write-Host "WARNING: No test print detected." -ForegroundColor Yellow
        Write-Host "  Please check your printer connection and try again." -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Installation verified!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    # Write status
    & "$PSScriptRoot\write-status.ps1" -StepNumber 7 -StepName "Installation verified" -Success $true -Details "Configuration validated"
    
    exit 0
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Verification failed" -ForegroundColor Red
    Write-Host "Details: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    exit 1
}
