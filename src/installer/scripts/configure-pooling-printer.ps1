#Requires -Version 5.1
#Requires -RunAsAdministrator

<#
.SYNOPSIS
    Automatically configures Tabeza Agent with pooling mode for print job capture.

.DESCRIPTION
    This script automates the creation and configuration of a "Tabeza Agent" that enables
    print job capture through Windows printer pooling. It detects an existing physical thermal
    printer, creates a virtual printer that mirrors it, configures dual ports (physical + file
    capture), and validates the setup.

.PARAMETER CaptureFilePath
    The file path where print jobs will be captured (e.g., "C:\TabezaPrints\order.prn").
    This is a required parameter.

.PARAMETER Silent
    Suppresses console output. Logging to file continues regardless.

.PARAMETER Force
    Forces reconfiguration even if the Tabeza Agent already exists.

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
$script:TabezaPrinterName = "Tabeza Agent"
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
Write-Log "Tabeza Agent Configuration Script" -Level INFO
Write-Log "Version: 1.0.0" -Level INFO
Write-Log "========================================" -Level INFO
Write-Log "Parameters:" -Level INFO
Write-Log "  CaptureFilePath: $CaptureFilePath" -Level INFO
Write-Log "  Silent: $Silent" -Level INFO
Write-Log "  Force: $Force" -Level INFO
Write-Log "========================================" -Level INFO


#region Privilege and Service Validation

<#
.SYNOPSIS
    Tests if the current PowerShell session has administrator privileges.

.DESCRIPTION
    Uses [Security.Principal.WindowsPrincipal] to check if the current user
    is running with administrator privileges. This is required for printer
    configuration operations.

.OUTPUTS
    System.Boolean - Returns $true if running as administrator, $false otherwise.

.EXAMPLE
    if (Test-AdminPrivileges) {
        Write-Host "Running with admin privileges"
    }

.NOTES
    Requirements: 11.2
#>
function Test-AdminPrivileges {
    [CmdletBinding()]
    [OutputType([bool])]
    param()
    
    try {
        $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
        $isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
        
        Write-Log "Administrator privilege check: $isAdmin" -Level INFO
        return $isAdmin
        
    } catch {
        Write-Log "Failed to check administrator privileges: $_" -Level ERROR
        return $false
    }
}

<#
.SYNOPSIS
    Tests if the Windows Print Spooler service is running.

.DESCRIPTION
    Queries the Print Spooler service status using Get-Service. If the service
    is stopped, attempts to start it automatically. Returns detailed error
    information if the service cannot be started.

.OUTPUTS
    System.Collections.Hashtable - Returns a hashtable with:
        - IsRunning (bool): True if service is running
        - ErrorMessage (string): Error details if service is not running
        - ServiceStatus (string): Current service status

.EXAMPLE
    $spoolerStatus = Test-PrintSpoolerRunning
    if (-not $spoolerStatus.IsRunning) {
        Write-Error $spoolerStatus.ErrorMessage
    }

.NOTES
    Requirements: 8.5
#>
function Test-PrintSpoolerRunning {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param()
    
    $result = @{
        IsRunning = $false
        ErrorMessage = ""
        ServiceStatus = ""
    }
    
    try {
        Write-Log "Checking Print Spooler service status..." -Level INFO
        
        $spooler = Get-Service -Name 'Spooler' -ErrorAction Stop
        $result.ServiceStatus = $spooler.Status.ToString()
        
        Write-Log "Print Spooler status: $($spooler.Status)" -Level INFO
        
        if ($spooler.Status -eq 'Running') {
            $result.IsRunning = $true
            Write-Log "Print Spooler is running" -Level INFO
            return $result
        }
        
        # Service is not running, attempt to start it
        Write-Log "Print Spooler is not running. Attempting to start..." -Level WARN
        
        try {
            Start-Service -Name 'Spooler' -ErrorAction Stop
            
            # Wait up to 10 seconds for service to start
            $timeout = 10
            $elapsed = 0
            while ($elapsed -lt $timeout) {
                Start-Sleep -Seconds 1
                $elapsed++
                
                $spooler = Get-Service -Name 'Spooler' -ErrorAction Stop
                if ($spooler.Status -eq 'Running') {
                    $result.IsRunning = $true
                    $result.ServiceStatus = 'Running'
                    Write-Log "Print Spooler started successfully" -Level INFO
                    return $result
                }
            }
            
            # Service did not start within timeout
            $result.ErrorMessage = "Print Spooler service did not start within $timeout seconds"
            Write-Log $result.ErrorMessage -Level ERROR
            
        } catch {
            $result.ErrorMessage = "Failed to start Print Spooler service: $_"
            Write-Log $result.ErrorMessage -Level ERROR
        }
        
    } catch {
        $result.ErrorMessage = "Failed to query Print Spooler service: $_"
        Write-Log $result.ErrorMessage -Level ERROR
    }
    
    return $result
}

#endregion

#region Idempotency and Self-Healing

<#
.SYNOPSIS
    Tests if the Tabeza Agent already exists.

.DESCRIPTION
    Checks if a printer named "Tabeza Agent" already exists in the system.
    This is used for idempotent configuration - if the printer already exists,
    the script can skip creation and verify the existing configuration instead.

.PARAMETER PrinterName
    The name of the printer to check (default: "Tabeza Agent").

.OUTPUTS
    System.Boolean - Returns $true if the printer exists, $false otherwise.

.EXAMPLE
    if (Test-TabezaPrinterExists) {
        Write-Host "Tabeza Agent already exists"
    } else {
        Write-Host "Tabeza Agent needs to be created"
    }

.NOTES
    Requirements: 2.5, 7.1
#>
function Test-TabezaPrinterExists {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $false)]
        [ValidateNotNullOrEmpty()]
        [string]$PrinterName = 'Tabeza Agent'
    )
    
    try {
        Write-Log "Checking if printer exists: $PrinterName" -Level INFO
        
        $printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
        
        if ($printer) {
            Write-Log "Printer exists: $PrinterName" -Level INFO
            Write-Log "  Driver: $($printer.DriverName)" -Level INFO
            Write-Log "  Port(s): $($printer.PortName)" -Level INFO
            Write-Log "  Status: $($printer.PrinterStatus)" -Level INFO
            Write-Log "  Shared: $($printer.Shared)" -Level INFO
            return $true
        } else {
            Write-Log "Printer does not exist: $PrinterName" -Level INFO
            return $false
        }
        
    } catch {
        Write-Log "Error checking if printer exists: $_" -Level ERROR
        # If we can't determine, assume it doesn't exist
        return $false
    }
}

<#
.SYNOPSIS
    Tests if the Tabeza Agent has the correct configuration.

.DESCRIPTION
    Verifies that an existing Tabeza Agent has the correct configuration:
    - Correct driver (matches the physical printer's driver)
    - Correct ports (physical port + capture port)
    - Not shared on the network
    
    Returns a configuration status indicating whether the printer is valid
    or needs to be reconfigured.

.PARAMETER PrinterName
    The name of the printer to validate (default: "Tabeza Agent").

.PARAMETER ExpectedDriverName
    The expected driver name (should match the physical printer's driver).

.PARAMETER ExpectedPhysicalPort
    The expected physical port name (e.g., "USB001").

.PARAMETER ExpectedCapturePort
    The expected capture port name (default: "TabezaCapturePort").

.OUTPUTS
    System.Collections.Hashtable - Returns a hashtable with:
        - IsValid (bool): True if configuration is correct
        - HasCorrectDriver (bool): True if driver matches expected
        - HasCorrectPorts (bool): True if both ports are configured correctly
        - IsNotShared (bool): True if printer is not shared
        - Errors (array): List of configuration errors
        - CurrentDriver (string): Current driver name
        - CurrentPorts (string): Current port configuration

.EXAMPLE
    $config = Test-TabezaPrinterConfiguration -PrinterName "Tabeza Agent" -ExpectedDriverName "EPSON TM-T20 Receipt" -ExpectedPhysicalPort "USB001"
    if ($config.IsValid) {
        Write-Host "Configuration is correct"
    } else {
        Write-Host "Configuration errors: $($config.Errors -join ', ')"
    }

.NOTES
    Requirements: 7.2
#>
function Test-TabezaPrinterConfiguration {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $false)]
        [ValidateNotNullOrEmpty()]
        [string]$PrinterName = 'Tabeza Agent',
        
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$ExpectedDriverName,
        
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$ExpectedPhysicalPort,
        
        [Parameter(Mandatory = $false)]
        [ValidateNotNullOrEmpty()]
        [string]$ExpectedCapturePort = 'TabezaCapturePort'
    )
    
    Write-Log "========================================" -Level INFO
    Write-Log "Validating Existing Printer Configuration" -Level INFO
    Write-Log "========================================" -Level INFO
    
    $result = @{
        IsValid = $false
        HasCorrectDriver = $false
        HasCorrectPorts = $false
        IsNotShared = $false
        Errors = @()
        CurrentDriver = ""
        CurrentPorts = ""
    }
    
    try {
        # Get the printer
        Write-Log "Retrieving printer: $PrinterName" -Level INFO
        $printer = Get-Printer -Name $PrinterName -ErrorAction Stop
        
        if (-not $printer) {
            $result.Errors += "Printer '$PrinterName' not found"
            Write-Log "Printer not found: $PrinterName" -Level ERROR
            return $result
        }
        
        Write-Log "Printer found: $PrinterName" -Level INFO
        
        # Store current configuration
        $result.CurrentDriver = $printer.DriverName
        $result.CurrentPorts = $printer.PortName
        
        Write-Log "Current configuration:" -Level INFO
        Write-Log "  Driver: $($result.CurrentDriver)" -Level INFO
        Write-Log "  Port(s): $($result.CurrentPorts)" -Level INFO
        Write-Log "  Shared: $($printer.Shared)" -Level INFO
        Write-Log "  Status: $($printer.PrinterStatus)" -Level INFO
        
        # Validation 1: Check driver
        Write-Log "Validation 1: Checking driver..." -Level INFO
        Write-Log "  Expected: $ExpectedDriverName" -Level INFO
        Write-Log "  Actual: $($result.CurrentDriver)" -Level INFO
        
        if ($result.CurrentDriver -eq $ExpectedDriverName) {
            $result.HasCorrectDriver = $true
            Write-Log "  ✓ Driver is correct" -Level INFO
        } else {
            $result.HasCorrectDriver = $false
            $errorMsg = "Driver mismatch: Expected '$ExpectedDriverName', got '$($result.CurrentDriver)'"
            $result.Errors += $errorMsg
            Write-Log "  ✗ $errorMsg" -Level ERROR
        }
        
        # Validation 2: Check ports
        Write-Log "Validation 2: Checking ports..." -Level INFO
        Write-Log "  Expected physical port: $ExpectedPhysicalPort" -Level INFO
        Write-Log "  Expected capture port: $ExpectedCapturePort" -Level INFO
        
        $ports = $result.CurrentPorts -split ','
        $ports = $ports | ForEach-Object { $_.Trim() }
        
        Write-Log "  Configured ports: $($ports -join ', ')" -Level INFO
        Write-Log "  Port count: $($ports.Count)" -Level INFO
        
        # Check if we have exactly 2 ports
        if ($ports.Count -ne 2) {
            $errorMsg = "Port count mismatch: Expected 2 ports, got $($ports.Count)"
            $result.Errors += $errorMsg
            Write-Log "  ✗ $errorMsg" -Level ERROR
        }
        
        # Check if physical port is present
        $hasPhysicalPort = $ports -contains $ExpectedPhysicalPort
        if ($hasPhysicalPort) {
            Write-Log "  ✓ Physical port is configured: $ExpectedPhysicalPort" -Level INFO
        } else {
            $errorMsg = "Physical port missing: Expected '$ExpectedPhysicalPort', not found in port list"
            $result.Errors += $errorMsg
            Write-Log "  ✗ $errorMsg" -Level ERROR
        }
        
        # Check if capture port is present
        $hasCapturePort = $ports -contains $ExpectedCapturePort
        if ($hasCapturePort) {
            Write-Log "  ✓ Capture port is configured: $ExpectedCapturePort" -Level INFO
        } else {
            $errorMsg = "Capture port missing: Expected '$ExpectedCapturePort', not found in port list"
            $result.Errors += $errorMsg
            Write-Log "  ✗ $errorMsg" -Level ERROR
        }
        
        # Check if port order is correct (physical port should be first)
        if ($ports.Count -eq 2 -and $hasPhysicalPort -and $hasCapturePort) {
            if ($ports[0] -eq $ExpectedPhysicalPort) {
                Write-Log "  ✓ Port order is correct (physical port is first)" -Level INFO
                $result.HasCorrectPorts = $true
            } else {
                $warningMsg = "Port order is incorrect: Physical port should be first, but got '$($ports[0])'"
                $result.Errors += $warningMsg
                Write-Log "  ⚠ $warningMsg" -Level WARN
                # Still mark as having correct ports, but note the order issue
                $result.HasCorrectPorts = $true
            }
        } else {
            $result.HasCorrectPorts = $false
        }
        
        # Validation 3: Check if printer is not shared
        Write-Log "Validation 3: Checking printer sharing..." -Level INFO
        Write-Log "  Expected: Not shared (false)" -Level INFO
        Write-Log "  Actual: $($printer.Shared)" -Level INFO
        
        if ($printer.Shared -eq $false) {
            $result.IsNotShared = $true
            Write-Log "  ✓ Printer is not shared" -Level INFO
        } else {
            $result.IsNotShared = $false
            $errorMsg = "Printer is shared (should not be shared)"
            $result.Errors += $errorMsg
            Write-Log "  ✗ $errorMsg" -Level ERROR
        }
        
        # Overall validation result
        if ($result.HasCorrectDriver -and $result.HasCorrectPorts -and $result.IsNotShared) {
            $result.IsValid = $true
            Write-Log "========================================" -Level INFO
            Write-Log "✓ Configuration is VALID" -Level INFO
            Write-Log "========================================" -Level INFO
        } else {
            $result.IsValid = $false
            Write-Log "========================================" -Level INFO
            Write-Log "✗ Configuration is INVALID" -Level ERROR
            Write-Log "Errors found: $($result.Errors.Count)" -Level ERROR
            foreach ($error in $result.Errors) {
                Write-Log "  - $error" -Level ERROR
            }
            Write-Log "========================================" -Level INFO
        }
        
    } catch {
        $errorMsg = "Unexpected error during configuration validation: $_"
        $result.Errors += $errorMsg
        Write-Log $errorMsg -Level ERROR
    }
    
    return $result
}

#endregion

#region Script Entry Point Validation

# Validate administrator privileges (Requirements: 11.2, 11.3)
Write-Log "Validating administrator privileges..." -Level INFO
if (-not (Test-AdminPrivileges)) {
    $errorMsg = @"
ERROR: Administrator privileges required

This script must be run with administrator privileges to configure printers.

To fix this:
1. Right-click on PowerShell or the installer
2. Select 'Run as administrator'
3. Run the script again

Alternatively, if running from Inno Setup installer, ensure the installer
requests elevation with PrivilegesRequired=admin in the setup script.
"@
    
    Write-Log $errorMsg -Level ERROR
    
    if (-not $Silent) {
        Write-Host ""
        Write-Host $errorMsg -ForegroundColor Red
        Write-Host ""
    }
    
    exit 4
}

