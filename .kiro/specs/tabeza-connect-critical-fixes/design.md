# Tabeza Connect Critical Fixes - Bugfix Design

## Overview

This design addresses six critical bugs affecting Tabeza Connect v1.7.10's post-installation experience and core functionality. The bugs span configuration persistence, printer setup, window management, error handling, and uninstallation cleanup. The fixes target the installer-to-runtime handoff, printer configuration workflow, focus management, error propagation, dependency validation, and registry cleanup to ensure a reliable, production-ready installation experience.

## Glossary

- **Bug_Condition (C)**: The condition that triggers each bug - when specific installation, configuration, or runtime operations fail
- **Property (P)**: The desired behavior for each buggy input - successful configuration persistence, printer setup, focus management, error handling, dependency validation, and cleanup
- **Preservation**: Existing receipt capture, queue management, template generation, and service operation that must remain unchanged by the fixes
- **Bar ID**: Unique venue identifier entered during installation, stored in registry and config.json
- **RedMon**: Third-party port monitor that captures print jobs to files (mandatory dependency)
- **TabezaConnect.exe**: Compiled Electron application serving as both tray app and Windows Service
- **config.json**: Runtime configuration file at C:\ProgramData\Tabeza\config.json
- **Registry Path**: HKLM\SOFTWARE\Tabeza\TabezaConnect (stores BarID, APIUrl, WatchFolder)

## Bug Details

### Bug 1: Bar ID Persistence Failure

The installer wizard collects Bar ID from the user but fails to persist it to config.json. The tray app config settings show "✗ Bar ID not configured" even after successful installation.

**Formal Specification:**
```
FUNCTION isBugCondition_BarID(input)
  INPUT: input of type InstallerSession
  OUTPUT: boolean
  
  RETURN input.barIdEntered == true
         AND input.installerCompleted == true
         AND config.json.barId == ""
         AND registry.BarID exists
END FUNCTION
```

**Examples:**
- User enters "bar-123" in installer wizard → installer completes → config.json has barId: "" → tray shows "✗ Bar ID not configured"
- User enters valid Bar ID → registry key HKLM\SOFTWARE\Tabeza\TabezaConnect\BarID contains value → config.json not updated
- Service starts → reads config.json → barId is empty → API requests fail with "Bar ID not configured"

### Bug 2: POS Printer Setup Failure

When user attempts to configure the POS printer through the tray app, the system fails with exit code -196608. The error message provides no actionable recovery steps.

**Formal Specification:**
```
FUNCTION isBugCondition_PrinterSetup(input)
  INPUT: input of type PrinterSetupAttempt
  OUTPUT: boolean
  
  RETURN input.setupInitiated == true
         AND input.exitCode == -196608
         AND input.errorMessage contains "Check C:\TabezaPrints\logs\electron.log"
         AND input.actionableGuidance == null
END FUNCTION
```

**Examples:**
- User clicks "Setup Printer" → PowerShell script runs elevated → returns exit code -196608 → user sees generic error
- Printer driver missing → setup fails → error log shows "driver not found" → user not informed of specific issue
- RedMon not installed → setup attempts to configure port → fails silently → user sees cryptic exit code

### Bug 3: Window Focus Stealing

The Tabeza Connect tray app repeatedly brings its window to the front, stealing focus from other applications during normal operation.

**Formal Specification:**
```
FUNCTION isBugCondition_FocusSteal(input)
  INPUT: input of type WindowEvent
  OUTPUT: boolean
  
  RETURN input.trayAppOpen == true
         AND input.userActiveApp != "TabezaConnect"
         AND input.focusChangedTo == "TabezaConnect"
         AND input.userInitiated == false
END FUNCTION
```

**Examples:**
- User types in Word → Tabeza window suddenly appears on top → user loses typing context
- User browses web → Tabeza window steals focus every few seconds → browsing interrupted
- User plays video → Tabeza window appears → video paused or minimized

### Bug 4: EPIPE Broken Pipe Errors

When RedMon registry check fails, the system generates cascading "EPIPE: broken pipe, write" errors originating from verifyRedMonRegistry function at electron-main.js:168:21.

