# Implementation Plan: Tray UI Simplification

## Overview

This implementation plan converts the tray-ui-simplification design into actionable coding tasks. The feature redesigns the Tabeza Connect system tray interaction and Management UI to provide a customer-friendly first-run onboarding experience with progressive disclosure of features.

The implementation uses TypeScript/JavaScript with Electron, following the existing codebase patterns. All code will be written for the tabeza-connect application.

## Tasks

- [x] 1. Create Setup State Manager
  - Create `src/lib/setup-state-manager.js` with state persistence logic
  - Implement `loadSetupState()`, `saveSetupState()`, `isSetupComplete()`, `markStepComplete()`, `getSetupProgress()` functions
  - Use `app.getPath('userData')/setup-state.json` for storage
  - Handle file corruption gracefully with default state fallback
  - _Requirements: 2.1, 2.2, 14.7_

- [ ]* 1.1 Write property test for Setup State Manager
  - **Property 1: Setup Mode Persistence**
  - **Validates: Requirements 1.6, 1.7, 14.7**
  - Test that marking all three steps complete persists across restarts
  - Use fast-check to generate random step completion states

- [ ]* 1.2 Write property test for Setup Progress Accuracy
  - **Property 2: Setup Progress Accuracy**
  - **Validates: Requirements 2.6**
  - Test that progress count always equals number of completed steps
  - Use fast-check to generate all possible step combinations

- [x] 2. Create Window State Manager
  - Create `src/lib/window-state-manager.js` with window persistence logic
  - Implement `saveWindowState()`, `restoreWindowState()`, `getDefaultWindowState()` functions
  - Use `app.getPath('userData')/window-state.json` for storage
  - Debounce window state saves by 500ms to prevent excessive disk writes
  - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ]* 2.1 Write property test for Window State Round Trip
  - **Property 12: Window State Round Trip**
  - **Validates: Requirements 14.1, 14.2, 14.3**
  - Test that saving and restoring window state preserves dimensions and position
  - Use fast-check to generate random valid window dimensions

- [x] 3. Modify Tray Manager in electron-main.js
  - Update `createTray()` to handle single-click opening Management UI
  - Simplify `updateTrayMenu()` to show only: Start/Stop Service, Version (disabled), Quit
  - Remove all other menu items (printer setup, template generator, folder repair, logs)
  - Update tray icon color logic to reflect setup completion state
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1-5.8_

- [ ]* 3.1 Write property test for Context Menu Structure
  - **Property 9: Context Menu Structure**
  - **Validates: Requirements 4.5, 5.8**
  - Test that context menu always contains exactly 3 items
  - Verify no additional items are present

- [ ]* 3.2 Write property test for Service Control Menu Text
  - **Property 10: Service Control Menu Text**
  - **Validates: Requirements 5.1, 5.2**
  - Test that menu text matches service state (running/stopped)
  - Use fast-check to generate service states

- [x] 4. Add IPC Handlers for Setup State
  - Add `ipcMain.handle('get-setup-state')` handler
  - Add `ipcMain.handle('mark-step-complete')` handler with step name validation
  - Add `ipcMain.handle('reset-setup-state')` handler
  - Add `ipcMain.handle('get-window-state')` handler
  - Add `ipcMain.handle('save-active-section')` handler
  - _Requirements: 2.1, 14.5, 14.6_

- [x] 5. Create Migration Logic for Existing Installations
  - Add `migrateExistingInstallation()` function in electron-main.js
  - Check existing config.json for Bar ID
  - Check printer configuration status
  - Check template.json existence
  - Auto-populate setup state for existing users
  - Set `firstRunComplete: true` for existing installations
  - _Requirements: 17.1-17.7_

- [x] 6. Create Management UI HTML Structure
  - Create `src/public/management-ui.html` with dual-mode container structure
  - Add welcome screen markup for first-run experience
  - Add setup progress tracker with 3 steps (Bar ID, Printer, Template)
  - Add step configuration panels for each setup step
  - Add success screen for setup completion
  - Add normal mode dashboard with tabbed navigation
  - _Requirements: 1.1-1.7, 6.1-6.7, 7.1-7.9_

- [x] 7. Create Setup Mode CSS
  - Create `src/public/css/setup-mode.css` with visual design system
  - Implement color palette (primary gradient, status colors, neutrals)
  - Style welcome screen with centered layout
  - Style progress tracker with visual hierarchy
  - Style step cards with icons and status indicators
  - Add animations for progress bar fill and checkmark pop
  - _Requirements: 6.1-6.7, 13.1-13.6_

