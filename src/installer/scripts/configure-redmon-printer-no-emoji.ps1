# Configure Tabeza Agent with Redmon Port
# Creates a printer using Generic/Text Only driver with Redmon port
# that pipes print jobs to the Tabeza Connect capture script
# v1.7.14 - Redmon-based receipt capture implementation (No emoji version)

param(
    [Parameter(Mandatory = $false)]
    [string]$BarId = "UNCONFIGURED",
    
    [string]$CaptureScriptPath = "C:\Program Files\TabezaConnect\resources\capture.exe",
    [string]$PrinterName = "Tabeza Agent",
    [string]$DriverName = "Generic / Text Only",
    [string]$PortName = "TabezaCapturePort",
    [switch]$Detailed
)

Write-Host "Configuring Tabeza Agent with Redmon..." -ForegroundColor Cyan
Write-Host ""

# ===============================================================================
# VALIDATION
# ===============================================================================

# Validate Bar ID
if ([string]::IsNullOrWhiteSpace($BarId)) {
    Write-Host "[WARNING] Bar ID is empty, using placeholder 'UNCONFIGURED'" -ForegroundColor Yellow
    $BarId = "UNCONFIGURED"
}

if ($BarId -eq "UNCONFIGURED") {
    Write-Host "[INFO] Bar ID: $BarId (will be configured in Management UI)" -ForegroundColor Cyan
} else {
    Write-Host "[OK] Bar ID: $BarId" -ForegroundColor Green
}

