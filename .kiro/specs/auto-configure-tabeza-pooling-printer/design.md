# Design Document: Auto-Configure Tabeza Pooling Printer

## Overview

This feature automates the creation and configuration of a "Tabeza POS Printer" that enables print job capture through Windows printer pooling. The system will detect an existing physical thermal printer, create a virtual printer that mirrors it, configure dual ports (physical + file capture), and validate the setup—all while preserving the existing waiter workflow.

The design follows the core principle: **Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.**

### Key Design Goals

1. **Zero-touch configuration**: Venue owners should not need to manually configure printers
2. **Workflow preservation**: Waiters continue printing to their existing default printer without changes
3. **Idempotent operations**: Re-running the installer should safely verify or update configuration
4. **Robust error handling**: Clear diagnostics when configuration fails
5. **Windows compatibility**: Support Windows 10/11 with native APIs

### Architecture Decision: PowerShell vs Native APIs

After evaluating Windows printer configuration options:

- **Win32_Printer WMI**: Read-only for most operations, requires complex COM interop
- **PrintUI.dll**: GUI-focused, difficult to script reliably
- **PowerShell cmdlets**: Native, well-documented, atomic operations with rollback support

**Decision**: Use PowerShell cmdlets (`Add-Printer`, `Add-PrinterPort`, `Get-Printer`) as the primary implementation. PowerShell is:
- Pre-installed on Windows 10/11
- Provides atomic operations with built-in error handling
- Supports idempotent configuration checks
- Integrates cleanly with Inno Setup installer

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Inno Setup Installer                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  configure-pooling-printer.ps1                         │ │
│  │  (Main Configuration Script)                           │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Windows Print Spooler Service                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Physical Printer (e.g., "EPSON TM-T20")               │ │
│  │  Port: USB001                                          │ │
│  │  Status: Default Printer                               │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Tabeza POS Printer (Virtual)                          │ │
│  │  Ports: USB001 + TabezaCapturePort                     │ │
│  │  Driver: Same as Physical Printer                      │ │
│  │  Status: Not Default                                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              TabezaCapturePort (Local Port)                  │
│  Path: C:\TabezaPrints\order.prn                            │
│  Type: FILE                                                  │
│  Bidirectional: Enabled                                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              TabezaConnect Service                           │
│  Monitors: C:\TabezaPrints\order.prn                        │
│  Action: Upload to cloud when file changes                  │
└─────────────────────────────────────────────────────────────┘
```

### Configuration Flow

```
[Start Installer]
       │
       ▼
[Check Admin Privileges] ──No──> [Request Elevation] ──Denied──> [Exit with Error]
       │                                  │
       Yes                              Granted
       │                                  │
       ▼                                  ▼
[Verify Print Spooler Running] ────────────┘
       │
       ▼
[Detect Physical Thermal Printer]
       │
       ├──None Found──> [Display Error + Troubleshooting]
       │
       ├──Multiple Found──> [Prioritize by Keywords]
       │
       ▼
[Record Current Default Printer]
       │
       ▼
[Check if Tabeza POS Printer Exists]
       │
       ├──Yes──> [Validate Configuration] ──Valid──> [Skip Creation]
       │                  │
       │                Invalid
       │                  │
       ▼                  ▼
[Create Capture Directory] <────┘
       │
       ▼
[Configure Directory Permissions]
       │
       ▼
[Create Local Port: TabezaCapturePort]
       │
       ▼
[Get Physical Printer Driver Name]
       │
       ▼
[Create Tabeza POS Printer]
  - Driver: Same as Physical
  - Ports: Physical Port + TabezaCapturePort
  - Shared: False
       │
       ▼
[Restore Original Default Printer]
       │
       ▼
[Validate Configuration]
  - Both ports configured?
  - Physical port accessible?
  - Capture file writable?
  - Test print successful?
       │
       ├──Failed──> [Rollback Changes] ──> [Display Error]
       │
       ▼
[Log Success + Configuration Details]
       │
       ▼
[Exit Success]
```

## Components and Interfaces

### 1. Main Configuration Script

**File**: `src/installer/scripts/configure-pooling-printer.ps1`

**Purpose**: Orchestrates the entire printer configuration process

**Parameters**:
```powershell
param(
    [Parameter(Mandatory = $true)]
    [string]$CaptureFilePath,    # e.g., "C:\TabezaPrints\order.prn"
    
    [switch]$Silent,              # Suppress console output
    
    [switch]$Force                # Force reconfiguration even if exists
)
```

**Exit Codes**:
- `0`: Success (printer configured)
- `1`: Fatal error (configuration failed)
- `2`: Already configured (idempotent, treated as success)
- `3`: No thermal printer detected
- `4`: Insufficient privileges
- `5`: Print Spooler not running

**Key Functions**:

```powershell
function Write-Log {
    # Logs to console and C:\ProgramData\Tabeza\logs\configure-pooling.log
}

function Test-AdminPrivileges {
    # Returns $true if running as administrator
}

function Test-PrintSpoolerRunning {
    # Verifies Print Spooler service is running
}

function Get-ThermalPrinters {
    # Returns array of detected thermal printers
    # Excludes: PDF, Fax, OneNote, XPS printers
    # Prioritizes: Receipt, Thermal, POS, TM-, RP-, Epson, Star, Citizen, Bixolon, Sam4s
}

function Get-PrinterPortName {
    param([string]$PrinterName)
    # Returns the physical port name (e.g., USB001, LPT1)
}

function Get-PrinterDriverName {
    param([string]$PrinterName)
    # Returns the driver name used by the printer
}

function New-CaptureDirectory {
    param([string]$Path)
    # Creates directory with proper permissions for Print Spooler
}