**Formal Specification:**
```
FUNCTION isBugCondition_EPIPE(input)
  INPUT: input of type RegistryCheckEvent
  OUTPUT: boolean
  
  RETURN input.redmonCheckFailed == true
         AND input.errorType == "EPIPE"
         AND input.errorMessage contains "broken pipe, write"
         AND input.cascadingErrors > 0
END FUNCTION
```

**Examples:**
- RedMon not installed → registry check fails → console.log attempts write → pipe broken → EPIPE error
- Child process exits prematurely → parent tries to write → pipe closed → cascading errors
- Error log polluted with hundreds of EPIPE messages → actual errors hidden

### Bug 5: RedMon Registry Check Failure

The app performs RedMon registry check and shows "RedMon registry check failed: Command failed: reg query..." warnings. When RedMon is not installed (a mandatory requirement), the system continues in a broken state instead of blocking startup or guiding user to install RedMon.

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

**Examples:**
- App starts → RedMon check fails → warning logged → app continues → receipt capture fails silently
- User completes installation → RedMon not installed → no clear error → printer setup appears successful but doesn't work
- Service runs → attempts to capture receipts → RedMon port missing → receipts lost

### Bug 6: Incomplete Uninstallation

When user uninstalls Tabeza Connect via Windows Programs & Features, the system removes application files but leaves registry entries at HKLM\SOFTWARE\Tabeza\TabezaConnect.

**Formal Specification:**
```
FUNCTION isBugCondition_Uninstall(input)
  INPUT: input of type UninstallEvent
  OUTPUT: boolean
  
  RETURN input.uninstallerCompleted == true
         AND input.applicationFilesRemoved == true
         AND registry.HKLM\SOFTWARE\Tabeza\TabezaConnect exists
         AND (registry.BarID exists OR registry.APIUrl exists OR registry.WatchFolder exists)
END FUNCTION
```

**Examples:**
- User uninstalls via Control Panel → files deleted → registry keys remain → reinstall reads old config
- User uninstalls → reinstalls → old Bar ID persists → user confused why new Bar ID not used
- Multiple install/uninstall cycles → registry accumulates stale entries → configuration conflicts

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Receipt capture via RedMon port monitor must continue to work exactly as before when RedMon is properly installed
- Queue system (pending/uploaded folders) must continue to handle offline scenarios with exponential backoff retry
- Template generator 3-step workflow must continue to function identically
- Management UI dashboard must continue to serve on localhost:8765 with all existing features
- System tray icon must continue to show green (online) or grey (offline/unconfigured) status
- Windows Service auto-start behavior must remain unchanged
- Configuration loading priority (environment variables → Registry → config.json) must remain unchanged

**Scope:**
All inputs that do NOT involve the six specific bug conditions should be completely unaffected by these fixes. This includes:
- Normal receipt capture and processing when all components are properly configured
- Template generation when prerequisites are met
- Service heartbeat and cloud communication
- Existing error handling for non-bug scenarios
- All UI interactions not related to the six bugs

## Hypothesized Root Cause

Based on the bug descriptions and codebase analysis, the most likely issues are:

### Bug 1: Bar ID Persistence Failure

1. **Installer-to-Runtime Handoff Gap**: The installer writes Bar ID to registry (HKLM\SOFTWARE\Tabeza\TabezaConnect\BarID) but the service/tray app only reads from config.json on first startup
   - Installer script: `installer-pkg-v1.7.15.iss` line 127 writes to registry
   - Service startup: `electron-main.js` reads config.json but doesn't check registry fallback
   - Missing migration logic to copy registry value to config.json on first run

2. **Service Environment Variable Not Propagated**: The `register-service-pkg.ps1` script sets TABEZA_BAR_ID environment variable in service registry, but the service doesn't read it on startup
   - Script sets: `HKLM:\SYSTEM\CurrentControlSet\Services\TabezaConnect\Environment\TABEZA_BAR_ID`
   - Service reads: config.json only, ignoring environment variables

3. **Config File Write Timing**: The installer creates config.json from template before Bar ID is collected, and never updates it with the user-provided value

### Bug 2: POS Printer Setup Failure

1. **Exit Code -196608 Indicates PowerShell Elevation Failure**: This specific exit code suggests UAC cancellation or insufficient privileges
   - `electron-main.js` line 1950: Uses `Start-Process -Verb RunAs` for elevation
   - Exit code file read logic may fail if UAC is cancelled
   - No specific error message for this common failure mode

