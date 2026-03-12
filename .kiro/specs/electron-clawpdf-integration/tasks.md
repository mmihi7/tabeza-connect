# Implementation Plan: Electron App clawPDF Integration

## Overview

This plan migrates the Tabeza Connect Electron application from Windows printer pooling detection to clawPDF virtual printer detection. The implementation follows a 4-phase migration strategy to ensure zero downtime and backward compatibility during the transition.

## Migration Phases

1. **Phase 1 (Week 1):** Add clawPDF detection alongside existing printer pooling
2. **Phase 2 (Week 2):** Update UI components to display clawPDF status
3. **Phase 3 (Week 3):** Add Printer Setup Wizard with auto-completion
4. **Phase 4 (Week 4):** Remove legacy printer pooling code

## Tasks

### Phase 1: Add clawPDF Detection (Week 1)

- [x] 1. Create clawPDF Detector Module
  - [x] 1.1 Create src/utils/clawpdf-detector.js with ClawPDFDetector class
    - Implement constructor with cache initialization (30-second duration)
    - Export ClawPDFDetector class
    - _Requirements: 8.1, 8.6_
  
  - [x] 1.2 Implement checkClawPDFInstallation() method
    - Read registry key HKLM\SOFTWARE\clawSoft\clawPDF
    - Extract version from registry
    - Return {installed: boolean, version: string|null}
    - Handle registry access errors gracefully
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 8.2_
  
  - [x] 1.3 Implement checkPrinterProfile() method
    - Check file exists: C:\ProgramData\clawSoft\clawPDF\Profiles\Tabeza POS Printer.ini
    - Read and parse INI file format
    - Validate profile configuration structure
    - Return {exists: boolean, configPath: string|null, valid: boolean}
    - Handle file read errors
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 8.3_
  
  - [x] 1.4 Implement verifySpoolFolder() method
    - Read AutoSaveDirectory setting from profile
    - Verify path equals C:\TabezaPrints\spool\
    - Check folder exists on file system
    - Test write permissions with temporary file
    - Return {configured: boolean, path: string|null, exists: boolean, writable: boolean}
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.4_
  
  - [x] 1.5 Implement getFullPrinterStatus() method with caching
    - Check cache validity (< 30 seconds old)
    - Return cached result if valid and not bypassed
    - Call checkClawPDFInstallation(), checkPrinterProfile(), verifySpoolFolder()
    - Determine overall status: not_installed | profile_missing | misconfigured | fully_configured
    - Build complete PrinterStatus object with details
    - Cache result with timestamp
    - _Requirements: 8.5, 12.1, 12.2, 12.3, 12.4, 12.5_
  
  - [x] 1.6 Implement validateConfiguration() method
    - Check clawPDF version >= 0.9.0
    - Verify AutoSave enabled in profile
    - Verify output format is PostScript
    - Test spool folder write permissions
    - Return ValidationResult with issues array
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [ ]* 2. Write Unit Tests for clawPDF Detector
  - [ ]* 2.1 Create src/utils/__tests__/clawpdf-detector.test.js
    - Set up test framework (Jest)
    - Create mock helpers for registry and file system
    - _Requirements: Testing Strategy_
  
  - [ ]* 2.2 Write tests for checkClawPDFInstallation()
    - Test when clawPDF is installed with valid version
    - Test when clawPDF is not installed
    - Test registry access denied error
    - Test invalid version format
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [ ]* 2.3 Write tests for checkPrinterProfile()
    - Test when profile exists and is valid
    - Test when profile file is missing
    - Test when profile file is unreadable
    - Test when profile has invalid structure
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [ ]* 2.4 Write tests for verifySpoolFolder()
    - Test when spool folder is correctly configured
    - Test when spool folder path is incorrect
    - Test when spool folder does not exist
    - Test when spool folder is not writable
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  
  - [ ]* 2.5 Write tests for getFullPrinterStatus()
    - Test all status types: not_installed, profile_missing, misconfigured, fully_configured
    - Test cache hit behavior (< 30 seconds)
    - Test cache miss behavior (> 30 seconds)
    - Test bypassCache parameter
    - _Requirements: 8.5, 12.3, 12.4, 12.5_
  
  - [ ]* 2.6 Write tests for validateConfiguration()
    - Test version validation (< 0.9.0, >= 0.9.0)
    - Test AutoSave validation
    - Test output format validation
    - Test permissions validation
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ]* 3. Write Property-Based Tests for clawPDF Detector
  - [ ]* 3.1 Set up fast-check library and test configuration
    - Install fast-check as dev dependency
    - Configure 100 iterations per property test
    - Create test data generators
    - _Requirements: Testing Strategy_
  
  - [ ]* 3.2 Write Property 1: Status Determination Consistency
    - Generate random system states (registry, file system, config)
    - Run detection twice with identical inputs
    - Assert status is identical both times
    - **Property 1: Status Determination Consistency**
    - **Validates: Requirements 1.1, 1.3, 1.4, 2.4, 2.5, 3.5, 3.6**
  
  - [ ]* 3.3 Write Property 2: Detection Completeness
    - Generate random system states
    - Run detection
    - Assert all components checked (registry, profile, spool)
    - **Property 2: Detection Completeness**
    - **Validates: Requirements 1.1, 1.2, 2.1, 2.2, 3.1, 3.2**
  
  - [ ]* 3.4 Write Property 3: Cache Validity
    - Generate random detection results
    - Cache result with timestamp
    - Run getFullPrinterStatus() within 30 seconds
    - Assert cached result returned (unless bypassCache=true)
    - **Property 3: Cache Validity**
    - **Validates: Requirements 12.3, 12.4, 12.5**
  
  - [ ]* 3.5 Write Property 6: Logging Completeness
    - Generate random detection scenarios
    - Run detection and capture logs
    - Assert log entry created with timestamp and details
    - **Property 6: Logging Completeness**
    - **Validates: Requirements 1.5, 4.3, 4.5, 10.2, 11.1, 14.6**
  
  - [ ]* 3.6 Write Property 7: Error Message Actionability
    - Generate random error conditions
    - Trigger errors and capture messages
    - Assert error messages include specific resolution steps
    - **Property 7: Error Message Actionability**
    - **Validates: Requirements 11.2, 11.3, 11.4, 11.5**
  
  - [ ]* 3.7 Write Property 10: Configuration Validation Completeness
    - Generate random fully_configured states
    - Run validation
    - Assert all settings checked (version, AutoSave, format, permissions)
    - **Property 10: Configuration Validation Completeness**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**
  
  - [ ]* 3.8 Write Property 11: Migration Priority
    - Generate system states with both printer pooling and clawPDF
    - Run detection
    - Assert clawPDF status prioritized and migration notice logged
    - **Property 11: Migration Priority**
    - **Validates: Requirements 10.1, 10.2**
  
  - [ ]* 3.9 Write Property 12: Detection Performance
    - Generate random system states
    - Measure detection time
    - Assert completes within 2 seconds
    - Assert does not block UI thread
    - **Property 12: Detection Performance**
    - **Validates: Requirements 12.1, 12.2**

