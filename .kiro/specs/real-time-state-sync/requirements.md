# Requirements Document: Real-Time State Synchronization

## Problem Statement

Tabeza Connect currently suffers from critical state synchronization issues across multiple UI windows. When users make changes in one window (e.g., saving Bar ID in Setup Mode, completing printer setup in Printer Wizard), other open windows do not reflect these changes automatically. This creates a confusing and inconsistent user experience where:

- The dashboard shows outdated Bar ID information after it's been updated in Setup Mode
- Setup progress indicators don't update across windows
- Printer status remains stale in the main window after configuration
- Template status doesn't reflect completion across all UI screens
- Users must manually close and reopen windows to see current state

This lack of real-time synchronization undermines user confidence in the application and creates operational confusion during the critical setup phase.

## Business Goals

### Primary Goals

1. **Eliminate State Inconsistency**: Ensure all UI windows always display the same current state without requiring manual refresh or window reopening
2. **Improve Setup Experience**: Make the multi-step setup process feel cohesive and responsive across all windows
3. **Increase User Confidence**: Provide immediate visual feedback when configuration changes are made
4. **Reduce Support Burden**: Eliminate user confusion and support tickets related to "stale" or "incorrect" information displayed in the UI

### Secondary Goals

1. **Enable Future Multi-Window Features**: Create infrastructure that supports advanced multi-window workflows
2. **Improve Application Reliability**: Implement robust error handling for state operations
3. **Optimize Performance**: Ensure state synchronization doesn't introduce noticeable latency or UI lag

## User Stories

### User Story 1: Setup Wizard Completion Tracking
**As a** venue owner setting up Tabeza Connect for the first time  
**I want** to see my setup progress update in real-time across all windows  
**So that** I can track my completion status regardless of which window I'm viewing

**Acceptance Criteria:**
- When I complete the Bar ID step in Setup Mode, the dashboard immediately shows the Bar ID
- When I complete printer setup in the Printer Wizard, the Setup Mode window shows the printer step as complete
- When I generate a template, all windows immediately reflect the template status
- Progress indicators update within 100ms of completing each step
- No manual refresh or window reopening is required

### User Story 2: Configuration Changes Propagation
**As a** venue administrator managing Tabeza Connect  
**I want** configuration changes to propagate immediately to all open windows  
**So that** I don't see conflicting information across different parts of the application

**Acceptance Criteria:**
- When I update the Bar ID, all windows show the new Bar ID within 100ms
- When I change the API URL, all windows reflect the new URL immediately
- When I modify the watch folder path, all windows display the updated path
- Configuration changes persist across application restarts
- No data loss occurs during configuration updates

### User Story 3: Printer Status Synchronization
**As a** venue staff member monitoring printer status  
**I want** printer status updates to appear in real-time across all windows  
**So that** I can see the current printer state regardless of which window I'm viewing

**Acceptance Criteria:**
- When printer setup completes, all windows show "FullyConfigured" status immediately
- When printer errors occur, all windows display the error state within 100ms
- Printer status updates don't require manual refresh
- Last checked timestamp updates across all windows simultaneously

### User Story 4: Window Focus Recovery
**As a** user who minimizes windows while working  
**I want** windows to automatically sync state when I bring them back into focus  
**So that** I always see current information even if I missed real-time updates

**Acceptance Criteria:**
- When I focus a minimized window, it receives the latest state within 50ms
- State sync happens automatically without user action
- All UI components reflect the current state after focus
- No visual glitches or partial updates occur during sync

### User Story 5: Multi-Window Workflow Support
**As a** venue administrator working with multiple windows open  
**I want** to make changes in any window and see them reflected everywhere  
**So that** I can work efficiently without worrying about which window I'm using

**Acceptance Criteria:**
- Changes made in Setup Mode appear in Normal Mode dashboard immediately
- Changes made in Printer Wizard appear in Setup Mode immediately
- Changes made in Template Generator appear in all other windows immediately
- All windows converge to the same state within 100ms of any update
- No race conditions or data corruption occurs with simultaneous updates

## Functional Requirements

### FR1: Centralized State Management
**Priority:** Critical  
**Description:** The application must maintain a single source of truth for all application state in the main process

