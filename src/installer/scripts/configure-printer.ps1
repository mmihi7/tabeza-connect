# Configure Tabeza Virtual Printer
# Creates Generic/Text Only printer with FILE: port for receipt capture

param(
    [string]$WatchFolder = "C:\TabezaPrints",
    [switch]$SkipIfExists
)

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Tabeza Connect - Printer Setup       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ This script must be run as Administrator" -ForegroundColor Red
    Write-Host ""
    Write-Host "Right-click PowerShell and select 'Run as administrator'" -ForegroundColor Yellow
    exit 1
}

$printerName = "Tabeza Receipt Printer"

# Check if printer already exists
$existingPrinter = Get-Printer -Name $printerName -ErrorAction SilentlyContinue

if ($existingPrinter) {
    if ($SkipIfExists) {
        Write-Host "✅ Tabeza printer already exists - skipping" -ForegroundColor Green
        exit 0
    }
    
    Write-Host "⚠️  Tabeza printer already exists" -ForegroundColor Yellow
    $response = Read-Host "Remove and recreate? (y/n)"
    
    if ($response -eq 'y') {
        Write-Host "Removing existing printer..." -ForegroundColor Gray
        Remove-Printer -Name $printerName -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    } else {
        Write-Host "Keeping existing printer" -ForegroundColor Gray
        exit 0
    }
}

Write-Host "Step 1: Detecting physical printers..." -ForegroundColor Cyan

# Run printer detection
$detectionScript = Join-Path $PSScriptRoot "detect-printers.ps1"
if (Test-Path $detectionScript) {
    & $detectionScript
} else {
    Write-Host "  ⚠️  Printer detection script not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 2: Installing Generic/Text Only driver..." -ForegroundColor Cyan

# Check if Generic/Text Only driver exists
$driver = Get-PrinterDriver -Name "Generic / Text Only" -ErrorAction SilentlyContinue

if (-not $driver) {
    try {
        Add-PrinterDriver -Name "Generic / Text Only" -ErrorAction Stop
        Write-Host "  ✅ Driver installed" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Failed to install driver: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "The Generic/Text Only driver should be built into Windows." -ForegroundColor Yellow
        Write-Host "If this fails, you may need to:" -ForegroundColor Yellow
        Write-Host "  1. Check Windows Update for printer drivers" -ForegroundColor Gray
        Write-Host "  2. Manually add the driver through Control Panel" -ForegroundColor Gray
        exit 1
    }
} else {
    Write-Host "  ✅ Driver already installed" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 3: Creating watch folder..." -ForegroundColor Cyan

# Create watch folder
if (-not (Test-Path $WatchFolder)) {
    try {
        New-Item -ItemType Directory -Path $WatchFolder -Force | Out-Null
        Write-Host "  ✅ Created: $WatchFolder" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Failed to create folder: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  ✅ Folder exists: $WatchFolder" -ForegroundColor Green
}

# Create subfolders
$subfolders = @("processed", "errors")
foreach ($subfolder in $subfolders) {
    $subfolderPath = Join-Path $WatchFolder $subfolder
    if (-not (Test-Path $subfolderPath)) {
        New-Item -ItemType Directory -Path $subfolderPath -Force | Out-Null
        Write-Host "  ✅ Created: $subfolder\" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Step 4: Creating virtual printer..." -ForegroundColor Cyan

# Add printer with FILE: port
try {
    Add-Printer -Name $printerName -DriverName "Generic / Text Only" -PortName "FILE:" -ErrorAction Stop
    Write-Host "  ✅ Printer created: $printerName" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Failed to create printer: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 5: Configuring FILE: port default path..." -ForegroundColor Cyan

# Set registry key for FILE: port default path
# This makes the FILE: port save to our watch folder by default
$regPath = "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Devices"

try {
    # Ensure registry path exists
    if (-not (Test-Path $regPath)) {
        New-Item -Path $regPath -Force | Out-Null
    }
    
    # Set printer port configuration
    # Format: "winspool,FILE:,C:\TabezaPrints"
    $portConfig = "winspool,FILE:,$WatchFolder"
    Set-ItemProperty -Path $regPath -Name $printerName -Value $portConfig -ErrorAction Stop
    
    Write-Host "  ✅ Default save path configured" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  Could not set default path: $_" -ForegroundColor Yellow
    Write-Host "  Users will be prompted for save location on first print" -ForegroundColor Gray
}

Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Printer Setup Complete!               ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Printer Name: $printerName" -ForegroundColor White
Write-Host "  Watch Folder: $WatchFolder" -ForegroundColor White
Write-Host "  Port: FILE:" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Configure your POS to print to '$printerName'" -ForegroundColor White
Write-Host "  2. Set it as a SECONDARY printer (keep your physical printer as primary)" -ForegroundColor White
Write-Host "  3. Test by printing a receipt from your POS" -ForegroundColor White
Write-Host ""
Write-Host "The Tabeza service will monitor $WatchFolder for new receipts." -ForegroundColor Gray
Write-Host ""

exit 0