- [x] 4. Integrate clawPDF Detector with Electron Main Process
  - [x] 4.1 Import ClawPDFDetector in src/electron-main.js
    - Add require statement for clawpdf-detector module
    - Initialize detector instance at startup
    - _Requirements: 8.1_
  
  - [x] 4.2 Add clawPDF detection to startup sequence
    - Call getFullPrinterStatus() on app ready
    - Run detection asynchronously (don't block startup)
    - Log detection results
    - Keep existing printer pooling detection (parallel execution)
    - _Requirements: 1.1, 10.1, 12.2_
  
  - [x] 4.3 Add IPC handler for get-printer-status
    - Handle 'get-printer-status' IPC message
    - Return cached status if available
    - _Requirements: 9.1, 12.4_
  
  - [x] 4.4 Add IPC handler for refresh-printer-status
    - Handle 'refresh-printer-status' IPC message
    - Call getFullPrinterStatus(bypassCache=true)
    - Return fresh status
    - _Requirements: 9.6, 12.5_

- [ ] 5. Checkpoint - Verify Phase 1 Complete
  - Ensure all tests pass (unit and property-based)
  - Verify detection runs without errors on development machines
  - Confirm logs show both printer pooling and clawPDF detection
  - Verify no breaking changes to existing functionality

### Phase 2: Update UI Components (Week 2)

- [x] 6. Update Setup State Manager for Auto-Completion
  - [x] 6.1 Add isPrinterStepComplete() method to SetupStateManager
    - Check current state for printer step completion status
    - Return boolean
    - _Requirements: 4.1_
  
  - [x] 6.2 Add markPrinterStepComplete() method to SetupStateManager
    - Update state to mark printer step complete
    - Log completion with reason parameter
    - Emit 'printer-step-completed' event
    - Broadcast state change to all windows
    - _Requirements: 4.2, 4.3, 4.4_
  
  - [x] 6.3 Implement auto-completion logic in electron-main.js
    - When status is fully_configured, check if printer step complete
    - If not complete, call markPrinterStepComplete("auto-detected")
    - If already complete, log no action needed
    - _Requirements: 4.1, 4.2, 4.5_

- [ ]* 7. Write Tests for Setup State Manager Updates
  - [ ]* 7.1 Write unit tests for isPrinterStepComplete()
    - Test when step is complete
    - Test when step is not complete
    - _Requirements: 4.1_
  
  - [ ]* 7.2 Write unit tests for markPrinterStepComplete()
    - Test state update
    - Test event emission
    - Test broadcast to windows
    - _Requirements: 4.2, 4.3, 4.4_
  
  - [ ]* 7.3 Write Property 4: Auto-Completion Idempotency
    - Generate fully_configured status
    - Mark step complete
    - Attempt to mark complete again
    - Assert step not marked twice
    - **Property 4: Auto-Completion Idempotency**
    - **Validates: Requirements 4.2, 4.5**
  
  - [ ]* 7.4 Write Property 14: Setup Step Auto-Completion
    - Generate transition to fully_configured status
    - Assert printer step marked complete if not already
    - Assert state change broadcast
    - **Property 14: Setup Step Auto-Completion**
    - **Validates: Requirements 4.1, 4.2, 4.4**

- [ ] 8. Update System Tray Icon
  - [ ] 8.1 Update tray icon color logic in src/tray/tray-app.js
    - Map printer status to icon colors: not_installed→grey, profile_missing→orange, misconfigured→orange, fully_configured+running→green, error→red
    - Update icon when printer status changes
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ] 8.2 Update tray icon tooltip
    - Build tooltip with status message, version, profile status, spool status
    - Update tooltip when status changes
    - _Requirements: 5.5_
  
  - [ ] 8.3 Add "Configure Printer" menu item
    - Show menu item when status is not fully_configured
    - Open printer setup wizard when clicked
    - _Requirements: 5.5_
  
  - [ ] 8.4 Listen for printer status updates
    - Subscribe to printer-status-updated events
    - Update icon and tooltip immediately
    - _Requirements: 15.5_

