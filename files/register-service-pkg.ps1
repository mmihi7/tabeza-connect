# Register Tabeza Connect as Windows Service (PKG Version - v1.7.0)
# Configures automatic startup and recovery settings
# Uses compiled TabezaConnect.exe directly (no wrapper needed)
#
# FIX v1.7.0: Added -WatchFolder parameter. Previously the script hardcoded
# C:\TabezaPrints but the actual watch folder is C:\ProgramData\Tabeza\TabezaPrints.
# The installer now passes the correct path explicitly.

param(
    [string]$InstallPath = "C:\Program Files\TabezaConnect",
    [string]$BarId,
    [string]$ApiUrl = "https://tabeza.co.ke",
    [string]$WatchFolder = "C:\ProgramData\Tabeza\TabezaPrints",
    [switch]$Uninstall
)

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Tabeza Connect - Service Setup (PKG)" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[ERROR] This script must be run as Administrator" -ForegroundColor Red
    exit 1
}

$serviceName = "TabezaConnect"
$displayName = "TabezaConnect"
$description = "Captures receipt data from POS and syncs with Tabeza staff app"

# Check if service exists
$existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

if ($Uninstall) {
    if ($existingService) {
        Write-Host "Stopping service..." -ForegroundColor Yellow
        Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Host "Removing service..." -ForegroundColor Yellow
        sc.exe delete $serviceName
        Write-Host "[SUCCESS] Service uninstalled" -ForegroundColor Green
    } else {
        Write-Host "Service not found - nothing to uninstall" -ForegroundColor Gray
    }
    exit 0
}

# Validate required parameters
if (-not $BarId) {
    Write-Host "[ERROR] Bar ID is required" -ForegroundColor Red
    Write-Host ""
    Write-Host "Usage: .\register-service-pkg.ps1 -BarId YOUR-BAR-ID" -ForegroundColor Yellow
    exit 1
}

# Validate install path - PKG version uses TabezaConnect.exe
$exePath = Join-Path $InstallPath "TabezaConnect.exe"

if (-not (Test-Path $exePath)) {
    Write-Host "[ERROR] TabezaConnect.exe not found at: $exePath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please ensure Tabeza Connect is installed correctly."
    exit 1
}

Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Install Path:  $InstallPath" -ForegroundColor White
Write-Host "  Executable:    TabezaConnect.exe" -ForegroundColor White
Write-Host "  Bar ID:        $BarId" -ForegroundColor White
Write-Host "  API URL:       $ApiUrl" -ForegroundColor White
Write-Host "  Watch Folder:  $WatchFolder" -ForegroundColor White
Write-Host ""

# Remove existing service if it exists
if ($existingService) {
    Write-Host "Existing service found, ensuring clean removal..." -ForegroundColor Yellow

    if ($existingService.Status -eq 'Running') {
        Write-Host "  Stopping service..." -ForegroundColor Gray
        Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }

    Write-Host "  Removing service registration..." -ForegroundColor Gray
    sc.exe delete $serviceName | Out-Null
    Start-Sleep -Seconds 2
    Write-Host "  [SUCCESS] Old service removed" -ForegroundColor Green
} else {
    Write-Host "No existing service found (clean installation)" -ForegroundColor Gray
}

Write-Host "Creating Windows service..." -ForegroundColor Cyan

# Register .exe directly
$binaryPath = "`"$exePath`""

Write-Host "  Creating service..." -ForegroundColor Gray
sc.exe create $serviceName binPath= $binaryPath DisplayName= $displayName start= auto

if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Failed to create service (exit code: $LASTEXITCODE)" -ForegroundColor Red
    exit 1
}

Write-Host "  [SUCCESS] Service created" -ForegroundColor Green

# Set service description
sc.exe description $serviceName $description | Out-Null

# Configure service recovery (restart on failure)
Write-Host "  Configuring automatic recovery..." -ForegroundColor Gray
sc.exe failure $serviceName reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null
Write-Host "  [SUCCESS] Recovery configured" -ForegroundColor Green

# Set service to run as LocalSystem
Write-Host "  Setting service account..." -ForegroundColor Gray
sc.exe config $serviceName obj= "LocalSystem" | Out-Null
Write-Host "  [SUCCESS] Service account: LocalSystem" -ForegroundColor Green

# CRITICAL: Set environment variables in registry
Write-Host "  Setting environment variables..." -ForegroundColor Gray

$regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\$serviceName"
if (Test-Path $regPath) {
    $envPath = "$regPath\Environment"
    if (-not (Test-Path $envPath)) {
        New-Item -Path $envPath -Force | Out-Null
    }

    New-ItemProperty -Path $envPath -Name "TABEZA_BAR_ID"      -Value $BarId       -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $envPath -Name "TABEZA_API_URL"     -Value $ApiUrl      -PropertyType String -Force | Out-Null
    # FIX: Use the $WatchFolder parameter instead of hardcoded wrong path
    New-ItemProperty -Path $envPath -Name "TABEZA_WATCH_FOLDER" -Value $WatchFolder -PropertyType String -Force | Out-Null

    Write-Host "  [SUCCESS] Environment variables configured" -ForegroundColor Green
    Write-Host "    TABEZA_BAR_ID      = $BarId" -ForegroundColor Gray
    Write-Host "    TABEZA_WATCH_FOLDER = $WatchFolder" -ForegroundColor Gray
}

# Bug 1 Fix - Sub-task 1.3.4: Update config.json with Bar ID
Write-Host "  Updating config.json with Bar ID..." -ForegroundColor Gray

$configPath = "C:\ProgramData\Tabeza\config.json"
try {
    if (Test-Path $configPath) {
        # Read existing config
        $configContent = Get-Content $configPath -Raw -Encoding UTF8
        $config = $configContent | ConvertFrom-Json
        
        # Update Bar ID
        $config.barId = $BarId
        
        # Write back to file
        $config | ConvertTo-Json -Depth 10 | Set-Content $configPath -Encoding UTF8
        
        Write-Host "  [SUCCESS] config.json updated with Bar ID" -ForegroundColor Green
        Write-Host "    Bar ID: $BarId" -ForegroundColor Gray
    } else {
        Write-Host "  [WARNING] config.json not found at $configPath" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [WARNING] Failed to update config.json: $_" -ForegroundColor Yellow
    Write-Host "  (Non-fatal - service will migrate from registry on startup)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Service registration complete - service will be started by installer" -ForegroundColor Gray
Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "  Service Registration Complete!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""

# Write status - use MyInvocation path (safe in hidden PS sessions, unlike $PSScriptRoot)
$writeStatusScript = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "write-status.ps1"
if (Test-Path $writeStatusScript) {
    try {
        & $writeStatusScript -StepNumber 3 -StepName "Service registered" -Success $true -Details "Service: $serviceName"
    } catch {
        Write-Host "Warning: Could not write status (non-fatal): $_" -ForegroundColor Yellow
    }
}

exit 0
