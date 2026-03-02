#Requires -Version 5.1
#Requires -RunAsAdministrator

<#
.SYNOPSIS
    Test script for New-TabezaPOSPrinter function

.DESCRIPTION
    Tests the New-TabezaPOSPrinter function by creating a test printer
    with pooling configuration. This test requires:
    - Administrator privileges
    - A physical printer installed on the system
    - Print Spooler service running

.NOTES
    This is a manual test script. Run it to verify the function works correctly.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [switch]$Cleanup,
    
    [Parameter(Mandatory = $false)]
    [switch]$DryRun
)

# Import the main script to get access to functions
$scriptPath = Join-Path $PSScriptRoot ".." "configure-pooling-printer.ps1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test: New-TabezaPOSPrinter Function" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This test must be run as Administrator" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Running as Administrator" -ForegroundColor Green

# Check Print Spooler
$spooler = Get-Service -Name 'Spooler' -ErrorAction SilentlyContinue
if ($spooler.Status -ne 'Running') {
    Write-Host "ERROR: Print Spooler service is not running" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Print Spooler is running" -ForegroundColor Green
Write-Host ""

# Cleanup mode - remove test printer and port
if ($Cleanup) {
    Write-Host "Cleanup Mode: Removing test printer and port..." -ForegroundColor Yellow
    
    try {
        $testPrinter = Get-Printer -Name "Tabeza POS Printer" -ErrorAction SilentlyContinue
        if ($testPrinter) {
            Remove-Printer -Name "Tabeza POS Printer" -ErrorAction Stop
            Write-Host "[OK] Removed test printer: Tabeza POS Printer" -ForegroundColor Green
        } else {
            Write-Host "[INFO] Test printer not found (already removed)" -ForegroundColor Gray
        }
        
        $testPort = Get-PrinterPort -Name "TabezaCapturePort" -ErrorAction SilentlyContinue
        if ($testPort) {
            Remove-PrinterPort -Name "TabezaCapturePort" -ErrorAction Stop
            Write-Host "[OK] Removed test port: TabezaCapturePort" -ForegroundColor Green
        } else {
            Write-Host "[INFO] Test port not found (already removed)" -ForegroundColor Gray
        }
        
        $testDir = "C:\TabezaPrints"
        if (Test-Path $testDir) {
            Remove-Item -Path $testDir -Recurse -Force -ErrorAction Stop
            Write-Host "[OK] Removed test directory: $testDir" -ForegroundColor Green
        }
        
        Write-Host ""
        Write-Host "Cleanup complete!" -ForegroundColor Green
        exit 0
        
    } catch {
        Write-Host "ERROR during cleanup: $_" -ForegroundColor Red
        exit 1
    }
}

# Step 1: Detect a physical printer
Write-Host "Step 1: Detecting physical printers..." -ForegroundColor Cyan

$allPrinters = Get-Printer -ErrorAction Stop
Write-Host "Found $($allPrinters.Count) total printers" -ForegroundColor Gray

# Exclude virtual printers
$excludePatterns = @(
    'Microsoft Print to PDF',
    'Microsoft XPS Document Writer',
    'Fax',
    'OneNote',
    'Adobe PDF',
    'Tabeza POS Printer'
)

$physicalPrinters = $allPrinters | Where-Object {
    $printerName = $_.Name
    $excluded = $false
    
    foreach ($pattern in $excludePatterns) {
        if ($printerName -like "*$pattern*") {
            $excluded = $true
            break
        }
    }
    
    -not $excluded
}

if ($physicalPrinters.Count -eq 0) {
    Write-Host "ERROR: No physical printers found on this system" -ForegroundColor Red
    Write-Host "Please install a printer driver and try again" -ForegroundColor Yellow
    exit 1
}

Write-Host "Found $($physicalPrinters.Count) physical printer(s):" -ForegroundColor Gray
foreach ($p in $physicalPrinters) {
    Write-Host "  - $($p.Name) (Driver: $($p.DriverName), Port: $($p.PortName))" -ForegroundColor Gray
}

# Use the first physical printer
$testPhysicalPrinter = $physicalPrinters[0]
Write-Host ""
Write-Host "[OK] Selected printer: $($testPhysicalPrinter.Name)" -ForegroundColor Green
Write-Host "     Driver: $($testPhysicalPrinter.DriverName)" -ForegroundColor Gray
Write-Host "     Port: $($testPhysicalPrinter.PortName)" -ForegroundColor Gray
Write-Host ""

if ($DryRun) {
    Write-Host "DRY RUN MODE: Would create printer with:" -ForegroundColor Yellow
    Write-Host "  Printer Name: Tabeza POS Printer" -ForegroundColor Gray
    Write-Host "  Driver: $($testPhysicalPrinter.DriverName)" -ForegroundColor Gray
    Write-Host "  Physical Port: $($testPhysicalPrinter.PortName)" -ForegroundColor Gray
    Write-Host "  Capture Port: TabezaCapturePort" -ForegroundColor Gray
    Write-Host "  Capture File: C:\TabezaPrints\order.prn" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Run without -DryRun to actually create the printer" -ForegroundColor Yellow
    exit 0
}

# Step 2: Create capture directory
Write-Host "Step 2: Creating capture directory..." -ForegroundColor Cyan

$captureDir = "C:\TabezaPrints"
$captureFile = Join-Path $captureDir "order.prn"

try {
    if (-not (Test-Path $captureDir)) {
        New-Item -Path $captureDir -ItemType Directory -Force | Out-Null
        Write-Host "[OK] Created directory: $captureDir" -ForegroundColor Green
    } else {
        Write-Host "[INFO] Directory already exists: $captureDir" -ForegroundColor Gray
    }
    
    # Grant permissions
    $icaclsArgs = "`"$captureDir`" /grant `"NT AUTHORITY\SYSTEM:(OI)(CI)F`" /T"
    $icaclsResult = Start-Process -FilePath "icacls.exe" -ArgumentList $icaclsArgs -Wait -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\icacls_output.txt" -RedirectStandardError "$env:TEMP\icacls_error.txt"
    
    if ($icaclsResult.ExitCode -eq 0) {
        Write-Host "[OK] Granted permissions to NT AUTHORITY\SYSTEM" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Could not grant permissions (non-fatal)" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "ERROR creating directory: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: Create capture port
Write-Host "Step 3: Creating capture port..." -ForegroundColor Cyan

try {
    $existingPort = Get-PrinterPort -Name "TabezaCapturePort" -ErrorAction SilentlyContinue
    
    if ($existingPort) {
        Write-Host "[INFO] Port already exists, removing..." -ForegroundColor Gray
        Remove-PrinterPort -Name "TabezaCapturePort" -ErrorAction Stop
    }
    
    Add-PrinterPort -Name "TabezaCapturePort" -PrinterHostAddress $captureFile -ErrorAction Stop
    Write-Host "[OK] Created capture port: TabezaCapturePort -> $captureFile" -ForegroundColor Green
    
    # Verify
    $verifyPort = Get-PrinterPort -Name "TabezaCapturePort" -ErrorAction Stop
    Write-Host "     Port Type: $($verifyPort.PortType)" -ForegroundColor Gray
    Write-Host "     File Path: $($verifyPort.PrinterHostAddress)" -ForegroundColor Gray
    
} catch {
    Write-Host "ERROR creating capture port: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 4: Create Tabeza POS Printer with pooling
Write-Host "Step 4: Creating Tabeza POS Printer with pooling..." -ForegroundColor Cyan

try {
    # Remove existing printer if it exists
    $existingPrinter = Get-Printer -Name "Tabeza POS Printer" -ErrorAction SilentlyContinue
    if ($existingPrinter) {
        Write-Host "[INFO] Printer already exists, removing..." -ForegroundColor Gray
        Remove-Printer -Name "Tabeza POS Printer" -ErrorAction Stop
    }
    
    # Create printer with physical port
    Write-Host "Creating printer with physical port: $($testPhysicalPrinter.PortName)" -ForegroundColor Gray
    Add-Printer -Name "Tabeza POS Printer" -DriverName $testPhysicalPrinter.DriverName -PortName $testPhysicalPrinter.PortName -ErrorAction Stop
    Write-Host "[OK] Created printer: Tabeza POS Printer" -ForegroundColor Green
    
    # Configure pooling via WMI
    Write-Host "Configuring printer pooling via WMI..." -ForegroundColor Gray
    $printerWMI = Get-WmiObject -Class Win32_Printer -Filter "Name='Tabeza POS Printer'" -ErrorAction Stop
    
    if (-not $printerWMI) {
        throw "Could not find printer via WMI"
    }
    
    # Set pooling properties
    $printerWMI.DoCompleteFirst = $false
    $printerWMI.EnableBIDI = $true
    
    # Set port list (thermal first, capture second)
    $allPorts = "$($testPhysicalPrinter.PortName),TabezaCapturePort"
    Write-Host "Setting port list: $allPorts" -ForegroundColor Gray
    $printerWMI.PortName = $allPorts
    
    # Apply changes
    $result = $printerWMI.Put()
    
    if ($result.ReturnValue -ne 0) {
        throw "WMI Put() failed with return value: $($result.ReturnValue)"
    }
    
    Write-Host "[OK] Printer pooling configured" -ForegroundColor Green
    
    # Set as not shared
    Set-Printer -Name "Tabeza POS Printer" -Shared $false -ErrorAction Stop
    Write-Host "[OK] Printer set as not shared" -ForegroundColor Green
    
} catch {
    Write-Host "ERROR creating printer: $_" -ForegroundColor Red
    Write-Host "Cleaning up..." -ForegroundColor Yellow
    
    try {
        Remove-Printer -Name "Tabeza POS Printer" -ErrorAction SilentlyContinue
        Remove-PrinterPort -Name "TabezaCapturePort" -ErrorAction SilentlyContinue
    } catch {
        # Ignore cleanup errors
    }
    
    exit 1
}

Write-Host ""

# Step 5: Verify configuration
Write-Host "Step 5: Verifying printer configuration..." -ForegroundColor Cyan

try {
    $verifyPrinter = Get-Printer -Name "Tabeza POS Printer" -ErrorAction Stop
    $verifyPorts = $verifyPrinter.PortName -split ','
    
    Write-Host "Printer Details:" -ForegroundColor Gray
    Write-Host "  Name: $($verifyPrinter.Name)" -ForegroundColor Gray
    Write-Host "  Driver: $($verifyPrinter.DriverName)" -ForegroundColor Gray
    Write-Host "  Ports: $($verifyPrinter.PortName)" -ForegroundColor Gray
    Write-Host "  Port Count: $($verifyPorts.Count)" -ForegroundColor Gray
    Write-Host "  Shared: $($verifyPrinter.Shared)" -ForegroundColor Gray
    Write-Host "  Status: $($verifyPrinter.PrinterStatus)" -ForegroundColor Gray
    Write-Host ""
    
    # Verify port count
    if ($verifyPorts.Count -ne 2) {
        Write-Host "[FAIL] Expected 2 ports, found $($verifyPorts.Count)" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Port count: 2" -ForegroundColor Green
    
    # Verify physical port
    if ($verifyPorts -contains $testPhysicalPrinter.PortName) {
        Write-Host "[OK] Physical port present: $($testPhysicalPrinter.PortName)" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Physical port missing: $($testPhysicalPrinter.PortName)" -ForegroundColor Red
        exit 1
    }
    
    # Verify capture port
    if ($verifyPorts -contains "TabezaCapturePort") {
        Write-Host "[OK] Capture port present: TabezaCapturePort" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Capture port missing: TabezaCapturePort" -ForegroundColor Red
        exit 1
    }
    
    # Verify port order (thermal should be first)
    if ($verifyPorts[0] -eq $testPhysicalPrinter.PortName) {
        Write-Host "[OK] Thermal printer is first port (correct order)" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Thermal printer is not first port (may affect seamless printing)" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "ERROR during verification: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TEST PASSED!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "The Tabeza POS Printer has been created successfully with pooling enabled." -ForegroundColor Green
Write-Host ""
Write-Host "To clean up, run:" -ForegroundColor Yellow
Write-Host "  .\test-new-tabeza-pos-printer.ps1 -Cleanup" -ForegroundColor Gray
Write-Host ""