2. **Missing Prerequisite Validation**: The setup doesn't check if printer driver is installed before attempting configuration
   - No pre-flight check for required printer drivers
   - No validation that RedMon is installed before attempting port configuration

3. **Error Message Lacks Context**: Generic "Check logs" message doesn't help user understand what went wrong or how to fix it
   - No specific guidance for common failures (driver missing, UAC cancelled, RedMon not installed)

### Bug 3: Window Focus Stealing

1. **Aggressive Window Show/Focus Calls**: The management UI window creation includes multiple focus-forcing calls
   - `electron-main.js` line 1200: `mainWindow.show()` followed by `mainWindow.focus()`
   - State sync on focus event may trigger additional focus calls
   - No debouncing or user-initiated check before focusing

2. **State Sync Focus Listener**: The focus event listener (line 920) may create a feedback loop
   - Window focuses → state sync triggered → broadcast to window → window focuses again
   - No guard against programmatic focus events

3. **Tray Click Handler**: Single-click on tray icon calls `showManagementUI()` which always focuses window
   - No check if window is already visible and focused
   - No option to minimize-to-tray on second click

### Bug 4: EPIPE Broken Pipe Errors

1. **Synchronous Registry Check with Console Output**: The `verifyRedMonRegistry()` function (line 168) uses `execSync` and logs results
   - If child process exits prematurely, stdout/stderr pipes close
   - Subsequent console.log attempts write to closed pipe
   - No try/catch around pipe operations

2. **Cascading Error Propagation**: One EPIPE error triggers multiple subsequent errors
   - Error handler tries to log error → pipe broken → another EPIPE
   - No circuit breaker to stop cascading failures

3. **Missing Error Suppression**: The function catches registry check failure but doesn't suppress pipe errors
   - `catch (e)` block logs warning, but pipe errors escape to console

### Bug 5: RedMon Registry Check Failure

1. **Soft Failure Instead of Hard Block**: The app treats RedMon as optional when it's actually mandatory
   - `verifyRedMonRegistry()` logs warning but doesn't block startup
   - No user-facing error message when RedMon is missing
   - Service continues to run in broken state

2. **No Startup Validation**: The app doesn't validate mandatory dependencies before starting service
   - No pre-flight check for RedMon installation
   - No clear error message to user about missing dependency

3. **Silent Receipt Capture Failure**: When RedMon is missing, receipt capture fails silently
   - No error shown to user
   - Receipts appear to be captured but are actually lost

### Bug 6: Incomplete Uninstallation

1. **Missing Registry Cleanup in Uninstaller**: The `[UninstallRun]` section in `installer-pkg-v1.7.15.iss` doesn't include registry cleanup
   - Uninstaller stops service and removes files
   - No `reg delete` command for HKLM\SOFTWARE\Tabeza\TabezaConnect
   - Registry keys persist after uninstall

2. **Installer Assumes Clean State**: The installer doesn't check for existing registry keys from previous installation
   - No cleanup of stale configuration
   - Old Bar ID may interfere with new installation

## Correctness Properties

Property 1: Bug Condition - Bar ID Persistence

_For any_ installation where the user enters a valid Bar ID in the installer wizard and completes installation, the fixed system SHALL persist the Bar ID to C:\ProgramData\Tabeza\config.json and the tray app config settings SHALL display the configured Bar ID with "✓ Bar ID configured".

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - POS Printer Setup Success

_For any_ printer setup attempt where the user has the required printer driver installed and grants UAC elevation, the fixed system SHALL complete setup successfully with exit code 0 and provide specific error messages with actionable recovery steps for any failures.

**Validates: Requirements 2.3, 2.4**

Property 3: Bug Condition - Window Focus Management

_For any_ window event where the Tabeza Connect tray app is open and the user is actively using another application, the fixed system SHALL NOT steal focus unless explicitly invoked by user action (clicking tray icon, opening dashboard).

**Validates: Requirements 2.5, 2.6**

Property 4: Bug Condition - EPIPE Error Prevention

_For any_ RedMon registry check failure, the fixed system SHALL handle the error gracefully without generating EPIPE broken pipe errors and SHALL catch and suppress cascading pipe errors to prevent log pollution.

**Validates: Requirements 2.7, 2.8**

Property 5: Bug Condition - RedMon Dependency Validation

