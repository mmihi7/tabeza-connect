# build-installer.ps1
# Local build script for TabezaConnect Inno Setup installer.
# Satisfies TR-2 (local build support).
#
# Prerequisites:
#   - Inno Setup 6 installed at default path
#   - npm build already run (dist/app/ must exist)
#   - Internet access to download Node.js runtime (first run only; cached after)
#
# Usage:
#   .\scripts\build-installer.ps1
#   .\scripts\build-installer.ps1 -Version "1.2.3" -SkipNodeBundle
#   .\scripts\build-installer.ps1 -Version "1.2.3" -Clean

[CmdletBinding()]
param(
    [string]$Version,
    [switch]$SkipNodeBundle,
    [switch]$Clean
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot  = Split-Path $PSScriptRoot -Parent
$IsccPath  = 'C:\Program Files (x86)\Inno Setup 6\ISCC.exe'
$ScriptFile = Join-Path $RepoRoot 'src\installer\TabezaConnect.iss'
$DistDir   = Join-Path $RepoRoot 'dist'
$NodeDir   = Join-Path $RepoRoot 'src\installer\nodejs-bundle'
$NodeDirX86 = Join-Path $RepoRoot 'src\installer\nodejs-bundle-x86'
$NodeVersion = '20.19.0'

function Write-Step { param([string]$Msg) Write-Host "`n▶ $Msg" -ForegroundColor Cyan }
function Write-OK   { param([string]$Msg) Write-Host "  ✓ $Msg" -ForegroundColor Green }
function Write-Warn { param([string]$Msg) Write-Host "  ⚠ $Msg" -ForegroundColor Yellow }
function Write-Fail { param([string]$Msg) Write-Host "  ✗ $Msg" -ForegroundColor Red; exit 1 }

# ── Resolve version ────────────────────────────────────────────────────────────
if (-not $Version) {
    # Try package.json
    $pkgJson = Join-Path $RepoRoot 'package.json'
    if (Test-Path $pkgJson) {
        $pkg = Get-Content $pkgJson | ConvertFrom-Json
        $Version = $pkg.version
        Write-Warn "No -Version supplied; using package.json version: $Version"
    } else {
        $Version = '0.0.0-local'
        Write-Warn "No -Version supplied; using default: $Version"
    }
}

Write-Host "`n╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host   "  TabezaConnect Installer Build v$Version  " -ForegroundColor Cyan
Write-Host   "╚══════════════════════════════════════════╝`n" -ForegroundColor Cyan

# ── Validate prerequisites ─────────────────────────────────────────────────────
Write-Step "Checking prerequisites"

if (-not (Test-Path $IsccPath)) {
    Write-Fail "Inno Setup 6 not found at: $IsccPath`nDownload from: https://jrsoftware.org/isdl.php"
}
Write-OK "Inno Setup 6 found"

if (-not (Test-Path (Join-Path $RepoRoot 'dist\app'))) {
    Write-Fail "dist\app not found. Run 'npm run build' first."
}
Write-OK "App bundle found"

# ── Clean dist ────────────────────────────────────────────────────────────────
if ($Clean) {
    Write-Step "Cleaning dist/"
    Remove-Item (Join-Path $DistDir "TabezaConnect-Setup-*.exe") -ErrorAction SilentlyContinue
    Write-OK "Cleaned"
}

# ── Bundle Node.js runtime ────────────────────────────────────────────────────
if (-not $SkipNodeBundle) {
    Write-Step "Bundling Node.js $NodeVersion runtime"

    function Bundle-Node {
        param([string]$Arch, [string]$Dest)
        if (Test-Path $Dest) {
            Write-OK "Node $Arch bundle already exists (use -Clean to refresh)"
            return
        }
        $url  = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-$Arch.zip"
        $tmp  = "$env:TEMP\node-$Arch-$NodeVersion.zip"
        if (-not (Test-Path $tmp)) {
            Write-Host "  Downloading Node.js $NodeVersion ($Arch)..."
            Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing
        }
        $extract = "$env:TEMP\node-$Arch-extracted"
        Expand-Archive -Path $tmp -DestinationPath $extract -Force
        $inner = Get-ChildItem $extract -Directory | Select-Object -First 1
        New-Item -ItemType Directory -Path $Dest -Force | Out-Null
        Copy-Item "$($inner.FullName)\*" -Destination $Dest -Recurse -Force
        Write-OK "Bundled Node.js $Arch to $Dest"
    }

    Bundle-Node -Arch 'x64'  -Dest $NodeDir
    Bundle-Node -Arch 'x86'  -Dest $NodeDirX86
}

# ── Compile Inno Setup ─────────────────────────────────────────────────────────
Write-Step "Compiling Inno Setup installer"
New-Item -ItemType Directory -Path $DistDir -Force | Out-Null

& $IsccPath $ScriptFile "/DAppVersion=$Version"
if ($LASTEXITCODE -ne 0) { Write-Fail "ISCC.exe exited with code $LASTEXITCODE" }

$Output = Join-Path $DistDir "TabezaConnect-Setup-v$Version.exe"

# ── Validate output ────────────────────────────────────────────────────────────
Write-Step "Validating output"

if (-not (Test-Path $Output)) { Write-Fail "Expected output not found: $Output" }

$size = (Get-Item $Output).Length
Write-OK "File exists: $Output"
Write-OK "Size: $([math]::Round($size/1MB, 2)) MB"

$bytes = [System.IO.File]::ReadAllBytes($Output)
if ($bytes[0] -eq 0x4D -and $bytes[1] -eq 0x5A) {
    Write-OK "Valid PE (MZ) header confirmed"
} else {
    Write-Fail "Invalid PE header — file may be corrupt"
}

Write-Host "`n✅ Build complete: $Output`n" -ForegroundColor Green