- [ ]* 9. Write Tests for System Tray Updates
  - [ ]* 9.1 Write unit tests for icon color mapping
    - Test all status types map to correct colors
    - Test service error overrides to red
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ]* 9.2 Write unit tests for tooltip updates
    - Test tooltip format for each status type
    - Test tooltip includes all required information
    - _Requirements: 5.5_
  
  - [ ]* 9.3 Write Property 5: Tray Icon State Consistency
    - Generate random printer and service statuses
    - Update tray icon
    - Assert icon color matches expected mapping
    - **Property 5: Tray Icon State Consistency**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [ ] 10. Update Management UI
  - [ ] 10.1 Add printer status section to src/public/management-ui.html
    - Add HTML structure for printer status display
    - Include fields: installation status, version, profile status, spool folder, last print job
    - Add "Refresh Status" button
    - Add "Configure Printer" button
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6_
  
  - [ ] 10.2 Add printer status styles to src/public/css/management-ui.css
    - Style status section with grid layout
    - Add status indicator colors (success, warning, error)
    - Style buttons
    - _Requirements: 9.2, 9.3, 9.4_
  
  - [ ] 10.3 Add migration notice HTML (conditional display)
    - Add migration notice section with warning styling
    - Include "Install clawPDF" button
    - Include "View Migration Guide" link
    - Hide by default
    - _Requirements: 10.3, 10.4_
  
  - [ ] 10.4 Implement printer status display logic in src/public/js/management-ui.js
    - Request printer status via IPC on page load
    - Update UI elements with status data
    - Format status values with appropriate classes
    - Show/hide migration notice based on detection
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ] 10.5 Implement refresh button handler
    - Listen for refresh button click
    - Call refresh-printer-status IPC
    - Update UI with fresh status
    - _Requirements: 9.6, 12.5_
  
  - [ ] 10.6 Listen for real-time printer status updates
    - Subscribe to printer-status-updated IPC events
    - Update UI automatically when status changes
    - _Requirements: 15.2, 15.4_

