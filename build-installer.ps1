# Tabeza Connect Installer Build Script
# Version: 1.7.15
# Purpose: Automates the build process for the Inno Setup installer

param(
    [switch]$SkipVerification,
    [switch]$OpenOutput
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Tabeza Connect Installer Builder v1.7.15" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# STEP 1: Verify Required Files
# ============================================================================

if (-not $SkipVerification) {
    Write-Host "[1/4] Verifying required files..." -ForegroundColor Yellow
    
    $requiredFiles = @(
        @{ Path = "dist\win-ia32-unpacked\TabezaConnect.exe"; Description = "PKG compiled binary" },
        @{ Path = "assets\icon-green.ico"; Description = "Application icon" },
        @{ Path = "config.template.json"; Description = "Configuration template" },
        @{ Path = "LICENSE.txt"; Description = "License file" },
        @{ Path = "installer-pkg-v1.7.15.iss"; Description = "Inno Setup script" },
        @{ Path = "src\installer\scripts\create-folders.ps1"; Description = "Create folders script" },
        @{ Path = "src\installer\scripts\configure-pooling-printer.ps1"; Description = "Printer config script" },
        @{ Path = "src\installer\scripts\register-service-pkg.ps1"; Description = "Service registration script" },
        @{ Path = "src\installer\scripts\verify-installation.ps1"; Description = "Verification script" },
        @{ Path = "src\installer\scripts\uninstall-pooling-printer.ps1"; Description = "Uninstall script" }
    )
    
    $missing = @()
    foreach ($file in $requiredFiles) {
        if (-not (Test-Path $file.Path)) {
            $missing += $file
            Write-Host "  ✗ Missing: $($file.Path) - $($file.Description)" -ForegroundColor Red
        } else {
            Write-Host "  ✓ Found: $($file.Path)" -ForegroundColor Green
        }
    }
    
    if ($missing.Count -gt 0) {
        Write-Host ""
        Write-Host "ERROR: Missing $($missing.Count) required file(s)" -ForegroundColor Red
        Write-Host "Please ensure all files are present before building." -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "All required files present!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[1/4] Skipping file verification (-SkipVerification)" -ForegroundColor Yellow
    Write-Host ""
}

# ============================================================================
# STEP 2: Check for Inno Setup
# ============================================================================

Write-Host "[2/4] Checking for Inno Setup..." -ForegroundColor Yellow

$isccPaths = @(
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe",
    "C:\Program Files (x86)\Inno Setup 5\ISCC.exe"
)

$isccPath = $null
foreach ($path in $isccPaths) {
    if (Test-Path $path) {
        $isccPath = $path
        break
    }
}

if (-not $isccPath) {
    Write-Host "ERROR: Inno Setup not found!" -ForegroundColor Red
    Write-Host "Please install Inno Setup 6 from: https://jrsoftware.org/isdl.php" -ForegroundColor Red
    exit 1
}

Write-Host "  ✓ Found Inno Setup at: $isccPath" -ForegroundColor Green
Write-Host ""

# ============================================================================
# STEP 3: Create Output Directory
# ============================================================================

Write-Host "[3/4] Preparing output directory..." -ForegroundColor Yellow

$outputDir = "installer-output"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
    Write-Host "  ✓ Created: $outputDir" -ForegroundColor Green
} else {
    Write-Host "  ✓ Output directory exists: $outputDir" -ForegroundColor Green
}
Write-Host ""

# ============================================================================
# STEP 4: Compile Installer
# ============================================================================

Write-Host "[4/4] Compiling installer with Inno Setup..." -ForegroundColor Yellow
Write-Host ""

$issFile = "installer-pkg-v1.7.15.iss"

try {
    & $isccPath $issFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "BUILD SUCCESSFUL!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        
        $installerPath = Join-Path $outputDir "TabezaConnect-Setup-v1.7.15.exe"
        
        if (Test-Path $installerPath) {
            $fileSize = (Get-Item $installerPath).Length / 1MB
            Write-Host "Installer created:" -ForegroundColor Cyan
            Write-Host "  Location: $installerPath" -ForegroundColor White
            Write-Host "  Size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor White
            Write-Host ""
            
            Write-Host "Next steps:" -ForegroundColor Cyan
            Write-Host "  1. Test the installer on a clean Windows VM" -ForegroundColor White
            Write-Host "  2. Create a GitHub release (tag: v1.7.15)" -ForegroundColor White
            Write-Host "  3. Upload the installer to the release" -ForegroundColor White
            Write-Host "  4. Update the Staff App download link" -ForegroundColor White
            Write-Host ""
            
            if ($OpenOutput) {
                Write-Host "Opening output folder..." -ForegroundColor Yellow
                explorer $outputDir
            }
        } else {
            Write-Host "WARNING: Installer file not found at expected location" -ForegroundColor Yellow
            Write-Host "Expected: $installerPath" -ForegroundColor Yellow
        }
    } else {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "BUILD FAILED!" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "Exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host "Check the output above for errors." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "BUILD ERROR!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
