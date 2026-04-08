# Requirements Document: Electron App clawPDF Integration

## Introduction

This document specifies the requirements for migrating the Tabeza Connect Electron application from Windows printer pooling detection to clawPDF virtual printer detection. The system has transitioned from using printer pooling (which has fundamental limitations) to using clawPDF as a virtual printer foundation. The Electron app must be updated to detect, configure, and monitor clawPDF instead of the legacy printer pooling setup.

The migration ensures that the Electron app correctly identifies when clawPDF is installed and properly configured, automatically marks setup steps as complete when appropriate, and provides clear UI feedback about the printer system status.

## Glossary

- **Electron_App**: The main Tabeza Connect desktop application built with Electron framework
- **clawPDF**: Open-source virtual printer software used to capture print jobs from POS systems
- **Printer_Profile**: A clawPDF printer configuration named "Tabeza Agent"
- **Spool_Folder**: The directory where clawPDF writes captured print jobs (C:\TabezaPrints\spool\)
- **Setup_State_Manager**: Component that tracks completion status of onboarding steps
- **System_Tray_Icon**: Windows system tray icon showing Tabeza Connect status
- **Management_UI**: Web-based dashboard served at localhost:8765
- **Printer_Setup_Wizard**: UI flow guiding users through printer configuration
- **Background_Service**: Node.js service that processes captured print jobs
- **Printer_Pooling**: Legacy Windows printer configuration method (being replaced)
- **Auto_Detection**: Automatic identification of printer setup completion status

## Requirements

### Requirement 1: clawPDF Installation Detection

**User Story:** As a venue owner, I want the Electron app to automatically detect if clawPDF is installed, so that I know whether the printer system is ready.

#### Acceptance Criteria

1. WHEN the Electron_App starts, THE Electron_App SHALL check if clawPDF is installed on the system
2. THE Electron_App SHALL verify clawPDF installation by checking the registry key HKLM\SOFTWARE\clawSoft\clawPDF
3. IF clawPDF is not installed, THEN THE Electron_App SHALL set printer status to "not_installed"
4. IF clawPDF is installed, THEN THE Electron_App SHALL retrieve the clawPDF version from the registry
5. THE Electron_App SHALL log the clawPDF installation status and version to the service log

### Requirement 2: Printer Profile Detection

**User Story:** As a venue owner, I want the Electron app to detect if the "Tabeza Agent" profile exists in clawPDF, so that I know if the printer is configured correctly.

#### Acceptance Criteria

1. WHEN clawPDF is installed, THE Electron_App SHALL check for the existence of the "Tabeza Agent" profile
2. THE Electron_App SHALL verify the profile by checking the clawPDF profiles directory at C:\ProgramData\clawSoft\clawPDF\Profiles\
3. THE Electron_App SHALL read the profile configuration file Tabeza Agent.ini
4. IF the profile exists and contains valid configuration, THEN THE Electron_App SHALL set printer status to "profile_exists"
5. IF the profile does not exist, THEN THE Electron_App SHALL set printer status to "profile_missing"

### Requirement 3: Spool Folder Configuration Verification

**User Story:** As a venue owner, I want the Electron app to verify that the spool folder is configured correctly, so that print jobs are captured to the right location.

#### Acceptance Criteria

1. WHEN the "Tabeza Agent" profile exists, THE Electron_App SHALL verify the spool folder configuration
2. THE Electron_App SHALL read the AutoSaveDirectory setting from the profile configuration
3. THE Electron_App SHALL verify that AutoSaveDirectory is set to C:\TabezaPrints\spool\
4. THE Electron_App SHALL verify that the spool folder exists on the file system
5. IF the spool folder is configured correctly and exists, THEN THE Electron_App SHALL set printer status to "fully_configured"
6. IF the spool folder path is incorrect or the folder does not exist, THEN THE Electron_App SHALL set printer status to "misconfigured"

### Requirement 4: Automatic Setup Step Completion

**User Story:** As a venue owner, I want the printer setup step to be automatically marked complete when clawPDF is properly configured, so that I don't have to manually mark it complete.

#### Acceptance Criteria

