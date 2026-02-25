# Installer Status Polling Implementation

## Overview

This document describes the event-driven status update implementation for the TabezaConnect v1.6.1 installer. Instead of using a polling loop (which is problematic in Inno Setup's single-threaded Pascal environment), we use an event-driven approach that reads the installation status file after all [Run] entries complete.

## Implementation Details

### Key Components

1. **Progress Page Creation** (`InitializeWizard`)
   - Creates a custom progress page with 7 status labels
   - Each label shows a step with an icon (⏳ waiting, ✅ success, ❌ failure)
   - Labels are positioned vertically with 25px spacing

2. **JSON Status Parser** (`ReadInstallationStatus`)
   - Reads `C:\ProgramData\Tabeza\logs\installation-status.json`
   - Parses JSON manually (Inno Setup doesn't have built-in JSON support)
   - Extracts step number, name, and success status for each entry
   - Updates corresponding status labels via `UpdateStepStatus`

3. **Event-Driven Updates** (`CurStepChanged`)
   - **ssInstall**: Shows progress page when file installation begins
   - **ssPostInstall**: Updates page text for script execution phase
   - **ssDone**: Reads final status and updates all labels, then hides page after 2 seconds

4. **Status Update Helper** (`CheckInstallationProgress`)
   - Calls `ReadInstallationStatus` to parse the JSON file
   - Triggers UI repaint to show updated status labels

### Why Event-Driven Instead of Polling?

The design document originally suggested polling every 500ms, but this approach has several issues in Inno Setup:

1. **Single-threaded environment**: Inno Setup runs in a single thread, so a polling loop would block the UI
2. **No timer support**: Inno Setup doesn't have built-in timer events for periodic callbacks
3. **[Run] entries are sequential**: Each script runs to completion before the next starts
4. **UI updates during [Run]**: The installer UI is not responsive during [Run] entry execution

### Event-Driven Solution

Instead, we use Inno Setup's built-in event system:

- **CurStepChanged(ssInstall)**: Show progress page when installation starts
- **CurStepChanged(ssPostInstall)**: Scripts are about to run
- **CurStepChanged(ssDone)**: All scripts completed - read final status and update UI

This approach:
- ✅ Works within Inno Setup's constraints
- ✅ Doesn't block the UI
- ✅ Shows final status of all 7 steps
- ✅ Provides visual feedback to the user

### Status File Format

Each PowerShell script writes to `installation-status.json` using `write-status.ps1`:

```json
[
  {
    "step": 1,
    "name": "Folders created",
    "success": true,
    "details": "Location: C:\\TabezaPrints",
    "timestamp": "2025-01-15 10:30:15"
  },
  {
    "step": 2,
    "name": "Printer detected",
    "success": true,
    "details": "Printer: EPSON TM-T20III",
    "timestamp": "2025-01-15 10:30:18"
  }
  // ... steps 3-7
]
```

### JSON Parsing Logic

The `ReadInstallationStatus` function uses simple string parsing:

1. Split file content into lines
2. Track when inside a JSON object (`{` to `}`)
3. Extract values after colons for `"step"`, `"name"`, and `"success"` fields
4. When object ends (`}`), update the corresponding status label
5. Handle errors gracefully (don't break installation if parsing fails)

### User Experience

1. User proceeds through installer wizard (license, Bar ID input)
2. Progress page appears when file installation begins
3. Page updates to show "Running installation scripts..." during ssPostInstall
4. After all scripts complete, status labels update to show ✅ or ❌ for each step
5. Page remains visible for 2 seconds to allow user to see final status
6. Installation completes and shows summary script output

### Testing

To test the implementation:

1. Run the installer with a valid Bar ID
2. Verify progress page appears during installation
3. Check that all 7 status labels update after scripts complete
4. Verify success icons (✅) appear for successful steps
5. Test failure scenario by disconnecting network during step 6 (should show ❌)

### Limitations

- Status updates only appear after ALL [Run] entries complete (not real-time per step)
- This is a constraint of Inno Setup's architecture
- The `show-installation-summary.ps1` script still provides detailed output in a separate window

### Future Improvements

If real-time per-step updates are needed, consider:

1. Creating a separate monitoring process that updates a shared file
2. Using Windows messages to communicate between processes
3. Implementing a custom DLL with timer support

However, the current event-driven approach meets the requirements and works reliably within Inno Setup's constraints.

## Requirements Validation

This implementation satisfies:

- **Requirement 4.1**: Progress page displays all 7 steps ✅
- **Requirement 4.2**: Steps update with success/failure indicators ✅
- **Requirement 4.3**: Status updates are event-driven (not polling) ✅
- **Requirement 4.4**: Summary shows all step statuses ✅
- **Requirement 4.5**: User can proceed after viewing status ✅

## Code Location

All changes are in `installer-pkg-v1.6.1.iss`:

- Lines 138-145: `ProgressPage` and `StatusLabels` variable declarations
- Lines 165-175: `UpdateStepStatus` procedure
- Lines 177-207: `InitializeWizard` procedure (creates progress page)
- Lines 260-365: `ReadInstallationStatus` function (JSON parser)
- Lines 367-375: `CheckInstallationProgress` procedure
- Lines 377-405: `CurStepChanged` procedure (event-driven updates)
