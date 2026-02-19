# TabezaConnect Installer Testing Plan

## Overview
This document provides a comprehensive manual testing plan for validating the TabezaConnect installer fixes, specifically focusing on UAC elevation and temp directory handling (Task 1.3).

**Version**: 1.3.0  
**Last Updated**: 2026-02-19  
**Testing Focus**: Admin rights handling, temp directory permissions, retry logic

---

## Prerequisites

### Test Environment Setup
1. **Virtual Machines Required**:
   - Windows 10 Pro (clean install)
   - Windows 11 Pro (clean install)
   - Both with latest updates installed

2. **User Accounts**:
   - Administrator account (full admin rights)
   - Standard user account (no admin rights)
   - Restricted user account (limited permissions)

3. **Software Requirements**:
   - Windows Defender enabled (default)
   - Avast Free Antivirus (optional, for TC6.2)
   - Process Monitor (Sysinternals) for debugging
   - Event Viewer access

4. **Test Artifacts**:
   - TabezaConnect-Setup-v1.3.0.exe (compiled installer)
   - Valid Bar ID for testing (e.g., "test_bar_12345")
   - Backup of previous installer version (v1.2.0) for comparison

---

## Test Case 1.1: Install with Admin Rights → Success

### Objective
Verify that the installer completes successfully when run with administrator privileges.

### Prerequisites
- Clean Windows 10/11 VM
- Logged in as Administrator account
- No previous TabezaConnect installation

### Test Steps

#### Step 1: Download and Verify Installer
1. Download `TabezaConnect-Setup-v1.3.0.exe`
2. Verify file size is reasonable (~50MB)
3. Check file properties → Digital Signatures (note: may be unsigned for MVP)

#### Step 2: Run Installer as Administrator
1. Right-click `TabezaConnect-Setup-v1.3.0.exe`
2. Select **"Run as administrator"**
3. Observe UAC prompt appears
4. Click **"Yes"** to grant admin rights

**Expected Result**: UAC prompt shows "Tabeza POS Connect Setup" with publisher information

#### Step 3: Complete Installation Wizard
1. **Welcome Screen**:
   - Verify title shows "Tabeza POS Connect Setup"
   - Click **Next**

2. **Terms & Conditions Page**:
   - Verify checkbox text: "I accept the Terms of Service and Privacy Policy"
   - Verify link to https://tabeza.co.ke/terms is present
   - Try clicking **Next** without accepting → Should be blocked
   - Check the acceptance checkbox
   - Click **Next**

3. **Bar ID Input Page**:
   - Enter valid Bar ID: `test_bar_12345`
   - Click **Next**

4. **Installation Progress**:
   - Observe progress bar
   - Note any errors or warnings
   - Installation should complete in < 2 minutes

5. **Completion Screen**:
   - Verify success message
   - Click **Finish**

#### Step 4: Verify Installation Success

**Check Files Installed**:
```powershell
# Open PowerShell as Administrator
Test-Path "C:\Program Files\TabezaConnect"
Test-Path "C:\Program Files\TabezaConnect\config.json"
Test-Path "C:\Program Files\TabezaConnect\logs\terms-acceptance.log"
```

**Check Configuration**:
```powershell
Get-Content "C:\Program Files\TabezaConnect\config.json"
```
Expected content:
```json
{
  "barId": "test_bar_12345",
  "version": "1.3.0",
  "installedAt": "2026-02-19T...",
  "apiUrl": "https://api.tabeza.co.ke"
}
```

**Check Terms Acceptance Log**:
```powershell
Get-Content "C:\Program Files\TabezaConnect\logs\terms-acceptance.log"
```
Expected format:
```
[2026-02-19 10:30:00] Bar ID: test_bar_12345 | Terms v1.0 | Installer v1.3.0 | Accepted
```

**Check Service Installation**:
```powershell
Get-Service -Name "TabezaConnectService"
```
Expected output:
- Status: Running
- DisplayName: Tabeza POS Connect Service
- StartType: Automatic

