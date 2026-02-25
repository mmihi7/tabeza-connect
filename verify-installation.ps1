# TabezaConnect v1.6.1 - Installation Verification Script
# This script automates verification checks for Task 8 end-to-end testing

param(
    [switch]$Detailed,
    [switch]$ExportResults
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TabezaConnect v1.6.1" -ForegroundColor Cyan
Write-Host "  Installation Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$results = @{
    TestDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Tests = @()
    OverallStatus = "PASS"
}

# Test 1: Check Service Status
Write-Host "[Test 1] Checking service status..." -ForegroundColor Yellow
try {
    $service = Get-Service -Name "TabezaConnect" -ErrorAction Stop
    if ($service.Status -eq 'Running') {
        Write-Host "  ✅ PASS: Service is running" -ForegroundColor Green
        $results.Tests += @{
            Test = "Service Status"
            Status = "PASS"
            Details = "Service is running"
        }
    } else {
        Write-Host "  ❌ FAIL: Service is not running (Status: $($service.Status))" -ForegroundColor Red
        $results.Tests += @{
            Test = "Service Status"
            Status = "FAIL"
            Details = "Service status: $($service.Status)"
        }
        $results.OverallStatus = "FAIL"
    }
} catch {
    Write-Host "  ❌ FAIL: Service not found" -ForegroundColor Red
    $results.Tests += @{
        Test = "Service Status"
        Status = "FAIL"
        Details = "Service does not exist"
    }
    $results.OverallStatus = "FAIL"
}
Write-Host ""

# Test 2: Check Installation Status File
Write-Host "[Test 2] Checking installation status file..." -ForegroundColor Yellow
$statusFile = "C:\ProgramData\Tabeza\logs\installation-status.json"
if (Test-Path $statusFile) {
    try {
        $status = Get-Content $statusFile | ConvertFrom-Json
        $stepCount = $status.Count
        $successCount = ($status | Where-Object { $_.success -eq $true }).Count
        
        if ($stepCount -eq 7 -and $successCount -eq 7) {
            Write-Host "  ✅ PASS: All 7 steps completed successfully" -ForegroundColor Green
            $results.Tests += @{
                Test = "Installation Status"
                Status = "PASS"
                Details = "7/7 steps successful"
            }
            
            if ($Detailed) {
                Write-Host "  Step Details:" -ForegroundColor Cyan
                foreach ($step in $status) {
                    $icon = if ($step.success) { "✅" } else { "❌" }
                    Write-Host "    $icon Step $($step.step): $($step.name)" -ForegroundColor Gray
                    Write-Host "       $($step.details)" -ForegroundColor Gray
                }
            }
        } else {
            Write-Host "  ❌ FAIL: Expected 7 successful steps, found $successCount/$stepCount" -ForegroundColor Red
            $results.Tests += @{
                Test = "Installation Status"
                Status = "FAIL"
                Details = "Only $successCount/$stepCount steps successful"
            }
            $results.OverallStatus = "FAIL"
            
            # Show failed steps
            $failedSteps = $status | Where-Object { $_.success -eq $false }
            if ($failedSteps) {
                Write-Host "  Failed steps:" -ForegroundColor Red
                foreach ($step in $failedSteps) {
                    Write-Host "    ❌ Step $($step.step): $($step.name)" -ForegroundColor Red
                    Write-Host "       $($step.details)" -ForegroundColor Red
                }
            }
        }
    } catch {
        Write-Host "  ❌ FAIL: Could not parse status file" -ForegroundColor Red
        $results.Tests += @{
            Test = "Installation Status"
            Status = "FAIL"
            Details = "Failed to parse JSON: $($_.Exception.Message)"
        }
        $results.OverallStatus = "FAIL"
    }
} else {
    Write-Host "  ❌ FAIL: Status file not found" -ForegroundColor Red
    $results.Tests += @{
        Test = "Installation Status"
        Status = "FAIL"
        Details = "File not found: $statusFile"
    }
    $results.OverallStatus = "FAIL"
}
Write-Host ""