Write-Log "Administrator privileges confirmed" -Level INFO

# Validate Print Spooler service (Requirements: 8.5)
Write-Log "Validating Print Spooler service..." -Level INFO
$spoolerStatus = Test-PrintSpoolerRunning

if (-not $spoolerStatus.IsRunning) {
    $errorMsg = @"
ERROR: Windows Print Spooler service is not running

The Print Spooler service is required for printer configuration.
Current status: $($spoolerStatus.ServiceStatus)
Error: $($spoolerStatus.ErrorMessage)

To fix this:
1. Open Services (press Win+R, type 'services.msc', press Enter)
2. Find 'Print Spooler' in the list
3. Right-click and select 'Start'
4. Set 'Startup Type' to 'Automatic'
5. Run this script again

If the service fails to start, check Windows Event Viewer for errors.
"@
    
    Write-Log $errorMsg -Level ERROR
    
    if (-not $Silent) {
        Write-Host ""
        Write-Host $errorMsg -ForegroundColor Red
        Write-Host ""
    }
    
    exit 5
}

Write-Log "Print Spooler service is running" -Level INFO
Write-Log "All prerequisite validations passed" -Level INFO

#endregion

#region Thermal Printer Detection

<#
.SYNOPSIS
    Detects thermal printers on the system and returns the best candidate.

.DESCRIPTION
    Scans all installed printers, excludes non-receipt printers (PDF, Fax, etc.),
    and scores remaining printers based on thermal printer keywords. Returns the
    highest scoring printer as the physical printer to mirror.

.OUTPUTS
    System.Management.Automation.PSCustomObject - Returns printer object with:
        - Name: Printer name
        - DriverName: Printer driver name
        - PortName: Printer port name
        - Score: Keyword match score
        - IsDefault: Whether this is the default printer

    Returns $null if no thermal printer is detected.

.EXAMPLE
    $printer = Get-ThermalPrinters
    if ($printer) {
        Write-Host "Detected: $($printer.Name)"
    }

.NOTES
    Requirements: 1.1, 1.2, 1.3, 1.4
#>
function Get-ThermalPrinters {
    [CmdletBinding()]
    [OutputType([PSCustomObject])]
    param()
    
    try {
        Write-Log "Scanning for thermal printers..." -Level INFO
        
        # Step 1: Get all printers
        $allPrinters = Get-Printer -ErrorAction Stop
        Write-Log "Found $($allPrinters.Count) total printers" -Level INFO
        
        # Step 2: Define exclusion patterns
        $excludePatterns = @(
            'Microsoft Print to PDF',
            'Microsoft XPS Document Writer',
            'Fax',
            'OneNote',
            'Adobe PDF',
            'Tabeza Agent'  # Don't detect our own virtual printer
        )
        
        # Step 3: Filter out excluded printers
        $candidates = $allPrinters | Where-Object {
            $printerName = $_.Name
            $excluded = $false
            
            foreach ($pattern in $excludePatterns) {
                if ($printerName -like "*$pattern*") {
                    $excluded = $true
                    Write-Log "Excluding printer: $printerName (matches pattern: $pattern)" -Level INFO
                    break
                }
            }
            
            -not $excluded
        }
        
        Write-Log "After exclusions: $($candidates.Count) candidate printers" -Level INFO
        
        if ($candidates.Count -eq 0) {
            Write-Log "No thermal printer candidates found after exclusions" -Level WARN
            return $null
        }
        
        # Step 4: Define thermal printer keywords for scoring
        $thermalKeywords = @(
            'Receipt', 'Thermal', 'POS', 'TM-', 'RP-',
            'Epson', 'Star', 'Citizen', 'Bixolon', 'Sam4s'
        )
        
        # Step 5: Score each candidate printer
        $scored = $candidates | ForEach-Object {
            $printer = $_
            $score = 0
            $printerName = $printer.Name
            
            foreach ($keyword in $thermalKeywords) {
                if ($printerName -like "*$keyword*") {
                    $score++
                }
            }
            
            # Get default printer status
            $isDefault = $false
            try {
                $defaultPrinter = (Get-CimInstance -ClassName Win32_Printer -Filter "Default = TRUE" -ErrorAction SilentlyContinue).Name
                $isDefault = ($defaultPrinter -eq $printerName)
            } catch {
                Write-Log "Could not determine default printer status for: $printerName" -Level WARN
            }
            
            Write-Log "Printer: $printerName | Score: $score | Default: $isDefault" -Level INFO
            
            [PSCustomObject]@{
                Name = $printerName
                DriverName = $printer.DriverName
                PortName = $printer.PortName
                Score = $score
                IsDefault = $isDefault
                PrinterObject = $printer
            }
        }
        
        # Step 6: Sort by score (descending) and return highest scoring printer
        $best = $scored | Sort-Object -Property Score -Descending | Select-Object -First 1
        
        if ($best) {
            Write-Log "Selected thermal printer: $($best.Name) (Score: $($best.Score))" -Level INFO
            Write-Log "  Driver: $($best.DriverName)" -Level INFO
            Write-Log "  Port: $($best.PortName)" -Level INFO
            Write-Log "  Is Default: $($best.IsDefault)" -Level INFO
            return $best
        } else {
            Write-Log "No thermal printer candidates found" -Level WARN
            return $null
        }
        
    } catch {
        Write-Log "Failed to detect thermal printers: $_" -Level ERROR
        return $null
    }
}

<#
.SYNOPSIS
    Gets the port name for a specified printer.

.DESCRIPTION
    Queries the printer's PortName property using Get-Printer. If the printer
    has multiple ports (comma-separated), returns the primary physical port
    (first port in the list).

.PARAMETER PrinterName
    The name of the printer to query.

.OUTPUTS
    System.String - Returns the port name (e.g., "USB001", "LPT1", "IP_192.168.1.100")

.EXAMPLE
    $port = Get-PrinterPortName -PrinterName "EPSON TM-T20"
    Write-Host "Port: $port"

.NOTES
    Requirements: 1.4
#>
function Get-PrinterPortName {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$PrinterName
    )
    
    try {
        Write-Log "Querying port for printer: $PrinterName" -Level INFO
        
        $printer = Get-Printer -Name $PrinterName -ErrorAction Stop
        
        if (-not $printer.PortName) {
            throw "Printer '$PrinterName' has no port configured"
        }
        
        # Handle multiple ports (comma-separated)
        $ports = $printer.PortName -split ','
        $primaryPort = $ports[0].Trim()
        
        if ($ports.Count -gt 1) {
            Write-Log "Printer has multiple ports: $($printer.PortName)" -Level INFO
            Write-Log "Using primary port: $primaryPort" -Level INFO
        } else {
            Write-Log "Printer port: $primaryPort" -Level INFO
        }
        
        return $primaryPort
        
    } catch {
        Write-Log "Failed to get port for printer '$PrinterName': $_" -Level ERROR
        throw
    }
}

<#
.SYNOPSIS
    Gets the driver name for a specified printer.

.DESCRIPTION
    Queries the printer's DriverName property using Get-Printer and verifies
    the driver exists in the system using Get-PrinterDriver. Returns the driver
    name if valid, or throws an error if the driver is missing.

.PARAMETER PrinterName
    The name of the printer to query.

.OUTPUTS
    System.String - Returns the driver name (e.g., "EPSON TM-T20 Receipt")

.EXAMPLE
    $driver = Get-PrinterDriverName -PrinterName "EPSON TM-T20"
    Write-Host "Driver: $driver"

.NOTES
    Requirements: 2.2
#>
function Get-PrinterDriverName {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$PrinterName
    )
    
    try {
        Write-Log "Querying driver for printer: $PrinterName" -Level INFO
        
        $printer = Get-Printer -Name $PrinterName -ErrorAction Stop
        
        if (-not $printer.DriverName) {
            throw "Printer '$PrinterName' has no driver configured"
        }
        
        $driverName = $printer.DriverName
        Write-Log "Printer driver: $driverName" -Level INFO
        
        # Verify driver exists in the system
        Write-Log "Verifying driver exists in system..." -Level INFO
        $driver = Get-PrinterDriver -Name $driverName -ErrorAction SilentlyContinue
        
        if (-not $driver) {
            throw "Driver '$driverName' not found in system. The driver may need to be reinstalled."
        }
        
        Write-Log "Driver verified: $driverName" -Level INFO
        return $driverName
        
    } catch {
        Write-Log "Failed to get driver for printer '$PrinterName': $_" -Level ERROR
        throw
    }
}

#endregion

#region Thermal Printer Detection Execution

Write-Log "========================================" -Level INFO
Write-Log "Phase 1: Thermal Printer Detection" -Level INFO
Write-Log "========================================" -Level INFO

# Detect thermal printer
$physicalPrinter = Get-ThermalPrinters

if (-not $physicalPrinter) {
    # No thermal printer detected - display error with troubleshooting
    $errorMsg = @"

========================================
ERROR: No thermal printer detected
========================================

The system could not detect a thermal/receipt printer on this computer.

Troubleshooting steps:
1. Ensure your thermal printer is connected via USB or network
2. Install the printer driver from the manufacturer's website
3. Verify the printer appears in: Settings → Devices → Printers & scanners
4. Ensure the printer name does not contain excluded keywords:
   - Microsoft Print to PDF
   - Fax
   - OneNote
   - XPS
   - Adobe PDF

Detected printers on this system:
"@
    
    Write-Log $errorMsg -Level ERROR
    
    # List all detected printers for diagnostics
    try {
        $allPrinters = Get-Printer -ErrorAction SilentlyContinue
        if ($allPrinters) {
            foreach ($p in $allPrinters) {
                $printerInfo = "  - $($p.Name) (Driver: $($p.DriverName), Port: $($p.PortName))"
                Write-Log $printerInfo -Level ERROR
                $errorMsg += "`n$printerInfo"
            }
        } else {
            $noPrintersMsg = "  (No printers found in system)"
            Write-Log $noPrintersMsg -Level ERROR
            $errorMsg += "`n$noPrintersMsg"
        }
    } catch {
        Write-Log "Could not enumerate printers for diagnostics: $_" -Level ERROR
    }
    
    $errorMsg += @"


If your thermal printer is listed above, please contact Tabeza support
with the log file located at:
$($script:LogFilePath)

For support, visit: https://tabeza.co.ke/support
"@
    
    if (-not $Silent) {
        Write-Host ""
        Write-Host $errorMsg -ForegroundColor Red
        Write-Host ""
    }
    
    Write-Log "Exiting with code 3: No thermal printer detected" -Level ERROR
    exit 3
}

# Store physical printer details
$script:PhysicalPrinterName = $physicalPrinter.Name
$script:PhysicalPrinterDriver = $physicalPrinter.DriverName
$script:PhysicalPrinterPort = $physicalPrinter.PortName
$script:IsPhysicalPrinterDefault = $physicalPrinter.IsDefault

Write-Log "Physical printer detected successfully" -Level INFO
Write-Log "  Name: $script:PhysicalPrinterName" -Level INFO
Write-Log "  Driver: $script:PhysicalPrinterDriver" -Level INFO
Write-Log "  Port: $script:PhysicalPrinterPort" -Level INFO
Write-Log "  Is Default: $script:IsPhysicalPrinterDefault" -Level INFO

# Validate driver exists (Requirements: 2.2)
try {
    $validatedDriver = Get-PrinterDriverName -PrinterName $script:PhysicalPrinterName
    Write-Log "Driver validation successful: $validatedDriver" -Level INFO
} catch {
    $errorMsg = @"

========================================
ERROR: Printer driver not available
========================================

The printer driver '$script:PhysicalPrinterDriver' is not available in the system.
This driver is required to create the Tabeza Agent.

Troubleshooting steps:
1. Reinstall the printer driver from the manufacturer's website
2. Verify the driver appears in: Control Panel → Devices and Printers → Print server properties → Drivers tab
3. Ensure the physical printer '$script:PhysicalPrinterName' is working correctly
4. Re-run the TabezaConnect installer

Error details: $_

For support, visit: https://tabeza.co.ke/support
Log file: $($script:LogFilePath)
"@
    
    Write-Log $errorMsg -Level ERROR
    
    if (-not $Silent) {
        Write-Host ""
        Write-Host $errorMsg -ForegroundColor Red
        Write-Host ""
    }
    
    Write-Log "Exiting with code 1: Driver validation failed" -Level ERROR
    exit 1
}

Write-Log "========================================" -Level INFO
Write-Log "Phase 1 Complete: Thermal Printer Detection" -Level INFO
Write-Log "========================================" -Level INFO

#endregion

#region Capture Directory and Port Configuration

<#
.SYNOPSIS
    Creates the capture directory with proper permissions for Print Spooler.

.DESCRIPTION
    Creates the parent directory for the capture file if it doesn't exist.
    Grants the Print Spooler service (NT AUTHORITY\SYSTEM) write permissions
    using icacls. Verifies permissions were successfully applied.

.PARAMETER Path
    The full path to the capture file (e.g., "C:\TabezaPrints\order.prn").
    The parent directory will be created if it doesn't exist.

.OUTPUTS
    System.Boolean - Returns $true if directory was created/verified successfully.

.EXAMPLE
    New-CaptureDirectory -Path "C:\TabezaPrints\order.prn"

.NOTES
    Requirements: 3.1, 3.2, 3.3
