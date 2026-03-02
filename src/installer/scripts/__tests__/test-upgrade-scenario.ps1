#Requires -RunAsAdministrator

<#
.SYNOPSIS
    Integration test for upgrade scenario (v1.6.x to v1.7.0)
    
.DESCRIPTION
    This script simulates an existing v1.6.x installation and tests the upgrade
    to v1.7.0 with automatic printer configuration. It verifies that the
    configuration script behaves idempotently and preserves existing settings.
    
.NOTES
    - Must be run as Administrator
    - Simulates existing Tabeza POS Printer from v1.6.x
    - Tests idempotent behavior during upgrade
    - Verifies configuration preservation
#>

param(
    [switch]$SkipCleanup,
    [switch]$Verbose
)

$ErrorActionPreference = 'Stop'
$script:TestResults = @{
    Passed = 0
    Failed = 0
    Errors = @()
}

# Test configuration
$script:TestConfig = @{
    TestPrinterName = "Test Thermal Printer"
    TestDriverName = "Generic / Text Only"
    TestPortName = "TESTPORT001"
    TabezaPrinterName = "Tabeza POS Printer"
    CaptureFilePath = "C:\TabezaPrints\order.prn"
    CaptureDirectory = "C:\TabezaPrints"
    ConfigScriptPath = Join-Path $PSScriptRoot "..\configure-pooling-printer.ps1"
}

#region Helper Functions

function Write-TestLog {
    param(
        [string]$Message,
        [ValidateSet('INFO', 'SUCCESS', 'WARNING', 'ERROR')]
        [string]$Level = 'INFO'
    )
    
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $color = switch ($Level) {
        'SUCCESS' { 'Green' }
        'WARNING' { 'Yellow' }
        'ERROR' { 'Red' }
        default { 'White' }
    }
    
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
}

function Assert-True {
    param(
        [bool]$Condition,
        [string]$TestName,
        [string]$ErrorMessage
    )
    
    if ($Condition) {
        Write-TestLog "✓ $TestName" -Level SUCCESS
        $script:TestResults.Passed++
        return $true
    } else {
        Write-TestLog "✗ $TestName - $ErrorMessage" -Level ERROR
        $script:TestResults.Failed++
        $script:TestResults.Errors += "$TestName - $ErrorMessage"
        return $false
    }
}

function Assert-Equal {
    param(
        $Expected,
        $Actual,
        [string]$TestName
    )
    
    $condition = $Expected -eq $Actual
    $errorMsg = "Expected: $Expected, Actual: $Actual"
    return Assert-True -Condition $condition -TestName $TestName -ErrorMessage $errorMsg
}

#endregion

#region Setup Functions

