# register-service.ps1
# Registers the TabezaConnect Windows service.
# IDEMPOTENT — safe to run on install, reinstall, and repair.
# If the service already exists it is stopped, reconfigured, and restarted.
#
# Exit codes:  0 = success,  1 = fatal error

param(
    [Parameter(Mandatory=$true)]  [string]$InstallDir,
    [Parameter(Mandatory=$true)]  [string]$BarID,
    [Parameter(Mandatory=$false)] [string]$ApiUrl      = "https://bkaigyrrzsqbfscyznzw.supabase.co",
    [Parameter(Mandatory=$false)] [string]$ServiceName = "TabezaConnect"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Resolve paths ──────────────────────────────────────────────────────────────
$ServiceExe = Join-Path $InstallDir "tabeza-service.exe"
$LogDir     = "C:\ProgramData\Tabeza\logs"

if (-not (Test-Path $ServiceExe)) {
    Write-Host "ERROR: Service executable not found: $ServiceExe"
    exit 1
}

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

function Write-Log {
    param([string]$Message)
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Write-Host $line
    Add-Content -Path "$LogDir\register-service.log" -Value $line -ErrorAction SilentlyContinue
}

# ── Stop and remove existing service if present ────────────────────────────────
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Log "Service '$ServiceName' already exists — stopping and reconfiguring..."
    
    if ($existing.Status -ne "Stopped") {
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        $timeout = 15
        while ((Get-Service -Name $ServiceName).Status -ne "Stopped" -and $timeout -gt 0) {
            Start-Sleep -Seconds 1
            $timeout--
        }
    }
    
    # Remove old service registration cleanly
    & sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
    Write-Log "Old service registration removed."
}

# ── Register service ───────────────────────────────────────────────────────────
Write-Log "Registering service: $ServiceName"
Write-Log "Executable: $ServiceExe"

$scResult = & sc.exe create $ServiceName `
    binPath= "`"$ServiceExe`"" `
    start= auto `
    DisplayName= "TabezaConnect" `
    obj= LocalSystem

if ($LASTEXITCODE -ne 0) {
    Write-Log "ERROR: sc.exe create failed (exit $LASTEXITCODE): $scResult"
    exit 1
}

& sc.exe description $ServiceName "Captures POS printer output and relays receipts to Tabeza cloud" | Out-Null

# ── Set environment variables in service registry key ─────────────────────────
$regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\$ServiceName"
if (Test-Path $regPath) {
    $envValues = @(
        "TABEZA_BAR_ID=$BarID",
        "TABEZA_API_URL=$ApiUrl",
        "TABEZA_WATCH_FOLDER=C:\TabezaPrints",
        "TABEZA_LOG_DIR=$LogDir"
    )
    Set-ItemProperty -Path $regPath -Name Environment -Value $envValues
    Write-Log "Environment variables set in registry."
} else {
    Write-Log "WARNING: Service registry key not found — env vars not set."
}

# ── Configure recovery: restart on failure ────────────────────────────────────
& sc.exe failure $ServiceName reset= 86400 actions= restart/10000/restart/10000/restart/30000 | Out-Null

# ── Start service ──────────────────────────────────────────────────────────────
Write-Log "Starting service..."
$startResult = & sc.exe start $ServiceName

if ($LASTEXITCODE -ne 0) {
    Write-Log "ERROR: Failed to start service (exit $LASTEXITCODE): $startResult"
    exit 1
}

# Wait for running state (up to 30 seconds)
$timeout = 30
while ($timeout -gt 0) {
    $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq "Running") {
        Write-Log "Service started successfully."
        exit 0
    }
    Start-Sleep -Seconds 1
    $timeout--
}

Write-Log "WARNING: Service registered but did not reach Running state within 30 seconds."
# Exit 0 — service is registered even if slow to start; don't fail the install
exit 0
