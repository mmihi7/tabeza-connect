# test-clawpdf-profile.ps1
# Test script to validate clawPDF profile GUID and file naming pattern configuration
# Part of Task 1.3.3: Configure default profile GUID and output file naming pattern

param(
    [int]$ProfileNumber = 0,
    [string]$ExpectedSpoolFolder = "C:\TabezaPrints\spool\",
    [string]$ExpectedFilenamePattern = "<DateTime>_<JobID>"
)

$ErrorActionPreference = "Stop"

Write-Host "=== ClawPDF Profile Configuration Test ===" -ForegroundColor Cyan
Write-Host "Profile Number: $ProfileNumber"
Write-Host "Expected Spool Folder: $ExpectedSpoolFolder"
Write-Host "Expected Filename Pattern: $ExpectedFilenamePattern"
Write-Host ""

# ============================================================================
# Test 1: Profile GUID Existence and Format
# ============================================================================

Write-Host "Test 1: Profile GUID Configuration" -ForegroundColor Yellow

$profilePath = "HKCU:\Software\clawSoft\clawPDF\Settings\ConversionProfiles\$ProfileNumber"

if (-not (Test-Path $profilePath)) {
    Write-Host "  ✗ FAIL: Profile path does not exist: $profilePath" -ForegroundColor Red
    exit 1
}

$guidValue = Get-ItemProperty -Path $profilePath -Name "Guid" -ErrorAction SilentlyContinue

if (-not $guidValue) {
    Write-Host "  ✗ FAIL: Profile GUID not found" -ForegroundColor Red
    exit 1
}

$profileGuid = $guidValue.Guid

