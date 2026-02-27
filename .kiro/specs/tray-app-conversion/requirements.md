# Requirements Document

## Introduction

TabezaConnect is a POS printer bridge service that captures receipt data from Point-of-Sale systems and forwards it to both the Tabeza cloud API and physical thermal printers. Currently implemented as a Windows Service running in Session 0 (as Local System), it encounters critical issues with printer access and service timeouts. This feature converts TabezaConnect from a Windows Service to a System Tray Application that runs in the user session (Session 1), resolving Session 0 isolation issues while maintaining all existing functionality.

The conversion addresses two fundamental Windows architecture constraints:
1. **Error 1053 Service Timeout**: Windows Services running as Local System in Session 0 have strict startup time limits
2. **Printer Access Failure**: Session 0 isolation prevents services from accessing USB printers and printer drivers that exist in user sessions (Session 1)

By running as a system tray application in Session 1, TabezaConnect gains direct access to printer hardware while providing users with visual status feedback and easy configuration access.

## Glossary

- **TabezaConnect**: The POS printer bridge application that captures receipt data and forwards it to cloud and physical printers
- **System_Tray_Application**: A Windows application that runs in the background with an icon in the system tray (notification area)
- **Session_0**: The Windows session where services run, isolated from user desktop and hardware
- **Session_1**: The Windows session where user applications run, with access to desktop and hardware
- **Express_Server**: The HTTP server (localhost:8765) that provides the API interface for TabezaConnect
- **Folder_Monitor**: The component that watches C:\TabezaPrints\ for new receipt files
- **Print_Bridge**: The component (final-bridge.js) that forwards receipt data to physical printers
- **Tray_Icon**: The visual indicator in the Windows system tray showing application status
- **Context_Menu**: The right-click menu displayed when user clicks the tray icon
- **Auto_Start**: The mechanism that launches the application automatically when user logs into Windows
- **Startup_Registry**: The Windows registry location (HKCU\Software\Microsoft\Windows\CurrentVersion\Run) that controls auto-start applications
- **Installer**: The Inno Setup installer that deploys TabezaConnect to user systems
- **Config_File**: The config.json file containing Bar ID, API URL, and other configuration settings
- **Status_Indicator**: The visual representation of connection status using colored tray icons (green=connected, red=error, yellow=warning)

## Requirements

### Requirement 1: Preserve Core Functionality

**User Story:** As a venue operator, I want TabezaConnect to continue capturing and forwarding receipts exactly as before, so that my existing POS integration remains unaffected.

#### Acceptance Criteria