function Simulate-V16Installation {
    Write-TestLog "`n=== Simulating v1.6.x Installation ===" -Level INFO
    
    try {
        # Create test thermal printer (simulates physical printer)
        Write-TestLog "Creating test thermal printer..." -Level INFO
        
        # Create test port
        $testPortPath = Join-Path $script:TestConfig.CaptureDirectory "test-physical.prn"
        if (-not (Test-Path $script:TestConfig.CaptureDirectory)) {
            New-Item -ItemType Directory -Path $script:TestConfig.CaptureDirectory -Force | Out-Null
        }
        
        $existingPort = Get-PrinterPort -Name $script:TestConfig.TestPortName -ErrorAction SilentlyContinue
        if (-not $existingPort) {
            Add-PrinterPort -Name $script:TestConfig.TestPortName -PrinterHostAddress $testPortPath -ErrorAction Stop
        }
        
        # Create test thermal printer
        $existingPrinter = Get-Printer -Name $script:TestConfig.TestPrinterName -ErrorAction SilentlyContinue
        if (-not $existingPrinter) {
            Add-Printer -Name $script:TestConfig.TestPrinterName -DriverName $script:TestConfig.TestDriverName -PortName $script:TestConfig.TestPortName -ErrorAction Stop
        }
        
        Write-TestLog "Test thermal printer created" -Level SUCCESS
        
        # Create v1.6.x style Tabeza POS Printer (manually configured)
        Write-TestLog "Creating v1.6.x Tabeza POS Printer..." -Level INFO
        
        # Create capture port
        $capturePort = Get-PrinterPort -Name 'TabezaCapturePort' -ErrorAction SilentlyContinue
        if (-not $capturePort) {
            Add-PrinterPort -Name 'TabezaCapturePort' -PrinterHostAddress $script:TestConfig.CaptureFilePath -ErrorAction Stop
        }
        
        # Create Tabeza POS Printer with single port (v1.6.x style - not pooled)
        $tabezaPrinter = Get-Printer -Name $script:TestConfig.TabezaPrinterName -ErrorAction SilentlyContinue
        if (-not $tabezaPrinter) {
            Add-Printer -Name $script:TestConfig.TabezaPrinterName -DriverName $script:TestConfig.TestDriverName -PortName $script:TestConfig.TestPortName -ErrorAction Stop
            Write-TestLog "Created v1.6.x Tabeza POS Printer (single port)" -Level SUCCESS
        }
        
        # Add some test data to capture file
        if (-not (Test-Path $script:TestConfig.CaptureFilePath)) {
            New-Item -ItemType File -Path $script:TestConfig.CaptureFilePath -Force | Out-Null
        }
        
        $testData = @"
=================================
    V1.6.X TEST DATA
=================================
Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Order #1: Test Order
Total: $25.00
=================================
"@
        Add-Content -Path $script:TestConfig.CaptureFilePath -Value $testData
        
        $initialSize = (Get-Item $script:TestConfig.CaptureFilePath).Length
        Write-TestLog "Created capture file with test data ($initialSize bytes)" -Level SUCCESS
        
        # Verify v1.6.x configuration
        $printer = Get-Printer -Name $script:TestConfig.TabezaPrinterName -ErrorAction Stop
        $ports = $printer.PortName -split ','
        
        Write-TestLog "v1.6.x Configuration:" -Level INFO
        Write-TestLog "  Printer: $($printer.Name)" -Level INFO
        Write-TestLog "  Driver: $($printer.DriverName)" -Level INFO
        Write-TestLog "  Ports: $($printer.PortName)" -Level INFO
        Write-TestLog "  Port Count: $($ports.Count)" -Level INFO
        
        return $true
    }
    catch {
        Write-TestLog "Failed to simulate v1.6.x installation: $_" -Level ERROR
        return $false
    }
}

#endregion

#region Test Functions

function Test-UpgradeToV17 {
    Write-TestLog "`n=== Test: Upgrade to v1.7.0 ===" -Level INFO
    
    try {
        # Get pre-upgrade state
        $preUpgradePrinter = Get-Printer -Name $script:TestConfig.TabezaPrinterName -ErrorAction Stop
        $preUpgradePorts = $preUpgradePrinter.PortName -split ','
        $preUpgradePortCount = $preUpgradePorts.Count
        
        Write-TestLog "Pre-upgrade port count: $preUpgradePortCount" -Level INFO
        
        # Get capture file size before upgrade
        $preUpgradeSize = (Get-Item $script:TestConfig.CaptureFilePath).Length
        Write-TestLog "Pre-upgrade capture file size: $preUpgradeSize bytes" -Level INFO
        
        # Run v1.7.0 configuration script
        Write-TestLog "Running v1.7.0 configuration script..." -Level INFO
        $result = & $script:TestConfig.ConfigScriptPath -CaptureFilePath $script:TestConfig.CaptureFilePath
        
        # Check exit code (should be 0 or 2 for idempotent)
        $exitCode = $LASTEXITCODE
        $validExitCode = ($exitCode -eq 0) -or ($exitCode -eq 2)
        Assert-True -Condition $validExitCode -TestName "Upgrade script exit code" -ErrorMessage "Expected exit code 0 or 2, got $exitCode"
        
        # Get post-upgrade state
        $postUpgradePrinter = Get-Printer -Name $script:TestConfig.TabezaPrinterName -ErrorAction Stop
        $postUpgradePorts = $postUpgradePrinter.PortName -split ','
        $postUpgradePortCount = $postUpgradePorts.Count
        
        Write-TestLog "Post-upgrade port count: $postUpgradePortCount" -Level INFO
        
        # Verify dual-port configuration after upgrade
        Assert-Equal -Expected 2 -Actual $postUpgradePortCount -TestName "Dual-port configuration after upgrade"
        
        # Verify physical port is first
        $hasPhysicalPort = $postUpgradePorts[0] -eq $script:TestConfig.TestPortName
        Assert-True -Condition $hasPhysicalPort -TestName "Physical port is first after upgrade" -ErrorMessage "Physical port should be first"
        
        # Verify capture port is second
        $hasCapturePort = $postUpgradePorts[1] -eq 'TabezaCapturePort'
        Assert-True -Condition $hasCapturePort -TestName "Capture port is second after upgrade" -ErrorMessage "Capture port should be second"
        
        # Verify capture file data is preserved
        $postUpgradeSize = (Get-Item $script:TestConfig.CaptureFilePath).Length
        Write-TestLog "Post-upgrade capture file size: $postUpgradeSize bytes" -Level INFO
        
        $dataPreserved = $postUpgradeSize -ge $preUpgradeSize
        Assert-True -Condition $dataPreserved -TestName "Capture file data preserved" -ErrorMessage "Capture file data was lost during upgrade"
        
        # Verify driver is unchanged
        Assert-Equal -Expected $preUpgradePrinter.DriverName -Actual $postUpgradePrinter.DriverName -TestName "Driver preserved after upgrade"
        
        Write-TestLog "Upgrade to v1.7.0 completed successfully" -Level SUCCESS
        return $true
    }
    catch {
        Write-TestLog "Upgrade test failed: $_" -Level ERROR
        return $false
    }
}

