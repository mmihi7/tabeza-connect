# Requirements Document

## Introduction

Tabeza Connect v1.7.0 currently implements a working file watcher service that captures POS receipts via Windows printer pooling. However, several critical components defined in the architecture are missing: the Management UI, HTTP server, queue system, template parser, registry reading, and system tray integration. This feature implements these missing components to complete the v1.7.0 architecture.

## Glossary

- **Management_UI**: Web-based dashboard served on localhost:8765 for configuring and monitoring Tabeza Connect
- **HTTP_Server**: Express server running on localhost:8765 that serves the Management UI and provides API endpoints
- **Queue_System**: Offline-resilient file-based queue that stores parsed receipts in pending/ and uploaded/ folders
- **Upload_Worker**: Background process that uploads receipts from the queue with exponential backoff retry logic
- **Template_Parser**: Local regex-based receipt parser that uses template.json to extract structured data from raw ESC/POS text
- **Template_Generator**: Guided 3-step workflow that collects test receipts and generates template.json via cloud AI
- **System_Tray**: Windows system tray icon that provides quick access to the Management UI
- **Bar_ID**: Unique venue identifier stored in Windows Registry at HKLM\SOFTWARE\Tabeza\TabezaConnect\BarID
- **Registry_Reader**: Configuration loader that reads settings from Windows Registry
- **ESC_POS_Stripper**: Utility that removes binary control codes from raw printer data to produce plain text
- **Heartbeat_Service**: Background process that sends status updates to cloud every 30 seconds
- **Capture_Service**: Existing file watcher service that monitors order.prn for new print jobs

## Requirements

### Requirement 1: Registry Configuration Reading

**User Story:** As a venue owner, I want Tabeza Connect to automatically read my Bar ID from the Windows Registry, so that I don't need to manually configure it after installation.

#### Acceptance Criteria

1. WHEN THE Capture_Service starts, THE Registry_Reader SHALL read Bar_ID from HKLM\SOFTWARE\Tabeza\TabezaConnect\BarID
2. WHEN THE Capture_Service starts, THE Registry_Reader SHALL read API_URL from HKLM\SOFTWARE\Tabeza\TabezaConnect\APIUrl
3. WHEN THE Capture_Service starts, THE Registry_Reader SHALL read Watch_Folder from HKLM\SOFTWARE\Tabeza\TabezaConnect\WatchFolder
4. THE Registry_Reader SHALL use configuration priority: environment variables → registry → config.json → defaults
5. IF registry reading fails, THEN THE Registry_Reader SHALL log a warning and continue with next priority source
6. THE Capture_Service SHALL log the final configuration values at startup

### Requirement 2: ESC/POS Control Code Stripping

**User Story:** As a developer, I want to strip binary ESC/POS control codes from captured print data, so that I can parse the receipt as plain text.

#### Acceptance Criteria

1. WHEN raw print data is captured, THE ESC_POS_Stripper SHALL remove all ESC/POS control sequences
2. THE ESC_POS_Stripper SHALL preserve printable ASCII characters (0x20-0x7E)
3. THE ESC_POS_Stripper SHALL preserve newline characters (0x0A, 0x0D)
4. THE ESC_POS_Stripper SHALL remove ESC sequences (0x1B followed by command bytes)
5. THE ESC_POS_Stripper SHALL remove GS sequences (0x1D followed by command bytes)
6. THE ESC_POS_Stripper SHALL return plain text suitable for regex parsing
7. THE ESC_POS_Stripper SHALL complete processing within 5ms for typical receipts (< 10KB)

### Requirement 3: Local Template Parser

**User Story:** As a venue owner, I want receipts to be parsed locally using a template, so that structured data is extracted quickly without requiring internet connectivity.

#### Acceptance Criteria

