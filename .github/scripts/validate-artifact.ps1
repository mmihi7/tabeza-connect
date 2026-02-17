# TabezaConnect Artifact Validation Script (PowerShell)
#
# This script validates the built installer package before release to ensure:
# - EXE file exists and is properly named
# - File size is within expected bounds (40-50 MB)
# - EXE file is valid Windows executable
# - Version numbers match between tag and filename
#
# Requirements: 7.1, 7.2, 7.3, 7.4, 4.2

param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    
    [Parameter(Mandatory=$false)]
    [string]$DistPath = "dist"
)

# ANSI color codes for output
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Reset = "`e[0m"

# Validation configuration
$MIN_SIZE_MB = 40
$MAX_SIZE_MB = 50
$MIN_SIZE_BYTES = $MIN_SIZE_MB * 1024 * 1024
$MAX_SIZE_BYTES = $MAX_SIZE_MB * 1024 * 1024

# Track validation results
$validationErrors = @()
$validationWarnings = @()

function Write-ValidationHeader {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "TabezaConnect Artifact Validation" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Version: $Version" -ForegroundColor Cyan
    Write-Host ""
}

function Write-ValidationStep {
    param([string]$Message)
    Write-Host "🔍 $Message" -ForegroundColor Blue
}

function Write-ValidationSuccess {
    param([string]$Message)
    Write-Host "${Green}✅ $Message${Reset}"
}

function Write-ValidationError {
    param([string]$Message)
    Write-Host "${Red}❌ ERROR: $Message${Reset}"
    $script:validationErrors += $Message
}

function Write-ValidationWarning {
    param([string]$Message)
    Write-Host "${Yellow}⚠️  WARNING: $Message${Reset}"
    $script:validationWarnings += $Message
}

function Test-ExeFileExists {
    Write-ValidationStep "Checking if EXE file exists..."
    
    $expectedFilename = "TabezaConnect-Setup-v$Version.exe"
    $exePath = Join-Path $DistPath $expectedFilename
    
    if (-not (Test-Path $exePath)) {
        Write-ValidationError "EXE file not found at: $exePath"
        
        # List contents of dist directory for debugging
        if (Test-Path $DistPath) {
            Write-Host ""
            Write-Host "Contents of $DistPath directory:" -ForegroundColor Yellow
            Get-ChildItem $DistPath | ForEach-Object {
                Write-Host "  - $($_.Name)" -ForegroundColor Yellow
            }
        } else {
            Write-ValidationError "Distribution directory does not exist: $DistPath"
        }
        
        return $null
    }
    
    Write-ValidationSuccess "EXE file found: $expectedFilename"
    return $exePath
}

function Test-ExeFilename {
    param([string]$ExePath)
    
    Write-ValidationStep "Validating EXE filename pattern..."
    
    $filename = Split-Path $ExePath -Leaf
    $expectedPattern = "^TabezaConnect-Setup-v\d+\.\d+\.\d+(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?\.exe$"
    
    if ($filename -notmatch $expectedPattern) {
        Write-ValidationError "EXE filename does not match expected pattern: $filename"
        Write-Host "  Expected pattern: TabezaConnect-Setup-v{version}.exe" -ForegroundColor Yellow
        return $false
    }
    
    # Extract version from filename
    if ($filename -match "TabezaConnect-Setup-v(.+)\.exe") {
        $filenameVersion = $Matches[1]
        
        if ($filenameVersion -ne $Version) {
            Write-ValidationError "Version mismatch between tag and filename"
            Write-Host "  Tag version: $Version" -ForegroundColor Yellow
            Write-Host "  Filename version: $filenameVersion" -ForegroundColor Yellow
            return $false
        }
        
        Write-ValidationSuccess "Filename matches expected pattern and version"
        return $true
    }
    
    Write-ValidationError "Could not extract version from filename: $filename"
    return $false
}

