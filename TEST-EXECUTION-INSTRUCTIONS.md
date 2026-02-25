# Test Execution Instructions - Task 3

## Overview
This document provides step-by-step instructions for executing Task 3: Test printer forwarding chain on development machine.

**Task Goal**: Validate the core bridge functionality before building the installer by testing:
1. Printer detection works correctly
2. File-based port capture works (C:\TabezaPrints\)
3. Print job data is captured correctly
4. Forwarding to physical printer works (Out-Printer)

**Requirements Validated**: 1.2 (folder port approach), 1.3 (printer name as forwarding target)

## Prerequisites Checklist

Before starting, ensure you have:
- [ ] Windows 10/11 development machine
- [ ] Thermal printer connected (USB or Network) and powered on
- [ ] Printer drivers installed and printer shows as "Ready" in Windows
- [ ] PowerShell with Administrator privileges
- [ ] TabezaConnect project cloned locally
- [ ] No existing TabezaConnect installation running

## Test Execution Options

### Option A: Automated Test Script (Recommended)

This script automates most of the testing and guides you through manual verification steps.

**Steps**:
1. Open PowerShell as Administrator
2. Navigate to TabezaConnect directory:
   ```powershell
   cd C:\path\to\TabezaConnect
   ```

3. Run the automated test script:
   ```powershell
   .\run-printer-forwarding-tests.ps1
   ```

4. Follow the on-screen prompts:
   - Script will detect your printer automatically
   - Script will configure the bridge
   - You'll be prompted to print from Notepad (twice)
   - You'll verify if receipts printed correctly

5. Review test results:
   - Results saved to: `test-results-[timestamp].json`
   - Check console output for pass/fail status

**Expected Duration**: 10-15 minutes

---

### Option B: Manual Step-by-Step Testing

If you prefer manual control or the automated script fails, follow these steps:

#### Step 1: Printer Detection (2 minutes)

```powershell
# Navigate to project
cd C:\path\to\TabezaConnect

# Run detection script
.\src\installer\scripts\detect-thermal-printer.ps1 -OutputFile "C:\ProgramData\Tabeza\detected-printer.json"

# View results
Get-Content "C:\ProgramData\Tabeza\detected-printer.json" | ConvertFrom-Json | Format-List
```

**Expected Output**:
```
printerName      : EPSON TM-T20III
originalPortName : USB001
status           : Normal
driverName       : EPSON TM-T20III Receipt
```

**✅ Pass Criteria**:
- Script completes without errors
- JSON file created with printer information
- Printer name matches your thermal printer
- Status is "Normal" or "Ready"

**❌ If Failed**: See Troubleshooting section below

---

#### Step 2: Bridge Configuration (3 minutes)

```powershell
# Run bridge configuration
.\src\installer\scripts\configure-bridge.ps1 -BarId "test-bar-123" -ConfigFile "C:\ProgramData\Tabeza\config.json"

# Verify folders created
Test-Path "C:\TabezaPrints"
Test-Path "C:\TabezaPrints\temp"

# View configuration
Get-Content "C:\ProgramData\Tabeza\config.json" | ConvertFrom-Json | Format-List

# Check printer port
Get-Printer | Where-Object { $_.Name -match "EPSON|TM-|Receipt" } | Select-Object Name, PortName, PrinterStatus
```

**Expected Output**:
```
Folders created: C:\TabezaPrints, C:\TabezaPrints\temp
Config file created with bridge.printerName set
Printer port reconfigured to file path
Print spooler restarted
```

**✅ Pass Criteria**:
- Both folders exist
- config.json contains bridge.printerName field
- Printer port shows file path (e.g., C:\TabezaPrints\receipt.prn)
- Printer status is "Normal" or "Ready"

**❌ If Failed**: See Troubleshooting section below

---

#### Step 3: File Capture Test (5 minutes)

**Manual Print Test**:
1. Open Notepad (Windows key → type "notepad" → Enter)
2. Type the following test receipt:
   ```
   TEST RECEIPT
   Date: [current date/time]
   Item: Beer x1 - 300 KES
   Total: 300 KES
   Thank you!
   ```
3. Press Ctrl+P to open Print dialog
4. Select your thermal printer from the list
5. Click "Print" button

