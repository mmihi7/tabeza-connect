# Requirements Document

## Introduction

This feature automates the creation and configuration of the Tabeza Pooling Printer for the TabezaConnect Windows service. Currently, printer pooling configuration must be done manually by users, which is error-prone and requires technical knowledge. This feature will automatically create a "Tabeza POS Printer" that mirrors an existing physical printer, configure the necessary ports for print job capture, and ensure the original printer workflow remains unchanged.

Pooling mode works by creating a printer with two ports: one physical port (USB, LPT, etc.) that prints to the actual printer, and one local port to a file (e.g., C:\TabezaPrints\order.prn) that captures print data. The TabezaConnect service monitors the capture file to intercept print jobs.

**Note on Print Job Processing (Context Only):**
This feature focuses solely on printer configuration. The actual print job processing follows a two-phase workflow handled by the existing TabezaConnect service:
- **Testing/Template Creation Phase:** Raw print jobs are uploaded to cloud (DeepSeek AI) to generate regex parsing templates, which are then stored locally
- **Production Phase:** Once templates exist, print jobs are parsed locally using the regex templates, and only the parsed structured data is sent to the cloud

This printer configuration feature enables the capture mechanism that feeds into this workflow.

## Glossary

- **Physical_Printer**: The existing thermal/POS printer hardware connected to the Windows system via USB, LPT, or network
- **Tabeza_POS_Printer**: The automatically created virtual printer that mirrors the Physical_Printer for print job capture
- **Capture_File**: The local file path (e.g., C:\TabezaPrints\order.prn) where print jobs are written for monitoring
- **Local_Port**: A Windows printer port that writes to a file path instead of a physical device
- **Physical_Port**: The original Windows printer port (USB, LPT, etc.) connected to the Physical_Printer hardware
- **Default_Printer**: The Windows system default printer that receives print jobs when no specific printer is selected
- **Print_Spooler**: The Windows Print Spooler service that manages print jobs
- **Pooling_Configuration**: The printer setup with multiple ports (physical + file capture)
- **Installer**: The TabezaConnect Windows installer application
- **TabezaConnect_Service**: The Windows service that monitors captured print jobs
- **Waiter_Workflow**: The existing process where waiters print receipts using the Physical_Printer

## Requirements

### Requirement 1: Automatic Printer Detection

**User Story:** As a venue owner, I want the system to automatically detect my existing thermal printer, so that I don't have to manually identify printer names and ports.

#### Acceptance Criteria

1. WHEN the Installer runs, THE System SHALL scan for available thermal printers on the Windows system
2. THE System SHALL exclude non-receipt printers (Microsoft Print to PDF, Fax, OneNote, XPS, Adobe PDF)
3. WHEN multiple thermal printers are detected, THE System SHALL prioritize printers with receipt-related keywords (Receipt, Thermal, POS, TM-, RP-, Epson, Star, Citizen, Bixolon, Sam4s)
4. THE System SHALL store the detected Physical_Printer name and Physical_Port information
5. IF no thermal printers are detected, THEN THE System SHALL display an error message with troubleshooting steps

### Requirement 2: Tabeza POS Printer Creation

**User Story:** As a venue owner, I want the system to automatically create a Tabeza POS Printer, so that print jobs can be captured without manual configuration.

#### Acceptance Criteria

1. WHEN a Physical_Printer is detected, THE System SHALL create a new printer named "Tabeza POS Printer"
2. THE Tabeza_POS_Printer SHALL use the same printer driver as the Physical_Printer
3. THE System SHALL configure the Tabeza_POS_Printer with two ports: the Physical_Port and a Local_Port
4. THE Local_Port SHALL point to the Capture_File path (C:\TabezaPrints\order.prn)
5. IF the Tabeza_POS_Printer already exists, THEN THE System SHALL skip creation and verify the existing configuration
6. THE System SHALL set the Tabeza_POS_Printer as not shared on the network

### Requirement 3: Local Port Configuration

**User Story:** As a system administrator, I want the local port to be properly configured, so that print jobs are captured to the correct file location.

#### Acceptance Criteria

1. WHEN creating the Local_Port, THE System SHALL verify the Capture_File directory exists
2. IF the Capture_File directory does not exist, THEN THE System SHALL create it with appropriate permissions
3. THE System SHALL grant the Print_Spooler service write access to the Capture_File directory
4. THE System SHALL create a Local_Port named "TabezaCapturePort" pointing to the Capture_File path
5. IF the Local_Port already exists, THEN THE System SHALL verify it points to the correct Capture_File path
6. THE System SHALL configure the Local_Port to enable bidirectional support

### Requirement 4: Default Printer Preservation

**User Story:** As a waiter, I want my existing printer to remain the default printer, so that my workflow is not disrupted.

#### Acceptance Criteria

1. BEFORE creating the Tabeza_POS_Printer, THE System SHALL record the current Default_Printer
2. AFTER creating the Tabeza_POS_Printer, THE System SHALL restore the original Default_Printer
3. THE System SHALL verify the Default_Printer was not changed by the configuration process
4. THE Tabeza_POS_Printer SHALL NOT be set as the Default_Printer
5. WHEN a waiter prints without selecting a printer, THE Physical_Printer SHALL receive the print job first

### Requirement 5: Print Order Verification

**User Story:** As a venue owner, I want to ensure the default printer prints first, so that receipts are delivered to customers without delay.

#### Acceptance Criteria