**Check Programs List**:
1. Open **Settings** → **Apps** → **Installed apps**
2. Search for "Tabeza"
3. Verify entry shows "Tabeza POS Connect" (with space)

**Check Start Menu**:
1. Open Start Menu
2. Search for "Tabeza"
3. Verify folder/shortcut shows "Tabeza POS Connect"

#### Step 5: Verify Service Functionality
```powershell
# Check service status
Get-Service -Name "TabezaConnectService" | Select-Object Status, StartType

# Check service is listening (if applicable)
netstat -ano | findstr "3000"  # Replace with actual port

# Check Windows Event Viewer for service logs
Get-EventLog -LogName Application -Source "TabezaConnectService" -Newest 10
```

### Expected Results
✅ UAC prompt appears and is accepted  
✅ Installation completes without errors  
✅ All files are created in correct locations  
✅ config.json contains correct Bar ID  
✅ Terms acceptance is logged  
✅ Service is installed and running  
✅ Branding shows "Tabeza POS Connect" in user-facing contexts  
✅ Technical files use "TabezaConnect" (no space)  

### Pass/Fail Criteria
- **PASS**: All expected results are met, no errors during installation
- **FAIL**: Any error occurs, service doesn't start, or files are missing

### Notes Section
```
Date Tested: _______________
Tester Name: _______________
OS Version: _______________
Result: PASS / FAIL
Issues Found: _______________
```

---

## Test Case 1.2: Install without Admin Rights → Clear Error Message

### Objective
Verify that the installer shows a clear, actionable error message when run without administrator privileges.

### Prerequisites
- Clean Windows 10/11 VM
- Logged in as **Standard User** account (not administrator)
- No previous TabezaConnect installation

### Test Steps

#### Step 1: Run Installer as Standard User
1. Download `TabezaConnect-Setup-v1.3.0.exe` to Downloads folder
2. **Double-click** the installer (do NOT right-click → Run as administrator)
3. Observe UAC prompt

**Expected Result**: UAC prompt appears asking for admin credentials

#### Step 2: Decline Admin Elevation
1. In UAC prompt, click **"No"** or **"Cancel"**
2. Observe error message

**Expected Error Message**:
```
Administrator privileges are required to install Tabeza POS Connect.

Please right-click the installer and select "Run as administrator".

If you do not have administrator rights, please contact your IT department.
```

#### Step 3: Verify No Partial Installation
```powershell
# Check that no files were created
Test-Path "C:\Program Files\TabezaConnect"  # Should return False

# Check that no service was installed
Get-Service -Name "TabezaConnectService" -ErrorAction SilentlyContinue  # Should return nothing
```

### Expected Results
✅ UAC prompt appears requesting admin credentials  
✅ Clear error message shown when declined  
✅ Error message provides actionable guidance  
✅ No partial installation occurs  
✅ No files created in Program Files  
✅ No service installed  

### Pass/Fail Criteria
- **PASS**: Clear error message shown, no partial installation
- **FAIL**: Cryptic error (e.g., "Error 5: Access is denied"), partial files created, or installer crashes

### Alternative Test: Run Without UAC Prompt
Some corporate environments may block UAC entirely. Test this scenario:

1. Disable UAC temporarily:
   ```powershell
   # Run as Administrator
   Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" -Name "EnableLUA" -Value 0
   Restart-Computer
   ```

2. Run installer as standard user
3. Verify clear error message appears
4. Re-enable UAC:
   ```powershell
   Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" -Name "EnableLUA" -Value 1
   Restart-Computer
   ```

### Notes Section
```
Date Tested: _______________
Tester Name: _______________
OS Version: _______________
User Account Type: _______________
Result: PASS / FAIL
Error Message Received: _______________
```

---

## Test Case 1.3: Install on Locked Directory → Retry Logic Works

### Objective
Verify that the installer's retry logic successfully handles temporary file locks caused by antivirus or other processes.

### Prerequisites
- Clean Windows 10/11 VM
- Administrator account
- Windows Defender enabled (or Avast installed)
- Process Monitor (Sysinternals) installed for debugging

### Test Steps