- [x] 8. Create Normal Mode CSS
  - Create `src/public/css/normal-mode.css` for dashboard layout
  - Style tabbed navigation interface
  - Style dashboard section with service status cards
  - Style printer, template, system, and logs sections
  - Ensure responsive behavior within min/max window bounds (800x600 to 1400x1000)
  - _Requirements: 7.1-7.9, 8.1-8.9_

- [ ] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Create Mode Router JavaScript
  - Create `src/public/js/mode-router.js` with mode detection logic
  - Implement `determineMode()` function (FIRST_RUN, SETUP_MODE, NORMAL_MODE)
  - Handle mode transitions based on setup state
  - Load appropriate UI components for each mode
  - _Requirements: 1.1-1.7, 6.4_

- [ ]* 10.1 Write unit tests for Mode Router
  - Test first-run detection when setup state doesn't exist
  - Test setup mode detection when some steps incomplete
  - Test normal mode detection when all steps complete
  - Test mode transition logic

- [x] 11. Create Setup Mode JavaScript
  - Create `src/public/js/setup-mode.js` with setup flow logic
  - Implement `updateSetupProgress()` to sync UI with state
  - Implement `updateStepUI()` to update step icons and status
  - Implement `goToStep()` for step navigation
  - Implement `showSetupComplete()` for success screen
  - Handle Bar ID configuration with validation
  - Integrate printer setup wizard launch
  - Integrate template generator wizard launch
  - _Requirements: 2.1-2.7, 3.1-3.7, 9.1-9.7, 10.1-10.7_

- [ ]* 11.1 Write property test for Step Status Visual Consistency
  - **Property 3: Step Status Visual Consistency**
  - **Validates: Requirements 2.3, 2.5**
  - Test that visual indicators match completion state
  - Use fast-check to generate step states

- [ ]* 11.2 Write property test for Bar ID Validation
  - **Property 5: Bar ID Validation**
  - **Validates: Requirements 3.3**
  - Test that empty/whitespace Bar IDs are rejected
  - Use fast-check to generate invalid Bar ID strings

- [ ]* 11.3 Write property test for Bar ID Round Trip
  - **Property 4: Bar ID Configuration Round Trip**
  - **Validates: Requirements 3.4**
  - Test that saving and reading Bar ID returns same value
  - Use fast-check to generate valid Bar ID strings

- [x] 12. Create Normal Mode JavaScript
  - Create `src/public/js/normal-mode.js` with dashboard logic
  - Implement `switchSection()` for tab navigation
  - Implement service control functions (start, stop, restart)
  - Implement real-time status updates
  - Implement log viewer with auto-refresh
  - Add keyboard shortcut handlers (Ctrl+1-5, Ctrl+R, Ctrl+W)
  - _Requirements: 7.1-7.9, 8.1-8.9, 11.1-11.7, 12.1-12.8, 15.1-15.8_

- [ ]* 12.1 Write property test for Section State Persistence
  - **Property 14: Section State Persistence**
  - **Validates: Requirements 14.5, 14.6**
  - Test that active section persists across window close/open
  - Use fast-check to generate section names

- [x] 13. Create Shared Utilities JavaScript
  - Create `src/public/js/shared.js` with common utilities
  - Implement notification display functions
  - Implement error handling utilities
  - Implement IPC wrapper functions with error handling
  - Add ARIA live region announcements for accessibility
  - _Requirements: 16.1-16.7, 18.1-18.6_

