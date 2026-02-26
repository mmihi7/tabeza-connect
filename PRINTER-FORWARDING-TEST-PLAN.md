# Printer Forwarding Chain Test Plan

## Purpose
Validate the core bridge functionality before building the installer. This test ensures that:
1. Printer detection works correctly
2. File-based port capture works (C:\TabezaPrints\)
3. Print job data is captured correctly
4. Forwarding to physical printer works (Out-Printer)

**Requirements Validated**: 1.2 (folder port approach), 1.3 (printer name as forwarding target)

## Test Environment Setup

### Prerequisites
- Windows 10/11 machine
- Thermal printer connected (USB or Network)
- PowerShell with admin privileges
- Notepad (built-in Windows app)

### Initial State
- No existing TabezaConnect installation
- Printer drivers installed and printer online
- C:\TabezaPrints\ folder does not exist yet

## Test Sequence

### Test 1: Printer Detection
**Objective**: Verify detect-thermal-printer.ps1 correctly identifies the printer

**Steps**:
1. Open PowerShell as Administrator
2. Navigate to TabezaConnect directory
3. Run detection script:
   ```powershell
   .\src\installer\scripts\detect-thermal-printer.ps1 -OutputFile "C:\ProgramData\Tabeza\detected-printer.json"
   ```

**Expected Results**:
- ✅ Script completes without errors
- ✅ File created: C:\ProgramData\Tabeza\detected-printer.json
- ✅ JSON contains: printerName, originalPortName, status, driverName
- ✅ Printer name matches actual thermal printer
- ✅ Status is "Normal" or "Ready"

**Validation**:
```powershell
# View detected printer info
Get-Content "C:\ProgramData\Tabeza\detected-printer.json" | ConvertFrom-Json | Format-List
```

**Pass Criteria**: JSON file exists with valid printer information

---

### Test 2: Bridge Configuration
**Objective**: Verify configure-bridge.ps1 sets up folder port correctly

**Steps**:
1. Create a test config file location:
   ```powershell
   New-Item -ItemType Directory -Path "C:\ProgramData\Tabeza" -Force
   ```

2. Run bridge configuration:
   ```powershell
   .\src\installer\scripts\configure-bridge.ps1 -BarId "test-bar-123" -ConfigFile "C:\ProgramData\Tabeza\config.json"
   ```

**Expected Results**:
- ✅ Script completes without errors
- ✅ Folder created: C:\TabezaPrints\
- ✅ Folder created: C:\TabezaPrints\temp\
- ✅ Printer port configured to file path
- ✅ Print spooler restarted successfully
- ✅ config.json created with bridge.printerName field

**Validation**:
```powershell
# Check folders exist
Test-Path "C:\TabezaPrints"
Test-Path "C:\TabezaPrints\temp"

# Check printer port configuration
Get-Printer | Where-Object { $_.Name -match "EPSON|TM-|Receipt" } | Select-Object Name, PortName

# Check config.json
Get-Content "C:\ProgramData\Tabeza\config.json" | ConvertFrom-Json | Select-Object -ExpandProperty bridge
```

**Pass Criteria**: 
- Folders exist with correct permissions
- Printer port points to file path in C:\TabezaPrints\
- config.json contains printer name for forwarding

---

### Test 3: File Capture Test (Notepad Print)
**Objective**: Verify print jobs are captured as files in C:\TabezaPrints\

**Steps**:
1. Open Notepad
2. Type test receipt content:
   ```
   TEST RECEIPT
   Date: [current date/time]
   Item: Beer x1 - 300 KES
   Total: 300 KES
   Thank you!
   ```

3. Print to the configured printer:
   - Press Ctrl+P
   - Select the thermal printer (should show port as file path)
   - Click Print

4. Check capture folder:
   ```powershell
   Get-ChildItem "C:\TabezaPrints\" -File
   ```

