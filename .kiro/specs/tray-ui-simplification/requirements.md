# Requirements Document

## Introduction

This document defines requirements for redesigning the Tabeza Connect system tray icon interaction and Management UI to improve discoverability and user experience. The current implementation requires users to right-click the tray icon to access most functionality, but users naturally expect single-click behavior. This redesign consolidates all management actions into a centralized Management UI while simplifying the tray context menu to essential service controls only.

The redesign prioritizes a customer-friendly first-run onboarding experience that guides users through three critical setup steps: Bar ID configuration, printer setup, and receipt template generation. These steps must be completed before the service can function properly. The UI uses progressive disclosure to emphasize critical setup items while minimizing secondary features until setup is complete.

## Glossary

- **Tray_Icon**: The system tray icon displayed in the Windows taskbar notification area
- **Management_UI**: The Electron window that provides the primary interface for managing Tabeza Connect
- **Context_Menu**: The right-click menu displayed when the user right-clicks the Tray_Icon
- **Service**: The background Windows service that captures and processes receipts
- **Template_Generator**: The workflow for creating receipt parsing templates
- **Printer_Setup**: The workflow for configuring printer pooling
- **User**: The venue staff member or administrator using Tabeza Connect
- **First_Run**: The initial state when Tabeza Connect is opened for the first time after installation
- **Setup_Mode**: The UI state where critical setup steps are prominently displayed and incomplete
- **Normal_Mode**: The UI state after all critical setup steps are completed
- **Setup_Progress**: The tracking mechanism showing which of the three critical steps are complete

## Requirements

### Requirement 1: First-Run Onboarding Experience

**User Story:** As a User installing Tabeza Connect for the first time, I want to be guided through the essential setup steps immediately, so that I can get the service working without confusion.

#### Acceptance Criteria

1. WHEN the installer completes, THE installer SHALL automatically open the Management_UI in First_Run mode
2. WHEN the Management_UI opens in First_Run mode, THE Management_UI SHALL display a welcome screen explaining the three critical setup steps
3. THE welcome screen SHALL clearly state that all three steps (Bar ID, Printer Setup, Receipt Template) must be completed for the service to work
4. THE welcome screen SHALL provide a "Start Setup" button to begin the guided setup process
5. WHEN the User clicks "Start Setup", THE Management_UI SHALL transition to Setup_Mode and display the setup progress interface
6. THE Management_UI SHALL remain in Setup_Mode UNTIL all three critical steps are marked complete
7. WHEN all three critical steps are complete, THE Management_UI SHALL display a success message and transition to Normal_Mode

### Requirement 2: Setup Progress Tracking

**User Story:** As a User, I want to see clear visual indication of which setup steps are complete and which need attention, so that I know exactly what I need to do to finish setup.

#### Acceptance Criteria

1. THE Management_UI SHALL display Setup_Progress showing three critical steps: Bar ID Configuration, Printer Setup, and Receipt Template Generation
2. THE Setup_Progress SHALL display each step with a clear status indicator: Not Started, In Progress, or Complete
3. WHEN a step is Not Started, THE Setup_Progress SHALL display a grey circle icon and "Not Started" text
4. WHEN a step is In Progress, THE Setup_Progress SHALL display a yellow spinner icon and "In Progress" text
5. WHEN a step is Complete, THE Setup_Progress SHALL display a green checkmark icon and "Complete" text
6. THE Setup_Progress SHALL display a progress bar showing X/3 steps complete
7. WHEN the User clicks on a step in Setup_Progress, THE Management_UI SHALL navigate to that step's configuration interface
8. THE Setup_Progress SHALL be prominently displayed at the top of the Management_UI WHILE in Setup_Mode

### Requirement 3: Bar ID Configuration Step

**User Story:** As a User, I want to easily enter my Bar ID from the Tabeza staff app, so that the service can connect to my venue.

#### Acceptance Criteria

1. THE Bar ID configuration interface SHALL display clear instructions: "Enter your Bar ID from the Tabeza staff app"
2. THE Bar ID configuration interface SHALL provide a text input field for the Bar ID
3. THE Bar ID configuration interface SHALL validate that the Bar ID is not empty before allowing save
4. WHEN the User enters a valid Bar ID and clicks Save, THE Management_UI SHALL save the Bar ID to configuration
5. WHEN the Bar ID is successfully saved, THE Setup_Progress SHALL mark the Bar ID step as Complete
6. THE Bar ID configuration interface SHALL display a link or instructions on where to find the Bar ID in the Tabeza staff app
7. IF a Bar ID already exists in configuration, THEN THE Bar ID step SHALL be marked Complete automatically

### Requirement 4: Simplified Tray Icon Interaction