**Requirements:**
- FR1.1: State Manager must store all state types in memory (setup, config, printer, template, window)
- FR1.2: State Manager must load initial state from disk on application startup
- FR1.3: State Manager must provide synchronous read access to current state
- FR1.4: State Manager must validate all state updates before applying them
- FR1.5: State Manager must persist state changes to disk atomically

### FR2: Real-Time State Broadcasting
**Priority:** Critical  
**Description:** The application must broadcast state changes to all registered windows in real-time

**Requirements:**
- FR2.1: Broadcast Manager must send state change events to all registered windows via IPC
- FR2.2: Broadcast Manager must include state type, updated data, timestamp, and source in each event
- FR2.3: Broadcast Manager must handle destroyed windows gracefully without throwing errors
- FR2.4: Broadcast Manager must log all broadcast operations for debugging
- FR2.5: Broadcast Manager must complete broadcasts within 50ms for up to 5 windows

### FR3: Window Registry Management
**Priority:** Critical  
**Description:** The application must track all open windows and manage their lifecycle

**Requirements:**
- FR3.1: Window Registry must register windows when they are created
- FR3.2: Window Registry must unregister windows automatically when they close
- FR3.3: Window Registry must send initial state snapshot to newly registered windows
- FR3.4: Window Registry must prevent duplicate window registrations
- FR3.5: Window Registry must clean up destroyed window references automatically

### FR4: IPC State Operations
**Priority:** Critical  
**Description:** The application must provide IPC handlers for all state operations

**Requirements:**
- FR4.1: Must provide `get-state` handler to retrieve current state
- FR4.2: Must provide `save-bar-id` handler to update Bar ID and mark setup step complete
- FR4.3: Must provide `setup-printer` handler to configure printer and mark setup step complete
- FR4.4: Must provide `save-template` handler to update template state and mark setup step complete
- FR4.5: All IPC handlers must return success/error status to caller

### FR5: Focus-Based State Synchronization
**Priority:** High  
**Description:** The application must sync state to windows when they gain focus

**Requirements:**
- FR5.1: Must listen to 'focus' event on all BrowserWindow instances
- FR5.2: Must send complete current state to focused window via 'state-sync' IPC event
- FR5.3: Must complete focus sync within 50ms of focus event
- FR5.4: Must handle focus sync errors gracefully without crashing
- FR5.5: Must log all focus sync operations for debugging

### FR6: UI State Event Handling
**Priority:** Critical  
**Description:** All UI windows must listen for and handle state change events

**Requirements:**
- FR6.1: Setup Mode must listen for 'state-changed' events and update UI accordingly
- FR6.2: Normal Mode must listen for 'state-changed' events and update UI accordingly
- FR6.3: Printer Wizard must listen for 'state-changed' events and update UI accordingly
- FR6.4: Template Generator must listen for 'state-changed' events and update UI accordingly
- FR6.5: All windows must listen for 'state-sync' events and perform full state replacement

### FR7: State Persistence
**Priority:** Critical  
**Description:** The application must persist state changes to disk reliably

**Requirements:**
- FR7.1: Must write setup state to `setup-state.json`
- FR7.2: Must write config state to `config.json`
- FR7.3: Must write window state to `window-state.json`
- FR7.4: Must use atomic writes to prevent file corruption
- FR7.5: Must handle disk write errors gracefully without data loss

### FR8: State Validation
**Priority:** High  
**Description:** The application must validate all state updates before applying them

**Requirements:**
- FR8.1: Must validate state type is one of: setup, config, printer, template, window
- FR8.2: Must validate update object contains valid fields for the state type
- FR8.3: Must reject updates with invalid data types
- FR8.4: Must reject updates with missing required fields
- FR8.5: Must throw descriptive validation errors for invalid updates

## Non-Functional Requirements

### NFR1: Performance
**Priority:** High  
**Description:** State synchronization must not introduce noticeable latency

**Requirements:**
- NFR1.1: State update latency must be < 10ms (persist + broadcast)
- NFR1.2: Broadcast to all windows must complete in < 50ms for 5 windows
- NFR1.3: State retrieval from memory must complete in < 1ms
- NFR1.4: Focus sync must complete in < 50ms
- NFR1.5: Memory overhead for state cache must be < 1MB

