# Register Tabeza Connect as Windows Service using NSSM
# NSSM (Non-Sucking Service Manager) wraps the Node.js app as a proper Windows service

param(
    [string]$InstallPath = "C:\Program Files\Tabeza",
    [string]$BarId,
    [string]$ApiUrl = "https://tabeza.co.ke",
    [switch]$Uninstall
)

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Tabeza Connect - Service Setup (NSSM)" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[ERROR] This script must be run as Administrator" -ForegroundColor Red
    exit 1
}

$serviceName = "TabezaConnectService"
$displayName = "TabezaConnect Service"
$description = "Bridges POS system with Tabeza cloud for digital receipts and customer engagement"
$nssmPath = Join-Path $InstallPath "nssm\win64\nssm.exe"
$exePath = Join-Path $InstallPath "TabezaService.exe"

# Check if service exists
$existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

if ($Uninstall) {
    if ($existingService) {
        Write-Host "Stopping service..." -ForegroundColor Yellow
        & $nssmPath stop $serviceName
        Start-Sleep -Seconds 2
        
        Write-Host "Removing service..." -ForegroundColor Yellow
        & $nssmPath remove $serviceName confirm
        
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
    Write-Host "Usage: .\register-service-nssm.ps1 -BarId YOUR-BAR-ID" -ForegroundColor Yellow
    exit 1
}

# Validate paths
if (-not (Test-Path $nssmPath)) {
    Write-Host "[ERROR] NSSM not found at: $nssmPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $exePath)) {
    Write-Host "[ERROR] TabezaService.exe not found at: $exePath" -ForegroundColor Red
    exit 1
}

Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Install Path: $InstallPath" -ForegroundColor White
Write-Host "  NSSM Path: $nssmPath" -ForegroundColor White
Write-Host "  Executable: TabezaService.exe" -ForegroundColor White
Write-Host "  Bar ID: $BarId" -ForegroundColor White
Write-Host "  API URL: $ApiUrl" -ForegroundColor White
Write-Host ""

# Remove existing service if it exists
if ($existingService) {
    Write-Host "Removing existing service..." -ForegroundColor Yellow
    & $nssmPath stop $serviceName 2>$null
    Start-Sleep -Seconds 2
    & $nssmPath remove $serviceName confirm
    Start-Sleep -Seconds 2
}

Write-Host "Installing service with NSSM..." -ForegroundColor Cyan

# Install service using NSSM
& $nssmPath install $serviceName $exePath

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to install service" -ForegroundColor Red
    exit 1
}

Write-Host "  Service installed" -ForegroundColor Green

# Configure service
Write-Host "  Configuring service..." -ForegroundColor Gray

# Set display name and description
& $nssmPath set $serviceName DisplayName $displayName
& $nssmPath set $serviceName Description $description

# Set startup type to automatic
& $nssmPath set $serviceName Start SERVICE_AUTO_START

# Set environment variables
& $nssmPath set $serviceName AppEnvironmentExtra "TABEZA_BAR_ID=$BarId" "TABEZA_API_URL=$ApiUrl" "TABEZA_WATCH_FOLDER=C:\ProgramData\Tabeza\TabezaPrints"

# Set working directory
& $nssmPath set $serviceName AppDirectory $InstallPath

# Configure stdout/stderr logging
$logPath = "C:\ProgramData\Tabeza\logs"
& $nssmPath set $serviceName AppStdout "$logPath\service-output.log"
& $nssmPath set $serviceName AppStderr "$logPath\service-error.log"

# Rotate logs (10MB max, keep 3 files)
& $nssmPath set $serviceName AppStdoutCreationDisposition 4
& $nssmPath set $serviceName AppStderrCreationDisposition 4
& $nssmPath set $serviceName AppRotateFiles 1
& $nssmPath set $serviceName AppRotateOnline 1
& $nssmPath set $serviceName AppRotateSeconds 86400
& $nssmPath set $serviceName AppRotateBytes 10485760

# Configure service recovery (restart on failure)
& $nssmPath set $serviceName AppExit Default Restart
& $nssmPath set $serviceName AppRestartDelay 5000

Write-Host "  Service configured" -ForegroundColor Green

# Start the service
Write-Host ""
Write-Host "Starting service..." -ForegroundColor Cyan

& $nssmPath start $serviceName

if ($LASTEXITCODE -eq 0) {
    Start-Sleep -Seconds 3
    
    $service = Get-Service -Name $serviceName
    if ($service.Status -eq 'Running') {
        Write-Host "[SUCCESS] Service started successfully" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Service installed but not running" -ForegroundColor Yellow
        Write-Host "Check logs at: $logPath" -ForegroundColor Yellow
    }
} else {
    Write-Host "[WARNING] Service installed but failed to start" -ForegroundColor Yellow
    Write-Host "Check logs at: $logPath" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "  Service Registration Complete!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Service logs:" -ForegroundColor Cyan
Write-Host "  Output: $logPath\service-output.log" -ForegroundColor White
Write-Host "  Errors: $logPath\service-error.log" -ForegroundColor White
Write-Host ""

exit 0
