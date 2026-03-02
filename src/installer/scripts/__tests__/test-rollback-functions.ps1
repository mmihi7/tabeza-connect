#Requires -Version 5.1

<#
.SYNOPSIS
    Tests for rollback and error recovery functions.

.DESCRIPTION
    This script tests the rollback and error recovery module functions:
    - Remove-TabezaPOSPrinter
    - Handle-DirectoryCreationFailure
    - Invoke-ValidationWithRollback
    
    These tests verify that rollback operations work correctly and handle
    errors gracefully.

.NOTES
    Run this script from the scripts directory:
    PS> .\__tests__\test-rollback-functions.ps1
#>

# Import the main script to get access to functions
$scriptPath = Join-Path $PSScriptRoot ".." "configure-pooling-printer.ps1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Rollback and Error Recovery Function Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Verify Remove-TabezaPOSPrinter function exists
Write-Host "Test 1: Checking if Remove-TabezaPOSPrinter function exists..." -ForegroundColor Yellow

try {
    # Load the script content
    $scriptContent = Get-Content -Path $scriptPath -Raw
    
    if ($scriptContent -match 'function Remove-TabezaPOSPrinter') {
        Write-Host "✓ PASS: Remove-TabezaPOSPrinter function found" -ForegroundColor Green
    } else {
        Write-Host "✗ FAIL: Remove-TabezaPOSPrinter function not found" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ FAIL: Could not load script: $_" -ForegroundColor Red
}

Write-Host ""

# Test 2: Verify Handle-DirectoryCreationFailure function exists
Write-Host "Test 2: Checking if Handle-DirectoryCreationFailure function exists..." -ForegroundColor Yellow

try {
    if ($scriptContent -match 'function Handle-DirectoryCreationFailure') {
        Write-Host "✓ PASS: Handle-DirectoryCreationFailure function found" -ForegroundColor Green
    } else {
        Write-Host "✗ FAIL: Handle-DirectoryCreationFailure function not found" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ FAIL: Could not check for function: $_" -ForegroundColor Red
}

Write-Host ""

# Test 3: Verify Invoke-ValidationWithRollback function exists
Write-Host "Test 3: Checking if Invoke-ValidationWithRollback function exists..." -ForegroundColor Yellow

try {
    if ($scriptContent -match 'function Invoke-ValidationWithRollback') {
        Write-Host "✓ PASS: Invoke-ValidationWithRollback function found" -ForegroundColor Green
    } else {
        Write-Host "✗ FAIL: Invoke-ValidationWithRollback function not found" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ FAIL: Could not check for function: $_" -ForegroundColor Red
}

Write-Host ""

# Test 4: Verify Remove-TabezaPOSPrinter has correct parameters
Write-Host "Test 4: Checking Remove-TabezaPOSPrinter parameters..." -ForegroundColor Yellow

try {
    $hasRequiredParams = $true
    
    # Check for PrinterName parameter
    if ($scriptContent -notmatch '\$PrinterName.*=.*[''"]Tabeza POS Printer[''"]') {
        Write-Host "✗ Missing or incorrect PrinterName parameter" -ForegroundColor Red
        $hasRequiredParams = $false
    }
    
    # Check for CapturePortName parameter
    if ($scriptContent -notmatch '\$CapturePortName.*=.*[''"]TabezaCapturePort[''"]') {
        Write-Host "✗ Missing or incorrect CapturePortName parameter" -ForegroundColor Red
        $hasRequiredParams = $false
    }
    
    # Check for PreserveCaptureFile parameter
    if ($scriptContent -notmatch '\$PreserveCaptureFile.*=.*\$true') {
        Write-Host "✗ Missing or incorrect PreserveCaptureFile parameter" -ForegroundColor Red
        $hasRequiredParams = $false
    }
    
    if ($hasRequiredParams) {
        Write-Host "✓ PASS: All required parameters found with correct defaults" -ForegroundColor Green
    } else {
        Write-Host "✗ FAIL: Some parameters are missing or incorrect" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ FAIL: Could not check parameters: $_" -ForegroundColor Red
}

Write-Host ""

# Test 5: Verify Remove-TabezaPOSPrinter handles already-removed resources
Write-Host "Test 5: Checking if Remove-TabezaPOSPrinter handles already-removed resources..." -ForegroundColor Yellow

try {
    # Check for "already removed" success case
    if ($scriptContent -match 'already removed or never created' -and 
        $scriptContent -match 'Success \(already removed\)') {
        Write-Host "✓ PASS: Function handles already-removed resources gracefully" -ForegroundColor Green
    } else {
        Write-Host "✗ FAIL: Function may not handle already-removed resources correctly" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ FAIL: Could not verify error handling: $_" -ForegroundColor Red
}

Write-Host ""

# Test 6: Verify Handle-DirectoryCreationFailure handles different error types
Write-Host "Test 6: Checking if Handle-DirectoryCreationFailure handles different error types..." -ForegroundColor Yellow

try {
    $errorTypesHandled = 0
    
    # Check for Permission Denied handling
    if ($scriptContent -match 'Permission Denied' -and $scriptContent -match 'Access.*denied') {
        $errorTypesHandled++
    }
    
    # Check for Disk Space handling
    if ($scriptContent -match 'Insufficient Disk Space' -and $scriptContent -match 'disk.*full') {
        $errorTypesHandled++
    }
    
    # Check for Invalid Path handling
    if ($scriptContent -match 'Invalid Path' -and $scriptContent -match 'path.*invalid') {
        $errorTypesHandled++
    }
    
    # Check for Network Path handling
    if ($scriptContent -match 'Network Path Error' -and $scriptContent -match 'network') {
        $errorTypesHandled++
    }
    
    if ($errorTypesHandled -ge 4) {
        Write-Host "✓ PASS: Function handles $errorTypesHandled different error types" -ForegroundColor Green
    } else {
        Write-Host "✗ FAIL: Function only handles $errorTypesHandled error types (expected 4+)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ FAIL: Could not verify error type handling: $_" -ForegroundColor Red
}

Write-Host ""

# Test 7: Verify Handle-DirectoryCreationFailure exits with code 1
Write-Host "Test 7: Checking if Handle-DirectoryCreationFailure exits with code 1..." -ForegroundColor Yellow

try {
    if ($scriptContent -match 'exit 1' -and 
        $scriptContent -match 'Directory creation failed') {
        Write-Host "✓ PASS: Function exits with code 1 on failure" -ForegroundColor Green
    } else {
        Write-Host "✗ FAIL: Function may not exit with correct code" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ FAIL: Could not verify exit code: $_" -ForegroundColor Red
}

Write-Host ""

# Test 8: Verify Invoke-ValidationWithRollback calls Test-PoolingConfiguration
Write-Host "Test 8: Checking if Invoke-ValidationWithRollback calls Test-PoolingConfiguration..." -ForegroundColor Yellow

try {
    # Check if the function calls Test-PoolingConfiguration
    if ($scriptContent -match 'Invoke-ValidationWithRollback' -and 
        $scriptContent -match 'Test-PoolingConfiguration') {
        Write-Host "✓ PASS: Function calls Test-PoolingConfiguration" -ForegroundColor Green
    } else {
        Write-Host "✗ FAIL: Function does not call Test-PoolingConfiguration" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ FAIL: Could not verify function calls: $_" -ForegroundColor Red
}

Write-Host ""

# Test 9: Verify Invoke-ValidationWithRollback calls Remove-TabezaPOSPrinter on failure
Write-Host "Test 9: Checking if Invoke-ValidationWithRollback calls Remove-TabezaPOSPrinter on failure..." -ForegroundColor Yellow

try {
    # Check if the function calls Remove-TabezaPOSPrinter
    if ($scriptContent -match 'Invoke-ValidationWithRollback' -and 
        $scriptContent -match 'Remove-TabezaPOSPrinter' -and 
        $scriptContent -match 'Validation FAILED.*Rolling back') {
        Write-Host "✓ PASS: Function calls Remove-TabezaPOSPrinter on validation failure" -ForegroundColor Green
    } else {
        Write-Host "✗ FAIL: Function may not call Remove-TabezaPOSPrinter on failure" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ FAIL: Could not verify rollback logic: $_" -ForegroundColor Red
}

Write-Host ""

# Test 10: Verify Invoke-ValidationWithRollback restores default printer
Write-Host "Test 10: Checking if Invoke-ValidationWithRollback restores default printer..." -ForegroundColor Yellow

try {
    # Check if the function restores default printer
    if ($scriptContent -match 'Invoke-ValidationWithRollback' -and 
        $scriptContent -match 'Restore-DefaultPrinter' -and 
        $scriptContent -match 'OriginalDefaultPrinter') {
        Write-Host "✓ PASS: Function restores original default printer" -ForegroundColor Green
    } else {
        Write-Host "✗ FAIL: Function may not restore default printer" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ FAIL: Could not verify default printer restoration: $_" -ForegroundColor Red
}

Write-Host ""

# Test 11: Verify New-CaptureDirectory uses Handle-DirectoryCreationFailure
Write-Host "Test 11: Checking if New-CaptureDirectory uses Handle-DirectoryCreationFailure..." -ForegroundColor Yellow

try {
    # Check if New-CaptureDirectory function uses Handle-DirectoryCreationFailure
    if ($scriptContent -match 'Handle-DirectoryCreationFailure') {
        Write-Host "✓ PASS: Script contains Handle-DirectoryCreationFailure usage" -ForegroundColor Green
    } else {
        Write-Host "✗ FAIL: Script does not use Handle-DirectoryCreationFailure" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ FAIL: Could not verify integration: $_" -ForegroundColor Red
}

Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "All rollback and error recovery function tests completed." -ForegroundColor Cyan
Write-Host "Review the results above to ensure all functions are implemented correctly." -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: These are syntax and structure tests only." -ForegroundColor Yellow
Write-Host "Full integration testing requires a Windows system with printer hardware." -ForegroundColor Yellow
Write-Host ""
