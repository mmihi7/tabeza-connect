# Tabeza Connect - Printer Forwarding Chain Test Script
# Automates the testing of printer detection, capture, and forwarding

param(
    [Parameter(Mandatory=$false)]
    [string]$TestBarId = "test-bar-$(Get-Date -Format 'yyyyMMddHHmmss')",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipCleanup,
    
    [Parameter(Mandatory=$false)]
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Test configuration
$testConfig = @{
    DetectedPrinterFile = "C:\ProgramData\Tabeza\detected-printer.json"
    ConfigFile = "C:\ProgramData\Tabeza\config.json"
    CaptureFolder = "C:\TabezaPrints"
    TempFolder = "C:\TabezaPrints\temp"
    LogFolder = "C:\ProgramData\Tabeza\logs"
    StatusFile = "C:\ProgramData\Tabeza\logs\installation-status.json"
    TestResultsFile = ".\test-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
}

# Test results tracking
$testResults = @{
    TestDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Environment = @{
        OSVersion = [System.Environment]::OSVersion.VersionString
        PowerShellVersion = $PSVersionTable.PSVersion.ToString()
        MachineName = $env:COMPUTERNAME
    }
    Tests = @()
    OverallStatus = "In Progress"
}

function Write-TestHeader {
    param([string]$Title)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Details,
        [hashtable]$Data = @{}
    )
    
    $status = if ($Passed) { "✅ PASS" } else { "❌ FAIL" }
    $color = if ($Passed) { "Green" } else { "Red" }
    
    Write-Host "$status - $TestName" -ForegroundColor $color
    if ($Details) {
        Write-Host "  Details: $Details" -ForegroundColor Gray
    }
    
    # Add to results
    $testResults.Tests += @{
        Name = $TestName
        Status = if ($Passed) { "Pass" } else { "Fail" }
        Details = $Details
        Data = $Data
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    }
}

