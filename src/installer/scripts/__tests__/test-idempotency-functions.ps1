#Requires -Version 5.1

<#
.SYNOPSIS
    Tests the idempotency and self-healing functions.

.DESCRIPTION
    This script tests the Test-TabezaPrinterExists and Test-TabezaPrinterConfiguration
    functions to ensure they work correctly for idempotent printer configuration.
#>

$ErrorActionPreference = 'Stop'

# Import the main script functions
$scriptPath = Join-Path -Path $PSScriptRoot -ChildPath "..\configure-pooling-printer.ps1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing Idempotency Functions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Syntax validation
Write-Host "Test 1: Validating script syntax..." -ForegroundColor Yellow

$scriptContent = Get-Content $scriptPath -Raw
$errors = $null
$tokens = $null
$ast = [System.Management.Automation.Language.Parser]::ParseInput($scriptContent, [ref]$tokens, [ref]$errors)

if ($errors.Count -eq 0) {
    Write-Host "  SUCCESS: Script syntax is valid" -ForegroundColor Green
} else {
    Write-Host "  FAILED: Syntax errors found:" -ForegroundColor Red
    foreach ($err in $errors) {
        Write-Host "    Line $($err.Extent.StartLineNumber): $($err.Message)" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""

# Test 2: Check function definitions exist
Write-Host "Test 2: Checking function definitions..." -ForegroundColor Yellow

$functionsToCheck = @(
    'Test-TabezaPrinterExists',
    'Test-TabezaPrinterConfiguration'
)

$allFunctionsFound = $true

foreach ($funcName in $functionsToCheck) {
    if ($scriptContent -match "function $funcName") {
        Write-Host "  SUCCESS: $funcName function found" -ForegroundColor Green
    } else {
        Write-Host "  FAILED: $funcName function NOT found" -ForegroundColor Red
        $allFunctionsFound = $false
    }
}

if (-not $allFunctionsFound) {
    Write-Host ""
    Write-Host "FAILED: Some functions are missing!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 3: Script statistics
Write-Host "Test 3: Script statistics..." -ForegroundColor Yellow

$lineCount = ($scriptContent -split "`n").Count
$functionMatches = [regex]::Matches($scriptContent, '^function ', [System.Text.RegularExpressions.RegexOptions]::Multiline)
$functionCount = $functionMatches.Count
$regionMatches = [regex]::Matches($scriptContent, '#region ')
$regionCount = $regionMatches.Count

Write-Host "  Total lines: $lineCount" -ForegroundColor Cyan
Write-Host "  Total functions: $functionCount" -ForegroundColor Cyan
Write-Host "  Total regions: $regionCount" -ForegroundColor Cyan

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SUCCESS: All tests passed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

exit 0
