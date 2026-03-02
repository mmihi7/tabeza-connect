# write-config.ps1
# Writes venue configuration to config.json.
# IDEMPOTENT — merges into existing config rather than overwriting it.

param(
    [Parameter(Mandatory=$true)]  [string]$BarID,
    [Parameter(Mandatory=$true)]  [string]$InstallDir,
    [Parameter(Mandatory=$false)] [string]$ApiKey = "",
    [Parameter(Mandatory=$false)] [string]$ApiUrl = "https://bkaigyrrzsqbfscyznzw.supabase.co"
)

$configPath = Join-Path $InstallDir "config.json"
$logDir = "C:\ProgramData\Tabeza\logs"

# Ensure log directory exists
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

function Write-Log {
    param([string]$Message)
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Write-Host $line
    Add-Content -Path "$logDir\write-config.log" -Value $line -ErrorAction SilentlyContinue
}

# ── Load existing config or start fresh ───────────────────────────────────────
if (Test-Path $configPath) {
    try {
        $cfg = Get-Content $configPath -Raw | ConvertFrom-Json
        Write-Log "Merging into existing config: $configPath"
    } catch {
        Write-Log "Warning: Existing config.json is malformed — recreating."
        $cfg = [PSCustomObject]@{}
    }
} else {
    $cfg = [PSCustomObject]@{}
    Write-Log "Creating new config: $configPath"
}

# Clean computer name for driverId
$cleanComputerName = $env:COMPUTERNAME -replace '\s', '-'

# ── Write/overwrite fields managed by installer ───────────────────────────────
$cfg | Add-Member -Force -NotePropertyName "barId"       -NotePropertyValue $BarID
$cfg | Add-Member -Force -NotePropertyName "apiUrl"      -NotePropertyValue $ApiUrl
$cfg | Add-Member -Force -NotePropertyName "driverId"    -NotePropertyValue "driver-$cleanComputerName"
$cfg | Add-Member -Force -NotePropertyName "watchFolder" -NotePropertyValue "C:\TabezaPrints"
$cfg | Add-Member -Force -NotePropertyName "captureMode" -NotePropertyValue "pooling"
$cfg | Add-Member -Force -NotePropertyName "version"     -NotePropertyValue "1.7.0"

# Only set API key if provided (preserve existing if not)
if ($ApiKey) {
    $cfg | Add-Member -Force -NotePropertyName "apiKey" -NotePropertyValue $ApiKey
    Write-Log "API key set from installer"
} elseif (-not $cfg.apiKey) {
    # No API key provided and none exists - set empty
    $cfg | Add-Member -Force -NotePropertyName "apiKey" -NotePropertyValue ""
    Write-Log "No API key provided - template generation may be limited"
}

# ── Write back ────────────────────────────────────────────────────────────────
try {
    # Ensure directory exists
    $configDir = Split-Path -Parent $configPath
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }
    
    $cfg | ConvertTo-Json -Depth 10 | Set-Content -Path $configPath -Encoding UTF8
    Write-Log "Config written successfully."
    Write-Log "  barId:    $BarID"
    Write-Log "  driverId: driver-$cleanComputerName"
    Write-Log "  apiKey:   $($ApiKey ? '***provided***' : 'not set')"
    
    exit 0
} catch {
    Write-Log "ERROR: Failed to write config.json: $_"
    exit 1
}