### NFR2: Reliability
**Priority:** Critical  
**Description:** State synchronization must be robust and fault-tolerant

**Requirements:**
- NFR2.1: Broadcast failure to one window must not prevent broadcasts to other windows
- NFR2.2: Disk write failures must not cause data loss (state remains in memory)
- NFR2.3: Invalid state updates must not corrupt existing state
- NFR2.4: Destroyed window references must be cleaned up automatically
- NFR2.5: Application must not crash due to state synchronization errors

### NFR3: Consistency
**Priority:** Critical  
**Description:** All windows must display consistent state at all times

**Requirements:**
- NFR3.1: All windows must display the same state when no updates are in progress
- NFR3.2: All registered windows must receive every state change broadcast
- NFR3.3: State must be persisted to disk before broadcasting to windows
- NFR3.4: All windows must converge to the same state within 100ms of any update
- NFR3.5: Focused windows must receive current state within 50ms

### NFR4: Maintainability
**Priority:** Medium  
**Description:** State synchronization code must be maintainable and debuggable

**Requirements:**
- NFR4.1: All state operations must be logged with timestamp and source
- NFR4.2: All broadcast operations must be logged with recipient count
- NFR4.3: All errors must be logged with context and stack traces
- NFR4.4: Window registration/unregistration must be logged
- NFR4.5: Focus sync operations must be logged

### NFR5: Scalability
**Priority:** Medium  
**Description:** State synchronization must support multiple windows efficiently

**Requirements:**
- NFR5.1: Must support at least 5 concurrent windows without performance degradation
- NFR5.2: Memory usage must scale linearly with number of windows (O(n))
- NFR5.3: Broadcast time must scale linearly with number of windows (O(n))
- NFR5.4: Window registry must use constant time lookups (O(1))
- NFR5.5: Debounced broadcasts must batch rapid updates to reduce IPC overhead

## Technical Constraints

### TC1: Technology Stack
- Must use Node.js and Electron APIs only
- Must use Electron IPC for inter-process communication
- Must use Node.js fs module for file system operations
- Must not introduce external dependencies beyond existing ones

### TC2: File System
- State files must be stored in `app.getPath('userData')` directory
- State files must use JSON format
- State files must be human-readable for debugging
- State files must use atomic writes to prevent corruption

### TC3: Architecture
- State Manager must run in the main process only
- UI windows must run in renderer processes
- All state updates must go through the main process
- No direct state sharing between renderer processes

### TC4: Backward Compatibility
- Must work with existing setup-state-manager.js
- Must work with existing window-state-manager.js
- Must not break existing IPC handlers
- Must not require changes to existing state file formats

## Success Criteria

### Quantitative Metrics

1. **State Update Latency**: < 10ms for 95th percentile
2. **Broadcast Latency**: < 50ms for 5 windows at 95th percentile
3. **Focus Sync Latency**: < 50ms at 95th percentile
4. **Memory Overhead**: < 1MB for state cache
5. **Test Coverage**: > 90% line coverage for state synchronization code

### Qualitative Metrics

1. **User Experience**: Users report that windows "feel synchronized" and responsive
2. **Setup Flow**: Setup process feels cohesive across multiple windows
3. **Error Handling**: No crashes or data loss during state operations
4. **Debugging**: Logs provide sufficient information to diagnose issues
5. **Code Quality**: Code is maintainable and well-documented

## Out of Scope

The following items are explicitly out of scope for this feature:

1. **Undo/Redo Functionality**: No state history or rollback capability
2. **Conflict Resolution**: Last write wins for simultaneous updates
3. **Network Synchronization**: No synchronization across multiple machines
4. **State Encryption**: State files are stored in plain JSON
5. **State Compression**: No compression of state data
6. **State Migration**: No automatic migration of old state formats
7. **Real-Time Collaboration**: No multi-user state synchronization
8. **State Versioning**: No version tracking for state changes

## Assumptions

