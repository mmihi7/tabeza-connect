# Implementation Plan

## Bug 1: Bar ID Persistence Failure

- [x] 1.1 Write bug condition exploration test
  - **Property 1: Bug Condition** - Bar ID Not Persisted After Installation
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing case: user enters valid Bar ID in installer, completes installation, but config.json.barId remains empty
  - Test that when installer writes Bar ID to registry (HKLM\SOFTWARE\Tabeza\TabezaConnect\BarID), the service startup reads it and persists to config.json
  - The test assertions should match the Expected Behavior Properties from design: config.json.barId equals entered value AND tray shows "✓ Bar ID configured"
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found: "Installer writes 'bar-123' to registry → service starts → config.json.barId is empty → tray shows '✗ Bar ID not configured'"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2_

- [x] 1.2 Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Configuration Loading Priority Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs: when Bar ID is already in config.json, service reads it correctly
  - Write property-based test: for all scenarios where config.json already contains Bar ID, service loads it correctly (from Preservation Requirements in design)
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.11, 3.12_

- [x] 1.3 Fix Bar ID persistence from installer to runtime

  - [x] 1.3.1 Implement registry-to-config migration in electron-main.js
    - Add registry read logic after folder initialization in app.whenReady()
    - Check if config.json.barId is empty but HKLM\SOFTWARE\Tabeza\TabezaConnect\BarID exists
    - If registry value exists and config.json.barId is empty, write registry value to config.json
    - Log migration action for debugging
    - _Bug_Condition: isBugCondition_BarID(input) where input.barIdEntered == true AND input.installerCompleted == true AND config.json.barId == "" AND registry.BarID exists_
    - _Expected_Behavior: config.json.barId SHALL equal registry.BarID AND tray SHALL display "✓ Bar ID configured"_
    - _Preservation: Configuration loading priority (env vars → Registry → config.json) must remain unchanged_
    - _Requirements: 2.1, 2.2, 3.11, 3.12_

  - [x] 1.3.2 Add environment variable fallback
    - Read process.env.TABEZA_BAR_ID on service startup
    - If set and config.json.barId is empty, write environment variable to config.json
    - Maintain configuration priority: env vars → registry → config.json
    - _Requirements: 2.2, 3.11_

  - [x] 1.3.3 Update installer script to write Bar ID to config.json
    - Modify installer-pkg-v1.7.15.iss to write Bar ID to config.json immediately after user input
    - Add PowerShell script to update config.json with Bar ID before service registration
    - Ensure config.json is created with Bar ID before register-service-pkg.ps1 runs
    - _Requirements: 2.1_

  - [x] 1.3.4 Update register-service-pkg.ps1 to update config.json
    - After setting registry environment variables, also update config.json
    - Read existing config.json, merge in Bar ID from parameter, write back
    - Log success/failure
    - _Requirements: 2.1, 2.2_

  - [x] 1.3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Bar ID Persisted After Installation
    - **IMPORTANT**: Re-run the SAME test from task 1.1 - do NOT write a new test
    - The test from task 1.1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 1.3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Configuration Loading Priority Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 1.2 - do NOT write new tests
    - Run preservation property tests from step 1.2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.11, 3.12_

- [x] 1.4 Checkpoint - Ensure all Bug 1 tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Bug 2: POS Printer Setup Failure

- [x] 2.1 Write bug condition exploration test
  - **Property 1: Bug Condition** - Printer Setup Fails With Exit Code -196608
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing case: user attempts printer setup, UAC is cancelled or denied, system returns exit code -196608 with no actionable guidance
  - Test that when printer setup fails with exit code -196608, the system provides specific error message with actionable recovery steps (from Bug Condition in design)
  - The test assertions should match the Expected Behavior Properties from design: exit code 0 OR specific error message with actionable guidance
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found: "User clicks 'Setup Printer' → UAC cancelled → exit code -196608 → generic error 'Check logs' with no actionable guidance"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2_

- [x] 2.2 Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Successful Printer Setup Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs: when printer driver is installed and UAC is granted, setup completes successfully
  - Write property-based test: for all scenarios where prerequisites are met (driver installed, UAC granted), setup returns exit code 0 (from Preservation Requirements in design)
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.5, 3.6_