function Test-PrinterDetection {
    Write-TestHeader "Test 1: Printer Detection"
    
    try {
        # Run detection script
        Write-Host "Running detect-thermal-printer.ps1..." -ForegroundColor Yellow
        
        $scriptPath = ".\src\installer\scripts\detect-thermal-printer.ps1"
        if (-not (Test-Path $scriptPath)) {
            throw "Detection script not found: $scriptPath"
        }
        
        & $scriptPath -OutputFile $testConfig.DetectedPrinterFile
        
        # Verify output file
        if (-not (Test-Path $testConfig.DetectedPrinterFile)) {
            throw "Detection output file not created"
        }
        
        # Parse and validate JSON
        $printerInfo = Get-Content $testConfig.DetectedPrinterFile | ConvertFrom-Json
        
        Write-Host "Detected Printer:" -ForegroundColor Yellow
        Write-Host "  Name: $($printerInfo.printerName)" -ForegroundColor White
        Write-Host "  Port: $($printerInfo.originalPortName)" -ForegroundColor White
        Write-Host "  Status: $($printerInfo.status)" -ForegroundColor White
        Write-Host "  Driver: $($printerInfo.driverName)" -ForegroundColor White
        
        # Validate required fields
        $requiredFields = @('printerName', 'originalPortName', 'status', 'driverName')
        $missingFields = $requiredFields | Where-Object { -not $printerInfo.$_ }
        
        if ($missingFields.Count -gt 0) {
            throw "Missing required fields: $($missingFields -join ', ')"
        }
        
        # Validate printer status
        $validStatuses = @('Normal', 'Ready', 'Idle', 'Printing')
        if ($printerInfo.status -notin $validStatuses) {
            Write-Host "  WARNING: Printer status is '$($printerInfo.status)' (expected: Normal/Ready)" -ForegroundColor Yellow
        }
        
        Write-TestResult -TestName "Printer Detection" -Passed $true `
            -Details "Found: $($printerInfo.printerName)" `
            -Data @{ PrinterInfo = $printerInfo }
        
        return $printerInfo
        
    } catch {
        Write-TestResult -TestName "Printer Detection" -Passed $false `
            -Details $_.Exception.Message
        throw
    }
}

function Test-BridgeConfiguration {
    Write-TestHeader "Test 2: Bridge Configuration"
    
    try {
        # Run bridge configuration script
        Write-Host "Running configure-bridge.ps1..." -ForegroundColor Yellow
        
        $scriptPath = ".\src\installer\scripts\configure-bridge.ps1"
        if (-not (Test-Path $scriptPath)) {
            throw "Configuration script not found: $scriptPath"
        }
        
        & $scriptPath -BarId $TestBarId -ConfigFile $testConfig.ConfigFile
        
        # Verify folders created
        Write-Host "Verifying folders..." -ForegroundColor Yellow
        $foldersExist = (Test-Path $testConfig.CaptureFolder) -and (Test-Path $testConfig.TempFolder)
        if (-not $foldersExist) {
            throw "Required folders not created"
        }
        Write-Host "  ✅ Folders created" -ForegroundColor Green
        
        # Verify config.json
        Write-Host "Verifying config.json..." -ForegroundColor Yellow
        if (-not (Test-Path $testConfig.ConfigFile)) {
            throw "Config file not created"
        }
        
        $config = Get-Content $testConfig.ConfigFile | ConvertFrom-Json
        
        Write-Host "Configuration:" -ForegroundColor Yellow
        Write-Host "  Bar ID: $($config.barId)" -ForegroundColor White
        Write-Host "  Printer: $($config.bridge.printerName)" -ForegroundColor White
        Write-Host "  Original Port: $($config.bridge.originalPort)" -ForegroundColor White
        Write-Host "  Capture Folder: $($config.bridge.captureFolder)" -ForegroundColor White
        
        # Validate printer name exists
        if (-not $config.bridge.printerName) {
            throw "Printer name not set in config.json"
        }
        
        # Check printer port configuration
        Write-Host "Checking printer port..." -ForegroundColor Yellow
        $printer = Get-Printer -Name $config.bridge.printerName -ErrorAction SilentlyContinue
        if (-not $printer) {
            throw "Printer not found: $($config.bridge.printerName)"
        }
        
        Write-Host "  Port Name: $($printer.PortName)" -ForegroundColor White
        Write-Host "  Status: $($printer.PrinterStatus)" -ForegroundColor White
        
        Write-TestResult -TestName "Bridge Configuration" -Passed $true `
            -Details "Configured: $($config.bridge.printerName)" `
            -Data @{ Config = $config; PrinterPort = $printer.PortName }
        
        return $config
        
    } catch {
        Write-TestResult -TestName "Bridge Configuration" -Passed $false `
            -Details $_.Exception.Message
        throw
    }
}

function Test-FileCaptureManual {
    param([object]$Config)
    
    Write-TestHeader "Test 3: File Capture (Manual)"
    
    Write-Host "MANUAL TEST REQUIRED" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please perform the following steps:" -ForegroundColor White
    Write-Host "1. Open Notepad" -ForegroundColor White
    Write-Host "2. Type test receipt content:" -ForegroundColor White
    Write-Host "   TEST RECEIPT" -ForegroundColor Gray
    Write-Host "   Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
    Write-Host "   Item: Beer x1 - 300 KES" -ForegroundColor Gray
    Write-Host "   Total: 300 KES" -ForegroundColor Gray
    Write-Host "3. Press Ctrl+P to print" -ForegroundColor White
    Write-Host "4. Select printer: $($Config.bridge.printerName)" -ForegroundColor White
    Write-Host "5. Click Print" -ForegroundColor White
    Write-Host ""
    
    # Wait for user to complete print
    Write-Host "Press Enter after you have completed the print..." -ForegroundColor Yellow
    Read-Host
    
    # Check for captured files
    Write-Host "Checking capture folder..." -ForegroundColor Yellow
    $capturedFiles = Get-ChildItem $testConfig.CaptureFolder -File -ErrorAction SilentlyContinue
    
    if ($capturedFiles.Count -eq 0) {
        Write-TestResult -TestName "File Capture" -Passed $false `
            -Details "No files found in capture folder"
        return $null
    }
    
    $latestFile = $capturedFiles | Sort-Object CreationTime -Descending | Select-Object -First 1
    
    Write-Host "Captured File:" -ForegroundColor Yellow
    Write-Host "  Name: $($latestFile.Name)" -ForegroundColor White
    Write-Host "  Size: $($latestFile.Length) bytes" -ForegroundColor White
    Write-Host "  Created: $($latestFile.CreationTime)" -ForegroundColor White
    
    # Validate file has content
    if ($latestFile.Length -eq 0) {
        Write-TestResult -TestName "File Capture" -Passed $false `
            -Details "Captured file is empty"
        return $null
    }
    
    Write-TestResult -TestName "File Capture" -Passed $true `
        -Details "Captured: $($latestFile.Name) ($($latestFile.Length) bytes)" `
        -Data @{ FileName = $latestFile.Name; FileSize = $latestFile.Length }
    
    return $latestFile
}

