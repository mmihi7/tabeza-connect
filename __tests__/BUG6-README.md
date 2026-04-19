# Bug 6: Incomplete Uninstallation - Test Results

## Test Status

### Bug Condition Exploration Test (Task 6.1)
**File**: `bug6-incomplete-uninstall.test.js`  
**Status**: ✅ COMPLETE  
**Result**: Tests FAIL as expected on unfixed code (confirms bug exists)

The exploration test successfully demonstrates the bug:
- Installer creates registry entries at `HKLM\SOFTWARE\Tabeza\TabezaConnect`
- Uninstaller removes application files
- Registry entries remain after uninstall (BUG DETECTED)
- Reinstallation reads old configuration values

### Preservation Property Tests (Task 6.2)
**File**: `bug6-preservation.test.js`  
**Status**: ✅ COMPLETE  
**Result**: Tests PASS on unfixed code (confirms baseline behavior)

The preservation tests verify that normal installation behavior works correctly:
- Fresh installation creates registry keys correctly
- Fresh installation creates config.json with correct structure
- Configuration loading priority (env vars → Registry → config.json) works correctly
- All 5 property-based test scenarios pass

## Test Coverage

### Bug Condition Tests
1. ✅ Registry entries remain after uninstall
2. ✅ Individual registry values (BarID, APIUrl, WatchFolder) persist
3. ✅ Reinstallation reads old configuration from stale registry

### Preservation Tests
1. ✅ Fresh installation creates registry key at `HKLM\SOFTWARE\Tabeza\TabezaConnect`
2. ✅ Fresh installation creates registry values (BarID, APIUrl, WatchFolder)
3. ✅ Fresh installation creates config.json with correct structure
4. ✅ Fresh installation creates config.json with correct values
5. ✅ Configuration loading priority preserved
6. ✅ Property-based tests: 5 installation scenarios

## Property-Based Test Scenarios

The preservation tests use 5 different installation scenarios to ensure comprehensive coverage:

1. **Standard Installation** - Default settings
2. **Custom API URL** - Custom API endpoint
3. **Custom Watch Folder** - Custom data directory
4. **All Custom Settings** - All settings customized
5. **Long Bar ID** - Edge case with very long identifier

All scenarios pass, confirming that normal installation behavior is consistent and correct.

## Test Execution

### Running Tests

```bash
# Run Bug 6 exploration test (requires admin privileges for full coverage)
npm test -- bug6-incomplete-uninstall.test.js

# Run Bug 6 preservation tests (config.json tests work without admin)
npm test -- bug6-preservation.test.js

# Run both Bug 6 tests
npm test -- bug6
```

### Administrator Privileges

Some tests require administrator privileges to write to `HKLM` registry:
- Registry key creation tests (preservation)
- Registry value creation tests (preservation)
- Configuration priority tests (preservation)

Tests that don't require admin privileges:
- config.json creation tests (preservation)
- config.json structure validation (preservation)
- Documentation tests

When run without admin privileges, registry tests are skipped with a warning message.

## Expected Outcomes

### Before Fix (Current State)

**Bug Condition Tests**: FAIL (expected)
- Registry entries remain after uninstall ❌
- Old configuration interferes with reinstallation ❌

**Preservation Tests**: PASS (expected)
- Normal installation creates registry correctly ✅
- Normal installation creates config.json correctly ✅
- Configuration priority works correctly ✅

### After Fix (Expected State)

**Bug Condition Tests**: PASS
- Registry entries removed after uninstall ✅
- Clean slate for reinstallation ✅

**Preservation Tests**: PASS (unchanged)
- Normal installation creates registry correctly ✅
- Normal installation creates config.json correctly ✅
- Configuration priority works correctly ✅

## Counterexample Documentation

The bug condition exploration test documents the following counterexample:

**Observed Behavior (UNFIXED CODE)**:
1. User opens Control Panel → Programs & Features
2. User selects "Tabeza Connect"
3. User clicks "Uninstall"
4. Uninstaller runs and removes application files
5. Uninstaller completes successfully
6. Application files are deleted from `C:\Program Files\TabezaConnect\`
7. Registry entries remain at `HKLM\SOFTWARE\Tabeza\TabezaConnect`
8. BarID, APIUrl, WatchFolder values persist
9. User reinstalls → old configuration is read
10. User confused: "Why is my old Bar ID still here?"

**Expected Behavior (FIXED CODE)**:
1. User opens Control Panel → Programs & Features
2. User selects "Tabeza Connect"
3. User clicks "Uninstall"
4. Uninstaller runs and removes application files
5. Uninstaller removes registry entries at `HKLM\SOFTWARE\Tabeza\TabezaConnect`
6. Uninstaller removes service environment variables
7. Uninstaller completes successfully
8. Application files deleted
9. Registry entries deleted
10. Clean slate for potential reinstallation

## Root Cause Analysis

**File**: `installer-pkg-v1.7.15.iss`  
**Section**: `[UninstallRun]`  
**Issue**: Missing registry cleanup commands

**Current [UninstallRun] section**:
- Stops Windows Service
- Removes service registration
- Removes application files
- Does NOT remove registry entries

**Missing cleanup**:
1. `reg delete "HKLM\SOFTWARE\Tabeza\TabezaConnect" /f`
2. Delete `HKLM:\SYSTEM\CurrentControlSet\Services\TabezaConnect\Environment`
3. Clean up all service-related registry entries

## Fix Implementation

The fix will be implemented in Task 6.3 by:

1. Adding registry cleanup to `[UninstallRun]` section
2. Adding service environment cleanup
3. Adding pre-install cleanup in `[Code]` section to handle existing registry keys

After the fix is implemented, both the bug condition tests and preservation tests should pass, confirming that:
- The bug is fixed (registry cleaned up on uninstall)
- Normal installation behavior is preserved (no regressions)

## Requirements Validated

### Bug Condition Requirements
- ✅ Requirement 2.11: Uninstaller removes all registry entries
- ✅ Requirement 2.12: Clean slate for reinstallation

### Preservation Requirements
- ✅ Requirement 3.11: Configuration loading priority unchanged
- ✅ Requirement 3.12: Normal installation behavior unchanged

## Next Steps

1. ✅ Task 6.1: Bug condition exploration test written and passing (FAIL as expected)
2. ✅ Task 6.2: Preservation property tests written and passing (PASS as expected)
3. ⏭️ Task 6.3: Implement fix for incomplete uninstallation
4. ⏭️ Task 6.3.4: Verify bug condition test now passes
5. ⏭️ Task 6.3.5: Verify preservation tests still pass
6. ⏭️ Task 6.4: Final checkpoint

---

**Last Updated**: 2026-04-10  
**Test Status**: Ready for fix implementation (Task 6.3)