- [x] 2.3 Fix POS printer setup failure handling

  - [x] 2.3.1 Add exit code interpretation in ipcMain.handle('setup-printer')
    - Map exit code -196608 to specific error message: "Setup cancelled or UAC denied. Please grant administrator privileges and try again."
    - Add mapping for other common exit codes (driver missing, port conflict, etc.)
    - _Bug_Condition: isBugCondition_PrinterSetup(input) where input.setupInitiated == true AND input.exitCode == -196608 AND input.actionableGuidance == null_
    - _Expected_Behavior: System SHALL provide specific error message with actionable recovery steps_
    - _Preservation: Successful printer setup (exit code 0) must remain unchanged_
    - _Requirements: 2.3, 2.4, 3.5, 3.6_

  - [x] 2.3.2 Add prerequisite validation before setup
    - Verify printer driver is installed using Get-PrinterDriver
    - Verify RedMon is installed by checking registry
    - Return specific error if prerequisites not met
    - _Requirements: 2.4_

  - [x] 2.3.3 Improve error messages with actionable guidance
    - Driver missing: "Printer driver not found. Please install the printer driver and try again."
    - RedMon missing: "RedMon port monitor not installed. Please run the full installer to configure RedMon."
    - UAC cancelled: "Administrator privileges required. Please grant UAC permission and try again."
    - _Requirements: 2.4_

  - [x] 2.3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Printer Setup Provides Actionable Error Messages
    - **IMPORTANT**: Re-run the SAME test from task 2.1 - do NOT write a new test
    - The test from task 2.1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 2.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.3, 2.4_

  - [x] 2.3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Successful Printer Setup Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2.2 - do NOT write new tests
    - Run preservation property tests from step 2.2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.5, 3.6_

- [x] 2.4 Checkpoint - Ensure all Bug 2 tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Bug 3: Window Focus Stealing

- [x] 3.1 Write bug condition exploration test
  - **Property 1: Bug Condition** - Window Steals Focus From Active Application
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing case: tray app is open, user is actively using another application, Tabeza window steals focus without user action
  - Test that when tray app is open and user is in another application, Tabeza window does NOT steal focus unless explicitly invoked by user action (from Bug Condition in design)
  - The test assertions should match the Expected Behavior Properties from design: focus changes ONLY when user clicks tray icon or opens dashboard
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found: "User types in Word → Tabeza window suddenly appears on top → user loses typing context"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 3.1, 3.2_

- [x] 3.2 Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - User-Initiated Focus Changes Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs: when user clicks tray icon, window comes to front as expected
  - Write property-based test: for all scenarios where user explicitly invokes window (clicks tray icon, opens dashboard), window comes to front (from Preservation Requirements in design)
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.7, 3.8_

- [x] 3.3 Fix window focus stealing

  - [x] 3.3.1 Remove aggressive focus calls in showManagementUI()
    - Replace mainWindow.show() + mainWindow.focus() with conditional logic
    - If window is minimized, restore it
    - If window is hidden, show it
    - Do NOT call focus() unless window was previously hidden/minimized
    - Let OS handle focus based on user interaction
    - _Bug_Condition: isBugCondition_FocusSteal(input) where input.trayAppOpen == true AND input.userActiveApp != "TabezaConnect" AND input.focusChangedTo == "TabezaConnect" AND input.userInitiated == false_
    - _Expected_Behavior: System SHALL NOT steal focus unless explicitly invoked by user action_
    - _Preservation: User-initiated focus changes (clicking tray icon) must remain unchanged_
    - _Requirements: 2.5, 2.6, 3.7, 3.8_

  - [x] 3.3.2 Add focus guard to prevent programmatic focus
    - Track last user interaction timestamp
    - Only focus if user clicked tray icon within last 500ms
    - Ignore programmatic focus requests
    - _Requirements: 2.5, 2.6_

  - [x] 3.3.3 Prevent focus feedback loop in event listeners
    - Check if focus event is programmatic (not user-initiated)
    - Skip state sync broadcast if focus was triggered by state sync
    - Add debounce to prevent rapid focus changes
    - _Requirements: 2.5_

  - [x] 3.3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Window Does Not Steal Focus
    - **IMPORTANT**: Re-run the SAME test from task 3.1 - do NOT write a new test
    - The test from task 3.1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 3.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.5, 2.6_

  - [x] 3.3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - User-Initiated Focus Changes Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 3.2 - do NOT write new tests
    - Run preservation property tests from step 3.2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.7, 3.8_