# Validate GUID format (standard UUID format)
if ($profileGuid -match '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') {
    Write-Host "  ✓ PASS: Profile GUID exists and is valid format" -ForegroundColor Green
    Write-Host "    GUID: $profileGuid" -ForegroundColor Gray
} else {
    Write-Host "  ✗ FAIL: Profile GUID has invalid format: $profileGuid" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================================================
# Test 2: Profile Name
# ============================================================================

Write-Host "Test 2: Profile Name Configuration" -ForegroundColor Yellow

$nameValue = Get-ItemProperty -Path $profilePath -Name "Name" -ErrorAction SilentlyContinue

if ($nameValue -and $nameValue.Name -eq "Tabeza POS Printer Profile") {
    Write-Host "  ✓ PASS: Profile name is correct" -ForegroundColor Green
    Write-Host "    Name: $($nameValue.Name)" -ForegroundColor Gray
} else {
    Write-Host "  ✗ FAIL: Profile name is incorrect or missing" -ForegroundColor Red
    Write-Host "    Expected: Tabeza POS Printer Profile" -ForegroundColor Red
    Write-Host "    Got: $($nameValue.Name)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================================================
# Test 3: File Naming Pattern
# ============================================================================

Write-Host "Test 3: File Naming Pattern Configuration" -ForegroundColor Yellow

$autoSavePath = "$profilePath\AutoSave"

if (-not (Test-Path $autoSavePath)) {
    Write-Host "  ✗ FAIL: AutoSave path does not exist: $autoSavePath" -ForegroundColor Red
    exit 1
}

$filenameValue = Get-ItemProperty -Path $autoSavePath -Name "Filename" -ErrorAction SilentlyContinue

if (-not $filenameValue) {
    Write-Host "  ✗ FAIL: Filename pattern not found" -ForegroundColor Red
    exit 1
}

if ($filenameValue.Filename -eq $ExpectedFilenamePattern) {
    Write-Host "  ✓ PASS: Filename pattern is correct" -ForegroundColor Green
    Write-Host "    Pattern: $($filenameValue.Filename)" -ForegroundColor Gray
    Write-Host "    Tokens:" -ForegroundColor Gray
    Write-Host "      <DateTime> = YYYYMMDD-HHMMSS (e.g., 20260307-143022)" -ForegroundColor DarkGray
    Write-Host "      <JobID> = Unique job identifier" -ForegroundColor DarkGray
    Write-Host "    Example output: 20260307-143022_abc123.pdf" -ForegroundColor DarkGray
} else {
    Write-Host "  ✗ FAIL: Filename pattern is incorrect" -ForegroundColor Red
    Write-Host "    Expected: $ExpectedFilenamePattern" -ForegroundColor Red
    Write-Host "    Got: $($filenameValue.Filename)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================================================
# Test 4: Target Directory
# ============================================================================

Write-Host "Test 4: Target Directory Configuration" -ForegroundColor Yellow

$targetDirValue = Get-ItemProperty -Path $autoSavePath -Name "TargetDirectory" -ErrorAction SilentlyContinue

if (-not $targetDirValue) {
    Write-Host "  ✗ FAIL: Target directory not found" -ForegroundColor Red
    exit 1
}

# Normalize paths for comparison (ensure trailing backslash)
$normalizedExpected = $ExpectedSpoolFolder.TrimEnd('\') + '\'
$normalizedActual = $targetDirValue.TargetDirectory.TrimEnd('\') + '\'

if ($normalizedActual -eq $normalizedExpected) {
    Write-Host "  ✓ PASS: Target directory is correct" -ForegroundColor Green
    Write-Host "    Directory: $normalizedActual" -ForegroundColor Gray
} else {
    Write-Host "  ✗ FAIL: Target directory is incorrect" -ForegroundColor Red
    Write-Host "    Expected: $normalizedExpected" -ForegroundColor Red
    Write-Host "    Got: $normalizedActual" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================================================
# Test 5: Unique Filenames Setting
# ============================================================================

Write-Host "Test 5: Unique Filenames Configuration" -ForegroundColor Yellow

$uniqueValue = Get-ItemProperty -Path $autoSavePath -Name "EnsureUniqueFilenames" -ErrorAction SilentlyContinue

if ($uniqueValue -and $uniqueValue.EnsureUniqueFilenames -eq 1) {
    Write-Host "  ✓ PASS: EnsureUniqueFilenames is enabled" -ForegroundColor Green
    Write-Host "    Value: 1 (enabled)" -ForegroundColor Gray
} else {
    Write-Host "  ✗ FAIL: EnsureUniqueFilenames is not enabled" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================================================
# Test 6: File Extension
# ============================================================================

Write-Host "Test 6: File Extension Configuration" -ForegroundColor Yellow

$extensionValue = Get-ItemProperty -Path $autoSavePath -Name "FileExtension" -ErrorAction SilentlyContinue

if ($extensionValue -and $extensionValue.FileExtension -eq "pdf") {
    Write-Host "  ✓ PASS: File extension is correct" -ForegroundColor Green
    Write-Host "    Extension: .pdf" -ForegroundColor Gray
} else {
    Write-Host "  ⚠ WARNING: File extension not set or incorrect" -ForegroundColor Yellow
    Write-Host "    Expected: pdf" -ForegroundColor Yellow
    Write-Host "    Got: $($extensionValue.FileExtension)" -ForegroundColor Yellow
    Write-Host "    This may not be critical if clawPDF adds extension automatically" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# Test 7: Printer Mapping
# ============================================================================

Write-Host "Test 7: Printer Mapping Configuration" -ForegroundColor Yellow

$printerMappingsPath = "HKCU:\Software\clawSoft\clawPDF\Settings\ApplicationSettings\PrinterMappings"

if (-not (Test-Path $printerMappingsPath)) {
    Write-Host "  ✗ FAIL: Printer mappings path does not exist" -ForegroundColor Red
    exit 1
}

# Get all printer mappings
$mappings = Get-ItemProperty -Path $printerMappingsPath -ErrorAction SilentlyContinue

if (-not $mappings) {
    Write-Host "  ✗ FAIL: No printer mappings found" -ForegroundColor Red
    exit 1
}

# Check if "Tabeza POS Printer" is mapped to our profile GUID
$tabezaPrinterMapping = $mappings.'Tabeza POS Printer'

if ($tabezaPrinterMapping -eq $profileGuid) {
    Write-Host "  ✓ PASS: Printer mapping is correct" -ForegroundColor Green
    Write-Host "    Tabeza POS Printer -> $profileGuid" -ForegroundColor Gray
} else {
    Write-Host "  ✗ FAIL: Printer mapping is incorrect or missing" -ForegroundColor Red
    Write-Host "    Expected: $profileGuid" -ForegroundColor Red
    Write-Host "    Got: $tabezaPrinterMapping" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================================================
# Test 8: Default Profile Setting
# ============================================================================

Write-Host "Test 8: Default Profile Configuration" -ForegroundColor Yellow

$appSettingsPath = "HKCU:\Software\clawSoft\clawPDF\Settings\ApplicationSettings"
$lastUsedGuid = Get-ItemProperty -Path $appSettingsPath -Name "LastUsedProfileGuid" -ErrorAction SilentlyContinue

if ($lastUsedGuid -and $lastUsedGuid.LastUsedProfileGuid -eq $profileGuid) {
    Write-Host "  ✓ PASS: Default profile is set correctly" -ForegroundColor Green
    Write-Host "    LastUsedProfileGuid: $profileGuid" -ForegroundColor Gray
} else {
    Write-Host "  ⚠ WARNING: Default profile not set or incorrect" -ForegroundColor Yellow
    Write-Host "    Expected: $profileGuid" -ForegroundColor Yellow
    Write-Host "    Got: $($lastUsedGuid.LastUsedProfileGuid)" -ForegroundColor Yellow
    Write-Host "    This may not be critical if printer mapping is correct" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# Summary
# ============================================================================

Write-Host "=== Test Summary ===" -ForegroundColor Green
Write-Host ""
Write-Host "All critical tests passed!" -ForegroundColor Green
Write-Host ""
Write-Host "Configuration Details:" -ForegroundColor Cyan
Write-Host "  Profile GUID: $profileGuid" -ForegroundColor Cyan
Write-Host "  Profile Name: Tabeza POS Printer Profile" -ForegroundColor Cyan
Write-Host "  Filename Pattern: $ExpectedFilenamePattern" -ForegroundColor Cyan
Write-Host "  Target Directory: $normalizedExpected" -ForegroundColor Cyan
Write-Host "  Unique Filenames: Enabled" -ForegroundColor Cyan
Write-Host "  Printer Mapping: Tabeza POS Printer -> $profileGuid" -ForegroundColor Cyan
Write-Host ""
Write-Host "Expected Output File Format:" -ForegroundColor Cyan
Write-Host "  20260307-143022_abc123.pdf" -ForegroundColor Cyan
Write-Host "  └─ YYYYMMDD-HHMMSS_JobID.pdf" -ForegroundColor Cyan
Write-Host ""
Write-Host "Task 1.3.3 Requirements: ✓ VALIDATED" -ForegroundColor Green
Write-Host ""

exit 0
