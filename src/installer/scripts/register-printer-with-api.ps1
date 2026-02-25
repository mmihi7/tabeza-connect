# Tabeza Connect - Printer Registration Script
# Registers the printer driver with Tabeza API

param(
    [Parameter(Mandatory=$true)]
    [string]$BarId,
    
    [Parameter(Mandatory=$true)]
    [string]$ConfigFile
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Tabeza Connect - Printer Registration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    # Load config
    if (-not (Test-Path $ConfigFile)) {
        Write-Host "ERROR: Configuration file not found!" -ForegroundColor Red
        Write-Host "Expected: $ConfigFile" -ForegroundColor Red
        exit 1
    }
    
    $config = Get-Content $ConfigFile | ConvertFrom-Json
    
    # Generate driver ID
    $driverId = "driver-$env:COMPUTERNAME-$(Get-Date -Format 'yyyyMMddHHmmss')"
    
    Write-Host "Registering printer with Tabeza..." -ForegroundColor Yellow
    Write-Host "  Bar ID: $BarId" -ForegroundColor Gray
    Write-Host "  Driver ID: $driverId" -ForegroundColor Gray
    Write-Host "  Printer: $($config.bridge.printerName)" -ForegroundColor Gray
    Write-Host ""
    
    # Prepare registration data
    $registrationData = @{
        bar_id = $BarId
        driver_id = $driverId
        version = "1.6.1"
        status = "online"
        last_heartbeat = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        first_seen = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        metadata = @{
            printer_name = $config.bridge.printerName
            computer_name = $env:COMPUTERNAME
            install_date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        } | ConvertTo-Json
    } | ConvertTo-Json
    
    # Register with Tabeza API
    $apiUrl = $config.apiUrl
    $endpoint = "$apiUrl/rest/v1/printer_drivers"
    
    # Get Supabase anon key (public key - safe to use)
    $anonKey = "sb_publishable_-RItbICa9f_G0IpfwZ3vig_FLw0-FR2"
    
    $headers = @{
        "apikey" = $anonKey
        "Authorization" = "Bearer $anonKey"
        "Content-Type" = "application/json"
        "Prefer" = "return=representation"
    }
    
    # Make API call
    $response = Invoke-RestMethod -Uri $endpoint -Method Post -Headers $headers -Body $registrationData -ErrorAction Stop
    
    Write-Host "✅ Printer registered successfully!" -ForegroundColor Green
    Write-Host "   Driver ID: $driverId" -ForegroundColor Gray
    Write-Host ""
    
    # Update config with driver ID
    $config | Add-Member -NotePropertyName "driverId" -NotePropertyValue $driverId -Force
    $config | ConvertTo-Json -Depth 10 | Set-Content -Path $ConfigFile -Encoding UTF8
    
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Registration Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    # Write status
    & "$PSScriptRoot\write-status.ps1" -StepNumber 6 -StepName "Printer registered with Tabeza API" -Success $true -Details "Driver ID: $driverId"
    
    exit 0
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Printer registration failed" -ForegroundColor Red
    Write-Host "Details: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "The service will still work, but the printer" -ForegroundColor Yellow
    Write-Host "may not appear in the Tabeza staff app." -ForegroundColor Yellow
    Write-Host ""
    
    # Write status
    & "$PSScriptRoot\write-status.ps1" -StepNumber 6 -StepName "Printer registered with Tabeza API" -Success $false -Details $_.Exception.Message
    
    exit 0  # Don't fail installation
}
