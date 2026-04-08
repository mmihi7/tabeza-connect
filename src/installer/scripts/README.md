# Tabeza Pooling Printer Configuration Scripts

## Overview

This directory contains PowerShell scripts for automatically configuring the Tabeza Agent with pooling mode for print job capture.

## Main Scripts

### `configure-pooling-printer.ps1`

**Purpose**: Main configuration script that automatically detects thermal printers and configures the Tabeza Agent with dual-port pooling.

**Usage**:
```powershell
# Basic usage
.\configure-pooling-printer.ps1 -CaptureFilePath "C:\TabezaPrints\order.prn"

# Silent mode (no console output)
.\configure-pooling-printer.ps1 -CaptureFilePath "C:\TabezaPrints\order.prn" -Silent

# Force reconfiguration
.\configure-pooling-printer.ps1 -CaptureFilePath "C:\TabezaPrints\order.prn" -Force
```

**Requirements**:
- Windows 10/11
- PowerShell 5.1+
- Administrator privileges
- Print Spooler service running
- Physical thermal printer installed

**Exit Codes**:
- `0` - Success (printer configured)
- `1` - Fatal error (configuration failed)
- `2` - Already configured (idempotent)
- `3` - No thermal printer detected
- `4` - Insufficient privileges
- `5` - Print Spooler not running

---

### `uninstall-pooling-printer.ps1`

**Purpose**: Removes the Tabeza Agent and associated configuration.

**Usage**:
```powershell
# Remove Tabeza Agent
.\uninstall-pooling-printer.ps1

# Preserve capture file data
.\uninstall-pooling-printer.ps1 -PreserveData
```

**What it removes**:
- Tabeza Agent
- TabezaCapturePort
- Optionally: Capture directory and files

---

### `quick-test.ps1`

**Purpose**: Quick validation script for testing the configuration in a live environment.

**Usage**:
```powershell
# Run quick test
.\quick-test.ps1

# Clean up test configuration
.\quick-test.ps1 -Cleanup
```

**What it does**:
- Validates prerequisites
- Runs configuration script
- Performs validation checks
- Tests print job capture
- Provides summary and next steps

---

## Test Scripts

### Integration Tests (`__tests__/`)

Automated tests using simulated thermal printers:

- `test-pooling-configuration.ps1` - End-to-end configuration test
- `test-upgrade-scenario.ps1` - Upgrade from v1.6.x test
- `test-multiple-printers.ps1` - Multi-printer detection test
- `run-all-integration-tests.ps1` - Master test runner

**Run all tests**:
```powershell
cd __tests__
.\run-all-integration-tests.ps1
```

### Unit Tests (`__tests__/`)

Tests for individual functions and modules:

- `test-function-syntax.ps1` - PowerShell syntax validation
- `test-new-tabeza-pos-printer.ps1` - Printer creation tests
- `test-idempotency-functions.ps1` - Idempotency tests
- `test-rollback-functions.ps1` - Rollback tests
- `test-printer-creation-errors.ps1` - Error handling tests

---

## Documentation

### In This Directory
- `README.md` (this file) - Overview of scripts
- `__tests__/INTEGRATION-TESTS-README.md` - Integration test documentation

### In Root Directory
- `TESTING-SUMMARY.md` - Overview of all testing resources
- `LIVE-TESTING-GUIDE.md` - Comprehensive live testing guide
- `LIVE-TESTING-CHECKLIST.md` - Testing progress checklist

### In Spec Directory
- `.kiro/specs/auto-configure-tabeza-pooling-printer/requirements.md` - Feature requirements
- `.kiro/specs/auto-configure-tabeza-pooling-printer/design.md` - Technical design
- `.kiro/specs/auto-configure-tabeza-pooling-printer/tasks.md` - Implementation tasks

---

## Quick Start

### For First-Time Testing

1. **Run quick test**:
   ```powershell
   .\quick-test.ps1
   ```

2. **If successful, proceed with comprehensive testing**:
   - See `../../../LIVE-TESTING-GUIDE.md`

### For Development

1. **Run integration tests**:
   ```powershell
   cd __tests__
   .\run-all-integration-tests.ps1
   ```

2. **Test individual functions**:
   ```powershell
   cd __tests__
   .\test-function-syntax.ps1
   .\test-new-tabeza-pos-printer.ps1
   ```

### For Production Deployment

1. **Integrate with Inno Setup**:
   ```pascal
   [Run]
   Filename: "powershell.exe"; \
     Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\configure-pooling-printer.ps1"" -CaptureFilePath ""C:\TabezaPrints\order.prn"""; \
     StatusMsg: "Configuring Tabeza Agent..."; \
     Flags: runhidden waituntilterminated; \
     Check: IsAdminInstallMode
   ```