1. **Single User**: Only one user operates the application at a time on a single machine
2. **Trusted Environment**: Application runs in a trusted environment (venue's Windows PC)
3. **Disk Availability**: Disk is always available for state persistence
4. **Window Lifecycle**: Windows are created and destroyed in a predictable manner
5. **IPC Reliability**: Electron IPC is reliable for local inter-process communication
6. **State Size**: Total state size remains under 1MB
7. **Update Frequency**: State updates occur at most 10 times per second
8. **Window Count**: Maximum of 5 windows open simultaneously

## Dependencies

### Internal Dependencies
- Electron framework for IPC and window management
- Existing setup-state-manager.js module
- Existing window-state-manager.js module
- Existing logger.js module

### External Dependencies
- None (uses only Node.js built-ins and Electron APIs)

### File Dependencies
- `setup-state.json` - Setup completion state
- `config.json` - Application configuration
- `window-state.json` - Window dimensions and position

## Risks and Mitigations

### Risk 1: Race Conditions
**Risk**: Simultaneous state updates from multiple windows could cause data corruption  
**Likelihood**: Medium  
**Impact**: High  
**Mitigation**: Queue all state updates in main process and process sequentially

### Risk 2: Broadcast Failures
**Risk**: IPC broadcast failures could leave windows out of sync  
**Likelihood**: Low  
**Impact**: Medium  
**Mitigation**: Implement focus-based sync fallback to recover stale windows

### Risk 3: Disk Write Failures
**Risk**: Disk write failures could cause data loss  
**Likelihood**: Low  
**Impact**: High  
**Mitigation**: Keep state in memory and retry on next update; log errors for debugging

### Risk 4: Memory Leaks
**Risk**: Window registry could accumulate destroyed window references  
**Likelihood**: Medium  
**Impact**: Medium  
**Mitigation**: Automatically clean up destroyed windows during broadcast attempts

### Risk 5: Performance Degradation
**Risk**: Frequent broadcasts could cause UI lag  
**Likelihood**: Medium  
**Impact**: Medium  
**Mitigation**: Implement debounced broadcasts to batch rapid updates

## Acceptance Testing

### Test Scenario 1: Complete Setup Flow
1. Start application in first-run state
2. Open Setup Mode window
3. Save Bar ID in Setup Mode
4. Verify Normal Mode dashboard shows Bar ID within 100ms
5. Complete printer setup in Printer Wizard
6. Verify Setup Mode shows printer step complete within 100ms
7. Generate template in Template Generator
8. Verify all windows show setup complete within 100ms

**Expected Result**: All windows display consistent state throughout setup process

### Test Scenario 2: Multi-Window Synchronization
1. Open Normal Mode window
2. Open Printer Wizard window
3. Open Template Generator window
4. Update Bar ID in Normal Mode
5. Verify Printer Wizard shows new Bar ID within 100ms
6. Verify Template Generator shows new Bar ID within 100ms

**Expected Result**: All windows display the same Bar ID after update

### Test Scenario 3: Focus Sync Recovery
1. Open window A
2. Minimize window A
3. Update Bar ID from window B
4. Focus window A
5. Verify window A shows updated Bar ID within 50ms

**Expected Result**: Minimized window recovers current state on focus

### Test Scenario 4: Error Handling
1. Open multiple windows
2. Simulate disk write failure
3. Update state
4. Verify error is logged
5. Verify state remains in memory
6. Verify windows are not notified (maintain consistency)

**Expected Result**: Application handles disk errors gracefully without data loss

### Test Scenario 5: Window Lifecycle
1. Open window A
2. Register window A
3. Close window A
4. Update state
5. Verify no errors occur during broadcast
6. Verify window A is automatically unregistered

**Expected Result**: Destroyed windows are cleaned up automatically

## Glossary

- **State Manager**: Centralized component that manages all application state in memory
- **Broadcast Manager**: Component that sends state change events to all registered windows
- **Window Registry**: Component that tracks all open windows and their lifecycle
- **IPC**: Inter-Process Communication - Electron's mechanism for communication between main and renderer processes
- **State Type**: Category of state (setup, config, printer, template, window)
- **State Sync**: Process of sending complete current state to a window
- **Focus Sync**: Automatic state synchronization when a window gains focus
- **Debounced Broadcast**: Batching multiple rapid state updates into a single broadcast
- **Atomic Write**: File write operation that completes fully or not at all (prevents partial writes)