**Verify Capture**:
```powershell
# Check for captured files
Get-ChildItem "C:\TabezaPrints\" -File | Format-Table Name, Length, CreationTime

# View latest file details
$file = Get-ChildItem "C:\TabezaPrints\" -File | Sort-Object CreationTime -Descending | Select-Object -First 1
Write-Host "File: $($file.Name)"
Write-Host "Size: $($file.Length) bytes"
Write-Host "Created: $($file.CreationTime)"
```

**Expected Output**:
```
File created in C:\TabezaPrints\
File size > 0 bytes (typically 100-5000 bytes depending on content)
File timestamp matches print time
```

**✅ Pass Criteria**:
- File appears in C:\TabezaPrints\ folder
- File size is greater than 0 bytes
- File was created within last minute

**❌ If Failed**: See Troubleshooting section below

---

#### Step 4: Physical Printer Forwarding (3 minutes)

```powershell
# Get config
$config = Get-Content "C:\ProgramData\Tabeza\config.json" | ConvertFrom-Json
$printerName = $config.bridge.printerName
Write-Host "Forwarding to: $printerName"

# Get captured file
$file = Get-ChildItem "C:\TabezaPrints\" -File | Sort-Object CreationTime -Descending | Select-Object -First 1
Write-Host "File: $($file.FullName)"

# Forward to physical printer
Get-Content $file.FullName -Raw | Out-Printer -Name $printerName
```

**Expected Output**:
```
Command completes without errors
Physical printer receives print job
Receipt prints on physical printer
Printed content matches Notepad test
```

**✅ Pass Criteria**:
- Out-Printer command completes successfully
- Physical printer prints the receipt
- Receipt content is readable and matches test text

**❌ If Failed**: See Troubleshooting section below

---

#### Step 5: End-to-End Workflow (5 minutes)

```powershell
# Clear capture folder
Remove-Item "C:\TabezaPrints\*" -Force

# Verify folder is empty
Get-ChildItem "C:\TabezaPrints\" -File
```

**Manual Print Test #2**:
1. Open Notepad again
2. Type a different test receipt:
   ```
   WORKFLOW TEST
   Order #12345
   Table 5
   Beer x2 - 600 KES
   Fries x1 - 200 KES
   Total: 800 KES
   ```
3. Print to thermal printer (Ctrl+P)

**Verify and Forward**:
```powershell
# Check new file captured
$newFile = Get-ChildItem "C:\TabezaPrints\" -File | Select-Object -First 1
Write-Host "Captured: $($newFile.Name) - $($newFile.Length) bytes"

# Forward to printer
$config = Get-Content "C:\ProgramData\Tabeza\config.json" | ConvertFrom-Json
Get-Content $newFile.FullName -Raw | Out-Printer -Name $config.bridge.printerName
```

**Expected Output**:
```
New file captured in C:\TabezaPrints\
File forwarded successfully
Receipt prints on physical printer
Printed content matches second test
```

**✅ Pass Criteria**:
- Complete workflow works without errors
- File capture and forwarding both successful
- Receipt prints correctly

---

## Test Results Documentation

After completing all tests, document your results:

### Update Test Plan Document

Edit `PRINTER-FORWARDING-TEST-PLAN.md` and fill in the Test Execution Log:

```markdown
| Test | Status | Notes | Issues |
|------|--------|-------|--------|
| 1. Printer Detection | ✅ Pass | EPSON TM-T20III detected | None |
| 2. Bridge Configuration | ✅ Pass | Folders and config created | None |
| 3. File Capture | ✅ Pass | File captured: 1234 bytes | None |
| 4. Physical Forwarding | ✅ Pass | Receipt printed correctly | None |
| 5. End-to-End Workflow | ✅ Pass | Complete workflow successful | None |
```

### Environment Details

Fill in your environment information:
- **OS Version**: Windows 10/11 version
- **Printer Model**: Your thermal printer model
- **Printer Driver**: Driver name from detection
- **Original Port**: USB001, LPT1, etc.
- **Test Date**: Date of testing

### Save Test Results

If using automated script, results are saved to:
- `test-results-[timestamp].json`