1. WHEN a receipt is captured, THE Template_Parser SHALL read template.json from C:\ProgramData\Tabeza\template.json
2. IF template.json exists, THEN THE Template_Parser SHALL apply regex patterns to extract items, quantities, prices, and total
3. THE Template_Parser SHALL extract receipt_number using the receipt_number pattern
4. THE Template_Parser SHALL extract line items using the item_line pattern
5. THE Template_Parser SHALL extract total amount using the total_line pattern
6. THE Template_Parser SHALL calculate a confidence score based on pattern match success rate
7. IF confidence score is below threshold, THEN THE Template_Parser SHALL log a warning
8. THE Template_Parser SHALL complete parsing within 5ms for typical receipts
9. IF template.json does not exist, THEN THE Template_Parser SHALL mark receipt as parsed: false and include raw text only

### Requirement 4: Queue System with Offline Resilience

**User Story:** As a venue owner, I want receipts to be queued locally when internet is unavailable, so that no receipts are lost during network outages.

#### Acceptance Criteria

1. WHEN a receipt is parsed, THE Queue_System SHALL write a JSON file to C:\ProgramData\Tabeza\queue\pending\ with UUID filename
2. THE Queue_System SHALL include barId, driverId, timestamp, parsed status, confidence, receipt data, and metadata in each queue file
3. THE Upload_Worker SHALL scan queue\pending\ every 2 seconds for files to upload
4. WHEN THE Upload_Worker finds a pending file, THE Upload_Worker SHALL POST the JSON payload to /api/receipts/ingest
5. IF upload succeeds (HTTP 2xx), THEN THE Upload_Worker SHALL move the file to queue\uploaded\
6. IF upload fails, THEN THE Upload_Worker SHALL increment uploadAttempts counter and retry with exponential backoff
7. THE Upload_Worker SHALL use backoff delays: 5s, 10s, 20s, 40s for attempts 1-4
8. IF upload fails after 4 attempts, THEN THE Upload_Worker SHALL leave file in pending\ and log error
9. WHEN THE Capture_Service restarts, THE Upload_Worker SHALL resume processing all files in pending\
10. THE Queue_System SHALL preserve queue files across system reboots

### Requirement 5: HTTP Server and API Endpoints

**User Story:** As a venue owner, I want to access a web dashboard to configure and monitor Tabeza Connect, so that I can manage the service without editing files manually.

#### Acceptance Criteria

1. WHEN THE HTTP_Server starts, THE HTTP_Server SHALL listen on localhost:8765
2. THE HTTP_Server SHALL serve static HTML/CSS/JS files for the Management UI
3. THE HTTP_Server SHALL provide GET /api/status endpoint returning service status, job count, last activity, Bar ID, and template status
4. THE HTTP_Server SHALL provide GET /api/config endpoint returning current configuration
5. THE HTTP_Server SHALL provide POST /api/config endpoint to update configuration
6. THE HTTP_Server SHALL provide GET /api/logs endpoint returning last 100 lines of service.log
7. THE HTTP_Server SHALL provide POST /api/test-print endpoint to trigger a test print job
8. THE HTTP_Server SHALL provide GET /api/template/status endpoint returning template existence and version
9. THE HTTP_Server SHALL provide POST /api/template/generate endpoint to initiate template generation workflow
10. THE HTTP_Server SHALL enable CORS for localhost origins
11. IF THE HTTP_Server fails to start, THEN THE Capture_Service SHALL continue running (HTTP server is optional)

### Requirement 6: Management UI Dashboard

**User Story:** As a venue owner, I want to view service status and recent activity in a dashboard, so that I can verify Tabeza Connect is working correctly.

#### Acceptance Criteria

1. THE Management_UI SHALL display service status (online/offline) with color indicator
2. THE Management_UI SHALL display total jobs processed since service start
3. THE Management_UI SHALL display last activity timestamp
4. THE Management_UI SHALL display configured Bar ID
5. THE Management_UI SHALL display template status (exists/missing, version if exists)
6. THE Management_UI SHALL display current API URL
7. THE Management_UI SHALL display watch folder path
8. THE Management_UI SHALL refresh status automatically every 5 seconds
9. THE Management_UI SHALL provide navigation to Template Generator, Configuration, and Log Viewer pages
10. THE Management_UI SHALL use responsive design suitable for desktop browsers

### Requirement 7: Template Generator Workflow

**User Story:** As a venue owner, I want to generate a receipt template by printing 3 test receipts, so that Tabeza Connect can parse my POS receipts automatically.

