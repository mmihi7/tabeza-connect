# Tabeza Connect Installer Build Script (Simplified)
# Version: 1.7.15

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "Tabeza Connect Installer Builder v1.7.15"
Write-Host "========================================"
Write-Host ""

# Check for Inno Setup
Write-Host "Checking for Inno Setup..."
$isccPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"

if (-not (Test-Path $isccPath)) {
    Write-Host "ERROR: Inno Setup not found at: $isccPath" -ForegroundColor Red
    Write-Host "Please install Inno Setup 6 from: https://jrsoftware.org/isdl.php" -ForegroundColor Red
    exit 1
}

Write-Host "Found Inno Setup!" -ForegroundColor Green
Write-Host ""

# Create output directory
Write-Host "Creating output directory..."
$outputDir = "installer-output"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}
Write-Host "Output directory ready!" -ForegroundColor Green
Write-Host ""

# Compile installer
Write-Host "Compiling installer..."
Write-Host ""

$issFile = "installer-pkg-v1.7.15.iss"

& $isccPath $issFile

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================"
    Write-Host "BUILD SUCCESSFUL!"
    Write-Host "========================================"
    Write-Host ""
    
    $installerPath = Join-Path $outputDir "TabezaConnect-Setup-v1.7.15.exe"
    
    if (Test-Path $installerPath) {
        $fileSize = (Get-Item $installerPath).Length / 1MB
        Write-Host "Installer created:"
        Write-Host "  Location: $installerPath"
        Write-Host "  Size: $([math]::Round($fileSize, 2)) MB"
        Write-Host ""
    }
} else {
    Write-Host ""
    Write-Host "BUILD FAILED! Exit code: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}
