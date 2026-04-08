# Requirements Document: Redmon-Based Receipt Capture

## Introduction

This specification defines the implementation of a robust receipt capture system for Tabeza Connect using Redmon (Redirected Port Monitor). This approach replaces the failed printer pooling and clawPDF attempts with a proven, reliable method for capturing raw ESC/POS data from POS systems.

### Why Redmon?

- **Raw data capture** - Intercepts print stream before driver conversion
- **Proven technology** - Used by commercial receipt capture systems
- **Open source** - Free, GPL-licensed port monitor
- **Works with any POS** - No API integration needed
- **Preserves ESC/POS** - Captures exact bytes sent by POS

### Architecture Overview

```
POS System
    ↓ (prints to "Tabeza Agent")
Generic/Text Only Printer Driver
    ↓ (raw ESC/POS bytes)
Redmon Port Monitor
    ↓ (pipes to stdin)
Tabeza Connect Capture Script
    ↓
├─→ Strip ESC/POS → Plain Text
├─→ Parse with Template → Structured JSON
├─→ Upload to Cloud
└─→ Forward to Physical Printer
```

## Glossary

- **Redmon**: Redirected Port Monitor - a Windows port monitor that pipes print jobs to custom programs
- **ESC/POS**: Printer command language used by thermal receipt printers
- **Textifier**: Component that strips ESC/POS control codes to produce plain text
- **Template**: Venue-specific regex patterns for parsing receipt text
- **Capture Script**: Node.js script that receives stdin from Redmon
- **Physical Printer Forwarder**: Component that sends raw bytes to the actual printer

## Requirements

### Requirement 1: Redmon Installation and Configuration

**User Story:** As a venue owner, I want Redmon to be installed and configured automatically during Tabeza Connect setup, so that my POS system can print to "Tabeza Agent" without manual configuration.

#### Acceptance Criteria

1. THE Installer SHALL download and install Redmon silently
2. THE Installer SHALL create a printer named "Tabeza Agent" using Generic/Text Only driver
3. THE Printer SHALL use a Redmon port configured to pipe to the Tabeza Connect capture script
4. THE Redmon port SHALL pass raw print data via stdin to the capture script
5. THE Capture script SHALL be a Node.js executable bundled with the app
6. WHEN a POS prints to "Tabeza Agent", THE raw ESC/POS bytes SHALL be piped to the capture script
7. THE Installation SHALL work on Windows 10 and Windows 11 (64-bit)
8. IF Redmon installation fails, THE Installer SHALL display an error and roll back changes

### Requirement 2: Raw Data Capture

**User Story:** As a venue owner, I want all print jobs to be captured as raw ESC/POS data, so that I have the exact bytes sent by my POS system.

#### Acceptance Criteria

1. WHEN the capture script receives stdin, IT SHALL read all bytes until EOF
2. THE Capture script SHALL save raw bytes to `C:\TabezaPrints\raw\{timestamp}.prn`
3. THE Filename SHALL use format `YYYYMMDD-HHMMSS-mmm.prn` for uniqueness
4. THE Raw file SHALL preserve all ESC/POS control codes and binary data
5. THE Capture script SHALL complete within 100ms of receiving the print job
6. IF disk space is below 100MB, THE Capture script SHALL log an error and skip saving
7. THE Capture script SHALL handle print jobs up to 1MB in size
8. AFTER saving, THE Capture script SHALL proceed to textification

### Requirement 3: ESC/POS Textification

**User Story:** As a developer, I want ESC/POS control codes stripped from raw data, so that I can parse the receipt text with regex patterns.

#### Acceptance Criteria

1. THE Textifier SHALL decode raw bytes using Windows-1252 encoding
2. THE Textifier SHALL replace all non-printable characters (except \r, \n, \t) with spaces
3. THE Textifier SHALL collapse multiple consecutive spaces into single spaces
4. THE Textifier SHALL preserve line breaks and tabs
5. THE Textifier SHALL produce clean plain text suitable for regex parsing
6. THE Textification SHALL complete within 10ms per receipt
7. THE Textifier SHALL handle receipts up to 10KB in size
8. THE Plain text SHALL be saved to `C:\TabezaPrints\text\{timestamp}.txt`

### Requirement 4: Local Template-Based Parsing

**User Story:** As a venue owner, I want receipts to be parsed locally using my venue-specific template, so that structured data is generated instantly without cloud dependency.

#### Acceptance Criteria