# Validate capture script exists
if (-not (Test-Path $CaptureScriptPath)) {
    Write-Host "[ERROR] Capture script not found: $CaptureScriptPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please ensure capture.exe is installed before configuring the printer." -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Capture script found: $CaptureScriptPath" -ForegroundColor Green

# Verify Redmon is installed
Write-Host ""
Write-Host "Verifying Redmon installation..." -ForegroundColor Cyan

$redmonRegPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port"
if (-not (Test-Path $redmonRegPath)) {
    Write-Host "[ERROR] Redmon is not installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run install-redmon.ps1 before configuring the printer." -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Redmon is installed" -ForegroundColor Green

# ===============================================================================
# PRINTER DRIVER SETUP
# ===============================================================================

Write-Host ""
Write-Host "Checking printer driver..." -ForegroundColor Cyan

$driver = Get-PrinterDriver -Name $DriverName -ErrorAction SilentlyContinue

if (-not $driver) {
    Write-Host "[WARNING] Driver '$DriverName' not found, installing..." -ForegroundColor Yellow
    
    try {
        Add-PrinterDriver -Name $DriverName -ErrorAction Stop
        Write-Host "[OK] Driver installed successfully" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to install driver: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "The Generic/Text Only driver should be built into Windows." -ForegroundColor Yellow
        Write-Host "Please check Windows Features and ensure Print Services are enabled." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "[OK] Driver '$DriverName' is available" -ForegroundColor Green
}

# ===============================================================================
# REDMON PORT CONFIGURATION
# ===============================================================================

Write-Host ""
Write-Host "Configuring Redmon port..." -ForegroundColor Cyan

# Check if port already exists
$existingPort = Get-PrinterPort -Name $PortName -ErrorAction SilentlyContinue

if ($existingPort) {
    Write-Host "[WARNING] Port '$PortName' already exists" -ForegroundColor Yellow
    Write-Host "   Removing existing port..." -ForegroundColor Cyan
    
    try {
        Remove-PrinterPort -Name $PortName -ErrorAction Stop
        Write-Host "[OK] Existing port removed" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to remove existing port: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "The port may be in use by another printer." -ForegroundColor Yellow
        Write-Host "Please remove any printers using this port first." -ForegroundColor Yellow
        exit 1
    }
}

# Add Redmon port
Write-Host "Creating Redmon port '$PortName'..." -ForegroundColor Cyan

try {
    # Add the port using Add-PrinterPort with Redmon monitor
    Add-PrinterPort -Name $PortName -PrinterHostAddress "RPT1:" -ErrorAction Stop
    Write-Host "[OK] Redmon port created" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to create Redmon port: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Ensure Redmon is properly installed" -ForegroundColor White
    Write-Host "  2. Restart the Print Spooler service: Restart-Service Spooler" -ForegroundColor White
    Write-Host "  3. Check Windows Event Viewer for errors" -ForegroundColor White
    exit 1
}

# Configure Redmon port settings via registry
Write-Host "Configuring Redmon port settings..." -ForegroundColor Cyan

$portRegPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port\Ports\$PortName"

try {
    # Create port registry key if it doesn't exist
    if (-not (Test-Path $portRegPath)) {
        New-Item -Path $portRegPath -Force | Out-Null
    }
    
    # Set Redmon port configuration
    # Command: Path to capture script
    Set-ItemProperty -Path $portRegPath -Name "Command" -Value $CaptureScriptPath -Type String
    
    # Arguments: Pass Bar ID to capture script
    Set-ItemProperty -Path $portRegPath -Name "Arguments" -Value "--bar-id $BarId" -Type String
    
    # Output: Use stdin (empty string means pipe to stdin)
    Set-ItemProperty -Path $portRegPath -Name "Output" -Value "" -Type String
    
    # ShowWindow: 0 = hidden (no console window)
    Set-ItemProperty -Path $portRegPath -Name "ShowWindow" -Value 0 -Type DWord
    
    # RunUser: 0 = run as LocalService (same as Tabeza Connect service)
    Set-ItemProperty -Path $portRegPath -Name "RunUser" -Value 0 -Type DWord
    
    # Delay: 300ms delay before starting capture script (allows print job to stabilize)
    Set-ItemProperty -Path $portRegPath -Name "Delay" -Value 300 -Type DWord
    
    # LogFileUse: 0 = no log file (we handle logging in capture script)
    Set-ItemProperty -Path $portRegPath -Name "LogFileUse" -Value 0 -Type DWord
    
    # PrintError: 0 = don't print error pages
    Set-ItemProperty -Path $portRegPath -Name "PrintError" -Value 0 -Type DWord
    
    Write-Host "[OK] Redmon port configured successfully" -ForegroundColor Green
    
    if ($Detailed) {
        Write-Host ""
        Write-Host "Port Configuration:" -ForegroundColor Gray
        Write-Host "  Command: $CaptureScriptPath" -ForegroundColor Gray
        Write-Host "  Arguments: --bar-id $BarId" -ForegroundColor Gray
        Write-Host "  Output: stdin" -ForegroundColor Gray
        Write-Host "  ShowWindow: Hidden" -ForegroundColor Gray
        Write-Host "  RunUser: LocalService" -ForegroundColor Gray
        Write-Host "  Delay: 300ms" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "[ERROR] Failed to configure Redmon port: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Yellow
    
    # Rollback: Remove the port we just created
    Write-Host ""
    Write-Host "Rolling back port creation..." -ForegroundColor Yellow
    try {
        Remove-PrinterPort -Name $PortName -ErrorAction SilentlyContinue
        Write-Host "[OK] Port removed" -ForegroundColor Green
    } catch {
        Write-Host "[WARNING] Could not remove port (non-fatal)" -ForegroundColor Yellow
    }
    
    exit 1
}

# ===============================================================================
# PRINTER CREATION
# ===============================================================================

Write-Host ""
Write-Host "Creating printer..." -ForegroundColor Cyan

# Check if printer already exists
$existingPrinter = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue

if ($existingPrinter) {
    Write-Host "[WARNING] Printer '$PrinterName' already exists" -ForegroundColor Yellow
    Write-Host "   Removing existing printer..." -ForegroundColor Cyan
    
    try {
        Remove-Printer -Name $PrinterName -ErrorAction Stop
        Write-Host "[OK] Existing printer removed" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to remove existing printer: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "The printer may have pending print jobs." -ForegroundColor Yellow
        Write-Host "Please clear the print queue and try again." -ForegroundColor Yellow
        
        # Rollback: Remove the port
        Write-Host ""
        Write-Host "Rolling back port creation..." -ForegroundColor Yellow
        try {
            Remove-PrinterPort -Name $PortName -ErrorAction SilentlyContinue
            Write-Host "[OK] Port removed" -ForegroundColor Green
        } catch {
            Write-Host "[WARNING] Could not remove port (non-fatal)" -ForegroundColor Yellow
        }
        
        exit 1
    }
}

# Create the printer
Write-Host "Adding printer '$PrinterName'..." -ForegroundColor Cyan

try {
    Add-Printer `
        -Name $PrinterName `
        -DriverName $DriverName `
        -PortName $PortName `
        -ErrorAction Stop
    
    Write-Host "[OK] Printer created successfully" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to create printer: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Yellow
    
    # Rollback: Remove the port
    Write-Host ""
    Write-Host "Rolling back port creation..." -ForegroundColor Yellow
    try {
        Remove-PrinterPort -Name $PortName -ErrorAction SilentlyContinue
        Write-Host "[OK] Port removed" -ForegroundColor Green
    } catch {
        Write-Host "[WARNING] Could not remove port (non-fatal)" -ForegroundColor Yellow
    }
    
    exit 1
}

# Configure printer settings
Write-Host "Configuring printer settings..." -ForegroundColor Cyan

try {
    # Set printer as not shared (local only)
    Set-Printer -Name $PrinterName -Shared $false -ErrorAction Stop
    
    # Set printer comment
    Set-Printer -Name $PrinterName -Comment "Tabeza Connect Receipt Capture Printer" -ErrorAction Stop
    
    Write-Host "[OK] Printer settings configured" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] Could not configure printer settings (non-fatal): $_" -ForegroundColor Yellow
}

# ===============================================================================
# VERIFICATION
# ===============================================================================

Write-Host ""
Write-Host "Verifying printer configuration..." -ForegroundColor Cyan

try {
    # Verify printer exists
    $printer = Get-Printer -Name $PrinterName -ErrorAction Stop
    
    if ($printer.PortName -eq $PortName) {
        Write-Host "[OK] Printer is using correct port: $PortName" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Printer port mismatch: expected $PortName, got $($printer.PortName)" -ForegroundColor Yellow
    }
    
    if ($printer.DriverName -eq $DriverName) {
        Write-Host "[OK] Printer is using correct driver: $DriverName" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Printer driver mismatch: expected $DriverName, got $($printer.DriverName)" -ForegroundColor Yellow
    }
    
    # Verify port configuration
    $portConfig = Get-ItemProperty -Path $portRegPath -ErrorAction Stop
    
    if ($portConfig.Command -eq $CaptureScriptPath) {
        Write-Host "[OK] Port is configured to run capture script" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Port command mismatch: expected $CaptureScriptPath, got $($portConfig.Command)" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "[WARNING] Verification check failed: $_" -ForegroundColor Yellow
    Write-Host "   Printer may still work, but configuration should be reviewed." -ForegroundColor Yellow
}

# ===============================================================================
# RESTART PRINT SPOOLER
# ===============================================================================

Write-Host ""
Write-Host "Restarting Print Spooler to apply changes..." -ForegroundColor Cyan

try {
    Restart-Service -Name "Spooler" -Force -ErrorAction Stop
    
    # Wait for service to start
    $timeout = 10
    $elapsed = 0
    while ((Get-Service -Name "Spooler").Status -ne 'Running' -and $elapsed -lt $timeout) {
        Start-Sleep -Seconds 1
        $elapsed++
    }
    
    if ((Get-Service -Name "Spooler").Status -eq 'Running') {
        Write-Host "[OK] Print Spooler restarted successfully" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Print Spooler did not start within $timeout seconds" -ForegroundColor Yellow
        Write-Host "   Please check the service status manually." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARNING] Could not restart Print Spooler (non-fatal): $_" -ForegroundColor Yellow
    Write-Host "   You may need to restart it manually for changes to take effect." -ForegroundColor Yellow
}

# ===============================================================================
# SUMMARY
# ===============================================================================

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "[SUCCESS] Printer configuration completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Printer Details:" -ForegroundColor White
Write-Host "  Name: $PrinterName" -ForegroundColor Gray
Write-Host "  Driver: $DriverName" -ForegroundColor Gray
Write-Host "  Port: $PortName (Redmon)" -ForegroundColor Gray
Write-Host "  Capture Script: $CaptureScriptPath" -ForegroundColor Gray
Write-Host "  Bar ID: $BarId" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Configure your POS to print to '$PrinterName'" -ForegroundColor White
Write-Host "  2. Print a test receipt to verify capture" -ForegroundColor White
Write-Host "  3. Check Management UI for captured receipts" -ForegroundColor White
Write-Host ""

exit 0