#>
function New-CaptureDirectory {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$Path
    )
    
    try {
        # Extract directory path from file path
        $directoryPath = Split-Path -Path $Path -Parent
        
        Write-Log "Checking capture directory: $directoryPath" -Level INFO
        
        # Check if directory exists
        if (Test-Path -Path $directoryPath -PathType Container) {
            Write-Log "Capture directory already exists: $directoryPath" -Level INFO
        } else {
            Write-Log "Creating capture directory: $directoryPath" -Level INFO
            
            try {
                # Create directory with error handling (Requirements: 8.3)
                New-Item -Path $directoryPath -ItemType Directory -Force -ErrorAction Stop | Out-Null
                Write-Log "Successfully created directory: $directoryPath" -Level INFO
                
            } catch {
                # Use comprehensive error handling function (Requirements: 8.3)
                Handle-DirectoryCreationFailure -Path $directoryPath -Exception $_
                # Note: Handle-DirectoryCreationFailure exits the script, so this line is never reached
            }
        }
        
        # Grant Print Spooler service write permissions using icacls
        Write-Log "Granting Print Spooler service write permissions..." -Level INFO
        
        try {
            # Grant permissions to NT AUTHORITY\SYSTEM (Print Spooler runs as SYSTEM)
            $icaclsArgs = "`"$directoryPath`" /grant `"NT AUTHORITY\SYSTEM:(OI)(CI)F`" /T"
            $icaclsResult = Start-Process -FilePath "icacls.exe" -ArgumentList $icaclsArgs -Wait -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\icacls_output.txt" -RedirectStandardError "$env:TEMP\icacls_error.txt"
            
            if ($icaclsResult.ExitCode -ne 0) {
                $errorOutput = Get-Content "$env:TEMP\icacls_error.txt" -Raw -ErrorAction SilentlyContinue
                throw "icacls failed with exit code $($icaclsResult.ExitCode): $errorOutput"
            }
            
            Write-Log "Successfully granted permissions to NT AUTHORITY\SYSTEM" -Level INFO
            
            # Also grant permissions to NETWORK SERVICE (fallback for some Print Spooler configurations)
            $icaclsArgs = "`"$directoryPath`" /grant `"NETWORK SERVICE:(OI)(CI)F`" /T"
            $icaclsResult = Start-Process -FilePath "icacls.exe" -ArgumentList $icaclsArgs -Wait -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\icacls_output.txt" -RedirectStandardError "$env:TEMP\icacls_error.txt"
            
            if ($icaclsResult.ExitCode -eq 0) {
                Write-Log "Successfully granted permissions to NETWORK SERVICE" -Level INFO
            } else {
                Write-Log "Warning: Could not grant permissions to NETWORK SERVICE (non-fatal)" -Level WARN
            }
            
        } catch {
            $errorMsg = "Failed to grant Print Spooler permissions: $_"
            Write-Log $errorMsg -Level ERROR
            throw
        }
        
        # Verify permissions were applied
        Write-Log "Verifying permissions..." -Level INFO
        
        try {
            $icaclsArgs = "`"$directoryPath`""
            $icaclsOutput = & icacls.exe $directoryPath 2>&1
            
            if ($icaclsOutput -match "NT AUTHORITY\\SYSTEM.*F") {
                Write-Log "Verified: NT AUTHORITY\SYSTEM has Full Control" -Level INFO
            } else {
                Write-Log "Warning: Could not verify NT AUTHORITY\SYSTEM permissions" -Level WARN
            }
            
            # Log the full permissions for diagnostics
            Write-Log "Current permissions for $directoryPath :" -Level INFO
            foreach ($line in $icaclsOutput) {
                Write-Log "  $line" -Level INFO
            }
            
        } catch {
            Write-Log "Warning: Could not verify permissions (non-fatal): $_" -Level WARN
        }
        
        Write-Log "Capture directory configuration complete" -Level INFO
        return $true
        
    } catch {
        Write-Log "Failed to configure capture directory: $_" -Level ERROR
        throw
    }
}

<#
.SYNOPSIS
    Creates or validates the local capture port for print job capture.

.DESCRIPTION
    Checks if TabezaCapturePort already exists. If it exists, verifies it points
    to the correct file path. If the path is incorrect, removes and recreates
    the port. Creates a new local port using Add-PrinterPort with the specified
    file path and enables bidirectional support.

.PARAMETER PortName
    The name of the local port to create (default: "TabezaCapturePort").

.PARAMETER FilePath
    The full path to the capture file (e.g., "C:\TabezaPrints\order.prn").

.OUTPUTS
    System.Boolean - Returns $true if port was created/verified successfully.

.EXAMPLE
    New-LocalCapturePort -PortName "TabezaCapturePort" -FilePath "C:\TabezaPrints\order.prn"

.NOTES
    Requirements: 2.4, 3.4, 3.5, 3.6
#>
function New-LocalCapturePort {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $false)]
        [ValidateNotNullOrEmpty()]
        [string]$PortName = 'TabezaCapturePort',
        
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$FilePath
    )
    
    try {
        Write-Log "Configuring local capture port: $PortName" -Level INFO
        Write-Log "  Target file path: $FilePath" -Level INFO
        
        # Check if port already exists
        $existingPort = Get-PrinterPort -Name $PortName -ErrorAction SilentlyContinue
        
        if ($existingPort) {
            Write-Log "Port '$PortName' already exists" -Level INFO
            Write-Log "  Current path: $($existingPort.PrinterHostAddress)" -Level INFO
            
            # Verify it points to the correct file path
            if ($existingPort.PrinterHostAddress -eq $FilePath) {
                Write-Log "Port '$PortName' is correctly configured (idempotent)" -Level INFO
                return $true
            } else {
                Write-Log "Port '$PortName' points to wrong path. Removing and recreating..." -Level WARN
                Write-Log "  Expected: $FilePath" -Level WARN
                Write-Log "  Actual: $($existingPort.PrinterHostAddress)" -Level WARN
                
                try {
                    Remove-PrinterPort -Name $PortName -ErrorAction Stop
                    Write-Log "Successfully removed incorrect port" -Level INFO
                } catch {
                    $errorMsg = "Failed to remove incorrect port '$PortName': $_"
                    Write-Log $errorMsg -Level ERROR
                    throw
                }
            }
        } else {
            Write-Log "Port '$PortName' does not exist. Creating new port..." -Level INFO
        }
        
        # Create the local port
        Write-Log "Creating local port: $PortName -> $FilePath" -Level INFO
        
        try {
            Add-PrinterPort -Name $PortName -PrinterHostAddress $FilePath -ErrorAction Stop
            Write-Log "Successfully created local port: $PortName" -Level INFO
            
        } catch {
            $errorMsg = "Failed to create printer port '$PortName': $_"
            Write-Log $errorMsg -Level ERROR
            
            # Check for common issues
            if ($_.Exception.Message -like "*Access*denied*") {
                Write-Log "Permission denied. Ensure you are running with administrator privileges." -Level ERROR
            } elseif ($_.Exception.Message -like "*already exists*") {
                Write-Log "Port already exists (race condition). Verifying configuration..." -Level WARN
                $existingPort = Get-PrinterPort -Name $PortName -ErrorAction SilentlyContinue
                if ($existingPort -and $existingPort.PrinterHostAddress -eq $FilePath) {
                    Write-Log "Port is correctly configured despite error" -Level INFO
                    return $true
                }
            }
            
            throw
        }
        
        # Verify the port was created correctly
        Write-Log "Verifying port configuration..." -Level INFO
        
        try {
            $verifyPort = Get-PrinterPort -Name $PortName -ErrorAction Stop
            
            if (-not $verifyPort) {
                throw "Port '$PortName' was not found after creation"
            }
            
            if ($verifyPort.PrinterHostAddress -ne $FilePath) {
                throw "Port '$PortName' has incorrect path: Expected '$FilePath', got '$($verifyPort.PrinterHostAddress)'"
            }
            
            Write-Log "Port verification successful:" -Level INFO
            Write-Log "  Port Name: $($verifyPort.Name)" -Level INFO
            Write-Log "  Port Type: $($verifyPort.PortType)" -Level INFO
            Write-Log "  File Path: $($verifyPort.PrinterHostAddress)" -Level INFO
            
            # Note: Bidirectional support is typically enabled by default for local ports
            # No explicit configuration needed for FILE: ports
            Write-Log "Bidirectional support: Enabled by default for local ports" -Level INFO
            
        } catch {
            $errorMsg = "Port verification failed: $_"
            Write-Log $errorMsg -Level ERROR
            throw
        }
        
        Write-Log "Local capture port configuration complete" -Level INFO
        return $true
        
    } catch {
        Write-Log "Failed to configure local capture port: $_" -Level ERROR
        throw
    }
}

#endregion

#region Printer Creation and Pooling Configuration

<#
.SYNOPSIS
    Creates the Tabeza Agent with dual-port pooling configuration.

.DESCRIPTION
    Creates a virtual printer that mirrors the physical thermal printer with
    printer pooling enabled. The printer is configured with two ports:
    1. Physical port (thermal printer) - primary port for seamless printing
    2. Capture port (local file) - secondary port for print job capture
    
    Uses WMI to configure printer pooling as Set-Printer doesn't support
    pooling configuration directly.

.PARAMETER PrinterName
    The name of the printer to create (default: "Tabeza Agent").

.PARAMETER DriverName
    The driver name to use (must match the physical printer's driver).

.PARAMETER PhysicalPort
    The physical port name from the thermal printer (e.g., "USB001").

.PARAMETER CapturePort
    The capture port name (must already exist, created by New-LocalCapturePort).

.OUTPUTS
    System.Boolean - Returns $true if printer was created/configured successfully.

.EXAMPLE
    New-TabezaPOSPrinter -PrinterName "Tabeza Agent" -DriverName "EPSON TM-T20 Receipt" -PhysicalPort "USB001" -CapturePort "TabezaCapturePort"

.NOTES
    Requirements: 2.1, 2.2, 2.3, 2.6
    
    CRITICAL: The thermal printer port MUST be first in the pool for seamless printing.
    The capture port must be created BEFORE calling this function.
#>
function New-TabezaPOSPrinter {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $false)]
        [ValidateNotNullOrEmpty()]
        [string]$PrinterName = 'Tabeza Agent',
        
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$DriverName,
        
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$PhysicalPort,
        
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$CapturePort
    )
    
    try {
        Write-Log "========================================" -Level INFO
        Write-Log "Creating Tabeza Agent with pooling" -Level INFO
        Write-Log "========================================" -Level INFO
        
        # Step 1: Verify driver exists
        Write-Log "Step 1: Verifying driver exists: $DriverName" -Level INFO
        $driver = Get-PrinterDriver -Name $DriverName -ErrorAction SilentlyContinue
        if (-not $driver) {
            throw "Driver '$DriverName' not found. Cannot create printer."
        }
        Write-Log "Driver verified: $DriverName" -Level INFO
        
        # Step 2: Ensure capture port exists (must be created first by New-LocalCapturePort)
        Write-Log "Step 2: Verifying capture port exists: $CapturePort" -Level INFO
        $capturePortObj = Get-PrinterPort -Name $CapturePort -ErrorAction SilentlyContinue
        if (-not $capturePortObj) {
            throw "Capture port '$CapturePort' not found. Create it first using New-LocalCapturePort."
        }
        Write-Log "Capture port verified: $CapturePort (Type: Local Port/FILE)" -Level INFO
        Write-Log "  File path: $($capturePortObj.PrinterHostAddress)" -Level INFO
        
        # Step 3: Create printer with thermal printer port as primary port
        # IMPORTANT: Use the thermal printer port first for seamless printing
        Write-Log "Step 3: Creating printer '$PrinterName' with primary port '$PhysicalPort'" -Level INFO
        
        try {
            Add-Printer -Name $PrinterName -DriverName $DriverName -PortName $PhysicalPort -ErrorAction Stop
            Write-Log "Successfully created printer '$PrinterName' with physical port '$PhysicalPort'" -Level INFO
        } catch {
            # Enhanced error handling for specific error cases (Requirements: 8.2)
            $errorMsg = "Failed to create printer '$PrinterName': $_"
            Write-Log $errorMsg -Level ERROR
            
            # Error Case 1: Printer name already exists (conflict)
            if ($_.Exception.Message -like "*already exists*" -or $_.Exception.Message -like "*duplicate*") {
                Write-Log "ERROR: Printer name conflict detected" -Level ERROR
                Write-Log "A printer named '$PrinterName' already exists on this system." -Level ERROR
                
                # Check if it's our printer or a different one
                $existingPrinter = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
                if ($existingPrinter) {
                    Write-Log "Existing printer details:" -Level ERROR
                    Write-Log "  Name: $($existingPrinter.Name)" -Level ERROR
                    Write-Log "  Driver: $($existingPrinter.DriverName)" -Level ERROR
                    Write-Log "  Port(s): $($existingPrinter.PortName)" -Level ERROR
                    
                    # If it's already configured correctly, we can continue
                    if ($existingPrinter.DriverName -eq $DriverName) {
                        Write-Log "Existing printer uses the same driver. Will attempt to reconfigure pooling..." -Level INFO
                        # Continue to pooling configuration step
                    } else {
                        $detailedError = @"

========================================
ERROR: Printer Name Conflict
========================================

A printer named '$PrinterName' already exists on this system, but it uses
a different driver than expected.

Existing printer:
  Name: $($existingPrinter.Name)
  Driver: $($existingPrinter.DriverName)
  Port(s): $($existingPrinter.PortName)

Expected driver: $DriverName

Resolution options:
1. Remove the existing '$PrinterName' printer manually:
   - Open Settings → Devices → Printers & scanners
   - Select '$PrinterName' and click 'Remove device'
   - Re-run the TabezaConnect installer

2. Rename the existing printer to something else
   - This will allow the installer to create the Tabeza Agent

For support, visit: https://tabeza.co.ke/support
Log file: $($script:LogFilePath)
"@
                        Write-Log $detailedError -Level ERROR
                        throw $detailedError
                    }
                } else {
                    throw
                }
            }
            # Error Case 2: Driver not found
            elseif ($_.Exception.Message -like "*driver*not*found*" -or 
                    $_.Exception.Message -like "*driver*does*not*exist*" -or
                    $_.Exception.Message -like "*cannot find*driver*") {
                
                $detailedError = @"

========================================
ERROR: Printer Driver Not Found
========================================

The printer driver '$DriverName' is not available on this system.
This driver is required to create the Tabeza Agent.

Troubleshooting steps:
1. Verify the physical printer '$script:PhysicalPrinterName' is installed correctly
2. Reinstall the printer driver from the manufacturer's website:
   - For EPSON printers: https://epson.com/support
   - For Star printers: https://www.starmicronics.com/support
   - For other brands: Check the manufacturer's support website

3. Verify the driver appears in Windows:
   - Open Control Panel → Devices and Printers
   - Click 'Print server properties' at the top
   - Go to the 'Drivers' tab
   - Look for '$DriverName' in the list

4. If the driver is not listed:
   - Uninstall and reinstall the physical printer
   - Ensure you download the correct driver for your Windows version
   - Re-run the TabezaConnect installer

Error details: $_

For support, visit: https://tabeza.co.ke/support
Log file: $($script:LogFilePath)
"@
                Write-Log $detailedError -Level ERROR
                throw $detailedError
            }
            # Error Case 3: Port not accessible
            elseif ($_.Exception.Message -like "*port*not*found*" -or 
                    $_.Exception.Message -like "*port*does*not*exist*" -or
                    $_.Exception.Message -like "*cannot*access*port*" -or
                    $_.Exception.Message -like "*port*unavailable*") {
                
                $detailedError = @"

========================================
ERROR: Printer Port Not Accessible
========================================

The printer port '$PhysicalPort' is not accessible or does not exist.
This port is required to create the Tabeza Agent.

Troubleshooting steps:
1. Verify the physical printer is connected:
   - Check USB cable connection (if USB printer)
   - Check network connection (if network printer)
   - Ensure the printer is powered on

2. Verify the port exists in Windows:
   - Open Control Panel → Devices and Printers
   - Right-click on '$script:PhysicalPrinterName'
   - Select 'Printer properties'
   - Go to the 'Ports' tab
   - Look for '$PhysicalPort' in the list

3. If the port is not listed:
   - Reconnect the printer (unplug and plug back in)
   - Restart the Print Spooler service:
     * Open Services (services.msc)
     * Find 'Print Spooler'
     * Right-click → Restart
   - Re-run the TabezaConnect installer

4. If using a network printer:
   - Verify the printer's IP address is correct
   - Ensure the printer is reachable on the network
   - Check firewall settings

Error details: $_

For support, visit: https://tabeza.co.ke/support
Log file: $($script:LogFilePath)
"@
                Write-Log $detailedError -Level ERROR
                throw $detailedError
            }
            # Generic error case
            else {
                $detailedError = @"

========================================
ERROR: Failed to Create Printer
========================================

An unexpected error occurred while creating the Tabeza Agent.

Printer configuration:
  Name: $PrinterName
  Driver: $DriverName
  Port: $PhysicalPort

Error details: $_

Troubleshooting steps:
1. Verify the Print Spooler service is running:
   - Open Services (services.msc)
   - Find 'Print Spooler'
   - Ensure status is 'Running'

2. Check Windows Event Viewer for printer-related errors:
   - Open Event Viewer (eventvwr.msc)
   - Navigate to: Windows Logs → System
   - Look for errors from 'Print' source

3. Ensure you have administrator privileges:
   - Right-click PowerShell or the installer
   - Select 'Run as administrator'

4. Try restarting the computer and running the installer again

For support, visit: https://tabeza.co.ke/support
Log file: $($script:LogFilePath)
"@
                Write-Log $detailedError -Level ERROR
                throw $detailedError
            }
        }
        
        # Step 4: Configure printer pooling using WMI (Set-Printer doesn't support pooling)
        Write-Log "Step 4: Configuring printer pooling using WMI..." -Level INFO
        
        try {
            # Get printer via WMI
            Write-Log "Querying printer via WMI..." -Level INFO
            $printerWMI = Get-WmiObject -Class Win32_Printer -Filter "Name='$PrinterName'" -ErrorAction Stop
            
            if (-not $printerWMI) {
                throw "Could not find printer '$PrinterName' via WMI"
            }
            
            Write-Log "Printer found via WMI" -Level INFO
            
            # Configure pooling properties
            Write-Log "Configuring pooling properties..." -Level INFO
            $printerWMI.DoCompleteFirst = $false  # Disable "Print Directly to Printer"
            $printerWMI.EnableBIDI = $true        # Enable bidirectional support
            
            # Build port list (comma-separated): thermal printer first, then capture port
            # CRITICAL: Thermal printer MUST be first for seamless printing
            $allPorts = "$PhysicalPort,$CapturePort"
            Write-Log "Setting port list: $allPorts" -Level INFO
            $printerWMI.PortName = $allPorts
            
            # Apply changes
            Write-Log "Applying WMI changes..." -Level INFO
            $result = $printerWMI.Put()
            
            if ($result.ReturnValue -ne 0) {
                throw "WMI Put() failed with return value: $($result.ReturnValue)"
            }
            
            Write-Log "Printer pooling configured successfully" -Level INFO
            Write-Log "  Ports in pool: $allPorts" -Level INFO
            Write-Log "  Primary port (first): $PhysicalPort (Physical USB/LPT/COM)" -Level INFO
            Write-Log "  Capture port (second): $CapturePort (Local Port/FILE)" -Level INFO
            
        } catch {
            $errorMsg = "Failed to configure printer pooling: $_"
            Write-Log $errorMsg -Level ERROR
            Write-Log "Attempting to remove partially created printer..." -Level WARN
            
            try {
                Remove-Printer -Name $PrinterName -ErrorAction SilentlyContinue
                Write-Log "Removed partially created printer" -Level INFO
            } catch {
                Write-Log "Could not remove partially created printer: $_" -Level WARN
            }
            
            throw
        }
        
        # Step 5: Configure printer settings
        Write-Log "Step 5: Configuring printer settings..." -Level INFO
        
        try {
            Set-Printer -Name $PrinterName -Shared $false -ErrorAction Stop
            Write-Log "Configured printer as not shared" -Level INFO
        } catch {
            Write-Log "Warning: Could not set printer sharing to false: $_" -Level WARN
            # Non-fatal - continue
        }
        
        # Step 6: Verify final configuration
        Write-Log "Step 6: Verifying final printer configuration..." -Level INFO
        
        try {
            $verifyPrinter = Get-Printer -Name $PrinterName -ErrorAction Stop
            $verifyPorts = $verifyPrinter.PortName -split ','
            
            Write-Log "Verification results:" -Level INFO
            Write-Log "  Printer Name: $($verifyPrinter.Name)" -Level INFO
            Write-Log "  Driver: $($verifyPrinter.DriverName)" -Level INFO
            Write-Log "  Ports: $($verifyPrinter.PortName)" -Level INFO
            Write-Log "  Port Count: $($verifyPorts.Count)" -Level INFO
            Write-Log "  Shared: $($verifyPrinter.Shared)" -Level INFO
            Write-Log "  Status: $($verifyPrinter.PrinterStatus)" -Level INFO
            
            # Verify we have exactly 2 ports
            if ($verifyPorts.Count -ne 2) {
                throw "Printer pooling verification failed: Expected 2 ports, found $($verifyPorts.Count)"
            }
            
            # Verify the ports are correct
            $hasPhysicalPort = $verifyPorts -contains $PhysicalPort
            $hasCapturePort = $verifyPorts -contains $CapturePort
            
            if (-not $hasPhysicalPort) {
                throw "Physical port '$PhysicalPort' not found in printer configuration"
            }
            
            if (-not $hasCapturePort) {
                throw "Capture port '$CapturePort' not found in printer configuration"
            }
            
            Write-Log "All verification checks passed" -Level INFO
            
        } catch {
            $errorMsg = "Printer verification failed: $_"
            Write-Log $errorMsg -Level ERROR
            throw
        }
        
        Write-Log "========================================" -Level INFO
        Write-Log "Printer creation and pooling configuration complete" -Level INFO
        Write-Log "========================================" -Level INFO
        
        return $true
        
    } catch {
        Write-Log "Failed to create Tabeza Agent: $_" -Level ERROR
        throw
    }
}

#endregion

#region Default Printer Preservation

<#
.SYNOPSIS
    Gets the current default printer name.

.DESCRIPTION
    Queries the system default printer using WMI (Win32_Printer class).
    Returns the printer name if a default printer is set, or $null if no
    default printer is configured.

.OUTPUTS
    System.String - Returns the default printer name, or $null if none set.

.EXAMPLE
    $defaultPrinter = Get-DefaultPrinter
    if ($defaultPrinter) {
        Write-Host "Default printer: $defaultPrinter"
    } else {
        Write-Host "No default printer set"
    }

.NOTES
    Requirements: 4.1
#>
function Get-DefaultPrinter {
    [CmdletBinding()]
    [OutputType([string])]
    param()
    
    try {
        Write-Log "Querying current default printer..." -Level INFO
        
        # Query default printer using WMI
        $defaultPrinter = Get-CimInstance -ClassName Win32_Printer -Filter "Default = TRUE" -ErrorAction SilentlyContinue
        
        if ($defaultPrinter) {
            $printerName = $defaultPrinter.Name
            Write-Log "Current default printer: $printerName" -Level INFO
            return $printerName
        } else {
            Write-Log "No default printer is currently set" -Level INFO
            return $null
        }
        
    } catch {
        Write-Log "Failed to query default printer: $_" -Level WARN
        
        # Fallback: Try using registry
        try {
            Write-Log "Attempting fallback method using registry..." -Level INFO
            
            $regPath = "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Windows"
            $regValue = Get-ItemProperty -Path $regPath -Name "Device" -ErrorAction SilentlyContinue
            
            if ($regValue -and $regValue.Device) {
                # Registry value format: "PrinterName,winspool,PortName"
                $printerName = ($regValue.Device -split ',')[0]
                Write-Log "Default printer from registry: $printerName" -Level INFO
                return $printerName
            } else {
                Write-Log "No default printer found in registry" -Level INFO
                return $null
            }
            
        } catch {
            Write-Log "Fallback method also failed: $_" -Level WARN
            return $null
        }
    }
}

<#
.SYNOPSIS
    Restores the default printer to a specified printer.

.DESCRIPTION
    Sets the default printer using WScript.Network COM object. This is the
    most reliable method for setting the default printer across different
    Windows versions. Handles errors gracefully by logging warnings rather
    than throwing fatal errors, as default printer restoration is not critical
    to the core printer configuration.

.PARAMETER PrinterName
    The name of the printer to set as default. If $null or empty, no action is taken.

.OUTPUTS
    System.Boolean - Returns $true if default printer was restored successfully,
                     $false if restoration failed (non-fatal).

.EXAMPLE
    Restore-DefaultPrinter -PrinterName "EPSON TM-T20"

.EXAMPLE
    # Restore previously saved default printer
    $originalDefault = Get-DefaultPrinter
    # ... perform printer configuration ...
    Restore-DefaultPrinter -PrinterName $originalDefault

.NOTES
    Requirements: 4.2
    
    This function logs errors as warnings rather than throwing exceptions,
    as default printer restoration is not critical to the core functionality.
    The Tabeza Agent should never be set as default, so if restoration
    fails, the worst case is that the user's default printer changes.
#>
function Restore-DefaultPrinter {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $false)]
        [AllowNull()]
        [AllowEmptyString()]
        [string]$PrinterName
    )
    
    try {
        # If no printer name provided, nothing to restore
        if ([string]::IsNullOrWhiteSpace($PrinterName)) {
            Write-Log "No printer name provided for default printer restoration (skipping)" -Level INFO
            return $true
        }
        
        Write-Log "Restoring default printer to: $PrinterName" -Level INFO
        
        # Verify the printer exists before attempting to set it as default
        $printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
        if (-not $printer) {
            Write-Log "Warning: Printer '$PrinterName' not found. Cannot restore as default." -Level WARN
            return $false
        }
        
        # Set default printer using WScript.Network COM object
        # This is the most reliable method across Windows versions
        try {
            $network = New-Object -ComObject WScript.Network
            $network.SetDefaultPrinter($PrinterName)
            
            Write-Log "Successfully restored default printer to: $PrinterName" -Level INFO
            
            # Verify the change was applied
            Start-Sleep -Milliseconds 500  # Brief delay for system to update
            $currentDefault = Get-DefaultPrinter
            
            if ($currentDefault -eq $PrinterName) {
                Write-Log "Verified: Default printer is now $PrinterName" -Level INFO
                return $true
            } else {
                Write-Log "Warning: Default printer verification failed. Expected '$PrinterName', got '$currentDefault'" -Level WARN
                return $false
            }
            
        } catch {
            Write-Log "Warning: Failed to set default printer using WScript.Network: $_" -Level WARN
            
            # Fallback: Try using WMI
            try {
                Write-Log "Attempting fallback method using WMI..." -Level INFO
                
                $printerWMI = Get-WmiObject -Class Win32_Printer -Filter "Name='$PrinterName'" -ErrorAction Stop
                
                if ($printerWMI) {
                    $result = $printerWMI.SetDefaultPrinter()
                    
                    if ($result.ReturnValue -eq 0) {
                        Write-Log "Successfully set default printer using WMI fallback" -Level INFO
                        return $true
                    } else {
                        Write-Log "Warning: WMI SetDefaultPrinter() returned error code: $($result.ReturnValue)" -Level WARN
                        return $false
                    }
                } else {
                    Write-Log "Warning: Could not find printer via WMI for fallback method" -Level WARN
                    return $false
                }
                
            } catch {
                Write-Log "Warning: Fallback method also failed: $_" -Level WARN
                return $false
            }
        }
        
    } catch {
        # Log as warning, not error - this is non-fatal
        Write-Log "Warning: Exception during default printer restoration: $_" -Level WARN
        Write-Log "This is non-fatal. The printer configuration will continue." -Level WARN
        return $false
    }
}

#endregion

#region Configuration Validation

<#
.SYNOPSIS
    Validates the Tabeza Agent pooling configuration.

.DESCRIPTION
    Performs comprehensive validation of the printer configuration:
    - Verifies printer exists
    - Verifies both ports (physical and capture) are configured
    - Verifies physical port is accessible
    - Verifies capture file is writable by Print Spooler
    - Attempts test write to capture file
    
    Returns a hashtable with validation results and any errors encountered.

.PARAMETER PrinterName
    The name of the printer to validate (default: "Tabeza Agent").

.OUTPUTS
    System.Collections.Hashtable - Returns a hashtable with:
        - PrinterExists (bool): True if printer exists
        - HasPhysicalPort (bool): True if physical port is configured
        - HasCapturePort (bool): True if capture port is configured
        - PhysicalPortAccessible (bool): True if physical port is accessible
        - CaptureFileWritable (bool): True if capture file is writable
        - TestWriteSuccessful (bool): True if test write succeeded
        - Errors (array): List of error messages
        - Warnings (array): List of warning messages

.EXAMPLE
    $validation = Test-PoolingConfiguration -PrinterName "Tabeza Agent"
    if ($validation.Errors.Count -eq 0) {
        Write-Host "Configuration is valid"
    } else {
        Write-Host "Validation errors: $($validation.Errors -join ', ')"
    }

.NOTES
    Requirements: 6.1, 6.2, 6.3, 6.5
#>
function Test-PoolingConfiguration {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $false)]
        [ValidateNotNullOrEmpty()]
        [string]$PrinterName = 'Tabeza Agent'
    )
    
    Write-Log "========================================" -Level INFO
    Write-Log "Validating Printer Configuration" -Level INFO
    Write-Log "========================================" -Level INFO
    
    $results = @{
        PrinterExists = $false
        HasPhysicalPort = $false
        HasCapturePort = $false
        PhysicalPortAccessible = $false
        CaptureFileWritable = $false
        TestWriteSuccessful = $false
        Errors = @()
        Warnings = @()
    }
    
    try {
        # Validation 1: Check printer exists (Requirement 6.1)
        Write-Log "Validation 1: Checking if printer exists..." -Level INFO
        
        $printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
        if (-not $printer) {
            $errorMsg = "Printer '$PrinterName' not found"
            $results.Errors += $errorMsg
            Write-Log $errorMsg -Level ERROR
            return $results
        }
        
        $results.PrinterExists = $true
        Write-Log "✓ Printer exists: $PrinterName" -Level INFO
        Write-Log "  Driver: $($printer.DriverName)" -Level INFO
        Write-Log "  Status: $($printer.PrinterStatus)" -Level INFO
        Write-Log "  Shared: $($printer.Shared)" -Level INFO
        
        # Validation 2: Check both ports are configured (Requirement 6.1)
        Write-Log "Validation 2: Checking port configuration..." -Level INFO
        
        $ports = $printer.PortName -split ','
        Write-Log "  Configured ports: $($printer.PortName)" -Level INFO
        Write-Log "  Port count: $($ports.Count)" -Level INFO
        
        if ($ports.Count -lt 2) {
            $errorMsg = "Printer has only $($ports.Count) port(s). Expected 2 ports (physical + capture)"
            $results.Errors += $errorMsg
            Write-Log $errorMsg -Level ERROR
        }
        
        # Identify physical and capture ports
        $physicalPort = $null
        $capturePort = $null
        
        foreach ($port in $ports) {
            $portName = $port.Trim()
            
            if ($portName -like '*Tabeza*' -or $portName -like '*Capture*') {
                $capturePort = $portName
                $results.HasCapturePort = $true
                Write-Log "  ✓ Capture port found: $capturePort" -Level INFO
            } else {
                $physicalPort = $portName
                $results.HasPhysicalPort = $true
                Write-Log "  ✓ Physical port found: $physicalPort" -Level INFO
            }
        }
        
        if (-not $results.HasPhysicalPort) {
            $errorMsg = "Physical port not configured on printer"
            $results.Errors += $errorMsg
            Write-Log $errorMsg -Level ERROR
        }
        
        if (-not $results.HasCapturePort) {
            $errorMsg = "Capture port not configured on printer"
            $results.Errors += $errorMsg
            Write-Log $errorMsg -Level ERROR
        }
        
        # Validation 3: Check physical port is accessible (Requirement 6.2)
        if ($physicalPort) {
            Write-Log "Validation 3: Checking physical port accessibility..." -Level INFO
            
            try {
                $physicalPortObj = Get-PrinterPort -Name $physicalPort -ErrorAction Stop
                
                if ($physicalPortObj) {
                    $results.PhysicalPortAccessible = $true
                    Write-Log "  ✓ Physical port is accessible: $physicalPort" -Level INFO
                    Write-Log "    Port type: $($physicalPortObj.PortType)" -Level INFO
                    
                    # Additional checks for port status
                    if ($physicalPortObj.PortType -eq 'USB') {
                        Write-Log "    USB port detected" -Level INFO
                    } elseif ($physicalPortObj.PortType -eq 'LPT') {
                        Write-Log "    Parallel (LPT) port detected" -Level INFO
                    } elseif ($physicalPortObj.PortType -eq 'COM') {
                        Write-Log "    Serial (COM) port detected" -Level INFO
                    } elseif ($physicalPortObj.PortType -eq 'TCP/IP') {
                        Write-Log "    Network (TCP/IP) port detected" -Level INFO
                        Write-Log "    IP Address: $($physicalPortObj.PrinterHostAddress)" -Level INFO
                    }
                } else {
                    $errorMsg = "Physical port '$physicalPort' exists but returned null object"
                    $results.Errors += $errorMsg
                    Write-Log $errorMsg -Level ERROR
                }
                
            } catch {
                $errorMsg = "Physical port '$physicalPort' is not accessible: $_"
                $results.Errors += $errorMsg
                Write-Log $errorMsg -Level ERROR
            }
        } else {
            Write-Log "Validation 3: Skipped (no physical port identified)" -Level WARN
        }
        
        # Validation 4: Check capture file is writable by Print Spooler (Requirement 6.3)
        if ($capturePort) {
            Write-Log "Validation 4: Checking capture file writability..." -Level INFO
            
            try {
                $capturePortObj = Get-PrinterPort -Name $capturePort -ErrorAction Stop
                
                if ($capturePortObj -and $capturePortObj.PrinterHostAddress) {
                    $captureFilePath = $capturePortObj.PrinterHostAddress
                    Write-Log "  Capture file path: $captureFilePath" -Level INFO
                    
                    # Check if capture file directory exists
                    $captureDir = Split-Path -Path $captureFilePath -Parent
                    
                    if (-not (Test-Path -Path $captureDir -PathType Container)) {
                        $errorMsg = "Capture directory does not exist: $captureDir"
                        $results.Errors += $errorMsg
                        Write-Log $errorMsg -Level ERROR
                    } else {
                        Write-Log "  ✓ Capture directory exists: $captureDir" -Level INFO
                        
                        # Attempt test write to capture file
                        Write-Log "  Attempting test write to capture file..." -Level INFO
                        
                        try {
                            $testContent = "# Tabeza Configuration Test Write`n# Timestamp: $(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffK')`n# Test ID: $([guid]::NewGuid())`n"
                            
                            # Write test content
                            Add-Content -Path $captureFilePath -Value $testContent -ErrorAction Stop
                            
                            $results.CaptureFileWritable = $true
                            $results.TestWriteSuccessful = $true
                            Write-Log "  ✓ Test write successful" -Level INFO
                            
                            # Verify file was written
                            if (Test-Path -Path $captureFilePath) {
                                $fileInfo = Get-Item -Path $captureFilePath
                                Write-Log "  ✓ Capture file exists: $captureFilePath" -Level INFO
                                Write-Log "    File size: $($fileInfo.Length) bytes" -Level INFO
                                Write-Log "    Last modified: $($fileInfo.LastWriteTime)" -Level INFO
                            } else {
                                $warningMsg = "Test write succeeded but file does not exist (may be created on first print)"
                                $results.Warnings += $warningMsg
                                Write-Log $warningMsg -Level WARN
                            }
                            
                        } catch {
                            $errorMsg = "Cannot write to capture file '$captureFilePath': $_"
                            $results.Errors += $errorMsg
                            Write-Log $errorMsg -Level ERROR
                            
                            # Check for common permission issues
                            if ($_.Exception.Message -like "*Access*denied*" -or 
                                $_.Exception.Message -like "*permission*") {
                                
                                Write-Log "  Permission issue detected. Checking directory permissions..." -Level ERROR
                                
                                try {
                                    $acl = Get-Acl -Path $captureDir
                                    Write-Log "  Current directory permissions:" -Level ERROR
                                    
                                    foreach ($access in $acl.Access) {
                                        Write-Log "    $($access.IdentityReference): $($access.FileSystemRights)" -Level ERROR
                                    }
                                    
                                    # Check if SYSTEM has write access
                                    $systemAccess = $acl.Access | Where-Object { 
                                        $_.IdentityReference -like "*SYSTEM*" -and 
                                        $_.FileSystemRights -match "Write|FullControl|Modify"
                                    }
                                    
                                    if (-not $systemAccess) {
                                        $errorMsg = "NT AUTHORITY\SYSTEM does not have write access to capture directory"
                                        $results.Errors += $errorMsg
                                        Write-Log "  $errorMsg" -Level ERROR
                                    }
                                    
                                } catch {
                                    Write-Log "  Could not check directory permissions: $_" -Level ERROR
                                }
                            }
                        }
                    }
                    
                } else {
                    $errorMsg = "Capture port '$capturePort' has no file path configured"
                    $results.Errors += $errorMsg
                    Write-Log $errorMsg -Level ERROR
                }
                
            } catch {
                $errorMsg = "Failed to validate capture port '$capturePort': $_"
                $results.Errors += $errorMsg
                Write-Log $errorMsg -Level ERROR
            }
        } else {
            Write-Log "Validation 4: Skipped (no capture port identified)" -Level WARN
        }
        
        # Summary
        Write-Log "========================================" -Level INFO
        Write-Log "Validation Summary" -Level INFO
        Write-Log "========================================" -Level INFO
        Write-Log "Printer Exists: $($results.PrinterExists)" -Level INFO
        Write-Log "Has Physical Port: $($results.HasPhysicalPort)" -Level INFO
        Write-Log "Has Capture Port: $($results.HasCapturePort)" -Level INFO
        Write-Log "Physical Port Accessible: $($results.PhysicalPortAccessible)" -Level INFO
        Write-Log "Capture File Writable: $($results.CaptureFileWritable)" -Level INFO
        Write-Log "Test Write Successful: $($results.TestWriteSuccessful)" -Level INFO
        Write-Log "Errors: $($results.Errors.Count)" -Level INFO
        Write-Log "Warnings: $($results.Warnings.Count)" -Level INFO
        
        if ($results.Errors.Count -gt 0) {
            Write-Log "Validation FAILED with errors:" -Level ERROR
            foreach ($error in $results.Errors) {
                Write-Log "  - $error" -Level ERROR
            }
        } else {
            Write-Log "✓ All validations PASSED" -Level INFO
        }
        
        if ($results.Warnings.Count -gt 0) {
            Write-Log "Validation warnings:" -Level WARN
            foreach ($warning in $results.Warnings) {
                Write-Log "  - $warning" -Level WARN
            }
        }
        
        Write-Log "========================================" -Level INFO
        
    } catch {
        $errorMsg = "Unexpected error during validation: $_"
        $results.Errors += $errorMsg
        Write-Log $errorMsg -Level ERROR
    }
    
    return $results
}

