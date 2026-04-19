# Bug 5: RedMon Registry Check Failure - Test Documentation

## Overview

This test validates Bug 5 from the Tabeza Connect Critical Fixes specification. The bug occurs when RedMon (a mandatory dependency for receipt capture) is not installed, but the app continues running without blocking startup or providing user guidance.

## Test Files

- `bug5-redmon-check-failure.test.js` - Bug condition exploration test (MUST FAIL on unfixed code)
- `bug5-preservation.test.js` - Preservation test (MUST PASS on both unfixed and fixed code)

## Bug Condition

**Formal Specification:**
```
FUNCTION isBugCondition_RedMonCheck(input)
  INPUT: input of type StartupEvent
  OUTPUT: boolean
  
  RETURN input.redmonInstalled == false
         AND input.appStartupBlocked == false
         AND input.userGuidance == null
         AND input.receiptCaptureAttempted == true
END FUNCTION
```

**In Plain English:**
When RedMon is not installed (a mandatory requirement for printer pooling capture), the system continues in a broken state instead of blocking startup or guiding the user to install RedMon.

## Expected Behavior

When RedMon is not installed, the system SHALL:

1. Display a clear user-facing message: "RedMon port monitor is required but not installed. Please run the installer to configure RedMon."
2. EITHER:
   - **Option A (Block Startup):** Block service startup until RedMon is installed
   - **Option B (Degraded Mode):** Enter a safe degraded mode that prevents receipt capture attempts

## Test Execution

### On a System WITH RedMon Installed

```bash
npm test -- bug5-redmon-check-failure.test.js
```

**Expected Result:** Tests will be SKIPPED because RedMon is present. The test output will show:
```
⚠️  Skipping test - RedMon is installed on this system
Cannot test bug condition when RedMon is present
```

This is correct behavior - we cannot test the bug condition when the dependency is present.

### On a System WITHOUT RedMon Installed

```bash
npm test -- bug5-redmon-check-failure.test.js
```

**Expected Result on UNFIXED code:** Tests will FAIL with assertions showing:
- `userGuidanceShown: false` (expected: true)
- `startupBlocked: false` (expected: true OR degradedMode: true)
- `receiptCaptureEnabled: true` (expected: false)
- `serviceStatus: 'online'` (expected: 'blocked' or 'degraded')

**Expected Result on FIXED code:** Tests will PASS, confirming:
- User-facing error dialog is shown
- Startup is blocked OR degraded mode is enabled
- Receipt capture is disabled when RedMon is missing

## How to Test Without RedMon

If you need to test the bug condition on a system where RedMon is installed:

### Option 1: Temporarily Rename Registry Key

```powershell
# Backup the registry key
reg export "HKLM\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port" redmon-backup.reg

# Rename the key to simulate RedMon absence
reg copy "HKLM\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port" "HKLM\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port.backup" /s
reg delete "HKLM\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port" /f

# Run tests
npm test -- bug5-redmon-check-failure.test.js

# Restore the registry key
reg import redmon-backup.reg
```

### Option 2: Use a Clean VM

1. Create a Windows 10/11 VM
2. Install Node.js and dependencies
3. Do NOT install RedMon
4. Run the test suite

## Counterexample Documentation

### Observed Behavior (UNFIXED CODE)

1. App starts and calls `verifyRedMonRegistryAsync()`
2. Registry check fails (RedMon not installed)
3. Warning logged to electron.log: "RedMon registry check failed"
4. App continues with normal startup
5. No user-facing error dialog shown
6. Service status set to "online"
7. Receipt capture remains enabled
8. Tray icon shows green (online)
9. User attempts to capture receipt
10. Receipt capture fails silently (RedMon port missing)
11. User has no idea why receipts are not working

### Expected Behavior (FIXED CODE - Option 1: Block Startup)

1. App starts and calls `verifyRedMonRegistryAsync()`
2. Registry check fails (RedMon not installed)
3. Error logged: "RedMon not installed - mandatory dependency missing"
4. Electron dialog shown: "RedMon port monitor is required but not installed. Please run the installer to configure RedMon."
5. Startup blocked - service does not start
6. Service status set to "blocked"
7. Tray icon shows grey (offline/blocked)
8. User understands they need to install RedMon

### Expected Behavior (FIXED CODE - Option 2: Degraded Mode)

1. App starts and calls `verifyRedMonRegistryAsync()`
2. Registry check fails (RedMon not installed)
3. Warning logged: "RedMon not installed - entering degraded mode"
4. Electron dialog shown: "RedMon port monitor is not installed. Receipt capture is disabled. Configuration and template generation are still available."
5. Service starts in degraded mode
6. Service status set to "degraded"
7. Receipt capture functionality disabled
8. Management UI shows warning: "Receipt capture unavailable - RedMon not installed"
9. Configuration and template generation still work

## Root Cause Analysis

- `verifyRedMonRegistryAsync()` catches registry check failure
- Only logs warning to electron.log (not user-facing)
- No user-facing error dialog shown
- No startup blocking logic
- No degraded mode implementation
- App continues as if RedMon is optional (it is mandatory)
- Receipt capture fails silently when attempted

## Fix Implementation

**File:** `electron-main.js`  
**Function:** `app.whenReady()` initialization

**Changes Required:**

1. After `verifyRedMonRegistryAsync()` completes
2. Check if `redmonCheckFailed` flag is true
3. If true, RedMon is not installed
4. Show Electron dialog with clear error message
5. EITHER:
   - a) Block startup: `app.quit()` or prevent service start
   - b) Enter degraded mode: disable receipt capture, show warning in UI
6. Log action for debugging

**Implementation Notes:**

- Use `electron.dialog.showErrorBox()` for blocking error
- Or use `electron.dialog.showMessageBox()` for non-blocking warning
- Set global flag: `redmonDegradedMode = true`
- Check flag before enabling receipt capture
- Show warning in management UI when in degraded mode
- Provide link to installer or instructions

## Requirements Validated

- **5.1:** When RedMon is not installed, system displays clear user-facing message
- **5.2:** System either blocks startup or enters degraded mode

## Related Tests

- `bug4-epipe-errors.test.js` - Tests EPIPE error handling when RedMon check fails
- `bug4-epipe-preservation.test.js` - Tests that successful RedMon checks remain unchanged

## Test Status

- ✅ Test written and documented
- ⏳ Awaiting execution on system without RedMon to document failure
- ⏳ Awaiting fix implementation
- ⏳ Awaiting verification that test passes after fix

## Notes

This test is designed to fail on unfixed code when RedMon is not installed. The failure is intentional and confirms the bug exists. Once the fix is implemented, the test should pass, validating that the expected behavior is satisfied.
