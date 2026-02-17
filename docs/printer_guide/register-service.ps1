# register-service.ps1
# Registers and starts the TabezaConnect Windows service.
# Called from Inno Setup [Run] section (TR-4).
#
# Usage:
#   .\register-service.ps1 `
#       -InstallDir "C:\Program Files\Tabeza" `
#       -BarID "venue-bar-id-here" `
#       -WatchFolder "C:\TabezaPrints" `
#       -ServiceName "TabezaConnect" `
#       [-Silent]
#
# Exit codes:
#   0  - Success
#   1  - Fatal error

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]  [string]$InstallDir,
    [Parameter(Mandatory = $true)]  [string]$BarID,
    [Parameter(Mandatory = $true)]  [string]$WatchFolder,
    [Parameter(Mandatory = $false)] [string]$ServiceName = 'TabezaConnect',
    [switch]$Silent
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$NodeExe     = Join-Path $InstallDir 'runtime\node.exe'
$AppEntry    = Join-Path $InstallDir 'app\index.js'
$LogDir      = Join-Path $InstallDir 'logs'
$ConfigDir   = Join-Path $InstallDir 'config'
$ConfigFile  = Join-Path $ConfigDir  'settings.json'

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $ts   = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "[$ts][$Level] $Message"
    if (-not $Silent) { Write-Host $line }
    Add-Content -Path (Join-Path $LogDir 'register-service.log') -Value $line -ErrorAction SilentlyContinue
}

try {
    Write-Log "Starting service registration"

    # ── 1. Validate prerequisites ─────────────────────────────────────────────
    if (-not (Test-Path $NodeExe)) {
        Write-Log "Node.js runtime not found at: $NodeExe" 'ERROR'
        exit 1
    }
    if (-not (Test-Path $AppEntry)) {
        Write-Log "App entry point not found at: $AppEntry" 'ERROR'
        exit 1
    }

    # ── 2. Write config file ──────────────────────────────────────────────────
    $config = @{
        barId       = $BarID
        watchFolder = $WatchFolder
        logDir      = $LogDir
        version     = (Get-ItemProperty "$InstallDir\tabeza.ico" -ErrorAction SilentlyContinue).'VersionInfo'
    } | ConvertTo-Json -Depth 3

    if (-not (Test-Path $ConfigDir)) { New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null }
    Set-Content -Path $ConfigFile -Value $config -Encoding UTF8
    Write-Log "Configuration written to: $ConfigFile"

    # ── 3. Remove existing service if present (upgrade / repair) ─────────────
    $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Log "Stopping existing service '$ServiceName'"
        if ($existing.Status -eq 'Running') {
            Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 3
        }
        Write-Log "Deleting existing service '$ServiceName'"
        & sc.exe delete $ServiceName | Out-Null
        Start-Sleep -Seconds 2
    }

    # ── 4. Register the service ───────────────────────────────────────────────
    # Using sc.exe for broadest compatibility; NSSM could be used as an
    # alternative if bundled in the installer.
    $binPath = "`"$NodeExe`" `"$AppEntry`""
    Write-Log "Registering service: $ServiceName"
    Write-Log "Binary path: $binPath"

    & sc.exe create $ServiceName `
        binPath= $binPath `
        start= auto `
        obj= "LocalSystem" `
        DisplayName= "Tabeza Connect Service" | Out-Null

    if ($LASTEXITCODE -ne 0) {
        Write-Log "sc.exe create failed with code $LASTEXITCODE" 'ERROR'
        exit 1
    }

    # ── 5. Set description ────────────────────────────────────────────────────
    & sc.exe description $ServiceName "Monitors the TabezaPrints watch folder and relays print jobs to the Tabeza cloud." | Out-Null

    # ── 6. Configure failure recovery (restart on crash) ─────────────────────
    & sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null

    # ── 7. Set environment variables for the service ──────────────────────────
    $envKey = "HKLM:\SYSTEM\CurrentControlSet\Services\$ServiceName"
    $envValue = @(
        "TABEZA_BAR_ID=$BarID",
        "TABEZA_WATCH_FOLDER=$WatchFolder",
        "TABEZA_LOG_DIR=$LogDir",
        "TABEZA_CONFIG_FILE=$ConfigFile",
        "NODE_ENV=production"
    )
    New-ItemProperty -Path $envKey -Name 'Environment' -Value $envValue `
        -PropertyType MultiString -Force | Out-Null
    Write-Log "Environment variables set on service registry key"

    # ── 8. Start the service ──────────────────────────────────────────────────
    Write-Log "Starting service..."
    Start-Service -Name $ServiceName -ErrorAction Stop

    # ── 9. Verify it is running ───────────────────────────────────────────────
    Start-Sleep -Seconds 3
    $svc = Get-Service -Name $ServiceName
    if ($svc.Status -ne 'Running') {
        Write-Log "Service started but status is '$($svc.Status)' — may still be initializing" 'WARN'
    } else {
        Write-Log "Service is running"
    }

    Write-Log "Service registration complete"
    exit 0

} catch {
    Write-Log "FATAL: $_" 'ERROR'
    exit 1
}
