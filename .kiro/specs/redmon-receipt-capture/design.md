# Design Document: Redmon-Based Receipt Capture

## Overview

The Redmon-based receipt capture system replaces the failed printer pooling and clawPDF approaches with a proven, reliable method for capturing raw ESC/POS data from POS systems. This design implements an edge-first architecture where receipt parsing happens locally on the venue's Windows machine, eliminating cloud dependency for core operations.

### Core Architecture Principles

1. **Edge-First Processing**: All receipt parsing occurs locally using cached templates
2. **Offline Resilience**: System operates fully during internet outages with automatic sync when restored
3. **Zero Workflow Disruption**: Physical receipts print normally while capture happens transparently
4. **Proven Technology**: Uses Redmon, a battle-tested port monitor used by commercial receipt systems
5. **Queue-Based Reliability**: Separate capture and upload processes ensure no data loss

### System Context

Tabeza Connect is a Windows desktop application that bridges POS systems with the Tabeza cloud platform. The Redmon-based capture system is the core component that:

- Intercepts print jobs before they reach the physical printer
- Extracts structured data from raw ESC/POS bytes
- Uploads parsed receipts to the cloud for customer delivery
- Forwards print jobs to physical printers without delay

This design focuses on the capture, parse, and upload pipeline while maintaining compatibility with existing Tabeza Connect components (Management UI, system tray, configuration management).

## Architecture

### High-Level Data Flow

```
POS System
    ↓ prints to "Tabeza POS Printer"
Generic/Text Only Printer Driver
    ↓ raw ESC/POS bytes
Redmon Port Monitor
    ↓ pipes to stdin
Capture Script (Node.js)
    ├─→ Save Raw (.prn)
    ├─→ Textify (strip ESC/POS)
    ├─→ Parse (apply template)
    ├─→ Queue (pending/)
    └─→ Forward to Physical Printer
        
Upload Worker (concurrent)
    ↓ polls queue every 2s
Cloud API (/api/receipts/ingest)
    ↓
Customer receives digital receipt
```


### Component Architecture

#### 1. Redmon Port Monitor (Third-Party)

Redmon is an open-source Windows port monitor that redirects print jobs to custom programs via stdin.

**Responsibilities:**
- Intercept print jobs sent to "Tabeza POS Printer"
- Pipe raw ESC/POS bytes to the capture script via stdin
- Signal EOF when print job completes

**Configuration:**
- Port name: `TabezaCapturePort`
- Program: `C:\Program Files\TabezaConnect\capture.exe`
- Arguments: `--bar-id %TABEZA_BAR_ID%`
- Run as: `LocalService` (same as Tabeza Connect service)

**Installation:**
- Downloaded from official Redmon repository
- Installed silently via installer script
- Configured programmatically during setup

#### 2. Capture Script (Node.js)

A standalone Node.js executable that receives print jobs from Redmon and orchestrates the processing pipeline.

**Responsibilities:**
- Read raw bytes from stdin until EOF
- Save raw bytes to disk (archival)
- Invoke textifier to strip ESC/POS codes
- Invoke parser to extract structured data
- Add parsed receipt to upload queue
- Forward raw bytes to physical printer

**Key Design Decisions:**
- Single-threaded sequential processing (simplicity over concurrency)
- Synchronous file I/O (ensures data is written before proceeding)
- Fail-fast error handling (log and exit on critical errors)
- No network I/O (upload handled by separate worker)

**Performance Targets:**
- Total processing time: < 100ms per receipt
- Memory usage: < 50MB per invocation
- Handles receipts up to 1MB

#### 3. ESC/POS Textifier

A module that converts raw ESC/POS bytes into clean plain text suitable for regex parsing.

**Responsibilities:**
- Decode bytes using Windows-1252 encoding
- Strip ESC/POS control codes (0x1B sequences)
- Replace non-printable characters with spaces (except \r, \n, \t)
- Collapse multiple consecutive spaces
- Preserve line structure for parsing

**Algorithm:**
```
1. Read raw bytes
2. Decode as Windows-1252
3. For each character:
   - If ESC sequence: skip until command complete
   - If printable or \r\n\t: keep
   - Else: replace with space
4. Collapse multiple spaces
5. Return plain text
```

**Performance Target:** < 10ms per receipt


#### 4. Template-Based Parser

A module that applies venue-specific regex patterns to extract structured data from plain text receipts.

**Responsibilities:**
- Load template from `C:\ProgramData\Tabeza\template.json`
- Apply regex patterns to plain text
- Extract items (name, quantity, price), total, receipt number
- Calculate confidence score based on match quality
- Produce structured JSON output

**Template Structure:**
```json
{
  "version": "1.2",
  "posSystem": "AccelPOS",
  "patterns": {
    "item_line": "^(.+?)\\s+(\\d+)\\s+([0-9,]+\\.\\d{2})$",
    "total_line": "^TOTAL\\s+([0-9,]+\\.\\d{2})$",
    "receipt_number": "^Receipt\\s*#?:\\s*(\\S+)$"
  },
  "confidence_threshold": 0.85
}
```

