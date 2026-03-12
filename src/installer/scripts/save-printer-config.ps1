# save-printer-config.ps1
# Saves detected printer configuration to config.json
# This script is called by the Inno Setup installer after printer detection

param(
    [string]$DetectionFile = "$env:TEMP\printer-detection.json",
    [string]$ConfigFile = "C:\TabezaPrints\config.json"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Tabeza Connect - Save Printer Configuration ===" -ForegroundColor Cyan
Write-Host "Detection File: $DetectionFile"
Write-Host "Config File: $ConfigFile"
Write-Host ""

try {
    # Check if detection file exists
    if (-not (Test-Path $DetectionFile)) {
        Write-Host "WARNING: Detection file not found at: $DetectionFile" -ForegroundColor Yellow
        Write-Host "Skipping printer configuration..." -ForegroundColor Yellow
        exit 0
    }
    
    # Read detection results
    $detectionData = Get-Content $DetectionFile -Raw | ConvertFrom-Json
    
    if (-not $detectionData.printers -or $detectionData.printers.Count -eq 0) {
        Write-Host "No printers detected - skipping configuration" -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host "Found $($detectionData.printers.Count) printer(s) in detection file" -ForegroundColor Green
    
    # Read existing config.json or create new one
    $config = @{}
    
    if (Test-Path $ConfigFile) {
        Write-Host "Loading existing config from: $ConfigFile" -ForegroundColor Yellow
        $config = Get-Content $ConfigFile -Raw | ConvertFrom-Json -AsHashtable
    } else {
        Write-Host "Creating new config file" -ForegroundColor Yellow
    }
    
    # Add printers array to config
    $config.printers = @()
    
    foreach ($printer in $detectionData.printers) {
        $printerConfig = @{
            name = $printer.name
            type = $printer.type
            enabled = $true
            isDefault = ($printer -eq $detectionData.printers[0])  # First printer is default
            connection = $printer.connection
        }
        
        $config.printers += $printerConfig
        
        Write-Host "  Added: $($printer.name) ($($printer.type))" -ForegroundColor Gray
    }
    
    # Ensure config directory exists
    $configDir = Split-Path $ConfigFile -Parent
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }
    
    # Write config.json
    $config | ConvertTo-Json -Depth 10 | Out-File -FilePath $ConfigFile -Encoding UTF8 -Force
    
    Write-Host ""
    Write-Host "✅ Printer configuration saved successfully" -ForegroundColor Green
    Write-Host "Config file: $ConfigFile" -ForegroundColor Green
    Write-Host "Printers configured: $($config.printers.Count)" -ForegroundColor Green
    
    exit 0
    
} catch {
    Write-Host "ERROR: Failed to save printer configuration" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
