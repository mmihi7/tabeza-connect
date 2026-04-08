# Integration Tests - Tabeza Pooling Printer Configuration

## Overview

This directory contains comprehensive integration tests for the automatic Tabeza Pooling Printer configuration feature. These tests verify end-to-end functionality, upgrade scenarios, and multi-printer detection logic.

## Test Scripts

### 1. Basic Integration Test (`test-pooling-configuration.ps1`)

**Purpose**: End-to-end configuration test with a simulated thermal printer

**What it tests**:
- Configuration script execution
- Tabeza Agent creation with dual-port pooling
- Capture port configuration and file writability
- Default printer preservation
- Print job capture functionality
- Idempotent behavior (re-running configuration)

**Requirements**:
- Administrator privileges
- Print Spooler service running
- Generic / Text Only driver (pre-installed on Windows)

**Usage**:
```powershell
# Run with cleanup
.\test-pooling-configuration.ps1

# Run without cleanup (preserve test resources for inspection)
.\test-pooling-configuration.ps1 -SkipCleanup

# Run with verbose output
.\test-pooling-configuration.ps1 -Verbose
```

**Expected Results**:
- All tests pass (exit code 0)
- Tabeza Agent created with 2 ports
- Capture file updated after test print
- No duplicate printers after re-run

---

### 2. Upgrade Scenario Test (`test-upgrade-scenario.ps1`)

**Purpose**: Tests upgrade from v1.6.x to v1.7.0 with automatic pooling configuration

**What it tests**:
- Simulates existing v1.6.x installation (single-port Tabeza Agent)
- Upgrades to v1.7.0 with dual-port pooling
- Verifies configuration is updated correctly
- Ensures capture file data is preserved
- Tests post-upgrade idempotency
- Validates print functionality after upgrade

**Requirements**:
- Administrator privileges
- Print Spooler service running
- Generic / Text Only driver

**Usage**:
```powershell
# Run upgrade scenario test
.\test-upgrade-scenario.ps1

# Run without cleanup
.\test-upgrade-scenario.ps1 -SkipCleanup
```

**Expected Results**:
- v1.6.x configuration successfully upgraded to v1.7.0
- Port count changes from 1 to 2
- Capture file data preserved
- Configuration stable after re-run

---

### 3. Multiple Printers Test (`test-multiple-printers.ps1`)

**Purpose**: Tests thermal printer detection and prioritization with multiple printers

**What it tests**:
- Creates 3 test printers with different thermal keyword scores:
  - Generic USB Printer (score: 0)
  - EPSON TM-T20 Receipt Printer (score: 4)
  - Star TSP100 Thermal POS (score: 3)
- Verifies highest-scoring printer is selected (EPSON TM-T20)
- Tests exclusion patterns (PDF, Fax printers)
- Validates configuration with multiple printers present

**Requirements**:
- Administrator privileges
- Print Spooler service running
- Generic / Text Only driver

**Usage**:
```powershell
# Run multiple printers test
.\test-multiple-printers.ps1

# Run without cleanup
.\test-multiple-printers.ps1 -SkipCleanup
```

**Expected Results**:
- EPSON TM-T20 Receipt Printer selected (highest score)
- Excluded printers not selected
- Dual-port configuration created correctly

---

### 4. Master Test Runner (`run-all-integration-tests.ps1`)

**Purpose**: Runs all integration tests in sequence and provides consolidated results

**What it does**:
- Executes all 3 integration test scripts
- Tracks pass/fail status for each test
- Provides detailed summary with timing
- Supports stop-on-failure mode

**Requirements**:
- Administrator privileges
- Print Spooler service running
- All test scripts present

**Usage**:
```powershell
# Run all integration tests
.\run-all-integration-tests.ps1

# Run all tests without cleanup
.\run-all-integration-tests.ps1 -SkipCleanup

# Stop on first failure
.\run-all-integration-tests.ps1 -StopOnFailure

# Verbose output
.\run-all-integration-tests.ps1 -Verbose
```

**Expected Results**:
- All 3 test scripts pass
- Consolidated summary shows 0 failures
- Exit code 0

---

## Prerequisites

### System Requirements
- Windows 10 or Windows 11
- PowerShell 5.1 or later
- Administrator privileges
- Print Spooler service running

### Driver Requirements
- Generic / Text Only driver (pre-installed on Windows)
- No additional thermal printer drivers required for testing

### Permissions
All test scripts must be run as Administrator:
```powershell
# Right-click PowerShell and select "Run as Administrator"
# Or use this command:
Start-Process powershell -Verb RunAs -ArgumentList "-File .\test-script.ps1"
```

---

## Test Environment