If manual testing, create a summary:
```powershell
$results = @{
    TestDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    PrinterModel = "EPSON TM-T20III"
    AllTestsPassed = $true
    Notes = "All tests completed successfully"
}
$results | ConvertTo-Json | Out-File "manual-test-results.json"
```

---

## Troubleshooting

### Issue: Printer Not Detected

**Symptoms**: detect-thermal-printer.ps1 fails or finds no printers

**Diagnosis**:
```powershell
# Check if printer is visible to Windows
Get-Printer | Format-Table Name, PrinterStatus, PortName

# Check printer drivers
Get-PrinterDriver | Format-Table Name
```

**Solutions**:
1. Verify printer is powered on
2. Check USB cable connection
3. Ensure printer drivers are installed
4. Check printer is not "Offline" in Windows Settings
5. Try printing from Notepad directly to verify printer works

---

### Issue: File Not Captured

**Symptoms**: Print completes but no file in C:\TabezaPrints\

**Diagnosis**:
```powershell
# Check printer port configuration
Get-Printer | Where-Object { $_.Name -match "EPSON|TM-" } | Select-Object Name, PortName

# Check folder permissions
Get-Acl "C:\TabezaPrints" | Format-List

# Check print spooler status
Get-Service Spooler | Select-Object Status
```

**Solutions**:
1. Verify printer port is set to file path (not USB001)
2. Check folder has "Everyone: Full Control" permissions
3. Restart print spooler: `Restart-Service Spooler`
4. Re-run configure-bridge.ps1 script
5. Check Windows Event Viewer for print spooler errors

---

### Issue: Forwarding Fails

**Symptoms**: Out-Printer command fails or printer doesn't print

**Diagnosis**:
```powershell
# Test printer directly
"TEST" | Out-Printer -Name "EPSON TM-T20III"

# Check printer status
Get-Printer -Name "EPSON TM-T20III" | Select-Object PrinterStatus, JobCount

# Check print queue
Get-PrintJob -PrinterName "EPSON TM-T20III"
```

**Solutions**:
1. Verify printer name in config.json matches actual printer
2. Check printer is online and ready (not in error state)
3. Verify printer has paper loaded
4. Clear print queue: `Get-PrintJob -PrinterName "YOUR_PRINTER" | Remove-PrintJob`
5. Test direct print from Notepad to verify printer works

---

### Issue: Binary Data Corruption

**Symptoms**: Printed receipt is garbled or incomplete

**Diagnosis**:
```powershell
# Check file encoding
$file = Get-ChildItem "C:\TabezaPrints\" -File | Select-Object -First 1
$bytes = [System.IO.File]::ReadAllBytes($file.FullName)
Write-Host "File size: $($bytes.Length) bytes"
Write-Host "First 20 bytes: $($bytes[0..19] -join ' ')"
```

**Solutions**:
1. Ensure file is read as raw bytes (not text)
2. Use `-Raw` parameter with Get-Content
3. Try alternative forwarding method:
   ```powershell
   $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
   [System.IO.File]::WriteAllBytes("\\.\USB001", $bytes)
   ```

---

## Success Criteria Summary

Task 3 is complete when:

- ✅ All 5 tests pass successfully
- ✅ Test results documented in PRINTER-FORWARDING-TEST-PLAN.md
- ✅ No critical issues found
- ✅ Printer forwarding chain validated
- ✅ Ready to proceed with installer build

## Next Steps

### If All Tests Pass:
1. Mark task 3 as complete in tasks.md
2. Document any observations or notes
3. Proceed to task 4 (Fix driverId not being added to config.json)

### If Tests Fail:
1. Document specific failures in test plan
2. Identify root cause (detection, capture, or forwarding)
3. Fix issues in scripts (configure-bridge.ps1, detect-thermal-printer.ps1)
4. Re-run failed tests
5. Update design document if architecture changes needed

## Questions or Issues?

If you encounter issues not covered in troubleshooting:
1. Check Windows Event Viewer → Windows Logs → Application
2. Review PowerShell error messages carefully
3. Verify printer works with standard Windows applications (Notepad, WordPad)
4. Document the issue for discussion

---

**Task Status**: Ready for execution
**Estimated Time**: 15-30 minutes
**Difficulty**: Medium (requires manual verification)