- [ ]* 11. Write Tests for Management UI Updates
  - [ ]* 11.1 Write unit tests for status display logic
    - Test UI updates for each status type
    - Test field formatting and classes
    - Test migration notice visibility
    - _Requirements: 9.2, 9.3, 9.4, 9.5_
  
  - [ ]* 11.2 Write unit tests for IPC communication
    - Test get-printer-status request
    - Test refresh-printer-status request
    - Test printer-status-updated event handling
    - _Requirements: 9.1, 9.6, 15.4_
  
  - [ ]* 11.3 Write Property 13: IPC Status Delivery
    - Generate random printer statuses
    - Request status via IPC
    - Assert valid PrinterStatus object returned
    - **Property 13: IPC Status Delivery**
    - **Validates: Requirements 9.1**
  
  - [ ]* 11.4 Write Property 8: Broadcast Consistency
    - Generate printer status change
    - Broadcast update
    - Measure time to window update
    - Assert update received within 100ms
    - **Property 8: Broadcast Consistency**
    - **Validates: Requirements 15.2, 15.4, 15.5**

- [ ] 12. Checkpoint - Verify Phase 2 Complete
  - Ensure all UI components display clawPDF status correctly
  - Verify system tray icon reflects status accurately
  - Confirm IPC communication working
  - Test real-time updates with multiple windows open
  - Verify migration notice displays when appropriate

### Phase 3: Add Printer Setup Wizard (Week 3)

- [ ] 13. Create Printer Setup Wizard UI
  - [ ] 13.1 Create src/setup-wizard/printer-setup.html
    - Create wizard HTML structure with 5 steps
    - Step 1: Check current status
    - Step 2: Installation check
    - Step 3: Profile configuration
    - Step 4: Spool folder setup
    - Step 5: Test print
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ] 13.2 Add wizard styles to printer-setup.css
    - Style wizard steps with progress indicator
    - Style instruction sections
    - Style success/error messages
    - Style buttons
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ] 13.3 Implement wizard navigation logic
    - Show/hide steps based on current status
    - Skip completed steps
    - Provide next/back buttons
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 14. Implement Wizard Step Logic
  - [ ] 14.1 Implement Step 1: Check current status
    - Request printer status via IPC
    - Display current status
    - If fully_configured, show success and exit
    - Otherwise, continue to Step 2
    - _Requirements: 6.1_
  
  - [ ] 14.2 Implement Step 2: Installation check
    - Check if clawPDF installed
    - If not installed, display installation instructions
    - Provide download link to clawPDF
    - Poll for installation completion
    - Continue to Step 3 when installed
    - _Requirements: 6.2_
  
  - [ ] 14.3 Implement Step 3: Profile configuration
    - Check if profile exists
    - If not, display profile creation instructions
    - Provide configuration template
    - Poll for profile creation
    - Continue to Step 4 when profile exists
    - _Requirements: 6.3_
  
  - [ ] 14.4 Implement Step 4: Spool folder setup
    - Check if spool folder configured
    - If not, display instructions
    - Offer automatic folder creation button
    - Create folder with correct permissions if requested
    - Update profile configuration
    - Continue to Step 5 when configured
    - _Requirements: 6.3_
  
  - [ ] 14.5 Implement Step 5: Test print
    - Display "Send Test Print" button
    - Show test print instructions
    - Continue to test print implementation
    - _Requirements: 6.4, 6.5, 6.6_