### What Gets Created
Each test creates temporary resources:
- Test thermal printers (e.g., "Test Thermal Printer", "EPSON TM-T20 Receipt Printer")
- Test printer ports (e.g., TESTPORT001, TESTPORT002)
- Tabeza Agent (the actual printer being tested)
- TabezaCapturePort (local port for file capture)
- Capture directory: `C:\TabezaPrints\`
- Capture file: `C:\TabezaPrints\order.prn` or `C:\TabezaPrints\test-order.prn`

### Cleanup Behavior
By default, all tests clean up after themselves:
- Remove all test printers
- Remove all test ports
- Remove Tabeza Agent
- Remove TabezaCapturePort
- Remove capture directory and files

Use `-SkipCleanup` flag to preserve resources for manual inspection.

---

## Interpreting Results

### Success Indicators
- ✓ Green checkmarks for passed tests
- Exit code 0
- "All integration tests passed!" message
- No errors in test output

### Failure Indicators
- ✗ Red X marks for failed tests
- Exit code 1
- "Some integration tests failed!" message
- Detailed error messages in output

### Test Output Format
```
[2025-03-01 14:30:15] [INFO] Running configuration script...
[2025-03-01 14:30:18] [SUCCESS] ✓ Configuration script exit code
[2025-03-01 14:30:18] [SUCCESS] ✓ Tabeza Agent exists
[2025-03-01 14:30:18] [SUCCESS] ✓ Dual-port configuration
```

---

## Troubleshooting

### Common Issues

#### 1. "Must run as Administrator"
**Solution**: Right-click PowerShell and select "Run as Administrator"

#### 2. "Print Spooler service is not running"
**Solution**: 
```powershell
Start-Service -Name Spooler
Set-Service -Name Spooler -StartupType Automatic
```

#### 3. "Driver 'Generic / Text Only' not found"
**Solution**: This driver should be pre-installed on Windows. If missing:
- Open Control Panel → Devices and Printers
- Click "Print server properties" → Drivers tab
- Verify "Generic / Text Only" is listed

#### 4. "Configuration script not found"
**Solution**: Ensure `configure-pooling-printer.ps1` exists in parent directory:
```powershell
Test-Path ..\configure-pooling-printer.ps1
```

#### 5. Tests fail with "Access Denied"
**Solution**: 
- Verify running as Administrator
- Check Print Spooler service is running
- Ensure no other processes are using test printers

#### 6. Cleanup fails
**Solution**: Manually remove test resources:
```powershell
# Remove test printers
Get-Printer | Where-Object { $_.Name -like '*Test*' -or $_.Name -like '*Tabeza*' } | Remove-Printer

# Remove test ports
Get-PrinterPort | Where-Object { $_.Name -like 'TEST*' -or $_.Name -like '*Tabeza*' } | Remove-PrinterPort

# Remove capture directory
Remove-Item -Path C:\TabezaPrints -Recurse -Force
```

---

## Integration with CI/CD

### Automated Testing
These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Integration Tests
  run: |
    powershell -ExecutionPolicy Bypass -File src/installer/scripts/__tests__/run-all-integration-tests.ps1
  shell: pwsh
```

### Test Environments
- **Local Development**: Run tests manually before committing
- **CI/CD Pipeline**: Run tests on Windows build agents
- **Pre-Release**: Run full test suite before installer build
- **Post-Deployment**: Verify installer behavior on test VMs

---

## Test Coverage

### What is Tested
✅ Configuration script execution  
✅ Thermal printer detection  
✅ Printer prioritization logic  
✅ Dual-port pooling configuration  
✅ Capture port creation  
✅ Capture file writability  
✅ Default printer preservation  
✅ Print job capture  
✅ Idempotent behavior  
✅ Upgrade scenarios  
✅ Multiple printer scenarios  
✅ Exclusion patterns  

### What is NOT Tested
❌ Actual thermal printer hardware (uses Generic / Text Only driver)  
❌ Real POS system integration  
❌ Network printer scenarios  
❌ Inno Setup installer integration (tested separately)  
❌ Windows service integration (TabezaConnect service)  

---

## Contributing

### Adding New Tests
1. Create new test script in `__tests__/` directory
2. Follow naming convention: `test-<feature>.ps1`
3. Include standard helper functions (Write-TestLog, Assert-True, etc.)
4. Add cleanup logic with `-SkipCleanup` support
5. Update `run-all-integration-tests.ps1` to include new test
6. Update this README with test description

### Test Script Template
```powershell
#Requires -RunAsAdministrator

param(
    [switch]$SkipCleanup,
    [switch]$Verbose
)

$ErrorActionPreference = 'Stop'
$script:TestResults = @{ Passed = 0; Failed = 0; Errors = @() }

# Helper functions (Write-TestLog, Assert-True, etc.)

# Setup functions

# Test functions

# Cleanup functions

# Main execution
$success = Invoke-Tests
exit $(if ($success) { 0 } else { 1 })
```

---

## Related Documentation

- **Configuration Script**: `../configure-pooling-printer.ps1`
- **Requirements**: `../../../../.kiro/specs/auto-configure-tabeza-pooling-printer/requirements.md`
- **Design**: `../../../../.kiro/specs/auto-configure-tabeza-pooling-printer/design.md`
- **Tasks**: `../../../../.kiro/specs/auto-configure-tabeza-pooling-printer/tasks.md`
- **Unit Tests**: Other test scripts in `__tests__/` directory

---

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review test output for specific error messages
3. Run tests with `-Verbose` flag for detailed logging
4. Inspect test resources with `-SkipCleanup` flag
5. Check configuration log: `C:\ProgramData\Tabeza\logs\configure-pooling.log`

---

## Version History

- **v1.0.0** (2025-03-01): Initial integration test suite
  - Basic integration test
  - Upgrade scenario test
  - Multiple printers test
  - Master test runner