function Test-PostUpgradeIdempotency {
    Write-TestLog "`n=== Test: Post-Upgrade Idempotency ===" -Level INFO
    
    try {
        # Run configuration script again after upgrade
        Write-TestLog "Running configuration script again..." -Level INFO
        $result = & $script:TestConfig.ConfigScriptPath -CaptureFilePath $script:TestConfig.CaptureFilePath
        
        # Check exit code
        $exitCode = $LASTEXITCODE
        $validExitCode = ($exitCode -eq 0) -or ($exitCode -eq 2)
        Assert-True -Condition $validExitCode -TestName "Post-upgrade idempotent exit code" -ErrorMessage "Expected exit code 0 or 2, got $exitCode"
        
        # Verify configuration is still correct
        $printer = Get-Printer -Name $script:TestConfig.TabezaPrinterName -ErrorAction Stop
        $ports = $printer.PortName -split ','
        
        Assert-Equal -Expected 2 -Actual $ports.Count -TestName "Configuration stable after re-run"
        
        # Verify no duplicate printers
        $allTabezaPrinters = Get-Printer | Where-Object { $_.Name -like '*Tabeza*' }
        Assert-Equal -Expected 1 -Actual $allTabezaPrinters.Count -TestName "No duplicate printers after re-run"
        
        Write-TestLog "Post-upgrade idempotency verified" -Level SUCCESS
        return $true
    }
    catch {
        Write-TestLog "Post-upgrade idempotency test failed: $_" -Level ERROR
        return $false
    }
}

function Test-PostUpgradeFunctionality {
    Write-TestLog "`n=== Test: Post-Upgrade Functionality ===" -Level INFO
    
    try {
        # Send test print job
        $testContent = @"
=================================
    V1.7.0 POST-UPGRADE TEST
=================================
Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Test ID: $([Guid]::NewGuid().ToString())
=================================
"@
        
        $tempFile = [System.IO.Path]::GetTempFileName()
        $testContent | Out-File -FilePath $tempFile -Encoding ASCII
        
        # Get initial capture file size
        $initialSize = (Get-Item $script:TestConfig.CaptureFilePath).Length
        
        Write-TestLog "Sending post-upgrade test print job..." -Level INFO
        Get-Content $tempFile | Out-Printer -Name $script:TestConfig.TabezaPrinterName
        
        # Wait for print job to process
        Start-Sleep -Seconds 3
        
        # Verify capture file was updated
        $finalSize = (Get-Item $script:TestConfig.CaptureFilePath).Length
        $captureUpdated = $finalSize -gt $initialSize
        
        Assert-True -Condition $captureUpdated -TestName "Print capture works after upgrade" -ErrorMessage "Capture file was not updated"
        
        # Clean up
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
        
        Write-TestLog "Post-upgrade functionality verified" -Level SUCCESS
        return $true
    }
    catch {
        Write-TestLog "Post-upgrade functionality test failed: $_" -Level ERROR
        return $false
    }
}

#endregion

#region Cleanup Functions