#### Step 1: Enable Real-Time Protection
```powershell
# Ensure Windows Defender is active
Get-MpComputerStatus | Select-Object RealTimeProtectionEnabled, AntivirusEnabled
```

If disabled, enable it:
```powershell
Set-MpPreference -DisableRealtimeMonitoring $false
```

#### Step 2: Monitor File Operations
1. Launch **Process Monitor** (procmon.exe) as Administrator
2. Set filter: `Process Name is TabezaConnect-Setup-v1.3.0.exe`
3. Set filter: `Operation is CreateFile or WriteFile`
4. Click **OK** to start monitoring

#### Step 3: Run Installer
1. Right-click installer → **Run as administrator**
2. Accept UAC prompt
3. Complete installation wizard (accept terms, enter Bar ID)
4. Observe Process Monitor for any `ACCESS DENIED` or `SHARING VIOLATION` events

**Expected Behavior**:
- Some temporary file locks may occur (normal with antivirus)
- Installer should retry operations automatically
- Installation should complete successfully despite temporary locks

#### Step 4: Simulate Locked Directory (Advanced)
To explicitly test retry logic:

1. Create a file lock script:
```powershell
# lock-temp-dir.ps1
$tempFile = "$env:TEMP\tabeza-test-lock.tmp"
$fileStream = [System.IO.File]::Open($tempFile, 'Create', 'ReadWrite', 'None')
Write-Host "File locked. Press Enter to release..."
Read-Host
$fileStream.Close()
```

2. Run lock script in separate PowerShell window:
```powershell
powershell -File lock-temp-dir.ps1
```

3. Start installer while lock is active
4. Observe installer behavior (should retry)
5. Release lock by pressing Enter in lock script window
6. Verify installation completes

#### Step 5: Check Installation Success
```powershell
# Verify service is running
Get-Service -Name "TabezaConnectService" | Select-Object Status

# Check for any error logs
Get-Content "C:\Program Files\TabezaConnect\logs\install.log" -Tail 20
```

#### Step 6: Review Process Monitor Logs
1. Stop Process Monitor capture
2. Filter for `Result is ACCESS DENIED or SHARING VIOLATION`
3. Count retry attempts
4. Verify eventual success

**Expected Pattern**:
```
CreateFile → ACCESS DENIED
[1 second delay]
CreateFile → ACCESS DENIED
[1 second delay]
CreateFile → SUCCESS
```

### Expected Results
✅ Installer handles temporary file locks gracefully  
✅ Retry logic attempts up to 3 times with 1-second delays  
✅ Installation completes successfully after retries  
✅ No "Access Denied" errors shown to user  
✅ Service starts correctly after installation  
✅ Process Monitor shows retry pattern  

### Pass/Fail Criteria
- **PASS**: Installation succeeds despite temporary locks, retry logic visible in logs
- **FAIL**: Installation fails with "Access Denied", no retry attempts, or crashes

### Antivirus-Specific Testing

#### Windows Defender
1. Ensure real-time protection is ON
2. Run installer
3. Check Windows Security → Protection history for any blocks
4. Verify installation succeeds

#### Avast Free Antivirus (Optional)
1. Install Avast Free Antivirus
2. Enable all shields (File, Behavior, Web)
3. Run installer
4. Observe any Avast warnings/blocks
5. If blocked, add exception and retry
6. Document warnings received

### Notes Section
```
Date Tested: _______________
Tester Name: _______________
OS Version: _______________
Antivirus: _______________
Retry Attempts Observed: _______________
Result: PASS / FAIL
Issues Found: _______________
```

---

## Additional Validation Tests

### Test Case 1.4: Service Survives Reboot

**Objective**: Verify service starts automatically after system restart

**Steps**:
1. Complete successful installation (TC1.1)
2. Restart computer
3. After reboot, check service status:
   ```powershell
   Get-Service -Name "TabezaConnectService"
   ```
4. Verify Status = Running, StartType = Automatic

**Expected**: Service automatically starts after reboot

---

### Test Case 1.5: Uninstall and Reinstall

**Objective**: Verify clean uninstall and successful reinstall

