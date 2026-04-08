# set-clawpdf-registry.ps1
# Configures clawPDF registry keys for silent operation
# Sets up automatic saving to spool folder with no UI prompts

param(
    [string]$SpoolFolder = "C:\TabezaPrints\spool",
    [string]$PrinterName = "Tabeza Agent",
    [int]$ProfileNumber = 0,
    [string]$LogPath = "$env:TEMP\TabezaConnect-clawPDF-registry.log"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Tabeza Connect - clawPDF Registry Configuration ===" -ForegroundColor Cyan
Write-Host "Spool Folder: $SpoolFolder"
Write-Host "Printer Name: $PrinterName"
Write-Host "Profile Number: $ProfileNumber"
Write-Host "Log: $LogPath"
Write-Host ""

# Start logging
Start-Transcript -Path $LogPath -Append

try {
    # ============================================================================
    # SECTION 1: Base Registry Paths
    # ============================================================================
    
    $baseRegPath = "HKCU:\Software\clawSoft\clawPDF"
    $settingsPath = "$baseRegPath\Settings"
    $appSettingsPath = "$settingsPath\ApplicationSettings"
    $profilePath = "$settingsPath\ConversionProfiles\$ProfileNumber"
    $autoSavePath = "$profilePath\AutoSave"
    $pdfSettingsPath = "$profilePath\PdfSettings"
    $printerMappingsPath = "$appSettingsPath\PrinterMappings"
    
    Write-Host "Registry paths:" -ForegroundColor Yellow
    Write-Host "  Base: $baseRegPath"
    Write-Host "  Profile: $profilePath"
    Write-Host "  AutoSave: $autoSavePath"
    Write-Host ""
    
    # ============================================================================
    # SECTION 2: Create Registry Structure
    # ============================================================================
    
    Write-Host "Creating registry structure..." -ForegroundColor Yellow
    
    $pathsToCreate = @(
        $baseRegPath,
        $settingsPath,
        $appSettingsPath,
        "$settingsPath\ConversionProfiles",
        $profilePath,
        $autoSavePath,
        $pdfSettingsPath,
        $printerMappingsPath
    )
    
    foreach ($path in $pathsToCreate) {
        if (-not (Test-Path $path)) {
            Write-Host "  Creating: $path" -ForegroundColor Gray
            New-Item -Path $path -Force | Out-Null
        } else {
            Write-Host "  Exists: $path" -ForegroundColor Gray
        }
    }
    
    Write-Host "✓ Registry structure created" -ForegroundColor Green
    Write-Host ""
    
    # ============================================================================
    # SECTION 3: Profile Identification (TASK 1.3.3)
    # ============================================================================
    
    Write-Host "Configuring profile identification..." -ForegroundColor Yellow
    
    # Generate or retrieve profile GUID
    # This GUID is used to map the printer to this specific profile
    # and can be used in command-line operations
    $existingGuid = Get-ItemProperty -Path $profilePath -Name "Guid" -ErrorAction SilentlyContinue
    
    if ($existingGuid -and $existingGuid.Guid) {
        $profileGuid = $existingGuid.Guid
        Write-Host "  Using existing GUID: $profileGuid" -ForegroundColor Gray
    } else {
        $profileGuid = [System.Guid]::NewGuid().ToString()
        Write-Host "  Generated new GUID: $profileGuid" -ForegroundColor Gray
        Set-ItemProperty -Path $profilePath -Name "Guid" -Value $profileGuid -Type String
    }
    
    # Set profile name
    Set-ItemProperty -Path $profilePath -Name "Name" -Value "Tabeza Agent Profile" -Type String
    Write-Host "  Name = Tabeza Agent Profile" -ForegroundColor Gray
    
    # Set this as the default profile for the application
    Set-ItemProperty -Path $appSettingsPath -Name "LastUsedProfileGuid" -Value $profileGuid -Type String
    Write-Host "  LastUsedProfileGuid = $profileGuid (set as default)" -ForegroundColor Gray
    
    Write-Host "✓ Profile identification configured" -ForegroundColor Green
    Write-Host ""
    
    # ============================================================================
    # SECTION 4: Output Format Settings
    # ============================================================================
    
    Write-Host "Configuring output format..." -ForegroundColor Yellow
    
    # Set output format to PDF (clawPDF will capture as PostScript internally)
    Set-ItemProperty -Path $profilePath -Name "OutputFormat" -Value "Pdf" -Type String
    Write-Host "  OutputFormat = Pdf" -ForegroundColor Gray
    
    Write-Host "✓ Output format configured" -ForegroundColor Green
    Write-Host ""
    
    # ============================================================================
    # SECTION 5: Silent Operation Settings (CRITICAL)
    # ============================================================================
    
    Write-Host "Configuring silent operation (CRITICAL)..." -ForegroundColor Yellow
    
    # Disable PDF viewer opening (MUST be 0 for silent operation)
    Set-ItemProperty -Path $profilePath -Name "OpenViewer" -Value 0 -Type DWord
    Write-Host "  OpenViewer = 0 (disabled)" -ForegroundColor Gray
    
    # Disable quick actions dialog
    Set-ItemProperty -Path $profilePath -Name "ShowQuickActions" -Value 0 -Type DWord
    Write-Host "  ShowQuickActions = 0 (disabled)" -ForegroundColor Gray
    
    # Disable progress window
    Set-ItemProperty -Path $profilePath -Name "ShowProgress" -Value 0 -Type DWord
    Write-Host "  ShowProgress = 0 (disabled)" -ForegroundColor Gray
    
    # Disable "Open file after saving" option
    Set-ItemProperty -Path $profilePath -Name "OpenFile" -Value 0 -Type DWord
    Write-Host "  OpenFile = 0 (disabled)" -ForegroundColor Gray
    
    Write-Host "✓ Silent operation configured" -ForegroundColor Green
    Write-Host ""
    
    # ============================================================================
    # SECTION 6: AutoSave Settings (CRITICAL - TASK 1.3.3)
    # ============================================================================
    
    Write-Host "Configuring AutoSave with file naming pattern (CRITICAL)..." -ForegroundColor Yellow
    
    # Enable automatic saving
    Set-ItemProperty -Path $autoSavePath -Name "Enabled" -Value 1 -Type DWord
    Write-Host "  Enabled = 1 (enabled)" -ForegroundColor Gray
    
    # Set target directory (spool folder)
    # Ensure path ends with backslash for clawPDF compatibility
    $normalizedSpoolFolder = $SpoolFolder.TrimEnd('\') + '\'
    Set-ItemProperty -Path $autoSavePath -Name "TargetDirectory" -Value $normalizedSpoolFolder -Type String
    Write-Host "  TargetDirectory = $normalizedSpoolFolder" -ForegroundColor Gray
    
    # Set filename pattern with tokens (TASK 1.3.3 REQUIREMENT)
    # <DateTime> = YYYYMMDD-HHMMSS format (e.g., 20260307-143022)
    # <JobID> = Unique job identifier from clawPDF
    # This pattern ensures:
    # 1. Chronological sorting by filename
    # 2. Uniqueness via JobID
    # 3. Easy identification of capture time
    $filenamePattern = "<DateTime>_<JobID>"
    Set-ItemProperty -Path $autoSavePath -Name "Filename" -Value $filenamePattern -Type String
    Write-Host "  Filename = $filenamePattern" -ForegroundColor Gray
    Write-Host "    Token <DateTime> expands to: YYYYMMDD-HHMMSS" -ForegroundColor DarkGray
    Write-Host "    Token <JobID> expands to: unique job identifier" -ForegroundColor DarkGray
    Write-Host "    Example output: 20260307-143022_abc123.pdf" -ForegroundColor DarkGray
    
    # Ensure unique filenames (prevent overwrites)
    # If a file with the same name exists, clawPDF will append (1), (2), etc.
    Set-ItemProperty -Path $autoSavePath -Name "EnsureUniqueFilenames" -Value 1 -Type DWord
    Write-Host "  EnsureUniqueFilenames = 1 (enabled)" -ForegroundColor Gray
    
    # Set file extension based on output format
    # For PDF output, extension will be .pdf
    Set-ItemProperty -Path $autoSavePath -Name "FileExtension" -Value "pdf" -Type String
    Write-Host "  FileExtension = pdf" -ForegroundColor Gray
    
    Write-Host "✓ AutoSave and file naming pattern configured" -ForegroundColor Green
    Write-Host ""
    
    # ============================================================================
    # SECTION 7: PDF Settings (Performance Optimization)
    # ============================================================================
    
    Write-Host "Configuring PDF settings..." -ForegroundColor Yellow
    
    # Disable compression for faster processing
    Set-ItemProperty -Path $pdfSettingsPath -Name "CompressColorAndGray" -Value 0 -Type DWord
    Write-Host "  CompressColorAndGray = 0 (disabled for speed)" -ForegroundColor Gray
    
    # Disable security/encryption
    $securityPath = "$pdfSettingsPath\Security"
    if (-not (Test-Path $securityPath)) {
        New-Item -Path $securityPath -Force | Out-Null
    }
    Set-ItemProperty -Path $securityPath -Name "Enabled" -Value 0 -Type DWord
    Write-Host "  Security\Enabled = 0 (disabled)" -ForegroundColor Gray
    
    Write-Host "✓ PDF settings configured" -ForegroundColor Green
    Write-Host ""
    
    # ============================================================================
    # SECTION 8: Application Settings
    # ============================================================================
    
    Write-Host "Configuring application settings..." -ForegroundColor Yellow
    
    # Disable update checks (for stability)
    Set-ItemProperty -Path $appSettingsPath -Name "UpdateInterval" -Value 0 -Type DWord
    Write-Host "  UpdateInterval = 0 (disabled)" -ForegroundColor Gray
    
    # Set logging level to Error only (reduce log noise)
    Set-ItemProperty -Path $appSettingsPath -Name "LoggingLevel" -Value "Error" -Type String
    Write-Host "  LoggingLevel = Error" -ForegroundColor Gray
    
    # Set language to English
    Set-ItemProperty -Path $appSettingsPath -Name "Language" -Value "en" -Type String
    Write-Host "  Language = en" -ForegroundColor Gray
    
    Write-Host "✓ Application settings configured" -ForegroundColor Green
    Write-Host ""
    
    # ============================================================================
    # SECTION 9: Printer Mapping (TASK 1.3.3)
    # ============================================================================
    
    Write-Host "Configuring printer mapping..." -ForegroundColor Yellow
    
    # Map printer name to profile GUID
    # This tells clawPDF which profile to use when printing to "Tabeza Agent"
    Set-ItemProperty -Path $printerMappingsPath -Name $PrinterName -Value $profileGuid -Type String
    Write-Host "  $PrinterName -> $profileGuid" -ForegroundColor Gray
    
    # Also set as the default printer mapping
    Set-ItemProperty -Path $appSettingsPath -Name "PrimaryPrinter" -Value $PrinterName -Type String
    Write-Host "  PrimaryPrinter = $PrinterName" -ForegroundColor Gray
    
    Write-Host "✓ Printer mapping configured" -ForegroundColor Green
    Write-Host ""
    
    # ============================================================================
    # SECTION 10: Verification (TASK 1.3.3 VALIDATION)
    # ============================================================================
    
    Write-Host "Verifying configuration..." -ForegroundColor Yellow
    
    $verificationChecks = @{
        "Profile\Guid" = @{ Path = $profilePath; Name = "Guid"; Expected = $profileGuid }
        "Profile\Name" = @{ Path = $profilePath; Name = "Name"; Expected = "Tabeza Agent Profile" }
        "Profile\OutputFormat" = @{ Path = $profilePath; Name = "OutputFormat"; Expected = "Pdf" }
        "Profile\OpenViewer" = @{ Path = $profilePath; Name = "OpenViewer"; Expected = 0 }
        "Profile\ShowQuickActions" = @{ Path = $profilePath; Name = "ShowQuickActions"; Expected = 0 }
        "Profile\ShowProgress" = @{ Path = $profilePath; Name = "ShowProgress"; Expected = 0 }
        "AutoSave\Enabled" = @{ Path = $autoSavePath; Name = "Enabled"; Expected = 1 }
        "AutoSave\TargetDirectory" = @{ Path = $autoSavePath; Name = "TargetDirectory"; Expected = $normalizedSpoolFolder }
        "AutoSave\Filename" = @{ Path = $autoSavePath; Name = "Filename"; Expected = $filenamePattern }
        "AutoSave\EnsureUniqueFilenames" = @{ Path = $autoSavePath; Name = "EnsureUniqueFilenames"; Expected = 1 }
        "AutoSave\FileExtension" = @{ Path = $autoSavePath; Name = "FileExtension"; Expected = "pdf" }
        "PrinterMapping" = @{ Path = $printerMappingsPath; Name = $PrinterName; Expected = $profileGuid }
    }
    
    $allPassed = $true
    
    foreach ($checkName in $verificationChecks.Keys) {
        $check = $verificationChecks[$checkName]
        $value = Get-ItemProperty -Path $check.Path -Name $check.Name -ErrorAction SilentlyContinue
        
        if ($value.($check.Name) -eq $check.Expected) {
            Write-Host "  ✓ $checkName" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $checkName (Expected: $($check.Expected), Got: $($value.($check.Name)))" -ForegroundColor Red
            $allPassed = $false
        }
    }
    
    if (-not $allPassed) {
        Write-Host ""
        Write-Host "WARNING: Some verification checks failed" -ForegroundColor Yellow
        Write-Host "Registry configuration may not be complete" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "=== Configuration Complete ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Registry Configuration Summary:" -ForegroundColor Cyan
    Write-Host "  Profile GUID: $profileGuid" -ForegroundColor Cyan
    Write-Host "  Profile Name: Tabeza Agent Profile" -ForegroundColor Cyan
    Write-Host "  Output Format: PDF" -ForegroundColor Cyan
    Write-Host "  Silent Operation: Enabled" -ForegroundColor Cyan
    Write-Host "  AutoSave: Enabled" -ForegroundColor Cyan
    Write-Host "  Spool Folder: $normalizedSpoolFolder" -ForegroundColor Cyan
    Write-Host "  File Naming Pattern: $filenamePattern" -ForegroundColor Cyan
    Write-Host "  Example Output File: 20260307-143022_abc123.pdf" -ForegroundColor Cyan
    Write-Host "  Printer Mapping: $PrinterName -> Profile $ProfileNumber (GUID: $profileGuid)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Restart clawPDF service (if running)" -ForegroundColor Cyan
    Write-Host "2. Test print to '$PrinterName'" -ForegroundColor Cyan
    Write-Host "3. Verify files appear in: $normalizedSpoolFolder" -ForegroundColor Cyan
    Write-Host "4. Verify filename format: YYYYMMDD-HHMMSS_JobID.pdf" -ForegroundColor Cyan
    Write-Host "5. Verify NO PDF viewer opens (silent operation)" -ForegroundColor Cyan
    Write-Host ""
    
    # Return profile GUID for use by calling scripts
    Stop-Transcript
    
    # Output profile GUID to stdout for capture
    Write-Output $profileGuid
    
    exit 0
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Exception during registry configuration" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Stack Trace:" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    
    Stop-Transcript
    exit 1
}