# Test 3: Check config.json
Write-Host "[Test 3] Checking config.json..." -ForegroundColor Yellow
$configFile = "C:\ProgramData\Tabeza\config.json"
if (Test-Path $configFile) {
    try {
        $config = Get-Content $configFile | ConvertFrom-Json
        
        $hasBarId = $null -ne $config.barId
        $hasDriverId = $null -ne $config.driverId
        $hasBridge = $null -ne $config.bridge
        $hasPrinterName = $null -ne $config.bridge.printerName
        
        if ($hasBarId -and $hasDriverId -and $hasBridge -and $hasPrinterName) {
            Write-Host "  ✅ PASS: Config file is valid" -ForegroundColor Green
            $results.Tests += @{
                Test = "Config File"
                Status = "PASS"
                Details = "All required fields present"
            }
            
            if ($Detailed) {
                Write-Host "  Config Details:" -ForegroundColor Cyan
                Write-Host "    Bar ID: $($config.barId)" -ForegroundColor Gray
                Write-Host "    Driver ID: $($config.driverId)" -ForegroundColor Gray
                Write-Host "    Printer Name: $($config.bridge.printerName)" -ForegroundColor Gray
                Write-Host "    API URL: $($config.apiUrl)" -ForegroundColor Gray
            }
        } else {
            Write-Host "  ❌ FAIL: Config file missing required fields" -ForegroundColor Red
            $missingFields = @()
            if (-not $hasBarId) { $missingFields += "barId" }
            if (-not $hasDriverId) { $missingFields += "driverId" }
            if (-not $hasBridge) { $missingFields += "bridge" }
            if (-not $hasPrinterName) { $missingFields += "bridge.printerName" }
            
            Write-Host "  Missing fields: $($missingFields -join ', ')" -ForegroundColor Red
            $results.Tests += @{
                Test = "Config File"
                Status = "FAIL"
                Details = "Missing fields: $($missingFields -join ', ')"
            }
            $results.OverallStatus = "FAIL"
        }
    } catch {
        Write-Host "  ❌ FAIL: Could not parse config file" -ForegroundColor Red
        $results.Tests += @{
            Test = "Config File"
            Status = "FAIL"
            Details = "Failed to parse JSON: $($_.Exception.Message)"
        }
        $results.OverallStatus = "FAIL"
    }
} else {
    Write-Host "  ❌ FAIL: Config file not found" -ForegroundColor Red
    $results.Tests += @{
        Test = "Config File"
        Status = "FAIL"
        Details = "File not found: $configFile"
    }
    $results.OverallStatus = "FAIL"
}
Write-Host ""

# Test 4: Check Folders
Write-Host "[Test 4] Checking folder structure..." -ForegroundColor Yellow
$folders = @(
    "C:\ProgramData\Tabeza",
    "C:\ProgramData\Tabeza\TabezaPrints",
    "C:\ProgramData\Tabeza\temp",
    "C:\ProgramData\Tabeza\logs"
)

$allFoldersExist = $true
foreach ($folder in $folders) {
    if (-not (Test-Path $folder)) {
        Write-Host "  ❌ Missing folder: $folder" -ForegroundColor Red
        $allFoldersExist = $false
    }
}