**Steps**:
1. Complete successful installation (TC1.1)
2. Uninstall via Settings → Apps → Tabeza POS Connect → Uninstall
3. Verify all files removed:
   ```powershell
   Test-Path "C:\Program Files\TabezaConnect"  # Should be False
   ```
4. Verify service removed:
   ```powershell
   Get-Service -Name "TabezaConnectService" -ErrorAction SilentlyContinue  # Should be empty
   ```
5. Reinstall using same installer
6. Verify successful installation

**Expected**: Clean uninstall, successful reinstall with no conflicts

---

### Test Case 1.6: Upgrade from v1.2.0 to v1.3.0

**Objective**: Verify upgrade path preserves configuration

**Steps**:
1. Install v1.2.0 (if available)
2. Configure with Bar ID
3. Run v1.3.0 installer
4. Verify upgrade completes
5. Check config.json still contains original Bar ID
6. Verify service still running

**Expected**: Upgrade preserves configuration, service continues running

---

## Debugging Guide

### Common Issues and Solutions

#### Issue: "Error 5: Access is denied"
**Diagnosis**:
```powershell
# Check if running as admin
([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
```

**Solution**: Right-click installer → Run as administrator

---

#### Issue: Service fails to start
**Diagnosis**:
```powershell
# Check service status
Get-Service -Name "TabezaConnectService" | Format-List *

# Check Event Viewer
Get-EventLog -LogName Application -Source "TabezaConnectService" -Newest 5
```

**Solution**: Check logs for specific error, verify Node.js is installed

---

#### Issue: Antivirus blocks installation
**Diagnosis**:
- Check Windows Security → Protection history
- Check antivirus quarantine

**Solution**: 
1. Temporarily disable real-time protection
2. Run installer
3. Re-enable protection
4. Add exception for `C:\Program Files\TabezaConnect`

---

#### Issue: Temp directory locked
**Diagnosis**:
```powershell
# Check temp directory permissions
Get-Acl $env:TEMP | Format-List

# Check for locked files
handle.exe $env:TEMP  # Sysinternals Handle tool
```

**Solution**: Retry logic should handle automatically, or manually clear temp directory

---

## Test Execution Checklist

### Pre-Testing
- [ ] VMs prepared (Windows 10 and 11)
- [ ] User accounts created (Admin, Standard, Restricted)
- [ ] Installer downloaded and verified
- [ ] Process Monitor installed
- [ ] Valid Bar ID obtained
- [ ] Backup of v1.2.0 installer (if testing upgrade)

### Test Execution
- [ ] TC1.1: Install with admin rights (Windows 10)
- [ ] TC1.1: Install with admin rights (Windows 11)
- [ ] TC1.2: Install without admin rights (Windows 10)
- [ ] TC1.2: Install without admin rights (Windows 11)
- [ ] TC1.3: Install with locked directory (Windows 10)
- [ ] TC1.3: Install with locked directory (Windows 11)
- [ ] TC1.4: Service survives reboot
- [ ] TC1.5: Uninstall and reinstall
- [ ] TC1.6: Upgrade from v1.2.0 (if applicable)

### Antivirus Testing
- [ ] Windows Defender (default)
- [ ] Avast Free Antivirus (optional)

### Post-Testing
- [ ] All test results documented
- [ ] Issues logged in GitHub
- [ ] Screenshots captured for failures
- [ ] Process Monitor logs saved
- [ ] Test report compiled

---

## Test Report Template