function Remove-TestEnvironment {
    Write-TestLog "`nCleaning up test environment..." -Level INFO
    
    try {
        # Remove Tabeza POS Printer
        $tabezaPrinter = Get-Printer -Name $script:TestConfig.TabezaPrinterName -ErrorAction SilentlyContinue
        if ($tabezaPrinter) {
            Remove-Printer -Name $script:TestConfig.TabezaPrinterName -ErrorAction Stop
            Write-TestLog "Removed Tabeza POS Printer" -Level INFO
        }
        
        # Remove TabezaCapturePort
        $capturePort = Get-PrinterPort -Name 'TabezaCapturePort' -ErrorAction SilentlyContinue
        if ($capturePort) {
            Remove-PrinterPort -Name 'TabezaCapturePort' -ErrorAction Stop
            Write-TestLog "Removed TabezaCapturePort" -Level INFO
        }
        
        # Remove test thermal printer
        $testPrinter = Get-Printer -Name $script:TestConfig.TestPrinterName -ErrorAction SilentlyContinue
        if ($testPrinter) {
            Remove-Printer -Name $script:TestConfig.TestPrinterName -ErrorAction Stop
            Write-TestLog "Removed test thermal printer" -Level INFO
        }
        
        # Remove test port
        $testPort = Get-PrinterPort -Name $script:TestConfig.TestPortName -ErrorAction SilentlyContinue
        if ($testPort) {
            Remove-PrinterPort -Name $script:TestConfig.TestPortName -ErrorAction Stop
            Write-TestLog "Removed test port" -Level INFO
        }
        
        # Remove capture directory
        if (Test-Path $script:TestConfig.CaptureDirectory) {
            Remove-Item -Path $script:TestConfig.CaptureDirectory -Recurse -Force -ErrorAction SilentlyContinue
            Write-TestLog "Removed capture directory" -Level INFO
        }
        
        Write-TestLog "Test environment cleaned up successfully" -Level SUCCESS
        return $true
    }
    catch {
        Write-TestLog "Failed to clean up test environment: $_" -Level ERROR
        return $false
    }
}

#endregion

#region Main Execution

function Invoke-UpgradeScenarioTest {
    Write-TestLog "`n========================================" -Level INFO
    Write-TestLog "Upgrade Scenario Test (v1.6.x → v1.7.0)" -Level INFO
    Write-TestLog "========================================`n" -Level INFO
    
    $startTime = Get-Date
    
    try {
        # Setup v1.6.x environment
        if (-not (Simulate-V16Installation)) {
            Write-TestLog "Failed to simulate v1.6.x installation. Aborting tests." -Level ERROR
            return $false
        }
        
        # Run upgrade tests
        Test-UpgradeToV17
        Test-PostUpgradeIdempotency
        Test-PostUpgradeFunctionality
        
        # Cleanup
        if (-not $SkipCleanup) {
            Remove-TestEnvironment
        }
        else {
            Write-TestLog "`nSkipping cleanup (test resources preserved)" -Level WARNING
        }
        
        # Summary
        $endTime = Get-Date
        $duration = $endTime - $startTime
        
        Write-TestLog "`n========================================" -Level INFO
        Write-TestLog "Test Summary" -Level INFO
        Write-TestLog "========================================" -Level INFO
        Write-TestLog "Passed:  $($script:TestResults.Passed)" -Level SUCCESS
        Write-TestLog "Failed:  $($script:TestResults.Failed)" -Level $(if ($script:TestResults.Failed -gt 0) { 'ERROR' } else { 'INFO' })
        Write-TestLog "Duration: $($duration.TotalSeconds) seconds" -Level INFO
        
        if ($script:TestResults.Errors.Count -gt 0) {
            Write-TestLog "`nFailed Tests:" -Level ERROR
            foreach ($error in $script:TestResults.Errors) {
                Write-TestLog "  - $error" -Level ERROR
            }
        }
        
        Write-TestLog "========================================`n" -Level INFO
        
        return $script:TestResults.Failed -eq 0
    }
    catch {
        Write-TestLog "Upgrade scenario test failed with exception: $_" -Level ERROR
        Write-TestLog $_.ScriptStackTrace -Level ERROR
        return $false
    }
}

# Execute tests
$success = Invoke-UpgradeScenarioTest

# Exit with appropriate code
if ($success) {
    Write-TestLog "Upgrade scenario test passed!" -Level SUCCESS
    exit 0
}
else {
    Write-TestLog "Upgrade scenario test failed!" -Level ERROR
    exit 1
}

#endregion
