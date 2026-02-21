# setup-bridge.ps1
param(
    [string]$PrinterName = "EPSON L3210 Series",
    [string]$CaptureFile = "C:\ProgramData\Tabeza\capture.prn",
    [string]$ConfigFile = "C:\ProgramData\Tabeza\bridge-config.json"
)

Write-Host "🔧 Configuring Tabeza Silent Bridge..." -ForegroundColor Cyan

# 1. Ensure directories exist
$dir = Split-Path $CaptureFile -Parent
if (!(Test-Path $dir)) { 
    New-Item -ItemType Directory -Force -Path $dir | Out-Null 
}

# 2. Get current printer configuration
$printer = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
if (!$printer) {
    Write-Host "❌ Printer '$PrinterName' not found!" -ForegroundColor Red
    exit 1
}

$originalPort = $printer.PortName
Write-Host "📍 Original Physical Port: $originalPort" -ForegroundColor Yellow

# 3. Save configuration for Node.js service
$config = @{
    printerName = $PrinterName
    physicalPort = $originalPort
    captureFile = $CaptureFile
    isBridgeActive = $true
} | ConvertTo-Json

# Save without BOM to avoid JSON parsing issues
$config | Out-File -FilePath $ConfigFile -Encoding UTF8 -NoNewline

Write-Host "✅ Configuration saved to $ConfigFile"

# 4. Create Local Port (if not exists)
$portExists = Get-PrinterPort -Name $CaptureFile -ErrorAction SilentlyContinue
if (!$portExists) {
    Add-PrinterPort -Name $CaptureFile -ErrorAction SilentlyContinue
    Write-Host "✅ Created printer port: $CaptureFile" -ForegroundColor Green
}

# 5. Switch printer to File Port
Set-Printer -Name $PrinterName -PortName $CaptureFile
Write-Host "✅ Printer '$PrinterName' redirected to Capture File" -ForegroundColor Green

# 6. Display status
Write-Host ""
Write-Host "🌉 Bridge Configuration Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "How it works:" -ForegroundColor Cyan
Write-Host "1. POS prints to '$PrinterName' (now File Port)" -ForegroundColor White
Write-Host "2. Windows saves raw data to: $CaptureFile" -ForegroundColor White
Write-Host "3. Tabeza Service detects file change" -ForegroundColor White
Write-Host "4. Service forwards data to physical port: $originalPort" -ForegroundColor White
Write-Host "5. Physical printer prints receipt" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  CRITICAL: Service must stay running for physical printing!" -ForegroundColor Yellow
Write-Host "   If service stops, printing stops working." -ForegroundColor Yellow