**User Story:** As a User, I want to click the tray icon once to open the Management UI, so that I can access all features without needing to know about right-click menus.

#### Acceptance Criteria

1. WHEN the User performs a single left-click on the Tray_Icon, THE Tray_Icon SHALL open the Management_UI window
2. WHEN the User performs a double-click on the Tray_Icon, THE Tray_Icon SHALL open the Management_UI window (same behavior as single-click)
3. IF the Management_UI window is already open, THEN THE Tray_Icon SHALL bring the existing window to the foreground and focus it
4. WHEN the User right-clicks the Tray_Icon, THE Tray_Icon SHALL display the Context_Menu
5. THE Context_Menu SHALL contain exactly four items: service control (Start Service or Stop Service), separator, Version information, and Quit
6. WHEN the Management_UI opens during First_Run or Setup_Mode, THE Management_UI SHALL display the setup interface instead of the normal dashboard

### Requirement 5: Minimal Context Menu

**User Story:** As a User, I want a simple right-click menu with only essential controls, so that I can quickly start/stop the service or exit the application.

#### Acceptance Criteria

1. THE Context_Menu SHALL display "Start Service" WHEN the Service status is stopped
2. THE Context_Menu SHALL display "Stop Service" WHEN the Service status is running
3. WHEN the User clicks "Start Service", THE Tray_Icon SHALL start the Service
4. WHEN the User clicks "Stop Service", THE Tray_Icon SHALL stop the Service
5. THE Context_Menu SHALL display version information in the format "Tabeza Connect v{version}"
6. THE version information menu item SHALL be disabled (non-clickable)
7. WHEN the User clicks "Quit", THE Tray_Icon SHALL close the Management_UI window if open and exit the application
8. THE Context_Menu SHALL NOT contain any other menu items beyond those specified in criteria 1-7

### Requirement 6: Visual Hierarchy and Progressive Disclosure

**User Story:** As a User, I want to see the most important setup items prominently displayed, so that I can focus on what matters without being overwhelmed by advanced features.

#### Acceptance Criteria

1. WHILE in Setup_Mode, THE Management_UI SHALL prominently display the three critical setup steps at the top of the interface
2. WHILE in Setup_Mode, THE Management_UI SHALL minimize or hide secondary features (diagnostics, advanced settings, folder management)
3. WHILE in Setup_Mode, THE Management_UI SHALL use large, clear buttons and status indicators for the three critical steps
4. WHEN the User transitions to Normal_Mode, THE Management_UI SHALL reveal all features in the standard dashboard layout
5. THE Management_UI SHALL use visual hierarchy (size, color, position) to emphasize critical items over optional items
6. THE Management_UI SHALL use customer-friendly language avoiding technical jargon in setup instructions
7. THE Management_UI SHALL use green checkmarks for completed steps, yellow warnings for incomplete steps, and red errors for failed steps

### Requirement 7: Consolidated Management UI

**User Story:** As a User, I want all management actions available in one centralized interface, so that I don't need to search through multiple menus to find features.

#### Acceptance Criteria

1. THE Management_UI SHALL provide access to all functionality previously available in the Context_Menu
2. THE Management_UI SHALL include a Dashboard section showing service status, folder status, and recent activity
3. THE Management_UI SHALL include a Printer Setup section for configuring printer pooling
4. THE Management_UI SHALL include a Template Generator section for creating and managing receipt templates
5. THE Management_UI SHALL include a System section for folder repair and system diagnostics
6. THE Management_UI SHALL include a Logs section for viewing service logs and opening the capture folder
7. WHEN the Management_UI is closed by the User, THE Tray_Icon SHALL remain active in the system tray
8. THE Management_UI SHALL use a tabbed interface or clear navigation structure to organize sections
9. WHILE in Setup_Mode, THE Management_UI SHALL prioritize displaying the three critical setup steps over other sections

### Requirement 8: Dashboard Section

**User Story:** As a User, I want to see the current system status at a glance, so that I can quickly verify everything is working correctly.

#### Acceptance Criteria

1. THE Dashboard SHALL display the current Service status (Running, Stopped, or Error)
2. THE Dashboard SHALL display the folder structure status (OK or Missing)
3. THE Dashboard SHALL display the last receipt capture timestamp
4. THE Dashboard SHALL display the total number of receipts processed today
5. THE Dashboard SHALL provide a button to start the Service WHEN the Service is stopped
6. THE Dashboard SHALL provide a button to stop the Service WHEN the Service is running
7. THE Dashboard SHALL provide a button to restart the Service WHEN the Service is running
8. THE Dashboard SHALL update status information in real-time without requiring manual refresh
9. WHILE in Setup_Mode, THE Dashboard SHALL prominently display Setup_Progress at the top with large, clear status indicators for the three critical steps
10. WHILE in Setup_Mode, THE Dashboard SHALL display a warning message if any critical step is incomplete, explaining that the service cannot function until all steps are complete
11. THE Dashboard SHALL use customer-friendly status messages (e.g., "Ready to capture receipts" instead of "Service running")