```markdown
# TabezaConnect v1.3.0 Installer Test Report

**Date**: _______________
**Tester**: _______________
**Environment**: Windows 10/11 Pro

## Summary
- Total Tests: 9
- Passed: ___
- Failed: ___
- Blocked: ___

## Test Results

| Test Case | Description | Result | Notes |
|-----------|-------------|--------|-------|
| TC1.1 | Install with admin (Win10) | PASS/FAIL | |
| TC1.1 | Install with admin (Win11) | PASS/FAIL | |
| TC1.2 | Install without admin (Win10) | PASS/FAIL | |
| TC1.2 | Install without admin (Win11) | PASS/FAIL | |
| TC1.3 | Locked directory (Win10) | PASS/FAIL | |
| TC1.3 | Locked directory (Win11) | PASS/FAIL | |
| TC1.4 | Service survives reboot | PASS/FAIL | |
| TC1.5 | Uninstall and reinstall | PASS/FAIL | |
| TC1.6 | Upgrade from v1.2.0 | PASS/FAIL | |

## Issues Found
1. [Issue description]
   - Severity: Critical/High/Medium/Low
   - Steps to reproduce: ...
   - Expected: ...
   - Actual: ...

## Recommendations
- [Recommendation 1]
- [Recommendation 2]

## Sign-off
- [ ] All critical issues resolved
- [ ] Ready for release
- [ ] Requires additional testing

**Tester Signature**: _______________
**Date**: _______________
```

---

## Requirements Validation Matrix

| Requirement | Test Case | Status |
|-------------|-----------|--------|
| 1.1: Installer must properly request and verify admin privileges | TC1.1, TC1.2 | ✅ |
| 1.2: Temp directory permissions must be handled correctly | TC1.3 | ✅ |
| Service must start automatically | TC1.1, TC1.4 | ✅ |
| Branding shows "Tabeza POS Connect" | TC1.1 | ✅ |
| Terms acceptance required | TC1.1 | ✅ |
| Bar ID validation works | TC1.1 | ✅ |

---

## Appendix: PowerShell Testing Scripts

### Complete Installation Verification Script
```powershell
# verify-installation.ps1
Write-Host "=== TabezaConnect Installation Verification ===" -ForegroundColor Cyan

# Check files
Write-Host "`nChecking files..." -ForegroundColor Yellow
$files = @(
    "C:\Program Files\TabezaConnect\config.json",
    "C:\Program Files\TabezaConnect\logs\terms-acceptance.log"
)
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "✓ $file exists" -ForegroundColor Green
    } else {
        Write-Host "✗ $file missing" -ForegroundColor Red
    }
}

# Check service
Write-Host "`nChecking service..." -ForegroundColor Yellow
$service = Get-Service -Name "TabezaConnectService" -ErrorAction SilentlyContinue
if ($service) {
    Write-Host "✓ Service exists" -ForegroundColor Green
    Write-Host "  Status: $($service.Status)" -ForegroundColor Cyan
    Write-Host "  StartType: $($service.StartType)" -ForegroundColor Cyan
    Write-Host "  DisplayName: $($service.DisplayName)" -ForegroundColor Cyan
} else {
    Write-Host "✗ Service not found" -ForegroundColor Red
}

# Check Programs list
Write-Host "`nChecking Programs list..." -ForegroundColor Yellow
$app = Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" | 
       Where-Object { $_.DisplayName -like "*Tabeza*" }
if ($app) {
    Write-Host "✓ Found in Programs: $($app.DisplayName)" -ForegroundColor Green
} else {
    Write-Host "✗ Not found in Programs list" -ForegroundColor Red
}

Write-Host "`n=== Verification Complete ===" -ForegroundColor Cyan
```

### Service Monitoring Script
```powershell
# monitor-service.ps1
Write-Host "Monitoring TabezaConnect Service (Ctrl+C to stop)..." -ForegroundColor Cyan

while ($true) {
    $service = Get-Service -Name "TabezaConnectService" -ErrorAction SilentlyContinue
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    if ($service) {
        $status = $service.Status
        $color = if ($status -eq "Running") { "Green" } else { "Red" }
        Write-Host "[$timestamp] Status: $status" -ForegroundColor $color
    } else {
        Write-Host "[$timestamp] Service not found" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 5
}
```

---

## Contact and Support

**For testing questions or issues**:
- Email: support@tabeza.co.ke
- GitHub Issues: https://github.com/billoapp/TabezaConnect/issues

**For installer development**:
- Review Inno Setup script: `installer/setup.iss`
- Check build logs: `installer/build.log`
- Consult design document: `.kiro/specs/tabezaconnect-installer-fixes/design.md`
