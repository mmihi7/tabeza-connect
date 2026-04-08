#Requires -RunAsAdministrator

<#
.SYNOPSIS
    Integration test for multiple thermal printers scenario
    
.DESCRIPTION
    This script tests the thermal printer detection and prioritization logic
    when multiple thermal printers are installed. It verifies that the
    configuration script correctly identifies and selects the best thermal
    printer based on keyword scoring.
    
.NOTES
    - Must be run as Administrator
    - Creates 3 test thermal printers with different names
    - Tests keyword-based prioritization
    - Verifies correct printer selection
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
    TestPrinters = @(
        @{
            Name = "Generic USB Printer"
            Driver = "Generic / Text Only"
            Port = "TESTPORT001"
            ExpectedScore = 0  # No thermal keywords
        },
        @{
            Name = "EPSON TM-T20 Receipt Printer"
            Driver = "Generic / Text Only"
            Port = "TESTPORT002"
            ExpectedScore = 4  # Keywords: EPSON, TM-, Receipt, Printer
        },
        @{
            Name = "Star TSP100 Thermal POS"
            Driver = "Generic / Text Only"
            Port = "TESTPORT003"
            ExpectedScore = 3  # Keywords: Star, Thermal, POS
        }
    )
    TabezaPrinterName = "Tabeza Agent"
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

function Install-MultipleThermalPrinters {
    Write-TestLog "`n=== Installing Multiple Test Printers ===" -Level INFO
    
    try {
        # Create capture directory
        if (-not (Test-Path $script:TestConfig.CaptureDirectory)) {
            New-Item -ItemType Directory -Path $script:TestConfig.CaptureDirectory -Force | Out-Null
        }
        
        # Install each test printer
        foreach ($printerConfig in $script:TestConfig.TestPrinters) {
            Write-TestLog "Installing: $($printerConfig.Name)" -Level INFO
            
            # Create port
            $portPath = Join-Path $script:TestConfig.CaptureDirectory "$($printerConfig.Port).prn"
            $existingPort = Get-PrinterPort -Name $printerConfig.Port -ErrorAction SilentlyContinue
            if (-not $existingPort) {
                Add-PrinterPort -Name $printerConfig.Port -PrinterHostAddress $portPath -ErrorAction Stop
                Write-TestLog "  Created port: $($printerConfig.Port)" -Level INFO
            }
            
            # Create printer
            $existingPrinter = Get-Printer -Name $printerConfig.Name -ErrorAction SilentlyContinue
            if (-not $existingPrinter) {
                Add-Printer -Name $printerConfig.Name -DriverName $printerConfig.Driver -PortName $printerConfig.Port -ErrorAction Stop
                Write-TestLog "  Created printer: $($printerConfig.Name)" -Level SUCCESS
            }
        }
        
        # Verify all printers were created
        $installedCount = 0
        foreach ($printerConfig in $script:TestConfig.TestPrinters) {
            $printer = Get-Printer -Name $printerConfig.Name -ErrorAction SilentlyContinue
            if ($printer) {
                $installedCount++
            }
        }
        
        Assert-Equal -Expected $script:TestConfig.TestPrinters.Count -Actual $installedCount -TestName "All test printers installed"
        
        Write-TestLog "Installed $installedCount test printers" -Level SUCCESS
        return $true
    }
    catch {
        Write-TestLog "Failed to install test printers: $_" -Level ERROR
        return $false
    }
}

#endregion

#region Test Functions

function Test-ThermalPrinterDetection {
    Write-TestLog "`n=== Test: Thermal Printer Detection ===" -Level INFO
    
    try {
        # List all installed printers
        Write-TestLog "Installed printers:" -Level INFO
        $allPrinters = Get-Printer
        foreach ($printer in $allPrinters) {
            Write-TestLog "  - $($printer.Name)" -Level INFO
        }
        
        # Verify test printers are detected
        foreach ($printerConfig in $script:TestConfig.TestPrinters) {
            $printer = Get-Printer -Name $printerConfig.Name -ErrorAction SilentlyContinue
            Assert-True -Condition ($null -ne $printer) -TestName "Printer detected: $($printerConfig.Name)" -ErrorMessage "Printer not found"
        }
        
        Write-TestLog "All test printers detected" -Level SUCCESS
        return $true
    }
    catch {
        Write-TestLog "Thermal printer detection test failed: $_" -Level ERROR
        return $false
    }
}

