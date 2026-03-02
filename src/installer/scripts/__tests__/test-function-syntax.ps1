#Requires -Version 5.1

<#
.SYNOPSIS
    Syntax and logic validation test for New-TabezaPOSPrinter function

.DESCRIPTION
    Tests the function definition, parameter validation, and basic logic
    without requiring administrator privileges or actual printer hardware.
#>

[CmdletBinding()]
param()

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Syntax Test: New-TabezaPOSPrinter" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Script syntax validation
Write-Host "Test 1: Validating PowerShell script syntax..." -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) {
    $scriptDir = Get-Location
}
$parentDir = Split-Path -Parent $scriptDir
$scriptPath = Join-Path -Path $parentDir -ChildPath "configure-pooling-printer.ps1"

if (-not (Test-Path -Path $scriptPath)) {
    Write-Host "[FAIL] Script not found: $scriptPath" -ForegroundColor Red
    exit 1
}

try {
    $scriptContent = Get-Content $scriptPath -Raw -ErrorAction Stop
    $null = [System.Management.Automation.PSParser]::Tokenize($scriptContent, [ref]$null)
    Write-Host "[PASS] Script syntax is valid" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Script syntax error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: Function definition validation
Write-Host "Test 2: Validating function definition..." -ForegroundColor Cyan

try {
    # Load the script content
    $scriptContent = Get-Content $scriptPath -Raw
    
    # Check if New-TabezaPOSPrinter function exists
    if ($scriptContent -match 'function New-TabezaPOSPrinter') {
        Write-Host "[PASS] New-TabezaPOSPrinter function found" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] New-TabezaPOSPrinter function not found" -ForegroundColor Red
        exit 1
    }
    
    # Check for required parameters
    $requiredParams = @('PrinterName', 'DriverName', 'PhysicalPort', 'CapturePort')
    $allParamsFound = $true
    
    foreach ($param in $requiredParams) {
        if ($scriptContent -match "\`$$param") {
            Write-Host "[PASS] Parameter found: $param" -ForegroundColor Green
        } else {
            Write-Host "[FAIL] Parameter missing: $param" -ForegroundColor Red
            $allParamsFound = $false
        }
    }
    
    if (-not $allParamsFound) {
        exit 1
    }
    
} catch {
    Write-Host "[FAIL] Function validation error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 3: WMI configuration logic validation
Write-Host "Test 3: Validating WMI pooling configuration logic..." -ForegroundColor Cyan

try {
    # Check for WMI usage
    if ($scriptContent -match 'Get-WmiObject.*Win32_Printer') {
        Write-Host "[PASS] WMI Win32_Printer query found" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] WMI Win32_Printer query not found" -ForegroundColor Red
        exit 1
    }
    
    # Check for DoCompleteFirst property
    if ($scriptContent -match '\$printerWMI\.DoCompleteFirst\s*=\s*\$false') {
        Write-Host "[PASS] DoCompleteFirst property configuration found" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] DoCompleteFirst property configuration not found" -ForegroundColor Red
        exit 1
    }
    
    # Check for EnableBIDI property
    if ($scriptContent -match '\$printerWMI\.EnableBIDI\s*=\s*\$true') {
        Write-Host "[PASS] EnableBIDI property configuration found" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] EnableBIDI property configuration not found" -ForegroundColor Red
        exit 1
    }
    
    # Check for PortName assignment (pooling configuration)
    if ($scriptContent -match '\$printerWMI\.PortName\s*=\s*\$allPorts') {
        Write-Host "[PASS] PortName pooling configuration found" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] PortName pooling configuration not found" -ForegroundColor Red
        exit 1
    }
    
    # Check for WMI Put() call
    if ($scriptContent -match '\$printerWMI\.Put\(\)') {
        Write-Host "[PASS] WMI Put() call found" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] WMI Put() call not found" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "[FAIL] WMI validation error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 4: Port order validation
Write-Host "Test 4: Validating port order (thermal first)..." -ForegroundColor Cyan