_For any_ app startup where RedMon is not installed, the fixed system SHALL display a clear user-facing message: "RedMon port monitor is required but not installed. Please run the installer to configure RedMon." and SHALL either block service startup with clear guidance OR enter a safe degraded mode that prevents receipt capture attempts until RedMon is configured.

**Validates: Requirements 2.9, 2.10**

Property 6: Bug Condition - Complete Uninstallation

_For any_ uninstallation via Windows Programs & Features, the fixed system SHALL remove all registry entries at HKLM\SOFTWARE\Tabeza\TabezaConnect including BarID, APIUrl, and WatchFolder keys to ensure a clean slate for potential reinstallation.

**Validates: Requirements 2.11, 2.12**

Property 7: Preservation - Receipt Capture & Processing

_For any_ receipt capture event where RedMon is properly installed and configured, the fixed system SHALL produce exactly the same behavior as the original system, preserving all existing receipt capture, parsing, and queue management functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

Property 8: Preservation - Management UI & Template Generator

_For any_ user interaction with the management UI or template generator where the user completes the 3-step workflow, the fixed system SHALL produce exactly the same behavior as the original system, preserving all existing dashboard features and template generation logic.

**Validates: Requirements 3.5, 3.6**

Property 9: Preservation - System Tray & Service Operation

_For any_ Windows login or service startup event, the fixed system SHALL produce exactly the same behavior as the original system, preserving tray icon display, menu options, service auto-start, and heartbeat functionality.

**Validates: Requirements 3.7, 3.8, 3.9, 3.10, 3.11, 3.12**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

#### Bug 1: Bar ID Persistence Failure

**File**: `tabeza-connect/electron-main.js`

**Function**: `app.whenReady()` initialization sequence

**Specific Changes**:
1. **Add Registry-to-Config Migration**: After folder initialization, check if config.json.barId is empty but registry BarID exists
   - Read `HKLM\SOFTWARE\Tabeza\TabezaConnect\BarID` using `reg query`
   - If registry value exists and config.json.barId is empty, write registry value to config.json
   - Log migration action for debugging

2. **Add Environment Variable Fallback**: Check service environment variables before falling back to config.json
   - Read `process.env.TABEZA_BAR_ID` on service startup
   - If set and config.json.barId is empty, write environment variable to config.json
   - Maintain configuration priority: env vars → registry → config.json

3. **Update Installer Script**: Modify `installer-pkg-v1.7.15.iss` to write Bar ID to config.json immediately after user input
   - Add PowerShell script to update config.json with Bar ID before service registration
   - Ensure config.json is created with Bar ID before `register-service-pkg.ps1` runs

**File**: `tabeza-connect/files/register-service-pkg.ps1`

**Specific Changes**:
4. **Add Config.json Update**: After setting registry environment variables, also update config.json
   - Read existing config.json
   - Merge in Bar ID from parameter
   - Write back to C:\ProgramData\Tabeza\config.json
   - Log success/failure

#### Bug 2: POS Printer Setup Failure

**File**: `tabeza-connect/electron-main.js`

**Function**: `ipcMain.handle('setup-printer')`

**Specific Changes**:
1. **Add Exit Code Interpretation**: Map exit code -196608 to specific error message
   - If exitCode === -196608, return error: "Setup cancelled or UAC denied. Please grant administrator privileges and try again."
   - Add mapping for other common exit codes (driver missing, port conflict, etc.)

2. **Add Prerequisite Validation**: Check for required components before attempting setup
   - Verify printer driver is installed using `Get-PrinterDriver`
   - Verify RedMon is installed by checking registry
   - Return specific error if prerequisites not met

3. **Improve Error Messages**: Provide actionable guidance for each failure mode
   - Driver missing: "Printer driver not found. Please install the printer driver and try again."
   - RedMon missing: "RedMon port monitor not installed. Please run the full installer to configure RedMon."
   - UAC cancelled: "Administrator privileges required. Please grant UAC permission and try again."

#### Bug 3: Window Focus Stealing

**File**: `tabeza-connect/electron-main.js`

**Function**: `showManagementUI()`

**Specific Changes**:
1. **Remove Aggressive Focus Calls**: Replace `mainWindow.show()` + `mainWindow.focus()` with conditional logic
   - If window is minimized, restore it
   - If window is hidden, show it
   - Do NOT call focus() unless window was previously hidden/minimized
   - Let OS handle focus based on user interaction

