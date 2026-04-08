# Uninstall Tabeza Pooling Printer Configuration
# This script removes the Tabeza Agent and associated ports
# while preserving capture file data for potential reinstallation

param(
    [switch]$PreserveCaptureData = $true,
    [switch]$Silent = $false
)

# Configuration
$LogFile = "C:\ProgramData\Tabeza\logs\uninstall-pooling.log"
$PrinterName = "Tabeza Agent"
$CapturePortName = "TabezaCapturePort"

# Ensure log directory exists
$LogDir = Split-Path -Path $LogFile -Parent
if (-not (Test-Path -Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# Logging function
function Write-Log {
    param(
        [string]$Message,
        [ValidateSet('INFO', 'WARN', 'ERROR')]
        [string]$Level = 'INFO'
    )
    
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogEntry = "[$Timestamp] [$Level] $Message"
    
    # Write to log file
    Add-Content -Path $LogFile -Value $LogEntry -ErrorAction SilentlyContinue
    
    # Write to console if not silent
    if (-not $Silent) {
        switch ($Level) {
            'ERROR' { Write-Host $LogEntry -ForegroundColor Red }
            'WARN'  { Write-Host $LogEntry -ForegroundColor Yellow }
            default { Write-Host $LogEntry -ForegroundColor Gray }
        }
    }
}

# Main uninstallation logic
try {
    Write-Log "Starting Tabeza Pooling Printer uninstallation" -Level INFO
    
    # Check if printer exists
    $printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
    
    if ($printer) {
        Write-Log "Found printer: $PrinterName" -Level INFO
        
        # Remove the printer
        try {
            Remove-Printer -Name $PrinterName -ErrorAction Stop
            Write-Log "Successfully removed printer: $PrinterName" -Level INFO
        }
        catch {
            Write-Log "Failed to remove printer: $_" -Level ERROR
            # Continue with port removal even if printer removal fails
        }
    }
    else {
        Write-Log "Printer '$PrinterName' not found (already removed or never created)" -Level INFO
    }
    
    # Check if capture port exists
    $capturePort = Get-PrinterPort -Name $CapturePortName -ErrorAction SilentlyContinue
    
    if ($capturePort) {
        Write-Log "Found capture port: $CapturePortName" -Level INFO
        
        # Remove the capture port
        try {
            Remove-PrinterPort -Name $CapturePortName -ErrorAction Stop
            Write-Log "Successfully removed capture port: $CapturePortName" -Level INFO
        }
        catch {
            Write-Log "Failed to remove capture port: $_" -Level ERROR
        }
    }
    else {
        Write-Log "Capture port '$CapturePortName' not found (already removed or never created)" -Level INFO
    }
    
    # Handle capture file data preservation
    if ($PreserveCaptureData) {
        Write-Log "Capture file data preservation enabled - files in C:\TabezaPrints will be kept" -Level INFO
    }
    else {
        Write-Log "Capture file data preservation disabled - files in C:\TabezaPrints may be removed by installer" -Level WARN
    }
    
    Write-Log "Tabeza Pooling Printer uninstallation completed successfully" -Level INFO
    exit 0
}
catch {
    Write-Log "Uninstallation failed with error: $_" -Level ERROR
    Write-Log "Stack trace: $($_.ScriptStackTrace)" -Level ERROR
    exit 1
}
