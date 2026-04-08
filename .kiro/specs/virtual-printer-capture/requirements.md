# Requirements Document: Virtual Printer Capture Architecture (clawPDF-Based)

## Introduction

This specification defines the migration of Tabeza Connect from a broken Windows printer pooling approach to a robust virtual printer architecture using clawPDF as the foundation. The current system attempts to use Windows printer pooling to duplicate print jobs to both a physical printer and a capture file, but this approach is fundamentally flawed because Windows pooling does not duplicate jobs—once a job prints to one port, it cannot print to another.

The new architecture leverages clawPDF (https://github.com/clawsoftware/clawPDF), an open-source virtual printer for Windows, to intercept print jobs from POS systems, capture the raw data to disk, and transparently forward jobs to the physical printer. This approach works reliably with all printer types (thermal ESC/POS, inkjet, USB, network) and maintains complete transparency to the POS system.

### Why clawPDF?

- **Proven virtual printer infrastructure** - Battle-tested on Windows 7-11, including Server editions
- **Open source (AGPL v3)** - Can be customized and bundled with Tabeza Connect
- **Scripting interface** - Supports automation via command line and scripting
- **Multiple printer profiles** - Can create "Tabeza Agent" with custom configuration
- **Raw data access** - Can save print jobs as raw PostScript/PCL files before conversion
- **No custom driver development** - Eliminates months of C++ driver work and code signing complexity

## Glossary

- **ClawPDF**: An open-source virtual printer for Windows that intercepts print jobs and can save them in various formats
- **Tabeza_POS_Printer**: A clawPDF printer instance configured with the name "Tabeza Agent" that captures print jobs to a monitored folder
- **Tabeza_Capture_Service**: A Windows Service that monitors the clawPDF output folder, processes captured print jobs, saves raw data to disk, and forwards jobs to the physical printer
- **Receipt_Parser**: A component that reads captured ESC/POS data and normalizes it to structured JSON format
- **Physical_Printer_Adapter**: A component that handles sending print jobs to USB or network printers using appropriate protocols
- **Job_Queue**: An ordered collection of print jobs awaiting processing or forwarding to ensure print order is preserved
- **POS_System**: The venue's existing Point of Sale system that generates receipts
- **ESC/POS**: A printer command language used by thermal receipt printers
- **Print_Job**: A complete set of printer commands and data representing one receipt
- **Capture_File**: A timestamped file containing raw print data saved to C:\TabezaPrints\order_{timestamp}.prn
- **Forwarding**: The process of sending a captured print job to the physical printer
- **Template_Parser**: A regex-based parser that extracts structured data from captured receipts using venue-specific patterns

## Requirements

### Requirement 1: ClawPDF Installation and Configuration

**User Story:** As a venue owner, I want clawPDF to be installed and configured automatically during Tabeza Connect setup, so that my POS system can print to "Tabeza Agent" without any manual configuration.

#### Acceptance Criteria

1. WHEN the Tabeza Connect installer runs, THE Installer SHALL install clawPDF silently using the MSI installer
2. THE Installer SHALL create a clawPDF printer profile named "Tabeza Agent"
3. THE clawPDF profile SHALL be configured to save print jobs as raw PostScript files to C:\TabezaPrints\spool\
4. THE clawPDF profile SHALL be configured for automatic/silent printing (no user prompts)
5. THE "Tabeza Agent" SHALL appear in Windows printer settings as a standard printer device
6. WHEN a POS_System sends a print job to "Tabeza Agent", THE clawPDF printer SHALL intercept the job and save it to the spool folder
7. THE clawPDF printer SHALL work on Windows 10 and Windows 11 (both 32-bit and 64-bit)
8. IF the installation fails, THEN THE Installer SHALL display a descriptive error message and roll back changes

### Requirement 2: Print Job Capture

**User Story:** As a venue owner, I want all print jobs to be captured to disk automatically, so that I have a complete record of all receipts for analytics and customer service.

#### Acceptance Criteria

1. WHEN a Print_Job is sent to "Tabeza Agent", THE clawPDF printer SHALL save the raw print data to C:\TabezaPrints\spool\{jobId}.ps
2. THE Tabeza_Capture_Service SHALL monitor C:\TabezaPrints\spool\ using a file watcher
3. WHEN a new file appears in the spool folder, THE Tabeza_Capture_Service SHALL read the file and copy it to C:\TabezaPrints\order_{timestamp}.prn
4. THE Capture_File SHALL use a timestamp format of YYYYMMDD-HHMMSS-mmm (milliseconds) to ensure unique filenames
5. THE Tabeza_Capture_Service SHALL preserve all ESC/POS control codes and binary data in the Capture_File
6. WHEN multiple print jobs arrive simultaneously, THE Tabeza_Capture_Service SHALL process them in the order received
7. THE Tabeza_Capture_Service SHALL complete the capture operation within 100ms of detecting the spool file
8. IF disk space is below 500MB, THEN THE Tabeza_Capture_Service SHALL log a warning and continue capturing
9. IF disk space is below 100MB, THEN THE Tabeza_Capture_Service SHALL stop capturing and display an error notification
10. AFTER successfully capturing a print job, THE Tabeza_Capture_Service SHALL delete the spool file to prevent re-processing

### Requirement 3: Transparent Print Forwarding

**User Story:** As a POS operator, I want receipts to print on the physical printer exactly as they did before Tabeza Connect, so that my workflow is not disrupted.

#### Acceptance Criteria

1. WHEN a Print_Job is captured, THE Physical_Printer_Adapter SHALL forward the job to the configured physical printer
2. THE Physical_Printer_Adapter SHALL preserve all print data exactly as received from the POS_System
3. THE Physical_Printer_Adapter SHALL support USB-connected thermal printers
4. THE Physical_Printer_Adapter SHALL support network-connected printers (IP address or hostname)
5. THE Physical_Printer_Adapter SHALL support serial port printers (COM1-COM9)
6. WHEN the physical printer is ready, THE Physical_Printer_Adapter SHALL forward the job within 200ms of capture completion
7. THE Physical_Printer_Adapter SHALL maintain print quality identical to direct POS-to-printer connections
8. THE Physical_Printer_Adapter SHALL not modify, reformat, or interpret the print data during forwarding

### Requirement 4: Physical Printer Error Handling

**User Story:** As a venue owner, I want the system to handle physical printer errors gracefully, so that print jobs are not lost when the printer is offline or busy.

#### Acceptance Criteria

1. WHEN the physical printer is offline, THE Physical_Printer_Adapter SHALL add the Print_Job to the Job_Queue
2. THE Physical_Printer_Adapter SHALL retry forwarding with exponential backoff (5s, 10s, 20s, 40s, 60s)
3. WHEN the physical printer becomes available, THE Physical_Printer_Adapter SHALL drain the Job_Queue in order
4. IF a Print_Job fails after 5 retry attempts, THEN THE Tabeza_Capture_Service SHALL move it to a failed_prints folder
5. THE Tabeza_Capture_Service SHALL log all forwarding failures with timestamp, error code, and printer status
6. WHEN a Print_Job is in the Job_Queue, THE Management_UI SHALL display the queue depth and oldest job timestamp
7. THE Physical_Printer_Adapter SHALL detect printer status (ready, busy, offline, paper out, error) before forwarding
8. IF the printer reports "paper out", THEN THE Tabeza_Capture_Service SHALL display a notification to venue staff

### Requirement 5: Receipt Parsing and Normalization

**User Story:** As a venue owner, I want captured receipts to be parsed into structured data automatically, so that I can view order details in the Tabeza dashboard.

#### Acceptance Criteria

1. WHEN a Capture_File is created, THE Receipt_Parser SHALL read the file and strip ESC/POS control codes
2. THE Receipt_Parser SHALL apply the venue-specific Template_Parser to extract structured data
3. THE Receipt_Parser SHALL produce JSON output containing items, quantities, prices, and total
4. THE Receipt_Parser SHALL include a confidence score (0.0 to 1.0) indicating parse quality
5. IF the confidence score is below 0.85, THEN THE Receipt_Parser SHALL flag the receipt for manual review
6. THE Receipt_Parser SHALL complete parsing within 50ms per receipt
7. IF no Template_Parser exists, THEN THE Receipt_Parser SHALL save the raw text and mark the receipt as unparsed
8. THE Receipt_Parser SHALL handle receipts up to 10KB in size without performance degradation

### Requirement 6: Parsed Receipt Upload

**User Story:** As a venue owner, I want parsed receipts to be uploaded to the Tabeza cloud automatically, so that customers can receive digital receipts.

#### Acceptance Criteria

1. WHEN a receipt is parsed successfully, THE Tabeza_Capture_Service SHALL add it to the upload queue
2. THE Tabeza_Capture_Service SHALL POST parsed receipt JSON to /api/receipts/ingest
3. THE Tabeza_Capture_Service SHALL include barId, driverId, timestamp, and confidence in the upload payload
4. WHEN the upload succeeds, THE Tabeza_Capture_Service SHALL move the receipt to the uploaded folder
5. IF the upload fails, THEN THE Tabeza_Capture_Service SHALL retry with exponential backoff (5s, 10s, 20s, 40s)
6. THE Tabeza_Capture_Service SHALL preserve receipts in the pending folder across service restarts
7. WHEN the internet connection is restored, THE Tabeza_Capture_Service SHALL drain the pending queue automatically
8. THE Tabeza_Capture_Service SHALL upload receipts in the order they were captured

### Requirement 7: Windows Service Management

**User Story:** As a venue owner, I want Tabeza Connect to run automatically on system startup, so that receipt capture works without manual intervention.

#### Acceptance Criteria

1. THE Tabeza_Capture_Service SHALL be registered as a Windows Service named "TabezaConnect"
2. THE Tabeza_Capture_Service SHALL run under the LocalSystem account with appropriate privileges
3. THE Tabeza_Capture_Service SHALL start automatically on Windows boot
4. THE Tabeza_Capture_Service SHALL continue running when no user is logged in
5. WHEN the service crashes, THE Windows_Service_Manager SHALL restart it automatically within 60 seconds
6. THE Tabeza_Capture_Service SHALL log startup, shutdown, and crash events to the Windows Event Log
7. THE Tabeza_Capture_Service SHALL expose a health check endpoint on localhost:8765/health
8. THE Tabeza_Capture_Service SHALL send a heartbeat to the cloud every 30 seconds

### Requirement 8: Physical Printer Configuration

**User Story:** As a venue owner, I want to configure which physical printer receives forwarded jobs, so that I can use my existing printer hardware.

#### Acceptance Criteria

1. THE Management_UI SHALL display a printer configuration page at localhost:8765/settings/printer
2. THE Management_UI SHALL list all available printers (USB, network, serial) detected on the system
3. WHEN a venue owner selects a physical printer, THE Management_UI SHALL save the selection to config.json
4. THE Management_UI SHALL allow manual entry of network printer IP addresses
5. THE Management_UI SHALL provide a "Test Print" button that sends a test receipt to the configured printer
6. WHEN the test print succeeds, THE Management_UI SHALL display "✓ Printer configured successfully"
7. IF the test print fails, THEN THE Management_UI SHALL display the error message and suggest troubleshooting steps
8. THE Physical_Printer_Adapter SHALL reload configuration when config.json changes without requiring service restart

### Requirement 9: Installation and Migration

**User Story:** As a venue owner upgrading from the old pooling system, I want the installer to migrate my configuration automatically, so that I don't lose my Bar ID or template settings.

#### Acceptance Criteria

1. WHEN the installer detects an existing Tabeza Connect installation, THE Installer SHALL preserve config.json and template.json
2. THE Installer SHALL remove the old "Tabeza Agent" pooling printer configuration
3. THE Installer SHALL install clawPDF silently using the bundled MSI installer
4. THE Installer SHALL create a clawPDF printer profile named "Tabeza Agent" configured for raw PostScript output
5. THE Installer SHALL migrate the Bar ID from the old configuration to the new configuration
6. THE Installer SHALL preserve all captured receipts in C:\TabezaPrints\processed
7. WHEN migration completes, THE Installer SHALL display a summary of migrated settings
8. THE Installer SHALL create a backup of the old configuration at C:\TabezaPrints\backup\config_backup_{timestamp}.json
9. IF migration fails, THEN THE Installer SHALL restore the backup and display an error message
10. THE Installer SHALL configure clawPDF to use C:\TabezaPrints\spool\ as the output directory

### Requirement 10: Logging and Diagnostics

**User Story:** As a support engineer, I want comprehensive logs of all capture and forwarding operations, so that I can troubleshoot issues quickly.

#### Acceptance Criteria

1. THE Tabeza_Capture_Service SHALL log all print job captures with timestamp, size, and filename
2. THE Tabeza_Capture_Service SHALL log all forwarding attempts with timestamp, printer status, and result
3. THE Tabeza_Capture_Service SHALL log all parsing operations with confidence score and item count
4. THE Tabeza_Capture_Service SHALL log all upload attempts with HTTP status code and response time
5. THE Tabeza_Capture_Service SHALL rotate log files daily and keep 30 days of history
6. THE Tabeza_Capture_Service SHALL limit log file size to 10MB per file
7. THE Management_UI SHALL display the last 1000 log entries in real-time at localhost:8765/logs
8. THE Management_UI SHALL provide a "Download Logs" button that creates a ZIP file of all logs

### Requirement 11: Performance and Reliability

**User Story:** As a venue owner, I want the system to handle high-volume printing during busy periods, so that receipt capture doesn't slow down service.

#### Acceptance Criteria

1. THE Tabeza_Capture_Service SHALL process at least 10 print jobs per second without queuing delays
2. THE Tabeza_Capture_Service SHALL use less than 200MB of RAM during normal operation
3. THE Tabeza_Capture_Service SHALL use less than 5% CPU during normal operation
4. THE Virtual_Printer_Driver SHALL add less than 50ms latency to print job processing
5. THE Tabeza_Capture_Service SHALL handle print jobs up to 1MB in size
6. THE Job_Queue SHALL support at least 1000 pending jobs without performance degradation
7. THE Tabeza_Capture_Service SHALL recover from crashes within 60 seconds without losing queued jobs
8. THE Tabeza_Capture_Service SHALL operate continuously for 30 days without requiring restart

### Requirement 12: Security and Permissions

**User Story:** As a venue owner, I want the system to operate securely, so that receipt data is protected from unauthorized access.

#### Acceptance Criteria

1. THE Tabeza_Capture_Service SHALL run with minimum required Windows privileges
2. THE Capture_File directory SHALL have permissions restricted to SYSTEM and Administrators
3. THE Tabeza_Capture_Service SHALL encrypt the Bar ID in config.json using DPAPI
4. THE Tabeza_Capture_Service SHALL use HTTPS for all cloud API communication
5. THE Management_UI SHALL only accept connections from localhost (127.0.0.1)
6. THE Tabeza_Capture_Service SHALL validate all configuration file inputs to prevent injection attacks
7. THE Tabeza_Capture_Service SHALL not log sensitive data (Bar ID, API keys) in plain text
8. THE Virtual_Printer_Driver SHALL prevent unauthorized applications from intercepting print jobs

### Requirement 13: Uninstallation and Cleanup

**User Story:** As a venue owner, I want to uninstall Tabeza Connect cleanly, so that my system is restored to its original state if needed.

#### Acceptance Criteria

1. WHEN the uninstaller runs, THE Uninstaller SHALL stop and remove the Tabeza_Capture_Service
2. THE Uninstaller SHALL remove the "Tabeza Agent" clawPDF printer profile
3. THE Uninstaller SHALL optionally uninstall clawPDF if no other clawPDF printers exist
4. THE Uninstaller SHALL prompt the user to keep or delete captured receipt data
5. IF the user chooses to delete data, THEN THE Uninstaller SHALL remove C:\TabezaPrints and all subdirectories
6. THE Uninstaller SHALL remove registry entries at HKLM\SOFTWARE\Tabeza\TabezaConnect
7. THE Uninstaller SHALL remove the system tray icon from startup
8. THE Uninstaller SHALL create a final backup of config.json and template.json before deletion
9. WHEN uninstallation completes, THE Uninstaller SHALL display a summary of removed components

### Requirement 14: Pretty Printer for Receipts

**User Story:** As a developer, I want a pretty printer that formats parsed receipt data back into readable text, so that I can verify parsing accuracy.

#### Acceptance Criteria

1. THE Receipt_Parser SHALL include a Pretty_Printer component that formats parsed JSON back to text
2. THE Pretty_Printer SHALL produce output that matches the original receipt layout
3. THE Pretty_Printer SHALL preserve item names, quantities, prices, and totals
4. THE Pretty_Printer SHALL format currency values with 2 decimal places
5. THE Pretty_Printer SHALL align columns to match the original receipt format
6. THE Management_UI SHALL display both raw and pretty-printed versions of captured receipts
7. THE Pretty_Printer SHALL handle receipts with up to 100 line items without truncation
8. FOR ALL valid parsed receipts, parsing then pretty-printing then parsing SHALL produce equivalent structured data (round-trip property)

### Requirement 15: Template Generation Workflow

**User Story:** As a venue owner, I want to generate a receipt parser template during setup, so that my receipts are parsed accurately from the first print.

#### Acceptance Criteria

1. WHEN no template.json exists, THE Management_UI SHALL display a "Generate Template" wizard
2. THE Management_UI SHALL prompt the user to print 3 different test receipts from the POS_System
3. WHEN each test receipt is captured, THE Management_UI SHALL display "✓ Receipt N received"
4. WHEN all 3 receipts are captured, THE Management_UI SHALL send them to /api/receipts/generate-template
5. THE Cloud_API SHALL use AI to analyze the receipts and generate a regex-based Template_Parser
6. WHEN the template is generated, THE Management_UI SHALL save it to C:\ProgramData\Tabeza\template.json
7. THE Management_UI SHALL display "✅ Template created successfully" with a sample parsed receipt
8. IF template generation fails, THEN THE Management_UI SHALL allow the user to retry with different receipts

### Requirement 15A: Template Requirement Warning and Blocking

**User Story:** As a venue owner, I need to be clearly warned when no template exists, so that I understand the system cannot parse receipts until template generation is complete.

#### Acceptance Criteria

1. WHEN the service starts AND no template.json exists, THE Tabeza_Capture_Service SHALL log a WARNING: "No receipt template found - receipts will be captured but not parsed"
2. WHEN the Management_UI loads AND no template.json exists, THE Management_UI SHALL display a prominent warning banner: "⚠️ Setup Required: Generate receipt template to enable cloud integration"
3. THE warning banner SHALL include a "Generate Template Now" button that opens the template generation wizard
4. WHEN a receipt is captured AND no template exists, THE Tabeza_Capture_Service SHALL:
   - Save the raw receipt text to the failed folder
   - Log: "Receipt captured but not parsed - no template configured"
   - NOT upload to cloud (since unparsed data is not useful)
5. THE System_Tray_Icon SHALL display an orange/warning icon when no template exists
6. WHEN the user hovers over the tray icon AND no template exists, THE tooltip SHALL display: "Setup incomplete - template required"
7. THE Management_UI dashboard SHALL display setup status: "Template Status: ❌ Not configured" with a "Setup Now" link
8. AFTER template.json is successfully created, THE warning banner SHALL disappear and the tray icon SHALL turn green
9. THE Management_UI SHALL prevent access to "View Receipts" or "Upload Queue" pages when no template exists, showing instead: "Complete template setup first"
10. WHEN the installer completes, THE installer SHALL automatically open the Management_UI to the template generation wizard

### Requirement 16: Multi-Printer Support

**User Story:** As a venue owner with multiple physical printers, I want to configure different printers for different purposes, so that I can route receipts appropriately.

#### Acceptance Criteria

1. THE Management_UI SHALL allow configuration of multiple physical printers with descriptive names
2. THE Management_UI SHALL allow setting a default printer for all forwarded jobs
3. THE Management_UI SHALL allow printer selection based on print job size (small receipts vs. large orders)
4. WHEN a Print_Job is captured, THE Physical_Printer_Adapter SHALL select the appropriate printer based on configuration rules
5. THE Physical_Printer_Adapter SHALL maintain separate Job_Queues for each configured printer
6. THE Management_UI SHALL display queue depth and status for each configured printer
7. IF a printer is offline, THEN THE Physical_Printer_Adapter SHALL not route new jobs to that printer
8. THE Physical_Printer_Adapter SHALL support at least 5 configured printers simultaneously

### Requirement 17: Offline Operation

**User Story:** As a venue owner, I want receipt capture to work during internet outages, so that my POS operations are not disrupted by connectivity issues.

#### Acceptance Criteria

1. WHEN the internet connection is unavailable, THE Tabeza_Capture_Service SHALL continue capturing and parsing receipts
2. THE Tabeza_Capture_Service SHALL queue parsed receipts in the pending folder during offline periods
3. THE Management_UI SHALL display "Offline Mode" status when the cloud API is unreachable
4. WHEN the internet connection is restored, THE Tabeza_Capture_Service SHALL upload all pending receipts automatically
5. THE Tabeza_Capture_Service SHALL continue forwarding to physical printers during offline periods
6. THE Management_UI SHALL display the count of pending receipts awaiting upload
7. THE Tabeza_Capture_Service SHALL not block print forwarding while waiting for upload retries
8. THE Tabeza_Capture_Service SHALL operate for at least 7 days offline without data loss

### Requirement 18: System Tray Indicator

**User Story:** As a venue owner, I want a system tray icon that shows Tabeza Connect status, so that I can quickly check if the system is working.

#### Acceptance Criteria

1. THE System_Tray_Icon SHALL display a green icon when the Tabeza_Capture_Service is online and healthy
2. THE System_Tray_Icon SHALL display a yellow icon when the physical printer is offline or the Job_Queue has pending items
3. THE System_Tray_Icon SHALL display a red icon when the Tabeza_Capture_Service is stopped or crashed
4. THE System_Tray_Icon SHALL display a grey icon when no template.json exists (setup incomplete)
5. WHEN the user right-clicks the icon, THE System_Tray_Icon SHALL show a menu with "Open Dashboard", "Test Print", "View Logs", "Quit"
6. WHEN the user clicks "Open Dashboard", THE System_Tray_Icon SHALL open localhost:8765 in the default browser
7. WHEN the user hovers over the icon, THE System_Tray_Icon SHALL display a tooltip with service status and last activity time
8. THE System_Tray_Icon SHALL start automatically at user login via Windows registry Run key

### Requirement 19: Cloud API Integration

**User Story:** As a Tabeza platform developer, I want the capture service to integrate with existing cloud APIs, so that digital receipts are delivered to customers.

#### Acceptance Criteria

1. THE Tabeza_Capture_Service SHALL POST parsed receipts to /api/receipts/ingest with barId, driverId, timestamp, and receipt data
2. THE Tabeza_Capture_Service SHALL POST heartbeats to /api/printer/heartbeat every 30 seconds with status and version
3. THE Tabeza_Capture_Service SHALL GET template updates from /api/receipts/template/{barId} daily
4. THE Tabeza_Capture_Service SHALL include the API version header "X-Tabeza-Connect-Version" in all requests
5. WHEN the cloud API returns HTTP 401, THE Tabeza_Capture_Service SHALL log an authentication error and notify the user
6. WHEN the cloud API returns HTTP 429, THE Tabeza_Capture_Service SHALL respect rate limits and retry after the specified delay
7. THE Tabeza_Capture_Service SHALL timeout API requests after 30 seconds
8. THE Tabeza_Capture_Service SHALL validate SSL certificates for all HTTPS connections

### Requirement 20: Backward Compatibility

**User Story:** As a venue owner, I want my existing POS configuration to work with the new clawPDF-based printer, so that I don't need to reconfigure my POS system.

#### Acceptance Criteria

1. THE clawPDF printer SHALL use the same printer name "Tabeza Agent" as the old pooling system
2. THE clawPDF printer SHALL support the same ESC/POS command set as the old system
3. THE clawPDF printer SHALL accept print jobs from all POS systems that worked with the old pooling printer
4. THE Tabeza_Capture_Service SHALL read existing template.json files without requiring regeneration
5. THE Tabeza_Capture_Service SHALL process receipts in the old processed folder during migration
6. THE Management_UI SHALL display receipts captured by both old and new systems in a unified view
7. THE Cloud_API SHALL accept receipt uploads from both old and new capture methods
8. THE Tabeza_Capture_Service SHALL maintain the same folder structure (C:\TabezaPrints\processed, failed, pending)
