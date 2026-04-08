#Requires -RunAsAdministrator

<#
.SYNOPSIS
    Integration test for Tabeza Pooling Printer configuration
    
.DESCRIPTION
    This script performs end-to-end integration testing of the pooling printer
    configuration process. It sets up a clean test environment, installs a test
    thermal printer driver, runs the configuration script, and verifies all
    expected behaviors.
    
.NOTES
    - Must be run as Administrator
    - Requires Print Spooler service to be running
    - Creates temporary test printers and ports
    - Cleans up all test resources after completion
#>

param(
    [switch]$SkipCleanup,
    [switch]$Verbose
)

$ErrorActionPreference = 'Stop'
$script:TestResults = @{
    Passed = 0
    Failed = 0
    Skipped = 0
    Errors = @()
}

# Test configuration
$script:TestConfig = @{
    TestPrinterName = "Test Thermal Printer"
    TestDriverName = "Generic / Text Only"  # Available on all Windows systems
    TestPortName = "TESTPORT001"
    TabezaPrinterName = "Tabeza Agent"
    CaptureFilePath = "C:\TabezaPrints\test-order.prn"
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

function Assert-NotNull {
    param(
        $Value,
        [string]$TestName
    )
    
    $condition = $null -ne $Value
    $errorMsg = "Value is null"
    return Assert-True -Condition $condition -TestName $TestName -ErrorMessage $errorMsg
}

#endregion

#region Setup Functions

function Initialize-TestEnvironment {
    Write-TestLog "Initializing test environment..." -Level INFO
    
    try {
        # Verify admin privileges
        $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
        Assert-True -Condition $isAdmin -TestName "Admin privileges check" -ErrorMessage "Must run as Administrator"
        
        # Verify Print Spooler is running
        $spooler = Get-Service -Name 'Spooler'
        Assert-True -Condition ($spooler.Status -eq 'Running') -TestName "Print Spooler running" -ErrorMessage "Print Spooler service is not running"
        
        # Verify configuration script exists
        $scriptExists = Test-Path $script:TestConfig.ConfigScriptPath
        Assert-True -Condition $scriptExists -TestName "Configuration script exists" -ErrorMessage "Cannot find configure-pooling-printer.ps1"
        
        # Create capture directory
        if (-not (Test-Path $script:TestConfig.CaptureDirectory)) {
            New-Item -ItemType Directory -Path $script:TestConfig.CaptureDirectory -Force | Out-Null
            Write-TestLog "Created capture directory: $($script:TestConfig.CaptureDirectory)" -Level INFO
        }
        
        Write-TestLog "Test environment initialized successfully" -Level SUCCESS
        return $true
    }
    catch {
        Write-TestLog "Failed to initialize test environment: $_" -Level ERROR
        return $false
    }
}

function Install-TestThermalPrinter {
    Write-TestLog "Installing test thermal printer..." -Level INFO
    
    try {
        # Check if test printer already exists
        $existingPrinter = Get-Printer -Name $script:TestConfig.TestPrinterName -ErrorAction SilentlyContinue
        if ($existingPrinter) {
            Write-TestLog "Test printer already exists, removing..." -Level WARNING
            Remove-Printer -Name $script:TestConfig.TestPrinterName -ErrorAction Stop
        }
        
        # Check if test port already exists
        $existingPort = Get-PrinterPort -Name $script:TestConfig.TestPortName -ErrorAction SilentlyContinue
        if ($existingPort) {
            Write-TestLog "Test port already exists, removing..." -Level WARNING
            Remove-PrinterPort -Name $script:TestConfig.TestPortName -ErrorAction Stop
        }
        
        # Create test port (FILE type for testing)
        $testPortPath = Join-Path $script:TestConfig.CaptureDirectory "test-physical.prn"
        Add-PrinterPort -Name $script:TestConfig.TestPortName -PrinterHostAddress $testPortPath -ErrorAction Stop
        Write-TestLog "Created test port: $($script:TestConfig.TestPortName)" -Level INFO
        
        # Verify Generic / Text Only driver exists
        $driver = Get-PrinterDriver -Name $script:TestConfig.TestDriverName -ErrorAction SilentlyContinue
        Assert-NotNull -Value $driver -TestName "Test driver availability"
        
        # Create test thermal printer
        Add-Printer -Name $script:TestConfig.TestPrinterName -DriverName $script:TestConfig.TestDriverName -PortName $script:TestConfig.TestPortName -ErrorAction Stop
        Write-TestLog "Created test thermal printer: $($script:TestConfig.TestPrinterName)" -Level SUCCESS
        
        # Verify printer was created
        $printer = Get-Printer -Name $script:TestConfig.TestPrinterName -ErrorAction Stop
        Assert-NotNull -Value $printer -TestName "Test printer creation"
        
        return $true
    }
    catch {
        Write-TestLog "Failed to install test thermal printer: $_" -Level ERROR
        return $false
    }
}

#endregion

#region Test Functions

function Test-ConfigurationScriptExecution {
    Write-TestLog "`n=== Test: Configuration Script Execution ===" -Level INFO
    
    try {
        # Record default printer before configuration
        $originalDefault = $null
        try {
            $wshNetwork = New-Object -ComObject WScript.Network
            $originalDefault = $wshNetwork.EnumPrinterConnections() | Select-Object -First 1
        }
        catch {
            Write-TestLog "No default printer set" -Level INFO
        }
        
        # Run configuration script
        Write-TestLog "Executing configuration script..." -Level INFO
        $result = & $script:TestConfig.ConfigScriptPath -CaptureFilePath $script:TestConfig.CaptureFilePath
        
        # Check exit code
        $exitCode = $LASTEXITCODE
        Assert-Equal -Expected 0 -Actual $exitCode -TestName "Configuration script exit code"
        
        Write-TestLog "Configuration script completed successfully" -Level SUCCESS
        return $true
    }
    catch {
        Write-TestLog "Configuration script execution failed: $_" -Level ERROR
        return $false
    }
}

function Test-TabezaPrinterCreation {
    Write-TestLog "`n=== Test: Tabeza Agent Creation ===" -Level INFO
    
    try {
        # Verify Tabeza Agent exists
        $tabezaPrinter = Get-Printer -Name $script:TestConfig.TabezaPrinterName -ErrorAction SilentlyContinue
        Assert-NotNull -Value $tabezaPrinter -TestName "Tabeza Agent exists"
        
        if ($tabezaPrinter) {
            # Verify driver matches test printer
            Assert-Equal -Expected $script:TestConfig.TestDriverName -Actual $tabezaPrinter.DriverName -TestName "Driver inheritance"
            
            # Verify printer is not shared
            Assert-Equal -Expected $false -Actual $tabezaPrinter.Shared -TestName "Printer not shared"
            
            # Verify dual-port configuration
            $ports = $tabezaPrinter.PortName -split ','
            Assert-Equal -Expected 2 -Actual $ports.Count -TestName "Dual-port configuration"
            
            # Verify physical port is first
            $hasPhysicalPort = $ports[0] -eq $script:TestConfig.TestPortName
            Assert-True -Condition $hasPhysicalPort -TestName "Physical port is first" -ErrorMessage "Physical port should be first in pool"
            
            # Verify capture port is second
            $hasCapturePort = $ports[1] -like '*Tabeza*'
            Assert-True -Condition $hasCapturePort -TestName "Capture port is second" -ErrorMessage "Capture port should be second in pool"
            
            Write-TestLog "Tabeza Agent configuration verified" -Level SUCCESS
        }
        
        return $true
    }
    catch {
        Write-TestLog "Tabeza printer verification failed: $_" -Level ERROR
        return $false
    }
}

function Test-CapturePortConfiguration {
    Write-TestLog "`n=== Test: Capture Port Configuration ===" -Level INFO
    
    try {
        # Verify TabezaCapturePort exists
        $capturePort = Get-PrinterPort -Name 'TabezaCapturePort' -ErrorAction SilentlyContinue
        Assert-NotNull -Value $capturePort -TestName "TabezaCapturePort exists"
        
        if ($capturePort) {
            # Verify port points to correct file path
            Assert-Equal -Expected $script:TestConfig.CaptureFilePath -Actual $capturePort.PrinterHostAddress -TestName "Capture port file path"
            
            # Verify capture file exists
            $captureFileExists = Test-Path $script:TestConfig.CaptureFilePath
            Assert-True -Condition $captureFileExists -TestName "Capture file exists" -ErrorMessage "Capture file was not created"
            
            # Verify capture file is writable
            try {
                $testContent = "Integration test write at $(Get-Date)"
                Add-Content -Path $script:TestConfig.CaptureFilePath -Value $testContent -ErrorAction Stop
                Assert-True -Condition $true -TestName "Capture file is writable" -ErrorMessage ""
            }
            catch {
                Assert-True -Condition $false -TestName "Capture file is writable" -ErrorMessage "Cannot write to capture file: $_"
            }
            
            Write-TestLog "Capture port configuration verified" -Level SUCCESS
        }
        
        return $true
    }
    catch {
        Write-TestLog "Capture port verification failed: $_" -Level ERROR
        return $false
    }
}

function Test-DefaultPrinterPreservation {
    Write-TestLog "`n=== Test: Default Printer Preservation ===" -Level INFO
    
    try {
        # Get current default printer
        $currentDefault = $null
        try {
            $wshNetwork = New-Object -ComObject WScript.Network
            $printers = $wshNetwork.EnumPrinterConnections()
            if ($printers.Count -gt 0) {
                $currentDefault = $printers[0]
            }
        }
        catch {
            Write-TestLog "No default printer is set" -Level INFO
        }
        
        # Verify Tabeza Agent is NOT the default
        if ($currentDefault) {
            $tabezaIsDefault = $currentDefault -eq $script:TestConfig.TabezaPrinterName
            Assert-True -Condition (-not $tabezaIsDefault) -TestName "Tabeza Agent is not default" -ErrorMessage "Tabeza Agent should not be set as default"
        }
        else {
            Write-TestLog "No default printer set - test skipped" -Level WARNING
            $script:TestResults.Skipped++
        }
        
        return $true
    }
    catch {
        Write-TestLog "Default printer preservation test failed: $_" -Level ERROR
        return $false
    }
}

function Test-PrintJobCapture {
    Write-TestLog "`n=== Test: Print Job Capture ===" -Level INFO
    
    try {
        # Get initial capture file size
        $initialSize = 0
        if (Test-Path $script:TestConfig.CaptureFilePath) {
            $initialSize = (Get-Item $script:TestConfig.CaptureFilePath).Length
        }
        
        Write-TestLog "Initial capture file size: $initialSize bytes" -Level INFO
        
        # Send test print job to Tabeza Agent
        $testContent = @"
=================================
    TABEZA INTEGRATION TEST
=================================
Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Test ID: $([Guid]::NewGuid().ToString())
=================================
"@
        
        $tempFile = [System.IO.Path]::GetTempFileName()
        $testContent | Out-File -FilePath $tempFile -Encoding ASCII
        
        Write-TestLog "Sending test print job..." -Level INFO
        
        # Print using Out-Printer cmdlet
        Get-Content $tempFile | Out-Printer -Name $script:TestConfig.TabezaPrinterName
        
        # Wait for print job to process
        Start-Sleep -Seconds 3
        
        # Verify capture file was updated
        $finalSize = (Get-Item $script:TestConfig.CaptureFilePath).Length
        Write-TestLog "Final capture file size: $finalSize bytes" -Level INFO
        
        $captureUpdated = $finalSize -gt $initialSize
        Assert-True -Condition $captureUpdated -TestName "Capture file updated after print" -ErrorMessage "Capture file size did not increase"
        
        # Clean up temp file
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
        
        Write-TestLog "Print job capture verified" -Level SUCCESS
        return $true
    }
    catch {
        Write-TestLog "Print job capture test failed: $_" -Level ERROR
        return $false
    }
}

function Test-IdempotentBehavior {
    Write-TestLog "`n=== Test: Idempotent Configuration ===" -Level INFO
    
    try {
        # Run configuration script again
        Write-TestLog "Running configuration script second time..." -Level INFO
        $result = & $script:TestConfig.ConfigScriptPath -CaptureFilePath $script:TestConfig.CaptureFilePath
        
        # Check exit code (should be 0 or 2 for "already configured")
        $exitCode = $LASTEXITCODE
        $validExitCode = ($exitCode -eq 0) -or ($exitCode -eq 2)
        Assert-True -Condition $validExitCode -TestName "Idempotent execution exit code" -ErrorMessage "Expected exit code 0 or 2, got $exitCode"
        
        # Verify no duplicate printers were created
        $allPrinters = Get-Printer | Where-Object { $_.Name -like '*Tabeza*' }
        Assert-Equal -Expected 1 -Actual $allPrinters.Count -TestName "No duplicate printers created"
        
        # Verify configuration is still valid
        $tabezaPrinter = Get-Printer -Name $script:TestConfig.TabezaPrinterName -ErrorAction Stop
        $ports = $tabezaPrinter.PortName -split ','
        Assert-Equal -Expected 2 -Actual $ports.Count -TestName "Configuration preserved after re-run"
        
        Write-TestLog "Idempotent behavior verified" -Level SUCCESS
        return $true
    }
    catch {
        Write-TestLog "Idempotent behavior test failed: $_" -Level ERROR
        return $false
    }
}

#endregion

#region Cleanup Functions

function Remove-TestEnvironment {
    Write-TestLog "`nCleaning up test environment..." -Level INFO
    
    try {
        # Remove Tabeza Agent
        $tabezaPrinter = Get-Printer -Name $script:TestConfig.TabezaPrinterName -ErrorAction SilentlyContinue
        if ($tabezaPrinter) {
            Remove-Printer -Name $script:TestConfig.TabezaPrinterName -ErrorAction Stop
            Write-TestLog "Removed Tabeza Agent" -Level INFO
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
        
        # Remove capture directory (optional)
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

function Invoke-IntegrationTests {
    Write-TestLog "`n========================================" -Level INFO
    Write-TestLog "Tabeza Pooling Printer Integration Tests" -Level INFO
    Write-TestLog "========================================`n" -Level INFO
    
    $startTime = Get-Date
    
    try {
        # Setup
        if (-not (Initialize-TestEnvironment)) {
            Write-TestLog "Failed to initialize test environment. Aborting tests." -Level ERROR
            return $false
        }
        
        if (-not (Install-TestThermalPrinter)) {
            Write-TestLog "Failed to install test thermal printer. Aborting tests." -Level ERROR
            return $false
        }
        
        # Run tests
        Test-ConfigurationScriptExecution
        Test-TabezaPrinterCreation
        Test-CapturePortConfiguration
        Test-DefaultPrinterPreservation
        Test-PrintJobCapture
        Test-IdempotentBehavior
        
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
        Write-TestLog "Skipped: $($script:TestResults.Skipped)" -Level WARNING
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
        Write-TestLog "Integration tests failed with exception: $_" -Level ERROR
        Write-TestLog $_.ScriptStackTrace -Level ERROR
        return $false
    }
}

# Execute tests
$success = Invoke-IntegrationTests

# Exit with appropriate code
if ($success) {
    Write-TestLog "All integration tests passed!" -Level SUCCESS
    exit 0
}
else {
    Write-TestLog "Some integration tests failed!" -Level ERROR
    exit 1
}

#endregion