1. THE System SHALL verify that print jobs sent to the Default_Printer are processed before jobs sent to the Tabeza_POS_Printer
2. WHEN a test print is sent to the Default_Printer, THE Physical_Printer SHALL print the job
3. THE System SHALL verify the Capture_File is updated when print jobs are sent to the Tabeza_POS_Printer
4. THE System SHALL NOT introduce delays to the Physical_Printer print queue
5. WHEN the Physical_Printer is offline, THE Tabeza_POS_Printer SHALL NOT block print job capture

### Requirement 6: Pooling Configuration Validation

**User Story:** As a system administrator, I want the pooling configuration to be validated, so that I know the setup is correct before going live.

#### Acceptance Criteria

1. AFTER creating the Tabeza_POS_Printer, THE System SHALL verify both ports are configured correctly
2. THE System SHALL verify the Physical_Port is connected to the Physical_Printer hardware
3. THE System SHALL verify the Local_Port is writable by the Print_Spooler service
4. THE System SHALL send a test print job to verify the Capture_File is updated
5. IF validation fails, THEN THE System SHALL display specific error messages indicating which component failed
6. THE System SHALL log all validation steps and results to a configuration log file

### Requirement 7: Idempotent Configuration

**User Story:** As a system administrator, I want the configuration to be idempotent, so that re-running the installer does not create duplicate printers or break existing setups.

#### Acceptance Criteria

1. WHEN the Installer runs and the Tabeza_POS_Printer already exists, THE System SHALL verify the existing configuration
2. THE System SHALL update the Tabeza_POS_Printer configuration if ports or settings are incorrect
3. THE System SHALL NOT create duplicate printers with similar names
4. THE System SHALL preserve existing Capture_File data when reconfiguring
5. WHEN reconfiguring, THE System SHALL maintain the Default_Printer setting

### Requirement 8: Error Handling and Recovery

**User Story:** As a venue owner, I want clear error messages when configuration fails, so that I can resolve issues quickly.

#### Acceptance Criteria

1. IF printer creation fails due to insufficient permissions, THEN THE System SHALL display an error message requesting administrator privileges
2. IF the Physical_Printer driver is not available, THEN THE System SHALL display an error message with driver installation instructions
3. IF the Capture_File directory cannot be created, THEN THE System SHALL display an error message with the specific path and permission issue
4. WHEN configuration fails, THE System SHALL roll back partial changes to prevent invalid states
5. THE System SHALL log all errors with timestamps and detailed diagnostic information

### Requirement 9: Configuration Persistence

**User Story:** As a system administrator, I want the pooling configuration to persist across system reboots, so that the service continues to work reliably.

#### Acceptance Criteria

1. THE System SHALL store the Tabeza_POS_Printer configuration in the Windows registry
2. AFTER a system reboot, THE Tabeza_POS_Printer SHALL remain configured with both ports
3. THE System SHALL verify the Capture_File path is accessible after reboot
4. THE TabezaConnect_Service SHALL automatically resume monitoring the Capture_File after reboot
5. THE Default_Printer setting SHALL persist across reboots

### Requirement 10: Waiter Workflow Compatibility

**User Story:** As a waiter, I want my existing print workflow to remain unchanged, so that I can continue serving customers without learning new procedures.

#### Acceptance Criteria

1. WHEN a waiter prints from the POS system to the Physical_Printer, THE print job SHALL complete successfully
2. THE System SHALL NOT require waiters to select a different printer in the POS system
3. THE System SHALL NOT display additional print dialogs or prompts to waiters
4. WHEN the Tabeza_POS_Printer is configured, THE Waiter_Workflow SHALL remain identical to the pre-installation workflow
5. THE System SHALL NOT change printer settings that affect print quality, paper size, or margins

### Requirement 11: Administrative Privilege Handling

**User Story:** As a system administrator, I want the installer to handle administrative privileges correctly, so that printer configuration succeeds without manual intervention.

#### Acceptance Criteria

1. WHEN the Installer runs without administrator privileges, THE System SHALL request elevation before printer configuration
2. THE System SHALL verify administrator privileges before attempting to create printers or ports
3. IF privilege elevation is denied, THEN THE System SHALL display an error message and exit gracefully
4. THE System SHALL execute all printer configuration commands with administrator privileges
5. AFTER configuration completes, THE System SHALL release administrator privileges

### Requirement 12: Configuration Logging and Diagnostics

**User Story:** As a support technician, I want detailed logs of the configuration process, so that I can troubleshoot issues remotely.

#### Acceptance Criteria

1. THE System SHALL log all printer detection results with timestamps
2. THE System SHALL log all printer creation and port configuration steps
3. THE System SHALL log validation results including success and failure details
4. THE System SHALL store logs in C:\ProgramData\Tabeza\logs\configure-pooling.log
5. WHEN configuration fails, THE System SHALL include diagnostic information (printer names, port names, error codes) in the log file
6. THE System SHALL log the Default_Printer before and after configuration

## Special Requirements Guidance

### Printer Configuration Requirements

This feature involves complex Windows printer configuration that requires careful validation:

- All printer operations must be atomic and reversible
- Port configuration must be validated before printer creation
- Driver compatibility must be verified before attempting configuration
- The Windows Print Spooler service must be running and accessible
- Registry changes must be validated and logged

### Round-Trip Validation

While this is not a parser/serializer, the configuration should support verification:

- Configuration → Validation → Re-configuration should produce identical results
- Reading printer configuration → Modifying settings → Reading again should show expected changes
- This ensures idempotency and prevents configuration drift