2. **Add uninstaller support**:
   ```pascal
   [UninstallRun]
   Filename: "powershell.exe"; \
     Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\uninstall-pooling-printer.ps1"" -PreserveData"; \
     RunOnceId: "UninstallPoolingPrinter"
   ```

---

## Configuration Details

### What Gets Created

1. **Tabeza Agent**:
   - Name: "Tabeza Agent"
   - Driver: Same as physical thermal printer
   - Ports: Physical port (USB/LPT) + TabezaCapturePort
   - Shared: False

2. **TabezaCapturePort**:
   - Type: Local Port (FILE)
   - Path: `C:\TabezaPrints\order.prn` (or specified path)

3. **Capture Directory**:
   - Path: `C:\TabezaPrints\` (or parent of specified path)
   - Permissions: Print Spooler service has write access

4. **Log File**:
   - Path: `C:\ProgramData\Tabeza\logs\configure-pooling.log`
   - Max size: 10MB (auto-rotates)
   - Format: ISO 8601 timestamps, log levels

### How It Works

1. **Detection**: Script scans for thermal printers using keyword scoring
2. **Prioritization**: Highest-scoring printer selected (Receipt, Thermal, POS, TM-, etc.)
3. **Configuration**: Creates Tabeza Agent with dual ports:
   - **Physical port** (first): Prints to actual thermal printer
   - **Capture port** (second): Writes to file for monitoring
4. **Validation**: Verifies configuration is correct
5. **Logging**: All operations logged for troubleshooting

### Printer Pooling

Windows printer pooling allows a single printer to have multiple ports. Print jobs are sent to all ports simultaneously:
- **Physical port**: Receipt prints on thermal printer
- **Capture port**: Print data written to file for TabezaConnect service to monitor

---

## Troubleshooting

### Common Issues

**"No thermal printer detected"**
- Ensure thermal printer is installed and working
- Check printer name contains thermal keywords
- Run: `Get-Printer | Format-Table Name, DriverName`

**"Capture file not updating"**
- Check Print Spooler service is running
- Verify capture directory permissions
- Check port configuration: `Get-PrinterPort -Name "TabezaCapturePort"`

**"Physical printer not printing"**
- Verify printer is online
- Check port order (physical should be first)
- Test direct print: `"Test" | Out-Printer -Name "EPSON TM-T20"`

### Diagnostic Commands

```powershell
# Check configuration
Get-Printer -Name "Tabeza Agent" | Format-List *
Get-PrinterPort -Name "TabezaCapturePort" | Format-List *

# View log file
Get-Content "C:\ProgramData\Tabeza\logs\configure-pooling.log" | Select-Object -Last 50

# Test print
"Test Receipt`n$(Get-Date)" | Out-Printer -Name "Tabeza Agent"

# Check capture file
Get-Item "C:\TabezaPrints\order.prn" | Format-List *
```

### Getting Help

1. Check log file: `C:\ProgramData\Tabeza\logs\configure-pooling.log`
2. Review error messages carefully
3. Run diagnostic commands above
4. See `LIVE-TESTING-GUIDE.md` troubleshooting section
5. Contact development team with:
   - Log file
   - System information
   - Printer model and driver
   - Steps to reproduce

---

## Development

### Adding New Functions

1. Add function to `configure-pooling-printer.ps1`
2. Follow PowerShell best practices:
   - Use approved verbs (Get-, Set-, New-, Remove-, Test-)
   - Include comment-based help
   - Add parameter validation
   - Implement error handling
3. Add unit tests in `__tests__/`
4. Update integration tests if needed
5. Update documentation

### Testing Changes

1. Run syntax validation: `.\__tests__\test-function-syntax.ps1`
2. Run unit tests for modified functions
3. Run integration tests: `.\__tests__\run-all-integration-tests.ps1`
4. Test with physical printer: `.\quick-test.ps1`
5. Update documentation

---

## Version History

- **v1.0.0** (2025-03-01): Initial release
  - Automatic thermal printer detection
  - Dual-port pooling configuration
  - Comprehensive error handling
  - Idempotent behavior
  - Integration and unit tests
  - Live testing support

---

## Related Files

- `../../../TESTING-SUMMARY.md` - Testing overview
- `../../../LIVE-TESTING-GUIDE.md` - Live testing guide
- `../../../LIVE-TESTING-CHECKLIST.md` - Testing checklist
- `.kiro/specs/auto-configure-tabeza-pooling-printer/` - Spec files
