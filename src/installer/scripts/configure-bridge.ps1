# Tabeza Connect - Bridge Configuration Script
# Configures the silent bridge with detected printer

param(
    [Parameter(Mandatory=$true)]
    [string]$BarId,
    
    [Parameter(Mandatory=$true)]
    [string]$ConfigFile
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Tabeza Connect - Bridge Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    # Load detected printer info
    $detectedPrinterFile = "C:\ProgramData\Tabeza\detected-printer.json"
    
    if (-not (Test-Path $detectedPrinterFile)) {
        Write-Host "ERROR: Detected printer file not found!" -ForegroundColor Red
        Write-Host "Expected: $detectedPrinterFile" -ForegroundColor Red
        exit 1
    }
    
    $printerInfo = Get-Content $detectedPrinterFile | ConvertFrom-Json
    Write-Host "Configuring printer: $($printerInfo.printerName)" -ForegroundColor Yellow
    Write-Host ""
    
    # Define folders
    $captureFolder = "C:\TabezaPrints"
    $tempFolder = "C:\TabezaPrints\temp"
    
    # Create folders
    Write-Host "Creating folders..." -ForegroundColor Yellow
    foreach ($folder in @($captureFolder, $tempFolder)) {
        if (-not (Test-Path $folder)) {
            New-Item -ItemType Directory -Path $folder -Force | Out-Null
            Write-Host "  Created: $folder" -ForegroundColor Green
        } else {
            Write-Host "  Exists: $folder" -ForegroundColor Gray
        }
    }
    Write-Host ""
    
    # Set folder permissions (Everyone: Full Control)
    Write-Host "Setting folder permissions..." -ForegroundColor Yellow
    foreach ($folder in @($captureFolder, $tempFolder)) {
        $acl = Get-Acl $folder
        $permission = "Everyone", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
        $acl.SetAccessRule($rule)
        Set-Acl $folder $acl
        Write-Host "  Set permissions: $folder" -ForegroundColor Green
    }
    Write-Host ""
    
    # Configure printer to use folder port for receipt capture
    # IMPORTANT: We do NOT change the printer port!
    # The printer stays on its original port so it can still print physically.
    # The bridge service will monitor the print spooler to capture jobs.
    Write-Host "Printer configuration:" -ForegroundColor Yellow
    Write-Host "  Printer: $($printerInfo.printerName)" -ForegroundColor Gray
    Write-Host "  Port: $($printerInfo.originalPortName) (unchanged)" -ForegroundColor Gray
    Write-Host "  Capture folder: $captureFolder" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "NOTE: Printer port is NOT changed - physical printing will work normally" -ForegroundColor Green
    Write-Host "The bridge service will capture print jobs from the spooler" -ForegroundColor Green
    Write-Host ""
    
    # CRITICAL: Restart print spooler to clear error state
    Write-Host "Restarting print spooler..." -ForegroundColor Yellow
    Restart-Service Spooler -Force
    Start-Sleep -Seconds 3
    Write-Host "  Spooler restarted" -ForegroundColor Green
    Write-Host ""
    
    # Verify printer status
    Write-Host "Verifying printer status..." -ForegroundColor Yellow
    $printer = Get-Printer -Name $printerInfo.printerName
    Write-Host "  Status: $($printer.PrinterStatus)" -ForegroundColor $(if ($printer.PrinterStatus -eq "Normal") { "Green" } else { "Yellow" })
    Write-Host ""
    
    # Create unified config.json
    Write-Host "Creating configuration file..." -ForegroundColor Yellow
    
    $config = @{
        barId = $BarId
        apiUrl = "https://bkaigyrrzsqbfscyznzw.supabase.co"
        bridge = @{
            enabled = $true
            printerName = $printerInfo.printerName
            originalPort = $printerInfo.originalPortName
            captureFolder = $captureFolder
            tempFolder = $tempFolder
            autoConfigure = $true
        }
        service = @{
            name = "TabezaConnect"
            displayName = "Tabeza POS Connect"
            description = "Captures receipt data from POS and syncs with Tabeza staff app"
            port = 8765
        }
        sync = @{
            intervalSeconds = 30
            retryAttempts = 3
            retryDelaySeconds = 60
        }
    }
    
    # Ensure config directory exists
    $configDir = Split-Path -Parent $ConfigFile
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }
    
    # Write config to file
    $config | ConvertTo-Json -Depth 10 | Set-Content -Path $ConfigFile -Encoding UTF8
    Write-Host "  Configuration saved: $ConfigFile" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Bridge Configuration Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    # Write status
    & "$PSScriptRoot\write-status.ps1" -StepNumber 3 -StepName "Bridge configured" -Success $true -Details "Printer: $($printerInfo.printerName)"
    
    exit 0
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Bridge configuration failed" -ForegroundColor Red
    Write-Host "Details: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    
    # Write status
    & "$PSScriptRoot\write-status.ps1" -StepNumber 3 -StepName "Bridge configured" -Success $false -Details $_.Exception.Message
    
    exit 1
}