#### Acceptance Criteria

1. WHEN template.json does not exist, THE Management_UI SHALL display a modal prompting template setup
2. THE Template_Generator SHALL guide user through 3 steps: print receipt 1, print receipt 2, print receipt 3
3. WHEN user is on step 1, THE Template_Generator SHALL display "Print your first test receipt from your POS"
4. WHEN a receipt is captured during step 1, THE Template_Generator SHALL display "✓ Receipt 1 received" and advance to step 2
5. WHEN user is on step 2, THE Template_Generator SHALL display "Print a DIFFERENT receipt (different items/prices)"
6. WHEN a receipt is captured during step 2, THE Template_Generator SHALL display "✓ Receipt 2 received" and advance to step 3
7. WHEN user is on step 3, THE Template_Generator SHALL display "Print one more DIFFERENT receipt"
8. WHEN a receipt is captured during step 3, THE Template_Generator SHALL display "✓ Receipt 3 received" and show loading spinner
9. WHEN all 3 receipts are collected, THE Template_Generator SHALL POST receipts to /api/receipts/generate-template
10. WHEN template is generated, THE Template_Generator SHALL save template.json to C:\ProgramData\Tabeza\template.json
11. WHEN template is saved, THE Template_Generator SHALL display success message and close modal
12. THE Template_Generator SHALL poll local API every 2 seconds to detect new receipts during workflow
13. IF template generation fails, THEN THE Template_Generator SHALL display error message and allow retry

### Requirement 8: Configuration Page

**User Story:** As a venue owner, I want to view and update configuration settings, so that I can change Bar ID or API URL without editing files manually.

#### Acceptance Criteria

1. THE Management_UI SHALL provide a configuration page accessible from dashboard navigation
2. THE Configuration_Page SHALL display current Bar ID in a text input field
3. THE Configuration_Page SHALL display current API URL in a text input field
4. THE Configuration_Page SHALL display current watch folder path in a text input field
5. THE Configuration_Page SHALL provide a Save button to update configuration
6. WHEN user clicks Save, THE Configuration_Page SHALL POST updated values to /api/config
7. IF configuration update succeeds, THEN THE Configuration_Page SHALL display success message
8. IF configuration update fails, THEN THE Configuration_Page SHALL display error message
9. THE Configuration_Page SHALL validate Bar ID is not empty before saving
10. THE Configuration_Page SHALL validate API URL is a valid HTTPS URL before saving

### Requirement 9: Log Viewer

**User Story:** As a venue owner, I want to view recent service logs in the browser, so that I can troubleshoot issues without accessing the file system.

#### Acceptance Criteria

1. THE Management_UI SHALL provide a log viewer page accessible from dashboard navigation
2. THE Log_Viewer SHALL display the last 100 lines of service.log
3. THE Log_Viewer SHALL refresh logs automatically every 5 seconds
4. THE Log_Viewer SHALL display logs in monospace font with timestamp, level, and message columns
5. THE Log_Viewer SHALL color-code log levels: INFO (blue), WARN (yellow), ERROR (red)
6. THE Log_Viewer SHALL provide a manual refresh button
7. THE Log_Viewer SHALL auto-scroll to bottom when new logs appear
8. IF service.log does not exist, THEN THE Log_Viewer SHALL display "No logs available"

### Requirement 10: System Tray Integration

**User Story:** As a venue owner, I want a system tray icon to quickly access the Management UI, so that I don't need to remember the localhost URL.

#### Acceptance Criteria

1. WHEN Windows user logs in, THE System_Tray SHALL launch automatically via registry Run key
2. THE System_Tray SHALL display a green icon when service is online
3. THE System_Tray SHALL display a grey icon when service is offline or unconfigured
4. WHEN user right-clicks tray icon, THE System_Tray SHALL display context menu
5. THE System_Tray context menu SHALL include "Open Dashboard" option
6. WHEN user clicks "Open Dashboard", THE System_Tray SHALL open http://localhost:8765 in default browser
7. THE System_Tray context menu SHALL include "Send Test Print" option
8. WHEN user clicks "Send Test Print", THE System_Tray SHALL POST to /api/test-print
9. THE System_Tray context menu SHALL include "View Logs" option
10. WHEN user clicks "View Logs", THE System_Tray SHALL open http://localhost:8765/logs in default browser
11. THE System_Tray context menu SHALL include "Quit" option
12. WHEN user clicks "Quit", THE System_Tray SHALL exit the tray application (service continues running)
13. THE System_Tray SHALL poll /api/status every 10 seconds to update icon color