1. WHEN the Electron_App detects printer status is "fully_configured", THE Electron_App SHALL check the Setup_State_Manager for the printer step completion status
2. IF the printer step is not marked complete, THEN THE Electron_App SHALL call Setup_State_Manager to mark the printer step as complete
3. THE Electron_App SHALL log the automatic completion action with timestamp
4. WHEN the printer step is marked complete, THE Electron_App SHALL update the System_Tray_Icon menu to reflect the new state
5. IF the printer step is already marked complete, THEN THE Electron_App SHALL log that no action is needed

### Requirement 5: System Tray Icon Status Indicators

**User Story:** As a venue owner, I want the system tray icon to show the current printer status, so that I can quickly see if there are any issues.

#### Acceptance Criteria

1. WHEN clawPDF is not installed, THE Electron_App SHALL display a grey System_Tray_Icon
2. WHEN clawPDF is installed but the profile is missing, THE Electron_App SHALL display an orange System_Tray_Icon
3. WHEN clawPDF is fully configured and the Background_Service is running, THE Electron_App SHALL display a green System_Tray_Icon
4. WHEN the Background_Service encounters an error, THE Electron_App SHALL display a red System_Tray_Icon
5. THE Electron_App SHALL update the System_Tray_Icon tooltip to describe the current printer status

### Requirement 6: Printer Setup Wizard Integration

**User Story:** As a venue owner, I want the setup wizard to guide me through clawPDF installation and configuration, so that I can get the printer working correctly.

#### Acceptance Criteria

1. WHEN the Printer_Setup_Wizard is opened, THE Electron_App SHALL display the current clawPDF installation status
2. IF clawPDF is not installed, THEN THE Printer_Setup_Wizard SHALL display instructions for downloading and installing clawPDF
3. IF clawPDF is installed but not configured, THEN THE Printer_Setup_Wizard SHALL display instructions for creating the "Tabeza Agent" profile
4. THE Printer_Setup_Wizard SHALL provide a "Test Print" button to verify the printer configuration
5. WHEN the user clicks "Test Print", THE Electron_App SHALL send a test print job to the "Tabeza Agent" profile
6. THE Printer_Setup_Wizard SHALL display success or error messages based on the test print result

### Requirement 7: Legacy Printer Pooling Code Removal

**User Story:** As a developer, I want the legacy printer pooling detection code removed, so that the codebase is clean and maintainable.

#### Acceptance Criteria

1. THE Electron_App SHALL remove all references to printer-pooling-setup.ps1
2. THE Electron_App SHALL remove the autoDetectPrinterSetup function that calls the PowerShell script
3. THE Electron_App SHALL replace the removed function with a new clawPDFDetector module
4. THE Electron_App SHALL remove any printer pooling configuration checks from the codebase
5. THE Electron_App SHALL update all comments and documentation to reference clawPDF instead of printer pooling

### Requirement 8: clawPDF Detection Module

**User Story:** As a developer, I want a dedicated module for clawPDF detection, so that the detection logic is reusable and testable.

#### Acceptance Criteria

1. THE Electron_App SHALL create a new module at src/utils/clawpdf-detector.js
2. THE clawPDF_Detector module SHALL export a function checkClawPDFInstallation that returns installation status
3. THE clawPDF_Detector module SHALL export a function checkPrinterProfile that returns profile configuration status
4. THE clawPDF_Detector module SHALL export a function verifySpoolFolder that returns spool folder status
5. THE clawPDF_Detector module SHALL export a function getFullPrinterStatus that returns a complete status object
6. THE status object SHALL contain fields for installed, profileExists, spoolConfigured, version, and statusMessage

### Requirement 9: Management UI Printer Status Display

**User Story:** As a venue owner, I want to see the printer status in the Management UI, so that I can troubleshoot issues.

#### Acceptance Criteria

1. WHEN the Management_UI dashboard loads, THE Electron_App SHALL provide printer status data via IPC
2. THE Management_UI SHALL display the clawPDF installation status (installed/not installed)
3. THE Management_UI SHALL display the printer profile status (configured/not configured)
4. THE Management_UI SHALL display the spool folder path and status
5. THE Management_UI SHALL display the last print job timestamp if available
6. THE Management_UI SHALL provide a "Refresh Status" button to re-check the printer configuration