**Confidence Calculation:**
```
confidence = (matched_lines / total_lines) * pattern_quality_factor
- pattern_quality_factor: 1.0 if all required patterns match, 0.5 if partial
- Low confidence (< 0.85) flags receipt for review
```

**Performance Target:** < 50ms per receipt

#### 5. Upload Worker

A separate long-running process that monitors the upload queue and sends parsed receipts to the cloud.

**Responsibilities:**
- Poll `C:\TabezaPrints\queue\pending\` every 2 seconds
- POST parsed receipts to `/api/receipts/ingest`
- Move successful uploads to `uploaded\` folder
- Retry failed uploads with exponential backoff
- Preserve queue across service restarts

**Retry Strategy:**
```
Attempt 1: immediate
Attempt 2: wait 5s
Attempt 3: wait 10s
Attempt 4: wait 20s
Attempt 5: wait 40s
After 5 attempts: stay in pending\ until next restart
```

**Queue File Format:**
```json
{
  "id": "uuid",
  "barId": "venue-bar-id",
  "driverId": "driver-HOSTNAME",
  "timestamp": "2026-03-02T10:00:00.000Z",
  "parsed": true,
  "confidence": 0.97,
  "receipt": {
    "items": [...],
    "total": 1300.00,
    "receiptNumber": "RCP-123456",
    "rawText": "..."
  },
  "enqueuedAt": "2026-03-02T10:00:00.005Z",
  "uploadAttempts": 0,
  "lastUploadError": null
}
```

**Performance Target:** Process 10 receipts/second when online


#### 6. Physical Printer Forwarder

A module that sends captured print jobs to the actual thermal printer.

**Responsibilities:**
- Read physical printer configuration from `config.json`
- Forward raw ESC/POS bytes to printer (USB, network, or serial)
- Queue failed print jobs for retry
- Log all forwarding attempts

**Printer Communication Methods:**
- **USB**: Use `serialport` library with printer's COM port
- **Network**: Raw TCP socket to printer IP:9100
- **Serial**: Direct serial port communication

**Retry Strategy:**
```
Attempt 1: immediate
Attempt 2: wait 5s
Attempt 3: wait 10s
Attempt 4: wait 20s
Attempt 5: wait 40s
Attempt 6: wait 60s
After 6 attempts: move to failed_prints\
```

**Performance Target:** < 200ms forwarding latency

#### 7. Template Cache Manager

A module that manages template downloads, caching, and updates.

**Responsibilities:**
- Check for template updates daily
- Download template from `/api/receipts/template/{barId}`
- Cache template in `C:\ProgramData\Tabeza\template.json`
- Validate template structure before use
- Fall back to cached template when offline

**Update Check Schedule:**
- Daily at 3:00 AM local time
- On service startup if no template exists
- Manual trigger from Management UI

**Validation Rules:**
- Template must be valid JSON
- Must contain `version`, `patterns` fields
- Patterns must be valid regex
- Confidence threshold must be 0.0-1.0

#### 8. Installer Integration

PowerShell scripts that configure Redmon and create the virtual printer during installation.

**Installation Steps:**
1. Download Redmon installer from official source
2. Run Redmon installer silently: `redmon-setup.exe /S`
3. Create "Tabeza POS Printer" with Generic/Text Only driver
4. Add Redmon port pointing to capture script
5. Configure port to run as LocalService
6. Test print to verify configuration

**Migration Steps (Upgrade from Old System):**
1. Detect existing installation
2. Backup `config.json` and `template.json`
3. Stop old service
4. Remove old printer configurations (pooling, clawPDF)
5. Install Redmon
6. Create new printer with Redmon port
7. Restore configuration files
8. Start new service


## Components and Interfaces

### Capture Script Interface

**Input:**
- stdin: Raw ESC/POS bytes from Redmon
- Command-line args: `--bar-id <id> --config <path>`

**Output:**
- Files: Raw (.prn), text (.txt), parsed (.json)
- stdout: Status messages for logging
- Exit code: 0 (success), 1 (error)

**Environment Variables:**
- `TABEZA_BAR_ID`: Venue identifier
- `TABEZA_CONFIG_PATH`: Path to config.json
- `TABEZA_CAPTURE_PATH`: Base path for captured files

### Textifier Module Interface

```typescript
interface TextifierOptions {
  encoding: string; // 'windows-1252'
  preserveChars: string[]; // ['\r', '\n', '\t']
  collapseSpaces: boolean;
}

function textify(rawBytes: Buffer, options: TextifierOptions): string {
  // Returns plain text with ESC/POS codes stripped
}
```

### Parser Module Interface

```typescript
interface Template {
  version: string;
  posSystem: string;
  patterns: {
    item_line: string;
    total_line: string;
    receipt_number: string;
  };
  confidence_threshold: number;
}

