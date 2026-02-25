# Test Status Writing for All 7 Scripts
# Verifies each script writes to installation-status.json correctly

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Testing Status Writing - All Scripts" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$statusFile = "C:\ProgramData\Tabeza\logs\installation-status.json"
$scriptsPath = ".\src\installer\scripts"

# Clean up previous test
if (Test-Path $statusFile) {
    Remove-Item $statusFile -Force
    Write-Host "Cleaned up previous status file" -ForegroundColor Gray
}

# Test results
$testResults = @()

# Test 1: create-folders.ps1
Write-Host "Test 1: create-folders.ps1" -ForegroundColor Yellow
try {
    & "$scriptsPath\create-folders.ps1" -WatchFolder "C:\TabezaPrints"
    
    if (Test-Path $statusFile) {
        $status = Get-Content $statusFile | ConvertFrom-Json
        $step1 = $status | Where-Object { $_.step -eq 1 }
        
        if ($step1) {
            Write-Host "  ✅ Step 1 status written" -ForegroundColor Green
            Write-Host "     Name: $($step1.name)" -ForegroundColor Gray
            Write-Host "     Success: $($step1.success)" -ForegroundColor Gray
            Write-Host "     Details: $($step1.details)" -ForegroundColor Gray
            $testResults += @{ Script = "create-folders.ps1"; Status = "PASS" }
        } else {
            Write-Host "  ❌ Step 1 status NOT found" -ForegroundColor Red
            $testResults += @{ Script = "create-folders.ps1"; Status = "FAIL" }
        }
    } else {
        Write-Host "  ❌ Status file not created" -ForegroundColor Red
        $testResults += @{ Script = "create-folders.ps1"; Status = "FAIL" }
    }
} catch {
    Write-Host "  ❌ Script failed: $_" -ForegroundColor Red
    $testResults += @{ Script = "create-folders.ps1"; Status = "ERROR" }
}
Write-Host ""

# Test 2: detect-thermal-printer.ps1
Write-Host "Test 2: detect-thermal-printer.ps1" -ForegroundColor Yellow
try {
    $detectedPrinterFile = "C:\ProgramData\Tabeza\detected-printer.json"
    & "$scriptsPath\detect-thermal-printer.ps1" -OutputFile $detectedPrinterFile
    
    $status = Get-Content $statusFile | ConvertFrom-Json
    $step2 = $status | Where-Object { $_.step -eq 2 }
    
    if ($step2) {
        Write-Host "  ✅ Step 2 status written" -ForegroundColor Green
        Write-Host "     Name: $($step2.name)" -ForegroundColor Gray
        Write-Host "     Success: $($step2.success)" -ForegroundColor Gray
        Write-Host "     Details: $($step2.details)" -ForegroundColor Gray
        $testResults += @{ Script = "detect-thermal-printer.ps1"; Status = "PASS" }
    } else {
        Write-Host "  ❌ Step 2 status NOT found" -ForegroundColor Red
        $testResults += @{ Script = "detect-thermal-printer.ps1"; Status = "FAIL" }
    }
} catch {
    Write-Host "  ❌ Script failed: $_" -ForegroundColor Red
    $testResults += @{ Script = "detect-thermal-printer.ps1"; Status = "ERROR" }
}
Write-Host ""

# Test 3: configure-bridge.ps1
Write-Host "Test 3: configure-bridge.ps1" -ForegroundColor Yellow
Write-Host "  ⚠️  Skipping - requires printer configuration" -ForegroundColor Yellow
Write-Host "     Manual verification needed" -ForegroundColor Gray
$testResults += @{ Script = "configure-bridge.ps1"; Status = "SKIP" }
Write-Host ""

# Test 4: register-service-pkg.ps1
Write-Host "Test 4: register-service-pkg.ps1" -ForegroundColor Yellow
Write-Host "  ⚠️  Skipping - requires admin privileges" -ForegroundColor Yellow
Write-Host "     Manual verification needed" -ForegroundColor Gray
$testResults += @{ Script = "register-service-pkg.ps1"; Status = "SKIP" }
Write-Host ""

# Test 5: check-service-started.ps1
Write-Host "Test 5: check-service-started.ps1" -ForegroundColor Yellow
try {
    # This will fail if service doesn't exist, but should still write status
    & "$scriptsPath\check-service-started.ps1" -ServiceName "TabezaConnect" 2>$null
    
    $status = Get-Content $statusFile | ConvertFrom-Json
    $step5 = $status | Where-Object { $_.step -eq 5 }
    
    if ($step5) {
        Write-Host "  ✅ Step 5 status written" -ForegroundColor Green
        Write-Host "     Name: $($step5.name)" -ForegroundColor Gray
        Write-Host "     Success: $($step5.success)" -ForegroundColor Gray
        Write-Host "     Details: $($step5.details)" -ForegroundColor Gray
        $testResults += @{ Script = "check-service-started.ps1"; Status = "PASS" }
    } else {
        Write-Host "  ❌ Step 5 status NOT found" -ForegroundColor Red
        $testResults += @{ Script = "check-service-started.ps1"; Status = "FAIL" }
    }
} catch {
    Write-Host "  ❌ Script failed: $_" -ForegroundColor Red
    $testResults += @{ Script = "check-service-started.ps1"; Status = "ERROR" }
}
Write-Host ""

# Test 6: register-printer-with-api.ps1
Write-Host "Test 6: register-printer-with-api.ps1" -ForegroundColor Yellow
Write-Host "  ⚠️  Skipping - requires API access and config" -ForegroundColor Yellow
Write-Host "     Manual verification needed" -ForegroundColor Gray
$testResults += @{ Script = "register-printer-with-api.ps1"; Status = "SKIP" }
Write-Host ""

# Test 7: verify-bridge.ps1
Write-Host "Test 7: verify-bridge.ps1" -ForegroundColor Yellow
Write-Host "  ⚠️  Skipping - requires full installation" -ForegroundColor Yellow
Write-Host "     Manual verification needed" -ForegroundColor Gray
$testResults += @{ Script = "verify-bridge.ps1"; Status = "SKIP" }
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$passed = ($testResults | Where-Object { $_.Status -eq "PASS" }).Count
$failed = ($testResults | Where-Object { $_.Status -eq "FAIL" }).Count
$errors = ($testResults | Where-Object { $_.Status -eq "ERROR" }).Count
$skipped = ($testResults | Where-Object { $_.Status -eq "SKIP" }).Count

foreach ($result in $testResults) {
    $color = switch ($result.Status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "ERROR" { "Red" }
        "SKIP" { "Yellow" }
    }
    Write-Host "  $($result.Script): $($result.Status)" -ForegroundColor $color
}

Write-Host ""
Write-Host "Results: $passed passed, $failed failed, $errors errors, $skipped skipped" -ForegroundColor Cyan
Write-Host ""

# Show final status file
if (Test-Path $statusFile) {
    Write-Host "Final installation-status.json:" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Gray
    Get-Content $statusFile | Write-Host -ForegroundColor Gray
    Write-Host "========================================" -ForegroundColor Gray
    Write-Host ""
    
    $status = Get-Content $statusFile | ConvertFrom-Json
    Write-Host "Total status entries: $($status.Count)" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Note: Scripts 3, 4, 6, 7 require full installation environment" -ForegroundColor Yellow
Write-Host "Run full installer to verify all 7 steps write status correctly" -ForegroundColor Yellow
Write-Host ""
