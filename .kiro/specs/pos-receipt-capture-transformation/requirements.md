# Requirements Document

## Introduction

This document specifies the requirements for transforming Tabeza's printer integration architecture from a blocking intermediary model to a passive receipt capture system. The current TabezaConnect service acts as a print intermediary where the staff app sends print commands to TabezaConnect which forwards them to the printer. This creates a blocking dependency where Tabeza must be in the print path. The new system will allow POS systems to print directly to printers while Tabeza passively observes and captures receipt data asynchronously.

The transformation ensures that printing never depends on Tabeza's availability, while still enabling digital receipt delivery to customers within 30ms of printing. The system will use ESC/POS byte capture as the primary format, regex-based parsing for 95-99% of receipts, and AI fallback only for template creation and improvement.

## Glossary

- **TabezaConnect**: Windows service that monitors print spooler and captures receipt data
- **POS**: Point of Sale system used by venues to process transactions
- **ESC/POS**: Standard command language for thermal receipt printers
- **Print_Spooler**: Windows system service that manages print jobs (C:\Windows\System32\spool\PRINTERS)
- **Capture_Service**: The transformed TabezaConnect service that passively monitors printing
- **Parsing_Orchestrator**: Cloud component that coordinates receipt parsing using regex and AI
- **Regex_Parser**: Fast deterministic parser using venue-specific templates (1-5ms)
- **AI_Parser**: OpenAI GPT-4o-mini fallback parser for low-confidence receipts
- **Template**: Venue-specific regex patterns for parsing receipt structure
- **Raw_Receipt**: Immutable original receipt data (ESC/POS bytes or text)
- **Structured_Receipt**: Parsed receipt with line items, totals, and metadata
- **Local_Queue**: Persistent storage on venue computer (C:\ProgramData\Tabeza\queue\)
- **Confidence_Score**: Numeric measure (0-100%) of parsing accuracy
- **Self_Healing**: Automatic template improvement through AI learning

## Requirements

### Requirement 1: Non-Blocking Print Architecture

**User Story:** As a venue operator, I want my POS to print receipts directly to the printer without any dependency on Tabeza, so that printing continues to work even if Tabeza is completely offline.

#### Acceptance Criteria

1. WHEN a POS system sends a print job, THE Printer SHALL receive and print the job without any intermediary delay
2. THE Capture_Service SHALL observe print jobs passively without blocking or delaying printing
3. IF Tabeza cloud services are offline, THEN THE Printer SHALL continue printing normally
4. IF the Capture_Service is stopped, THEN THE Printer SHALL continue printing normally
5. THE POS SHALL print directly to the Printer without routing through TabezaConnect

### Requirement 2: Asynchronous Receipt Capture

**User Story:** As a system architect, I want receipt capture to be asynchronous and fault-tolerant, so that capture succeeds even when internet, cloud, or AI services are unavailable.

#### Acceptance Criteria

1. WHEN a print job completes, THE Capture_Service SHALL capture the receipt data asynchronously
2. IF internet connectivity is unavailable, THEN THE Capture_Service SHALL store receipts in the Local_Queue
3. WHEN internet connectivity is restored, THE Capture_Service SHALL upload queued receipts to the cloud
4. THE Capture_Service SHALL retry failed uploads with exponential backoff
5. THE Local_Queue SHALL persist across system reboots
6. WHEN the Capture_Service restarts, THE Capture_Service SHALL resume processing queued receipts

### Requirement 3: Windows Print Spooler Monitoring

**User Story:** As a system developer, I want to monitor the Windows print spooler directory, so that I can capture receipt data from any thermal printer without POS-specific integration.

#### Acceptance Criteria