### Requirement 9: Printer Setup Section

**User Story:** As a User, I want to configure printer pooling from the Management UI, so that I can set up or modify printer configuration without using the tray menu.

#### Acceptance Criteria

1. THE Printer_Setup section SHALL display the current printer pooling configuration status
2. THE Printer_Setup section SHALL provide a button to launch the printer pooling configuration wizard
3. WHEN the User clicks the configuration button, THE Management_UI SHALL open the Printer_Setup wizard window
4. THE Printer_Setup section SHALL display which physical printer is currently configured
5. THE Printer_Setup section SHALL display whether the Tabeza Agent is properly configured
6. WHEN printer setup is successfully completed, THE Setup_Progress SHALL mark the Printer Setup step as Complete
7. THE Printer_Setup section SHALL use customer-friendly language explaining what printer pooling does and why it's needed

### Requirement 10: Template Generator Section

**User Story:** As a User, I want to create and manage receipt templates from the Management UI, so that I can configure receipt parsing without using the tray menu.

#### Acceptance Criteria

1. THE Template_Generator section SHALL display the current template status (Configured, Not Configured, or Needs Update)
2. THE Template_Generator section SHALL provide a button to launch the template generation wizard
3. WHEN the User clicks the generation button, THE Management_UI SHALL open the Template_Generator wizard window
4. THE Template_Generator section SHALL display the template version and POS system type if a template exists
5. THE Template_Generator section SHALL display the template confidence score if available
6. WHEN template generation is successfully completed, THE Setup_Progress SHALL mark the Receipt Template step as Complete
7. THE Template_Generator section SHALL use customer-friendly language explaining what the template does and why it's needed (e.g., "This helps Tabeza understand your receipts")

### Requirement 11: System Section

**User Story:** As a User, I want to perform system maintenance tasks from the Management UI, so that I can repair issues without using the tray menu.

#### Acceptance Criteria

1. THE System section SHALL provide a button to repair the folder structure
2. WHEN the User clicks the repair button, THE Management_UI SHALL execute the folder repair operation
3. THE System section SHALL display the result of the repair operation (Success or Failure with details)
4. THE System section SHALL display the current folder structure status
5. THE System section SHALL provide a button to open the capture folder in Windows Explorer
6. WHEN the User clicks the open folder button, THE Management_UI SHALL open the TabezaPrints folder in Windows Explorer
7. WHILE in Setup_Mode, THE System section SHALL be minimized or hidden to avoid overwhelming the User with advanced features

### Requirement 12: Logs Section

**User Story:** As a User, I want to view service logs from the Management UI, so that I can troubleshoot issues without using the tray menu.

#### Acceptance Criteria

1. THE Logs section SHALL display the most recent 100 lines from the service log file
2. THE Logs section SHALL auto-refresh log content every 5 seconds WHILE the Logs section is visible
3. THE Logs section SHALL provide a button to manually refresh the log content
4. THE Logs section SHALL provide a button to open the full log file in the default text editor
5. THE Logs section SHALL provide a button to clear the log file
6. WHEN the User clicks the clear button, THE Management_UI SHALL prompt for confirmation before clearing
7. THE Logs section SHALL display log entries with timestamps and severity levels (Info, Warning, Error)
8. WHILE in Setup_Mode, THE Logs section SHALL be accessible but not prominently displayed

### Requirement 13: Visual Status Indicators

**User Story:** As a User, I want the tray icon to visually indicate system status, so that I can see at a glance if everything is working correctly.

#### Acceptance Criteria

1. THE Tray_Icon SHALL display a green icon WHEN the Service is running AND all three critical setup steps are complete
2. THE Tray_Icon SHALL display a yellow icon WHEN the Service is running BUT one or more critical setup steps are incomplete
3. THE Tray_Icon SHALL display a red icon WHEN the Service is stopped or in error state
4. THE Tray_Icon SHALL display a grey icon WHEN the Service status is unknown or initializing
5. WHEN the User hovers over the Tray_Icon, THE Tray_Icon SHALL display a tooltip with current status summary
6. THE tooltip SHALL include setup progress (e.g., "Setup: 2/3 steps complete") WHEN in Setup_Mode

### Requirement 14: Window State Persistence

**User Story:** As a User, I want the Management UI to remember my window size and position, so that it opens in a convenient location each time.

#### Acceptance Criteria

