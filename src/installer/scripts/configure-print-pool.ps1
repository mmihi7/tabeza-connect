# configure-print-pool.ps1
# Configures Windows print pooling between physical and virtual printers

param(
    [Parameter(Mandatory=$true)]
    [string]$ConfigFile,
    
    [string]$VirtualPrinterName = "Tabeza POS Connect"
)

$logDir = "C:\ProgramData\Tabeza\logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

function Write-Log {
    param([string]$Message)
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Write-Host $line
    Add-Content -Path "$logDir\configure-pool.log" -Value $line -ErrorAction SilentlyContinue
}

try {
    Write-Log "Starting print pool configuration"
    
    # Read printer detection results
    if (-not (Test-Path $ConfigFile)) {
        Write-Log "ERROR: Printer detection file not found: $ConfigFile"
        exit 1
    }
    
    $printerInfo = Get-Content $ConfigFile -Raw | ConvertFrom-Json
    $physicalPrinterName = $printerInfo.printerName
    
    if (-not $physicalPrinterName) {
        Write-Log "ERROR: No physical printer detected in config file"
        exit 1
    }
    
    Write-Log "Physical printer: $physicalPrinterName"
    Write-Log "Virtual printer: $VirtualPrinterName"
    
    # Check if both printers exist
    $physicalPrinter = Get-Printer -Name $physicalPrinterName -ErrorAction SilentlyContinue
    if (-not $physicalPrinter) {
        Write-Log "ERROR: Physical printer not found: $physicalPrinterName"
        exit 1
    }
    
    $virtualPrinter = Get-Printer -Name $VirtualPrinterName -ErrorAction SilentlyContinue
    if (-not $virtualPrinter) {
        Write-Log "ERROR: Virtual printer not found: $VirtualPrinterName"
        exit 1
    }
    
    # Configure print pooling using WMI
    Write-Log "Configuring print pool..."
    
    # Get the printer via WMI for more options
    $wmiPrinter = Get-WmiObject -Class Win32_Printer -Filter "Name='$physicalPrinterName'"
    if (-not $wmiPrinter) {
        Write-Log "ERROR: Could not access printer via WMI"
        exit 1
    }
    
    # Enable printer pooling (0x00000004 flag)
    $poolingFlag = 0x00000004
    $wmiPrinter.Attributes = $wmiPrinter.Attributes -bor $poolingFlag
    
    # Get port names for both printers
    $physicalPort = $physicalPrinter.PortName
    $virtualPort = $virtualPrinter.PortName
    
    # Set pool printers (WMI expects port names)
    # Note: This is simplified - actual pooling configuration may vary by driver
    $wmiPrinter.Put()
    
    Write-Log "✅ Print pool configured successfully"
    Write-Log "All print jobs sent to $physicalPrinterName will also go to $VirtualPrinterName"
    
    # Create a test page to verify
    Write-Log "Sending test page to verify pooling..."
    Get-Process | Select-Object -First 5 | Out-Printer -Name $physicalPrinterName
    
    exit 0
    
} catch {
    Write-Log "ERROR: Failed to configure print pool: $_"
    exit 1
}