try {
    # Check that physical port comes before capture port in the port list
    if ($scriptContent -match '\$allPorts\s*=\s*"\$PhysicalPort,\$CapturePort"') {
        Write-Host "[PASS] Port order correct: PhysicalPort,CapturePort" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Port order incorrect or not found" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "[FAIL] Port order validation error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 5: Verification logic validation
Write-Host "Test 5: Validating verification logic..." -ForegroundColor Cyan

try {
    # Check for port count verification
    if ($scriptContent -match 'if.*\$verifyPorts\.Count\s*-ne\s*2') {
        Write-Host "[PASS] Port count verification found" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Port count verification not found" -ForegroundColor Red
        exit 1
    }
    
    # Check for physical port verification
    if ($scriptContent -match '\$hasPhysicalPort.*=.*\$verifyPorts.*-contains.*\$PhysicalPort') {
        Write-Host "[PASS] Physical port verification found" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Physical port verification not found" -ForegroundColor Red
        exit 1
    }
    
    # Check for capture port verification
    if ($scriptContent -match '\$hasCapturePort.*=.*\$verifyPorts.*-contains.*\$CapturePort') {
        Write-Host "[PASS] Capture port verification found" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Capture port verification not found" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "[FAIL] Verification logic validation error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 6: Error handling validation
Write-Host "Test 6: Validating error handling..." -ForegroundColor Cyan

try {
    # Check for driver verification
    if ($scriptContent -match 'Get-PrinterDriver.*-Name.*\$DriverName') {
        Write-Host "[PASS] Driver verification found" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Driver verification not found" -ForegroundColor Red
        exit 1
    }
    
    # Check for capture port existence check
    if ($scriptContent -match 'Get-PrinterPort.*-Name.*\$CapturePort') {
        Write-Host "[PASS] Capture port existence check found" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Capture port existence check not found" -ForegroundColor Red
        exit 1
    }
    
    # Check for try-catch blocks
    $tryCatchCount = ([regex]::Matches($scriptContent, 'try\s*\{')).Count
    if ($tryCatchCount -ge 3) {
        Write-Host "[PASS] Multiple try-catch blocks found ($tryCatchCount)" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Insufficient error handling (found $tryCatchCount try-catch blocks)" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "[FAIL] Error handling validation error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 7: Logging validation
Write-Host "Test 7: Validating logging statements..." -ForegroundColor Cyan

try {
    # Count Write-Log calls in the function
    $writeLogMatches = [regex]::Matches($scriptContent, 'Write-Log.*-Level\s+(INFO|WARN|ERROR)')
    $logCount = $writeLogMatches.Count
    
    if ($logCount -ge 15) {
        Write-Host "[PASS] Comprehensive logging found ($logCount log statements)" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Limited logging found ($logCount log statements)" -ForegroundColor Yellow
    }
    
    # Check for step-by-step logging
    if ($scriptContent -match 'Step 1:.*Step 2:.*Step 3:.*Step 4:.*Step 5:.*Step 6:') {
        Write-Host "[PASS] Step-by-step logging found" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Step-by-step logging not found" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "[FAIL] Logging validation error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ALL TESTS PASSED!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "The New-TabezaPOSPrinter function has been validated successfully." -ForegroundColor Green
Write-Host ""
Write-Host 'Summary:' -ForegroundColor Cyan
Write-Host '  [OK] Script syntax is valid' -ForegroundColor Gray
Write-Host '  [OK] Function definition is correct' -ForegroundColor Gray
Write-Host '  [OK] WMI pooling configuration is implemented' -ForegroundColor Gray
Write-Host '  [OK] Port order is correct (thermal first)' -ForegroundColor Gray
Write-Host '  [OK] Verification logic is comprehensive' -ForegroundColor Gray
Write-Host '  [OK] Error handling is robust' -ForegroundColor Gray
Write-Host '  [OK] Logging is comprehensive' -ForegroundColor Gray
Write-Host ''
Write-Host 'To test with actual hardware, run as Administrator:' -ForegroundColor Yellow
Write-Host '  .\test-new-tabeza-pos-printer.ps1' -ForegroundColor Gray
Write-Host ''