1. THE Capture_Service SHALL monitor the directory C:\Windows\System32\spool\PRINTERS
2. WHEN a new .SPL or .SHD file appears, THE Capture_Service SHALL detect it within 500ms
3. THE Capture_Service SHALL wait for file write completion before processing
4. WHEN a print job is captured, THE Capture_Service SHALL extract ESC/POS bytes as the primary format
5. IF ESC/POS bytes are not available, THEN THE Capture_Service SHALL extract text as secondary format
6. IF neither ESC/POS nor text is available, THEN THE Capture_Service SHALL capture rendered image as fallback

### Requirement 4: ESC/POS Byte Extraction and Conversion

**User Story:** As a parsing engineer, I want to capture ESC/POS bytes and convert them to text, so that I can parse receipt structure accurately.

#### Acceptance Criteria

1. WHEN processing a print file, THE Capture_Service SHALL detect if the file contains ESC/POS commands
2. THE Capture_Service SHALL extract ESC/POS byte sequences from .SPL files
3. THE Capture_Service SHALL convert ESC/POS bytes to ASCII text by removing control characters
4. THE Capture_Service SHALL preserve line breaks and spacing from ESC/POS formatting
5. THE Capture_Service SHALL store both raw ESC/POS bytes and converted text

### Requirement 5: Local Persistent Queue

**User Story:** As a venue operator, I want captured receipts to be stored locally when offline, so that no receipt data is lost during internet outages.

#### Acceptance Criteria

1. THE Capture_Service SHALL store captured receipts in C:\ProgramData\Tabeza\queue\
2. WHEN a receipt is captured, THE Capture_Service SHALL save it as a JSON file with UUID filename
3. THE Local_Queue SHALL include receipt ID, venue ID, timestamp, ESC/POS data, and text
4. WHEN a receipt is successfully uploaded, THE Capture_Service SHALL mark it as uploaded and remove it from the queue
5. THE Local_Queue SHALL survive system reboots and service restarts

### Requirement 6: Asynchronous Upload Worker

**User Story:** As a system architect, I want an upload worker that continuously processes queued receipts, so that receipts are uploaded to the cloud without blocking capture.

#### Acceptance Criteria

1. THE Upload_Worker SHALL run continuously as a background process
2. WHEN receipts are in the Local_Queue, THE Upload_Worker SHALL upload them to the cloud API
3. IF an upload fails, THEN THE Upload_Worker SHALL retry with exponential backoff (5s, 10s, 20s, 40s)
4. THE Upload_Worker SHALL never block the capture process
5. WHEN a receipt is successfully uploaded, THE Upload_Worker SHALL remove it from the Local_Queue

### Requirement 7: Cloud Receipt Ingestion API

**User Story:** As a cloud engineer, I want an ingestion API that accepts raw receipt data, so that I can queue receipts for parsing without blocking the upload.

#### Acceptance Criteria

1. THE Cloud_API SHALL provide a POST /api/receipts/ingest endpoint
2. WHEN a receipt is received, THE Cloud_API SHALL save it to the raw_receipts table immediately
3. THE Cloud_API SHALL return a success response within 100ms
4. THE Cloud_API SHALL queue the receipt for parsing asynchronously
5. THE Cloud_API SHALL never parse receipts inline during ingestion

### Requirement 8: Regex-Based Parsing Engine

**User Story:** As a parsing engineer, I want a fast regex-based parser, so that 95-99% of receipts are parsed deterministically in 1-5ms.

#### Acceptance Criteria

1. THE Regex_Parser SHALL load venue-specific templates from the parsing_templates table
2. WHEN parsing a receipt, THE Regex_Parser SHALL apply regex patterns to extract line items, totals, and metadata
3. THE Regex_Parser SHALL complete parsing within 5ms for standard receipts
4. THE Regex_Parser SHALL calculate a Confidence_Score based on pattern matches
5. IF the Confidence_Score is above 80%, THEN THE Regex_Parser SHALL save the structured receipt
6. IF the Confidence_Score is below 80%, THEN THE Parsing_Orchestrator SHALL invoke the AI_Parser