function Test-PhysicalForwarding {
    param(
        [object]$Config,
        [System.IO.FileInfo]$CapturedFile
    )
    
    Write-TestHeader "Test 4: Physical Printer Forwarding"
    
    if (-not $CapturedFile) {
        Write-Host "Skipping - no captured file available" -ForegroundColor Yellow
        Write-TestResult -TestName "Physical Forwarding" -Passed $false `
            -Details "No captured file to forward"
        return $false
    }
    
    try {
        Write-Host "Forwarding to printer: $($Config.bridge.printerName)" -ForegroundColor Yellow
        Write-Host "File: $($CapturedFile.FullName)" -ForegroundColor Gray
        
        # Forward using Out-Printer
        Get-Content $CapturedFile.FullName -Raw | Out-Printer -Name $Config.bridge.printerName
        
        Write-Host ""
        Write-Host "MANUAL VERIFICATION REQUIRED" -ForegroundColor Yellow
        Write-Host "Did the receipt print on the physical printer? (Y/N)" -ForegroundColor White
        $response = Read-Host
        
        $success = $response -match '^[Yy]'
        
        if ($success) {
            Write-TestResult -TestName "Physical Forwarding" -Passed $true `
                -Details "Receipt printed successfully"
        } else {
            Write-TestResult -TestName "Physical Forwarding" -Passed $false `
                -Details "Receipt did not print or was garbled"
        }
        
        return $success
        
    } catch {
        Write-TestResult -TestName "Physical Forwarding" -Passed $false `
            -Details $_.Exception.Message
        return $false
    }
}

