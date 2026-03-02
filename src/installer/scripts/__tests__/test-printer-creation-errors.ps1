#Requires -Version 5.1

<#
.SYNOPSIS
    Tests error handling in New-TabezaPOSPrinter function.

.DESCRIPTION
    This test script validates that the New-TabezaPOSPrinter function correctly
    handles and reports specific error cases:
    1. Driver not found errors
    2. Port not accessible errors
    3. Printer name conflicts

.NOTES
    This is a manual test script. Run it to verify error handling behavior.
    Requirements: 8.2
#>

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Printer Creation Error Handling Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Source the main script to get access to functions
$scriptPath = Join-Path -Path $PSScriptRoot -ChildPath "..\configure-pooling-printer.ps1"

# We can't directly source the script because it has parameter validation
# Instead, we'll test the error messages by examining the script content

Write-Host "Test 1: Verify Driver Not Found Error Handling" -ForegroundColor Yellow
Write-Host "Expected: Detailed error message with troubleshooting steps" -ForegroundColor Gray
Write-Host ""

$scriptContent = Get-Content $scriptPath -Raw

# Check for driver not found error handling
if ($scriptContent -match "driver.*not.*found" -and 
    $scriptContent -match "Reinstall the printer driver" -and
    $scriptContent -match "manufacturer's website") {
    Write-Host "✓ PASS: Driver not found error handling detected" -ForegroundColor Green
} else {
    Write-Host "✗ FAIL: Driver not found error handling not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "Test 2: Verify Port Not Accessible Error Handling" -ForegroundColor Yellow
Write-Host "Expected: Detailed error message with port troubleshooting" -ForegroundColor Gray
Write-Host ""

# Check for port not accessible error handling
if ($scriptContent -match "port.*not.*accessible" -and 
    $scriptContent -match "Check USB cable connection" -and
    $scriptContent -match "Restart the Print Spooler") {
    Write-Host "✓ PASS: Port not accessible error handling detected" -ForegroundColor Green
} else {
    Write-Host "✗ FAIL: Port not accessible error handling not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "Test 3: Verify Printer Name Conflict Error Handling" -ForegroundColor Yellow
Write-Host "Expected: Detailed error message with conflict resolution" -ForegroundColor Gray
Write-Host ""

# Check for printer name conflict error handling
if (($scriptContent -match "already exists") -and 
    ($scriptContent -match "Printer Name Conflict") -and
    ($scriptContent -match "Remove the existing")) {
    Write-Host "✓ PASS: Printer name conflict error handling detected" -ForegroundColor Green
} else {
    Write-Host "✗ FAIL: Printer name conflict error handling not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "Test 4: Verify Error Messages Include Support Information" -ForegroundColor Yellow
Write-Host "Expected: All error messages include support URL and log file path" -ForegroundColor Gray
Write-Host ""

# Check that error messages include support information
$errorPattern = '(?s)ERROR:.*?For support'
$errorBlocks = [regex]::Matches($scriptContent, $errorPattern)
$allHaveSupport = $true
$allHaveLogPath = $true

foreach ($block in $errorBlocks) {
    if ($block.Value -notmatch "tabeza\.co\.ke/support") {
        $allHaveSupport = $false
    }
    if ($block.Value -notmatch "LogFilePath") {
        $allHaveLogPath = $false
    }
}

if ($allHaveSupport) {
    Write-Host "✓ PASS: All error messages include support URL" -ForegroundColor Green
} else {
    Write-Host "✗ FAIL: Some error messages missing support URL" -ForegroundColor Red
}

if ($allHaveLogPath) {
    Write-Host "✓ PASS: All error messages include log file path" -ForegroundColor Green
} else {
    Write-Host "✗ FAIL: Some error messages missing log file path" -ForegroundColor Red
}

Write-Host ""
Write-Host "Test 5: Verify Specific Error Cases Are Handled" -ForegroundColor Yellow
Write-Host "Expected: Three specific error cases with distinct messages" -ForegroundColor Gray
Write-Host ""

# Count the number of distinct error handling blocks
$driverErrorCount = ([regex]::Matches($scriptContent, "Driver Not Found")).Count
$portErrorCount = ([regex]::Matches($scriptContent, "Port Not Accessible")).Count
$conflictErrorCount = ([regex]::Matches($scriptContent, "Printer Name Conflict")).Count

Write-Host "  Driver not found errors: $driverErrorCount" -ForegroundColor Gray
Write-Host "  Port not accessible errors: $portErrorCount" -ForegroundColor Gray
Write-Host "  Printer name conflicts: $conflictErrorCount" -ForegroundColor Gray

if ($driverErrorCount -ge 1 -and $portErrorCount -ge 1 -and $conflictErrorCount -ge 1) {
    Write-Host "✓ PASS: All three error cases are handled" -ForegroundColor Green
} else {
    Write-Host "✗ FAIL: Not all error cases are handled" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "All tests examine the script content to verify error handling" -ForegroundColor Gray
Write-Host "is properly implemented according to Requirements 8.2" -ForegroundColor Gray
Write-Host ""
Write-Host "To test actual error behavior, you would need to:" -ForegroundColor Yellow
Write-Host "1. Create a printer with a non-existent driver" -ForegroundColor Gray
Write-Host "2. Create a printer with a non-existent port" -ForegroundColor Gray
Write-Host "3. Create a printer with a name that already exists" -ForegroundColor Gray
Write-Host ""
Write-Host "These scenarios require actual printer hardware or mocking," -ForegroundColor Gray
Write-Host "which is beyond the scope of this static analysis test." -ForegroundColor Gray
Write-Host ""