**Expected Results**:
- ✅ Print dialog shows printer with Local Port
- ✅ Print completes without errors
- ✅ New file appears in C:\TabezaPrints\
- ✅ File contains print job data (may be binary/ESC/POS format)
- ✅ File size > 0 bytes

**Validation**:
```powershell
# List captured files
Get-ChildItem "C:\TabezaPrints\" -File | Select-Object Name, Length, CreationTime

# View file content (may be binary)
$file = Get-ChildItem "C:\TabezaPrints\" -File | Select-Object -First 1
Get-Content $file.FullName -Raw -Encoding Byte | Format-Hex
```

**Pass Criteria**: 
- File created in C:\TabezaPrints\
- File contains print data (binary or text)
- File timestamp matches print time

---

### Test 4: Physical Printer Forwarding
**Objective**: Verify Out-Printer can forward captured file to physical printer

**Steps**:
1. Get the captured file from Test 3:
   ```powershell
   $capturedFile = Get-ChildItem "C:\TabezaPrints\" -File | Select-Object -First 1
   ```

2. Get printer name from config:
   ```powershell
   $config = Get-Content "C:\ProgramData\Tabeza\config.json" | ConvertFrom-Json
   $printerName = $config.bridge.printerName
   Write-Host "Forwarding to: $printerName"
   ```

3. Forward to physical printer:
   ```powershell
   Get-Content $capturedFile.FullName -Raw | Out-Printer -Name $printerName
   ```

**Expected Results**:
- ✅ Out-Printer command completes without errors
- ✅ Physical printer receives print job
- ✅ Receipt prints on physical printer
- ✅ Printed content matches original Notepad test

**Validation**:
- Visual inspection: Receipt printed on physical printer
- Content verification: Receipt shows test text from Notepad

**Pass Criteria**: 
- Physical printer prints the receipt
- No errors in PowerShell
- Receipt content is readable

---

### Test 5: End-to-End Workflow
**Objective**: Verify complete capture → forward workflow

**Steps**:
1. Clear capture folder:
   ```powershell
   Remove-Item "C:\TabezaPrints\*" -Force
   ```

2. Print from Notepad (different content):
   ```
   WORKFLOW TEST
   Order #12345
   Table 5
   Beer x2 - 600 KES
   Fries x1 - 200 KES
   Total: 800 KES
   ```

3. Verify capture:
   ```powershell
   $newFile = Get-ChildItem "C:\TabezaPrints\" -File | Select-Object -First 1
   Write-Host "Captured: $($newFile.Name) - $($newFile.Length) bytes"
   ```

4. Forward to printer:
   ```powershell
   $config = Get-Content "C:\ProgramData\Tabeza\config.json" | ConvertFrom-Json
   Get-Content $newFile.FullName -Raw | Out-Printer -Name $config.bridge.printerName
   ```

**Expected Results**:
- ✅ Print job captured in C:\TabezaPrints\
- ✅ File forwarded to physical printer successfully
- ✅ Receipt prints with correct content
- ✅ No data loss or corruption

**Pass Criteria**: Complete workflow works without manual intervention

---

## Test Results Documentation

### Test Execution Log

| Test | Status | Notes | Issues |
|------|--------|-------|--------|
| 1. Printer Detection | ⏳ Pending | | |
| 2. Bridge Configuration | ⏳ Pending | | |
| 3. File Capture | ⏳ Pending | | |
| 4. Physical Forwarding | ⏳ Pending | | |
| 5. End-to-End Workflow | ⏳ Pending | | |

### Environment Details
- **OS Version**: [To be filled]
- **Printer Model**: [To be filled]
- **Printer Driver**: [To be filled]
- **Original Port**: [To be filled]
- **Test Date**: [To be filled]

### Issues Found

#### Issue Template
```
Issue #: [number]
Test: [test name]
Description: [what went wrong]
Expected: [what should happen]
Actual: [what actually happened]
Workaround: [if any]
Fix Required: [yes/no]
```

