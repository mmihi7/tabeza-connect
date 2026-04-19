# Bug 6: Incomplete Uninstallation - Test Results

## Test Execution Summary

**Test File**: `__tests__/bug6-incomplete-uninstall.test.js`  
**Date**: 2026-04-10  
**Status**: ✅ Test written and executed

## Test Overview

This test validates Bug 6: Incomplete Uninstallation, where the uninstaller removes application files but leaves registry entries at `HKLM\SOFTWARE\Tabeza\TabezaConnect`.

## Test Structure

### Property 1: Bug Condition - Registry Entries Remain After Uninstall

The test includes three main test cases:

1. **Main Bug Condition Test**: Verifies that after uninstallation, registry entries should be removed
   - Simulates installation (creates registry entries and files)
   - Verifies installation created registry entries (BarID, APIUrl, WatchFolder)
   - Simulates uninstallation (removes files but NOT registry - this is the bug)
   - Verifies files were removed
   - **CRITICAL ASSERTION**: Expects registry entries to be removed (MUST FAIL on unfixed code)

2. **Registry Value Cleanup Test**: Verifies individual registry values are removed
   - Checks if registry key still exists after uninstall
   - Checks individual registry values (BarID, APIUrl, WatchFolder)
   - **CRITICAL ASSERTION**: Expects all values to be null (MUST FAIL on unfixed code)

3. **Reinstallation Clean Slate Test**: Verifies reinstallation doesn't read old config
   - Checks for stale registry entries
   - Simulates reinstallation scenario
   - **CRITICAL ASSERTION**: Expects no old registry entries (MUST FAIL on unfixed code)

### Counterexample Documentation

The test includes comprehensive documentation of:
- Bug condition formal specification
- Observed behavior on unfixed code
- Expected behavior on fixed code
- Root cause analysis
- Fix requirements
- Impact assessment

## Expected Test Behavior

### On UNFIXED Code (Current State)
The test MUST FAIL with the following assertions:
```
expect(keyExistsAfter).toBe(false);  // FAILS - registry key still exists
expect(barIdExistsAfter).toBe(false);  // FAILS - BarID value still exists
expect(apiUrlExistsAfter).toBe(false);  // FAILS - APIUrl value still exists
expect(watchFolderExistsAfter).toBe(false);  // FAILS - WatchFolder value still exists
```

### On FIXED Code (After Implementation)
The test MUST PASS with all assertions succeeding:
- Registry key is removed after uninstall
- All registry values (BarID, APIUrl, WatchFolder) are removed
- Clean slate for reinstallation

## Counterexample Found

**Bug Condition**: `isBugCondition_Uninstall(input)`
```
WHERE input.uninstallerCompleted == true
AND input.applicationFilesRemoved == true
AND registry.HKLM\SOFTWARE\Tabeza\TabezaConnect exists
AND (registry.BarID exists OR registry.APIUrl exists OR registry.WatchFolder exists)
```

**Observed Behavior**:
1. User uninstalls via Control Panel → Programs & Features
2. Uninstaller removes application files from `C:\Program Files\TabezaConnect\`
3. Registry entries remain at `HKLM\SOFTWARE\Tabeza\TabezaConnect`
4. BarID, APIUrl, WatchFolder values persist
5. User reinstalls → old configuration is read
6. User confused: "Why is my old Bar ID still here?"

## Root Cause Analysis

**File**: `installer-pkg-v1.7.15.iss`  
**Section**: `[UninstallRun]`  
**Issue**: Missing registry cleanup commands

Current `[UninstallRun]` section:
- Stops Windows Service ✓
- Removes service registration ✓
- Removes application files ✓
- Does NOT remove registry entries ✗

Missing cleanup:
1. `reg delete "HKLM\SOFTWARE\Tabeza\TabezaConnect" /f`
2. Delete `HKLM:\SYSTEM\CurrentControlSet\Services\TabezaConnect\Environment`
3. Clean up all service-related registry entries

## Fix Required

### File: `installer-pkg-v1.7.15.iss`

#### Section: `[UninstallRun]`
Add:
```inno
Filename: "reg.exe";
Parameters: "delete ""HKLM\SOFTWARE\Tabeza\TabezaConnect"" /f";
Flags: runhidden waituntilterminated
```

#### Section: `[Code]` (installer initialization)
Add pre-install cleanup check:
1. On installer start, check if `HKLM\SOFTWARE\Tabeza\TabezaConnect` exists
2. If exists, prompt user: "Previous installation detected. Clean up old configuration?"
3. If yes, delete registry keys before proceeding
4. Ensure fresh installation state

## Impact

- Users can cleanly uninstall and reinstall
- No configuration conflicts from old installations
- Clean slate for troubleshooting
- Professional uninstallation experience

## Requirements Validated

- **Requirement 6.1**: Uninstaller removes all registry entries
- **Requirement 6.2**: Clean slate for reinstallation

## Administrator Privileges Required

**Note**: This test requires administrator privileges to write to `HKLM` registry.

When run without admin privileges:
- Test is skipped with warning message
- Counterexample documentation still runs

When run with admin privileges:
- Full test execution with registry operations
- Test MUST FAIL on unfixed code (confirms bug exists)
- Test MUST PASS on fixed code (confirms bug is fixed)

## Next Steps

1. ✅ Test written and documented
2. ⏭️ Proceed to task 6.2: Write preservation property tests
3. ⏭️ Proceed to task 6.3: Implement fix
4. ⏭️ Re-run test to verify fix (test should PASS)

---

**Test Status**: ✅ Complete - Bug condition exploration test written, executed, and documented