function Test-EndToEndWorkflow {
    param([object]$Config)
    
    Write-TestHeader "Test 5: End-to-End Workflow"
    
    try {
        # Clear capture folder
        Write-Host "Clearing capture folder..." -ForegroundColor Yellow
        Get-ChildItem $testConfig.CaptureFolder -File | Remove-Item -Force
        Write-Host "  ✅ Folder cleared" -ForegroundColor Green
        
        # Prompt for second print test
        Write-Host ""
        Write-Host "MANUAL TEST REQUIRED" -ForegroundColor Yellow
        Write-Host "Please print a second test receipt from Notepad:" -ForegroundColor White
        Write-Host "   WORKFLOW TEST" -ForegroundColor Gray
        Write-Host "   Order #12345" -ForegroundColor Gray
        Write-Host "   Beer x2 - 600 KES" -ForegroundColor Gray
        Write-Host "   Total: 600 KES" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Press Enter after printing..." -ForegroundColor Yellow
        Read-Host
        
        # Check for new file
        $newFile = Get-ChildItem $testConfig.CaptureFolder -File | Select-Object -First 1
        if (-not $newFile) {
            throw "No file captured in workflow test"
        }
        
        Write-Host "Captured: $($newFile.Name) - $($newFile.Length) bytes" -ForegroundColor Green
        
        # Forward to printer
        Write-Host "Forwarding to printer..." -ForegroundColor Yellow
        Get-Content $newFile.FullName -Raw | Out-Printer -Name $Config.bridge.printerName
        
        Write-Host ""
        Write-Host "Did the workflow test receipt print correctly? (Y/N)" -ForegroundColor White
        $response = Read-Host
        
        $success = $response -match '^[Yy]'
        
        if ($success) {
            Write-TestResult -TestName "End-to-End Workflow" -Passed $true `
                -Details "Complete workflow successful"
        } else {
            Write-TestResult -TestName "End-to-End Workflow" -Passed $false `
                -Details "Workflow failed or receipt incorrect"
        }
        
        return $success
        
    } catch {
        Write-TestResult -TestName "End-to-End Workflow" -Passed $false `
            -Details $_.Exception.Message
        return $false
    }
}

# Main test execution
try {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Tabeza Connect - Printer Forwarding Tests" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Test Bar ID: $TestBarId" -ForegroundColor Yellow
    Write-Host "Test Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Yellow
    Write-Host ""
    
    # Check admin privileges
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Host "WARNING: Not running as Administrator. Some tests may fail." -ForegroundColor Yellow
        Write-Host "Press Enter to continue anyway, or Ctrl+C to exit..." -ForegroundColor Yellow
        Read-Host
    }
    
    # Run tests
    $printerInfo = Test-PrinterDetection
    $config = Test-BridgeConfiguration
    $capturedFile = Test-FileCaptureManual -Config $config
    $forwardingSuccess = Test-PhysicalForwarding -Config $config -CapturedFile $capturedFile
    $workflowSuccess = Test-EndToEndWorkflow -Config $config
    
    # Calculate overall status
    $passedTests = ($testResults.Tests | Where-Object { $_.Status -eq "Pass" }).Count
    $totalTests = $testResults.Tests.Count
    $testResults.OverallStatus = if ($passedTests -eq $totalTests) { "All Pass" } else { "Some Failed" }
    
    # Display summary
    Write-TestHeader "Test Summary"
    Write-Host "Total Tests: $totalTests" -ForegroundColor White
    Write-Host "Passed: $passedTests" -ForegroundColor Green
    Write-Host "Failed: $($totalTests - $passedTests)" -ForegroundColor Red
    Write-Host ""
    
    foreach ($test in $testResults.Tests) {
        $icon = if ($test.Status -eq "Pass") { "✅" } else { "❌" }
        $color = if ($test.Status -eq "Pass") { "Green" } else { "Red" }
        Write-Host "$icon $($test.Name): $($test.Status)" -ForegroundColor $color
        if ($test.Details) {
            Write-Host "   $($test.Details)" -ForegroundColor Gray
        }
    }
    
    # Save results
    Write-Host ""
    Write-Host "Saving test results..." -ForegroundColor Yellow
    $testResults | ConvertTo-Json -Depth 10 | Set-Content $testConfig.TestResultsFile -Encoding UTF8
    Write-Host "Results saved: $($testConfig.TestResultsFile)" -ForegroundColor Green
    
    # Cleanup (optional)
    if (-not $SkipCleanup) {
        Write-Host ""
        Write-Host "Clean up test files? (Y/N)" -ForegroundColor Yellow
        $cleanup = Read-Host
        if ($cleanup -match '^[Yy]') {
            Write-Host "Cleaning up..." -ForegroundColor Yellow
            # Remove captured files but keep folders
            Get-ChildItem $testConfig.CaptureFolder -File | Remove-Item -Force
            Write-Host "  ✅ Cleanup complete" -ForegroundColor Green
        }
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Testing Complete!" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Exit with appropriate code
    if ($testResults.OverallStatus -eq "All Pass") {
        exit 0
    } else {
        exit 1
    }
    
} catch {
    Write-Host ""
    Write-Host "FATAL ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    
    # Save error results
    $testResults.OverallStatus = "Fatal Error"
    $testResults.FatalError = $_.Exception.Message
    $testResults | ConvertTo-Json -Depth 10 | Set-Content $testConfig.TestResultsFile -Encoding UTF8
    
    exit 1
}