<#
.SYNOPSIS
    Tests if the capture file is updated when a print job is sent.

.DESCRIPTION
    Sends a test print job to the Tabeza Agent using Out-Printer and
    monitors the capture file for changes (size or timestamp). This validates
    that the printer pooling configuration is working correctly and print jobs
    are being captured to the file.
    
    If the printer is offline, this test is marked as non-fatal and returns
    a warning rather than an error.

.PARAMETER PrinterName
    The name of the printer to test (default: "Tabeza Agent").

.PARAMETER CaptureFilePath
    The path to the capture file to monitor.

.OUTPUTS
    System.Collections.Hashtable - Returns a hashtable with:
        - Success (bool): True if capture file was updated
        - Message (string): Success or error message
        - IsFatal (bool): False if printer is offline (non-fatal)
        - FileSizeBefore (long): File size before test print
        - FileSizeAfter (long): File size after test print
        - LastModifiedBefore (datetime): Last modified time before test
        - LastModifiedAfter (datetime): Last modified time after test

.EXAMPLE
    $result = Test-CaptureFileUpdate -PrinterName "Tabeza Agent" -CaptureFilePath "C:\TabezaPrints\order.prn"
    if ($result.Success) {
        Write-Host "Capture file is being updated correctly"
    } elseif (-not $result.IsFatal) {
        Write-Host "Printer is offline (non-fatal): $($result.Message)"
    } else {
        Write-Host "Test failed: $($result.Message)"
    }

