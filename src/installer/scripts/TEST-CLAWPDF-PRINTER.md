# clawPDF Printer Profile Testing Guide

## Overview

This document provides instructions for testing the clawPDF printer profile configuration (Task 1.2.8) to verify that print jobs are correctly captured to the spool folder.

## Prerequisites

Before running the test, ensure:

1. ✅ clawPDF 0.9.3 is installed (Task 1.1.2)
2. ✅ Printer profile is configured (Tasks 1.2.2-1.2.7)
3. ✅ Spool folder exists at `C:\TabezaPrints\spool\`
4. ✅ "Tabeza Agent" appears in Windows Printers

## Test Objectives

The test verifies:

- ✓ Printer exists and is accessible
- ✓ Spool folder is configured correctly
- ✓ Print jobs are captured to spool folder
- ✓ Captured files are in PostScript (.ps) format
- ✓ File naming follows expected pattern
- ✓ Capture happens within acceptable time (< 30 seconds)

## Running the Test

### Method 1: Automated Test Script (Recommended)

Run the PowerShell test script:

```powershell
# Navigate to scripts directory
cd C:\path\to\tabeza-connect\src\installer\scripts

# Run test with default settings
.\test-clawpdf-printer.ps1

# Or with custom parameters
.\test-clawpdf-printer.ps1 -PrinterName "Tabeza Agent" -SpoolFolder "C:\TabezaPrints\spool" -TimeoutSeconds 30
```

**Expected Output (Success):**

```
=== Tabeza Connect - clawPDF Printer Test ===
Printer Name: Tabeza Agent
Spool Folder: C:\TabezaPrints\spool
Timeout: 30 seconds

[1/6] Checking if printer exists...
✓ Printer found: Tabeza Agent
  Driver: clawPDF
  Port: clawPDFPort
  Status: Normal

[2/6] Checking spool folder...
✓ Spool folder exists: C:\TabezaPrints\spool

[3/6] Counting existing spool files...
✓ Found 0 existing file(s)

[4/6] Creating test print job...
✓ Test content created: C:\Users\...\tabeza-test-print-20260306-143022.txt

[5/6] Sending test print job to 'Tabeza Agent'...
✓ Print job sent successfully

[6/6] Waiting for captured file in spool folder...
Waiting... (3/30 seconds)

========================================
✓ TEST PASSED!
========================================

Captured file details:
  Name: 20260306_143025_abc123.ps
  Path: C:\TabezaPrints\spool\20260306_143025_abc123.ps
  Size: 1234 bytes
  Created: 3/6/2026 2:30:25 PM

The clawPDF printer profile is working correctly!
Print jobs are being captured to: C:\TabezaPrints\spool
```

**Expected Output (Failure):**

```
========================================
✗ TEST FAILED!
========================================

No captured file detected after 30 seconds

Possible issues:
  1. clawPDF printer profile not configured correctly
  2. Output directory not set to: C:\TabezaPrints\spool
  3. Auto-save not enabled in clawPDF settings
  4. clawPDF service not running
  5. Permissions issue with spool folder

Troubleshooting steps:
  1. Check clawPDF settings at: %APPDATA%\clawSoft\clawPDF\Settings.ini
  2. Verify registry settings at: HKCU:\Software\clawSoft\clawPDF
  3. Check Windows Event Viewer for clawPDF errors
  4. Try printing manually to 'Tabeza Agent' from Notepad
  5. Re-run configure-clawpdf.ps1 script