### Requirement 9: AI Fallback Parser

**User Story:** As a parsing engineer, I want an AI fallback parser for low-confidence receipts, so that edge cases are handled without manual intervention.

#### Acceptance Criteria

1. WHEN the Regex_Parser returns a Confidence_Score below 80%, THE Parsing_Orchestrator SHALL invoke the AI_Parser
2. THE AI_Parser SHALL use OpenAI GPT-4o-mini to parse the receipt text
3. THE AI_Parser SHALL extract line items, quantities, prices, subtotal, tax, and total
4. THE AI_Parser SHALL return structured data in the same format as the Regex_Parser
5. IF the AI_Parser succeeds, THEN THE Parsing_Orchestrator SHALL save the structured receipt

### Requirement 10: Self-Healing Template Learning

**User Story:** As a system architect, I want templates to self-improve over time, so that parsing accuracy increases without manual intervention.

#### Acceptance Criteria

1. WHEN the AI_Parser successfully parses a receipt, THE Parsing_Orchestrator SHALL store a learning event in template_learning_events
2. WHEN a venue has 10 or more learning events with similar patterns, THE Parsing_Orchestrator SHALL generate a new template version
3. THE Parsing_Orchestrator SHALL test new template versions against historical receipts
4. IF a new template version improves accuracy by 5% or more, THEN THE Parsing_Orchestrator SHALL activate it
5. THE Parsing_Orchestrator SHALL track template evolution in the parsing_templates table

### Requirement 11: Immutable Raw Receipt Storage

**User Story:** As a compliance officer, I want raw receipt data to be immutable, so that original receipts are preserved for auditing and debugging.

#### Acceptance Criteria

1. THE Cloud_API SHALL store all raw receipt data in the raw_receipts table
2. THE raw_receipts table SHALL never be modified after initial insert
3. THE Parsing_Orchestrator SHALL create structured receipts in the receipts table without modifying raw_receipts
4. IF parsing fails, THEN THE raw_receipts data SHALL remain available for reprocessing
5. THE raw_receipts table SHALL include ESC/POS bytes, text, and metadata

### Requirement 12: Digital Receipt Delivery Performance

**User Story:** As a customer, I want to see my digital receipt within 30ms of printing, so that the experience feels instant.

#### Acceptance Criteria

1. WHEN a receipt is printed, THE Capture_Service SHALL capture it within 5ms
2. THE Capture_Service SHALL upload the receipt to the cloud within 20ms
3. THE Regex_Parser SHALL parse the receipt within 5ms
4. THE Cloud_API SHALL deliver the structured receipt to the customer PWA within 30ms total
5. IF AI parsing is required, THEN THE customer SHALL see the receipt within 300ms

### Requirement 13: Parse Failure Tracking

**User Story:** As a system administrator, I want to track parsing failures, so that I can identify venues needing template improvements.

#### Acceptance Criteria

1. WHEN parsing fails, THE Parsing_Orchestrator SHALL store the failure in the parse_failures table
2. THE parse_failures table SHALL include receipt ID, venue ID, error message, and timestamp
3. THE Parsing_Orchestrator SHALL retry failed receipts after template updates
4. THE Cloud_API SHALL provide an endpoint to query parse failures by venue
5. WHEN a venue has 5 or more parse failures, THE Cloud_API SHALL alert administrators

### Requirement 14: Database Schema for Receipt Storage

**User Story:** As a database engineer, I want a normalized schema for receipt storage, so that receipts and line items are stored efficiently.

#### Acceptance Criteria