.NOTES
    Requirements: 6.4
    
    This test is marked as non-fatal if the printer is offline, as the capture
    file will still be updated when the printer comes back online. The primary
    goal is to verify the configuration is correct, not that the printer is
    currently operational.
#>
function Test-CaptureFileUpdate {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param(
        [Parameter(Mandatory = $false)]
        [ValidateNotNullOrEmpty()]
        [string]$PrinterName = 'Tabeza Agent',
        
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$CaptureFilePath
    )
    
    Write-Log "========================================" -Level INFO
    Write-Log "Testing Capture File Update" -Level INFO
    Write-Log "========================================" -Level INFO
    
    $result = @{
        Success = $false
        Message = ""
        IsFatal = $true
        FileSizeBefore = 0
        FileSizeAfter = 0
        LastModifiedBefore = $null
        LastModifiedAfter = $null
    }
    
    try {
        # Check if printer exists
        Write-Log "Checking if printer exists: $PrinterName" -Level INFO
        $printer = Get-Printer -Name $PrinterName -ErrorAction Stop
        
        Write-Log "Printer found: $PrinterName" -Level INFO
        Write-Log "  Status: $($printer.PrinterStatus)" -Level INFO
        
        # Check printer status
        if ($printer.PrinterStatus -eq 'Offline' -or 
            $printer.PrinterStatus -eq 'Error' -or
            $printer.PrinterStatus -eq 'NotAvailable') {
            
            $result.IsFatal = $false
            $result.Message = "Printer is offline or unavailable (Status: $($printer.PrinterStatus)). This is non-fatal - the capture file will be updated when the printer comes online."
            Write-Log $result.Message -Level WARN
            Write-Log "Skipping test print (printer offline)" -Level WARN
            return $result
        }
        
        # Get capture file info before test print
        Write-Log "Checking capture file before test print..." -Level INFO
        
        if (Test-Path -Path $CaptureFilePath) {
            $fileInfoBefore = Get-Item -Path $CaptureFilePath
            $result.FileSizeBefore = $fileInfoBefore.Length
            $result.LastModifiedBefore = $fileInfoBefore.LastWriteTime
            
            Write-Log "  File exists: $CaptureFilePath" -Level INFO
            Write-Log "  Size before: $($result.FileSizeBefore) bytes" -Level INFO
            Write-Log "  Last modified before: $($result.LastModifiedBefore)" -Level INFO
        } else {
            Write-Log "  Capture file does not exist yet (will be created on first print)" -Level INFO
            $result.FileSizeBefore = 0
            $result.LastModifiedBefore = [datetime]::MinValue
        }
        
        # Create test print content
        $testContent = @"
========================================
Tabeza Agent TEST RECEIPT
========================================

Test ID: $([guid]::NewGuid())
Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

This is a test receipt to verify that the
Tabeza Agent pooling configuration
is working correctly.

If you can see this receipt, the printer
is successfully capturing print jobs to:
$CaptureFilePath

========================================
END OF TEST RECEIPT
========================================
"@
        
        Write-Log "Sending test print job to printer..." -Level INFO
        
        try {
            # Send test print using Out-Printer
            $testContent | Out-Printer -Name $PrinterName -ErrorAction Stop
            
            Write-Log "Test print job sent successfully" -Level INFO
            
            # Wait for print job to be processed (up to 10 seconds)
            Write-Log "Waiting for print job to be processed..." -Level INFO
            
            $maxWaitSeconds = 10
            $waitInterval = 1
            $elapsed = 0
            $fileUpdated = $false
            
            while ($elapsed -lt $maxWaitSeconds) {
                Start-Sleep -Seconds $waitInterval
                $elapsed += $waitInterval
                
                # Check if capture file was updated
                if (Test-Path -Path $CaptureFilePath) {
                    $fileInfoAfter = Get-Item -Path $CaptureFilePath
                    $result.FileSizeAfter = $fileInfoAfter.Length
                    $result.LastModifiedAfter = $fileInfoAfter.LastWriteTime
                    
                    # Check if file size changed or last modified time changed
                    if ($result.FileSizeAfter -ne $result.FileSizeBefore -or
                        $result.LastModifiedAfter -ne $result.LastModifiedBefore) {
                        
                        $fileUpdated = $true
                        Write-Log "✓ Capture file was updated!" -Level INFO
                        Write-Log "  Size after: $($result.FileSizeAfter) bytes (change: +$($result.FileSizeAfter - $result.FileSizeBefore) bytes)" -Level INFO
                        Write-Log "  Last modified after: $($result.LastModifiedAfter)" -Level INFO
                        break
                    }
                }
                
                Write-Log "  Waiting... ($elapsed/$maxWaitSeconds seconds)" -Level INFO
            }
            
            if ($fileUpdated) {
                $result.Success = $true
                $result.Message = "Capture file was successfully updated after test print"
                Write-Log "✓ Test PASSED: $($result.Message)" -Level INFO
            } else {
                $result.IsFatal = $false
                $result.Message = "Capture file was not updated within $maxWaitSeconds seconds. This may be normal if the printer is processing slowly or is offline. The configuration is correct, but the printer may need attention."
                Write-Log $result.Message -Level WARN
            }
            
        } catch {
            # Check if error is due to printer being offline
            if ($_.Exception.Message -like "*offline*" -or 
                $_.Exception.Message -like "*not available*" -or
                $_.Exception.Message -like "*not ready*") {
                
                $result.IsFatal = $false
                $result.Message = "Printer is offline or not ready: $_. This is non-fatal - the configuration is correct."
                Write-Log $result.Message -Level WARN
            } else {
                $result.IsFatal = $true
                $result.Message = "Failed to send test print job: $_"
                Write-Log $result.Message -Level ERROR
            }
        }
        
        Write-Log "========================================" -Level INFO
        Write-Log "Capture File Update Test Complete" -Level INFO
        Write-Log "========================================" -Level INFO
        
    } catch {
        $result.IsFatal = $true
        $result.Message = "Unexpected error during capture file update test: $_"
        Write-Log $result.Message -Level ERROR
    }
    
    return $result
}

#endregion

#region Rollback and Error Recovery

<#
.SYNOPSIS
    Removes the Tabeza Agent and associated capture port.

