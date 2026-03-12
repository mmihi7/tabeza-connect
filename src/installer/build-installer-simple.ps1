# Simple TabezaConnect Installer Build Script

Write-Host "Building TabezaConnect Installer" -ForegroundColor Cyan

# Extract the current version from package.json (already updated by version manager)
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$version = $packageJson.version
Write-Host "Build Version: $version" -ForegroundColor Green

# Find Inno Setup
$innoPath = "${env:ProgramFiles(x86)}\Inno Setup 6\iscc.exe"
if (-not (Test-Path $innoPath)) {
    $innoPath = "${env:ProgramFiles}\Inno Setup 6\iscc.exe"
}

if (-not (Test-Path $innoPath)) {
    Write-Host "ERROR: Inno Setup not found" -ForegroundColor Red
    exit 1
}

Write-Host "Inno Setup found: $innoPath" -ForegroundColor Green

# Build Electron app
Write-Host "Building capture.exe..." -ForegroundColor Cyan
npm run build:capture

Write-Host "Building Electron app..." -ForegroundColor Cyan
npm run build:electron

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Electron build failed" -ForegroundColor Red
    exit 1
}

# Build Inno Setup installer
Write-Host "Building Inno Setup installer..." -ForegroundColor Cyan
$issScript = "src\installer\TabezaConnect.iss"
$outputDir = "dist"

& $innoPath $issScript "/DAppVersion=$version" "/Q" "/O$outputDir"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build Complete!" -ForegroundColor Green
    $exeFile = Get-ChildItem -Path $outputDir -Filter "TabezaConnect-Setup-*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($exeFile) {
        $fileSize = [math]::Round($exeFile.Length / 1MB, 2)
        Write-Host "Output: $($exeFile.Name)" -ForegroundColor White
        Write-Host "Size: $fileSize MB" -ForegroundColor White
        Write-Host "Path: $($exeFile.FullName)" -ForegroundColor White
    }
} else {
    Write-Host "ERROR: Inno Setup build failed" -ForegroundColor Red
    exit 1
}
