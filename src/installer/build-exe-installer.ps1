# Build TabezaConnect EXE Installer using Electron Builder
# This creates a professional GUI installer with the Electron app

Write-Host "Building TabezaConnect Installer with Electron" -ForegroundColor Cyan
Write-Host ""

$packageJsonPath = Join-Path $PSScriptRoot "..\..\package.json"
$packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
$version = $packageJson.version
Write-Host "Version: $version" -ForegroundColor Green
Write-Host ""

Write-Host "Building with Electron Builder (this may take a few minutes)..." -ForegroundColor Cyan
Write-Host ""

Push-Location (Join-Path $PSScriptRoot "..\..")

# Use electron-builder directly with NSIS target
npm run build:installer

$buildResult = $LASTEXITCODE
Pop-Location

if ($buildResult -eq 0) {
    Write-Host ""
    Write-Host "Build Complete!" -ForegroundColor Green
    
    $distDir = Join-Path $PSScriptRoot "..\..\dist"
    $exeFile = Get-ChildItem -Path $distDir -Filter "TabezaConnect-Setup-*.exe" | Select-Object -First 1
    
    if ($exeFile) {
        $fileSize = ($exeFile.Length / 1MB)
        Write-Host "Output: $($exeFile.Name)" -ForegroundColor White
        Write-Host "Size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor White
        Write-Host "Path: $($exeFile.FullName)" -ForegroundColor White
        Start-Process explorer.exe -ArgumentList $distDir
    }
} else {
    Write-Host ""
    Write-Host "ERROR: Build failed" -ForegroundColor Red
    Write-Host "Try running: npm install" -ForegroundColor Yellow
    exit 1
}
