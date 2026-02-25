# Register Tabeza Connect as Windows Service (PKG Version - v1.6.0)
# Configures automatic startup and recovery settings
# Uses compiled TabezaConnect.exe directly (no wrapper needed)

param(
    [string]$InstallPath = "C:\Program Files\TabezaConnect",
    [string]$BarId,
    [string]$ApiUrl = "https://tabeza.co.ke",
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
$displayName = "Tabeza POS Connect"
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
    Write-Host "Please ensure Tabeza Connect is installed correctly." -ForegroundColor Yellow
    exit 1
}

Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Install Path: $InstallPath" -ForegroundColor White
Write-Host "  Executable: TabezaConnect.exe" -ForegroundColor White
Write-Host "  Bar ID: $BarId" -ForegroundColor White
Write-Host "  API URL: $ApiUrl" -ForegroundColor White
Write-Host ""

# Remove existing service if it exists (defensive - may have been removed by installer)
if ($existingService) {
    Write-Host "Existing service found, ensuring clean removal..." -ForegroundColor Yellow
    
    # Stop service if running
    if ($existingService.Status -eq 'Running') {
        Write-Host "  Stopping service..." -ForegroundColor Gray
        Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    
    # Delete service registration
    Write-Host "  Removing service registration..." -ForegroundColor Gray
    sc.exe delete $serviceName | Out-Null
    Start-Sleep -Seconds 2
    
    Write-Host "  [SUCCESS] Old service removed" -ForegroundColor Green
} else {
    Write-Host "No existing service found (clean installation or already removed)" -ForegroundColor Gray
}

Write-Host "Creating Windows service..." -ForegroundColor Cyan

# CRITICAL FIX: Register .exe directly (no batch wrapper)
$binaryPath = "`"$exePath`""

Write-Host "  Creating service..." -ForegroundColor Gray

# Create service directly pointing to the .exe
$createResult = sc.exe create $serviceName binPath= $binaryPath DisplayName= $displayName start= auto

if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Failed to create service" -ForegroundColor Red
    Write-Host "  Error code: $LASTEXITCODE" -ForegroundColor Red
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
    
    New-ItemProperty -Path $envPath -Name "TABEZA_BAR_ID" -Value $BarId -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $envPath -Name "TABEZA_API_URL" -Value $ApiUrl -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $envPath -Name "TABEZA_WATCH_FOLDER" -Value "C:\TabezaPrints" -PropertyType String -Force | Out-Null
    
    Write-Host "  [SUCCESS] Environment variables configured" -ForegroundColor Green
}

# Service will be started by installer after all configuration is complete
Write-Host ""
Write-Host "Service registration complete - service will be started after configuration" -ForegroundColor Gray
Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "  Service Registration Complete!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""

# Write status
& "$PSScriptRoot\write-status.ps1" -StepNumber 4 -StepName "Service registered" -Success $true -Details "Service: $serviceName"

exit 0