1. THE Parser SHALL load the venue template from `C:\ProgramData\Tabeza\template.json`
2. THE Template SHALL contain regex patterns for item lines, totals, and receipt numbers
3. THE Parser SHALL apply regex patterns to the plain text
4. THE Parser SHALL extract items (name, quantity, price), total, and receipt number
5. THE Parser SHALL produce structured JSON output
6. THE Parser SHALL include a confidence score (0.0 to 1.0)
7. IF confidence is below 0.85, THE Parser SHALL flag the receipt for review
8. THE Parsing SHALL complete within 50ms per receipt
9. THE Parsed JSON SHALL be saved to `C:\TabezaPrints\parsed\{timestamp}.json`

### Requirement 5: Template Caching and Updates

**User Story:** As a venue owner, I want my parsing template to be cached locally and updated automatically, so that parsing works offline and stays current.

#### Acceptance Criteria

1. THE App SHALL check for template updates from `/api/receipts/template/{barId}` daily
2. IF no local template exists, THE App SHALL download it on first run
3. THE App SHALL cache the template in `C:\ProgramData\Tabeza\template.json`
4. THE App SHALL use the cached template when offline
5. WHEN a template update is available, THE App SHALL download and replace the cached version
6. THE App SHALL validate template JSON structure before using it
7. IF template download fails, THE App SHALL continue using the cached version
8. THE App SHALL log template version and last update timestamp

### Requirement 6: Structured Data Upload

**User Story:** As a venue owner, I want parsed receipt data uploaded to the cloud automatically, so that customers receive digital receipts.

#### Acceptance Criteria

