# Build TabezaConnect Professional Installer

Write-Host "Building TabezaConnect v1.1.0" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Step 1: Build with Inno Setup
Write-Host "Step 1: Building professional installer..." -ForegroundColor Yellow
try {
    & iscc installer.iss
    Write-Host "✅ Build Complete!" -ForegroundColor Green
} catch {
    Write-Host "❌ Installer build failed!" -ForegroundColor Red
    Write-Host "Make sure Inno Setup is installed and in PATH" -ForegroundColor Yellow
    exit 1
}

Write-Host "========================================" -ForegroundColor Green

# Check for installer
if (Test-Path "Output\TabezaConnect-Setup.exe") {
    $size = (Get-Item "Output\TabezaConnect-Setup.exe").Length / 1MB
    Write-Host "🎉 Professional installer created successfully!" -ForegroundColor Green
    Write-Host "File: Output\TabezaConnect-Setup.exe" -ForegroundColor Cyan
    Write-Host "Size: $size MB" -ForegroundColor Cyan
    
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Ready for distribution!" -ForegroundColor Green
    Write-Host "🚀 Features:" -ForegroundColor Yellow
    Write-Host "  ✅ Professional Windows installer" -ForegroundColor Green
    Write-Host "  ✅ Spooler monitoring support" -ForegroundColor Green
    Write-Host "  ✅ Bar ID configuration wizard" -ForegroundColor Green
    Write-Host "  ✅ Windows service integration" -ForegroundColor Green
    Write-Host "  ✅ Desktop shortcuts" -ForegroundColor Green
    Write-Host "  ✅ Silent installation support" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Build complete! Installer ready at: Output\TabezaConnect-Setup.exe" -ForegroundColor Green
} else {
    Write-Host "❌ Installer not found!" -ForegroundColor Red
    Write-Host "Check the build output above for errors." -ForegroundColor Yellow
}

Write-Host "Done!" -ForegroundColor Green