function New-LocalCapturePort {
    param(
        [string]$PortName,
        [string]$FilePath
    )
    # Creates a local port pointing to the capture file
}

function New-TabezaPOSPrinter {
    param(
        [string]$PrinterName,
        [string]$DriverName,
        [string[]]$PortNames
    )
    # Creates the Tabeza POS Printer with multiple ports
}

function Test-PoolingConfiguration {
    param([string]$PrinterName)
    # Validates the printer configuration
    # Returns hashtable with validation results
}

function Remove-TabezaPOSPrinter {
    param([string]$PrinterName)
    # Rollback function - removes printer if configuration fails
}

function Restore-DefaultPrinter {
    param([string]$PrinterName)
    # Restores the original default printer
}
```

### 2. Printer Detection Module

**Purpose**: Identifies thermal printers and filters out non-receipt printers

**Algorithm**:
```powershell
# Step 1: Get all printers
$allPrinters = Get-Printer

# Step 2: Exclude known non-thermal printers
$excludePatterns = @(
    'Microsoft Print to PDF',
    'Microsoft XPS Document Writer',
    'Fax',
    'OneNote',
    'Adobe PDF',
    'Tabeza POS Printer'  # Don't detect our own virtual printer
)

$candidates = $allPrinters | Where-Object {
    $name = $_.Name
    $excluded = $false
    foreach ($pattern in $excludePatterns) {
        if ($name -like "*$pattern*") {
            $excluded = $true
            break
        }
    }
    -not $excluded
}

# Step 3: Prioritize by thermal printer keywords
$thermalKeywords = @(
    'Receipt', 'Thermal', 'POS', 'TM-', 'RP-',
    'Epson', 'Star', 'Citizen', 'Bixolon', 'Sam4s'
)

$scored = $candidates | ForEach-Object {
    $score = 0
    $name = $_.Name
    foreach ($keyword in $thermalKeywords) {
        if ($name -like "*$keyword*") {
            $score++
        }
    }
    [PSCustomObject]@{
        Printer = $_
        Score = $score
    }
}

