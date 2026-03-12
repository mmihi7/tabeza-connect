# Bug Condition Exploration Test

## Test File
`template-generator-printer-status-fix.test.js`

## Purpose
This test is designed to **FAIL on unfixed code** to confirm that the bugs exist. It is a bug condition exploration test that surfaces counterexamples demonstrating the three interconnected bugs in the template generator and printer status system.

## How to Run

```bash
# From the tabeza-connect directory
npm test

# Or run specific test file
npx jest __tests__/template-generator-printer-status-fix.test.js --verbose

# Or using node directly
node node_modules/jest/bin/jest.js __tests__/template-generator-printer-status-fix.test.js --verbose
```

## Expected Outcome (BEFORE Fix)

**ALL TESTS SHOULD FAIL** - This confirms the bugs exist.

### Bug 1: Printer Status Inconsistency
- **Test**: `EXPECTED TO FAIL: Printer status should be consistent - check actual printer existence`
- **Expected Failure**: Test will fail because:
  - IPC handler references non-existent `printer-pooling-setup.ps1` script
  - Handler checks for printer pooling instead of actual printer existence
  - Returns "Not configured" even though "Tabeza POS Printer" exists in Windows

### Bug 2: Template Generator UI Flow
- **Test**: `EXPECTED TO FAIL: Template generator should show guided 3-step workflow`
- **Expected Failure**: Test will fail because:
  - UI shows static "Generate Template" button
  - Missing guided workflow text: "Step 1/3: Print your first test receipt"
  - No real-time receipt detection feedback

### Bug 3: Receipt Detection Not Working
- **Test**: `EXPECTED TO FAIL: Template generator should detect receipts in queue folder`
- **Expected Failure**: Test will fail because:
  - UI polls `C:\TabezaPrints\processed` folder
  - Should poll `C:\TabezaPrints\queue\pending` folder
  - Receipts exist in queue but UI shows "0 / 3"

## Counterexamples Documented

The test will document these counterexamples:

1. **IPC Handler Bug**: 
   - Script path: `src/installer/printer-pooling-setup.ps1` (doesn't exist)
   - Handler checks for pooling configuration
   - Should check: `Get-Printer -Name 'Tabeza POS Printer'`

2. **UI Workflow Bug**:
   - Current: Static "Generate Template" button
   - Expected: Guided 3-step workflow with real-time feedback

3. **Receipt Detection Bug**:
   - Current: Polls `C:\TabezaPrints\processed`
   - Expected: Polls `C:\TabezaPrints\queue\pending`

4. **PowerShell Script Bug**:
   - References non-existent `printer-pooling-setup.ps1`
   - Should use direct PowerShell command: `Get-Printer`

## Expected Outcome (AFTER Fix)

**ALL TESTS SHOULD PASS** - This confirms the bugs are fixed.

When the fix is implemented:
- IPC handler will check actual printer existence using `Get-Printer` cmdlet
- Template generator UI will show guided 3-step workflow
- UI will poll `queue/pending` folder and detect receipts in real-time

## Test Structure

The test follows the bugfix workflow methodology:

1. **Bug Condition Exploration** (Task 1)
   - Surface counterexamples on unfixed code
   - Document expected vs actual behavior
   - Confirm bugs exist (tests fail)

2. **Fix Implementation** (Task 3)
   - Implement fixes based on documented bugs
   - Re-run same tests

3. **Fix Validation** (Task 3.5)
   - Tests should now pass
   - Confirms expected behavior is satisfied

## Requirements Validated

This test validates requirements from `bugfix.md`:
- 1.1: Template generator shows "Not configured" even though printer exists
- 1.2: UI shows static button instead of guided workflow
- 1.3: Dashboard and template generator show different printer status
- 1.4: Receipts in queue folder not detected by UI
- 1.5: IPC handler checks for pooling but printer uses Redmon

## Notes

- This is a **property-based test** using concrete failing cases
- The test encodes **expected behavior** as assertions
- **DO NOT modify the test** when it fails - the failures are expected
- The test will validate the fix when it passes after implementation
- Test creates temporary receipt files in `queue/pending` for Bug 3 testing
- Test cleans up temporary files after execution