2. **Add Focus Guard**: Check if focus change is user-initiated before focusing window
   - Track last user interaction timestamp
   - Only focus if user clicked tray icon within last 500ms
   - Ignore programmatic focus requests

**Function**: Focus event listeners (lines 920, 1050)

**Specific Changes**:
3. **Prevent Focus Feedback Loop**: Add guard to prevent state sync from triggering additional focus
   - Check if focus event is programmatic (not user-initiated)
   - Skip state sync broadcast if focus was triggered by state sync
   - Add debounce to prevent rapid focus changes

#### Bug 4: EPIPE Broken Pipe Errors

**File**: `tabeza-connect/electron-main.js`

**Function**: `verifyRedMonRegistry()`

**Specific Changes**:
1. **Wrap Console Operations in Try/Catch**: Catch EPIPE errors from console.log
   - Wrap all console.log calls in try/catch
   - Silently ignore EPIPE errors (pipe already closed)
   - Use alternative logging method (fs.appendFileSync) if console fails

2. **Use Async Registry Check**: Replace `execSync` with `exec` to avoid blocking and pipe issues
   - Use async `exec` instead of `execSync`
   - Handle stdout/stderr streams properly
   - Close streams explicitly after reading

3. **Add Circuit Breaker**: Stop attempting registry checks after first EPIPE error
   - Set flag `redmonCheckFailed = true` on first EPIPE
   - Skip subsequent registry checks if flag is set
   - Prevent cascading errors

#### Bug 5: RedMon Registry Check Failure

**File**: `tabeza-connect/electron-main.js`

**Function**: `app.whenReady()` initialization sequence

**Specific Changes**:
1. **Add Mandatory Dependency Check**: Validate RedMon is installed before starting service
   - Check for RedMon registry key on startup
   - If missing, show user-facing error dialog
   - Block service startup until RedMon is installed

2. **Add User Guidance**: Display clear error message with installation instructions
   - Show Electron dialog: "RedMon port monitor is required but not installed. Please run the installer to configure RedMon."
   - Provide link to installer or instructions
   - Prevent tray app from showing "online" status

3. **Add Degraded Mode**: If RedMon is missing, enter safe mode that prevents receipt capture
   - Set service status to "degraded"
   - Disable receipt capture functionality
   - Show warning in management UI
   - Allow configuration and template generation to continue

#### Bug 6: Incomplete Uninstallation

**File**: `tabeza-connect/installer-pkg-v1.7.15.iss`

**Section**: `[UninstallRun]`

**Specific Changes**:
1. **Add Registry Cleanup**: Delete all registry keys on uninstall
   - Add command: `reg delete "HKLM\SOFTWARE\Tabeza\TabezaConnect" /f`
   - Run before service deletion
   - Log success/failure

2. **Add Service Environment Cleanup**: Remove service environment variables
   - Delete `HKLM:\SYSTEM\CurrentControlSet\Services\TabezaConnect\Environment`
   - Ensure clean removal of all service-related registry entries

**Section**: `[Code]` (installer initialization)

**Specific Changes**:
3. **Add Pre-Install Cleanup**: Check for existing registry keys and clean them up
   - On installer start, check if HKLM\SOFTWARE\Tabeza\TabezaConnect exists
   - If exists, prompt user: "Previous installation detected. Clean up old configuration?"
   - If yes, delete registry keys before proceeding
   - Ensure fresh installation state

## Testing Strategy

### Validation Approach

The testing strategy follows a three-phase approach: first, surface counterexamples that demonstrate each bug on unfixed code; second, verify each fix works correctly; third, verify existing behavior is preserved.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate each bug BEFORE implementing the fixes. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate each bug condition and assert that the expected failure occurs. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Bar ID Persistence Test**: Install with Bar ID "test-bar-123" → check config.json → assert barId is empty (will fail on unfixed code)
2. **Printer Setup Failure Test**: Attempt printer setup without UAC elevation → assert exit code -196608 (will fail on unfixed code)
3. **Focus Stealing Test**: Open tray app → switch to another app → assert Tabeza window steals focus (will fail on unfixed code)
4. **EPIPE Error Test**: Trigger RedMon check failure → assert EPIPE errors in log (will fail on unfixed code)
5. **RedMon Missing Test**: Uninstall RedMon → start app → assert app continues running (will fail on unfixed code)
6. **Uninstall Cleanup Test**: Install → uninstall → check registry → assert keys remain (will fail on unfixed code)