if ($allFoldersExist) {
    Write-Host "  ✅ PASS: All folders exist" -ForegroundColor Green
    $results.Tests += @{
        Test = "Folder Structure"
        Status = "PASS"
        Details = "All required folders present"
    }
    
    if ($Detailed) {
        Write-Host "  Folders:" -ForegroundColor Cyan
        foreach ($folder in $folders) {
            Write-Host "    ✓ $folder" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "  ❌ FAIL: Some folders are missing" -ForegroundColor Red
    $results.Tests += @{
        Test = "Folder Structure"
        Status = "FAIL"
        Details = "Some required folders missing"
    }
    $results.OverallStatus = "FAIL"
}
Write-Host ""

# Test 5: Check Printer Configuration
Write-Host "[Test 5] Checking printer configuration..." -ForegroundColor Yellow
try {
    # Get printer from config
    $config = Get-Content $configFile | ConvertFrom-Json
    $printerName = $config.bridge.printerName
    
    if ($printerName) {
        $printer = Get-Printer -Name $printerName -ErrorAction SilentlyContinue
        
        if ($printer) {
            $status = $printer.PrinterStatus
            if ($status -eq 'Normal' -or $status -eq 'Idle') {
                Write-Host "  ✅ PASS: Printer configured and ready" -ForegroundColor Green
                $results.Tests += @{
                    Test = "Printer Configuration"
                    Status = "PASS"
                    Details = "Printer: $printerName, Status: $status"
                }
                
                if ($Detailed) {
                    Write-Host "  Printer Details:" -ForegroundColor Cyan
                    Write-Host "    Name: $($printer.Name)" -ForegroundColor Gray
                    Write-Host "    Port: $($printer.PortName)" -ForegroundColor Gray
                    Write-Host "    Status: $status" -ForegroundColor Gray
                }
            } else {
                Write-Host "  ⚠️  WARNING: Printer status is $status" -ForegroundColor Yellow
                $results.Tests += @{
                    Test = "Printer Configuration"
                    Status = "WARNING"
                    Details = "Printer status: $status (not Normal/Idle)"
                }
            }
        } else {
            Write-Host "  ❌ FAIL: Printer not found: $printerName" -ForegroundColor Red
            $results.Tests += @{
                Test = "Printer Configuration"
                Status = "FAIL"
                Details = "Printer not found: $printerName"
            }
            $results.OverallStatus = "FAIL"
        }
    } else {
        Write-Host "  ❌ FAIL: Printer name not in config" -ForegroundColor Red
        $results.Tests += @{
            Test = "Printer Configuration"
            Status = "FAIL"
            Details = "Printer name not found in config.json"
        }
        $results.OverallStatus = "FAIL"
    }
} catch {
    Write-Host "  ❌ FAIL: Could not check printer" -ForegroundColor Red
    $results.Tests += @{
        Test = "Printer Configuration"
        Status = "FAIL"
        Details = "Error: $($_.Exception.Message)"
    }
    $results.OverallStatus = "FAIL"
}
Write-Host ""

# Test 6: Check Detected Printer File
Write-Host "[Test 6] Checking detected printer file..." -ForegroundColor Yellow
$detectedFile = "C:\ProgramData\Tabeza\detected-printer.json"
if (Test-Path $detectedFile) {
    try {
        $detected = Get-Content $detectedFile | ConvertFrom-Json
        Write-Host "  ✅ PASS: Detected printer file exists" -ForegroundColor Green
        $results.Tests += @{
            Test = "Detected Printer File"
            Status = "PASS"
            Details = "Printer: $($detected.printerName)"
        }
        
        if ($Detailed) {
            Write-Host "  Detected Printer:" -ForegroundColor Cyan
            Write-Host "    Name: $($detected.printerName)" -ForegroundColor Gray
            Write-Host "    Original Port: $($detected.originalPortName)" -ForegroundColor Gray
            Write-Host "    Driver: $($detected.driverName)" -ForegroundColor Gray
            Write-Host "    Status: $($detected.status)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  ⚠️  WARNING: Could not parse detected printer file" -ForegroundColor Yellow
        $results.Tests += @{
            Test = "Detected Printer File"
            Status = "WARNING"
            Details = "File exists but could not parse"
        }
    }
} else {
    Write-Host "  ⚠️  WARNING: Detected printer file not found" -ForegroundColor Yellow
    $results.Tests += @{
        Test = "Detected Printer File"
        Status = "WARNING"
        Details = "File not found (non-critical)"
    }
}
Write-Host ""

# Test 7: Check Capture Folder
Write-Host "[Test 7] Checking capture folder..." -ForegroundColor Yellow
$captureFolder = "C:\ProgramData\Tabeza\TabezaPrints"
if (Test-Path $captureFolder) {
    $files = Get-ChildItem $captureFolder -File
    $fileCount = $files.Count
    
    Write-Host "  ✅ PASS: Capture folder accessible" -ForegroundColor Green
    $results.Tests += @{
        Test = "Capture Folder"
        Status = "PASS"
        Details = "Folder accessible, contains $fileCount file(s)"
    }
    
    if ($Detailed -and $fileCount -gt 0) {
        Write-Host "  Captured Files:" -ForegroundColor Cyan
        foreach ($file in $files | Select-Object -First 5) {
            Write-Host "    - $($file.Name) ($($file.Length) bytes, $($file.CreationTime))" -ForegroundColor Gray
        }
        if ($fileCount -gt 5) {
            Write-Host "    ... and $($fileCount - 5) more" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "  ❌ FAIL: Capture folder not accessible" -ForegroundColor Red
    $results.Tests += @{
        Test = "Capture Folder"
        Status = "FAIL"
        Details = "Folder not accessible"
    }
    $results.OverallStatus = "FAIL"
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$passCount = ($results.Tests | Where-Object { $_.Status -eq "PASS" }).Count
$failCount = ($results.Tests | Where-Object { $_.Status -eq "FAIL" }).Count
$warnCount = ($results.Tests | Where-Object { $_.Status -eq "WARNING" }).Count
$totalTests = $results.Tests.Count

Write-Host "Total Tests: $totalTests" -ForegroundColor White
Write-Host "Passed: $passCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red
Write-Host "Warnings: $warnCount" -ForegroundColor Yellow
Write-Host ""

if ($results.OverallStatus -eq "PASS") {
    Write-Host "✅ OVERALL STATUS: PASS" -ForegroundColor Green
    Write-Host ""
    Write-Host "Installation verification successful!" -ForegroundColor Green
    Write-Host "TabezaConnect v1.6.1 is properly installed and configured." -ForegroundColor Green
} else {
    Write-Host "❌ OVERALL STATUS: FAIL" -ForegroundColor Red
    Write-Host ""
    Write-Host "Installation verification failed!" -ForegroundColor Red
    Write-Host "Please review the failed tests above and check:" -ForegroundColor Red
    Write-Host "  - C:\ProgramData\Tabeza\logs\installation-status.json" -ForegroundColor Yellow
    Write-Host "  - Windows Event Viewer (Application logs)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

# Export results if requested
if ($ExportResults) {
    $outputFile = "verification-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    $results | ConvertTo-Json -Depth 10 | Out-File $outputFile -Encoding UTF8
    Write-Host ""
    Write-Host "Results exported to: $outputFile" -ForegroundColor Cyan
}

# Exit with appropriate code
if ($results.OverallStatus -eq "PASS") {
    exit 0
} else {
    exit 1
}