### Requirement 11: Heartbeat Service

**User Story:** As a venue owner, I want Tabeza Connect to report its online status to the cloud, so that I can monitor device health from the staff dashboard.

#### Acceptance Criteria

1. WHEN THE Capture_Service starts, THE Heartbeat_Service SHALL begin sending heartbeats every 30 seconds
2. THE Heartbeat_Service SHALL POST to /api/printer/heartbeat with barId, driverId, version, and status
3. THE Heartbeat_Service SHALL use driverId format: "driver-{HOSTNAME}"
4. THE Heartbeat_Service SHALL include version from package.json
5. THE Heartbeat_Service SHALL set status to "online"
6. IF heartbeat POST fails, THEN THE Heartbeat_Service SHALL log warning and retry on next interval
7. THE Heartbeat_Service SHALL continue sending heartbeats until service stops

### Requirement 12: Driver ID Generation

**User Story:** As a developer, I want each Tabeza Connect installation to have a unique driver ID, so that multiple devices at the same venue can be distinguished.

#### Acceptance Criteria

1. THE Capture_Service SHALL generate driverId using format "driver-{HOSTNAME}"
2. THE Capture_Service SHALL use Windows hostname as the unique identifier
3. THE Capture_Service SHALL include driverId in all cloud API requests
4. THE Capture_Service SHALL log driverId at startup

### Requirement 13: Installer Integration

**User Story:** As a venue owner, I want the installer to open the Management UI automatically after installation, so that I can complete template setup immediately.

#### Acceptance Criteria

1. WHEN installer completes successfully, THE Installer SHALL open http://localhost:8765 in default browser
2. THE Installer SHALL wait 5 seconds after service registration before opening browser
3. IF HTTP_Server is not ready, THEN THE Management_UI SHALL display "Connecting..." message and retry
4. THE Management_UI SHALL detect missing template.json and display setup modal automatically

### Requirement 14: Template Parser Round-Trip Property

**User Story:** As a developer, I want to verify template parsing correctness, so that I can ensure receipts are parsed accurately.

#### Acceptance Criteria

1. FOR ALL valid receipts, parsing with Template_Parser SHALL extract items, quantities, prices, and total
2. FOR ALL extracted totals, the sum of (item.qty * item.price) SHALL equal total within 0.01 tolerance
3. FOR ALL extracted items, name SHALL be non-empty string
4. FOR ALL extracted items, qty SHALL be positive integer
5. FOR ALL extracted items, price SHALL be positive number
6. THE Template_Parser SHALL reject receipts where total does not match sum of items

### Requirement 15: Queue System Idempotence Property

**User Story:** As a developer, I want to ensure queue operations are idempotent, so that receipts are not duplicated if the service restarts during upload.

#### Acceptance Criteria

1. FOR ALL pending receipts, uploading the same receipt twice SHALL result in the same cloud state
2. THE Upload_Worker SHALL use UUID filenames to prevent duplicate processing
3. IF a receipt file is moved to uploaded/ and service restarts, THEN THE Upload_Worker SHALL NOT re-upload it
4. THE Queue_System SHALL maintain exactly-once upload semantics per receipt

### Requirement 16: Template Generator Confluence Property

**User Story:** As a developer, I want to verify that template generation produces consistent results, so that the order of test receipts does not affect the template.

#### Acceptance Criteria

1. FOR ALL sets of 3 test receipts, generating template from receipts [A, B, C] SHALL produce equivalent patterns to [C, B, A]
2. THE Template_Generator SHALL analyze receipt structure independent of receipt order
3. THE Template_Generator SHALL produce deterministic regex patterns for consistent receipt layouts