**Expected Counterexamples**:
- Bar ID entered in installer but not persisted to config.json
- Printer setup fails with cryptic exit code -196608
- Window focus stolen from active application
- EPIPE errors cascade in log file
- App runs without RedMon, receipt capture fails silently
- Registry keys remain after uninstall

### Fix Checking

**Goal**: Verify that for all inputs where each bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition_BarID(input) DO
  result := fixedInstaller(input)
  ASSERT result.config.barId == input.barIdEntered
  ASSERT result.trayStatus == "✓ Bar ID configured"
END FOR

FOR ALL input WHERE isBugCondition_PrinterSetup(input) DO
  result := fixedPrinterSetup(input)
  ASSERT result.exitCode == 0 OR result.errorMessage contains actionable guidance
END FOR

FOR ALL input WHERE isBugCondition_FocusSteal(input) DO
  result := fixedWindowManager(input)
  ASSERT result.focusChanged == false OR result.userInitiated == true
END FOR

FOR ALL input WHERE isBugCondition_EPIPE(input) DO
  result := fixedRegistryCheck(input)
  ASSERT result.epipeErrors == 0
END FOR

FOR ALL input WHERE isBugCondition_RedMonCheck(input) DO
  result := fixedStartup(input)
  ASSERT result.userGuidance != null OR result.degradedMode == true
END FOR

FOR ALL input WHERE isBugCondition_Uninstall(input) DO
  result := fixedUninstaller(input)
  ASSERT result.registryKeysRemaining == 0
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug conditions do NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition_BarID(input) DO
  ASSERT fixedInstaller(input) = originalInstaller(input)
END FOR

FOR ALL input WHERE NOT isBugCondition_PrinterSetup(input) DO
  ASSERT fixedPrinterSetup(input) = originalPrinterSetup(input)
END FOR

FOR ALL input WHERE NOT isBugCondition_FocusSteal(input) DO
  ASSERT fixedWindowManager(input) = originalWindowManager(input)
END FOR

FOR ALL input WHERE NOT isBugCondition_EPIPE(input) DO
  ASSERT fixedRegistryCheck(input) = originalRegistryCheck(input)
END FOR

FOR ALL input WHERE NOT isBugCondition_RedMonCheck(input) DO
  ASSERT fixedStartup(input) = originalStartup(input)
END FOR

FOR ALL input WHERE NOT isBugCondition_Uninstall(input) DO
  ASSERT fixedUninstaller(input) = originalUninstaller(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for normal operations, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Receipt Capture Preservation**: Verify receipt capture works identically when RedMon is installed
2. **Queue Management Preservation**: Verify offline queue and retry logic unchanged
3. **Template Generation Preservation**: Verify 3-step workflow produces same results
4. **Service Startup Preservation**: Verify auto-start and heartbeat unchanged
5. **Tray Icon Preservation**: Verify icon color and menu options unchanged
6. **Configuration Loading Preservation**: Verify priority order (env → registry → config) unchanged

### Unit Tests

- Test Bar ID migration from registry to config.json
- Test environment variable fallback for Bar ID
- Test exit code interpretation for printer setup
- Test prerequisite validation before printer setup
- Test focus guard logic for window management
- Test EPIPE error suppression in registry check
- Test RedMon dependency validation on startup
- Test registry cleanup on uninstall
- Test pre-install cleanup of stale registry keys

### Property-Based Tests

- Generate random Bar IDs and verify persistence across install/uninstall cycles
- Generate random printer configurations and verify setup success/failure messages
- Generate random window events and verify focus only changes on user action
- Generate random registry check failures and verify no EPIPE errors
- Generate random startup scenarios (RedMon installed/missing) and verify appropriate behavior
- Generate random install/uninstall sequences and verify clean registry state

### Integration Tests

- Full install → configure Bar ID → verify tray shows configured status
- Full install → setup printer → verify exit code 0 or actionable error
- Full install → open tray → switch apps → verify no focus stealing
- Full install without RedMon → verify clear error message
- Full install → uninstall → verify registry cleaned up
- Full install → reinstall → verify no stale configuration interference