### Files Generated During Testing

```powershell
# Collect all test artifacts
$testArtifacts = @{
    DetectedPrinter = "C:\ProgramData\Tabeza\detected-printer.json"
    Config = "C:\ProgramData\Tabeza\config.json"
    CapturedFiles = Get-ChildItem "C:\TabezaPrints\" -File
    InstallationStatus = "C:\ProgramData\Tabeza\logs\installation-status.json"
}

# Export test results
$testArtifacts | ConvertTo-Json -Depth 5 | Out-File "test-results.json"
```

## Troubleshooting Guide

### Issue: Printer Not Detected
**Symptoms**: detect-thermal-printer.ps1 fails or finds no printers

**Checks**:
1. Verify printer is powered on
2. Check printer shows in Windows Settings → Printers
3. Verify printer status is not "Offline"
4. Check printer drivers are installed

**Fix**:
```powershell
# List all printers
Get-Printer | Format-Table Name, PrinterStatus, PortName

# Check printer drivers
Get-PrinterDriver | Format-Table Name
```

---

### Issue: File Not Captured
**Symptoms**: Print completes but no file in C:\TabezaPrints\

**Checks**:
1. Verify printer port is set to file path
2. Check folder permissions (Everyone: Full Control)
3. Verify print spooler is running
4. Check for errors in Event Viewer

**Fix**:
```powershell
# Check printer port
Get-Printer | Where-Object { $_.Name -match "EPSON|TM-" } | Select-Object Name, PortName

# Check folder permissions
Get-Acl "C:\TabezaPrints" | Format-List

# Restart print spooler
Restart-Service Spooler
```

---

### Issue: Forwarding Fails
**Symptoms**: Out-Printer command fails or printer doesn't print

**Checks**:
1. Verify printer name is correct in config.json
2. Check printer is online and ready
3. Verify printer has paper and is not in error state
4. Test direct print from Notepad to verify printer works

**Fix**:
```powershell
# Test printer directly
"TEST" | Out-Printer -Name "EPSON TM-T20III"

# Check printer status
Get-Printer -Name "EPSON TM-T20III" | Select-Object PrinterStatus, JobCount

# Check print queue
Get-PrintJob -PrinterName "EPSON TM-T20III"
```

---

### Issue: Binary Data Corruption
**Symptoms**: Printed receipt is garbled or incomplete

**Checks**:
1. Verify file encoding is preserved (binary)
2. Check file size matches expected print data
3. Verify no text encoding conversion occurs

**Fix**:
```powershell
# Read as raw bytes
$bytes = [System.IO.File]::ReadAllBytes($capturedFile.FullName)
Write-Host "File size: $($bytes.Length) bytes"

# Forward as binary
[System.IO.File]::WriteAllBytes("\\.\USB001", $bytes)
```

## Success Criteria

All tests must pass with the following criteria:

1. ✅ **Printer Detection**: Script identifies thermal printer correctly
2. ✅ **Bridge Configuration**: Folder port created and printer reconfigured
3. ✅ **File Capture**: Print jobs saved as files in C:\TabezaPrints\
4. ✅ **Physical Forwarding**: Out-Printer successfully prints to physical printer
5. ✅ **End-to-End**: Complete workflow works without errors

**Overall Status**: ⏳ Testing in Progress

## Next Steps After Testing

### If All Tests Pass:
1. Document test results in this file
2. Update task status to complete
3. Proceed with installer build (Task 4+)

### If Tests Fail:
1. Document specific failures in Issues section
2. Identify root cause (detection, capture, or forwarding)
3. Fix issues in scripts
4. Re-run failed tests
5. Update design document if architecture changes needed

## Notes

- This is manual testing to validate core functionality
- Automated tests will be added in later tasks
- Focus is on the printer forwarding chain, not full installer
- Test on development machine before building installer package
