# Ready for Live Testing - Tabeza Pooling Printer Configuration

## Status: ✅ All Files Built and Ready

All required files for live testing have been created and are ready for execution.

## What Was Built

### 1. Testing Documentation (Root Directory)

✅ **TESTING-SUMMARY.md**
- Comprehensive overview of all testing resources
- Testing workflow and phases
- Test coverage matrix
- Quick start guides for developers and QA

✅ **LIVE-TESTING-GUIDE.md**
- Step-by-step testing scenarios
- Pre-testing checklist
- 5 comprehensive test scenarios
- Post-testing validation
- Troubleshooting guide
- Success criteria

✅ **LIVE-TESTING-CHECKLIST.md**
- Complete checklist for tracking test progress
- All scenarios covered
- Sign-off section
- Issue tracking template
- Quick reference commands

### 2. Testing Scripts

✅ **quick-test.ps1**
- Quick validation script for live testing
- Pre-flight checks
- Configuration execution
- Validation checks
- Print job capture test
- Cleanup support

### 3. Integration Tests (Already Complete)

✅ **test-pooling-configuration.ps1**
- End-to-end configuration test
- Simulated thermal printer
- Full validation suite

✅ **test-upgrade-scenario.ps1**
- v1.6.x to v1.7.0 upgrade test
- Data preservation verification
- Idempotency testing

✅ **test-multiple-printers.ps1**
- Multi-printer detection test
- Prioritization logic validation
- Exclusion pattern testing

✅ **run-all-integration-tests.ps1**
- Master test runner
- Consolidated results
- Stop-on-failure support

✅ **INTEGRATION-TESTS-README.md**
- Complete integration test documentation
- Usage instructions
- Troubleshooting guide

### 4. Supporting Documentation

✅ **src/installer/scripts/README.md**
- Overview of all scripts
- Usage instructions
- Quick start guides
- Troubleshooting section

---

## How to Start Live Testing

### Option 1: Quick Test (Recommended First Step)

**Time**: 5-10 minutes

```powershell
# 1. Open PowerShell as Administrator
# 2. Navigate to scripts directory
cd C:\Projects\tabeza-connect\src\installer\scripts

# 3. Run quick test
.\quick-test.ps1

# 4. Review results
# - All checks should pass
# - Configuration should succeed
# - Print capture should work
```

**What it validates**:
- Administrator privileges
- Print Spooler service
- Thermal printer detection
- Configuration script execution
- Tabeza POS Printer creation
- Dual-port configuration
- Print job capture

**Expected output**:
```
========================================
Tabeza Pooling Printer - Quick Test
========================================

Pre-Flight Checks
========================================
✓ Administrator privileges
✓ Print Spooler service running
✓ Thermal printer detected (1 found)

Running Configuration Script
========================================
[Configuration output...]

Validation Checks
========================================
✓ Tabeza POS Printer exists
✓ Dual-port configuration (2 ports)
✓ Printer not shared
✓ TabezaCapturePort exists
✓ Capture file exists

Print Job Capture Test
========================================
✓ Print job captured

Test Summary
========================================
Configuration: SUCCESS
```

---

### Option 2: Comprehensive Testing

**Time**: 1-2 hours

**Follow the guide**:
1. Open `LIVE-TESTING-GUIDE.md`
2. Complete pre-testing checklist
3. Execute all 5 test scenarios:
   - Scenario 1: Fresh Installation
   - Scenario 2: Idempotent Behavior
   - Scenario 3: Upgrade from v1.6.x
   - Scenario 4: Multiple Thermal Printers
   - Scenario 5: Error Handling
4. Perform post-testing validation
5. Document results in `LIVE-TESTING-CHECKLIST.md`

---

### Option 3: Integration Tests First

**Time**: 10-15 minutes

