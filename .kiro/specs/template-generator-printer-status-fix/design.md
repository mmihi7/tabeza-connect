# Template Generator & Printer Status Fix - Bugfix Design

## Overview

This bugfix addresses three interconnected issues in the Tabeza Connect application that prevent users from successfully generating receipt parsing templates:

1. **Printer Status Inconsistency**: The IPC handler `check-printer-setup` checks for printer pooling configuration but the actual printer uses Redmon, causing incorrect status detection
2. **Template Generator UI Flow**: The template generator displays a static "Generate Template" button instead of the guided 3-step real-time workflow
3. **Receipt Detection Not Working**: The template generator UI doesn't poll the queue folder to detect captured receipts

The fix ensures consistent printer status reporting across all UI components, implements the real-time guided workflow, and enables automatic receipt detection.

## Glossary

- **Bug_Condition (C)**: The conditions that trigger the bugs - when template generator checks printer status, when UI should show guided workflow, when receipts are captured but not detected
- **Property (P)**: The desired behavior - consistent printer status across all UI components, real-time guided 3-step workflow, automatic receipt detection
- **Preservation**: Existing dashboard functionality, receipt capture service, configuration management that must remain unchanged
- **IPC Handler**: Inter-Process Communication handler in Electron that allows renderer processes to communicate with the main process
- **Redmon**: Virtual printer port redirector that captures print jobs to files
- **Printer Pooling**: Windows feature that sends print jobs to multiple ports simultaneously (not used in current implementation)
- **Queue Folder**: `C:\TabezaPrints\queue\pending\` where captured receipts are stored as JSON files before upload
- **Template Generator**: UI component that guides users through printing 3 test receipts to generate a parsing template

## Bug Details

### Fault Condition 1: Printer Status Inconsistency

The bug manifests when the template generator page requests printer status via the IPC handler `check-printer-setup`. The handler executes a PowerShell script `printer-pooling-setup.ps1` that checks for printer pooling configuration, but the actual "Tabeza Agent" uses Redmon (not pooling). This causes the handler to return "Not configured" even though the printer exists and is working correctly.

**Formal Specification:**
```
FUNCTION isBugCondition1(input)
  INPUT: input of type IPCRequest
  OUTPUT: boolean
  
  RETURN input.handler = "check-printer-setup" AND
         input.caller = "template-generator" AND
         printerExists("Tabeza Agent") AND
         printerUsesRedmon("Tabeza Agent") AND
         handlerChecksForPooling()
END FUNCTION
```

### Examples

- Template generator calls `check-printer-setup` → handler checks for pooling → returns "Not configured" even though printer exists
- Dashboard shows "✅ Tabeza Agent" (likely using cached status or different check) while template generator shows "Not configured"
- User prints test receipt → receipt is captured successfully → but UI still shows printer as "Not configured"

### Fault Condition 2: Template Generator UI Flow

The bug manifests when the template generator page loads and no template exists. Instead of showing the guided 3-step real-time workflow ("Print receipt 1" → wait for detection → "✓ Receipt 1 received" → "Print receipt 2" → etc.), the UI displays a static "Generate Template" button with basic step indicators.

**Formal Specification:**
```
FUNCTION isBugCondition2(input)
  INPUT: input of type UIState
  OUTPUT: boolean
  
  RETURN input.page = "template-generator" AND
         NOT templateExists() AND
         printerConfigured() AND
         NOT uiShowsGuidedWorkflow() AND
         uiShowsStaticButton()
END FUNCTION
```

### Examples

- User opens template generator → sees "Generate Template" button instead of "Step 1/3: Print your first test receipt"
- User prints receipt → UI doesn't show "✓ Receipt 1 received" feedback
- User expects real-time guidance but gets static UI that doesn't respond to receipt capture

### Fault Condition 3: Receipt Detection Not Working

The bug manifests when receipts are captured by the background service and queued in `C:\TabezaPrints\queue\pending\`, but the template generator UI doesn't detect them. The UI shows "Receipts captured: 0 / 3" even though receipt JSON files exist in the queue folder.

**Formal Specification:**
```
FUNCTION isBugCondition3(input)
  INPUT: input of type ReceiptCaptureEvent
  OUTPUT: boolean
  
  RETURN input.printerName = "Tabeza Agent" AND
         receiptFileExists(input.receiptId, "queue/pending/") AND
         NOT uiDetectsReceipt(input.receiptId) AND
         uiReceiptCount = 0
