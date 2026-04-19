# Bug 1: Bar ID Persistence Failure - Test Documentation

## Test File
`bug1-barid-persistence.test.js`

## Purpose
This test is designed to **FAIL on unfixed code** to confirm that Bug 1 exists. It is a bug condition exploration test that surfaces counterexamples demonstrating the Bar ID persistence failure.

## Bug Description

**Bug Condition**: User enters valid Bar ID in installer, completes installation, but config.json.barId remains empty.

**Expected Behavior**: When installer writes Bar ID to registry (HKLM\SOFTWARE\Tabeza\TabezaConnect\BarID), the service startup should read it and persist to config.json.

## How to Run

### Standard Run (Non-Administrator)
```bash
# From the tabeza-connect directory
npm test -- __tests__/bug1-barid-persistence.test.js
```

**Note**: Registry tests will be skipped if not running as administrator. The counterexample documentation will still be displayed.

### Full Test Run (Administrator Required)
```powershell
# Open PowerShell as Administrator
cd C:\Projects\tabeza-connect

# Run the test
npm test -- __tests__/bug1-barid-persistence.test.js --verbose
```

## Expected Outcome

### BEFORE Fix (Unfixed Code)

**Registry tests will FAIL** with the following behavior:

1. ✗ Test writes Bar ID "bar-123-test" to registry: HKLM\SOFTWARE\Tabeza\TabezaConnect\BarID
2. ✓ Registry write confirmed
3. ✓ config.json created with empty barId ("")
4. ✗ Service startup does NOT migrate registry value to config.json
5. ✗ config.json.barId remains empty
6. ✗ Tray shows "✗ Bar ID not configured"

**Test Assertion Failure**:
```
Expected: "bar-123-test"
Received: ""
```

This failure confirms the bug exists.

### AFTER Fix (Fixed Code)

**All tests should PASS** with the following behavior:

1. ✓ Test writes Bar ID "bar-123-test" to registry
2. ✓ Registry write confirmed
3. ✓ config.json created with empty barId
4. ✓ Service startup detects empty barId
5. ✓ Service reads registry value
6. ✓ Service migrates registry value to config.json
7. ✓ config.json.barId = "bar-123-test"
8. ✓ Tray shows "✓ Bar ID configured"

## Counterexamples Documented

The test documents these counterexamples:

### Observed Behavior (UNFIXED CODE)
1. Installer prompts user for Bar ID
2. User enters: "bar-123-test"
3. Installer writes to registry: HKLM\SOFTWARE\Tabeza\TabezaConnect\BarID
4. Installer completes successfully
5. Service starts and reads config.json
6. config.json.barId is empty ("")
7. Service does NOT check registry for Bar ID
8. Tray shows "✗ Bar ID not configured"

### Expected Behavior (FIXED CODE)
1. Installer prompts user for Bar ID
2. User enters: "bar-123-test"
3. Installer writes to registry: HKLM\SOFTWARE\Tabeza\TabezaConnect\BarID
4. Installer completes successfully
5. Service starts and reads config.json
6. Service detects config.json.barId is empty
7. Service checks registry for Bar ID
8. Service finds registry value and migrates to config.json
9. config.json.barId = "bar-123-test"
10. Tray shows "✓ Bar ID configured"

## Root Cause Analysis

- **Missing migration logic** in electron-main.js
- **Service startup does not check registry fallback**
- **No code to copy registry value to config.json**
- **Installer writes to registry but not to config.json**

## Fix Required

**File**: `electron-main.js`

**Function**: `app.whenReady()` initialization sequence

**Add**: Registry-to-config migration logic

**Implementation Steps**:
1. After folder initialization
2. Check if config.json.barId is empty
3. If empty, read HKLM\SOFTWARE\Tabeza\TabezaConnect\BarID
4. If registry value exists, write to config.json.barId
5. Log migration action for debugging

## Test Structure

The test follows the bugfix workflow methodology:

1. **Bug Condition Exploration** (Task 1.1)
   - Surface counterexamples on unfixed code
   - Document expected vs actual behavior
   - Confirm bug exists (tests fail)

2. **Fix Implementation** (Task 1.3)
   - Implement fixes based on documented bugs
   - Re-run same tests

3. **Fix Validation** (Task 1.3.5)
   - Tests should now pass
   - Confirms expected behavior is satisfied

## Requirements Validated

This test validates requirements from `bugfix.md`:
- **1.1**: Bar ID entered in installer but not persisted to config.json
- **1.2**: Tray app does not read Bar ID from installer's environment variables or registry settings

## Notes

- This is a **property-based test** using concrete failing cases
- The test encodes **expected behavior** as assertions
- **DO NOT modify the test** when it fails - the failures are expected
- The test will validate the fix when it passes after implementation
- Test requires **administrator privileges** to write to HKLM registry
- Test creates temporary test data in `test-data/` directory
- Test cleans up registry keys and test files after execution

## Related Files

- **Spec**: `.kiro/specs/tabeza-connect-critical-fixes/bugfix.md`
- **Design**: `.kiro/specs/tabeza-connect-critical-fixes/design.md`
- **Tasks**: `.kiro/specs/tabeza-connect-critical-fixes/tasks.md`
- **Implementation**: `electron-main.js` (to be fixed)
- **Installer**: `installer-pkg-v1.7.15.iss`
- **Service Registration**: `files/register-service-pkg.ps1`