- [x] 3.4 Checkpoint - Ensure all Bug 3 tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Bug 4: EPIPE Broken Pipe Errors

- [x] 4.1 Write bug condition exploration test
  - **Property 1: Bug Condition** - EPIPE Errors Cascade From Registry Check Failure
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing case: RedMon registry check fails, system generates cascading EPIPE broken pipe errors
  - Test that when RedMon registry check fails, system handles error gracefully without generating EPIPE errors (from Bug Condition in design)
  - The test assertions should match the Expected Behavior Properties from design: no EPIPE errors in log, cascading pipe errors suppressed
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found: "RedMon not installed → registry check fails → console.log attempts write → pipe broken → EPIPE error → cascading errors"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 4.1, 4.2_

- [x] 4.2 Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Successful Registry Check Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs: when RedMon is installed, registry check succeeds without errors
  - Write property-based test: for all scenarios where RedMon is properly installed, registry check completes successfully (from Preservation Requirements in design)
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2_

- [x] 4.3 Fix EPIPE broken pipe error handling

  - [x] 4.3.1 Wrap console operations in try/catch in verifyRedMonRegistry()
    - Wrap all console.log calls in try/catch
    - Silently ignore EPIPE errors (pipe already closed)
    - Use alternative logging method (fs.appendFileSync) if console fails
    - _Bug_Condition: isBugCondition_EPIPE(input) where input.redmonCheckFailed == true AND input.errorType == "EPIPE" AND input.cascadingErrors > 0_
    - _Expected_Behavior: System SHALL handle error gracefully without generating EPIPE errors_
    - _Preservation: Successful registry check when RedMon is installed must remain unchanged_
    - _Requirements: 2.7, 2.8, 3.1, 3.2_

  - [x] 4.3.2 Use async registry check instead of execSync
    - Replace execSync with async exec to avoid blocking and pipe issues
    - Handle stdout/stderr streams properly
    - Close streams explicitly after reading
    - _Requirements: 2.7, 2.8_

  - [x] 4.3.3 Add circuit breaker to prevent cascading errors
    - Set flag redmonCheckFailed = true on first EPIPE
    - Skip subsequent registry checks if flag is set
    - Prevent cascading errors
    - _Requirements: 2.8_

  - [x] 4.3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - No EPIPE Errors On Registry Check Failure
    - **IMPORTANT**: Re-run the SAME test from task 4.1 - do NOT write a new test
    - The test from task 4.1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 4.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.7, 2.8_

  - [x] 4.3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Successful Registry Check Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 4.2 - do NOT write new tests
    - Run preservation property tests from step 4.2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2_

- [x] 4.4 Checkpoint - Ensure all Bug 4 tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Bug 5: RedMon Registry Check Failure

- [x] 5.1 Write bug condition exploration test
  - **Property 1: Bug Condition** - App Continues Running Without RedMon
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing case: RedMon is not installed, app starts and continues running without blocking or user guidance
  - Test that when RedMon is not installed, system displays clear user-facing message and either blocks startup or enters degraded mode (from Bug Condition in design)
  - The test assertions should match the Expected Behavior Properties from design: clear error message displayed AND (startup blocked OR degraded mode enabled)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found: "App starts → RedMon check fails → warning logged → app continues → receipt capture fails silently"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 5.1, 5.2_

- [x] 5.2 Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Normal Startup With RedMon Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs: when RedMon is properly installed, app starts normally and receipt capture works
  - Write property-based test: for all scenarios where RedMon is installed, app starts normally and all features work (from Preservation Requirements in design)
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.9, 3.10_