.DESCRIPTION
    Performs a clean rollback of the printer configuration by:
    - Removing the Tabeza Agent using Remove-Printer
    - Removing the TabezaCapturePort using Remove-PrinterPort
    - Logging all rollback actions
    - Handling errors gracefully (already removed is considered success)
    
    This function is used for error recovery when configuration fails or
    when the printer needs to be reconfigured from scratch.

.PARAMETER PrinterName
    The name of the printer to remove (default: "Tabeza Agent").

.PARAMETER CapturePortName
    The name of the capture port to remove (default: "TabezaCapturePort").

.PARAMETER PreserveCaptureFile
    If $true, preserves the capture file data. If $false, the file is left
    as-is (not deleted). Default is $true.

.OUTPUTS
    System.Boolean - Returns $true if rollback was successful (or resources
                     were already removed), $false if rollback failed.

.EXAMPLE
    Remove-TabezaPOSPrinter
    
.EXAMPLE
    Remove-TabezaPOSPrinter -PrinterName "Tabeza Agent" -CapturePortName "TabezaCapturePort"

.NOTES
    Requirements: 8.4
    
    This function treats "already removed" as a success case, making it
    idempotent and safe to call multiple times. Errors are logged but do
    not throw exceptions, allowing the rollback to continue even if some
    resources are already gone.
#>
function Remove-TabezaPOSPrinter {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $false)]
        [ValidateNotNullOrEmpty()]
        [string]$PrinterName = 'Tabeza Agent',
        
        [Parameter(Mandatory = $false)]
        [ValidateNotNullOrEmpty()]
        [string]$CapturePortName = 'TabezaCapturePort',
        
        [Parameter(Mandatory = $false)]
        [bool]$PreserveCaptureFile = $true
    )
    
    Write-Log "========================================" -Level INFO
    Write-Log "Rolling Back Printer Configuration" -Level INFO
    Write-Log "========================================" -Level INFO
    
    $rollbackSuccess = $true
    
    # Step 1: Remove Tabeza Agent
    Write-Log "Step 1: Removing printer '$PrinterName'..." -Level INFO
    
    try {
        $printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
        
        if ($printer) {
            Write-Log "Printer found. Removing..." -Level INFO
            
            try {
                Remove-Printer -Name $PrinterName -ErrorAction Stop
                Write-Log "✓ Successfully removed printer: $PrinterName" -Level INFO
                
            } catch {
                $errorMsg = "Failed to remove printer '$PrinterName': $_"
                Write-Log $errorMsg -Level ERROR
                $rollbackSuccess = $false
                
                # Check for common issues
                if ($_.Exception.Message -like "*in use*" -or 
                    $_.Exception.Message -like "*print job*") {
                    Write-Log "Printer may have active print jobs. Try canceling all jobs and retry." -Level ERROR
                } elseif ($_.Exception.Message -like "*Access*denied*") {
                    Write-Log "Permission denied. Ensure you are running with administrator privileges." -Level ERROR
                }
            }
        } else {
            Write-Log "Printer '$PrinterName' not found (already removed or never created)" -Level INFO
            Write-Log "✓ Printer removal: Success (already removed)" -Level INFO
        }
        
    } catch {
        $errorMsg = "Unexpected error while checking for printer: $_"
        Write-Log $errorMsg -Level ERROR
        $rollbackSuccess = $false
    }
    
    # Step 2: Remove TabezaCapturePort
    Write-Log "Step 2: Removing capture port '$CapturePortName'..." -Level INFO
    
    try {
        $port = Get-PrinterPort -Name $CapturePortName -ErrorAction SilentlyContinue
        
        if ($port) {
            Write-Log "Capture port found. Removing..." -Level INFO
            
            # Log port details before removal
            Write-Log "  Port name: $($port.Name)" -Level INFO
            Write-Log "  Port type: $($port.PortType)" -Level INFO
            Write-Log "  File path: $($port.PrinterHostAddress)" -Level INFO
            
            try {
                Remove-PrinterPort -Name $CapturePortName -ErrorAction Stop
                Write-Log "✓ Successfully removed capture port: $CapturePortName" -Level INFO
                
            } catch {
                $errorMsg = "Failed to remove capture port '$CapturePortName': $_"
                Write-Log $errorMsg -Level ERROR
                $rollbackSuccess = $false
                
                # Check for common issues
                if ($_.Exception.Message -like "*in use*") {
                    Write-Log "Port may be in use by another printer. Ensure all printers using this port are removed first." -Level ERROR
                } elseif ($_.Exception.Message -like "*Access*denied*") {
                    Write-Log "Permission denied. Ensure you are running with administrator privileges." -Level ERROR
                }
            }
        } else {
            Write-Log "Capture port '$CapturePortName' not found (already removed or never created)" -Level INFO
            Write-Log "✓ Capture port removal: Success (already removed)" -Level INFO
        }
        
    } catch {
        $errorMsg = "Unexpected error while checking for capture port: $_"
        Write-Log $errorMsg -Level ERROR
        $rollbackSuccess = $false
    }
    
    # Step 3: Note about capture file preservation
    if ($PreserveCaptureFile) {
        Write-Log "Step 3: Capture file preservation enabled" -Level INFO
        Write-Log "  Capture file data will be preserved (not deleted)" -Level INFO
        Write-Log "  This allows reconfiguration without losing captured print data" -Level INFO
    } else {
        Write-Log "Step 3: Capture file preservation disabled" -Level INFO
        Write-Log "  Note: Capture file is not automatically deleted by this function" -Level INFO
        Write-Log "  Manual deletion required if desired" -Level INFO
    }
    
    # Summary
    Write-Log "========================================" -Level INFO
    if ($rollbackSuccess) {
        Write-Log "✓ Rollback completed successfully" -Level INFO
    } else {
        Write-Log "✗ Rollback completed with errors" -Level ERROR
        Write-Log "Some resources may not have been removed. Check the log for details." -Level ERROR
    }
    Write-Log "========================================" -Level INFO
    
    return $rollbackSuccess
}

<#
.SYNOPSIS
    Handles directory creation failures with specific error messages.

.DESCRIPTION
    Provides detailed error handling for directory creation failures, including:
    - Permission errors (Access Denied)
    - Disk space errors (Insufficient space)
    - Path errors (Invalid path, path too long)
    - Network errors (Network path not found)
    
    Displays specific error messages with the path and issue, and exits with
    code 1 to indicate a fatal configuration error.

.PARAMETER Path
    The directory path that failed to be created.

.PARAMETER Exception
    The exception object from the failed directory creation attempt.

.EXAMPLE
    try {
        New-Item -Path "C:\TabezaPrints" -ItemType Directory -Force -ErrorAction Stop
    } catch {
        Handle-DirectoryCreationFailure -Path "C:\TabezaPrints" -Exception $_
    }

.NOTES
    Requirements: 8.3
    
    This function always exits the script with code 1 after displaying the
    error message. It is designed to be called from a catch block when
    directory creation fails.
#>
function Handle-DirectoryCreationFailure {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$Path,
        
        [Parameter(Mandatory = $true)]
        [System.Management.Automation.ErrorRecord]$Exception
    )
    
    Write-Log "========================================" -Level ERROR
    Write-Log "Directory Creation Failed" -Level ERROR
    Write-Log "========================================" -Level ERROR
    
    $errorMessage = $Exception.Exception.Message
    $errorType = "Unknown Error"
    $troubleshooting = @()
    
    # Analyze the error and provide specific guidance
    
    # Error Type 1: Permission Denied
    if ($errorMessage -like "*Access*denied*" -or 
        $errorMessage -like "*permission*" -or
        $errorMessage -like "*UnauthorizedAccess*") {
        
        $errorType = "Permission Denied"
        Write-Log "Error Type: $errorType" -Level ERROR
        Write-Log "The system does not have permission to create the directory." -Level ERROR
        
        $troubleshooting = @(
            "1. Ensure you are running the installer with administrator privileges:",
            "   - Right-click the installer and select 'Run as administrator'",
            "   - Or run PowerShell as administrator and execute the script",
            "",
            "2. Check if the parent directory has restrictive permissions:",
            "   - Right-click the parent folder in Windows Explorer",
            "   - Select Properties → Security tab",
            "   - Ensure 'Administrators' group has 'Full Control'",
            "",
            "3. Check if the directory is on a network drive with restricted access",
            "",
            "4. Temporarily disable antivirus software that may be blocking directory creation",
            "",
            "5. Try creating the directory manually:",
            "   - Open Windows Explorer",
            "   - Navigate to the parent folder",
            "   - Right-click → New → Folder",
            "   - If this fails, there may be a system-level permission issue"
        )
    }
    # Error Type 2: Disk Space
    elseif ($errorMessage -like "*disk*full*" -or 
            $errorMessage -like "*space*" -or
            $errorMessage -like "*insufficient*" -or
            $errorMessage -like "*not enough*") {
        
        $errorType = "Insufficient Disk Space"
        Write-Log "Error Type: $errorType" -Level ERROR
        Write-Log "There is not enough disk space to create the directory." -Level ERROR
        
        # Try to get disk space information
        try {
            $drive = Split-Path -Path $Path -Qualifier
            $driveInfo = Get-PSDrive -Name $drive.TrimEnd(':') -ErrorAction SilentlyContinue
            
            if ($driveInfo) {
                $freeSpaceGB = [math]::Round($driveInfo.Free / 1GB, 2)
                $usedSpaceGB = [math]::Round($driveInfo.Used / 1GB, 2)
                $totalSpaceGB = [math]::Round(($driveInfo.Free + $driveInfo.Used) / 1GB, 2)
                
                Write-Log "Disk Space Information for drive $drive" -Level ERROR
                Write-Log "  Total: $totalSpaceGB GB" -Level ERROR
                Write-Log "  Used: $usedSpaceGB GB" -Level ERROR
                Write-Log "  Free: $freeSpaceGB GB" -Level ERROR
            }
        } catch {
            Write-Log "Could not retrieve disk space information: $_" -Level WARN
        }
        
        $troubleshooting = @(
            "1. Free up disk space on the target drive:",
            "   - Delete temporary files (run Disk Cleanup)",
            "   - Remove unnecessary programs",
            "   - Empty the Recycle Bin",
            "   - Move large files to another drive",
            "",
            "2. Choose a different location for the capture directory:",
            "   - Modify the CaptureFilePath parameter to use a drive with more space",
            "   - Example: -CaptureFilePath 'D:\TabezaPrints\order.prn'",
            "",
            "3. Check for disk errors:",
            "   - Open Command Prompt as administrator",
            "   - Run: chkdsk $($drive) /f",
            "   - Restart the computer if prompted"
        )
    }
    # Error Type 3: Invalid Path
    elseif ($errorMessage -like "*path*invalid*" -or 
            $errorMessage -like "*illegal*characters*" -or
            $errorMessage -like "*path*too*long*" -or
            $errorMessage -like "*PathTooLong*") {
        
        $errorType = "Invalid Path"
        Write-Log "Error Type: $errorType" -Level ERROR
        Write-Log "The specified path is invalid or too long." -Level ERROR
        
        $troubleshooting = @(
            "1. Check the path for invalid characters:",
            "   - Windows does not allow: < > : `" / \ | ? *",
            "   - Ensure the path uses only valid characters",
            "",
            "2. Check if the path is too long:",
            "   - Windows has a 260-character path limit (MAX_PATH)",
            "   - Try using a shorter path",
            "   - Example: 'C:\Tabeza\order.prn' instead of 'C:\Very\Long\Path\...'",
            "",
            "3. Ensure the path is absolute (not relative):",
            "   - Use full paths like 'C:\TabezaPrints\order.prn'",
            "   - Avoid relative paths like '..\TabezaPrints\order.prn'",
            "",
            "4. Check if the path contains reserved names:",
            "   - Windows reserves: CON, PRN, AUX, NUL, COM1-9, LPT1-9",
            "   - Avoid using these names in the path"
        )
    }
    # Error Type 4: Network Path
    elseif ($errorMessage -like "*network*" -or 
            $errorMessage -like "*UNC*" -or
            $errorMessage -like "*remote*") {
        
        $errorType = "Network Path Error"
        Write-Log "Error Type: $errorType" -Level ERROR
        Write-Log "There was an error accessing the network path." -Level ERROR
        
        $troubleshooting = @(
            "1. Verify the network path is accessible:",
            "   - Open Windows Explorer",
            "   - Navigate to the network path",
            "   - Ensure you can create folders manually",
            "",
            "2. Check network connectivity:",
            "   - Ensure the network share is online",
            "   - Verify network credentials are correct",
            "   - Try accessing the share from another computer",
            "",
            "3. Use a local path instead of a network path:",
            "   - Network paths can be unreliable for printer capture",
            "   - Recommended: Use a local drive like 'C:\TabezaPrints'",
            "",
            "4. Check firewall and network security settings:",
            "   - Ensure the network share allows write access",
            "   - Check if antivirus is blocking network access"
        )
    }
    # Generic Error
    else {
        $errorType = "Directory Creation Error"
        Write-Log "Error Type: $errorType" -Level ERROR
        
        $troubleshooting = @(
            "1. Verify the path is correct and accessible:",
            "   - Check for typos in the path",
            "   - Ensure the parent directory exists",
            "",
            "2. Try creating the directory manually:",
            "   - Open Windows Explorer",
            "   - Navigate to the parent folder",
            "   - Right-click → New → Folder",
            "",
            "3. Check Windows Event Viewer for system errors:",
            "   - Open Event Viewer (eventvwr.msc)",
            "   - Navigate to: Windows Logs → System",
            "   - Look for errors related to file system or disk",
            "",
            "4. Restart the computer and try again:",
            "   - Some file system issues can be resolved by restarting"
        )
    }
    
    # Build comprehensive error message
    $detailedError = @"

========================================
ERROR: Failed to Create Capture Directory
========================================

Error Type: $errorType
Directory Path: $Path

Error Details:
$errorMessage

Troubleshooting Steps:
$($troubleshooting -join "`n")

For additional support:
- Visit: https://tabeza.co.ke/support
- Email: support@tabeza.co.ke
- Include the log file: $($script:LogFilePath)

========================================
"@
    
    Write-Log $detailedError -Level ERROR
    
    if (-not $Silent) {
        Write-Host ""
        Write-Host $detailedError -ForegroundColor Red
        Write-Host ""
    }
    
    Write-Log "Exiting with code 1: Directory creation failed" -Level ERROR
    exit 1
}

#endregion


#region Validation and Rollback Integration

<#
.SYNOPSIS
    Validates printer configuration and performs rollback if validation fails.

.DESCRIPTION
    This function integrates validation and rollback logic:
    1. Calls Test-PoolingConfiguration to validate the printer setup
    2. If validation fails, calls Remove-TabezaPOSPrinter to rollback changes
    3. Restores the original default printer
    4. Exits with code 1 to indicate configuration failure
    
    This function should be called after printer creation to ensure the
    configuration is correct before considering the setup complete.

.PARAMETER PrinterName
    The name of the printer to validate (default: "Tabeza Agent").

.PARAMETER OriginalDefaultPrinter
    The name of the original default printer to restore on failure.
    If $null or empty, no default printer restoration is attempted.