1. WHEN the User resizes the Management_UI window, THE Management_UI SHALL save the new dimensions
2. WHEN the User moves the Management_UI window, THE Management_UI SHALL save the new position
3. WHEN the Management_UI opens, THE Management_UI SHALL restore the previously saved window dimensions and position
4. IF no saved window state exists, THEN THE Management_UI SHALL open centered on the primary monitor with default dimensions of 900x700 pixels
5. WHEN the User switches between sections/tabs, THE Management_UI SHALL remember the last active section
6. WHEN the Management_UI opens, THE Management_UI SHALL restore the last active section
7. THE Management_UI SHALL persist whether the User has completed First_Run setup to determine whether to show Setup_Mode or Normal_Mode

### Requirement 15: Keyboard Navigation

**User Story:** As a User, I want to navigate the Management UI using keyboard shortcuts, so that I can work efficiently without using the mouse.

#### Acceptance Criteria

1. WHEN the User presses Ctrl+1, THE Management_UI SHALL switch to the Dashboard section
2. WHEN the User presses Ctrl+2, THE Management_UI SHALL switch to the Printer Setup section
3. WHEN the User presses Ctrl+3, THE Management_UI SHALL switch to the Template Generator section
4. WHEN the User presses Ctrl+4, THE Management_UI SHALL switch to the System section
5. WHEN the User presses Ctrl+5, THE Management_UI SHALL switch to the Logs section
6. WHEN the User presses Ctrl+R, THE Management_UI SHALL restart the Service if running
7. WHEN the User presses Ctrl+W or Alt+F4, THE Management_UI SHALL close the window
8. THE Management_UI SHALL display keyboard shortcuts in tooltips or a help section

### Requirement 16: Error Handling and User Feedback

**User Story:** As a User, I want clear feedback when operations succeed or fail, so that I understand what happened and can take appropriate action.

#### Acceptance Criteria

1. WHEN an operation succeeds, THE Management_UI SHALL display a success notification with a descriptive message
2. WHEN an operation fails, THE Management_UI SHALL display an error notification with a descriptive message and suggested resolution
3. THE Management_UI SHALL display notifications for a duration of 5 seconds before auto-dismissing
4. THE User SHALL be able to manually dismiss notifications by clicking a close button
5. WHEN a critical error occurs, THE Management_UI SHALL display a modal dialog requiring User acknowledgment
6. WHEN the Service fails to start or stop, THE Management_UI SHALL display the specific error reason from the Service
7. THE Management_UI SHALL use customer-friendly error messages avoiding technical jargon (e.g., "Couldn't connect to printer" instead of "USB001 port unavailable")

### Requirement 17: Backward Compatibility

**User Story:** As a User upgrading from a previous version, I want the new interface to work seamlessly, so that I don't lose any existing configuration or functionality.

#### Acceptance Criteria

1. THE Management_UI SHALL read and respect all existing configuration from previous versions
2. THE Management_UI SHALL maintain compatibility with existing template.json files
3. THE Management_UI SHALL maintain compatibility with existing config.json files
4. THE Management_UI SHALL maintain compatibility with existing Windows Registry settings
5. WHEN the User first opens the new Management_UI after upgrade, THE Management_UI SHALL display a brief "What's New" message explaining the interface changes
6. THE "What's New" message SHALL include a "Don't show again" checkbox
7. IF all three critical setup steps are already complete from a previous installation, THEN THE Management_UI SHALL open in Normal_Mode instead of Setup_Mode

### Requirement 18: Accessibility

**User Story:** As a User with accessibility needs, I want the Management UI to be usable with screen readers and keyboard-only navigation, so that I can manage Tabeza Connect effectively.

#### Acceptance Criteria

1. THE Management_UI SHALL provide ARIA labels for all interactive elements
2. THE Management_UI SHALL support full keyboard navigation without requiring mouse input
3. THE Management_UI SHALL maintain visible focus indicators for all focusable elements
4. THE Management_UI SHALL provide text alternatives for all status icons and visual indicators
5. THE Management_UI SHALL use sufficient color contrast ratios (WCAG AA minimum) for all text and interactive elements
6. THE Management_UI SHALL announce status changes to screen readers using ARIA live regions

### Requirement 19: Performance

**User Story:** As a User, I want the Management UI to be responsive and fast, so that I can complete tasks efficiently without waiting.

#### Acceptance Criteria

1. THE Management_UI SHALL open within 500ms of the User clicking the Tray_Icon
2. THE Management_UI SHALL switch between sections within 100ms of the User clicking a tab or using keyboard shortcuts
3. THE Management_UI SHALL update status information within 1 second of a status change occurring
4. THE Management_UI SHALL load log content within 500ms of the User opening the Logs section
5. THE Management_UI SHALL not block user interaction while performing background operations (folder repair, service restart)
