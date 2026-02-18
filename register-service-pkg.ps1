# Register Tabeza Connect as Windows Service (PKG Version - FIXED)
# Configures automatic startup and recovery settings
# Uses compiled TabezaService.exe directly (no wrapper needed)

param(
    [string]$InstallPath = "C:\Program Files\Tabeza",
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
$displayName = "Tabeza Connect"
$description = "Bridges POS system with Tabeza cloud for digital receipts and customer engagement"

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

# Validate install path - PKG version uses TabezaService.exe
$exePath = Join-Path $InstallPath "TabezaService.exe"

if (-not (Test-Path $exePath)) {
    Write-Host "[ERROR] TabezaService.exe not found at: $exePath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please ensure Tabeza Connect is installed correctly." -ForegroundColor Yellow
    exit 1
}

Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Install Path: $InstallPath" -ForegroundColor White
Write-Host "  Executable: TabezaService.exe" -ForegroundColor White
Write-Host "  Bar ID: $BarId" -ForegroundColor White
Write-Host "  API URL: $ApiUrl" -ForegroundColor White
Write-Host ""

# Remove existing service if it exists
if ($existingService) {
    Write-Host "Removing existing service..." -ForegroundColor Yellow
    Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    sc.exe delete $serviceName
    Start-Sleep -Seconds 2
}

Write-Host "Creating Windows service..." -ForegroundColor Cyan

# CRITICAL FIX: Create the service with environment variables embedded in binPath
# Windows services require .exe files, not .bat files
# We pass environment variables via the binPath parameter

$envVars = "TABEZA_BAR_ID=$BarId TABEZA_API_URL=$ApiUrl TABEZA_WATCH_FOLDER=C:\ProgramData\Tabeza\TabezaPrints"
$binaryPath = "`"$exePath`""

Write-Host "  Creating service with environment variables..." -ForegroundColor Gray

# Create service directly pointing to the .exe
# Note: sc.exe requires space after = signs
$createResult = sc.exe create $serviceName binPath= $binaryPath DisplayName= $displayName start= auto

if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Failed to create service" -ForegroundColor Red
    Write-Host "  Error code: $LASTEXITCODE" -ForegroundColor Red
    Write-Host "  Output: $createResult" -ForegroundColor Red
    exit 1
}

Write-Host "  [SUCCESS] Service created" -ForegroundColor Green

# Set service description
sc.exe description $serviceName $description | Out-Null

# Configure service recovery (restart on failure)
Write-Host "  Configuring automatic recovery..." -ForegroundColor Gray
sc.exe failure $serviceName reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null
Write-Host "  [SUCCESS] Recovery configured (restart on failure)" -ForegroundColor Green

# Set service to run as LocalSystem
Write-Host "  Setting service account..." -ForegroundColor Gray
sc.exe config $serviceName obj= "LocalSystem" | Out-Null
Write-Host "  [SUCCESS] Service account: LocalSystem" -ForegroundColor Green

# CRITICAL: Set environment variables in registry for the service
# This is the proper way to pass environment variables to Windows services
Write-Host "  Setting environment variables..." -ForegroundColor Gray

$regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\$serviceName"
if (Test-Path $regPath) {
    # Create Environment key if it doesn't exist
    $envPath = "$regPath\Environment"
    if (-not (Test-Path $envPath)) {
        New-Item -Path $envPath -Force | Out-Null
    }
    
    # Set environment variables
    New-ItemProperty -Path $envPath -Name "TABEZA_BAR_ID" -Value $BarId -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $envPath -Name "TABEZA_API_URL" -Value $ApiUrl -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $envPath -Name "TABEZA_WATCH_FOLDER" -Value "C:\ProgramData\Tabeza\TabezaPrints" -PropertyType String -Force | Out-Null
    
    Write-Host "  [SUCCESS] Environment variables configured" -ForegroundColor Green
} else {
    Write-Host "  [WARNING] Could not set environment variables in registry" -ForegroundColor Yellow
}

# Start the service
Write-Host ""
Write-Host "Starting service..." -ForegroundColor Cyan

try {
    Start-Service -Name $serviceName -ErrorAction Stop
    Start-Sleep -Seconds 3
    
    $service = Get-Service -Name $serviceName
    if ($service.Status -eq 'Running') {
        Write-Host "[SUCCESS] Service started successfully" -ForegroundColor Green
        Write-Host ""
        Write-Host "Service is now running on http://localhost:8765" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Service created but not running (Status: $($service.Status))" -ForegroundColor Yellow
        Write-Host "  Check Windows Event Viewer for error details" -ForegroundColor Gray
        Write-Host "  Application and Services Logs > TabezaConnect" -ForegroundColor Gray
    }
} catch {
    Write-Host "[WARNING] Service created but failed to start" -ForegroundColor Yellow
    Write-Host "  Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting steps:" -ForegroundColor Cyan
    Write-Host "  1. Check Windows Event Viewer:" -ForegroundColor White
    Write-Host "     - Windows Logs > Application" -ForegroundColor Gray
    Write-Host "     - Look for errors from 'TabezaConnect'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Try starting manually:" -ForegroundColor White
    Write-Host "     Start-Service -Name $serviceName" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3. Check executable permissions:" -ForegroundColor White
    Write-Host "     Get-Acl '$exePath' | Format-List" -ForegroundColor Gray
    Write-Host ""
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "  Service Registration Complete!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Service Details:" -ForegroundColor Cyan
Write-Host "  Name: $serviceName" -ForegroundColor White
Write-Host "  Display Name: $displayName" -ForegroundColor White
Write-Host "  Startup Type: Automatic" -ForegroundColor White
Write-Host "  Recovery: Restart on failure" -ForegroundColor White
Write-Host "  Executable: $exePath" -ForegroundColor White
Write-Host ""
Write-Host "Environment Variables:" -ForegroundColor Cyan
Write-Host "  TABEZA_BAR_ID: $BarId" -ForegroundColor White
Write-Host "  TABEZA_API_URL: $ApiUrl" -ForegroundColor White
Write-Host "  TABEZA_WATCH_FOLDER: C:\ProgramData\Tabeza\TabezaPrints" -ForegroundColor White
Write-Host ""
Write-Host "Management Commands:" -ForegroundColor Cyan
Write-Host "  Start:   Start-Service -Name $serviceName" -ForegroundColor White
Write-Host "  Stop:    Stop-Service -Name $serviceName" -ForegroundColor White
Write-Host "  Restart: Restart-Service -Name $serviceName" -ForegroundColor White
Write-Host "  Status:  Get-Service -Name $serviceName" -ForegroundColor White
Write-Host "  Logs:    Get-EventLog -LogName Application -Source TabezaConnect -Newest 10" -ForegroundColor White
Write-Host ""
Write-Host "Service will start automatically on system boot." -ForegroundColor Gray
Write-Host ""

exit 0