1. THE Database SHALL include a raw_receipts table with columns: id, venue_id, device_id, timestamp, escpos_bytes, text, metadata
2. THE Database SHALL include a receipts table with columns: id, raw_receipt_id, venue_id, receipt_number, subtotal, tax, total, parsed_at, confidence_score
3. THE Database SHALL include a receipt_items table with columns: id, receipt_id, line_number, quantity, item_name, unit_price, total_price
4. THE Database SHALL include a parsing_templates table with columns: id, venue_id, version, patterns, active, created_at
5. THE Database SHALL include a template_learning_events table with columns: id, venue_id, raw_receipt_id, ai_output, created_at
6. THE Database SHALL include a parse_failures table with columns: id, raw_receipt_id, venue_id, error_message, created_at

### Requirement 15: Staff App Receipt Viewing

**User Story:** As a staff member, I want to view parsed receipts in the staff app, so that I can verify receipt accuracy and assign them to tabs.

#### Acceptance Criteria

1. THE Staff_App SHALL display a list of recent receipts for the venue
2. WHEN viewing a receipt, THE Staff_App SHALL show line items, totals, and confidence score
3. THE Staff_App SHALL allow staff to assign receipts to customer tabs
4. THE Staff_App SHALL display parsing errors for failed receipts
5. THE Staff_App SHALL allow staff to manually correct parsing errors

### Requirement 16: Template Management UI

**User Story:** As a venue administrator, I want to manage parsing templates, so that I can improve parsing accuracy for my venue.

#### Acceptance Criteria

1. THE Staff_App SHALL display active parsing templates for the venue
2. THE Staff_App SHALL show template version history and accuracy metrics
3. THE Staff_App SHALL allow administrators to activate or deactivate template versions
4. THE Staff_App SHALL display learning events that contributed to template improvements
5. THE Staff_App SHALL allow administrators to manually edit regex patterns

### Requirement 17: Parsing Confidence Monitoring

**User Story:** As a venue administrator, I want to monitor parsing confidence, so that I can identify when templates need improvement.

#### Acceptance Criteria

1. THE Staff_App SHALL display average confidence score for the venue
2. THE Staff_App SHALL show a chart of confidence scores over time
3. THE Staff_App SHALL alert administrators when confidence drops below 80%
4. THE Staff_App SHALL display the percentage of receipts requiring AI fallback
5. THE Staff_App SHALL show the number of parse failures in the last 7 days

### Requirement 18: POS-Agnostic Compatibility

**User Story:** As a venue operator, I want the system to work with any thermal printer, so that I don't need to change my existing POS system.

#### Acceptance Criteria

1. THE Capture_Service SHALL work with any printer that outputs to the Windows print spooler
2. THE Capture_Service SHALL not require POS-specific drivers or plugins
3. THE Capture_Service SHALL support ESC/POS, text, and image-based receipts
4. THE Capture_Service SHALL work with network printers and USB printers
5. THE Capture_Service SHALL work with virtual printers (e.g., Microsoft Print to PDF)

### Requirement 19: Parsing Round-Trip Property

**User Story:** As a quality engineer, I want to validate parsing accuracy through round-trip testing, so that I can ensure templates correctly parse and reconstruct receipts.

#### Acceptance Criteria

1. FOR ALL valid receipts, parsing then formatting then parsing SHALL produce an equivalent structured receipt
2. THE Regex_Parser SHALL preserve all line items, quantities, and prices during round-trip
3. THE Regex_Parser SHALL preserve subtotal, tax, and total amounts during round-trip
4. IF round-trip parsing produces different values, THEN THE Parsing_Orchestrator SHALL flag the template for review
5. THE Template_Learning system SHALL use round-trip validation to test new template versions

### Requirement 20: Service Installation and Configuration

**User Story:** As a venue operator, I want easy installation and configuration, so that I can set up the capture service without technical expertise.

#### Acceptance Criteria

1. THE Capture_Service SHALL provide a Windows installer (.msi or .exe)
2. THE Installer SHALL register the service to start automatically on boot
3. THE Installer SHALL create the Local_Queue directory with proper permissions
4. THE Installer SHALL prompt for venue ID and API endpoint during installation
5. THE Installer SHALL validate configuration by sending a test heartbeat to the cloud