```powershell
# 1. Open PowerShell as Administrator
# 2. Navigate to tests directory
cd C:\Projects\tabeza-connect\src\installer\scripts\__tests__

# 3. Run all integration tests
.\run-all-integration-tests.ps1

# 4. Verify all tests pass
# Expected: 3 tests passed, 0 failed
```

**Why run integration tests first**:
- Validates script logic without requiring physical printer
- Uses Generic / Text Only driver (available on all Windows)
- Faster than live testing
- Catches basic issues early

---

## Prerequisites for Live Testing

### System Requirements
- ✅ Windows 10 (21H2+) or Windows 11 (22H2+)
- ✅ PowerShell 5.1 or later
- ✅ Administrator access
- ✅ Print Spooler service running

### Hardware Requirements
- ⚠️ **Physical thermal printer required**
  - EPSON TM-T20, Star TSP100, or compatible
  - USB cable or network connection
  - Printer driver installed from manufacturer

### Software Requirements
- ✅ Thermal printer driver installed and working
- ✅ Printer accessible in Windows Settings → Devices → Printers
- ✅ Test print successful on physical printer

### Verification Commands

```powershell
# Check Windows version
[System.Environment]::OSVersion.Version

# Check PowerShell version
$PSVersionTable.PSVersion

# Check administrator privileges
([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

# Check Print Spooler
Get-Service -Name Spooler

# List thermal printers
Get-Printer | Where-Object { 
    $_.Name -like '*Receipt*' -or 
    $_.Name -like '*Thermal*' -or 
    $_.Name -like '*POS*' -or 
    $_.Name -like '*TM-*' 
}

# Test print to physical printer
"Test Receipt`n$(Get-Date)" | Out-Printer -Name "EPSON TM-T20 Receipt"
```

---

## What to Expect

### Successful Configuration

When configuration succeeds, you should see:

1. **Console Output**:
   ```
   [2025-03-01T14:30:15.123+03:00][INFO] Tabeza POS Printer Configuration Script
   [2025-03-01T14:30:15.456+03:00][INFO] Detecting thermal printers...
   [2025-03-01T14:30:16.789+03:00][INFO] Found thermal printer: EPSON TM-T20 Receipt
   [2025-03-01T14:30:17.012+03:00][INFO] Creating Tabeza POS Printer...
   [2025-03-01T14:30:18.345+03:00][INFO] Configuration successful
   ```

2. **Created Resources**:
   - Tabeza POS Printer (visible in Windows Settings → Printers)
   - TabezaCapturePort (local port to file)
   - Capture directory: `C:\TabezaPrints\`
   - Capture file: `C:\TabezaPrints\order.prn`
   - Log file: `C:\ProgramData\Tabeza\logs\configure-pooling.log`

3. **Printer Configuration**:
   - Name: "Tabeza POS Printer"
   - Driver: Same as physical thermal printer
   - Ports: 2 (physical port + TabezaCapturePort)
   - Shared: False
   - Status: Normal

4. **Print Behavior**:
   - Printing to "Tabeza POS Printer" → Receipt prints on thermal printer
   - Capture file updates with print data
   - Physical printer still works independently

### Common Issues

**Issue**: "No thermal printer detected"
- **Cause**: Thermal printer not installed or name doesn't match keywords
- **Solution**: Install thermal printer driver, verify printer name

**Issue**: "Insufficient privileges"
- **Cause**: Not running as Administrator
- **Solution**: Right-click PowerShell → "Run as administrator"

**Issue**: "Print Spooler not running"
- **Cause**: Print Spooler service stopped
- **Solution**: `Start-Service -Name Spooler`

---

## Next Steps After Testing

### If Quick Test Passes ✅

1. Proceed with comprehensive testing (LIVE-TESTING-GUIDE.md)
2. Test all scenarios
3. Document results in checklist
4. Test on different Windows versions
5. Test with different thermal printer models

### If Quick Test Fails ❌

1. Review error messages
2. Check log file: `C:\ProgramData\Tabeza\logs\configure-pooling.log`
3. Verify prerequisites
4. Run diagnostic commands
5. See troubleshooting section in LIVE-TESTING-GUIDE.md

### After Successful Live Testing

1. ✅ Mark checklist as complete
2. ✅ Document any issues found
3. ✅ Test installer integration (Inno Setup)
4. ✅ Test uninstaller
5. ✅ Prepare for production deployment

---

## File Locations

### Documentation
```
tabeza-connect/
├── TESTING-SUMMARY.md              ← Start here for overview
├── LIVE-TESTING-GUIDE.md           ← Comprehensive testing guide
├── LIVE-TESTING-CHECKLIST.md       ← Track your progress
└── READY-FOR-LIVE-TESTING.md       ← This file
```

### Scripts
```
tabeza-connect/src/installer/scripts/
├── configure-pooling-printer.ps1   ← Main configuration script
├── uninstall-pooling-printer.ps1   ← Uninstaller script
├── quick-test.ps1                  ← Quick validation script
├── README.md                       ← Scripts documentation
└── __tests__/
    ├── test-pooling-configuration.ps1
    ├── test-upgrade-scenario.ps1
    ├── test-multiple-printers.ps1
    ├── run-all-integration-tests.ps1
    └── INTEGRATION-TESTS-README.md
