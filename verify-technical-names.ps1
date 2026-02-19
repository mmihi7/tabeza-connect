# TabezaConnect Technical Name Verification Script
# Version: 1.0.0
# Purpose: Verify all technical names use "TabezaConnect" (no space)

param(
    [string]$InstallerPath = ".\installer.iss",
    [switch]$Verbose
)

$ErrorCount = 0
$WarningCount = 0
$ChecksPassed = 0

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TabezaConnect Technical Name Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

function Test-Pattern {
    param(
        [string]$FilePath,
        [string]$Pattern,
        [string]$Description,
        [string]$Expected,
        [switch]$ShouldNotExist
    )
    
    if (-not (Test-Path $FilePath)) {
        Write-Host "[SKIP] $Description - File not found: $FilePath" -ForegroundColor Yellow
        $script:WarningCount++
        return
    }
    
    $content = Get-Content $FilePath -Raw
    $matches = [regex]::Matches($content, $Pattern)
    
    if ($ShouldNotExist) {
        if ($matches.Count -eq 0) {
            Write-Host "[PASS] $Description" -ForegroundColor Green
            $script:ChecksPassed++
        } else {
            Write-Host "[FAIL] $Description - Found $($matches.Count) occurrences" -ForegroundColor Red
            if ($Verbose) {
                foreach ($match in $matches) {
                    Write-Host "  Found: $($match.Value)" -ForegroundColor Red
                }
            }
            $script:ErrorCount++
        }
    } else {
        if ($matches.Count -gt 0) {
            $actualValue = $matches[0].Groups[1].Value
            if ($actualValue -eq $Expected) {
                Write-Host "[PASS] $Description" -ForegroundColor Green
                $script:ChecksPassed++
            } else {
                Write-Host "[FAIL] $Description - Expected: $Expected, Found: $actualValue" -ForegroundColor Red
                $script:ErrorCount++
            }
        } else {
            Write-Host "[FAIL] $Description - Pattern not found" -ForegroundColor Red
            $script:ErrorCount++
        }
    }
}

Write-Host "Checking installer.iss file..." -ForegroundColor Cyan
Write-Host ""

# Check 1: OutputBaseFilename should be TabezaConnect-Setup-v1.3.0
Test-Pattern -FilePath $InstallerPath `
    -Pattern 'OutputBaseFilename\s*=\s*([^\s\r\n]+)' `
    -Description "Executable filename format" `
    -Expected "TabezaConnect-Setup-v1.3.0"

# Check 2: DefaultDirName should use TabezaConnect (no space)
Test-Pattern -FilePath $InstallerPath `
    -Pattern 'DefaultDirName\s*=\s*\{autopf\}\\([^\s\r\n]+)' `
    -Description "Installation directory name" `
    -Expected "TabezaConnect"

# Check 3: Registry key should use TabezaConnect
Test-Pattern -FilePath $InstallerPath `
    -Pattern 'Subkey:\s*"Software\\Tabeza\\([^"]+)"' `
    -Description "Registry key name" `
    -Expected "Connect"

# Check 4: Service name should be TabezaConnect (no space)
# Check both sc.exe commands and PowerShell script references
$content = Get-Content $InstallerPath -Raw
if ($content -match 'Parameters:\s*"(?:start|stop|delete)\s+([^"]+)"') {
    $serviceName = $matches[1]
    if ($serviceName -eq "TabezaConnect") {
        Write-Host "[PASS] Windows service name" -ForegroundColor Green
        $script:ChecksPassed++
    } else {
        Write-Host "[FAIL] Windows service name - Expected: TabezaConnect, Found: $serviceName" -ForegroundColor Red
        $script:ErrorCount++
    }
} else {
    Write-Host "[FAIL] Windows service name - Pattern not found in sc.exe commands" -ForegroundColor Red
    $script:ErrorCount++
}

# Check 5: Ensure no "Tabeza Connect" (with space) in technical contexts
Write-Host ""
Write-Host "Checking for incorrect spacing in technical names..." -ForegroundColor Cyan
Write-Host ""

$content = Get-Content $InstallerPath -Raw
$technicalContexts = @(
    'OutputBaseFilename\s*=\s*.*Tabeza\s+Connect',
    'DefaultDirName\s*=\s*.*Tabeza\s+Connect',
    'sc\.exe.*Tabeza\s+Connect(?!Service)',
    'Software\\Tabeza\s+Connect'
)

foreach ($pattern in $technicalContexts) {
    $matches = [regex]::Matches($content, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($matches.Count -gt 0) {
        Write-Host "[FAIL] Found 'Tabeza Connect' (with space) in technical context" -ForegroundColor Red
        if ($Verbose) {
            foreach ($match in $matches) {
                Write-Host "  Found: $($match.Value)" -ForegroundColor Red
            }
        }
        $script:ErrorCount++
    }
}

if ($ErrorCount -eq 0) {
    Write-Host "[PASS] No spacing errors in technical contexts" -ForegroundColor Green
    $script:ChecksPassed++
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verification Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Checks Passed: $ChecksPassed" -ForegroundColor Green
Write-Host "Errors: $ErrorCount" -ForegroundColor $(if ($ErrorCount -eq 0) { "Green" } else { "Red" })
Write-Host "Warnings: $WarningCount" -ForegroundColor Yellow
Write-Host ""

if ($ErrorCount -eq 0 -and $WarningCount -eq 0) {
    Write-Host "All technical names verified successfully!" -ForegroundColor Green
    exit 0
} elseif ($ErrorCount -eq 0) {
    Write-Host "Verification passed with warnings" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "Verification failed - please fix errors above" -ForegroundColor Red
    exit 1
}