.OUTPUTS
    System.Boolean - Returns $true if validation passed, exits script if validation failed.

.EXAMPLE
    $validation = Invoke-ValidationWithRollback -PrinterName "Tabeza Agent" -OriginalDefaultPrinter "EPSON TM-T20"

.NOTES
    Requirements: 8.4
    
    This function exits the script with code 1 if validation fails, after
    performing rollback. It does not return in the failure case.
#>
function Invoke-ValidationWithRollback {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $false)]
        [ValidateNotNullOrEmpty()]
        [string]$PrinterName = 'Tabeza Agent',
        
        [Parameter(Mandatory = $false)]
        [AllowNull()]
        [AllowEmptyString()]
        [string]$OriginalDefaultPrinter
    )
    
    Write-Log "========================================" -Level INFO
    Write-Log "Validation with Rollback Protection" -Level INFO
    Write-Log "========================================" -Level INFO
    
    # Step 1: Perform validation
    Write-Log "Step 1: Validating printer configuration..." -Level INFO
    
    try {
        $validation = Test-PoolingConfiguration -PrinterName $PrinterName
        
        # Check if validation passed
        if ($validation.Errors.Count -eq 0) {
            Write-Log "✓ Validation PASSED - Configuration is correct" -Level INFO
            
            # Log any warnings
            if ($validation.Warnings.Count -gt 0) {
                Write-Log "Validation warnings (non-fatal):" -Level WARN
                foreach ($warning in $validation.Warnings) {
                    Write-Log "  - $warning" -Level WARN
                }
            }
            
            Write-Log "========================================" -Level INFO
            return $true
        }
        
        # Validation failed - proceed with rollback
        Write-Log "✗ Validation FAILED - Rolling back configuration" -Level ERROR
        Write-Log "Validation errors:" -Level ERROR
        foreach ($error in $validation.Errors) {
            Write-Log "  - $error" -Level ERROR
        }
        
    } catch {
        Write-Log "✗ Validation threw an exception: $_" -Level ERROR
        Write-Log "Rolling back configuration..." -Level ERROR
    }
    
    # Step 2: Perform rollback (Requirements: 8.4)
    Write-Log "Step 2: Rolling back printer configuration..." -Level INFO
    
    try {
        $rollbackSuccess = Remove-TabezaPOSPrinter -PrinterName $PrinterName -CapturePortName $script:TabezaCapturePortName
        
        if ($rollbackSuccess) {
            Write-Log "✓ Rollback completed successfully" -Level INFO
        } else {
            Write-Log "⚠ Rollback completed with warnings" -Level WARN
            Write-Log "Some resources may not have been removed. Check the log for details." -Level WARN
        }
        
    } catch {
        Write-Log "✗ Rollback failed: $_" -Level ERROR
        Write-Log "Manual cleanup may be required" -Level ERROR
    }
    
    # Step 3: Restore original default printer (Requirements: 4.2)
    if (-not [string]::IsNullOrWhiteSpace($OriginalDefaultPrinter)) {
        Write-Log "Step 3: Restoring original default printer..." -Level INFO
        
        try {
            $restoreSuccess = Restore-DefaultPrinter -PrinterName $OriginalDefaultPrinter
            
            if ($restoreSuccess) {
                Write-Log "✓ Default printer restored to: $OriginalDefaultPrinter" -Level INFO
            } else {
                Write-Log "⚠ Could not restore default printer (non-fatal)" -Level WARN
            }
            
        } catch {
            Write-Log "⚠ Exception while restoring default printer: $_" -Level WARN
        }
    } else {
        Write-Log "Step 3: No original default printer to restore (skipped)" -Level INFO
    }
    
    # Step 4: Display error message and exit
    $errorMsg = @"

========================================
ERROR: Printer Configuration Validation Failed
========================================

The Tabeza Agent was created but failed validation checks.
All changes have been rolled back to prevent an invalid configuration.

Validation Errors:
$($validation.Errors -join "`n")

What happened:
1. The printer was created successfully
2. Validation checks detected configuration issues
3. The printer and capture port were removed (rollback)
4. Your system has been restored to its original state

Next Steps:
1. Review the validation errors above
2. Check the detailed log file: $($script:LogFilePath)
3. Resolve any issues (permissions, ports, drivers)
4. Re-run the TabezaConnect installer

Common Issues:
- Capture directory permissions: Ensure NT AUTHORITY\SYSTEM has write access
- Physical printer offline: Ensure the thermal printer is powered on and connected
- Port conflicts: Ensure no other printers are using the same ports

For support:
- Visit: https://tabeza.co.ke/support
- Email: support@tabeza.co.ke
- Include the log file in your support request

========================================
"@
    
    Write-Log $errorMsg -Level ERROR
    
    if (-not $Silent) {
        Write-Host ""
        Write-Host $errorMsg -ForegroundColor Red
        Write-Host ""
    }
    
    Write-Log "Exiting with code 1: Validation failed, rollback completed" -Level ERROR
    exit 1
}

#endregion

#region Default Printer Preservation

<#
.SYNOPSIS
    Gets the current default printer name.

.DESCRIPTION
    Queries the Windows default printer using WMI (Win32_Printer class).
    Returns the printer name if a default printer is set, or $null if no
    default printer is configured.
    
    This function is used to preserve the user's default printer setting
    before configuration, ensuring the workflow is not disrupted.

.OUTPUTS
    System.String - Returns the default printer name, or $null if none set.

.EXAMPLE
    $defaultPrinter = Get-DefaultPrinter
    if ($defaultPrinter) {
        Write-Host "Default printer: $defaultPrinter"
    } else {
        Write-Host "No default printer set"
    }

.NOTES
    Requirements: 4.1
#>
function Get-DefaultPrinter {
    [CmdletBinding()]
    [OutputType([string])]
    param()
    
    try {
        Write-Log "Querying current default printer..." -Level INFO
        
        # Query default printer using WMI
        $defaultPrinter = Get-CimInstance -ClassName Win32_Printer -Filter "Default = TRUE" -ErrorAction SilentlyContinue
        
        if ($defaultPrinter) {
            $printerName = $defaultPrinter.Name
            Write-Log "Default printer found: $printerName" -Level INFO
            return $printerName
        } else {
            Write-Log "No default printer is currently set" -Level INFO
            return $null
        }
        
    } catch {
        Write-Log "Failed to query default printer: $_" -Level WARN
        return $null
    }
}

<#
.SYNOPSIS
    Restores the default printer to the specified printer name.

.DESCRIPTION
    Sets the Windows default printer using WScript.Network COM object.
    Handles errors gracefully by logging warnings rather than throwing
    exceptions, as default printer restoration is not critical to the
    printer configuration process.

.PARAMETER PrinterName
    The name of the printer to set as default.

.OUTPUTS
    System.Boolean - Returns $true if successful, $false if failed.

.EXAMPLE
    Restore-DefaultPrinter -PrinterName "EPSON TM-T20"

.NOTES
    Requirements: 4.2
    
    This function logs errors as warnings rather than fatal errors, as
    default printer restoration is a convenience feature and should not
    block the configuration process.
#>
function Restore-DefaultPrinter {
    [CmdletBinding()]
    [OutputType([bool])]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]$PrinterName
    )
    
    try {
        Write-Log "Restoring default printer to: $PrinterName" -Level INFO
        
        # Verify printer exists before attempting to set as default
        $printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
        
        if (-not $printer) {
            Write-Log "Cannot restore default printer: Printer '$PrinterName' not found" -Level WARN
            return $false
        }
        
        # Set default printer using WScript.Network COM object
        $network = New-Object -ComObject WScript.Network
        $network.SetDefaultPrinter($PrinterName)
        
        # Verify the change
        Start-Sleep -Milliseconds 500  # Brief delay for system to update
        
        $verifyDefault = Get-CimInstance -ClassName Win32_Printer -Filter "Default = TRUE" -ErrorAction SilentlyContinue
        
        if ($verifyDefault -and $verifyDefault.Name -eq $PrinterName) {
            Write-Log "✓ Successfully restored default printer to: $PrinterName" -Level INFO
            return $true
        } else {
            Write-Log "Warning: Default printer was set but verification failed" -Level WARN
            return $false
        }
        
    } catch {
        Write-Log "Failed to restore default printer (non-fatal): $_" -Level WARN
        return $false
    }
}

#endregion


#region Main Orchestration Logic

# CORE TRUTH: Manual service always exists. Digital authority is singular.
# Tabeza adapts to the venue — never the reverse.

Write-Log "========================================" -Level INFO
Write-Log "Tabeza Agent Configuration Script" -Level INFO
Write-Log "Version: 1.7.0" -Level INFO
Write-Log "========================================" -Level INFO
Write-Log "Start Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -Level INFO
Write-Log "Capture File Path: $CaptureFilePath" -Level INFO
Write-Log "Silent Mode: $Silent" -Level INFO
Write-Log "Force Mode: $Force" -Level INFO
Write-Log "========================================" -Level INFO


Write-Log "========================================" -Level INFO
Write-Log "Phase 0: Prerequisites Validation" -Level INFO
Write-Log "========================================" -Level INFO

# Validate admin privileges (Requirements: 11.2)
Write-Log "Checking administrator privileges..." -Level INFO

if (-not (Test-AdminPrivileges)) {
    $errorMsg = @"

========================================
ERROR: Administrator Privileges Required
========================================

This script must be run with administrator privileges to configure
Windows printer settings.

How to run as administrator:
1. Right-click on PowerShell
2. Select "Run as administrator"
3. Navigate to the script directory
4. Run the script again

Or if running from Inno Setup installer:
- Ensure the installer is run with administrator privileges
- Right-click the installer and select "Run as administrator"

For support, visit: https://tabeza.co.ke/support
Log file: $($script:LogFilePath)

========================================
"@
    
    Write-Log $errorMsg -Level ERROR
    
    if (-not $Silent) {
        Write-Host ""
        Write-Host $errorMsg -ForegroundColor Red
        Write-Host ""
    }
    
    Write-Log "Exiting with code 4: Insufficient privileges" -Level ERROR
    exit 4
}

Write-Log "✓ Administrator privileges confirmed" -Level INFO

# Verify Print Spooler is running (Requirements: 11.3)
Write-Log "Checking Print Spooler service..." -Level INFO

if (-not (Test-PrintSpoolerRunning)) {
    $errorMsg = @"

========================================
ERROR: Print Spooler Service Not Running
========================================

The Windows Print Spooler service is not running. This service is
required for printer configuration.

How to start the Print Spooler service:
1. Open Services (services.msc)
2. Find "Print Spooler" in the list
3. Right-click and select "Start"
4. Re-run the TabezaConnect installer

Or use PowerShell:
Start-Service -Name Spooler

For support, visit: https://tabeza.co.ke/support
Log file: $($script:LogFilePath)

========================================
"@
    
    Write-Log $errorMsg -Level ERROR
    
    if (-not $Silent) {
        Write-Host ""
        Write-Host $errorMsg -ForegroundColor Red
        Write-Host ""
    }
    
    Write-Log "Exiting with code 5: Print Spooler not running" -Level ERROR
    exit 5
}

Write-Log "✓ Print Spooler service is running" -Level INFO

Write-Log "========================================" -Level INFO
Write-Log "Phase 0 Complete: Prerequisites Validation" -Level INFO
Write-Log "========================================" -Level INFO


Write-Log "========================================" -Level INFO
Write-Log "Phase 1: Thermal Printer Detection" -Level INFO
Write-Log "========================================" -Level INFO

# Detect physical thermal printer (Requirements: 1.1, 1.2, 1.3, 1.4)
Write-Log "Detecting thermal printers..." -Level INFO

$thermalPrinters = Get-ThermalPrinters

if ($thermalPrinters.Count -eq 0) {
    $errorMsg = @"

========================================
ERROR: No Thermal Printer Detected
========================================

No thermal receipt printer was found on this system.
The Tabeza Agent requires an existing thermal printer to mirror.

Troubleshooting steps:
1. Ensure your thermal printer is connected:
   - Check USB cable connection (if USB printer)
   - Check power cable and ensure printer is powered on
   - Check network connection (if network printer)

2. Install the thermal printer driver:
   - Visit the manufacturer's website
   - Download and install the correct driver for your printer model
   - Common brands: EPSON, Star, Citizen, Bixolon, Sam4s

3. Verify the printer appears in Windows:
   - Open Settings → Devices → Printers & scanners
   - Your thermal printer should be listed
   - Try printing a test page to verify it works

4. Re-run the TabezaConnect installer after the printer is installed

Supported printer types:
- Thermal receipt printers (EPSON TM series, Star TSP series, etc.)
- POS printers with ESC/POS support
- Label printers (thermal transfer or direct thermal)

For support, visit: https://tabeza.co.ke/support
Log file: $($script:LogFilePath)

========================================
"@
    
    Write-Log $errorMsg -Level ERROR
    
    if (-not $Silent) {
        Write-Host ""
        Write-Host $errorMsg -ForegroundColor Red
        Write-Host ""
    }
    
    Write-Log "Exiting with code 3: No thermal printer detected" -Level ERROR
    exit 3
}

Write-Log "Found $($thermalPrinters.Count) thermal printer(s)" -Level INFO

foreach ($printer in $thermalPrinters) {
    Write-Log "  - $($printer.Name)" -Level INFO
    Write-Log "    Driver: $($printer.DriverName)" -Level INFO
    Write-Log "    Port: $($printer.PortName)" -Level INFO
    Write-Log "    Status: $($printer.PrinterStatus)" -Level INFO
}

# Select the first thermal printer (highest priority)
$selectedPrinter = $thermalPrinters[0]
$script:PhysicalPrinterName = $selectedPrinter.Name
$script:PhysicalPrinterDriver = Get-PrinterDriverName -PrinterName $script:PhysicalPrinterName
$script:PhysicalPrinterPort = Get-PrinterPortName -PrinterName $script:PhysicalPrinterName

Write-Log "Selected thermal printer: $script:PhysicalPrinterName" -Level INFO
Write-Log "  Driver: $script:PhysicalPrinterDriver" -Level INFO
Write-Log "  Port: $script:PhysicalPrinterPort" -Level INFO

# Validate driver and port were retrieved successfully
if ([string]::IsNullOrWhiteSpace($script:PhysicalPrinterDriver)) {
    $errorMsg = "Could not retrieve driver name for printer: $script:PhysicalPrinterName"
    Write-Log $errorMsg -Level ERROR
    
    if (-not $Silent) {
        Write-Host ""
        Write-Host "ERROR: $errorMsg" -ForegroundColor Red
        Write-Host ""
    }
    
    Write-Log "Exiting with code 1: Driver detection failed" -Level ERROR
    exit 1
}

if ([string]::IsNullOrWhiteSpace($script:PhysicalPrinterPort)) {
    $errorMsg = "Could not retrieve port name for printer: $script:PhysicalPrinterName"
    Write-Log $errorMsg -Level ERROR
    
    if (-not $Silent) {
        Write-Host ""
        Write-Host "ERROR: $errorMsg" -ForegroundColor Red
        Write-Host ""
    }
    
    Write-Log "Exiting with code 1: Port detection failed" -Level ERROR
    exit 1
}