function Test-PrioritizationLogic {
    Write-TestLog "`n=== Test: Printer Prioritization Logic ===" -Level INFO
    
    try {
        # Run configuration script
        Write-TestLog "Running configuration script..." -Level INFO
        $result = & $script:TestConfig.ConfigScriptPath -CaptureFilePath $script:TestConfig.CaptureFilePath
        
        # Check exit code
        $exitCode = $LASTEXITCODE
        Assert-Equal -Expected 0 -Actual $exitCode -TestName "Configuration script exit code"
        
        # Verify Tabeza Agent was created
        $tabezaPrinter = Get-Printer -Name $script:TestConfig.TabezaPrinterName -ErrorAction SilentlyContinue
        Assert-True -Condition ($null -ne $tabezaPrinter) -TestName "Tabeza Agent created" -ErrorMessage "Tabeza Agent not found"
        
        if ($tabezaPrinter) {
            # Get the physical port (first port in the pool)
            $ports = $tabezaPrinter.PortName -split ','
            $physicalPort = $ports[0]
            
            Write-TestLog "Selected physical port: $physicalPort" -Level INFO
            
            # Determine which test printer was selected based on the port
            $selectedPrinter = $null
            foreach ($printerConfig in $script:TestConfig.TestPrinters) {
                if ($physicalPort -eq $printerConfig.Port) {
                    $selectedPrinter = $printerConfig
                    break
                }
            }
            
            if ($selectedPrinter) {
                Write-TestLog "Selected printer: $($selectedPrinter.Name)" -Level INFO
                Write-TestLog "Expected score: $($selectedPrinter.ExpectedScore)" -Level INFO
                
                # Verify the highest scoring printer was selected
                # EPSON TM-T20 Receipt Printer should be selected (score: 4)
                $expectedPrinter = $script:TestConfig.TestPrinters | Sort-Object -Property ExpectedScore -Descending | Select-Object -First 1
                
                Assert-Equal -Expected $expectedPrinter.Name -Actual $selectedPrinter.Name -TestName "Highest scoring printer selected"
                
                # Verify driver inheritance
                Assert-Equal -Expected $selectedPrinter.Driver -Actual $tabezaPrinter.DriverName -TestName "Driver inherited from selected printer"
            }
            else {
                Assert-True -Condition $false -TestName "Identify selected printer" -ErrorMessage "Could not determine which printer was selected"
            }
        }
        
        Write-TestLog "Printer prioritization logic verified" -Level SUCCESS
        return $true
    }
    catch {
        Write-TestLog "Prioritization logic test failed: $_" -Level ERROR
        return $false
    }
}

function Test-ExclusionPatterns {
    Write-TestLog "`n=== Test: Exclusion Patterns ===" -Level INFO
    
    try {
        # Create printers that should be excluded
        $excludedPrinters = @(
            @{ Name = "Microsoft Print to PDF"; Driver = "Microsoft Print To PDF"; Port = "PORTPROMPT:" },
            @{ Name = "Test Fax Printer"; Driver = "Generic / Text Only"; Port = "TESTFAX:" }
        )
        
        foreach ($excludedConfig in $excludedPrinters) {
            Write-TestLog "Creating excluded printer: $($excludedConfig.Name)" -Level INFO
            
            # Note: Some excluded printers may already exist or require special drivers
            # We'll create what we can for testing
            try {
                $existing = Get-Printer -Name $excludedConfig.Name -ErrorAction SilentlyContinue
                if (-not $existing) {
                    # Try to create the printer (may fail for system printers)
                    Add-Printer -Name $excludedConfig.Name -DriverName $excludedConfig.Driver -PortName $excludedConfig.Port -ErrorAction SilentlyContinue
                }
            }
            catch {
                Write-TestLog "  Could not create excluded printer (may already exist): $($excludedConfig.Name)" -Level WARNING
            }
        }
        
        # Verify Tabeza Agent still uses the thermal printer, not excluded ones
        $tabezaPrinter = Get-Printer -Name $script:TestConfig.TabezaPrinterName -ErrorAction Stop
        $ports = $tabezaPrinter.PortName -split ','
        $physicalPort = $ports[0]
        
        # Verify physical port is one of our test thermal printers
        $isTestPort = $false
        foreach ($printerConfig in $script:TestConfig.TestPrinters) {
            if ($physicalPort -eq $printerConfig.Port) {
                $isTestPort = $true
                break
            }
        }
        
        Assert-True -Condition $isTestPort -TestName "Excluded printers not selected" -ErrorMessage "Configuration selected an excluded printer"
        
        Write-TestLog "Exclusion patterns verified" -Level SUCCESS
        return $true
    }
    catch {
        Write-TestLog "Exclusion patterns test failed: $_" -Level ERROR
        return $false
    }
}