- [ ] 15. Implement Test Print Functionality
  - [ ] 15.1 Create test receipt generator
    - Generate test receipt with sample data
    - Header: "TABEZA TEST RECEIPT"
    - Sample items with quantities and prices
    - Total calculation
    - Footer: "This is a test print"
    - _Requirements: 13.2_
  
  - [ ] 15.2 Implement print job submission
    - Format test receipt as ESC/POS commands
    - Send to "Tabeza POS Printer" via Windows printing API
    - Log print job submission
    - _Requirements: 13.2, 13.3_
  
  - [ ] 15.3 Implement spool folder monitoring
    - Start watching C:\TabezaPrints\spool\ for new files
    - Set 5-second timeout
    - Detect when test print file appears
    - _Requirements: 13.4_
  
  - [ ] 15.4 Implement test print result handling
    - If file appears within 5 seconds, display success message
    - If timeout, display error with troubleshooting steps
    - If file empty, display specific error
    - Provide "Retry" and "View Logs" buttons
    - _Requirements: 13.5, 13.6_

- [ ]* 16. Write Tests for Printer Setup Wizard
  - [ ]* 16.1 Write unit tests for wizard navigation
    - Test step progression based on status
    - Test skip logic for completed steps
    - Test next/back button behavior
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ]* 16.2 Write unit tests for test receipt generator
    - Test receipt format
    - Test data structure
    - Test ESC/POS encoding
    - _Requirements: 13.2_
  
  - [ ]* 16.3 Write unit tests for file monitoring
    - Test file detection within timeout
    - Test timeout handling
    - Test empty file detection
    - _Requirements: 13.4, 13.5, 13.6_
  
  - [ ]* 16.4 Write Property 9: Test Print Round-Trip
    - Generate test print
    - Send to fully_configured printer
    - Monitor spool folder
    - Assert file appears within 5 seconds
    - **Property 9: Test Print Round-Trip**
    - **Validates: Requirements 13.2, 13.3, 13.4, 13.5, 13.6**

- [ ] 17. Integrate Wizard with Setup State Manager
  - [ ] 17.1 Call markPrinterStepComplete() on successful test print
    - After test print succeeds, mark printer step complete
    - Pass reason: "wizard-completed"
    - _Requirements: 4.2_
  
  - [ ] 17.2 Update wizard to reflect completion status
    - Show completion message
    - Update system tray icon
    - Broadcast status update
    - _Requirements: 4.4, 15.5_

- [ ] 18. Add Real-Time Status Sync to Wizard
  - [ ] 18.1 Implement window focus detection
    - Listen for wizard window focus events
    - Request fresh printer status when focused
    - _Requirements: 15.1_
  
  - [ ] 18.2 Listen for printer status broadcasts
    - Subscribe to printer-status-updated events
    - Update wizard display automatically
    - Advance to next step if status changed
    - _Requirements: 15.2, 15.3_

- [ ]* 19. Write Integration Tests for Wizard Flow
  - [ ]* 19.1 Write end-to-end wizard flow test
    - Start wizard with not_installed status
    - Mock installation
    - Mock profile creation
    - Mock spool folder setup
    - Send test print
    - Verify completion
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [ ]* 19.2 Write test for auto-completion flow
    - Mock fully_configured status
    - Start app with incomplete printer step
    - Verify detection runs
    - Verify printer step marked complete
    - Verify tray icon updates
    - Verify broadcast sent
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 20. Checkpoint - Verify Phase 3 Complete
  - Ensure wizard guides through all setup steps correctly
  - Verify test print functionality works end-to-end
  - Confirm auto-completion marks step complete
  - Test real-time status updates in wizard
  - Verify success/error messages display correctly

