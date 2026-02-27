# Implementation Plan: TabezaConnect Tray App Conversion

## Overview

This plan converts TabezaConnect from a Windows Service (Session 0) to a System Tray Application (Session 1) using a minimal-change wrapper pattern. The conversion resolves Session 0 isolation issues (Error 1053 timeout, USB printer access) while preserving 100% of existing service logic.

**Implementation Language**: JavaScript (Node.js)

**Core Strategy**: Wrapper pattern - add tray functionality without modifying core service code (index.js, final-bridge.js remain untouched).

**Timeline**: 9-13 days across 5 phases

## Tasks

- [x] 1. Phase 1: Tray Wrapper Development (2-3 days)
  - [x] 1.1 Create tray application entry point
    - Create `src/tray/main.js` as the new application entry point
    - Import and start existing service (`src/service/index.js`)
    - Add command-line argument parsing for `--minimized` flag
    - Verify service starts correctly when imported
    - _Requirements: 14.1, 14.5_
  
  - [x] 1.2 Implement tray icon management
    - Create `src/tray/tray-app.js` with TrayApp class
    - Implement `createTrayIcon()` method using node-systray or Electron
    - Create icon assets (icon-green.ico, icon-yellow.ico, icon-red.ico)
    - Implement `updateTrayIcon(status)` method for state changes
    - Add tooltip display with status text
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 1.3 Implement application state management
    - Define ApplicationState enum (STARTING, CONNECTED, UNCONFIGURED, DISCONNECTED, ERROR, SHUTTING_DOWN)
    - Implement state transition logic with validation
    - Add state-to-icon-color mapping
    - Add state-to-tooltip-text mapping
    - Implement state change event handlers
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [x] 1.4 Create context menu with basic options
    - Implement `createContextMenu()` method
    - Add menu items: Open Configuration, Open Staff Dashboard, Test Print, View Logs, Restart Service, About, Exit
    - Implement menu item click handlers
    - Add dynamic menu item enabling/disabling based on state
    - Display Bar ID and connection status in menu header
    - _Requirements: 2.7, 2.8_
  
  - [x] 1.5 Implement graceful shutdown handling
    - Implement `handleExit()` method in TrayApp
    - Stop Express server cleanly
    - Stop folder monitor (Chokidar)
    - Flush pending cloud uploads
    - Remove tray icon
    - Ensure shutdown completes within 5 seconds
    - Add "Shutting down..." tooltip during shutdown
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_
  
  - [ ]* 1.6 Write unit tests for tray wrapper
    - Test state transitions (STARTING → CONNECTED, STARTING → ERROR)
    - Test icon color updates on state changes
    - Test tooltip text accuracy for each state
    - Test context menu creation and item enabling
    - Test graceful shutdown sequence
    - _Requirements: 6.4, 6.5, 9.6_

- [-] 2. Phase 2: Window Management (1-2 days)
  - [-] 2.1 Create status window UI
    - Create HTML/CSS for status window (500x400px, non-resizable)
    - Display connection status, Bar ID, API URL, Driver ID
    - Show service information (port, capture mode, watch folder, printer)
    - Display last activity timestamp and receipts processed count
    - Add buttons: Open Configuration, Test Print, OK
    - _Requirements: 6.6_
  
  - [ ] 2.2 Implement window show/hide behavior
    - Implement `showWindow()` method to display status window
    - Implement `hideWindow()` method to hide to tray
    - Handle single-click on tray icon → show window
    - Handle double-click on tray icon → show window
    - Ensure window doesn't show taskbar button when hidden
    - _Requirements: 2.6, 3.3_
  
  - [ ] 2.3 Handle minimize and close to tray
    - Intercept minimize button click → hide to tray
    - Intercept close button (X) click → hide to tray (not exit)
    - Ensure "Exit" from context menu is the only way to terminate
    - Prevent window from appearing in taskbar when minimized
    - _Requirements: 3.1, 3.2, 3.4_
  
  - [ ] 2.4 Implement real-time status updates in window
    - Update status display when state changes
    - Update last activity timestamp on receipt processing
    - Update receipts processed counter
    - Refresh service information when configuration changes
    - _Requirements: 6.6_
  
  - [ ]* 2.5 Write integration tests for window management
    - Test window shows on tray click
    - Test minimize hides to tray (no taskbar)
    - Test close (X) hides to tray
    - Test Exit from menu terminates completely
    - Test status updates reflect in window
    - _Requirements: 3.1, 3.2, 3.4_

