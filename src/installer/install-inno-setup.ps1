# Install Inno Setup for building TabezaConnect installer
# Downloads and installs Inno Setup 6 automatically

Write-Host "Installing Inno Setup 6..." -ForegroundColor Cyan
Write-Host ""

# Check if Inno Setup is already installed
$innoSetupPath = Get-Command "iscc.exe" -ErrorAction SilentlyContinue
if ($innoSetupPath) {
    Write-Host "✅ Inno Setup is already installed at: $($innoSetupPath.Path)" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now run: npm run build:installer" -ForegroundColor Cyan
    exit 0
}

# Also check common paths since it might not be in PATH
$commonPaths = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\iscc.exe",
    "${env:ProgramFiles}\Inno Setup 6\iscc.exe",
    "${env:ProgramFiles(x86)}\Inno Setup 5\iscc.exe",
    "${env:ProgramFiles}\Inno Setup 5\iscc.exe"
)

foreach ($path in $commonPaths) {
    if (Test-Path $path) {
        Write-Host "✅ Inno Setup is already installed at: $path" -ForegroundColor Green
        Write-Host ""
        Write-Host "You can now run: npm run build:installer" -ForegroundColor Cyan
        exit 0
    }
}

# Download Inno Setup
Write-Host "Downloading Inno Setup 6..." -ForegroundColor Cyan
$downloadUrl = "https://jrsoftware.org/download.php/is.exe"
$installerPath = "$env:TEMP\inno-setup-installer.exe"

try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing
    Write-Host "✅ Downloaded Inno Setup installer" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to download Inno Setup" -ForegroundColor Red
    Write-Host "Please download manually from: https://jrsoftware.org/isdl.php" -ForegroundColor Yellow
    exit 1
}

# Install Inno Setup silently
Write-Host "Installing Inno Setup (this may take a minute)..." -ForegroundColor Cyan
$installArgs = @(
    "/SILENT",
    "/SUPPRESSMSGBOXES",
    "/NORESTART",
    "/DIR=C:\Program Files (x86)\Inno Setup 6"
)

try {
    $process = Start-Process -FilePath $installerPath -ArgumentList $installArgs -Wait -PassThru
    
    if ($process.ExitCode -eq 0) {
        Write-Host "✅ Inno Setup installed successfully" -ForegroundColor Green
        
        # Clean up installer
        Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
        
        # Verify installation
        $isccPath = "${env:ProgramFiles(x86)}\Inno Setup 6\iscc.exe"
        if (Test-Path $isccPath) {
            Write-Host ""
            Write-Host "Installation verified: $isccPath" -ForegroundColor Green
            Write-Host ""
            Write-Host "You can now run: npm run build:installer" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Inno Setup 6 features:" -ForegroundColor White
            Write-Host "  ✓ Professional Windows installer creation" -ForegroundColor Green
            Write-Host "  ✓ Custom installation scripts" -ForegroundColor Green
            Write-Host "  ✓ Update detection and handling" -ForegroundColor Green
            Write-Host "  ✓ Silent installation support" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Installation may have completed but iscc.exe not found at expected location" -ForegroundColor Yellow
            Write-Host "Try restarting PowerShell and running: npm run build:installer" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Inno Setup installation failed (exit code: $($process.ExitCode))" -ForegroundColor Red
        Write-Host "Please try manual installation from: https://jrsoftware.org/isdl.php" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Failed to install Inno Setup" -ForegroundColor Red
    Write-Host "Please try manual installation from: https://jrsoftware.org/isdl.php" -ForegroundColor Yellow
    exit 1
}