```

### Spec Files
```
tabeza-connect/.kiro/specs/auto-configure-tabeza-pooling-printer/
├── requirements.md                 ← Feature requirements
├── design.md                       ← Technical design
└── tasks.md                        ← Implementation tasks
```

---

## Quick Reference

### Run Quick Test
```powershell
cd C:\Projects\tabeza-connect\src\installer\scripts
.\quick-test.ps1
```

### Run Integration Tests
```powershell
cd C:\Projects\tabeza-connect\src\installer\scripts\__tests__
.\run-all-integration-tests.ps1
```

### Run Configuration Manually
```powershell
cd C:\Projects\tabeza-connect\src\installer\scripts
.\configure-pooling-printer.ps1 -CaptureFilePath "C:\TabezaPrints\order.prn"
```

### Check Configuration
```powershell
Get-Printer -Name "Tabeza POS Printer" | Format-List *
Get-PrinterPort -Name "TabezaCapturePort" | Format-List *
Get-Content "C:\ProgramData\Tabeza\logs\configure-pooling.log" | Select-Object -Last 50
```

### Cleanup
```powershell
.\quick-test.ps1 -Cleanup
```

---

## Support

### Documentation
- **Overview**: TESTING-SUMMARY.md
- **Testing Guide**: LIVE-TESTING-GUIDE.md
- **Checklist**: LIVE-TESTING-CHECKLIST.md
- **Scripts**: src/installer/scripts/README.md
- **Integration Tests**: src/installer/scripts/__tests__/INTEGRATION-TESTS-README.md

### Troubleshooting
- Check log file: `C:\ProgramData\Tabeza\logs\configure-pooling.log`
- Review error messages
- Run diagnostic commands
- See troubleshooting sections in guides

### Contact
- Development team
- Include: log files, system info, printer model, steps to reproduce

---

## Summary

✅ **All files built and ready for live testing**

✅ **Quick test script available** (`quick-test.ps1`)

✅ **Comprehensive testing guide available** (`LIVE-TESTING-GUIDE.md`)

✅ **Progress tracking checklist available** (`LIVE-TESTING-CHECKLIST.md`)

✅ **Integration tests complete and passing**

⚠️ **Physical thermal printer required for live testing**

🚀 **Ready to start testing!**

---

## Get Started Now

```powershell
# 1. Open PowerShell as Administrator
# 2. Navigate to scripts directory
cd C:\Projects\tabeza-connect\src\installer\scripts

# 3. Run quick test
.\quick-test.ps1

# 4. Follow the output and next steps
```

**Good luck with testing!** 🎉