### Requirement 10: Backward Compatibility During Migration

**User Story:** As a venue owner with an existing installation, I want the app to continue working during the migration period, so that my business is not disrupted.

#### Acceptance Criteria

1. WHEN the Electron_App detects both printer pooling and clawPDF configurations, THE Electron_App SHALL prioritize clawPDF detection
2. THE Electron_App SHALL log a migration notice when both configurations are detected
3. IF clawPDF is not detected but printer pooling is configured, THEN THE Electron_App SHALL display a migration prompt in the Management_UI
4. THE migration prompt SHALL provide instructions for installing clawPDF
5. THE Electron_App SHALL continue to function with printer pooling until clawPDF is fully configured

### Requirement 11: Error Handling and User Feedback

**User Story:** As a venue owner, I want clear error messages when printer detection fails, so that I know how to fix the problem.

#### Acceptance Criteria

1. WHEN clawPDF detection fails due to registry access errors, THE Electron_App SHALL log the error with details
2. WHEN the profile configuration file cannot be read, THE Electron_App SHALL display an error message with the file path
3. WHEN the spool folder does not exist, THE Electron_App SHALL display an error message with instructions to create it
4. THE Electron_App SHALL provide actionable error messages that include specific steps to resolve the issue
5. THE Electron_App SHALL display error messages in both the System_Tray_Icon tooltip and the Management_UI

### Requirement 12: Startup Detection Performance

**User Story:** As a venue owner, I want the app to start quickly, so that I can begin using it without delay.

#### Acceptance Criteria

1. THE Electron_App SHALL complete clawPDF detection within 2 seconds of startup
2. THE Electron_App SHALL perform detection asynchronously to avoid blocking the UI
3. THE Electron_App SHALL cache detection results for 30 seconds to avoid repeated checks
4. WHEN the Management_UI is opened, THE Electron_App SHALL use cached detection results if available
5. THE Electron_App SHALL provide a manual refresh option to bypass the cache

### Requirement 13: Test Print Functionality

**User Story:** As a venue owner, I want to send a test print to verify the printer is working, so that I can confirm the setup is correct.

#### Acceptance Criteria

1. THE Printer_Setup_Wizard SHALL provide a "Send Test Print" button
2. WHEN the user clicks "Send Test Print", THE Electron_App SHALL generate a test receipt with sample data
3. THE Electron_App SHALL send the test receipt to the "Tabeza Agent" profile
4. THE Electron_App SHALL monitor the Spool_Folder for the captured test print file
5. IF the test print file appears within 5 seconds, THEN THE Electron_App SHALL display a success message
6. IF the test print file does not appear within 5 seconds, THEN THE Electron_App SHALL display an error message with troubleshooting steps

### Requirement 14: Configuration Validation

**User Story:** As a venue owner, I want the app to validate the printer configuration, so that I know if there are any issues before I start using it.

#### Acceptance Criteria

1. THE Electron_App SHALL validate that the clawPDF version is 0.9.0 or higher
2. THE Electron_App SHALL validate that the "Tabeza Agent" profile has AutoSave enabled
3. THE Electron_App SHALL validate that the profile output format is set to PostScript
4. THE Electron_App SHALL validate that the spool folder has write permissions
5. IF any validation fails, THEN THE Electron_App SHALL display a warning message with the specific issue
6. THE Electron_App SHALL log all validation results to the service log

### Requirement 15: Real-Time Status Updates

**User Story:** As a venue owner, I want the printer status to update in real-time, so that I can see changes immediately.

#### Acceptance Criteria

1. WHEN the Printer_Setup_Wizard window is focused, THE Electron_App SHALL sync the current printer status to the window
2. WHEN the printer configuration changes, THE Electron_App SHALL broadcast the status update to all open windows
3. THE Electron_App SHALL use the existing BroadcastManager to send printer status updates
4. THE Management_UI SHALL listen for printer status updates and refresh the display automatically
5. THE System_Tray_Icon SHALL update immediately when the printer status changes