interface ParsedReceipt {
  items: Array<{
    name: string;
    qty: number;
    price: number;
  }>;
  total: number;
  receiptNumber: string;
  confidence: number;
}

function parse(plainText: string, template: Template): ParsedReceipt {
  // Returns structured receipt data
}
```

### Upload Worker Interface

```typescript
interface QueueItem {
  id: string;
  barId: string;
  driverId: string;
  timestamp: string;
  parsed: boolean;
  confidence: number;
  receipt: ParsedReceipt;
  enqueuedAt: string;
  uploadAttempts: number;
  lastUploadError: string | null;
}

class UploadWorker {
  constructor(queuePath: string, apiUrl: string);
  start(): void;
  stop(): void;
  getQueueStatus(): { pending: number; uploaded: number };
}
```

### Printer Forwarder Interface

```typescript
interface PrinterConfig {
  type: 'usb' | 'network' | 'serial';
  port?: string; // COM port for USB/serial
  ip?: string; // IP address for network
  timeout: number; // ms
}

class PrinterForwarder {
  constructor(config: PrinterConfig);
  forward(rawBytes: Buffer): Promise<void>;
  getStatus(): { online: boolean; lastError: string | null };
}
```


### Template Cache Manager Interface

```typescript
interface TemplateCacheManager {
  loadTemplate(): Promise<Template>;
  updateTemplate(): Promise<void>;
  validateTemplate(template: Template): boolean;
  getTemplateInfo(): { version: string; lastUpdate: Date };
}
```

### Cloud API Endpoints

#### POST /api/receipts/ingest

**Request:**
```json
{
  "barId": "venue-bar-id",
  "driverId": "driver-HOSTNAME",
  "timestamp": "2026-03-02T10:00:00.000Z",
  "parsed": true,
  "confidence": 0.97,
  "receipt": {
    "items": [
      { "name": "Tusker Lager 500ml", "qty": 2, "price": 500.00 }
    ],
    "total": 1300.00,
    "receiptNumber": "RCP-123456",
    "rawText": "..."
  },
  "metadata": {
    "source": "redmon-capture",
    "templateVersion": "1.2",
    "parseTimeMs": 3
  }
}
```

**Response:**
```json
{
  "success": true,
  "receiptId": "uuid",
  "matched": false
}
```

#### GET /api/receipts/template/{barId}

**Response:**
```json
{
  "version": "1.2",
  "posSystem": "AccelPOS",
  "patterns": {
    "item_line": "^(.+?)\\s+(\\d+)\\s+([0-9,]+\\.\\d{2})$",
    "total_line": "^TOTAL\\s+([0-9,]+\\.\\d{2})$",
    "receipt_number": "^Receipt\\s*#?:\\s*(\\S+)$"
  },
  "confidence_threshold": 0.85,
  "lastUpdated": "2026-03-01T00:00:00.000Z"
}
```

#### POST /api/receipts/generate-template

**Request:**
```json
{
  "barId": "venue-bar-id",
  "samples": [
    { "rawText": "..." },
    { "rawText": "..." },
    { "rawText": "..." }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "template": { /* Template object */ }
}
```


## Data Models

### File System Structure

```
C:\Program Files\TabezaConnect\
├── TabezaConnect.exe          # Main service executable
├── capture.exe                # Capture script (pkg-compiled)
└── assets\
    └── icon-green.ico

C:\ProgramData\Tabeza\
├── config.json                # Runtime configuration
├── template.json              # Cached parsing template
└── logs\
    └── service.log

C:\TabezaPrints\
├── raw\                       # Raw ESC/POS files
│   └── YYYYMMDD-HHMMSS-mmm.prn
├── text\                      # Textified plain text
│   └── YYYYMMDD-HHMMSS-mmm.txt
├── parsed\                    # Parsed JSON
│   └── YYYYMMDD-HHMMSS-mmm.json
├── queue\
│   ├── pending\              # Awaiting upload
│   │   └── {uuid}.json
│   └── uploaded\             # Successfully uploaded
│       └── {uuid}.json
└── failed_prints\            # Failed printer forwards
    └── YYYYMMDD-HHMMSS-mmm.prn
```

### Configuration Schema

**config.json:**
```json
{
  "barId": "encrypted-bar-id",
  "apiUrl": "https://tabeza.co.ke",
  "driverId": "driver-HOSTNAME",
  "printer": {
    "type": "network",
    "ip": "192.168.1.100",
    "port": 9100,
    "timeout": 5000
  },
  "capture": {
    "basePath": "C:\\TabezaPrints",
    "maxFileSize": 1048576,
    "minDiskSpace": 104857600
  },
  "upload": {
    "pollInterval": 2000,
    "maxRetries": 5,
    "retryBackoff": [5000, 10000, 20000, 40000]
  },
  "logging": {
    "level": "info",
    "maxFileSize": 10485760,
    "maxFiles": 30
  }
}
```

### Template Schema

**template.json:**
```json
{
  "version": "1.2",
  "posSystem": "AccelPOS",
  "lastUpdated": "2026-03-01T00:00:00.000Z",
  "patterns": {
    "item_line": "^(.+?)\\s+(\\d+)\\s+([0-9,]+\\.\\d{2})$",
    "total_line": "^TOTAL\\s+([0-9,]+\\.\\d{2})$",
    "receipt_number": "^Receipt\\s*#?:\\s*(\\S+)$",
    "date_line": "^Date:\\s*(\\d{2}/\\d{2}/\\d{4})$",
    "time_line": "^Time:\\s*(\\d{2}:\\d{2})$"
  },
  "confidence_threshold": 0.85,
  "metadata": {
    "generatedBy": "ai",
    "sampleCount": 3,
    "accuracy": 0.95
  }
}
```


### Parsed Receipt Schema

```json
{
  "id": "a3f2c1b0-4d1e-4f9a-b3c2-1234567890ab",
  "barId": "venue-bar-id",
  "driverId": "driver-HOSTNAME",
  "timestamp": "2026-03-02T10:00:00.000Z",
  "parsed": true,
  "confidence": 0.97,
  "receipt": {
    "items": [
      {
        "name": "Tusker Lager 500ml",
        "qty": 2,
        "price": 500.00
      },
      {
        "name": "Nyama Choma",
        "qty": 1,
        "price": 800.00
      }
    ],
    "total": 1300.00,
    "receiptNumber": "RCP-001234",
    "date": "02/03/2026",
    "time": "10:00",
    "rawText": "... full plain text ..."
  },
  "metadata": {
    "source": "redmon-capture",
    "templateVersion": "1.2",
    "captureTimeMs": 45,
    "textifyTimeMs": 3,
    "parseTimeMs": 12,
    "totalTimeMs": 60
  },
  "enqueuedAt": "2026-03-02T10:00:00.005Z",
  "uploadAttempts": 0,
  "lastUploadError": null
}
```

### Log Entry Schema

```json
{
  "timestamp": "2026-03-02T10:00:00.000Z",
  "level": "info",
  "component": "capture",
  "event": "receipt_captured",
  "data": {
    "filename": "20260302-100000-123.prn",
    "size": 2048,
    "duration": 45
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Complete Data Capture

*For any* print job sent to "Tabeza POS Printer", the capture script SHALL receive all bytes via stdin and save them to disk without loss.

**Validates: Requirements 1.6, 2.1, 2.4**

### Property 2: Processing Pipeline Completeness

*For any* captured print job, the system SHALL create files at all three stages (raw .prn, text .txt, parsed .json) with matching timestamps.

**Validates: Requirements 2.2, 2.8, 3.8, 4.9**


### Property 3: Filename Format Consistency

*For any* saved file (raw, text, or parsed), the filename SHALL match the pattern `YYYYMMDD-HHMMSS-mmm` with valid date/time components.

**Validates: Requirements 2.3**

### Property 4: ESC/POS Textification Correctness

*For any* raw ESC/POS input, the textifier SHALL:
- Decode using Windows-1252 encoding
- Replace non-printable characters (except \r, \n, \t) with spaces
- Collapse multiple consecutive spaces into single spaces
- Preserve line breaks and tabs

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 5: Template-Based Parsing

*For any* plain text receipt and valid template, the parser SHALL:
- Apply all regex patterns from the template
- Extract items with name, quantity, and price
- Extract total and receipt number
- Calculate confidence score between 0.0 and 1.0
- Flag receipts with confidence < 0.85 for review

**Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7**

### Property 6: Template Caching and Validation

*For any* template (downloaded or cached), the system SHALL:
- Validate JSON structure before use
- Cache in `C:\ProgramData\Tabeza\template.json`
- Use cached template when offline
- Update cached template when new version available

**Validates: Requirements 5.3, 5.4, 5.5, 5.6**

### Property 7: Upload Queue Persistence

*For any* parsed receipt, when added to the upload queue, it SHALL:
- Be saved as a JSON file in `pending\` folder
- Survive service restarts without loss
- Be uploaded in FIFO order
- Be moved to `uploaded\` folder on success

**Validates: Requirements 6.1, 6.4, 6.6, 6.8, 8.2, 11.7**

### Property 8: Exponential Backoff Retry

*For any* failed operation (upload or printer forwarding), the system SHALL retry with exponential backoff following the configured intervals.

**Validates: Requirements 6.5, 7.6**

### Property 9: Physical Printer Forwarding

*For any* captured print job, the raw ESC/POS bytes SHALL be forwarded to the configured physical printer preserving all control codes byte-for-byte.

**Validates: Requirements 7.1, 7.3**


### Property 10: Offline Operation Continuity

*For any* period when the cloud API is unreachable, the system SHALL:
- Continue capturing, textifying, and parsing receipts
- Queue parsed receipts in `pending\` folder
- Continue forwarding to physical printer
- Upload all pending receipts when connectivity restored

**Validates: Requirements 8.1, 8.2, 8.3, 8.5**

### Property 11: Configuration Migration Preservation

*For any* existing configuration file (`config.json` or `template.json`), during upgrade the installer SHALL:
- Create a timestamped backup
- Preserve the original file
- Migrate Bar ID to new configuration
- Restore backup if migration fails

**Validates: Requirements 9.2, 9.6, 9.8, 9.9**

### Property 12: Comprehensive Operation Logging

*For any* system operation (capture, textify, parse, upload, forward), the system SHALL log the operation with:
- Timestamp
- Component name
- Event type
- Relevant metrics (size, duration, status)

**Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

### Property 13: Log File Management

*For any* log file, the system SHALL:
- Rotate daily
- Keep 30 days of history
- Limit individual file size to 10MB

**Validates: Requirements 10.6, 10.7**

### Property 14: End-to-End Performance

*For any* print job, the total processing time from capture to queue SHALL be less than 100ms, with:
- Capture: < 50ms
- Textify: < 10ms
- Parse: < 50ms
- Forward: < 200ms (concurrent, non-blocking)

**Validates: Requirements 2.5, 3.6, 4.8, 7.4, 11.4**

### Property 15: Maximum Input Size Handling

*For any* print job up to 1MB in size, the system SHALL process it successfully through all pipeline stages.

**Validates: Requirements 2.7, 3.7, 11.5**

### Property 16: Resource Usage Constraints

*For any* normal operation period, the system SHALL maintain:
- Memory usage < 200MB
- CPU usage < 5%
- Throughput ≥ 10 receipts/second

**Validates: Requirements 11.1, 11.2, 11.3**


### Property 17: Queue Capacity

*For any* upload queue, it SHALL support at least 1000 pending receipts without performance degradation.

**Validates: Requirements 11.6**

### Property 18: Configuration Reload

*For any* change to `config.json`, the system SHALL detect and reload the configuration without requiring service restart.

**Validates: Requirements 13.8**

### Property 19: Security - Data Encryption

*For any* sensitive configuration value (Bar ID, API keys), it SHALL be encrypted using Windows DPAPI before storage.

**Validates: Requirements 15.3**

### Property 20: Security - HTTPS Communication

*For any* cloud API request, the system SHALL use HTTPS protocol.

**Validates: Requirements 15.4**

### Property 21: Security - Localhost-Only UI

*For any* HTTP request to the Management UI, connections SHALL only be accepted from localhost (127.0.0.1).

**Validates: Requirements 15.5**

### Property 22: Security - Input Validation

*For any* configuration input or stdin data, the system SHALL validate size and format before processing to prevent injection attacks.

**Validates: Requirements 15.6, 15.8**

### Property 23: Security - Sensitive Data Redaction

*For any* log entry, sensitive data (Bar ID, API keys) SHALL be redacted or masked.

**Validates: Requirements 15.7**

### Property 24: Security - File Permissions

*For any* capture folder (`C:\TabezaPrints\*`), permissions SHALL be restricted to SYSTEM and Administrators only.

**Validates: Requirements 15.2**

## Error Handling

### Capture Script Errors

**Scenario: Stdin read failure**
- Log error with details
- Exit with code 1
- Redmon will retry the print job

**Scenario: Disk space below threshold**
- Log warning
- Skip saving raw file
- Continue with textification using in-memory buffer
- Set flag in parsed JSON: `diskSpaceLow: true`


**Scenario: File write failure**
- Log error with file path and system error
- Continue processing (don't fail entire pipeline)
- Mark stage as failed in metadata

**Scenario: Print job exceeds 1MB**
- Log warning
- Truncate to 1MB
- Process truncated data
- Set flag in parsed JSON: `truncated: true`

### Textifier Errors

**Scenario: Invalid encoding**
- Fall back to UTF-8 decoding
- Log warning
- Continue processing

**Scenario: Malformed ESC/POS sequences**
- Skip malformed sequences
- Log warning with byte offset
- Continue processing remaining data

### Parser Errors

**Scenario: Template file missing**
- Log error
- Set `parsed: false` in queue item
- Upload raw text to cloud for manual review
- Trigger template download

**Scenario: Template validation failure**
- Log error with validation details
- Attempt to download fresh template
- If download fails, use last known good template
- If no good template exists, set `parsed: false`

**Scenario: Low confidence parse (< 0.85)**
- Log warning with confidence score
- Set `needsReview: true` flag
- Upload parsed data anyway (cloud will flag for review)

**Scenario: Regex pattern exception**
- Log error with pattern and input
- Skip failed pattern
- Continue with remaining patterns
- Calculate confidence based on successful patterns

### Upload Worker Errors

**Scenario: Network timeout**
- Log error
- Increment retry counter
- Apply exponential backoff
- Keep item in pending queue

**Scenario: HTTP 4xx error**
- Log error with response body
- Move item to `failed\` folder (don't retry)
- Alert via Management UI

**Scenario: HTTP 5xx error**
- Log error
- Retry with backoff (treat as temporary failure)


**Scenario: Queue folder inaccessible**
- Log critical error
- Attempt to recreate folder structure
- If recreation fails, alert via Management UI
- Buffer items in memory (up to 100 items)

### Printer Forwarder Errors

**Scenario: Printer offline**
- Log warning
- Queue print job for retry
- Apply exponential backoff
- After 6 retries, move to `failed_prints\`

**Scenario: Printer communication error**
- Log error with printer response
- Retry with backoff
- If persistent, alert via Management UI

**Scenario: Invalid printer configuration**
- Log error
- Alert via Management UI
- Continue capturing (don't block pipeline)
- Queue all print jobs until configuration fixed

### Template Cache Manager Errors

**Scenario: Template download failure**
- Log error with HTTP status
- Continue using cached template
- Retry download on next scheduled check

**Scenario: Downloaded template invalid**
- Log error with validation details
- Reject downloaded template
- Continue using cached template
- Report issue to cloud API

### Installer Errors

**Scenario: Redmon installation failure**
- Log error
- Display error dialog to user
- Roll back any partial changes
- Exit installer with error code

**Scenario: Printer creation failure**
- Log error with Windows error code
- Attempt alternative driver (if available)
- If all attempts fail, display troubleshooting guide
- Allow user to retry or cancel

**Scenario: Migration failure**
- Log error
- Restore backup configuration
- Display error to user with details
- Offer option to continue with fresh install

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs using randomized testing

Together, these approaches ensure both concrete correctness (unit tests) and general correctness (property tests).


### Property-Based Testing Configuration

**Library:** fast-check (JavaScript/TypeScript property-based testing library)

**Configuration:**
- Minimum 100 iterations per property test
- Each test tagged with: `Feature: redmon-receipt-capture, Property N: [property text]`
- Seed-based reproducibility for failed tests

**Example Property Test:**

```typescript
// Feature: redmon-receipt-capture, Property 1: Complete Data Capture
import fc from 'fast-check';

test('Property 1: Complete Data Capture', () => {
  fc.assert(
    fc.property(
      fc.uint8Array({ minLength: 1, maxLength: 1024 * 1024 }), // Random bytes up to 1MB
      async (printJobBytes) => {
        // Send bytes to capture script via stdin
        const result = await captureScript.process(printJobBytes);
        
        // Verify all bytes were saved
        const savedBytes = await fs.readFile(result.rawFilePath);
        expect(savedBytes).toEqual(Buffer.from(printJobBytes));
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Testing Strategy

**Test Categories:**

1. **Installation Tests**
   - Verify Redmon installation
   - Verify printer creation
   - Verify port configuration
   - Test migration from old system

2. **Capture Script Tests**
   - Test stdin reading
   - Test file saving with various sizes
   - Test error handling (disk full, write errors)
   - Test performance benchmarks

3. **Textifier Tests**
   - Test ESC/POS code stripping
   - Test encoding handling
   - Test whitespace normalization
   - Test edge cases (empty input, binary data)

4. **Parser Tests**
   - Test template loading
   - Test regex pattern matching
   - Test confidence calculation
   - Test error handling (missing template, invalid patterns)

5. **Upload Worker Tests**
   - Test queue polling
   - Test retry logic
   - Test backoff timing
   - Test queue persistence across restarts

6. **Printer Forwarder Tests**
   - Test USB printer communication
   - Test network printer communication
   - Test retry logic
   - Test error handling

7. **Template Cache Manager Tests**
   - Test template download
   - Test template validation
   - Test caching behavior
   - Test offline fallback

8. **Integration Tests**
   - End-to-end print job flow
   - Offline operation and sync
   - Configuration reload
   - Error recovery scenarios


### Test Data Generation

**Synthetic ESC/POS Receipts:**

Generate test receipts with:
- Valid ESC/POS control codes
- Various receipt formats (different POS systems)
- Edge cases (very long item names, large quantities, special characters)
- Malformed data (invalid control codes, truncated sequences)

**Template Variations:**

Generate templates with:
- Different regex patterns
- Various confidence thresholds
- Missing optional patterns
- Invalid regex syntax (for error testing)

**Network Conditions:**

Simulate:
- Offline mode (no network)
- Intermittent connectivity
- Slow network (high latency)
- API errors (4xx, 5xx responses)

### Performance Testing

**Benchmarks:**

1. **Capture latency**: < 50ms per receipt
2. **Textify latency**: < 10ms per receipt
3. **Parse latency**: < 50ms per receipt
4. **Forward latency**: < 200ms per receipt
5. **End-to-end latency**: < 100ms (capture to queue)
6. **Throughput**: ≥ 10 receipts/second
7. **Memory usage**: < 200MB during normal operation
8. **CPU usage**: < 5% during normal operation

**Load Testing:**

- Burst test: 100 receipts in 10 seconds
- Sustained test: 10 receipts/second for 1 hour
- Queue stress test: 1000 pending receipts
- Long-running test: 7 days continuous operation

### Manual Testing Checklist

**Installation:**
- [ ] Fresh install on Windows 10
- [ ] Fresh install on Windows 11
- [ ] Upgrade from old system (pooling)
- [ ] Upgrade from old system (clawPDF)
- [ ] Verify Redmon installed
- [ ] Verify printer created
- [ ] Verify configuration migrated

**Capture Flow:**
- [ ] Print test receipt from POS
- [ ] Verify raw file created
- [ ] Verify text file created
- [ ] Verify parsed JSON created
- [ ] Verify physical receipt printed
- [ ] Verify receipt uploaded to cloud

**Offline Operation:**
- [ ] Disconnect internet
- [ ] Print 10 receipts
- [ ] Verify receipts queued
- [ ] Reconnect internet
- [ ] Verify receipts uploaded

**Error Scenarios:**
- [ ] Printer offline during print
- [ ] Disk space low
- [ ] Template missing
- [ ] Invalid template
- [ ] API returns 500 error

**Management UI:**
- [ ] View dashboard status
- [ ] Generate template wizard
- [ ] Configure physical printer
- [ ] View logs
- [ ] View queue status


## Implementation Notes

### Technology Stack

- **Language**: Node.js v20 (for capture script and workers)
- **Packaging**: pkg (compile to standalone .exe)
- **Port Monitor**: Redmon 1.9 (open source, GPL)
- **Printer Driver**: Windows Generic/Text Only driver
- **Testing**: Jest + fast-check
- **Logging**: winston (structured logging)
- **HTTP Client**: axios (for API calls)
- **Printer Communication**: serialport (USB/serial), net (network)

### Key Dependencies

```json
{
  "dependencies": {
    "winston": "^3.11.0",
    "axios": "^1.6.0",
    "serialport": "^12.0.0",
    "chokidar": "^3.5.3",
    "fast-check": "^3.15.0"
  }
}
```

### Build Process

1. **Capture Script:**
   ```bash
   pkg src/capture/index.js -t node20-win-x64 -o dist/capture.exe
   ```

2. **Upload Worker:**
   - Integrated into main TabezaConnect.exe service

3. **Installer:**
   - Inno Setup script packages all components
   - Downloads Redmon from official source
   - Runs PowerShell configuration scripts

### Deployment Considerations

**Redmon Distribution:**
- Download from: https://github.com/clach04/redmon/releases
- Version: 1.9 or later
- License: GPL (compatible with our use case)
- Installer: redmon19.exe (silent install with /S flag)

**Printer Driver:**
- Use Windows built-in "Generic / Text Only" driver
- No additional driver installation required
- Works on all Windows versions

**File Permissions:**
- Capture folders: SYSTEM and Administrators only
- Config files: Encrypted with DPAPI (user-specific)
- Log files: Readable by Administrators

**Service Configuration:**
- Run as: LocalService account
- Startup: Automatic
- Recovery: Restart on failure (3 attempts)

### Migration Strategy

**From Printer Pooling:**
1. Detect pooling printer by name pattern
2. Stop Tabeza Connect service
3. Remove pooling printer
4. Remove Local Port configuration
5. Install Redmon
6. Create new printer with Redmon port
7. Migrate configuration
8. Start service

**From clawPDF:**
1. Detect clawPDF installation
2. Stop Tabeza Connect service
3. Uninstall clawPDF (if user confirms)
4. Remove clawPDF printer
5. Install Redmon
6. Create new printer with Redmon port
7. Migrate configuration
8. Start service

**Configuration Preservation:**
- Backup `config.json` → `backup/config_backup_{timestamp}.json`
- Backup `template.json` → `backup/template_backup_{timestamp}.json`
- Preserve `processed/` folder (archived receipts)
- Preserve `queue/uploaded/` folder (audit trail)


### Security Considerations

**Data Protection:**
- Bar ID encrypted with Windows DPAPI
- API keys never logged in plain text
- Capture folders restricted to SYSTEM and Administrators
- Management UI only accepts localhost connections

**Network Security:**
- All cloud API calls use HTTPS
- Certificate validation enabled
- No sensitive data in URL parameters
- Request/response bodies logged (with redaction)

**Input Validation:**
- Stdin data size validated before processing
- Configuration inputs sanitized
- Template regex patterns validated before compilation
- File paths validated to prevent directory traversal

**Privilege Separation:**
- Service runs as LocalService (minimal privileges)
- Capture script inherits service privileges
- No elevation required for normal operation
- Installer requires admin (one-time setup)

### Performance Optimization

**Capture Script:**
- Use streaming I/O for large print jobs
- Minimize memory allocations
- Avoid synchronous blocking operations
- Exit quickly to free resources

**Textifier:**
- Process in chunks (4KB buffers)
- Use efficient string operations
- Avoid regex for character replacement
- Pre-compile character lookup tables

**Parser:**
- Compile regex patterns once at startup
- Cache compiled patterns in memory
- Use non-backtracking regex where possible
- Limit regex execution time (timeout)

**Upload Worker:**
- Use connection pooling for HTTP requests
- Batch small receipts (if API supports)
- Compress large payloads
- Implement circuit breaker for failing API

**Printer Forwarder:**
- Reuse printer connections
- Use async I/O for network printers
- Buffer small writes
- Implement connection timeout

### Monitoring and Observability

**Metrics to Track:**
- Receipts captured per hour
- Average processing time per stage
- Upload success rate
- Printer forwarding success rate
- Queue depth (pending receipts)
- Template cache hit rate
- Error rate by component

**Health Checks:**
- Service running
- Redmon port configured
- Template file present and valid
- Physical printer reachable
- Cloud API reachable
- Disk space available
- Queue not growing unbounded

**Alerts:**
- Service crashed
- Queue depth > 100
- Upload failure rate > 10%
- Printer offline > 5 minutes
- Disk space < 100MB
- Template download failed


### Troubleshooting Guide

**Problem: Receipts not being captured**

Diagnostics:
1. Check if "Tabeza POS Printer" exists
2. Verify printer is using Redmon port
3. Check if capture.exe exists and is executable
4. Review service logs for errors
5. Test print to verify Redmon is working

Resolution:
- Reinstall printer with Redmon port
- Verify capture script path in port configuration
- Check file permissions on capture folders

**Problem: Parsing confidence always low**

Diagnostics:
1. Check if template.json exists
2. Verify template patterns match receipt format
3. Review sample receipts in text/ folder
4. Check template version and last update

Resolution:
- Regenerate template using wizard
- Manually adjust regex patterns
- Contact support with sample receipts

**Problem: Receipts not uploading**

Diagnostics:
1. Check internet connectivity
2. Verify API URL in config.json
3. Check queue/pending/ folder for stuck items
4. Review upload worker logs

Resolution:
- Verify firewall allows HTTPS to tabeza.co.ke
- Check Bar ID is correct
- Manually retry failed uploads from Management UI

**Problem: Physical printer not printing**

Diagnostics:
1. Check printer power and connection
2. Verify printer configuration in config.json
3. Test printer with Windows test page
4. Review printer forwarder logs

Resolution:
- Reconfigure printer in Management UI
- Check printer IP address (for network printers)
- Verify USB cable connection (for USB printers)
- Check printer driver installation

**Problem: High memory usage**

Diagnostics:
1. Check queue depth (pending receipts)
2. Review log file sizes
3. Check for memory leaks in service logs
4. Monitor over time to identify pattern

Resolution:
- Clear old logs
- Reduce log retention period
- Restart service
- Report issue if persistent

### Future Enhancements

**Phase 2 Features:**

1. **Self-Healing Templates**
   - Automatically detect parsing degradation
   - Request template refresh from cloud
   - A/B test new templates before deployment

2. **Multi-Venue Support**
   - Single installation serving multiple Bar IDs
   - Separate queues per venue
   - Consolidated management UI

3. **Advanced Analytics**
   - Real-time dashboard with metrics
   - Historical performance graphs
   - Predictive alerts (queue growing, disk filling)

4. **Template Editor**
   - Visual regex pattern builder
   - Live preview with sample receipts
   - Pattern testing and validation

5. **Backup Printer Support**
   - Configure primary and backup printers
   - Automatic failover on printer offline
   - Load balancing for high-volume venues

6. **Cloud Template Versioning**
   - Automatic template updates
   - Rollback to previous version
   - Template change notifications

7. **Receipt Preview**
   - View captured receipts in Management UI
   - Compare raw, text, and parsed versions
   - Manual correction interface

## Conclusion

The Redmon-based receipt capture system provides a robust, reliable solution for capturing and processing POS receipts. By leveraging proven technology (Redmon) and implementing an edge-first architecture, the system operates independently of cloud connectivity while maintaining seamless integration with the Tabeza platform.

Key design decisions:
- **Redmon over custom solutions**: Proven, stable, widely used
- **Edge-first parsing**: Fast, offline-capable, reduces cloud load
- **Queue-based architecture**: Resilient to failures, no data loss
- **Separate capture and upload**: Non-blocking, high throughput
- **Template caching**: Offline operation, fast parsing

This design addresses all requirements while maintaining simplicity, performance, and reliability.
