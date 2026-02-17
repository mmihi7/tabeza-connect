# Register Tabeza Connect as Windows Service
# Configures automatic startup and recovery settings

param(
    [string]$InstallPath = "C:\Program Files\Tabeza",
    [string]$BarId,
    [string]$ApiUrl = "https://staff.tabeza.co.ke",
    [switch]$Uninstall
)

Write-Host "[====================================]" -ForegroundColor Cyan
Write-Host "[  Tabeza Connect - Service Setup   ]" -ForegroundColor Cyan
Write-Host "[====================================]" -ForegroundColor Cyan
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
        
        Write-Host "✅ Service uninstalled" -ForegroundColor Green
    } else {
        Write-Host "Service not found - nothing to uninstall" -ForegroundColor Gray
    }
    exit 0
}

# Validate required parameters
if (-not $BarId) {
    Write-Host "[ERROR] Bar ID is required" -ForegroundColor Red
    Write-Host ""
    Write-Host "Usage: .\register-service.ps1 -BarId YOUR_BAR_ID" -ForegroundColor Yellow
    exit 1
}

# Validate install path
$nodePath = Join-Path $InstallPath "nodejs\node.exe"
$servicePath = Join-Path $InstallPath "nodejs\service\index.js"

if (-not (Test-Path $nodePath)) {
    Write-Host "[ERROR] Node.js not found at: $nodePath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please ensure Tabeza Connect is installed correctly." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $servicePath)) {
    Write-Host "[ERROR] Service file not found at: $servicePath" -ForegroundColor Red
    exit 1
}

Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Install Path: $InstallPath" -ForegroundColor White
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

# Create service wrapper batch file
$wrapperPath = Join-Path $InstallPath "start-service.bat"
$wrapperContent = @"
@echo off
REM Tabeza Connect Service Wrapper
REM This script is executed by Windows Service Manager

SET NODE_PATH=$InstallPath\nodejs
SET SERVICE_PATH=$InstallPath\nodejs\service
SET TABEZA_BAR_ID=$BarId
SET TABEZA_API_URL=$ApiUrl
SET TABEZA_WATCH_FOLDER=C:\TabezaPrints

REM Start service with bundled Node.js
"%NODE_PATH%\node.exe" "%SERVICE_PATH%\index.js"
"@

$wrapperContent | Out-File -FilePath $wrapperPath -Encoding ASCII -Force
Write-Host "  [OK] Service wrapper created" -ForegroundColor Green

# Create service using sc.exe (more reliable than New-Service for complex scenarios)
$binaryPath = "`"$wrapperPath`""

Write-Host "  Creating service..." -ForegroundColor Gray
$createResult = sc.exe create $serviceName binPath= $binaryPath DisplayName= $displayName start= auto

if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Failed to create service" -ForegroundColor Red
    Write-Host "  Error: $createResult" -ForegroundColor Red
    exit 1
}

Write-Host "  [OK] Service created" -ForegroundColor Green

# Set service description
sc.exe description $serviceName $description | Out-Null

# Configure service recovery (restart on failure)
Write-Host "  Configuring automatic recovery..." -ForegroundColor Gray
sc.exe failure $serviceName reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null
Write-Host "  [OK] Recovery configured (restart on failure)" -ForegroundColor Green

# Set service to run as LocalSystem
Write-Host "  Setting service account..." -ForegroundColor Gray
sc.exe config $serviceName obj= "LocalSystem" | Out-Null
Write-Host "  [OK] Service account: LocalSystem" -ForegroundColor Green

# Start the service
Write-Host ""
Write-Host "Starting service..." -ForegroundColor Cyan

try {
    Start-Service -Name $serviceName -ErrorAction Stop
    Start-Sleep -Seconds 3
    
    $service = Get-Service -Name $serviceName
    if ($service.Status -eq 'Running') {
        Write-Host "[OK] Service started successfully" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Service created but not running (Status: $($service.Status))" -ForegroundColor Yellow
        Write-Host "  Try starting manually: Start-Service -Name $serviceName" -ForegroundColor Gray
    }
} catch {
    Write-Host "[WARN] Service created but failed to start: $_" -ForegroundColor Yellow
    Write-Host "  Check Event Viewer for details" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[====================================]" -ForegroundColor Green
Write-Host "[  Service Registration Complete!   ]" -ForegroundColor Green
Write-Host "[====================================]" -ForegroundColor Green
Write-Host ""
Write-Host "Service Details:" -ForegroundColor Cyan
Write-Host "  Name: $serviceName" -ForegroundColor White
Write-Host "  Display Name: $displayName" -ForegroundColor White
Write-Host "  Startup Type: Automatic" -ForegroundColor White
Write-Host "  Recovery: Restart on failure" -ForegroundColor White
Write-Host ""
Write-Host "Management Commands:" -ForegroundColor Cyan
Write-Host "  Start:   Start-Service -Name $serviceName" -ForegroundColor White
Write-Host "  Stop:    Stop-Service -Name $serviceName" -ForegroundColor White
Write-Host "  Restart: Restart-Service -Name $serviceName" -ForegroundColor White
Write-Host "  Status:  Get-Service -Name $serviceName" -ForegroundColor White
Write-Host ""
Write-Host "Service will start automatically on system boot." -ForegroundColor Gray
Write-Host ""

exit 0