- [x] 14. Update Window Creation in electron-main.js
  - Modify `showManagementUI()` to use window state manager
  - Implement window reuse logic (don't recreate if already exists)
  - Add window state save handlers (resize, move events)
  - Load management-ui.html instead of dashboard.html
  - Set up preload script with context isolation
  - _Requirements: 4.3, 14.1-14.6, 19.1-19.5_

- [ ]* 14.1 Write property test for Tray Click Opens Window
  - **Property 7: Tray Click Opens Window**
  - **Validates: Requirements 4.1, 4.2**
  - Test that clicking tray when window closed creates window
  - Test both single and double click

- [ ]* 14.2 Write property test for Tray Click Focuses Existing Window
  - **Property 8: Tray Click Focuses Existing Window**
  - **Validates: Requirements 4.3**
  - Test that clicking tray when window open focuses window
  - Verify no new window is created

- [ ] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Create Preload Script with Context Isolation
  - Create `src/preload.js` with secure IPC bridge
  - Expose only necessary IPC methods via contextBridge
  - Validate all IPC parameters in main process
  - Implement input sanitization for file paths
  - _Requirements: Security considerations from design_

- [ ] 17. Add Content Security Policy
  - Add CSP meta tag to management-ui.html
  - Restrict script-src to 'self'
  - Allow style-src 'self' 'unsafe-inline' for dynamic styles
  - Prevent XSS with textContent instead of innerHTML
  - _Requirements: Security considerations from design_

- [x] 18. Implement Bar ID Auto-Detection
  - Add logic to check existing config.json on startup
  - Auto-mark Bar ID step complete if config has non-empty Bar ID
  - Update setup progress UI accordingly
  - _Requirements: 3.7_

- [ ]* 18.1 Write property test for Bar ID Auto-Detection
  - **Property 6: Bar ID Auto-Detection**
  - **Validates: Requirements 3.7**
  - Test that existing Bar ID marks step complete
  - Use fast-check to generate config states

- [x] 19. Implement Printer Status Auto-Detection
  - Add logic to check printer configuration on startup
  - Auto-mark Printer step complete if pooling configured
  - Update setup progress UI accordingly
  - _Requirements: 9.1-9.7_

- [x] 20. Implement Template Status Auto-Detection
  - Add logic to check template.json existence on startup
  - Auto-mark Template step complete if template exists
  - Update setup progress UI accordingly
  - _Requirements: 10.1-10.7_

- [x] 21. Add Performance Optimizations
  - Implement lazy window creation (don't create until tray clicked)
  - Cache setup state in memory after first load
  - Use requestAnimationFrame for DOM updates
  - Implement virtual scrolling for log viewer
  - Add parallel initialization for startup tasks
  - _Requirements: 19.1-19.5_

- [ ]* 21.1 Write performance tests
  - Test window open time (target: < 500ms)
  - Test section switch time (target: < 100ms)
  - Test status update time (target: < 1000ms)
  - Test log load time (target: < 500ms)

- [x] 22. Add Accessibility Features
  - Add ARIA labels to all interactive elements
  - Implement keyboard navigation for all features
  - Add visible focus indicators with sufficient contrast
  - Add ARIA live regions for status announcements
  - Ensure WCAG AA color contrast ratios (4.5:1 for text)
  - _Requirements: 18.1-18.6_

- [x] 23. Add "What's New" Dialog for Upgrades
  - Create modal dialog explaining new single-click behavior
  - Add "Don't show again" checkbox
  - Store preference in userData
  - Show only on first launch after upgrade
  - _Requirements: 17.6_

- [ ] 24. Write Integration Tests
  - Test first-run experience end-to-end
  - Test partial setup resume (some steps complete)
  - Test window state persistence across restarts
  - Test mode transitions (first-run → setup → normal)
  - Test backward compatibility with existing installations
  - _Requirements: All requirements_

- [ ]* 24.1 Write property test for Mode-Based Feature Visibility
  - **Property 11: Mode-Based Feature Visibility**
  - **Validates: Requirements 6.2, 6.4**
  - Test that secondary features hidden in Setup Mode
  - Test that features visible in Normal Mode

- [ ]* 24.2 Write property test for Default Window State
  - **Property 13: Default Window State**
  - **Validates: Requirements 14.4**
  - Test that first launch uses 900x700 centered window
  - Verify default state when no saved state exists

- [ ]* 24.3 Write property test for UI Responsiveness
  - **Property 15: UI Responsiveness During Background Operations**
  - **Validates: Requirements 19.5**
  - Test that UI remains interactive during folder repair
  - Test that UI remains interactive during service restart

- [ ] 25. Update Documentation
  - Update user guide with new UI screenshots
  - Document single-click tray behavior
  - Document keyboard shortcuts
  - Update developer guide with new IPC handlers
  - Document setup state management
  - _Requirements: Deployment considerations from design_

- [ ] 26. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- All code should follow existing Tabeza Connect patterns and conventions
- Use Electron IPC for main-renderer communication
- Store persistent state in `app.getPath('userData')`
- Maintain backward compatibility with existing installations
  