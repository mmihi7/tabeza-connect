# configure-clawpdf.ps1
# Configures clawPDF printer profile for Tabeza Connect
# Creates "Tabeza POS Printer" with automatic spool folder output

param(
    [string]$PrinterName = "Tabeza POS Printer",
    [string]$SpoolFolder = "C:\TabezaPrints\spool",
    [string]$LogPath = "$env:TEMP\TabezaConnect-clawPDF-config.log"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Tabeza Connect - clawPDF Configuration ===" -ForegroundColor Cyan
Write-Host "Printer Name: $PrinterName"
Write-Host "Spool Folder: $SpoolFolder"
Write-Host "Log: $LogPath"
Write-Host ""

# Start logging
Start-Transcript -Path $LogPath -Append

try {
    # Check if clawPDF is installed
    $clawPDFPath = "C:\Program Files\clawPDF"
    if (-not (Test-Path $clawPDFPath)) {
        $clawPDFPath = "C:\Program Files (x86)\clawPDF"
        if (-not (Test-Path $clawPDFPath)) {
            Write-Host "ERROR: clawPDF installation not found" -ForegroundColor Red
            Stop-Transcript
            exit 1
        }
    }
    
    Write-Host "Found clawPDF at: $clawPDFPath" -ForegroundColor Green
    
    # Create spool folder if it doesn't exist
    if (-not (Test-Path $SpoolFolder)) {
        Write-Host "Creating spool folder: $SpoolFolder" -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $SpoolFolder -Force | Out-Null
    }
    
    # Set permissions on spool folder (Everyone: Full Control)
    Write-Host "Setting permissions on spool folder..." -ForegroundColor Yellow
    $acl = Get-Acl $SpoolFolder
    $permission = "Everyone", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"
    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
    $acl.SetAccessRule($accessRule)
    Set-Acl $SpoolFolder $acl
    
    # Check if clawPDF printer already exists
    $existingPrinter = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
    
    if ($existingPrinter) {
        Write-Host "Printer '$PrinterName' already exists" -ForegroundColor Yellow
        Write-Host "Updating configuration..." -ForegroundColor Yellow
    } else {
        Write-Host "Printer '$PrinterName' not found, will be created by clawPDF" -ForegroundColor Yellow
    }
    
    # clawPDF configuration is typically stored in:
    # - Registry: HKCU\Software\clawSoft\clawPDF
    # - INI files: %APPDATA%\clawSoft\clawPDF\
    
    $clawPDFConfigPath = "$env:APPDATA\clawSoft\clawPDF"
    
    if (-not (Test-Path $clawPDFConfigPath)) {
        Write-Host "Creating clawPDF config directory: $clawPDFConfigPath" -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $clawPDFConfigPath -Force | Out-Null
    }
    
    # Create a basic clawPDF settings file
    # Note: Actual clawPDF configuration format may vary by version
    # This creates a template that can be customized
    $settingsFile = "$clawPDFConfigPath\Settings.ini"
    
    $settingsContent = @"
[ApplicationSettings]
PrinterName=$PrinterName
AutoSaveEnabled=true
AutoSaveDirectory=$SpoolFolder
AutoSaveFilename=<DateTime>_<JobID>.ps
OutputFormat=PostScript
ShowQuickActions=false
ShowProgress=false
OpenFileEnabled=false
OpenWithPdfArchitect=false

[ConversionProfiles]
DefaultProfile=TabezaProfile

[TabezaProfile]
Name=Tabeza POS Printer Profile
OutputFormat=PostScript
TargetDirectory=$SpoolFolder
FileNameTemplate=<DateTime>_<JobID>
AutoSave=true
ShowProgress=false
ShowQuickActions=false
OpenFile=false
"@
    
    Write-Host "Writing clawPDF settings to: $settingsFile" -ForegroundColor Yellow
    $settingsContent | Out-File -FilePath $settingsFile -Encoding UTF8 -Force
    
    # Configure registry settings for clawPDF using dedicated script
    Write-Host "Configuring registry settings for silent operation..." -ForegroundColor Yellow
    
    $registryScriptPath = Join-Path $PSScriptRoot "set-clawpdf-registry.ps1"
    
    if (Test-Path $registryScriptPath) {
        Write-Host "  Running: $registryScriptPath" -ForegroundColor Gray
        
        # Execute registry configuration script
        $profileGuid = & $registryScriptPath -SpoolFolder $SpoolFolder -PrinterName $PrinterName -LogPath "$env:TEMP\TabezaConnect-clawPDF-registry.log"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Registry configuration completed successfully" -ForegroundColor Green
            Write-Host "  Profile GUID: $profileGuid" -ForegroundColor Gray
        } else {
            Write-Host "  ✗ Registry configuration failed with exit code: $LASTEXITCODE" -ForegroundColor Red
            throw "Registry configuration failed"
        }
    } else {
        Write-Host "  WARNING: Registry script not found at: $registryScriptPath" -ForegroundColor Yellow
        Write-Host "  Falling back to basic registry configuration..." -ForegroundColor Yellow
        
        # Fallback: Basic registry configuration
        $regPath = "HKCU:\Software\clawSoft\clawPDF"
        
        if (-not (Test-Path $regPath)) {
            Write-Host "  Creating registry key: $regPath" -ForegroundColor Gray
            New-Item -Path $regPath -Force | Out-Null
        }
        
        # Set basic registry values
        Set-ItemProperty -Path $regPath -Name "AutoSaveDirectory" -Value $SpoolFolder -Type String
        Set-ItemProperty -Path $regPath -Name "AutoSaveEnabled" -Value 1 -Type DWord
        Set-ItemProperty -Path $regPath -Name "OutputFormat" -Value "Pdf" -Type String
        
        Write-Host "  ✓ Basic registry configuration completed" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "=== Configuration Complete ===" -ForegroundColor Green
    Write-Host "Printer Name: $PrinterName" -ForegroundColor Green
    Write-Host "Spool Folder: $SpoolFolder" -ForegroundColor Green
    Write-Host "Settings File: $settingsFile" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Verify '$PrinterName' appears in Windows Printers" -ForegroundColor Cyan
    Write-Host "2. Configure your POS to print to '$PrinterName'" -ForegroundColor Cyan
    Write-Host "3. Test print - files should appear in: $SpoolFolder" -ForegroundColor Cyan
    
    Stop-Transcript
    exit 0
    
} catch {
    Write-Host "ERROR: Exception during clawPDF configuration" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Stop-Transcript
    exit 1
}