1. THE Express_Server SHALL listen on localhost:8765 with identical API endpoints
2. THE Folder_Monitor SHALL watch C:\TabezaPrints\ for new receipt files using the same logic
3. THE Print_Bridge SHALL forward receipt data to physical printers using the existing final-bridge.js implementation
4. WHEN a receipt file is detected, THE System_Tray_Application SHALL upload it to the Tabeza cloud API
5. WHEN a receipt file is detected, THE System_Tray_Application SHALL forward it to the configured physical printer
6. THE System_Tray_Application SHALL maintain the same configuration file format (config.json)
7. THE System_Tray_Application SHALL support both capture modes (folder and spooler)
8. THE System_Tray_Application SHALL preserve all existing API endpoints (/api/status, /api/configure, /api/test-print, /api/printers/*)

### Requirement 2: System Tray Integration

**User Story:** As a venue operator, I want to see TabezaConnect's status in my system tray, so that I know the service is running and can access it easily.

#### Acceptance Criteria

1. THE System_Tray_Application SHALL display an icon in the Windows system tray
2. THE Tray_Icon SHALL use green color WHEN the application is connected and operational
3. THE Tray_Icon SHALL use red color WHEN the application encounters errors or cannot connect
4. THE Tray_Icon SHALL use yellow color WHEN the application is starting or in a warning state
5. WHEN the user hovers over the Tray_Icon, THE System_Tray_Application SHALL display a tooltip showing connection status
6. WHEN the user clicks the Tray_Icon, THE System_Tray_Application SHALL display the main window
7. WHEN the user right-clicks the Tray_Icon, THE System_Tray_Application SHALL display a Context_Menu
8. THE Context_Menu SHALL include options for: Settings, Test Print, View Logs, About, and Exit

### Requirement 3: Window Management

**User Story:** As a venue operator, I want the application to minimize to the tray instead of the taskbar, so that it stays out of my way while remaining accessible.

#### Acceptance Criteria

1. WHEN the user clicks the minimize button, THE System_Tray_Application SHALL hide the window and remain in the system tray
2. WHEN the user clicks the close button (X), THE System_Tray_Application SHALL hide the window and remain in the system tray
3. THE System_Tray_Application SHALL NOT display a taskbar button when minimized to tray
4. WHEN the user selects "Exit" from the Context_Menu, THE System_Tray_Application SHALL terminate completely
5. WHEN the user double-clicks the Tray_Icon, THE System_Tray_Application SHALL restore and show the main window
6. THE System_Tray_Application SHALL start minimized to tray on launch

### Requirement 4: Auto-Start on User Login

**User Story:** As a venue operator, I want TabezaConnect to start automatically when I log into Windows, so that I don't have to manually launch it every day.

#### Acceptance Criteria

1. THE Installer SHALL create a Startup_Registry entry in HKCU\Software\Microsoft\Windows\CurrentVersion\Run
2. THE Startup_Registry entry SHALL point to the TabezaConnect executable with the --minimized flag
3. WHEN Windows starts and the user logs in, THE System_Tray_Application SHALL launch automatically
4. WHEN launched via Auto_Start, THE System_Tray_Application SHALL start minimized to the system tray
5. THE System_Tray_Application SHALL NOT display a console window when launched via Auto_Start
6. THE System_Tray_Application SHALL NOT display a splash screen when launched via Auto_Start

### Requirement 5: Session 1 Printer Access

**User Story:** As a venue operator, I want TabezaConnect to reliably print to my USB thermal printer, so that physical receipts are generated without errors.

#### Acceptance Criteria

1. THE System_Tray_Application SHALL run in Session_1 (user session)
2. THE Print_Bridge SHALL access USB printers directly without Session 0 isolation restrictions
3. WHEN a receipt is forwarded to a physical printer, THE Print_Bridge SHALL successfully write data to the printer driver
4. THE System_Tray_Application SHALL NOT encounter "local comm error" due to session isolation
5. THE System_Tray_Application SHALL detect and list all available printers in the user session
6. WHEN the user selects a physical printer, THE System_Tray_Application SHALL verify the printer is accessible before saving the configuration

### Requirement 6: Visual Status Feedback

**User Story:** As a venue operator, I want to see at a glance whether TabezaConnect is working properly, so that I can quickly identify and resolve issues.

#### Acceptance Criteria

1. THE Status_Indicator SHALL display green WHEN the Express_Server is running and cloud connectivity is confirmed
2. THE Status_Indicator SHALL display red WHEN the Express_Server fails to start or cloud connectivity is lost
3. THE Status_Indicator SHALL display yellow WHEN the application is initializing or configuration is incomplete
4. WHEN the Status_Indicator changes color, THE System_Tray_Application SHALL update the Tray_Icon immediately
5. THE tooltip SHALL display the current status text (e.g., "Connected - Bar ID: 12345" or "Error: Cannot connect to cloud")
6. WHEN the user opens the main window, THE System_Tray_Application SHALL display detailed status information including Bar ID, API URL, and last activity timestamp

### Requirement 7: Configuration Management

**User Story:** As a venue operator, I want to easily configure TabezaConnect through a user interface, so that I don't need to manually edit configuration files.

#### Acceptance Criteria

1. THE Context_Menu SHALL include a "Settings" option
2. WHEN the user selects "Settings", THE System_Tray_Application SHALL open the configuration interface
3. THE configuration interface SHALL allow editing Bar ID, API URL, physical printer selection, and capture mode
4. WHEN the user saves configuration changes, THE System_Tray_Application SHALL update the Config_File
5. WHEN the user saves configuration changes, THE System_Tray_Application SHALL restart the Express_Server with new settings
6. THE System_Tray_Application SHALL preserve existing Config_File format for backward compatibility
7. THE System_Tray_Application SHALL validate configuration values before saving

### Requirement 8: Installer Conversion

**User Story:** As a venue operator, I want a simple installer that sets up TabezaConnect without requiring service configuration, so that installation is quick and error-free.

#### Acceptance Criteria

1. THE Installer SHALL NOT register TabezaConnect as a Windows Service
2. THE Installer SHALL copy application files to Program Files\Tabeza\TabezaConnect
3. THE Installer SHALL create the Startup_Registry entry for Auto_Start
4. THE Installer SHALL preserve existing Config_File if present during upgrade
5. WHEN an old Windows Service installation is detected, THE Installer SHALL uninstall the service before proceeding
6. WHEN an old Windows Service installation is detected, THE Installer SHALL preserve the existing Config_File
7. THE Installer SHALL create a desktop shortcut (optional, user-selectable)
8. WHEN installation completes, THE Installer SHALL launch the System_Tray_Application
9. THE Installer SHALL NOT require administrator privileges for normal operation (only for initial installation)

### Requirement 9: Graceful Shutdown

**User Story:** As a venue operator, I want TabezaConnect to shut down cleanly when I exit it, so that no data is lost and resources are properly released.

#### Acceptance Criteria

1. WHEN the user selects "Exit" from the Context_Menu, THE System_Tray_Application SHALL stop the Express_Server
2. WHEN the user selects "Exit", THE System_Tray_Application SHALL stop the Folder_Monitor
3. WHEN the user selects "Exit", THE System_Tray_Application SHALL stop the Print_Bridge
4. WHEN the user selects "Exit", THE System_Tray_Application SHALL flush any pending uploads to the cloud
5. WHEN the user selects "Exit", THE System_Tray_Application SHALL remove the Tray_Icon
6. THE System_Tray_Application SHALL complete shutdown within 5 seconds
7. WHEN shutdown is in progress, THE System_Tray_Application SHALL display a "Shutting down..." message in the tray tooltip

### Requirement 10: Logging and Diagnostics

**User Story:** As a venue operator, I want to view logs and diagnostic information, so that I can troubleshoot issues or provide information to support.

#### Acceptance Criteria

1. THE Context_Menu SHALL include a "View Logs" option
2. WHEN the user selects "View Logs", THE System_Tray_Application SHALL open the log file in the default text editor
3. THE System_Tray_Application SHALL write logs to C:\ProgramData\Tabeza\logs\tabezaconnect.log
4. THE System_Tray_Application SHALL rotate log files WHEN they exceed 10MB
5. THE System_Tray_Application SHALL preserve the most recent 5 log files
6. THE Context_Menu SHALL include a "Test Print" option
7. WHEN the user selects "Test Print", THE System_Tray_Application SHALL send a test receipt to both cloud and physical printer
8. WHEN a test print completes, THE System_Tray_Application SHALL display a notification showing success or failure

### Requirement 11: Error Handling and Recovery

**User Story:** As a venue operator, I want TabezaConnect to recover automatically from temporary errors, so that my receipt capture continues working without manual intervention.

#### Acceptance Criteria

1. WHEN the Express_Server fails to start due to port conflict, THE System_Tray_Application SHALL display an error notification with resolution steps
2. WHEN cloud connectivity is lost, THE System_Tray_Application SHALL queue receipts locally and retry upload
3. WHEN cloud connectivity is restored, THE System_Tray_Application SHALL upload all queued receipts
4. WHEN the physical printer is unavailable, THE System_Tray_Application SHALL log the error and continue cloud upload
5. WHEN the Config_File is missing or invalid, THE System_Tray_Application SHALL display a configuration prompt
6. THE System_Tray_Application SHALL attempt to reconnect to the cloud every 30 seconds WHEN connectivity is lost
7. WHEN the Folder_Monitor encounters an error, THE System_Tray_Application SHALL restart the monitor automatically

### Requirement 12: Backward Compatibility

**User Story:** As a venue operator upgrading from the Windows Service version, I want my existing configuration and setup to continue working, so that I don't need to reconfigure everything.

#### Acceptance Criteria

1. THE System_Tray_Application SHALL read configuration from the same Config_File location as the Windows Service version
2. THE System_Tray_Application SHALL support the same API endpoints as the Windows Service version
3. THE System_Tray_Application SHALL use the same folder paths (C:\TabezaPrints\, C:\ProgramData\Tabeza\) as the Windows Service version
4. WHEN upgrading from Windows Service, THE Installer SHALL detect and preserve the existing Config_File
5. WHEN upgrading from Windows Service, THE Installer SHALL uninstall the old service before installing the tray application
6. THE System_Tray_Application SHALL maintain compatibility with existing POS configurations that print to C:\TabezaPrints\
7. THE System_Tray_Application SHALL support the same command-line arguments as the Windows Service version for testing purposes

### Requirement 13: User Notifications

**User Story:** As a venue operator, I want to receive notifications about important events, so that I'm aware of issues that need attention.

#### Acceptance Criteria

1. WHEN the System_Tray_Application starts successfully, THE System_Tray_Application SHALL display a notification "TabezaConnect started"
2. WHEN configuration is incomplete, THE System_Tray_Application SHALL display a notification prompting the user to configure
3. WHEN a test print succeeds, THE System_Tray_Application SHALL display a notification "Test print successful"
4. WHEN a test print fails, THE System_Tray_Application SHALL display a notification with the error message
5. WHEN cloud connectivity is lost for more than 5 minutes, THE System_Tray_Application SHALL display a warning notification
6. WHEN the physical printer is unavailable, THE System_Tray_Application SHALL display a warning notification
7. THE System_Tray_Application SHALL NOT display more than one notification per minute to avoid notification spam

### Requirement 14: Minimal Code Changes

**User Story:** As a developer, I want to reuse the existing codebase with minimal modifications, so that the conversion is low-risk and maintains proven functionality.

#### Acceptance Criteria

1. THE System_Tray_Application SHALL use the existing index.js as the core service logic
2. THE System_Tray_Application SHALL use the existing final-bridge.js without modifications
3. THE System_Tray_Application SHALL use the existing Express server configuration without modifications
4. THE System_Tray_Application SHALL add a new tray-app.js wrapper that handles tray icon and window management
5. THE tray-app.js wrapper SHALL import and start the existing service code
6. THE System_Tray_Application SHALL require changes only to: startup mechanism, window management, and tray icon handling
7. THE System_Tray_Application SHALL NOT modify the core receipt capture, upload, or forwarding logic