- [x] 5.3 Fix RedMon dependency validation

  - [x] 5.3.1 Add mandatory dependency check in app.whenReady()
    - Check for RedMon registry key on startup
    - If missing, show user-facing error dialog
    - Block service startup until RedMon is installed
    - _Bug_Condition: isBugCondition_RedMonCheck(input) where input.redmonInstalled == false AND input.appStartupBlocked == false AND input.userGuidance == null_
    - _Expected_Behavior: System SHALL display clear user-facing message and block startup OR enter degraded mode_
    - _Preservation: Normal startup when RedMon is installed must remain unchanged_
    - _Requirements: 2.9, 2.10, 3.1, 3.2, 3.9, 3.10_

  - [x] 5.3.2 Add user guidance with installation instructions
    - Show Electron dialog: "RedMon port monitor is required but not installed. Please run the installer to configure RedMon."
    - Provide link to installer or instructions
    - Prevent tray app from showing "online" status
    - _Requirements: 2.9_

  - [x] 5.3.3 Add degraded mode as alternative to blocking
    - Set service status to "degraded"
    - Disable receipt capture functionality
    - Show warning in management UI
    - Allow configuration and template generation to continue
    - _Requirements: 2.10_

  - [x] 5.3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Clear Error When RedMon Missing
    - **IMPORTANT**: Re-run the SAME test from task 5.1 - do NOT write a new test
    - The test from task 5.1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 5.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.9, 2.10_

  - [x] 5.3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Normal Startup With RedMon Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 5.2 - do NOT write new tests
    - Run preservation property tests from step 5.2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.9, 3.10_

- [x] 5.4 Checkpoint - Ensure all Bug 5 tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Bug 6: Incomplete Uninstallation

- [x] 6.1 Write bug condition exploration test
  - **Property 1: Bug Condition** - Registry Entries Remain After Uninstall
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing case: user uninstalls via Windows Programs & Features, application files removed, but registry entries remain
  - Test that when uninstaller completes, all registry entries at HKLM\SOFTWARE\Tabeza\TabezaConnect are removed (from Bug Condition in design)
  - The test assertions should match the Expected Behavior Properties from design: registry keys completely removed, clean slate for reinstallation
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found: "User uninstalls via Control Panel → files deleted → registry keys remain → reinstall reads old config"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 6.1, 6.2_

- [x] 6.2 Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Normal Installation Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs: fresh installation creates registry keys and config files correctly
  - Write property-based test: for all fresh installation scenarios, registry keys and config files are created correctly (from Preservation Requirements in design)
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.11, 3.12_

- [x] 6.3 Fix incomplete uninstallation cleanup

  - [x] 6.3.1 Add registry cleanup to [UninstallRun] section
    - Add command: reg delete "HKLM\SOFTWARE\Tabeza\TabezaConnect" /f
    - Run before service deletion
    - Log success/failure
    - _Bug_Condition: isBugCondition_Uninstall(input) where input.uninstallerCompleted == true AND registry.HKLM\SOFTWARE\Tabeza\TabezaConnect exists_
    - _Expected_Behavior: System SHALL remove all registry entries to ensure clean slate for reinstallation_
    - _Preservation: Normal installation must remain unchanged_
    - _Requirements: 2.11, 2.12, 3.11, 3.12_

  - [x] 6.3.2 Add service environment cleanup
    - Delete HKLM:\SYSTEM\CurrentControlSet\Services\TabezaConnect\Environment
    - Ensure clean removal of all service-related registry entries
    - _Requirements: 2.11, 2.12_

  - [x] 6.3.3 Add pre-install cleanup in [Code] section
    - On installer start, check if HKLM\SOFTWARE\Tabeza\TabezaConnect exists
    - If exists, prompt user: "Previous installation detected. Clean up old configuration?"
    - If yes, delete registry keys before proceeding
    - Ensure fresh installation state
    - _Requirements: 2.12_

  - [x] 6.3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Registry Cleaned Up After Uninstall
    - **IMPORTANT**: Re-run the SAME test from task 6.1 - do NOT write a new test
    - The test from task 6.1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 6.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.11, 2.12_

  - [x] 6.3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Normal Installation Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 6.2 - do NOT write new tests
    - Run preservation property tests from step 6.2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.11, 3.12_

- [x] 6.4 Checkpoint - Ensure all Bug 6 tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Final Checkpoint

- [x] 7. Final verification - Ensure all tests pass across all 6 bugs
  - Run complete test suite for all 6 bugs
  - Verify no regressions in existing functionality
  - Confirm all bug condition tests pass (bugs are fixed)
  - Confirm all preservation tests pass (no regressions)
  - Ask the user if questions arise.