END FUNCTION
```

### Examples

- Receipt file `233264da-0370-4924-8a45-24ceeabc875f.json` exists in `C:\TabezaPrints\queue\pending\`
- Receipt contains valid parsed data with rawText showing "CAPTAIN'S ORDER" from "MIHI LOUNGE & GRILL"
- Template generator UI shows "Receipts captured: 0 / 3"
- No polling mechanism exists to check the queue folder

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Dashboard printer status display must continue to work correctly
- Receipt capture service must continue to capture and process receipts
- Configuration management (Bar ID, API URL) must continue to work
- HTTP server on port 8765 must continue to serve the management UI
- Background service must continue to process receipts with ESC/POS stripping, template parsing, and cloud upload

**Scope:**
All inputs that do NOT involve the template generator checking printer status, displaying the guided workflow, or detecting captured receipts should be completely unaffected by this fix. This includes:
- Dashboard status checks and display
- Receipt capture and processing by the background service
- Configuration save/load operations
- Other IPC handlers and UI components

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Incorrect Printer Check Method**: The IPC handler `check-printer-setup` calls a PowerShell script that checks for printer pooling configuration. However, the actual printer "Tabeza Agent" uses Redmon (virtual printer port redirector), not pooling. The script is checking for the wrong configuration type.

2. **Missing Polling Logic**: The template generator HTML (`template-generator.html`) has a `setInterval` that calls `countCapturedReceipts()` every 5 seconds, but this function checks the `PROCESSED_DIR` (`C:\TabezaPrints\processed`) instead of the `QUEUE_DIR` (`C:\TabezaPrints\queue\pending\`). Receipts are queued in `pending\` before being uploaded, so the UI is looking in the wrong location.

3. **Static UI Implementation**: The template generator HTML shows static step indicators and a "Generate Template" button instead of implementing the real-time guided workflow. The UI doesn't have state management for tracking which step the user is on or providing real-time feedback as receipts are detected.

4. **Script Path Issue**: The IPC handler references `printer-pooling-setup.ps1` which doesn't exist in the codebase. The actual printer configuration scripts are `configure-redmon-printer.ps1` and related scripts in `src/installer/scripts/`.

## Correctness Properties

Property 1: Fault Condition - Consistent Printer Status Reporting

_For any_ IPC request to check printer status from any UI component (dashboard or template generator), the fixed handler SHALL return consistent status based on actual "Tabeza Agent" existence using `Get-Printer` cmdlet, regardless of whether the printer uses pooling or Redmon.

**Validates: Requirements 2.1, 2.3, 2.5**

Property 2: Fault Condition - Real-Time Guided Workflow

_For any_ template generator page load where no template exists and printer is configured, the fixed UI SHALL display a guided 3-step workflow with real-time feedback that polls the queue folder every 2 seconds and shows "✓ Receipt X received" for each detected receipt.

**Validates: Requirements 2.2, 2.4**

Property 3: Preservation - Dashboard Functionality

_For any_ dashboard operation (status display, configuration save, printer check), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing dashboard functionality.

**Validates: Requirements 3.1, 3.2, 3.4, 3.5, 3.6**

Property 4: Preservation - Receipt Capture Service

_For any_ receipt capture event from the background service, the fixed code SHALL produce exactly the same behavior as the original code, preserving receipt processing, ESC/POS stripping, template parsing, and cloud upload.

**Validates: Requirements 3.3**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File 1**: `src/electron-main.js`

**Function**: `ipcMain.handle('check-printer-setup', ...)`

**Specific Changes**:
1. **Remove PowerShell Script Call**: Remove the call to `printer-pooling-setup.ps1` which doesn't exist and checks for wrong configuration
   
2. **Add Direct Printer Check**: Replace with PowerShell command that directly checks for "Tabeza Agent" existence:
   ```javascript
   exec(`powershell.exe -Command "Get-Printer -Name 'Tabeza Agent' -ErrorAction SilentlyContinue | ConvertTo-Json"`, ...)
   ```

3. **Parse Printer Object**: Parse the returned JSON to determine if printer exists and extract port information

4. **Return Consistent Status**: Return status object with format:
   ```javascript
   {
     status: printerExists ? 'configured' : 'not-configured',
     printerName: 'Tabeza Agent',
     portName: printer?.PortName || null,
     exists: printerExists
   }
   ```

**File 2**: `src/public/template-generator.html`

**Section**: JavaScript polling and UI state management

**Specific Changes**:
1. **Fix Queue Folder Path**: Change `PROCESSED_DIR` constant from `'C:\\TabezaPrints\\processed'` to `'C:\\TabezaPrints\\queue\\pending'`

2. **Implement Step State Management**: Add state variables to track current step (1, 2, or 3) and receipts detected per step

3. **Update UI to Show Current Step**: Replace static step display with dynamic step-by-step UI that shows:
   - "Step 1/3: Print your first test receipt from your POS" (initially)
   - "✓ Receipt 1 received - Step 2/3: Print a DIFFERENT receipt" (after first receipt)
   - "✓ Receipt 2 received - Step 3/3: Print one more DIFFERENT receipt" (after second receipt)
   - "✓ Receipt 3 received - Generating template..." (after third receipt, auto-trigger generation)

4. **Add Receipt Detection Logic**: Update `countCapturedReceipts()` to:
   - Read files from `queue/pending/` folder
   - Track which receipts have been seen (store IDs in array)
   - Detect new receipts by comparing current files with previously seen IDs
   - Update step state when new receipt is detected
   - Show visual feedback ("✓ Receipt X received")

5. **Auto-Trigger Template Generation**: When 3 receipts are detected, automatically call `generateTemplate()` instead of waiting for button click

6. **Update Polling Interval**: Change from 5 seconds to 2 seconds for more responsive feedback

**File 3**: `src/public/dashboard.html`

**Function**: `checkPrinterStatus()`

**Specific Changes**:
1. **Update Status Check Logic**: Ensure dashboard uses the same IPC handler and checks for `status === 'configured'` (matching the new return format from electron-main.js)

2. **Handle New Response Format**: Update to handle the new consistent response format from the fixed IPC handler

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: 
1. Open template generator and observe printer status display
2. Check what PowerShell script is being called by the IPC handler
3. Verify that "Tabeza Agent" exists using `Get-Printer` cmdlet
4. Print a test receipt and verify it's captured to `queue/pending/`
5. Observe that template generator UI doesn't detect the receipt
6. Check if `printer-pooling-setup.ps1` script exists in the codebase

**Test Cases**:
1. **Printer Status Check Test**: Call IPC handler from template generator → observe "Not configured" response even though printer exists (will fail on unfixed code)
2. **Receipt Detection Test**: Print receipt → verify file appears in `queue/pending/` → observe UI shows "0 / 3" (will fail on unfixed code)
3. **UI Workflow Test**: Open template generator → observe static button instead of guided workflow (will fail on unfixed code)
4. **Script Existence Test**: Check if `printer-pooling-setup.ps1` exists → observe it doesn't exist (confirms root cause)

**Expected Counterexamples**:
- IPC handler returns "Not configured" even though `Get-Printer` shows printer exists
- Receipt files exist in `queue/pending/` but UI shows 0 receipts
- UI shows static "Generate Template" button instead of "Step 1/3: Print your first test receipt"
- PowerShell script path references non-existent file

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition1(input) DO
  result := checkPrinterSetup_fixed(input)
  ASSERT result.status = "configured" AND result.exists = true
END FOR

FOR ALL input WHERE isBugCondition2(input) DO
  ui := renderTemplateGenerator_fixed(input)
  ASSERT ui.showsStep1 = true AND ui.showsGuidedWorkflow = true
END FOR

FOR ALL input WHERE isBugCondition3(input) DO
  result := detectReceipts_fixed(input)
  ASSERT result.receiptCount > 0 AND ui.showsReceiptDetected = true
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition1(input) AND NOT isBugCondition2(input) AND NOT isBugCondition3(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: Manual testing is recommended for preservation checking because:
- The application is an Electron desktop app with UI components
- Testing requires actual Windows printer configuration
- Receipt capture involves file system operations and PowerShell scripts
- Real-time UI updates require observing visual feedback

**Test Plan**: 
1. Test dashboard printer status display (should remain unchanged)
2. Test configuration save/load (should remain unchanged)
3. Test receipt capture service (should continue capturing receipts)
4. Test other IPC handlers (should remain unchanged)

**Test Cases**:
1. **Dashboard Status Preservation**: Open dashboard → verify printer status shows correctly → verify it matches template generator status
2. **Configuration Preservation**: Save Bar ID → verify it persists → verify dashboard updates
3. **Receipt Capture Preservation**: Print receipt → verify it's captured to queue folder → verify it's processed correctly
4. **Other UI Preservation**: Test other dashboard features → verify they work as before

### Unit Tests

- Test IPC handler with mock PowerShell execution to verify correct command is called
- Test receipt counting logic with mock file system to verify correct folder is checked
- Test step state management logic to verify correct transitions
- Test printer status parsing to verify correct response format

### Property-Based Tests

Property-based testing is not recommended for this bugfix because:
- The bugs involve UI components and file system operations that are difficult to test with PBT
- The application requires actual Windows printer configuration
- Receipt capture involves external PowerShell scripts
- Manual testing provides better coverage for this type of integration bug

### Integration Tests

- Test full template generator workflow: open UI → print 3 receipts → verify each is detected → verify template generation is triggered
- Test printer status consistency: check status from dashboard → check status from template generator → verify they match
- Test receipt capture and detection: print receipt → verify it appears in queue folder → verify UI detects it within 2 seconds
- Test error handling: test with printer not configured → verify appropriate error messages
