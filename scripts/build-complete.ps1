# Complete Build Script for Tabeza Connect
# This script handles the entire build process including:
# - Killing running processes
# - Cleaning build artifacts
# - Rebuilding native modules
# - Building the installer

param(
    [switch]$SkipKill,
    [switch]$SkipClean,
    [switch]$SkipRebuild
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Tabeza Connect - Complete Build Process" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill running processes
if (-not $SkipKill) {
    Write-Host "Step 1: Killing running TabezaConnect processes..." -ForegroundColor Yellow
    & "$PSScriptRoot\kill-processes.ps1"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to kill processes. Please close TabezaConnect manually and try again." -ForegroundColor Red
        exit 1
    }
    Write-Host ""
}
else {
    Write-Host "Step 1: Skipping process kill (--SkipKill specified)" -ForegroundColor Gray
    Write-Host ""
}

# Step 2: Clean build artifacts
if (-not $SkipClean) {
    Write-Host "Step 2: Cleaning build artifacts..." -ForegroundColor Yellow
    if (Test-Path "dist") {
        Remove-Item -Path "dist" -Recurse -Force
        Write-Host "  ✓ Removed dist folder" -ForegroundColor Green
    }
    else {
        Write-Host "  ✓ No dist folder to clean" -ForegroundColor Green
    }
    Write-Host ""
}
else {
    Write-Host "Step 2: Skipping clean (--SkipClean specified)" -ForegroundColor Gray
    Write-Host ""
}

# Step 3: Rebuild native modules
if (-not $SkipRebuild) {
    Write-Host "Step 3: Rebuilding native modules for Electron..." -ForegroundColor Yellow
    try {
        npm run rebuild
        if ($LASTEXITCODE -ne 0) {
            throw "npm run rebuild failed"
        }
        Write-Host "  ✓ Native modules rebuilt successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "  ✗ Failed to rebuild native modules: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please ensure electron-rebuild is installed:" -ForegroundColor Yellow
        Write-Host "  npm install --save-dev electron-rebuild" -ForegroundColor Yellow
        exit 1
    }
    Write-Host ""
}
else {
    Write-Host "Step 3: Skipping rebuild (SkipRebuild specified)" -ForegroundColor Gray
    Write-Host ""
}

# Step 4: Run build preparation
Write-Host "Step 4: Running build preparation checks..." -ForegroundColor Yellow
try {
    node scripts/prepare-build.js
    if ($LASTEXITCODE -ne 0) {
        throw "Build preparation failed"
    }
}
catch {
    Write-Host "  ✗ Build preparation failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 5: Build the installer
Write-Host "Step 5: Building installer..." -ForegroundColor Yellow
try {
    npm run build:win:x64
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
    Write-Host "  ✓ Build completed successfully" -ForegroundColor Green
}
catch {
    Write-Host "  ✗ Build failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 6: Verify build output
Write-Host "Step 6: Verifying build output..." -ForegroundColor Yellow
$installerPath = Get-ChildItem -Path "dist" -Filter "TabezaConnect-Setup-*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($installerPath) {
    $size = [math]::Round($installerPath.Length / 1MB, 2)
    Write-Host "  ✓ Installer created: $($installerPath.Name)" -ForegroundColor Green
    Write-Host "  ✓ Size: $size MB" -ForegroundColor Green
    Write-Host "  ✓ Path: $($installerPath.FullName)" -ForegroundColor Green
}
else {
    Write-Host "  ✗ Installer not found in dist folder!" -ForegroundColor Red
    exit 1
}

# Check for required Electron resources in unpacked build
Write-Host ""
Write-Host "  Checking Electron resources..." -ForegroundColor Yellow
$unpackedPath = "dist\win-unpacked"
$requiredFiles = @(
    "chrome_100_percent.pak",
    "chrome_200_percent.pak",
    "resources.pak",
    "TabezaConnect.exe"
)

$allFilesPresent = $true
foreach ($file in $requiredFiles) {
    $filePath = Join-Path $unpackedPath $file
    if (Test-Path $filePath) {
        Write-Host "    ✓ $file" -ForegroundColor Green
    }
    else {
        Write-Host "    ✗ Missing: $file" -ForegroundColor Red
        $allFilesPresent = $false
    }
}

if (-not $allFilesPresent) {
    Write-Host ""
    Write-Host "  ⚠ WARNING: Some Electron resources are missing!" -ForegroundColor Yellow
    Write-Host "  The installer was created but may not work correctly." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ Build process complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installer location:" -ForegroundColor Cyan
$installerPath | ForEach-Object { Write-Host "  $($_.FullName)" -ForegroundColor White }