function Test-ConfigurationWithMultiplePrinters {
    Write-TestLog "`n=== Test: Configuration with Multiple Printers ===" -Level INFO
    
    try {
        # Verify Tabeza Agent configuration
        $tabezaPrinter = Get-Printer -Name $script:TestConfig.TabezaPrinterName -ErrorAction Stop
        
        # Verify dual-port configuration
        $ports = $tabezaPrinter.PortName -split ','
        Assert-Equal -Expected 2 -Actual $ports.Count -TestName "Dual-port configuration"
        
        # Verify capture port exists
        $capturePort = Get-PrinterPort -Name 'TabezaCapturePort' -ErrorAction SilentlyContinue
        Assert-True -Condition ($null -ne $capturePort) -TestName "Capture port created" -ErrorMessage "TabezaCapturePort not found"
        
        # Verify capture file path
        if ($capturePort) {
            Assert-Equal -Expected $script:TestConfig.CaptureFilePath -Actual $capturePort.PrinterHostAddress -TestName "Capture port file path"
        }
        
        # Verify printer is not shared
        Assert-Equal -Expected $false -Actual $tabezaPrinter.Shared -TestName "Printer not shared"
        
        Write-TestLog "Configuration with multiple printers verified" -Level SUCCESS
        return $true
    }
    catch {
        Write-TestLog "Configuration test failed: $_" -Level ERROR
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
        
        # Remove test printers
        foreach ($printerConfig in $script:TestConfig.TestPrinters) {
            $printer = Get-Printer -Name $printerConfig.Name -ErrorAction SilentlyContinue
            if ($printer) {
                Remove-Printer -Name $printerConfig.Name -ErrorAction Stop
                Write-TestLog "Removed test printer: $($printerConfig.Name)" -Level INFO
            }
            
            $port = Get-PrinterPort -Name $printerConfig.Port -ErrorAction SilentlyContinue
            if ($port) {
                Remove-PrinterPort -Name $printerConfig.Port -ErrorAction Stop
                Write-TestLog "Removed test port: $($printerConfig.Port)" -Level INFO
            }
        }
        
        # Remove excluded test printers (if created)
        $excludedNames = @("Microsoft Print to PDF", "Test Fax Printer")
        foreach ($name in $excludedNames) {
            $printer = Get-Printer -Name $name -ErrorAction SilentlyContinue
            if ($printer -and $name -eq "Test Fax Printer") {  # Only remove our test fax printer
                Remove-Printer -Name $name -ErrorAction SilentlyContinue
                Write-TestLog "Removed excluded test printer: $name" -Level INFO
            }
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

function Invoke-MultiplePrintersTest {
    Write-TestLog "`n========================================" -Level INFO
    Write-TestLog "Multiple Thermal Printers Scenario Test" -Level INFO
    Write-TestLog "========================================`n" -Level INFO
    
    $startTime = Get-Date
    
    try {
        # Setup
        if (-not (Install-MultipleThermalPrinters)) {
            Write-TestLog "Failed to install test printers. Aborting tests." -Level ERROR
            return $false
        }
        
        # Run tests
        Test-ThermalPrinterDetection
        Test-PrioritizationLogic
        Test-ExclusionPatterns
        Test-ConfigurationWithMultiplePrinters
        
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
        Write-TestLog "Multiple printers test failed with exception: $_" -Level ERROR
        Write-TestLog $_.ScriptStackTrace -Level ERROR
        return $false
    }
}

# Execute tests
$success = Invoke-MultiplePrintersTest

# Exit with appropriate code
if ($success) {
    Write-TestLog "Multiple printers scenario test passed!" -Level SUCCESS
    exit 0
}
else {
    Write-TestLog "Multiple printers scenario test failed!" -Level ERROR
    exit 1
}

#endregion
