# Implementation Plan: Real-Time State Synchronization

## Overview

This implementation plan creates a centralized state management system with real-time broadcast capabilities to ensure all UI windows in Tabeza Connect stay synchronized. The system uses an in-memory cache, IPC broadcast mechanism, window registry, and focus-based sync fallback to maintain consistency across multiple windows.

## Tasks

- [x] 1. Create core State Manager module
  - [x] 1.1 Implement StateManager class with in-memory cache
    - Create `src/lib/state-manager.js` with StateManager class
    - Implement in-memory cache for all state types (setup, config, printer, template, window)
    - Add initialization method to load state from disk on startup
    - _Requirements: Design Section "Architecture" - State Manager component_
  
  - [x] 1.2 Implement state update method with validation
    - Add `updateState(stateType, updates, source)` method
    - Implement deep merge logic for partial updates
    - Add validation for each state type before applying updates
    - Return updated state object
    - _Requirements: Design "Key Functions" - StateManager.updateState()_
  
  - [x] 1.3 Implement state retrieval method
    - Add `getState(stateType)` method
    - Return from in-memory cache (no disk I/O)
    - Support both full state and partial state retrieval
    - Return default state if missing
    - _Requirements: Design "Key Functions" - StateManager.getState()_
  
  - [x] 1.4 Implement state persistence to disk
    - Add `persistState(stateType, state)` method
    - Write to appropriate JSON files (setup-state.json, config.json, window-state.json)
    - Use atomic writes to prevent corruption
    - Handle disk errors gracefully
    - _Requirements: Design "Error Handling" - State Persistence Failure_
  
  - [ ]* 1.5 Write unit tests for StateManager
    - Test state updates with valid data
    - Test state updates with invalid data
    - Test state persistence and loading
    - Test cache behavior
    - _Requirements: Design "Testing Strategy" - State Manager Tests_

- [x] 2. Create Broadcast Manager module
  - [x] 2.1 Implement BroadcastManager class
    - Create `src/lib/broadcast-manager.js` with BroadcastManager class
    - Add method to broadcast state changes to all windows
    - Implement error handling for destroyed windows
    - Log all broadcast operations
    - _Requirements: Design "Key Functions" - BroadcastManager.broadcastStateChange()_
  
  - [x] 2.2 Implement selective broadcast with state diffs
    - Calculate diff between old and new state
    - Include only changed portions in broadcast event
    - Add event type and timestamp to broadcast payload
    - _Requirements: Design "Performance Considerations" - Selective State Updates_
  
  - [ ]* 2.3 Write unit tests for BroadcastManager
    - Test broadcast to single window
    - Test broadcast to multiple windows
    - Test broadcast with destroyed window
    - Test broadcast error handling
    - _Requirements: Design "Testing Strategy" - Broadcast Manager Tests_

- [x] 3. Create Window Registry module
  - [x] 3.1 Implement WindowRegistry class
    - Create `src/lib/window-registry.js` with WindowRegistry class
    - Add `registerWindow(windowId, window)` method
    - Add `unregisterWindow(windowId)` method
    - Add `getAllWindows()` method
    - _Requirements: Design "Key Functions" - WindowRegistry.registerWindow()_
  
  - [x] 3.2 Implement automatic cleanup on window close
    - Listen to window 'closed' event
    - Automatically unregister window when closed
    - Remove destroyed windows during broadcast attempts
    - _Requirements: Design "Error Handling" - Window Registry Corruption_
  
  - [x] 3.3 Implement initial state sync on registration
    - Send current state snapshot to newly registered window
    - Use 'state-sync' IPC event for initial sync
    - _Requirements: Design "Example Usage" - Window registration pattern_
  
  - [ ]* 3.4 Write unit tests for WindowRegistry
    - Test window registration
    - Test window unregistration
    - Test duplicate registration prevention
    - Test automatic cleanup
    - _Requirements: Design "Testing Strategy" - Window Registry Tests_

- [x] 4. Integrate State Manager with main process
  - [x] 4.1 Initialize State Manager in electron-main.js
    - Import StateManager, BroadcastManager, and WindowRegistry
    - Create singleton instances on app startup
    - Load initial state from disk
    - _Requirements: Design "Architecture" - Main Process integration_
  
  - [x] 4.2 Register all windows with Window Registry
    - Register Setup Mode window when created
    - Register Normal Mode window when created
    - Register Printer Wizard window when created
    - Register Template Generator window when created
    - _Requirements: Design "Main Algorithm" - Window registration_
  
  - [x] 4.3 Connect State Manager to Broadcast Manager
    - Call broadcastStateChange after every state update
    - Pass StateChangeEvent with type, data, timestamp, source
    - _Requirements: Design "Main Algorithm" - updateStateAndBroadcast_

