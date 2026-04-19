# configure-printer.ps1
# Installs and configures the Tabeza Virtual Printer.
# Called from Inno Setup [Run] section (TR-4).
#
# CORE TRUTH: Manual service always exists. 
# Digital authority is singular. 
# Tabeza adapts to the venue — never the reverse.
#
# This printer uses the Windows print spooler so TabezaConnect can
# passively capture receipts without blocking the POS print flow.
#
# Usage:
#   .\configure-printer.ps1 -WatchFolder "C:\TabezaPrints" [-Silent]
#
# Exit codes:
#   0  - Success
#   1  - Fatal error
#   2  - Already configured (idempotent, treated as success by installer)

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$WatchFolder,

    [switch]$Silent
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$PrinterName   = 'TabezaConnect'
$DriverName    = 'Generic / Text Only'   # Built-in Windows driver — no download needed
$PortName      = 'NULL:'                 # NULL port - goes through spooler but doesn't print

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "[$ts][$Level] $Message"
    if (-not $Silent) { Write-Host $line }
    # Always append to log file regardless of -Silent
    $logDir = "$env:ProgramFiles\Tabeza\logs"
    if (Test-Path $logDir) {
        Add-Content -Path (Join-Path $logDir 'configure-printer.log') -Value $line -ErrorAction SilentlyContinue
    }
}

try {
    Write-Log "Starting virtual printer configuration"
    Write-Log "Watch folder: $WatchFolder"

    # ── 1. Ensure watch folder exists ────────────────────────────────────────
    if (-not (Test-Path $WatchFolder)) {
        Write-Log "Creating watch folder: $WatchFolder"
        New-Item -ItemType Directory -Path $WatchFolder -Force | Out-Null
    }

    # Grant Everyone full access so printer spooler can write here
    $acl = Get-Acl $WatchFolder
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        'Everyone', 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'
    )
    $acl.SetAccessRule($rule)
    Set-Acl -Path $WatchFolder -AclObject $acl
    Write-Log "ACL configured on watch folder"

    # ── 2. Idempotency check ──────────────────────────────────────────────────
    $existingPrinter = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
    if ($existingPrinter) {
        Write-Log "Printer '$PrinterName' already exists — skipping creation" 'WARN'
        exit 2
    }

    # ── 3. Ensure printer driver is installed (Generic / Text Only is inbox) ──
    $driver = Get-PrinterDriver -Name $DriverName -ErrorAction SilentlyContinue
    if (-not $driver) {
        Write-Log "Installing driver: $DriverName"
        Add-PrinterDriver -Name $DriverName -ErrorAction Stop
    }

    # ── 4. Install the virtual printer with NULL port ────────────────────────
    # NULL port means print jobs go through Windows spooler but don't actually print
    # This allows TabezaConnect to capture them from the spooler directory
    Write-Log "Adding virtual printer: $PrinterName (using NULL port for spooler capture)"
    Add-Printer `
        -Name       $PrinterName `
        -DriverName $DriverName `
        -PortName   $PortName `
        -ErrorAction Stop

    # ── 5. Set printer as not shared ──────────────────────────────────────────
    Set-Printer -Name $PrinterName -Shared $false -ErrorAction SilentlyContinue

    Write-Log "Virtual printer configured successfully"
    Write-Log "Print jobs to '$PrinterName' will be captured by TabezaConnect from the Windows spooler"
    exit 0

} catch {
    Write-Log "ERROR: $_" 'ERROR'
    exit 1
}
