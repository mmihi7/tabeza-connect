#Requires -Version 5.1
#Requires -RunAsAdministrator

<#
.SYNOPSIS
    Automatically configures Tabeza POS Printer with pooling mode for print job capture.

.DESCRIPTION
    This script automates the creation and configuration of a "Tabeza POS Printer" that enables
    print job capture through Windows printer pooling. It detects an existing physical thermal
    printer, creates a virtual printer that mirrors it, configures dual ports (physical + file
    capture), and validates the setup.

.PARAMETER CaptureFilePath
    The file path where print jobs will be captured (e.g., "C:\TabezaPrints\order.prn").
    This is a required parameter.

.PARAMETER Silent
    Suppresses console output. Logging to file continues regardless.

.PARAMETER Force
    Forces reconfiguration even if the Tabeza POS Printer already exists.

.EXAMPLE
    .\configure-pooling-printer.ps1 -CaptureFilePath "C:\TabezaPrints\order.prn"
    
.EXAMPLE
    .\configure-pooling-printer.ps1 -CaptureFilePath "C:\TabezaPrints\order.prn" -Silent

.NOTES
    Exit Codes:
        0 - Success (printer configured)
        1 - Fatal error (configuration failed)
        2 - Already configured (idempotent, treated as success)
        3 - No thermal printer detected
        4 - Insufficient privileges
        5 - Print Spooler not running

    Requirements: Windows 10/11, PowerShell 5.1+, Administrator privileges

    Author: Tabeza Development Team
    Version: 1.0.0
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, HelpMessage = "Path to the capture file (e.g., C:\TabezaPrints\order.prn)")]
    [ValidateNotNullOrEmpty()]
    [string]$CaptureFilePath,
    
    [Parameter(Mandatory = $false)]
    [switch]$Silent,
    
    [Parameter(Mandatory = $false)]
    [switch]$Force
)

# Script-level variables
$script:LogFilePath = "C:\ProgramData\Tabeza\logs\configure-pooling.log"
$script:LogMaxSizeBytes = 10MB
$script:TabezaPrinterName = "Tabeza POS Printer"
$script:TabezaCapturePortName = "TabezaCapturePort"

#region Logging Infrastructure

<#
.SYNOPSIS
    Writes a log entry to both console and log file.

.DESCRIPTION
    Implements comprehensive logging with:
    - ISO 8601 timestamp formatting
    - Log levels (INFO, WARN, ERROR)
    - File and console output
    - Automatic log rotation at 10MB
    - Thread-safe file operations

.PARAMETER Message
    The message to log.

.PARAMETER Level
    The log level: INFO, WARN, or ERROR. Default is INFO.

.EXAMPLE
    Write-Log "Configuration started"
    Write-Log "Printer not found" -Level WARN
    Write-Log "Failed to create port" -Level ERROR
#>
function Write-Log {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true, Position = 0)]
        [string]$Message,
        
        [Parameter(Mandatory = $false, Position = 1)]
        [ValidateSet('INFO', 'WARN', 'ERROR')]
        [string]$Level = 'INFO'
    )
    
    try {
        # Generate ISO 8601 timestamp
        $timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffK"
        
        # Format log entry
        $logEntry = "[$timestamp][$Level] $Message"
        
        # Write to console (unless Silent mode)
        if (-not $Silent) {
            switch ($Level) {
                'ERROR' { Write-Host $logEntry -ForegroundColor Red }
                'WARN'  { Write-Host $logEntry -ForegroundColor Yellow }
                'INFO'  { Write-Host $logEntry -ForegroundColor Gray }
            }
        }
        
        # Ensure log directory exists
        $logDir = Split-Path -Path $script:LogFilePath -Parent
        if (-not (Test-Path -Path $logDir)) {
            New-Item -Path $logDir -ItemType Directory -Force | Out-Null
        }
        
        # Check log file size and rotate if necessary
        if (Test-Path -Path $script:LogFilePath) {
            $logFile = Get-Item -Path $script:LogFilePath
            if ($logFile.Length -ge $script:LogMaxSizeBytes) {
                # Rotate log: rename current log to .old, start fresh
                $oldLogPath = "$($script:LogFilePath).old"
                if (Test-Path -Path $oldLogPath) {
                    Remove-Item -Path $oldLogPath -Force
                }
                Move-Item -Path $script:LogFilePath -Destination $oldLogPath -Force
                Write-Verbose "Log file rotated (exceeded $($script:LogMaxSizeBytes / 1MB)MB)"
            }
        }
        
        # Append to log file (thread-safe)
        $logEntry | Out-File -FilePath $script:LogFilePath -Append -Encoding UTF8 -Force
        
    } catch {
        # Fallback: write to console if logging fails
        Write-Warning "Failed to write to log file: $_"
        Write-Host $logEntry
    }
}

#endregion

# Script entry point
Write-Log "========================================" -Level INFO
Write-Log "Tabeza POS Printer Configuration Script" -Level INFO
Write-Log "Version: 1.0.0" -Level INFO
Write-Log "========================================" -Level INFO
Write-Log "Parameters:" -Level INFO
Write-Log "  CaptureFilePath: $CaptureFilePath" -Level INFO
Write-Log "  Silent: $Silent" -Level INFO
Write-Log "  Force: $Force" -Level INFO
Write-Log "========================================" -Level INFO