### Phase 4: Remove Legacy Printer Pooling Code (Week 4)

- [x] 21. Remove Printer Pooling Detection Code
  - [x] 21.1 Remove printer-pooling-setup.ps1 references from electron-main.js
    - Remove require/import statements
    - Remove function calls to PowerShell script
    - _Requirements: 7.1_
  
  - [x] 21.2 Remove autoDetectPrinterSetup function
    - Delete function definition
    - Remove all calls to function
    - _Requirements: 7.2_
  
  - [x] 21.3 Replace with clawPDF detector calls
    - Ensure clawPDF detector is sole detection method
    - Remove parallel execution logic
    - _Requirements: 7.3_
  
  - [x] 21.4 Remove printer pooling configuration checks
    - Remove any code checking for printer pooling setup
    - Remove printer pooling status variables
    - _Requirements: 7.4_

- [ ] 22. Delete Legacy Files
  - [ ] 22.1 Delete src/installer/printer-pooling-setup.ps1
    - Remove file from repository
    - _Requirements: 7.1_
  
  - [ ] 22.2 Delete src/installer/printer-pooling-setup-new.ps1
    - Remove file from repository
    - _Requirements: 7.1_

- [ ] 23. Update Documentation and Comments
  - [ ] 23.1 Update code comments to reference clawPDF
    - Search for "printer pooling" in comments
    - Replace with clawPDF references
    - _Requirements: 7.5_
  
  - [ ] 23.2 Update README.md
    - Remove printer pooling setup instructions
    - Add clawPDF setup instructions
    - Update troubleshooting section
    - _Requirements: 7.5_
  
  - [ ] 23.3 Update architecture documentation
    - Update component diagrams
    - Document clawPDF detector API
    - Remove printer pooling references
    - _Requirements: 7.5_

- [ ] 24. Update Installer
  - [ ] 24.1 Remove printer pooling printer creation from installer
    - Remove PowerShell script calls
    - Remove printer pooling configuration steps
    - _Requirements: 7.1_
  
  - [ ] 24.2 Add clawPDF installation check to installer
    - Check if clawPDF installed before proceeding
    - Display installation instructions if not installed
    - _Requirements: 6.2_

- [ ]* 25. Write Tests for Legacy Code Removal
  - [ ]* 25.1 Verify no printer pooling references remain
    - Search codebase for "printer-pooling"
    - Search codebase for "autoDetectPrinterSetup"
    - Assert no matches found
    - _Requirements: 7.1, 7.2, 7.4_
  
  - [ ]* 25.2 Write Property 15: Backward Compatibility
    - Mock system with only printer pooling (no clawPDF)
    - Start app
    - Assert app continues to function
    - Assert migration prompt displayed
    - **Property 15: Backward Compatibility**
    - **Validates: Requirements 10.3, 10.4, 10.5**
  
  - [ ]* 25.3 Run full test suite
    - Run all unit tests
    - Run all property-based tests
    - Run all integration tests
    - Assert all tests pass
    - _Requirements: All_

- [ ] 26. Final Checkpoint - Verify Phase 4 Complete
  - Ensure no references to printer-pooling-setup.ps1 remain
  - Verify autoDetectPrinterSetup function removed
  - Confirm comments updated to reference clawPDF
  - Verify installer updated
  - Run full test suite and confirm all tests pass
  - Test on clean Windows installation

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests validate universal correctness properties using fast-check (100 iterations)
- Unit tests validate specific examples and edge cases
- Checkpoints ensure incremental validation at the end of each phase
- The 4-phase migration strategy ensures zero downtime and backward compatibility
- Phase 4 should only begin after Phases 1-3 are fully validated in production