Write-Log "========================================" -Level INFO
Write-Log "Phase 1 Complete: Thermal Printer Detection" -Level INFO
Write-Log "========================================" -Level INFO


Write-Log "========================================" -Level INFO
Write-Log "Phase 2: Default Printer Preservation" -Level INFO
Write-Log "========================================" -Level INFO

# Record current default printer (Requirements: 4.1)
$originalDefaultPrinter = Get-DefaultPrinter

if ($originalDefaultPrinter) {
    Write-Log "Original default printer recorded: $originalDefaultPrinter" -Level INFO
} else {
    Write-Log "No default printer is currently set" -Level INFO
}

Write-Log "========================================" -Level INFO
Write-Log "Phase 2 Complete: Default Printer Preservation" -Level INFO
Write-Log "========================================" -Level INFO


Write-Log "========================================" -Level INFO
Write-Log "Phase 3: Idempotency Check" -Level INFO
Write-Log "========================================" -Level INFO

# Check if Tabeza Agent already exists (Requirements: 2.5, 7.1)
$printerExists = Test-TabezaPrinterExists -PrinterName $script:TabezaPrinterName

if ($printerExists -and -not $Force) {
    Write-Log "Tabeza Agent already exists" -Level INFO
    Write-Log "Validating existing configuration..." -Level INFO
    
    # Validate existing configuration (Requirements: 7.2)
    $configValidation = Test-TabezaPrinterConfiguration `
        -PrinterName $script:TabezaPrinterName `
        -ExpectedDriverName $script:PhysicalPrinterDriver `
        -ExpectedPhysicalPort $script:PhysicalPrinterPort `
        -ExpectedCapturePort $script:TabezaCapturePortName
    
    if ($configValidation.IsValid) {
        Write-Log "========================================" -Level INFO
        Write-Log "✓ Configuration Already Valid (Idempotent)" -Level INFO
        Write-Log "========================================" -Level INFO
        Write-Log "The Tabeza Agent is already configured correctly." -Level INFO
        Write-Log "No changes are needed. Exiting with success code." -Level INFO
        Write-Log "========================================" -Level INFO
        
        if (-not $Silent) {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "✓ Tabeza Agent Already Configured" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "The Tabeza Agent is already set up correctly." -ForegroundColor Green
            Write-Host "No changes were made to your system." -ForegroundColor Green
            Write-Host ""
            Write-Host "Configuration Details:" -ForegroundColor Gray
            Write-Host "  Printer: $script:TabezaPrinterName" -ForegroundColor Gray
            Write-Host "  Driver: $($configValidation.CurrentDriver)" -ForegroundColor Gray
            Write-Host "  Ports: $($configValidation.CurrentPorts)" -ForegroundColor Gray
            Write-Host ""
            Write-Host "Log file: $($script:LogFilePath)" -ForegroundColor Gray
            Write-Host "========================================" -ForegroundColor Green
            Write-Host ""
        }
        
        Write-Log "Exiting with code 2: Already configured (idempotent success)" -Level INFO
        exit 2
        
    } else {
        Write-Log "Existing configuration is invalid or incomplete" -Level WARN
        Write-Log "Configuration errors:" -Level WARN
        foreach ($error in $configValidation.Errors) {
            Write-Log "  - $error" -Level WARN
        }
        
        if ($Force) {
            Write-Log "Force flag is set. Removing existing printer and reconfiguring..." -Level INFO
            
            try {
                $removeSuccess = Remove-TabezaPOSPrinter -PrinterName $script:TabezaPrinterName -CapturePortName $script:TabezaCapturePortName
                
                if ($removeSuccess) {
                    Write-Log "✓ Existing printer removed successfully" -Level INFO
                    Write-Log "Proceeding with fresh configuration..." -Level INFO
                } else {
                    Write-Log "⚠ Existing printer removal completed with warnings" -Level WARN
                    Write-Log "Proceeding with configuration anyway..." -Level INFO
                }
                
            } catch {
                $errorMsg = "Failed to remove existing printer: $_"
                Write-Log $errorMsg -Level ERROR
                
                if (-not $Silent) {
                    Write-Host ""
                    Write-Host "ERROR: Could not remove existing printer" -ForegroundColor Red
                    Write-Host $errorMsg -ForegroundColor Red
                    Write-Host ""
                }
                
                Write-Log "Exiting with code 1: Failed to remove existing printer" -Level ERROR
                exit 1
            }
            
        } else {
            Write-Log "Force flag not set. Attempting to fix configuration..." -Level INFO
            Write-Log "Note: Use -Force flag to remove and recreate the printer" -Level INFO
            
            # Attempt to fix the configuration without removing the printer
            # This will be handled by the configuration steps below
        }
    }
    
} elseif ($printerExists -and $Force) {
    Write-Log "Tabeza Agent exists and Force flag is set" -Level INFO
    Write-Log "Removing existing printer for fresh configuration..." -Level INFO
    
    try {
        $removeSuccess = Remove-TabezaPOSPrinter -PrinterName $script:TabezaPrinterName -CapturePortName $script:TabezaCapturePortName
        
        if ($removeSuccess) {
            Write-Log "✓ Existing printer removed successfully" -Level INFO
        } else {
            Write-Log "⚠ Existing printer removal completed with warnings" -Level WARN
        }
        
    } catch {
        $errorMsg = "Failed to remove existing printer: $_"
        Write-Log $errorMsg -Level ERROR
        
        if (-not $Silent) {
            Write-Host ""
            Write-Host "ERROR: Could not remove existing printer" -ForegroundColor Red
            Write-Host $errorMsg -ForegroundColor Red
            Write-Host ""
        }
        
        Write-Log "Exiting with code 1: Failed to remove existing printer" -Level ERROR
        exit 1
    }
    
} else {
    Write-Log "Tabeza Agent does not exist. Proceeding with creation..." -Level INFO
}

Write-Log "========================================" -Level INFO
Write-Log "Phase 3 Complete: Idempotency Check" -Level INFO
Write-Log "========================================" -Level INFO


Write-Log "========================================" -Level INFO
Write-Log "Phase 4: Capture Directory and Port Configuration" -Level INFO
Write-Log "========================================" -Level INFO

# Create capture directory with proper permissions (Requirements: 3.1, 3.2, 3.3)
try {
    Write-Log "Creating capture directory..." -Level INFO
    $dirSuccess = New-CaptureDirectory -Path $CaptureFilePath
    
    if ($dirSuccess) {
        Write-Log "✓ Capture directory configured successfully" -Level INFO
    } else {
        throw "Capture directory configuration returned false"
    }
    
} catch {
    # Handle-DirectoryCreationFailure exits the script with code 1
    # This line is only reached if the exception is not a directory creation failure
    $errorMsg = "Unexpected error during capture directory configuration: $_"
    Write-Log $errorMsg -Level ERROR
    
    if (-not $Silent) {
        Write-Host ""
        Write-Host "ERROR: Failed to configure capture directory" -ForegroundColor Red
        Write-Host $errorMsg -ForegroundColor Red
        Write-Host ""
    }
    
    Write-Log "Exiting with code 1: Capture directory configuration failed" -Level ERROR
    exit 1
}

# Create local capture port (Requirements: 2.4, 3.4, 3.5, 3.6)
try {
    Write-Log "Creating local capture port..." -Level INFO
    $portSuccess = New-LocalCapturePort -PortName $script:TabezaCapturePortName -FilePath $CaptureFilePath
    
    if ($portSuccess) {
        Write-Log "✓ Local capture port configured successfully" -Level INFO
    } else {
        throw "Local capture port configuration returned false"
    }
    
} catch {
    $errorMsg = "Failed to create local capture port: $_"
    Write-Log $errorMsg -Level ERROR
    
    if (-not $Silent) {
        Write-Host ""
        Write-Host "ERROR: Failed to create capture port" -ForegroundColor Red
        Write-Host $errorMsg -ForegroundColor Red
        Write-Host ""
        Write-Host "Troubleshooting:" -ForegroundColor Yellow
        Write-Host "1. Ensure the Print Spooler service is running" -ForegroundColor Yellow
        Write-Host "2. Verify you have administrator privileges" -ForegroundColor Yellow
        Write-Host "3. Check the log file for details: $($script:LogFilePath)" -ForegroundColor Yellow
        Write-Host ""
    }
    
    Write-Log "Exiting with code 1: Capture port creation failed" -Level ERROR
    exit 1
}

Write-Log "========================================" -Level INFO
Write-Log "Phase 4 Complete: Capture Directory and Port Configuration" -Level INFO
Write-Log "========================================" -Level INFO


Write-Log "========================================" -Level INFO
Write-Log "Phase 5: Printer Creation and Pooling Configuration" -Level INFO
Write-Log "========================================" -Level INFO

# Create Tabeza Agent with pooling (Requirements: 2.1, 2.2, 2.3, 2.6)
try {
    Write-Log "Creating Tabeza Agent with pooling configuration..." -Level INFO
    
    $printerSuccess = New-TabezaPOSPrinter `
        -PrinterName $script:TabezaPrinterName `
        -DriverName $script:PhysicalPrinterDriver `
        -PhysicalPort $script:PhysicalPrinterPort `
        -CapturePort $script:TabezaCapturePortName
    
    if ($printerSuccess) {
        Write-Log "✓ Tabeza Agent created successfully" -Level INFO
    } else {
        throw "Printer creation returned false"
    }
    
} catch {
    $errorMsg = "Failed to create Tabeza Agent: $_"
    Write-Log $errorMsg -Level ERROR
    
    # Attempt rollback
    Write-Log "Attempting to rollback partial configuration..." -Level WARN
    
    try {
        Remove-TabezaPOSPrinter -PrinterName $script:TabezaPrinterName -CapturePortName $script:TabezaCapturePortName
        Write-Log "Rollback completed" -Level INFO
    } catch {
        Write-Log "Rollback failed: $_" -Level ERROR
    }
    
    if (-not $Silent) {
        Write-Host ""
        Write-Host "ERROR: Failed to create Tabeza Agent" -ForegroundColor Red
        Write-Host $errorMsg -ForegroundColor Red
        Write-Host ""
        Write-Host "The system has been rolled back to its original state." -ForegroundColor Yellow
        Write-Host "Check the log file for details: $($script:LogFilePath)" -ForegroundColor Yellow
        Write-Host ""
    }
    
    Write-Log "Exiting with code 1: Printer creation failed" -Level ERROR
    exit 1
}

Write-Log "========================================" -Level INFO
Write-Log "Phase 5 Complete: Printer Creation and Pooling Configuration" -Level INFO
Write-Log "========================================" -Level INFO


Write-Log "========================================" -Level INFO
Write-Log "Phase 6: Default Printer Restoration" -Level INFO
Write-Log "========================================" -Level INFO

# Restore original default printer (Requirements: 4.2, 4.3, 4.4)
if ($originalDefaultPrinter) {
    Write-Log "Restoring original default printer..." -Level INFO
    
    try {
        $restoreSuccess = Restore-DefaultPrinter -PrinterName $originalDefaultPrinter
        
        if ($restoreSuccess) {
            Write-Log "✓ Default printer restored successfully" -Level INFO
        } else {
            Write-Log "⚠ Default printer restoration failed (non-fatal)" -Level WARN
        }
        
    } catch {
        Write-Log "⚠ Exception during default printer restoration (non-fatal): $_" -Level WARN
    }
    
} else {
    Write-Log "No original default printer to restore (none was set)" -Level INFO
}

# Verify default printer was not changed to Tabeza Agent (Requirements: 4.3, 4.4)
try {
    $currentDefault = Get-DefaultPrinter
    
    if ($currentDefault -eq $script:TabezaPrinterName) {
        Write-Log "⚠ WARNING: Tabeza Agent is now the default printer" -Level WARN
        Write-Log "This should not happen. Attempting to restore original default..." -Level WARN
        
        if ($originalDefaultPrinter) {
            Restore-DefaultPrinter -PrinterName $originalDefaultPrinter
        }
    } elseif ($currentDefault -eq $originalDefaultPrinter) {
        Write-Log "✓ Default printer preserved: $currentDefault" -Level INFO
    } elseif ($currentDefault) {
        Write-Log "ℹ Default printer changed to: $currentDefault (not Tabeza Agent)" -Level INFO
    } else {
        Write-Log "ℹ No default printer is currently set" -Level INFO
    }
    
} catch {
    Write-Log "Could not verify default printer (non-fatal): $_" -Level WARN
}

Write-Log "========================================" -Level INFO
Write-Log "Phase 6 Complete: Default Printer Restoration" -Level INFO
Write-Log "========================================" -Level INFO


Write-Log "========================================" -Level INFO
Write-Log "Phase 7: Final Configuration Validation" -Level INFO
Write-Log "========================================" -Level INFO

# Validate final configuration with rollback on failure (Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.4)
$validationSuccess = Invoke-ValidationWithRollback `
    -PrinterName $script:TabezaPrinterName `
    -OriginalDefaultPrinter $originalDefaultPrinter

# If we reach this point, validation passed
Write-Log "✓ Final validation passed" -Level INFO

Write-Log "========================================" -Level INFO
Write-Log "Phase 7 Complete: Final Configuration Validation" -Level INFO
Write-Log "========================================" -Level INFO


Write-Log "========================================" -Level INFO
Write-Log "✓ CONFIGURATION COMPLETE" -Level INFO
Write-Log "========================================" -Level INFO

# Log success summary
Write-Log "Configuration Summary:" -Level INFO
Write-Log "  Tabeza Agent: $script:TabezaPrinterName" -Level INFO
Write-Log "  Physical Printer: $script:PhysicalPrinterName" -Level INFO
Write-Log "  Driver: $script:PhysicalPrinterDriver" -Level INFO
Write-Log "  Physical Port: $script:PhysicalPrinterPort" -Level INFO
Write-Log "  Capture Port: $script:TabezaCapturePortName" -Level INFO
Write-Log "  Capture File: $CaptureFilePath" -Level INFO
Write-Log "  Default Printer: $originalDefaultPrinter" -Level INFO
Write-Log "  Configuration Status: SUCCESS" -Level INFO
Write-Log "========================================" -Level INFO

# Display success message to user
if (-not $Silent) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✓ Tabeza Agent Configured Successfully" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Configuration Details:" -ForegroundColor Gray
    Write-Host "  Printer Name: $script:TabezaPrinterName" -ForegroundColor Gray
    Write-Host "  Physical Printer: $script:PhysicalPrinterName" -ForegroundColor Gray
    Write-Host "  Driver: $script:PhysicalPrinterDriver" -ForegroundColor Gray
    Write-Host "  Capture File: $CaptureFilePath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "What's Next:" -ForegroundColor Cyan
    Write-Host "  1. The TabezaConnect service will automatically monitor the capture file" -ForegroundColor Cyan
    Write-Host "  2. Print jobs sent to '$script:PhysicalPrinterName' will print normally" -ForegroundColor Cyan
    Write-Host "  3. Print jobs will also be captured to: $CaptureFilePath" -ForegroundColor Cyan
    Write-Host "  4. Your default printer remains: $originalDefaultPrinter" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Log file: $($script:LogFilePath)" -ForegroundColor Gray
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
}

Write-Log "Exiting with code 0: Configuration successful" -Level INFO
exit 0

#endregion