function Test-ExeFileSize {
    param([string]$ExePath)
    
    Write-ValidationStep "Checking file size bounds..."
    
    $fileInfo = Get-Item $ExePath
    $fileSizeBytes = $fileInfo.Length
    $fileSizeMB = [math]::Round($fileSizeBytes / 1MB, 2)
    
    Write-Host "  File size: $fileSizeMB MB ($fileSizeBytes bytes)" -ForegroundColor Cyan
    
    if ($fileSizeBytes -lt $MIN_SIZE_BYTES) {
        Write-ValidationError "File size too small: $fileSizeMB MB (minimum: $MIN_SIZE_MB MB)"
        Write-Host "  This may indicate missing components or incomplete build" -ForegroundColor Yellow
        return $false
    }
    
    if ($fileSizeBytes -gt $MAX_SIZE_BYTES) {
        Write-ValidationError "File size too large: $fileSizeMB MB (maximum: $MAX_SIZE_MB MB)"
        Write-Host "  This may indicate unnecessary files or bloat" -ForegroundColor Yellow
        return $false
    }
    
    Write-ValidationSuccess "File size within bounds: $fileSizeMB MB ($MIN_SIZE_MB-$MAX_SIZE_MB MB)"
    return $true
}

function Test-ExeValidity {
    param([string]$ExePath)
    
    Write-ValidationStep "Validating EXE file format..."
    
    try {
        # Check if file has PE (Portable Executable) signature
        $bytes = [System.IO.File]::ReadAllBytes($ExePath)
        
        # Check for MZ header (DOS signature)
        if ($bytes[0] -ne 0x4D -or $bytes[1] -ne 0x5A) {
            Write-ValidationError "File is not a valid Windows executable (missing MZ header)"
            return $false
        }
        
        # Get PE header offset
        $peOffset = [BitConverter]::ToInt32($bytes, 0x3C)
        
        # Check for PE signature
        if ($bytes[$peOffset] -ne 0x50 -or $bytes[$peOffset + 1] -ne 0x45) {
            Write-ValidationError "File is not a valid Windows executable (missing PE signature)"
            return $false
        }
        
        Write-ValidationSuccess "EXE file format is valid (Windows PE executable)"
        return $true
    }
    catch {
        Write-ValidationError "Failed to validate EXE file format"
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Yellow
        return $false
    }
}

function Write-ValidationSummary {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Validation Summary" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    if ($validationWarnings.Count -gt 0) {
        Write-Host ""
        Write-Host "Warnings ($($validationWarnings.Count)):" -ForegroundColor Yellow
        foreach ($warning in $validationWarnings) {
            Write-Host "  ⚠️  $warning" -ForegroundColor Yellow
        }
    }
    
    if ($validationErrors.Count -gt 0) {
        Write-Host ""
        Write-Host "Errors ($($validationErrors.Count)):" -ForegroundColor Red
        foreach ($error in $validationErrors) {
            Write-Host "  ❌ $error" -ForegroundColor Red
        }
        Write-Host ""
        Write-Host "${Red}❌ VALIDATION FAILED${Reset}" -ForegroundColor Red
        Write-Host ""
        return $false
    }
    
    Write-Host ""
    Write-Host "${Green}✅ VALIDATION PASSED${Reset}" -ForegroundColor Green
    Write-Host ""
    return $true
}

# Main validation flow
Write-ValidationHeader

# Step 1: Check if EXE file exists
$exePath = Test-ExeFileExists
if ($null -eq $exePath) {
    Write-ValidationSummary
    exit 1
}

# Step 2: Validate filename pattern and version
$filenameValid = Test-ExeFilename -ExePath $exePath
if (-not $filenameValid) {
    Write-ValidationSummary
    exit 1
}

# Step 3: Check file size bounds
$sizeValid = Test-ExeFileSize -ExePath $exePath

# Step 4: Validate EXE file format
$validityValid = Test-ExeValidity -ExePath $exePath

# Final summary
$success = Write-ValidationSummary

if ($success) {
    exit 0
} else {
    exit 1
}
