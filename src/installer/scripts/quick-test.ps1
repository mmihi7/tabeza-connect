#Requires -RunAsAdministrator

<#
.SYNOPSIS
    Quick test script for Tabeza Pooling Printer configuration
    
.DESCRIPTION
    This script provides a quick way to test the pooling printer configuration
    in a live environment. It runs the configuration script and performs
    basic validation checks.
    
.NOTES
    - Must be run as Administrator
    - Requires a physical thermal printer to be installed
#>

param(
    [switch]$Cleanup
)

$ErrorActionPreference = 'Stop'

function Write-TestHeader {
    param([string]$Text)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host $Text -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Write-TestResult {
    param(
        [bool]$Success,
        [string]$Message
    )
    
    if ($Success) {
        Write-Host "✓ $Message" -ForegroundColor Green
    } else {
        Write-Host "✗ $Message" -ForegroundColor Red
    }
}

# Main test execution
try {
    Write-TestHeader "Tabeza Pooling Printer - Quick Test"
    
    if ($Cleanup) {
        Write-Host "Cleaning up test configuration..." -ForegroundColor Yellow
        
        # Remove Send2Me
        $printer = Get-Printer -Name "Send2Me" -ErrorAction SilentlyContinue
        if ($printer) {
            Remove-Printer -Name "Send2Me" -ErrorAction Stop
            Write-Host "Removed Send2Me" -ForegroundColor Yellow
        }
        
        # Remove capture port
        $port = Get-PrinterPort -Name "TabezaCapturePort" -ErrorAction SilentlyContinue
        if ($port) {
            Remove-PrinterPort -Name "TabezaCapturePort" -ErrorAction Stop
            Write-Host "Removed TabezaCapturePort" -ForegroundColor Yellow
        }
        
        Write-Host "`nCleanup complete!" -ForegroundColor Green
        exit 0
    }
    
    # Pre-flight checks
    Write-TestHeader "Pre-Flight Checks"
    
    # Check admin privileges
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    Write-TestResult -Success $isAdmin -Message "Administrator privileges"
    
    if (-not $isAdmin) {
        Write-Host "`nERROR: This script must be run as Administrator" -ForegroundColor Red
        exit 1
    }
    
    # Check Print Spooler
    $spooler = Get-Service -Name 'Spooler'
    $spoolerRunning = $spooler.Status -eq 'Running'
    Write-TestResult -Success $spoolerRunning -Message "Print Spooler service running"
    
    if (-not $spoolerRunning) {
        Write-Host "`nERROR: Print Spooler service is not running" -ForegroundColor Red
        exit 1
    }
    
    # Check for thermal printers
    $thermalPrinters = Get-Printer | Where-Object {
        $_.Name -like '*Receipt*' -or
        $_.Name -like '*Thermal*' -or
        $_.Name -like '*POS*' -or
        $_.Name -like '*TM-*' -or
        $_.Name -like '*TSP*' -or
        $_.Name -like '*Epson*' -or
        $_.Name -like '*Star*'
    }
    
    $hasThermalPrinter = $thermalPrinters.Count -gt 0
    Write-TestResult -Success $hasThermalPrinter -Message "Thermal printer detected ($($thermalPrinters.Count) found)"
    
    if (-not $hasThermalPrinter) {
        Write-Host "`nWARNING: No thermal printer detected" -ForegroundColor Yellow
        Write-Host "Available printers:" -ForegroundColor Yellow
        Get-Printer | Format-Table Name, DriverName, PortName
        Write-Host "`nPlease install a thermal printer before testing" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "`nDetected thermal printers:" -ForegroundColor Cyan
    $thermalPrinters | Format-Table Name, DriverName, PortName
    
    # Run configuration script
    Write-TestHeader "Running Configuration Script"
    
    $scriptPath = Join-Path $PSScriptRoot "configure-pooling-printer.ps1"
    $captureFilePath = "C:\TabezaPrints\order.prn"
    
    Write-Host "Script: $scriptPath" -ForegroundColor Gray
    Write-Host "Capture File: $captureFilePath" -ForegroundColor Gray
    Write-Host ""
    
    & $scriptPath -CaptureFilePath $captureFilePath
    
    $exitCode = $LASTEXITCODE
    Write-Host "`nConfiguration script exit code: $exitCode" -ForegroundColor $(if ($exitCode -eq 0 -or $exitCode -eq 2) { 'Green' } else { 'Red' })
    
    if ($exitCode -ne 0 -and $exitCode -ne 2) {
        Write-Host "Configuration failed!" -ForegroundColor Red
        exit $exitCode
    }
    
    # Validation checks
    Write-TestHeader "Validation Checks"
    
    # Check Send2Me exists
    $tabezaPrinter = Get-Printer -Name "Send2Me" -ErrorAction SilentlyContinue
    Write-TestResult -Success ($null -ne $tabezaPrinter) -Message "Send2Me exists"
    
    if ($tabezaPrinter) {
        # Check dual-port configuration
        $ports = $tabezaPrinter.PortName -split ','
        $hasDualPorts = $ports.Count -eq 2
        Write-TestResult -Success $hasDualPorts -Message "Dual-port configuration ($($ports.Count) ports)"
        
        if ($hasDualPorts) {
            Write-Host "  Ports: $($ports -join ' -> ')" -ForegroundColor Gray
        }
        
        # Check not shared
        $notShared = $tabezaPrinter.Shared -eq $false
        Write-TestResult -Success $notShared -Message "Printer not shared"
        
        # Check driver
        Write-Host "  Driver: $($tabezaPrinter.DriverName)" -ForegroundColor Gray
    }
    
    # Check capture port
    $capturePort = Get-PrinterPort -Name "TabezaCapturePort" -ErrorAction SilentlyContinue
    Write-TestResult -Success ($null -ne $capturePort) -Message "TabezaCapturePort exists"
    
    if ($capturePort) {
        Write-Host "  Path: $($capturePort.PrinterHostAddress)" -ForegroundColor Gray
    }
    
    # Check capture file
    $captureFileExists = Test-Path $captureFilePath
    Write-TestResult -Success $captureFileExists -Message "Capture file exists"
    
    if ($captureFileExists) {
        $fileInfo = Get-Item $captureFilePath
        Write-Host "  Size: $($fileInfo.Length) bytes" -ForegroundColor Gray
        Write-Host "  Path: $($fileInfo.FullName)" -ForegroundColor Gray
    }
    
    # Test print job capture
    Write-TestHeader "Print Job Capture Test"
    
    if ($tabezaPrinter -and $captureFileExists) {
        Write-Host "Sending test print job..." -ForegroundColor Cyan
        
        $initialSize = (Get-Item $captureFilePath).Length
        Write-Host "Initial file size: $initialSize bytes" -ForegroundColor Gray
        
        $testReceipt = @"
=================================
    TABEZA QUICK TEST
=================================
Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Test ID: $([Guid]::NewGuid().ToString().Substring(0,8))
=================================
"@
        
        $testReceipt | Out-Printer -Name "Send2Me"
        
        Write-Host "Waiting for print job to process..." -ForegroundColor Gray
        Start-Sleep -Seconds 3
        
        $finalSize = (Get-Item $captureFilePath).Length
        $captured = $finalSize - $initialSize
        
        Write-Host "Final file size: $finalSize bytes" -ForegroundColor Gray
        Write-Host "Bytes captured: $captured bytes" -ForegroundColor Gray
        
        $captureWorked = $captured -gt 0
        Write-TestResult -Success $captureWorked -Message "Print job captured"
        
        if (-not $captureWorked) {
            Write-Host "`nWARNING: No data was captured. Check printer status." -ForegroundColor Yellow
        }
    }
    
    # Summary
    Write-TestHeader "Test Summary"
    
    Write-Host "Configuration: " -NoNewline
    if ($exitCode -eq 0 -or $exitCode -eq 2) {
        Write-Host "SUCCESS" -ForegroundColor Green
    } else {
        Write-Host "FAILED" -ForegroundColor Red
    }
    
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "1. Check log file: C:\ProgramData\Tabeza\logs\configure-pooling.log"
    Write-Host "2. Verify physical printer printed the test receipt"
    Write-Host "3. Review LIVE-TESTING-GUIDE.md for comprehensive testing"
    Write-Host "4. Run integration tests: .\__tests__\run-all-integration-tests.ps1"
    
    Write-Host "`nTo clean up test configuration, run:" -ForegroundColor Yellow
    Write-Host "  .\quick-test.ps1 -Cleanup" -ForegroundColor Yellow
    
    Write-Host ""
    
} catch {
    Write-Host "`nERROR: $_" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}
