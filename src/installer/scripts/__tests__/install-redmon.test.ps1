# Test script for install-redmon.ps1
# Validates script structure and basic functionality

Write-Host "Testing install-redmon.ps1..." -ForegroundColor Cyan
Write-Host ""

$scriptPath = Join-Path (Split-Path -Parent $PSScriptRoot) "install-redmon.ps1"

# Test 1: Script file exists
Write-Host "Test 1: Script file exists" -ForegroundColor Cyan
if (Test-Path $scriptPath) {
    Write-Host "✅ PASS: Script file found" -ForegroundColor Green
} else {
    Write-Host "❌ FAIL: Script file not found at $scriptPath" -ForegroundColor Red
    exit 1
}

# Test 2: Script has valid PowerShell syntax
Write-Host ""
Write-Host "Test 2: Script syntax validation" -ForegroundColor Cyan
try {
    $scriptContent = Get-Content $scriptPath -Raw
    $errors = $null
    $null = [System.Management.Automation.PSParser]::Tokenize($scriptContent, [ref]$errors)
    
    if ($errors.Count -eq 0) {
        Write-Host "✅ PASS: No syntax errors found" -ForegroundColor Green
    } else {
        Write-Host "❌ FAIL: Syntax errors found:" -ForegroundColor Red
        $errors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
        exit 1
    }
} catch {
    Write-Host "❌ FAIL: Could not parse script: $_" -ForegroundColor Red
    exit 1
}

# Test 3: Script has required parameters
Write-Host ""
Write-Host "Test 3: Required parameters" -ForegroundColor Cyan
if ($scriptContent -match 'param\s*\(') {
    Write-Host "✅ PASS: Script has param block" -ForegroundColor Green
    
    if ($scriptContent -match '\[string\]\$RedmonPath') {
        Write-Host "✅ PASS: RedmonPath parameter defined" -ForegroundColor Green
    } else {
        Write-Host "❌ FAIL: RedmonPath parameter not found" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ FAIL: Script missing param block" -ForegroundColor Red
    exit 1
}

# Test 4: Script detects architecture
Write-Host ""
Write-Host "Test 4: Architecture detection" -ForegroundColor Cyan
if ($scriptContent -match '\[Environment\]::Is64BitOperatingSystem') {
    Write-Host "✅ PASS: Architecture detection code present" -ForegroundColor Green
} else {
    Write-Host "❌ FAIL: Architecture detection code not found" -ForegroundColor Red
    exit 1
}

# Test 5: Script has error handling
Write-Host ""
Write-Host "Test 5: Error handling" -ForegroundColor Cyan
$errorHandlingCount = ([regex]::Matches($scriptContent, 'try\s*\{')).Count
if ($errorHandlingCount -ge 3) {
    Write-Host "✅ PASS: Script has $errorHandlingCount try-catch blocks" -ForegroundColor Green
} else {
    Write-Host "⚠️  WARNING: Script has only $errorHandlingCount try-catch blocks" -ForegroundColor Yellow
}

# Test 6: Script validates installer exists
Write-Host ""
Write-Host "Test 6: Installer validation" -ForegroundColor Cyan
if ($scriptContent -match 'Test-Path.*installerPath') {
    Write-Host "✅ PASS: Script validates installer exists" -ForegroundColor Green
} else {
    Write-Host "❌ FAIL: Installer validation not found" -ForegroundColor Red
    exit 1
}

# Test 7: Script verifies Redmon registration
Write-Host ""
Write-Host "Test 7: Redmon registration verification" -ForegroundColor Cyan
if ($scriptContent -match 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Print\\Monitors\\Redirected Port') {
    Write-Host "✅ PASS: Registry verification code present" -ForegroundColor Green
} else {
    Write-Host "❌ FAIL: Registry verification code not found" -ForegroundColor Red
    exit 1
}

# Test 8: Script has silent installation flag
Write-Host ""
Write-Host "Test 8: Silent installation" -ForegroundColor Cyan
if ($scriptContent -match '/S') {
    Write-Host "✅ PASS: Silent installation flag (/S) present" -ForegroundColor Green
} else {
    Write-Host "❌ FAIL: Silent installation flag not found" -ForegroundColor Red
    exit 1
}

# Summary
Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ All tests passed!" -ForegroundColor Green
Write-Host ""
Write-Host "install-redmon.ps1 is ready for use." -ForegroundColor White
Write-Host ""

exit 0