1. WHEN parsing succeeds, THE App SHALL add the JSON to the upload queue
2. THE App SHALL POST parsed JSON to `/api/receipts/ingest`
3. THE Payload SHALL include barId, driverId, timestamp, items, total, and confidence
4. WHEN upload succeeds, THE App SHALL move the JSON to `uploaded\` folder
5. IF upload fails, THE App SHALL retry with exponential backoff (5s, 10s, 20s, 40s)
6. THE App SHALL preserve pending uploads across service restarts
7. WHEN internet is restored, THE App SHALL drain the upload queue automatically
8. THE App SHALL upload receipts in the order they were captured

### Requirement 7: Physical Printer Forwarding

**User Story:** As a POS operator, I want receipts to print on the physical printer exactly as before, so that my workflow is not disrupted.

#### Acceptance Criteria

1. AFTER capturing raw bytes, THE App SHALL forward them to the configured physical printer
2. THE App SHALL use raw printer communication (USB, network, or serial)
3. THE App SHALL preserve all ESC/POS commands during forwarding
4. THE Forwarding SHALL complete within 200ms of capture
5. IF the physical printer is offline, THE App SHALL queue the job and retry
6. THE App SHALL retry forwarding with exponential backoff (5s, 10s, 20s, 40s, 60s)
7. IF forwarding fails after 5 retries, THE App SHALL move the job to `failed_prints\`
8. THE App SHALL log all forwarding attempts with timestamp and result

### Requirement 8: Offline Operation

**User Story:** As a venue owner, I want receipt capture to work during internet outages, so that my POS operations are not disrupted.

#### Acceptance Criteria

1. WHEN offline, THE App SHALL continue capturing, textifying, and parsing receipts
2. THE App SHALL queue parsed receipts in `pending\` folder
3. THE App SHALL continue forwarding to physical printer when offline
4. THE Management UI SHALL display "Offline Mode" status
5. WHEN internet is restored, THE App SHALL upload all pending receipts
6. THE App SHALL operate for at least 7 days offline without data loss
7. THE App SHALL display pending receipt count in the Management UI
8. THE App SHALL not block print forwarding while waiting for uploads

### Requirement 9: Installation and Migration

**User Story:** As a venue owner upgrading from the old system, I want the installer to migrate my configuration automatically, so that I don't lose my Bar ID or template.

#### Acceptance Criteria

1. THE Installer SHALL detect existing Tabeza Connect installations
2. THE Installer SHALL preserve `config.json` and `template.json`
3. THE Installer SHALL remove old printer configurations (pooling, clawPDF)
4. THE Installer SHALL install Redmon silently
5. THE Installer SHALL create "Tabeza Agent" with Redmon port
6. THE Installer SHALL migrate Bar ID from old configuration
7. THE Installer SHALL preserve captured receipts in `processed\`
8. THE Installer SHALL create a backup at `backup\config_backup_{timestamp}.json`
9. IF migration fails, THE Installer SHALL restore the backup

### Requirement 10: Logging and Diagnostics

**User Story:** As a support engineer, I want comprehensive logs of all capture operations, so that I can troubleshoot issues quickly.

#### Acceptance Criteria

1. THE App SHALL log all print job captures with timestamp, size, and filename
2. THE App SHALL log textification results with character count
3. THE App SHALL log parsing results with confidence score and item count
4. THE App SHALL log upload attempts with HTTP status and response time
5. THE App SHALL log forwarding attempts with printer status and result
6. THE App SHALL rotate log files daily and keep 30 days of history
7. THE App SHALL limit log file size to 10MB per file
8. THE Management UI SHALL display the last 1000 log entries in real-time

### Requirement 11: Performance and Reliability

**User Story:** As a venue owner, I want the system to handle high-volume printing during busy periods, so that receipt capture doesn't slow down service.

#### Acceptance Criteria

1. THE App SHALL process at least 10 print jobs per second
2. THE App SHALL use less than 200MB of RAM during normal operation
3. THE App SHALL use less than 5% CPU during normal operation
4. THE Capture script SHALL add less than 50ms latency to print jobs
5. THE App SHALL handle print jobs up to 1MB in size
6. THE Upload queue SHALL support at least 1000 pending receipts
7. THE App SHALL recover from crashes within 60 seconds without losing queued jobs
8. THE App SHALL operate continuously for 30 days without requiring restart

### Requirement 12: Template Generation Workflow

**User Story:** As a venue owner, I want to generate a parsing template during setup, so that my receipts are parsed accurately from the first print.

#### Acceptance Criteria

1. WHEN no template exists, THE Management UI SHALL display a "Generate Template" wizard
2. THE UI SHALL prompt the user to print 3 different test receipts
3. WHEN each receipt is captured, THE UI SHALL display "✓ Receipt N received"
4. WHEN all 3 receipts are captured, THE UI SHALL send them to `/api/receipts/generate-template`
5. THE Cloud API SHALL use AI to generate regex patterns
6. WHEN the template is generated, THE UI SHALL save it to `template.json`
7. THE UI SHALL display "✅ Template created successfully" with a sample parsed receipt
8. IF generation fails, THE UI SHALL allow retry with different receipts

### Requirement 13: Physical Printer Configuration

**User Story:** As a venue owner, I want to configure which physical printer receives forwarded jobs, so that I can use my existing printer hardware.

#### Acceptance Criteria

1. THE Management UI SHALL display a printer configuration page
2. THE UI SHALL list all available printers (USB, network, serial)
3. WHEN a user selects a printer, THE UI SHALL save it to `config.json`
4. THE UI SHALL allow manual entry of network printer IP addresses
5. THE UI SHALL provide a "Test Print" button
6. WHEN test print succeeds, THE UI SHALL display "✓ Printer configured successfully"
7. IF test print fails, THE UI SHALL display the error and suggest troubleshooting
8. THE App SHALL reload configuration when `config.json` changes

### Requirement 14: Uninstallation and Cleanup

**User Story:** As a venue owner, I want to uninstall Tabeza Connect cleanly, so that my system is restored to its original state if needed.

#### Acceptance Criteria

1. THE Uninstaller SHALL stop the Tabeza Connect service
2. THE Uninstaller SHALL remove "Tabeza Agent"
3. THE Uninstaller SHALL optionally uninstall Redmon if no other Redmon printers exist
4. THE Uninstaller SHALL prompt to keep or delete captured receipt data
5. IF user chooses delete, THE Uninstaller SHALL remove `C:\TabezaPrints\`
6. THE Uninstaller SHALL remove registry entries
7. THE Uninstaller SHALL remove system tray icon from startup
8. THE Uninstaller SHALL create a final backup before deletion

### Requirement 15: Security and Permissions

**User Story:** As a venue owner, I want the system to operate securely, so that receipt data is protected from unauthorized access.

#### Acceptance Criteria

1. THE App SHALL run with minimum required Windows privileges
2. THE Capture folders SHALL have permissions restricted to SYSTEM and Administrators
3. THE App SHALL encrypt Bar ID in `config.json` using DPAPI
4. THE App SHALL use HTTPS for all cloud API communication
5. THE Management UI SHALL only accept connections from localhost
6. THE App SHALL validate all configuration inputs to prevent injection attacks
7. THE App SHALL not log sensitive data (Bar ID, API keys) in plain text
8. THE Capture script SHALL validate stdin data size before processing

## Success Criteria

The Redmon-based receipt capture system is considered successful when:

1. POS prints to "Tabeza Agent" → receipt prints on physical printer (no workflow disruption)
2. Raw ESC/POS data is captured to disk
3. Plain text is extracted from ESC/POS
4. Structured JSON is parsed using local template
5. Parsed data is uploaded to cloud
6. System works offline and syncs when internet returns
7. Installation is fully automated
8. No manual configuration required after setup

## Out of Scope

- Custom printer driver development
- POS API integration
- Receipt rendering/preview in Management UI
- Multi-printer support (single physical printer only)
- Receipt editing or modification