- [ ] 3. Checkpoint - Verify tray app functionality
  - Ensure tray icon appears and updates correctly
  - Verify context menu works and all options respond
  - Test window show/hide/minimize behavior
  - Confirm service starts and runs normally
  - Ensure graceful shutdown works
  - Ask the user if questions arise.

- [ ] 4. Phase 3: Auto-Start Integration (1 day)
  - [ ] 4.1 Implement --minimized command-line flag
    - Parse `--minimized` argument in main.js
    - Set startup mode flag when --minimized is present
    - Skip window display when launched with --minimized
    - Start directly in system tray when minimized
    - Suppress console window when minimized
    - _Requirements: 4.2, 4.4, 4.5_
  
  - [ ] 4.2 Implement startup detection logic
    - Detect if launched via auto-start (check for --minimized flag)
    - Set initial state to STARTING when auto-started
    - Transition to CONNECTED when service ready
    - Show notification "TabezaConnect started" on successful startup
    - _Requirements: 4.3, 13.1_
  
  - [ ] 4.3 Test auto-start behavior
    - Manually test launching with --minimized flag
    - Verify no window appears on startup
    - Verify tray icon appears immediately
    - Verify no console window visible
    - Verify no splash screen shown
    - _Requirements: 4.4, 4.5, 4.6_
  
  - [ ]* 4.4 Write property test for startup modes
    - **Property 15: Command-line argument support**
    - **Validates: Requirements 12.7**
    - Test that --minimized flag starts app in tray without window
    - Test that no flag shows window normally
    - Test that invalid flags are ignored gracefully

- [-] 5. Phase 4: Installer Conversion (2-3 days)
  - [x] 5.1 Remove Windows Service registration code
    - Remove service installation code from Inno Setup script
    - Remove service configuration sections
    - Remove service start/stop commands
    - Clean up service-related registry entries
    - _Requirements: 8.1_
  
  - [ ] 5.2 Add registry Run key creation
    - Add code to create HKCU\Software\Microsoft\Windows\CurrentVersion\Run entry
    - Set entry name to "TabezaConnect"
    - Set entry value to executable path with --minimized flag
    - Ensure entry is created during installation
    - _Requirements: 4.1, 8.3_
  
  - [ ] 5.3 Implement old service detection and removal
    - Add Pascal function `IsServiceInstalled()` to check for existing service
    - Implement service stop logic (sc stop TabezaConnect)
    - Implement service deletion logic (sc delete TabezaConnect)
    - Add 2-second delay after service stop before deletion
    - _Requirements: 8.5_
  
  - [ ] 5.4 Implement configuration preservation during upgrade
    - Detect existing config.json at C:\ProgramData\Tabeza\config.json
    - Create backup of config.json before service removal
    - Preserve config.json in same location for tray app to read
    - Verify config format compatibility between versions
    - _Requirements: 8.4, 8.6, 12.1_
  
  - [ ] 5.5 Add desktop shortcut option
    - Add checkbox in installer for desktop shortcut creation
    - Make desktop shortcut optional (user-selectable)
    - Create shortcut pointing to TabezaConnect.exe (without --minimized)
    - _Requirements: 8.7_
  
  - [ ] 5.6 Implement post-installation launch
    - Launch TabezaConnect.exe with --minimized flag after installation
    - Verify app starts in system tray
    - Show completion message with instructions to look for tray icon
    - _Requirements: 8.8_
  
  - [ ] 5.7 Update file installation paths
    - Copy files to C:\Program Files\Tabeza\TabezaConnect\
    - Include TabezaConnect.exe, assets, src folders
    - Preserve existing folder structure
    - Create uninstaller entry in registry
    - _Requirements: 8.2_
  
  - [ ]* 5.8 Write integration test for upgrade path
    - Install service version (v1.6.2)
    - Configure with test Bar ID
    - Install tray app version
    - Verify service removed (sc query returns not found)
    - Verify config preserved and loaded by tray app
    - Verify tray app uses preserved configuration
    - _Requirements: 8.5, 8.6, 12.4_