```

### Method 2: Manual Test

If the automated script fails or you want to test manually:

1. **Open Notepad**
   ```
   notepad.exe
   ```

2. **Type test content:**
   ```
   ========================================
       TABEZA CONNECT TEST RECEIPT
   ========================================
   
   Test Time: [Current Date/Time]
   
   This is a manual test print job.
   
   ========================================
   ```

3. **Print to clawPDF printer:**
   - File → Print (Ctrl+P)
   - Select "Tabeza Agent"
   - Click "Print"

4. **Check spool folder:**
   ```powershell
   # Open spool folder
   explorer C:\TabezaPrints\spool
   
   # Or list files
   Get-ChildItem C:\TabezaPrints\spool -Filter "*.ps"
   ```

5. **Verify file created:**
   - File should appear within 5-10 seconds
   - File extension should be `.ps` (PostScript)
   - File name should follow pattern: `YYYYMMDD_HHMMSS_JobID.ps`

## Validation Checklist

After running the test, verify:

- [ ] Test script exits with code 0 (success)
- [ ] Captured file exists in spool folder
- [ ] File extension is `.ps` (PostScript format)
- [ ] File size is > 0 bytes
- [ ] File was created within 30 seconds of print job
- [ ] File name follows expected pattern
- [ ] File content is readable (PostScript format)
- [ ] No errors in Windows Event Viewer
- [ ] No errors in clawPDF logs

## Troubleshooting

### Issue: Printer not found

**Symptoms:**
```
ERROR: Printer 'Tabeza Agent' not found
```

**Solutions:**
1. Verify clawPDF is installed:
   ```powershell
   Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*" | 
       Where-Object { $_.DisplayName -like "*clawPDF*" }
   ```

2. Check available printers:
   ```powershell
   Get-Printer | Format-Table Name, DriverName, PortName
   ```

3. Re-run configuration script:
   ```powershell
   .\configure-clawpdf.ps1
   ```

### Issue: Spool folder not found

**Symptoms:**
```
ERROR: Spool folder not found: C:\TabezaPrints\spool
```

**Solutions:**
1. Create spool folder manually:
   ```powershell
   New-Item -ItemType Directory -Path "C:\TabezaPrints\spool" -Force
   ```

2. Set permissions:
   ```powershell
   $acl = Get-Acl "C:\TabezaPrints\spool"
   $permission = "Everyone", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"
   $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
   $acl.SetAccessRule($accessRule)
   Set-Acl "C:\TabezaPrints\spool" $acl
   ```

### Issue: No file captured after timeout

**Symptoms:**
```
✗ TEST FAILED!
No captured file detected after 30 seconds
```

**Solutions:**

1. **Check clawPDF settings file:**
   ```powershell
   notepad "$env:APPDATA\clawSoft\clawPDF\Settings.ini"
   ```
   
   Verify:
   - `AutoSaveEnabled=true`
   - `AutoSaveDirectory=C:\TabezaPrints\spool`
   - `OutputFormat=PostScript`

2. **Check registry settings:**
   ```powershell
   Get-ItemProperty "HKCU:\Software\clawSoft\clawPDF"
   ```
   
   Verify:
   - `AutoSaveDirectory` = `C:\TabezaPrints\spool`
   - `AutoSaveEnabled` = `1`
   - `OutputFormat` = `PostScript`

3. **Check clawPDF service:**
   ```powershell
   Get-Service | Where-Object { $_.Name -like "*claw*" }
   ```
   
   If service exists and is stopped:
   ```powershell
   Start-Service -Name "clawPDF"
   ```

4. **Check Windows Event Viewer:**
   ```powershell
   Get-EventLog -LogName Application -Source "clawPDF" -Newest 10
   ```

5. **Re-configure printer profile:**
   ```powershell
   .\configure-clawpdf.ps1 -PrinterName "Tabeza Agent" -SpoolFolder "C:\TabezaPrints\spool"
   ```

### Issue: File captured but wrong format

**Symptoms:**
- File has wrong extension (not `.ps`)
- File is PDF instead of PostScript
- File content is not PostScript

**Solutions:**

1. **Update output format in settings:**
   ```powershell
   $regPath = "HKCU:\Software\clawSoft\clawPDF"
   Set-ItemProperty -Path $regPath -Name "OutputFormat" -Value "PostScript" -Type String
   ```

2. **Update settings file:**
   ```powershell
   $settingsFile = "$env:APPDATA\clawSoft\clawPDF\Settings.ini"
   # Edit file and set: OutputFormat=PostScript
   ```

3. **Re-run configuration:**
   ```powershell
   .\configure-clawpdf.ps1
   ```

## Success Criteria

Task 1.2.8 is complete when:

✅ Test script runs successfully (exit code 0)
✅ Print job is captured to spool folder within 30 seconds
✅ Captured file is in PostScript (.ps) format
✅ File size is > 0 bytes
✅ File name follows expected pattern
✅ No errors in logs or Event Viewer
✅ Test can be repeated successfully

## Next Steps

After successful test completion:

1. **Mark task 1.2.8 as complete** in tasks.md
2. **Proceed to Phase 1.3** - Registry Configuration (tasks 1.3.1-1.3.8)
3. **Document test results** in IMPLEMENTATION-PROGRESS.md
4. **Archive test logs** for reference

## Test Logs

Test logs are saved to:
- **Script log:** `%TEMP%\TabezaConnect-clawPDF-test.log`
- **Configuration log:** `%TEMP%\TabezaConnect-clawPDF-config.log`
- **Installation log:** `%TEMP%\TabezaConnect-clawPDF-install.log`

View logs:
```powershell
# View test log
notepad "$env:TEMP\TabezaConnect-clawPDF-test.log"

# View all logs
Get-ChildItem "$env:TEMP\TabezaConnect-clawPDF-*.log" | ForEach-Object { 
    Write-Host "=== $($_.Name) ===" -ForegroundColor Cyan
    Get-Content $_.FullName -Tail 20
    Write-Host ""
}
```

## References

- **Requirements:** `.kiro/specs/virtual-printer-capture/requirements.md` (Requirement 1)
- **Design:** `.kiro/specs/virtual-printer-capture/design.md` (Section 1.2)
- **Tasks:** `.kiro/specs/virtual-printer-capture/tasks.md` (Task 1.2.8)
- **clawPDF GitHub:** https://github.com/clawsoftware/clawPDF
- **Configuration Script:** `src/installer/scripts/configure-clawpdf.ps1`
- **Test Script:** `src/installer/scripts/test-clawpdf-printer.ps1`

---

**Last Updated:** 2026-03-06
**Task:** 1.2.8 Test printer profile with test print job
**Status:** Ready for Testing