# Step 4: Return highest scoring printer
$best = $scored | Sort-Object -Property Score -Descending | Select-Object -First 1
return $best.Printer
```

### 3. Port Configuration Module

**Purpose**: Creates and configures the local port for file capture

**Port Type**: Local Port (FILE type) - NOT TCP/IP
- **Creation Method**: `Add-PrinterPort -Name <PortName> -PrinterHostAddress <FilePath>`
- **Behavior**: Writes directly to a file path (each print job appends to the file)
- **Monitoring**: TabezaConnect watches file for changes
- **Important**: This is different from TCP/IP ports created with `Add-PrinterPort -Name <PortName> -PrinterHostAddress <IP> -PortNumber <Port>`

**Implementation**:
```powershell
function New-LocalCapturePort {
    param(
        [string]$PortName = 'TabezaCapturePort',
        [string]$FilePath
    )
    
    # Check if port already exists
    $existingPort = Get-PrinterPort -Name $PortName -ErrorAction SilentlyContinue
    
    if ($existingPort) {
        # Verify it points to the correct file
        if ($existingPort.PrinterHostAddress -eq $FilePath) {
            Write-Log "Port '$PortName' already exists and is correctly configured"
            return $true
        } else {
            Write-Log "Port '$PortName' exists but points to wrong path. Removing..."
            Remove-PrinterPort -Name $PortName -ErrorAction Stop
        }
    }
    
    # Create the local port (FILE type)
    # CRITICAL: PrinterHostAddress is the FILE PATH for local ports, not an IP address
    Add-PrinterPort -Name $PortName -PrinterHostAddress $FilePath -ErrorAction Stop
    
    # Note: Bidirectional support is typically enabled by default for local ports
    # No explicit configuration needed for FILE: ports
    
    Write-Log "Created local port: $PortName -> $FilePath"
    return $true
}
```

**Key Distinction**:
- **Local Port (FILE)**: `-PrinterHostAddress "C:\TabezaPrints\order.prn"` → Creates a port that writes to a file
- **TCP/IP Port**: `-PrinterHostAddress "192.168.1.100" -PortNumber 9100` → Creates a network port

In our case, we're creating a **Local Port** for the capture file.

### 4. Printer Creation Module

**Purpose**: Creates the Tabeza POS Printer with dual ports configured for pooling

**Critical Implementation Notes**:
1. **Port Order**: Create capture port FIRST using `New-LocalCapturePort`, then create printer with thermal printer port
2. **Pooling Configuration**: Use WMI to enable pooling and add multiple ports (Set-Printer doesn't support pooling directly)
3. **First Port Priority**: The thermal printer port should be first in the pool for seamless printing
4. **Port Types**: 
   - Capture port = Local Port (FILE type) created by `New-LocalCapturePort`
   - Physical port = USB/LPT/COM port from the thermal printer
   - We are NOT using TCP/IP ports for the capture port

**Implementation**:
```powershell
function New-TabezaPOSPrinter {
    param(
        [string]$PrinterName = 'Tabeza POS Printer',
        [string]$DriverName,
        [string]$PhysicalPort,          # e.g., "USB001" for thermal printer
        [string]$CapturePort            # e.g., "TabezaCapturePort" (Local Port/FILE type)
    )
    
    # Step 1: Verify driver exists
    Write-Log "Verifying driver exists: $DriverName" -Level INFO
    $driver = Get-PrinterDriver -Name $DriverName -ErrorAction SilentlyContinue
    if (-not $driver) {
        throw "Driver '$DriverName' not found. Cannot create printer."
    }
    Write-Log "Driver verified: $DriverName" -Level INFO
    
    # Step 2: Ensure capture port exists (should be created by New-LocalCapturePort first)
    Write-Log "Verifying capture port exists: $CapturePort" -Level INFO
    $capturePortObj = Get-PrinterPort -Name $CapturePort -ErrorAction SilentlyContinue
    if (-not $capturePortObj) {
        throw "Capture port '$CapturePort' not found. Create it first using New-LocalCapturePort."
    }
    Write-Log "Capture port verified: $CapturePort (Type: Local Port/FILE)" -Level INFO
    
    # Step 3: Create printer with thermal printer port as primary port
    # IMPORTANT: Use the thermal printer port first for seamless printing
    Write-Log "Creating printer '$PrinterName' with primary port '$PhysicalPort'" -Level INFO
    Add-Printer -Name $PrinterName -DriverName $DriverName -PortName $PhysicalPort -ErrorAction Stop
    Write-Log "Created printer '$PrinterName' with physical port '$PhysicalPort'" -Level INFO
    
    # Step 4: Configure printer pooling using WMI (Set-Printer doesn't support pooling)
    Write-Log "Configuring printer pooling..." -Level INFO
    
    try {
        # Get printer via WMI
        $printerWMI = Get-WmiObject -Class Win32_Printer -Filter "Name='$PrinterName'"
        
        if (-not $printerWMI) {
            throw "Could not find printer '$PrinterName' via WMI"
        }
        
        # Enable pooling and add capture port
        $printerWMI.DoCompleteFirst = $false  # Disable "Print Directly to Printer"
        $printerWMI.EnableBIDI = $true        # Enable bidirectional support
        
        # Build port list (comma-separated): thermal printer first, then capture port
        $allPorts = "$PhysicalPort,$CapturePort"
        $printerWMI.PortName = $allPorts
        
        # Apply changes
        $result = $printerWMI.Put()
        
        if ($result.ReturnValue -ne 0) {
            throw "WMI Put() failed with return value: $($result.ReturnValue)"
        }
        
        Write-Log "Printer pooling configured successfully" -Level INFO
        Write-Log "  Ports in pool: $allPorts" -Level INFO
        Write-Log "  Primary port (first): $PhysicalPort (Physical USB/LPT/COM)" -Level INFO
        Write-Log "  Capture port (second): $CapturePort (Local Port/FILE)" -Level INFO
        
    } catch {
        Write-Log "Failed to configure printer pooling: $_" -Level ERROR
        throw
    }
    
    # Step 5: Configure printer settings
    Write-Log "Configuring printer settings..." -Level INFO
    Set-Printer -Name $PrinterName -Shared $false -ErrorAction Stop
    Write-Log "Configured printer as not shared" -Level INFO
    
    # Step 6: Verify final configuration
    Write-Log "Verifying final printer configuration..." -Level INFO
    $verifyPrinter = Get-Printer -Name $PrinterName -ErrorAction Stop
    $verifyPorts = $verifyPrinter.PortName -split ','
    
    Write-Log "Verification results:" -Level INFO
    Write-Log "  Printer Name: $($verifyPrinter.Name)" -Level INFO
    Write-Log "  Driver: $($verifyPrinter.DriverName)" -Level INFO
    Write-Log "  Ports: $($verifyPrinter.PortName)" -Level INFO
    Write-Log "  Port Count: $($verifyPorts.Count)" -Level INFO
    Write-Log "  Shared: $($verifyPrinter.Shared)" -Level INFO
    
    if ($verifyPorts.Count -ne 2) {
        throw "Printer pooling verification failed: Expected 2 ports, found $($verifyPorts.Count)"
    }
    
    Write-Log "Printer creation and pooling configuration complete" -Level INFO
    return $true
}
```

**Alternative Approach Using COM Object** (if WMI approach fails):
```powershell
function New-TabezaPOSPrinterPooled {
    param(
        [string]$PrinterName,
        [string]$DriverName,
        [string]$PhysicalPort,
        [string]$CapturePort
    )
    
    # Create printer using traditional method
    $server = New-Object -ComObject "Root.MS_PrintServer"
    $printServer = $server.GetPrintServer("")
    
    # Create printer with both ports
    $portNames = @($PhysicalPort, $CapturePort)
    $printer = $printServer.CreatePrintPrinter($PrinterName, $portNames, $DriverName)
    $printer.Commit()
    
    # Configure pooling
    $printerProperty = $printer.GetProperty("PrinterData")
    $printerProperty.EnablePooling = $true
    $printerProperty.Commit()
    
    Write-Log "Pooling printer created successfully using COM" -Level INFO
}
```

**Critical Requirements for Pooling**:
1. **Multiple ports must be configured on the same printer** - this is what enables pooling
2. The primary port (thermal printer) is specified first during creation
3. Additional ports are added via WMI or COM, NOT via `Add-PrinterPort` cmdlet
4. Printer pooling distributes jobs across available printers in the pool
5. The first port should be the thermal printer for seamless printing continuation

**Note on Port Pooling**: Windows printer pooling allows a single printer to have multiple ports. Print jobs are sent to the first available port, but in our case:
- **Physical port (first)**: Ensures receipts print to the actual thermal printer seamlessly (USB/LPT/COM port)
- **Capture port (second)**: Simultaneously writes to the capture file for monitoring (Local Port/FILE type)
- Both ports receive the same print job data, enabling dual output

### 5. Validation Module

**Purpose**: Verifies the printer configuration is correct and functional

**Implementation**:
```powershell
function Test-PoolingConfiguration {
    param([string]$PrinterName)
    
    $results = @{
        PrinterExists = $false
        HasPhysicalPort = $false
        HasCapturePort = $false
        CaptureFileWritable = $false
        TestPrintSuccessful = $false
        Errors = @()
    }
    
    # Check printer exists
    $printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
    if (-not $printer) {
        $results.Errors += "Printer '$PrinterName' not found"
        return $results
    }
    $results.PrinterExists = $true
    
    # Check ports
    $ports = $printer.PortName -split ','
    $results.HasPhysicalPort = $ports | Where-Object { $_ -notlike '*Tabeza*' }
    $results.HasCapturePort = $ports | Where-Object { $_ -like '*Tabeza*' }
    
    if (-not $results.HasPhysicalPort) {
        $results.Errors += "Physical port not configured"
    }
    if (-not $results.HasCapturePort) {
        $results.Errors += "Capture port not configured"
    }
    
    # Check capture file is writable
    $capturePort = Get-PrinterPort -Name 'TabezaCapturePort' -ErrorAction SilentlyContinue
    if ($capturePort) {
        $captureFile = $capturePort.PrinterHostAddress
        try {
            $testContent = "Test write at $(Get-Date)"
            Add-Content -Path $captureFile -Value $testContent -ErrorAction Stop
            $results.CaptureFileWritable = $true
        } catch {
            $results.Errors += "Cannot write to capture file: $_"
        }
    }
    
    # Test print (optional - may be skipped if printer is offline)
    try {
        $testFile = [System.IO.Path]::GetTempFileName()
        "Test receipt" | Out-File -FilePath $testFile
        Start-Process -FilePath "notepad.exe" -ArgumentList "/p $testFile" -Wait -NoNewWindow
        $results.TestPrintSuccessful = $true
    } catch {
        # Non-fatal - printer might be offline
        $results.Errors += "Test print failed (non-fatal): $_"
    }
    
    return $results
}
```

### 6. Rollback Module

**Purpose**: Removes partial configuration if setup fails

**Implementation**:
```powershell
function Remove-TabezaPOSPrinter {
    param([string]$PrinterName)
    
    try {
        $printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
        if ($printer) {
            Remove-Printer -Name $PrinterName -ErrorAction Stop
            Write-Log "Rolled back: Removed printer '$PrinterName'"
        }
        
        $port = Get-PrinterPort -Name 'TabezaCapturePort' -ErrorAction SilentlyContinue
        if ($port) {
            Remove-PrinterPort -Name 'TabezaCapturePort' -ErrorAction Stop
            Write-Log "Rolled back: Removed port 'TabezaCapturePort'"
        }
        
        return $true
    } catch {
        Write-Log "Rollback failed: $_" 'ERROR'
        return $false
    }
}
```

### 7. Installer Integration

**File**: `installer-pkg-v1.7.0.iss` (Inno Setup script)

**Integration Point**:
```pascal
[Run]
Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\configure-pooling-printer.ps1"" -CaptureFilePath ""C:\TabezaPrints\order.prn"""; \
  StatusMsg: "Configuring Tabeza POS Printer..."; \
  Flags: runhidden waituntilterminated; \
  Check: IsAdminInstallMode

[Code]
function IsAdminInstallMode: Boolean;
begin
  Result := IsAdmin;
end;
```

**Error Handling in Installer**:
```pascal
[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
                '-ExecutionPolicy Bypass -File "' + ExpandConstant('{app}') + '\scripts\configure-pooling-printer.ps1" -CaptureFilePath "C:\TabezaPrints\order.prn"',
                '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    begin
      MsgBox('Failed to configure printer. Please run the configuration manually.', mbError, MB_OK);
    end
    else if (ResultCode <> 0) and (ResultCode <> 2) then
    begin
      MsgBox('Printer configuration returned error code: ' + IntToStr(ResultCode), mbError, MB_OK);
    end;
  end;
end;
```

## Data Models

### Printer Configuration State

```typescript
interface PrinterConfigurationState {
  // Detection phase
  physicalPrinter: {
    name: string;              // e.g., "EPSON TM-T20"
    driverName: string;        // e.g., "EPSON TM-T20 Receipt"
    portName: string;          // e.g., "USB001"
    isDefault: boolean;
  };
  
  // Configuration phase
  tabezaPrinter: {
    name: string;              // "Tabeza POS Printer"
    driverName: string;        // Same as physicalPrinter.driverName
    ports: string[];           // ["USB001", "TabezaCapturePort"]
    isDefault: boolean;        // Always false
  };
  
  // Capture configuration
  capturePort: {
    name: string;              // "TabezaCapturePort"
    filePath: string;          // "C:\TabezaPrints\order.prn"
    isWritable: boolean;
  };
  
  // Validation results
  validation: {
    printerExists: boolean;
    hasPhysicalPort: boolean;
    hasCapturePort: boolean;
    captureFileWritable: boolean;
    testPrintSuccessful: boolean;
    errors: string[];
  };
  
  // Original state (for rollback)
  originalDefaultPrinter: string | null;
}
```

### Configuration Log Entry

```typescript
interface ConfigurationLogEntry {
  timestamp: string;           // ISO 8601 format
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  context?: {
    printerName?: string;
    portName?: string;
    errorCode?: number;
    stackTrace?: string;
  };
}
```

### Printer Detection Result

```typescript
interface PrinterDetectionResult {
  found: boolean;
  printers: Array<{
    name: string;
    driverName: string;
    portName: string;
    score: number;             // Thermal printer keyword match score
    isDefault: boolean;
  }>;
  selectedPrinter: {
    name: string;
    driverName: string;
    portName: string;
  } | null;
  excludedPrinters: string[];  // Names of excluded non-thermal printers
}
```



## Error Handling

### Error Categories and Recovery Strategies

#### 1. Privilege Errors

**Scenario**: Installer runs without administrator privileges

**Detection**:
```powershell
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
```

**Recovery**:
- Exit with code 4
- Display error message: "Administrator privileges required. Please right-click the installer and select 'Run as administrator'."
- Log the error with timestamp

**Prevention**: Inno Setup should request elevation automatically via `PrivilegesRequired=admin`

#### 2. Print Spooler Errors

**Scenario**: Print Spooler service is not running

**Detection**:
```powershell
$spooler = Get-Service -Name 'Spooler' -ErrorAction SilentlyContinue
if ($spooler.Status -ne 'Running') {
    throw "Print Spooler service is not running"
}
```

**Recovery**:
- Attempt to start the service: `Start-Service -Name 'Spooler'`
- If start fails, exit with code 5
- Display error message: "Windows Print Spooler service is not running. Please start the service and try again."
- Provide troubleshooting steps:
  1. Open Services (services.msc)
  2. Find "Print Spooler"
  3. Right-click → Start
  4. Set Startup Type to "Automatic"

#### 3. Printer Detection Errors

**Scenario**: No thermal printer detected

**Detection**: `Get-ThermalPrinters` returns empty array

**Recovery**:
- Exit with code 3
- Display detailed error message with troubleshooting:
  ```
  No thermal printer detected.
  
  Troubleshooting steps:
  1. Ensure your thermal printer is connected via USB or network
  2. Install the printer driver from the manufacturer
  3. Verify the printer appears in Windows Settings → Devices → Printers
  4. Ensure the printer is not named with excluded keywords (PDF, Fax, OneNote, XPS)
  
  Detected printers:
  - [List all detected printers]
  
  If your thermal printer is in the list above, please contact support.
  ```

**Logging**: Log all detected printers with their scores for diagnostic purposes

#### 4. Driver Compatibility Errors

**Scenario**: Physical printer uses a driver that cannot be reused

**Detection**:
```powershell
$driver = Get-PrinterDriver -Name $driverName -ErrorAction SilentlyContinue
if (-not $driver) {
    throw "Driver '$driverName' not found"
}
```

**Recovery**:
- Exit with code 1
- Display error message: "Printer driver '$driverName' is not available. The Tabeza POS Printer cannot be created without this driver."
- Provide instructions:
  1. Reinstall the physical printer driver
  2. Verify the driver is listed in: Control Panel → Devices and Printers → Print server properties → Drivers
  3. Re-run the TabezaConnect installer

**Fallback**: Consider using "Generic / Text Only" driver if physical printer driver is unavailable (with user confirmation)

#### 5. Port Creation Errors

**Scenario**: Cannot create local port or capture directory

**Detection**:
```powershell
try {
    Add-PrinterPort -Name $portName -PrinterHostAddress $filePath -ErrorAction Stop
} catch {
    throw "Failed to create printer port: $_"
}
```

**Recovery**:
- Attempt to remove existing port and recreate
- If directory creation fails, check disk space and permissions
- Exit with code 1 if unrecoverable
- Display error message with specific path and error details
- Log full exception stack trace

**Rollback**: Remove any partially created ports

#### 6. Printer Creation Errors

**Scenario**: `Add-Printer` cmdlet fails

**Detection**: Exception thrown by `Add-Printer`

**Recovery**:
- Log the full error message and stack trace
- Attempt rollback: Remove any created ports
- Exit with code 1
- Display error message: "Failed to create Tabeza POS Printer: [error details]"
- Suggest manual configuration as fallback

**Common Causes**:
- Driver not found
- Port not accessible
- Printer name already exists (should be caught by idempotency check)
- Insufficient permissions

#### 7. Validation Errors

**Scenario**: Configuration validation fails after creation

**Detection**: `Test-PoolingConfiguration` returns errors

**Recovery Strategy**:
```powershell
$validation = Test-PoolingConfiguration -PrinterName 'Tabeza POS Printer'

if ($validation.Errors.Count -gt 0) {
    Write-Log "Validation failed with errors:" 'ERROR'
    foreach ($error in $validation.Errors) {
        Write-Log "  - $error" 'ERROR'
    }
    
    # Attempt to fix common issues
    if (-not $validation.CaptureFileWritable) {
        # Try to fix permissions
        Grant-CaptureFilePermissions -Path $captureFilePath
        
        # Re-validate
        $validation = Test-PoolingConfiguration -PrinterName 'Tabeza POS Printer'
    }
    
    # If still failing, rollback
    if ($validation.Errors.Count -gt 0) {
        Write-Log "Validation still failing after attempted fixes. Rolling back..." 'ERROR'
        Remove-TabezaPOSPrinter -PrinterName 'Tabeza POS Printer'
        exit 1
    }
}
```

**Non-Fatal Errors**:
- Test print failure (printer might be offline)
- Physical port not accessible (printer might be disconnected)

These are logged as warnings but don't fail the installation.

#### 8. Default Printer Restoration Errors

**Scenario**: Cannot restore original default printer

**Detection**:
```powershell
try {
    (New-Object -ComObject WScript.Network).SetDefaultPrinter($originalDefaultPrinter)
} catch {
    Write-Log "Failed to restore default printer: $_" 'WARN'
}
```

**Recovery**:
- Log as warning (non-fatal)
- Display message to user: "Note: Your default printer may have changed. Please verify in Windows Settings."
- Continue with installation

**Rationale**: This is a minor inconvenience, not a critical failure

### Error Logging Format

All errors are logged to: `C:\ProgramData\Tabeza\logs\configure-pooling.log`

**Log Entry Format**:
```
[2026-02-28 14:32:15][ERROR] Failed to create printer port
  Context:
    PortName: TabezaCapturePort
    FilePath: C:\TabezaPrints\order.prn
    ErrorCode: 0x80070005
    Exception: Access is denied
    StackTrace: at Add-PrinterPort ...
```

**Log Rotation**: Logs are appended, not rotated. Maximum size: 10MB (after which oldest entries are truncated)

### User-Facing Error Messages

All error messages follow this template:

```
❌ Configuration Failed: [Brief Description]

Details:
[Specific error information]

Troubleshooting Steps:
1. [First step]
2. [Second step]
3. [Third step]

For support, please provide the log file:
C:\ProgramData\Tabeza\logs\configure-pooling.log
```

### Rollback Guarantees

The configuration script guarantees atomic operations:

1. **Before any changes**: Record current state (default printer, existing printers)
2. **During configuration**: Track all created resources (ports, printers)
3. **On failure**: Remove all created resources in reverse order
4. **After rollback**: Verify system is in original state

**Rollback Order**:
1. Remove Tabeza POS Printer (if created)
2. Remove TabezaCapturePort (if created)
3. Restore original default printer
4. Log rollback completion

**Idempotency**: Rollback can be safely called multiple times

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure correctness:

- **Unit tests**: Verify specific scenarios, edge cases, and error conditions
- **Property-based tests**: Verify universal properties across all valid configurations

Together, these provide comprehensive coverage where unit tests catch concrete bugs and property tests verify general correctness.

### Unit Testing

**Framework**: Pester (PowerShell testing framework)

**Test File**: `src/installer/scripts/__tests__/configure-pooling-printer.tests.ps1`

**Test Categories**:

1. **Printer Detection Tests**
   - Test with no printers installed
   - Test with only PDF/Fax printers (should fail)
   - Test with single thermal printer (should succeed)
   - Test with multiple thermal printers (should prioritize correctly)
   - Test with Tabeza POS Printer already existing (should exclude it)

2. **Port Configuration Tests**
   - Test creating new local port
   - Test with existing port pointing to correct path (idempotent)
   - Test with existing port pointing to wrong path (should recreate)
   - Test with invalid file path (should fail gracefully)
   - Test with insufficient permissions (should fail with clear error)

3. **Printer Creation Tests**
   - Test creating printer with valid driver
   - Test creating printer with missing driver (should fail)
   - Test creating printer when it already exists (idempotent)
   - Test dual port configuration (physical + capture)

4. **Validation Tests**
   - Test validation with correct configuration
   - Test validation with missing physical port
   - Test validation with missing capture port
   - Test validation with unwritable capture file

5. **Rollback Tests**
   - Test rollback after port creation failure
   - Test rollback after printer creation failure
   - Test rollback after validation failure
   - Test rollback is idempotent (can be called multiple times)

6. **Default Printer Preservation Tests**
   - Test recording default printer before configuration
   - Test restoring default printer after configuration
   - Test handling when no default printer exists
   - Test handling when default printer is the physical printer being mirrored

7. **Error Handling Tests**
   - Test behavior without admin privileges
   - Test behavior with Print Spooler stopped
   - Test behavior with invalid capture file path
   - Test error message formatting

**Example Unit Test**:
```powershell
Describe "Printer Detection" {
    Context "When no thermal printers exist" {
        It "Should return empty array" {
            Mock Get-Printer { return @(
                [PSCustomObject]@{ Name = 'Microsoft Print to PDF' }
                [PSCustomObject]@{ Name = 'Fax' }
            )}
            
            $result = Get-ThermalPrinters
            $result | Should -BeNullOrEmpty
        }
    }
    
    Context "When multiple thermal printers exist" {
        It "Should prioritize by keyword score" {
            Mock Get-Printer { return @(
                [PSCustomObject]@{ Name = 'Generic Printer' }
                [PSCustomObject]@{ Name = 'EPSON TM-T20 Receipt' }
                [PSCustomObject]@{ Name = 'Star TSP100' }
            )}
            
            $result = Get-ThermalPrinters
            $result[0].Name | Should -Be 'EPSON TM-T20 Receipt'
        }
    }
}
```

### Property-Based Testing

**Framework**: Pester with custom property generators

**Test File**: `src/installer/scripts/__tests__/configure-pooling-printer.properties.tests.ps1`

**Property Test Configuration**:
- Minimum 100 iterations per property test
- Each test references its design document property
- Tag format: `Feature: auto-configure-tabeza-pooling-printer, Property {number}: {property_text}`

**Property Test Generators**:

```powershell
# Generator for random printer names
function New-RandomPrinterName {
    $prefixes = @('EPSON', 'Star', 'Citizen', 'Bixolon', 'Generic')
    $models = @('TM-T20', 'TSP100', 'CT-S310', 'SRP-350', 'Thermal')
    $suffixes = @('Receipt', 'POS', 'Printer', '')
    
    $prefix = Get-Random -InputObject $prefixes
    $model = Get-Random -InputObject $models
    $suffix = Get-Random -InputObject $suffixes
    
    return "$prefix $model $suffix".Trim()
}

# Generator for random port names
function New-RandomPortName {
    $types = @('USB', 'LPT', 'COM', 'IP')
    $type = Get-Random -InputObject $types
    
    switch ($type) {
        'USB' { return "USB$(Get-Random -Minimum 1 -Maximum 10):001" }
        'LPT' { return "LPT$(Get-Random -Minimum 1 -Maximum 3):" }
        'COM' { return "COM$(Get-Random -Minimum 1 -Maximum 10):" }
        'IP' { return "IP_$(Get-Random -Minimum 1 -Maximum 255).$(Get-Random -Minimum 1 -Maximum 255).$(Get-Random -Minimum 1 -Maximum 255).$(Get-Random -Minimum 1 -Maximum 255)" }
    }
}

# Generator for random file paths
function New-RandomCapturePath {
    $drives = @('C:', 'D:', 'E:')
    $folders = @('TabezaPrints', 'Captures', 'PrintData', 'Receipts')
    $files = @('order.prn', 'receipt.prn', 'capture.txt', 'print.dat')
    
    $drive = Get-Random -InputObject $drives
    $folder = Get-Random -InputObject $folders
    $file = Get-Random -InputObject $files
    
    return "$drive\$folder\$file"
}
```

**Note**: Properties will be defined after completing the prework analysis in the next section.

### Integration Testing

**Test Environment**: Windows 10/11 VM with clean state

**Test Scenarios**:

1. **Fresh Installation**
   - Clean Windows installation
   - Install thermal printer driver
   - Run TabezaConnect installer
   - Verify Tabeza POS Printer is created
   - Verify default printer is preserved
   - Send test print job
   - Verify capture file is updated

2. **Upgrade Installation**
   - Existing TabezaConnect v1.6.x installed
   - Run TabezaConnect v1.7.0 installer
   - Verify existing configuration is preserved
   - Verify idempotent behavior (no duplicates)

3. **Multiple Printers**
   - Install 3 different thermal printers
   - Run installer
   - Verify correct printer is selected
   - Verify other printers are not affected

4. **Error Recovery**
   - Simulate Print Spooler stopped
   - Run installer
   - Verify error message is clear
   - Start Print Spooler
   - Re-run installer
   - Verify success

5. **Rollback Scenario**
   - Modify script to fail after printer creation
   - Run installer
   - Verify printer is removed (rollback)
   - Verify ports are removed (rollback)
   - Verify system is in original state

### Manual Testing Checklist

Before release, manually verify:

- [ ] Installer runs on Windows 10 (21H2)
- [ ] Installer runs on Windows 11 (22H2)
- [ ] Works with EPSON TM-T20 printer
- [ ] Works with Star TSP100 printer
- [ ] Works with generic thermal printer
- [ ] Default printer is preserved after installation
- [ ] Test print to physical printer succeeds
- [ ] Test print to Tabeza POS Printer updates capture file
- [ ] TabezaConnect service detects captured print jobs
- [ ] Re-running installer is idempotent (no errors)
- [ ] Uninstaller removes Tabeza POS Printer
- [ ] Error messages are clear and actionable
- [ ] Log file contains useful diagnostic information

### Performance Testing

**Metrics to Measure**:

- Configuration time: Should complete in < 10 seconds
- Printer detection time: Should complete in < 2 seconds
- Port creation time: Should complete in < 1 second
- Validation time: Should complete in < 3 seconds

**Performance Test**:
```powershell
Measure-Command {
    & .\configure-pooling-printer.ps1 -CaptureFilePath "C:\TabezaPrints\order.prn" -Silent
}
```

**Acceptance Criteria**: Total configuration time < 10 seconds on standard hardware



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified several areas of redundancy:

**Redundancy Group 1: Default Printer Preservation**
- Property 4.2 (restore default printer after configuration) and 4.3 (verify default printer unchanged) test the same round-trip behavior
- Property 7.5 (maintain default printer during reconfiguration) is also the same test
- **Resolution**: Combine into single comprehensive property about default printer round-trip

**Redundancy Group 2: Logging Properties**
- Properties 12.1, 12.2, 12.3, 12.5, 12.6 all test that various operations are logged
- **Resolution**: Combine into single property that all configuration operations are logged with appropriate detail

**Redundancy Group 3: Port Configuration**
- Properties 2.3 (two ports configured) and 6.1 (verify both ports) test the same invariant
- **Resolution**: Combine into single property about dual-port configuration

**Redundancy Group 4: Idempotency**
- Properties 2.5 (skip creation if exists), 7.1 (verify existing configuration), and 7.3 (no duplicates) all relate to idempotent behavior
- **Resolution**: Combine into comprehensive idempotency property

After eliminating redundancy, the following properties provide unique validation value:

### Property 1: Thermal Printer Detection Exclusion

*For any* set of installed printers, the detection algorithm should exclude all printers matching excluded patterns (Microsoft Print to PDF, Fax, OneNote, XPS, Adobe PDF) and return only thermal/receipt printers.

**Validates: Requirements 1.1, 1.2**

### Property 2: Thermal Printer Prioritization

*For any* set of detected thermal printers, the printer with the highest keyword match score (Receipt, Thermal, POS, TM-, RP-, Epson, Star, Citizen, Bixolon, Sam4s) should be selected as the physical printer.

**Validates: Requirements 1.3**

### Property 3: Printer Detection Round-Trip

*For any* detected physical printer, the stored printer name and port information should match the values returned by querying the Windows print system for that printer.

**Validates: Requirements 1.4**

### Property 4: Driver Inheritance

*For any* physical printer with driver D, the created Tabeza POS Printer should use the same driver D.

**Validates: Requirements 2.2**

### Property 5: Dual-Port Configuration

*For any* created Tabeza POS Printer, it should have exactly two ports configured: the physical port from the source printer and the TabezaCapturePort local port.

**Validates: Requirements 2.3, 6.1**

### Property 6: Local Port File Path

*For any* created TabezaCapturePort, its PrinterHostAddress property should point to the specified capture file path.

**Validates: Requirements 2.4, 3.4**

### Property 7: Configuration Idempotency

*For any* system state, running the configuration script twice should produce identical results: if the Tabeza POS Printer exists after the first run, the second run should verify the configuration and exit successfully without creating duplicates.

**Validates: Requirements 2.5, 7.1, 7.3**

### Property 8: Printer Sharing Disabled

*For any* created Tabeza POS Printer, its Shared property should be false (not shared on the network).

**Validates: Requirements 2.6**

### Property 9: Capture Directory Creation

*For any* capture file path with a non-existent parent directory, the system should create the directory before creating the local port.

**Validates: Requirements 3.1, 3.2**

### Property 10: Print Spooler Permissions

*For any* created capture directory, the Print Spooler service (NT AUTHORITY\SYSTEM or NETWORK SERVICE) should have write permissions to the directory.

**Validates: Requirements 3.3**

### Property 11: Port Configuration Idempotency

*For any* existing TabezaCapturePort, if it points to the correct capture file path, the system should reuse it; if it points to an incorrect path, the system should remove and recreate it with the correct path.

**Validates: Requirements 3.5**

### Property 12: Default Printer Round-Trip

*For any* system with a default printer D before configuration, after running the configuration script, the default printer should still be D (not the Tabeza POS Printer).

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 7.5**

### Property 13: Capture File Update on Print

*For any* print job sent to the Tabeza POS Printer, the capture file should be modified (size increased or modification timestamp updated).

**Validates: Requirements 5.3**

### Property 14: Local Port Writability

*For any* configured TabezaCapturePort, the Print Spooler service should be able to write test data to the capture file path.

**Validates: Requirements 6.3**

### Property 15: Validation Error Messages

*For any* validation failure (missing port, unwritable file, etc.), the system should generate a specific error message identifying which component failed.

**Validates: Requirements 6.5**

### Property 16: Configuration Self-Healing

*For any* existing Tabeza POS Printer with incorrect configuration (wrong ports, wrong driver), running the configuration script should detect and correct the configuration.

**Validates: Requirements 7.2**

### Property 17: Capture Data Preservation

*For any* existing capture file with data, reconfiguring the printer should not delete or truncate the file contents.

**Validates: Requirements 7.4**

### Property 18: Configuration Rollback

*For any* configuration failure after partial changes (port created but printer creation fails), the system should remove all created resources and return to the original state.

**Validates: Requirements 8.4**

### Property 19: Comprehensive Error Logging

*For any* configuration operation (detection, creation, validation, rollback), all steps and results should be logged to C:\ProgramData\Tabeza\logs\configure-pooling.log with timestamps and appropriate detail level (INFO, WARN, ERROR).

**Validates: Requirements 6.6, 8.5, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6**

### Property 20: Printer Settings Preservation

*For any* physical printer with settings S (paper size, margins, print quality), the created Tabeza POS Printer should inherit the same settings S.

**Validates: Requirements 10.5**

### Property 21: Admin Privilege Precondition

*For any* configuration attempt, the system should verify administrator privileges before attempting to create printers or ports, and fail with exit code 4 if privileges are insufficient.

**Validates: Requirements 11.2**

### Edge Cases and Examples

The following scenarios should be tested as specific examples rather than universal properties:

**Edge Case 1: No Thermal Printers Detected**
- Given: System with only PDF/Fax printers
- Expected: Exit code 3, error message with troubleshooting steps
- **Validates: Requirements 1.5**

**Edge Case 2: Physical Printer Offline**
- Given: Tabeza POS Printer configured, physical printer disconnected
- Expected: Capture file still updates when printing to Tabeza POS Printer
- **Validates: Requirements 5.5**

**Example 1: Insufficient Permissions Error**
- Given: Script runs without admin privileges
- Expected: Exit code 4, error message requesting elevation
- **Validates: Requirements 8.1, 11.3**

**Example 2: Missing Driver Error**
- Given: Physical printer driver not installed
- Expected: Exit code 1, error message with driver installation instructions
- **Validates: Requirements 8.2**

**Example 3: Directory Creation Failure**
- Given: Capture file path on read-only drive
- Expected: Exit code 1, error message with specific path and permission issue
- **Validates: Requirements 8.3**

**Example 4: Test Print Validation**
- Given: Configured Tabeza POS Printer
- When: Send test print job
- Expected: Capture file is updated
- **Validates: Requirements 6.4**

### Property Test Implementation Notes

Each property test should:
1. Run minimum 100 iterations with randomized inputs
2. Include a comment tag: `# Feature: auto-configure-tabeza-pooling-printer, Property {number}: {property_text}`
3. Use the property generators defined in the Testing Strategy section
4. Mock Windows API calls (Get-Printer, Add-Printer, etc.) to avoid requiring actual printer hardware
5. Verify the property holds across all generated test cases

Example property test structure:
```powershell
Describe "Property 2: Thermal Printer Prioritization" -Tag "Property" {
    # Feature: auto-configure-tabeza-pooling-printer, Property 2: Thermal Printer Prioritization
    
    It "Should select highest scoring printer across 100 random printer sets" {
        1..100 | ForEach-Object {
            # Generate random set of thermal printers
            $printers = 1..(Get-Random -Minimum 2 -Maximum 5) | ForEach-Object {
                New-RandomThermalPrinter
            }
            
            Mock Get-Printer { return $printers }
            
            # Run detection
            $result = Get-ThermalPrinters
            
            # Verify highest scoring printer was selected
            $scores = $printers | ForEach-Object { Get-KeywordScore $_.Name }
            $maxScore = ($scores | Measure-Object -Maximum).Maximum
            $selectedScore = Get-KeywordScore $result.Name
            
            $selectedScore | Should -Be $maxScore
        }
    }
}
```