- [ ] 6. Checkpoint - Verify installer functionality
  - Test fresh installation on clean Windows VM
  - Test upgrade from service version
  - Verify registry entry created correctly
  - Confirm config preservation during upgrade
  - Test auto-start after Windows restart
  - Ask the user if questions arise.

- [ ] 7. Phase 5: Testing & Validation (3-4 days)
  - [ ] 7.1 Implement configuration validation
    - Validate Bar ID format (non-empty, minimum length)
    - Validate API URL format (valid HTTPS URL)
    - Validate printer selection (verify printer accessible via Get-Printer)
    - Reject invalid values with specific error messages
    - _Requirements: 7.7, 5.6_
  
  - [ ] 7.2 Implement error handling for port conflicts
    - Detect port 8765 already in use (EADDRINUSE error)
    - Display error notification with resolution steps
    - Update tray icon to red
    - Provide "Kill Port" option in context menu or error message
    - _Requirements: 11.1_
  
  - [ ] 7.3 Implement offline queue and retry logic
    - Queue receipts locally when cloud connectivity lost
    - Retry cloud upload every 30 seconds
    - Upload all queued receipts when connectivity restored
    - Show warning notification after 5 minutes offline
    - _Requirements: 11.2, 11.3, 11.6_
  
  - [ ] 7.4 Implement printer error handling
    - Continue cloud upload when physical printer unavailable
    - Log printer errors without blocking
    - Show warning notification for printer issues (rate-limited)
    - Auto-retry printer detection every 30 seconds
    - _Requirements: 11.4_
  
  - [ ] 7.5 Implement folder monitor auto-recovery
    - Catch folder monitor exceptions
    - Automatically restart monitor on error
    - Log restart events
    - Don't show notification for automatic recoveries
    - _Requirements: 11.7_
  
  - [ ] 7.6 Implement notification rate limiting
    - Track notification timestamps
    - Enforce maximum 1 notification per minute
    - Queue notifications if rate exceeded
    - Prioritize: Error > Warning > Info
    - _Requirements: 13.7_
  
  - [ ]* 7.7 Write property test for API endpoint preservation
    - **Property 1: API endpoint preservation**
    - **Validates: Requirements 1.1, 1.8, 12.2**
    - Test all endpoints (/api/status, /api/configure, /api/test-print, /api/printers/*)
    - Verify response structure matches service version
    - Run 100 iterations with fast-check
  
  - [ ]* 7.8 Write property test for receipt processing consistency
    - **Property 2: Receipt processing consistency**
    - **Validates: Requirements 1.2, 1.4, 1.5**
    - Generate random receipt data
    - Verify both cloud upload AND printer forwarding occur
    - Verify file deleted after processing
    - Run 100 iterations with fast-check
  
  - [ ]* 7.9 Write property test for configuration round-trip
    - **Property 3: Configuration format compatibility**
    - **Validates: Requirements 1.6, 7.6, 12.1**
    - Generate random valid config objects
    - Save config, load config, verify identical
    - Test with service version config format
    - Run 100 iterations with fast-check
  
  - [ ]* 7.10 Write property test for printer forwarding preservation
    - **Property 4: Printer forwarding preservation**
    - **Validates: Requirements 1.3, 14.2**
    - Verify final-bridge.js is used without modification
    - Test all three forwarding strategies (TCP, USB, Spooler)
    - Verify same behavior as service version
    - Run 100 iterations with fast-check
  
  - [ ]* 7.11 Write property test for Session 1 printer access
    - **Property 5: Session 1 printer access**
    - **Validates: Requirements 5.2, 5.3, 5.4**
    - Detect USB printers in Session 1
    - Send test data to USB printer
    - Verify no "local comm error" occurs
    - Run 100 iterations with fast-check
  
  - [ ]* 7.12 Write property test for tray icon state consistency
    - **Property 6: Tray icon state consistency**
    - **Validates: Requirements 6.4**
    - Test all state transitions
    - Verify icon color updates immediately
    - Verify correct color for each state
    - Run 100 iterations with fast-check
  
  - [ ]* 7.13 Write property test for tooltip accuracy
    - **Property 7: Tooltip status accuracy**
    - **Validates: Requirements 6.5**
    - Test all application states
    - Verify tooltip text matches state
    - Verify tooltip updates on state change
    - Run 100 iterations with fast-check
  
  - [ ]* 7.14 Write property test for configuration persistence
    - **Property 8: Configuration persistence**
    - **Validates: Requirements 7.4, 7.5**
    - Save configuration changes
    - Verify config.json updated
    - Verify Express server restarts with new settings
    - Run 100 iterations with fast-check
  
  - [ ]* 7.15 Write property test for configuration validation
    - **Property 9: Configuration validation**
    - **Validates: Requirements 7.7**
    - Test invalid Bar IDs (empty, too short)
    - Test invalid URLs (malformed, non-HTTPS)
    - Test inaccessible printers
    - Verify rejection with error messages
    - Run 100 iterations with fast-check
  
  - [ ]* 7.16 Write property test for offline queue behavior
    - **Property 10: Offline queue behavior**
    - **Validates: Requirements 11.2, 11.3**
    - Simulate network disconnection
    - Verify receipts queued locally
    - Simulate network restoration
    - Verify queued receipts uploaded
    - Run 100 iterations with fast-check
  
  - [ ]* 7.17 Write property test for error isolation
    - **Property 11: Error isolation**
    - **Validates: Requirements 11.4**
    - Simulate printer unavailable
    - Verify cloud upload continues successfully
    - Verify printer error doesn't block cloud
    - Run 100 iterations with fast-check
  
  - [ ]* 7.18 Write property test for monitor auto-recovery
    - **Property 12: Monitor auto-recovery**
    - **Validates: Requirements 11.7**
    - Simulate folder monitor error
    - Verify monitor restarts automatically
    - Verify no user intervention required
    - Run 100 iterations with fast-check
  
  - [ ]* 7.19 Write property test for path compatibility
    - **Property 13: Path compatibility**
    - **Validates: Requirements 12.3**
    - Verify watch folder path identical (C:\TabezaPrints\)
    - Verify config location identical (C:\ProgramData\Tabeza\config.json)
    - Verify log location identical (C:\ProgramData\Tabeza\logs\)
    - Run 100 iterations with fast-check
  
  - [ ]* 7.20 Write property test for POS configuration compatibility
    - **Property 14: POS configuration compatibility**
    - **Validates: Requirements 12.6**
    - Test with existing POS folder port configuration
    - Verify receipts captured from C:\TabezaPrints\
    - Verify processing identical to service version
    - Run 100 iterations with fast-check
  
  - [ ]* 7.21 Write property test for notification rate limiting
    - **Property 16: Notification rate limiting**
    - **Validates: Requirements 13.7**
    - Generate rapid sequence of notification events
    - Verify maximum 1 notification per minute displayed
    - Verify queuing and prioritization works
    - Run 100 iterations with fast-check
  
  - [ ]* 7.22 Write property test for core logic preservation
    - **Property 17: Core logic preservation**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.7**
    - Compare index.js before and after conversion
    - Compare final-bridge.js before and after conversion
    - Compare spoolMonitor.js before and after conversion
    - Verify zero modifications to core files
    - Run file hash comparison
  
  - [ ]* 7.23 Write property test for printer selection validation
    - **Property 18: Printer selection validation**
    - **Validates: Requirements 5.6**
    - Test printer selection in configuration
    - Verify Get-Printer check before saving
    - Verify inaccessible printers rejected
    - Run 100 iterations with fast-check

- [ ] 8. Integration testing - Fresh installation flow
  - Install tray app on clean Windows 10 VM
  - Verify registry entry created
  - Verify files copied to Program Files
  - Launch app and verify tray icon appears
  - Configure Bar ID and verify service starts
  - Send test receipt and verify processing
  - _Requirements: 8.1, 8.2, 8.3, 8.8_

- [ ] 9. Integration testing - Upgrade from service flow
  - Install service version v1.6.2 on clean VM
  - Configure with test Bar ID and verify working
  - Install tray app version over service
  - Verify service removed (sc query returns not found)
  - Verify config preserved and loaded
  - Verify tray app uses preserved config
  - Send test receipt and verify processing
  - _Requirements: 8.4, 8.5, 8.6, 12.1, 12.4_

- [ ] 10. Integration testing - Auto-start flow
  - Install tray app on clean VM
  - Restart Windows
  - Log in as user
  - Verify app launches automatically
  - Verify starts minimized to tray (no window)
  - Verify no console window visible
  - Verify tray icon appears with correct status
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 11. Integration testing - Receipt processing flow
  - Start tray app with valid configuration
  - Drop test receipt file in C:\TabezaPrints\
  - Verify cloud upload occurs (check logs)
  - Verify physical print occurs (if printer configured)
  - Verify file deleted after processing
  - Verify receipts processed counter increments
  - _Requirements: 1.2, 1.4, 1.5_

- [ ] 12. Integration testing - Error recovery flow
  - Start tray app with valid configuration
  - Disconnect network (disable adapter)
  - Drop receipt file in watch folder
  - Verify receipt queued locally (check logs)
  - Reconnect network (enable adapter)
  - Verify queued receipt uploaded within 30 seconds
  - Verify warning notification shown after 5 minutes offline
  - _Requirements: 11.2, 11.3, 11.6_

- [ ] 13. Integration testing - Printer access flow
  - Start tray app in Session 1 (user logged in)
  - Connect USB thermal printer
  - Configure printer in settings
  - Send test print via context menu
  - Verify print succeeds without "local comm error"
  - Check logs for successful print confirmation
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 14. Integration testing - Port conflict handling
  - Start first instance of tray app
  - Attempt to start second instance
  - Verify second instance detects port conflict
  - Verify error notification displayed
  - Verify red tray icon shown
  - Verify resolution steps provided
  - _Requirements: 11.1_

- [ ] 15. Integration testing - Configuration management
  - Open configuration UI from context menu
  - Change Bar ID to new value
  - Save configuration
  - Verify config.json updated
  - Verify Express server restarted
  - Verify new Bar ID used in heartbeat
  - Test invalid values (empty Bar ID, bad URL)
  - Verify validation errors shown
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.7_

- [ ] 16. Final checkpoint - Complete testing validation
  - Review all test results (unit, property, integration)
  - Verify all 18 correctness properties pass
  - Confirm zero modifications to core service files
  - Verify performance benchmarks met (< 5s startup, < 100MB RAM)
  - Complete manual testing checklist
  - Verify upgrade path works smoothly
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties with 100 iterations each
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows and component interaction
- Core service files (index.js, final-bridge.js, spoolMonitor.js) must remain unchanged
- All file paths must match service version for backward compatibility
- Installer must handle both fresh install and upgrade scenarios
- Auto-start uses registry Run key, not Windows Service
- Session 1 execution resolves USB printer access issues