- [x] 5. Implement IPC handlers for state operations
  - [x] 5.1 Create IPC handler for get-state
    - Add `ipcMain.handle('get-state', ...)` handler
    - Call StateManager.getState()
    - Return current state to renderer
    - _Requirements: Design "Architecture" - IPC Handlers_
  
  - [x] 5.2 Create IPC handler for save-bar-id
    - Add `ipcMain.handle('save-bar-id', ...)` handler
    - Update config state with new barId
    - Mark setup step as complete
    - Broadcast changes to all windows
    - _Requirements: Design "Example Usage" - User saves Bar ID_
  
  - [x] 5.3 Create IPC handler for setup-printer
    - Add `ipcMain.handle('setup-printer', ...)` handler
    - Run printer setup script
    - Update printer state on success
    - Mark setup step as complete
    - Broadcast changes to all windows
    - _Requirements: Design "Example Usage" - User completes printer setup_
  
  - [x] 5.4 Create IPC handler for save-template
    - Add `ipcMain.handle('save-template', ...)` handler
    - Update template state
    - Mark setup step as complete
    - Broadcast changes to all windows
    - _Requirements: Design "Core Interfaces" - TemplateState_

- [x] 6. Implement focus-based sync fallback
  - [x] 6.1 Add focus event listeners to all windows
    - Listen to 'focus' event on each BrowserWindow
    - Trigger state sync when window gains focus
    - _Requirements: Design "Key Functions" - syncStateOnFocus_
  
  - [x] 6.2 Implement full state sync on focus
    - Get complete current state from StateManager
    - Send 'state-sync' IPC event to focused window
    - Include full state snapshot in event payload
    - _Requirements: Design "Algorithmic Pseudocode" - syncStateOnFocus_

- [x] 7. Update UI renderer processes to handle state events
  - [x] 7.1 Add state-changed event listener in Setup Mode
    - Listen for 'state-changed' IPC event in setup-wizard HTML
    - Update UI components based on state type
    - Update progress tracker when setup steps complete
    - _Requirements: Design "Example Usage" - All UI windows listen_
  
  - [x] 7.2 Add state-changed event listener in Normal Mode
    - Listen for 'state-changed' IPC event in dashboard.html
    - Update Bar ID display when config changes
    - Update printer status when printer state changes
    - Update template status when template state changes
    - _Requirements: Design "Example Usage" - All UI windows listen_
  
  - [x] 7.3 Add state-sync event listener for focus recovery
    - Listen for 'state-sync' IPC event in all UI windows
    - Replace entire displayed state with sync payload
    - Re-render all UI components
    - _Requirements: Design "Property 5" - Focus Sync Guarantee_
  
  - [x] 7.4 Update existing IPC invoke calls to use new handlers
    - Replace direct config updates with save-bar-id handler
    - Replace direct printer updates with setup-printer handler
    - Replace direct template updates with save-template handler
    - _Requirements: Design "Example Usage" - Setup Mode UI calls_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Add error handling and logging
  - [ ] 9.1 Implement error handling for broadcast failures
    - Catch IPC send errors
    - Log errors with window ID and details
    - Continue broadcasting to other windows
    - _Requirements: Design "Error Handling" - Broadcast Failure to Single Window_
  
  - [ ] 9.2 Implement error handling for persistence failures
    - Catch disk write errors
    - Log error details
    - Keep state in memory
    - Return error to caller without broadcasting
    - _Requirements: Design "Error Handling" - State Persistence Failure_
  
  - [ ] 9.3 Add comprehensive logging for state operations
    - Log all state updates with timestamp and source
    - Log all broadcasts with recipient count
    - Log window registration/unregistration
    - Log sync operations on focus
    - _Requirements: Design "Algorithmic Pseudocode" - Logging throughout_

- [ ] 10. Performance optimizations
  - [ ] 10.1 Implement debounced broadcasts for rapid updates
    - Add 50ms debounce timer for state updates
    - Batch multiple rapid updates into single broadcast
    - Cancel pending broadcast if new update arrives
    - _Requirements: Design "Performance Considerations" - Debounced Broadcasts_
  
  - [ ]* 10.2 Add performance monitoring
    - Measure state update latency
    - Measure broadcast time to all windows
    - Log performance metrics
    - Alert if targets exceeded (>10ms update, >50ms broadcast)
    - _Requirements: Design "Performance Considerations" - Performance Targets_

- [ ] 11. Integration testing
  - [ ]* 11.1 Write integration test for complete setup flow
    - Start app in first-run state
    - Open Setup Mode window
    - Save Bar ID and verify Normal Mode shows it
    - Complete printer setup and verify all windows update
    - Generate template and verify all windows show complete
    - _Requirements: Design "Testing Strategy" - Test 1: Complete Setup Flow_
  
  - [ ]* 11.2 Write integration test for multi-window sync
    - Open multiple windows simultaneously
    - Update config in one window
    - Verify all other windows reflect change
    - _Requirements: Design "Testing Strategy" - Test 2: Multi-Window Sync_
  
  - [ ]* 11.3 Write integration test for focus sync recovery
    - Open window A and minimize it
    - Update state from window B
    - Focus window A
    - Verify window A shows updated state
    - _Requirements: Design "Testing Strategy" - Test 3: Focus Sync Recovery_

- [ ] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific design sections for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation uses JavaScript/Node.js with Electron IPC
- State persistence uses JSON files in app.getPath('userData')
- All state operations are asynchronous to prevent blocking
