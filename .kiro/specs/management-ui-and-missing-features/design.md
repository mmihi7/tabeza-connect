# Design Document: Management UI and Missing Features

## Overview

This design implements the missing components required to complete Tabeza Connect v1.7.0 as defined in the architecture document. The current implementation includes a working file watcher service that captures POS receipts via Windows printer pooling. This feature adds:

- Registry configuration reading with priority cascade
- ESC/POS control code stripping for plain text extraction
- Local template-based receipt parser
- Offline-resilient queue system with exponential backoff retry
- HTTP server with REST API endpoints
- Management UI dashboard with real-time status
- Template generator with guided 3-step workflow
- Configuration and log viewer pages
- System tray integration for quick access
- Heartbeat service for cloud status reporting
- Driver ID generation for device identification
- Installer integration for automatic setup launch

The design follows the principle that the capture service must continue operating even if optional components (HTTP server, Management UI, system tray) fail. The queue system ensures no receipts are lost during network outages or service restarts.

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    TabezaConnect.exe                        │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │           Capture Service (Core)                      │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │ │
│  │  │   Registry  │  │  File        │  │  ESC/POS    │ │ │
│  │  │   Reader    │→ │  Watcher     │→ │  Stripper   │ │ │
│  │  └─────────────┘  └──────────────┘  └─────────────┘ │ │
│  │         ↓                                    ↓        │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │ │
│  │  │  Template   │  │   Queue      │  │   Upload    │ │ │
│  │  │  Parser     │→ │   System     │→ │   Worker    │ │ │
│  │  └─────────────┘  └──────────────┘  └─────────────┘ │ │
│  │         ↓                                    ↓        │ │
│  │  ┌─────────────┐                    ┌─────────────┐ │ │
│  │  │  Heartbeat  │                    │   Cloud     │ │ │
│  │  │  Service    │─────────────────→  │   API       │ │ │
│  │  └─────────────┘                    └─────────────┘ │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │           HTTP Server (Optional)                      │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │ │
│  │  │   Express   │  │  Static      │  │   REST      │ │ │
│  │  │   Server    │→ │  Files       │  │   API       │ │ │
│  │  └─────────────┘  └──────────────┘  └─────────────┘ │ │
│  └───────────────────────────────────────────────────────┘ │
│                          ↓                                  │
└──────────────────────────┼──────────────────────────────────┘
                           ↓
              ┌────────────────────────┐
              │   Management UI        │
              │   (Browser)            │
              │  ┌──────────────────┐  │
              │  │   Dashboard      │  │
              │  │   Template Gen   │  │
              │  │   Configuration  │  │
              │  │   Log Viewer     │  │
              │  └──────────────────┘  │
              └────────────────────────┘
                           ↑
              ┌────────────────────────┐
              │   System Tray          │
              │   (Separate Process)   │
              └────────────────────────┘
```


### Critical Design Principle: Physical Printing Must Never Fail

**THE MOST CRITICAL REQUIREMENT:** The physical thermal printer must continue printing paper receipts regardless of Tabeza Connect's state. This is guaranteed by Windows Printer Pooling, which sends print jobs to BOTH the physical printer port AND the capture file port simultaneously. If Tabeza Connect crashes, stops, or fails in any way, the POS and thermal printer continue working exactly as they always have.

### Core Components (All Required for Product to Function)

All components in this design are CORE and required for Tabeza Connect to function as specified in the architecture:

**Receipt Capture Pipeline (Must Be Reliable):**
- Windows Printer Pooling: Sends print jobs to physical printer AND capture file (handled by Windows, not Tabeza Connect)
- Registry Reader: Loads configuration with fallback chain
- File Watcher: Monitors order.prn for new print jobs
- ESC/POS Stripper: Removes control codes to produce plain text
- Template Parser: Extracts structured data from receipts
- Queue System: Persists receipts to disk for offline resilience
- Upload Worker: Sends receipts to cloud with retry logic

**User Interface & Configuration (Required for Setup and Monitoring):**
- HTTP Server: Serves Management UI and API endpoints (REQUIRED for template generation)
- Management UI: Browser-based dashboard and configuration (REQUIRED for initial template setup)
- System Tray: Quick access icon (REQUIRED for user to access dashboard)
- Heartbeat Service: Status reporting to cloud (REQUIRED for venue monitoring)

**Error Handling Philosophy:**
While all components are required, the design implements graceful degradation:
- If HTTP server fails to start: Service logs error and exits (user must fix port conflict)
- If template.json is missing: Receipts uploaded as unparsed, UI prompts user to complete setup
- If network is unavailable: Receipts queue locally and upload when connectivity returns
- If system tray crashes: User can access dashboard via browser bookmark, tray restarts on next login

The key principle: **Physical printing never depends on Tabeza Connect**. Windows Printer Pooling ensures paper receipts always print, even if Tabeza Connect is completely stopped or uninstalled.

## Components and Interfaces

### 1. Registry Reader

**Purpose:** Load configuration from Windows Registry with priority cascade fallback.

**Module:** `src/service/config/registry-reader.js`

**Interface:**
```javascript
class RegistryReader {
  /**
   * Read configuration from all sources with priority cascade
   * Priority: env vars → registry → config.json → defaults
   * @returns {Object} Configuration object
   */
  static loadConfig() {
    return {
      barId: string,
      apiUrl: string,
      watchFolder: string,
      httpPort: number,
      source: 'env' | 'registry' | 'config' | 'default'
    };
  }

  /**
   * Read a single value from Windows Registry
   * @param {string} key - Registry key name
   * @returns {string|null} Value or null if not found
   */
  static readRegistryKey(key) { }

  /**
   * Read config.json from disk
   * @returns {Object|null} Config object or null if not found
   */
  static readConfigFile() { }
}
```

**Implementation Details:**
- Uses `child_process.execSync` to call PowerShell `Get-ItemProperty`
- Registry path: `HKLM:\SOFTWARE\Tabeza\TabezaConnect`
- Catches all errors and logs warnings without throwing
- Returns null for missing values to allow fallback chain
- Config file path: `C:\ProgramData\Tabeza\config.json`
- Default values: `apiUrl='https://tabeza.co.ke'`, `watchFolder='C:\ProgramData\Tabeza\TabezaPrints'`, `httpPort=8765`

**Error Handling:**
- Registry read failures: Log warning, continue to next priority
- Config file read failures: Log warning, continue to defaults
- Missing barId: Log error but allow service to start (will fail on upload)

### 2. ESC/POS Stripper

**Purpose:** Remove binary control codes from raw printer data to produce plain text suitable for regex parsing.

**Module:** `src/service/parser/escpos-stripper.js`

**Interface:**
```javascript
class ESCPOSStripper {
  /**
   * Strip ESC/POS control codes from raw print data
   * @param {Buffer} rawData - Raw printer data
   * @returns {string} Plain text with control codes removed
   */
  static strip(rawData) { }

  /**
   * Check if byte is printable ASCII (0x20-0x7E)
   * @param {number} byte - Byte value
   * @returns {boolean} True if printable
   */
  static isPrintable(byte) { }

  /**
   * Check if byte is newline (0x0A or 0x0D)
   * @param {number} byte - Byte value
   * @returns {boolean} True if newline
   */
  static isNewline(byte) { }
}
```

**Implementation Details:**
- Processes buffer byte-by-byte
- Preserves: printable ASCII (0x20-0x7E), LF (0x0A), CR (0x0D)
- Removes: ESC sequences (0x1B + command bytes), GS sequences (0x1D + command bytes)
- ESC sequence detection: Skip 0x1B and next 1-3 bytes based on command
- GS sequence detection: Skip 0x1D and next 1-2 bytes based on command
- Returns UTF-8 string from filtered bytes
- Target performance: < 5ms for typical receipts (< 10KB)

**ESC/POS Command Reference:**
- ESC @ (0x1B 0x40): Initialize printer (2 bytes)
- ESC E (0x1B 0x45): Bold on/off (3 bytes)
- ESC a (0x1B 0x61): Alignment (3 bytes)
- ESC d (0x1B 0x64): Feed lines (3 bytes)
- GS ! (0x1D 0x21): Character size (3 bytes)
- GS V (0x1D 0x56): Cut paper (3 bytes)

### 3. Template Parser

**Purpose:** Extract structured data from plain text receipts using regex patterns defined in template.json.

**Module:** `src/service/parser/template-parser.js`

**Interface:**
```javascript
class TemplateParser {
  /**
   * Parse receipt text using template patterns
   * @param {string} plainText - Stripped receipt text
   * @param {string} templatePath - Path to template.json
   * @returns {Object} Parsed receipt data
   */
  static parse(plainText, templatePath) {
    return {
      parsed: boolean,
      confidence: number,
      items: Array<{name: string, qty: number, price: number}>,
      total: number,
      receiptNumber: string,
      rawText: string
    };
  }

  /**
   * Load template from disk
   * @param {string} templatePath - Path to template.json
   * @returns {Object|null} Template object or null if not found
   */
  static loadTemplate(templatePath) { }

  /**
   * Calculate confidence score based on match success rate
   * @param {Object} matches - Match results
   * @returns {number} Confidence score 0.0-1.0
   */
  static calculateConfidence(matches) { }

  /**
   * Validate parsed data integrity
   * @param {Object} parsed - Parsed receipt data
   * @returns {boolean} True if valid
   */
  static validate(parsed) { }
}
```


**Implementation Details:**
- Template path: `C:\ProgramData\Tabeza\template.json`
- If template missing: Return `{parsed: false, rawText: plainText}`
- Apply regex patterns line-by-line to extract data
- Item line pattern: Captures name, quantity, price
- Total line pattern: Captures total amount
- Receipt number pattern: Captures receipt identifier
- Confidence calculation: (successful_matches / total_patterns)
- Validation: Verify sum(item.qty * item.price) ≈ total (within 0.01)
- Validation: All items have non-empty name, positive qty, positive price
- Target performance: < 5ms for typical receipts

**Template Format:**
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

### 4. Queue System

**Purpose:** Provide offline-resilient storage for parsed receipts with exactly-once upload semantics.

**Module:** `src/service/queue/queue-manager.js`

**Interface:**
```javascript
class QueueManager {
  /**
   * Enqueue a parsed receipt for upload
   * @param {Object} receipt - Parsed receipt data
   * @returns {string} UUID of queued item
   */
  enqueue(receipt) { }

  /**
   * Get next pending receipt for upload
   * @returns {Object|null} Receipt data or null if queue empty
   */
  dequeue() { }

  /**
   * Mark receipt as successfully uploaded
   * @param {string} id - Receipt UUID
   */
  markUploaded(id) { }

  /**
   * Mark receipt upload as failed and increment retry counter
   * @param {string} id - Receipt UUID
   * @param {string} error - Error message
   */
  markFailed(id, error) { }

  /**
   * Scan pending folder on startup to resume uploads
   * @returns {Array<Object>} Pending receipts
   */
  scanPending() { }

  /**
   * Get queue statistics
   * @returns {Object} Stats object
   */
  getStats() {
    return {
      pending: number,
      uploaded: number,
      failed: number
    };
  }
}
```

**Implementation Details:**
- Queue folder: `C:\ProgramData\Tabeza\queue\`
- Pending folder: `queue\pending\`
- Uploaded folder: `queue\uploaded\`
- Filename format: `{uuid}.json`
- Each file contains: id, barId, driverId, timestamp, parsed, confidence, receipt, enqueuedAt, uploadAttempts, lastUploadError
- `enqueue()`: Generate UUID, write JSON file to pending\
- `dequeue()`: Read oldest file from pending\ (by enqueuedAt)
- `markUploaded()`: Move file from pending\ to uploaded\
- `markFailed()`: Update uploadAttempts and lastUploadError in file
- `scanPending()`: Called on service start, returns all pending files sorted by enqueuedAt
- File operations use atomic write (write to temp, rename)

### 5. Upload Worker

**Purpose:** Background process that uploads queued receipts to cloud with exponential backoff retry.

**Module:** `src/service/queue/upload-worker.js`

**Interface:**
```javascript
class UploadWorker {
  constructor(queueManager, config) { }

  /**
   * Start the upload worker loop
   */
  start() { }

  /**
   * Stop the upload worker
   */
  stop() { }

  /**
   * Process next pending receipt
   * @returns {Promise<boolean>} True if upload succeeded
   */
  async processNext() { }

  /**
   * Upload receipt to cloud API
   * @param {Object} receipt - Receipt data
   * @returns {Promise<Object>} API response
   */
  async uploadReceipt(receipt) { }

  /**
   * Calculate backoff delay for retry attempt
   * @param {number} attempt - Attempt number (1-4)
   * @returns {number} Delay in milliseconds
   */
  getBackoffDelay(attempt) { }
}
```

**Implementation Details:**
- Poll interval: 2 seconds
- Backoff delays: [5000, 10000, 20000, 40000] ms for attempts 1-4
- Max attempts: 4
- After 4 failures: Leave in pending\, log error, skip to next receipt
- On service restart: Resume processing all pending receipts
- Upload endpoint: POST /api/receipts/ingest
- Success: HTTP 2xx response
- Failure: Any non-2xx response or network error
- Uses axios for HTTP requests with 30s timeout

**Upload Flow:**
1. Call `queueManager.dequeue()` to get next receipt
2. If null, wait 2 seconds and retry
3. Call `uploadReceipt()` to POST to cloud
4. If success: Call `queueManager.markUploaded()`
5. If failure: Call `queueManager.markFailed()`, calculate backoff, wait, retry
6. After 4 attempts: Log error, move to next receipt

### 6. HTTP Server

**Purpose:** Serve Management UI and provide REST API endpoints for configuration and monitoring.

**Module:** `src/server/index.js`

**Interface:**
```javascript
class HTTPServer {
  constructor(config, captureService) { }

  /**
   * Start the HTTP server
   * @returns {Promise<void>}
   */
  async start() { }

  /**
   * Stop the HTTP server
   * @returns {Promise<void>}
   */
  async stop() { }

  /**
   * Register API routes
   */
  registerRoutes() { }

  /**
   * Register static file serving
   */
  registerStatic() { }
}
```

**API Endpoints:**

| Method | Path | Purpose | Response |
|--------|------|---------|----------|
| GET | /api/status | Service status | `{status, jobCount, lastActivity, barId, templateStatus}` |
| GET | /api/config | Current config | `{barId, apiUrl, watchFolder, httpPort}` |
| POST | /api/config | Update config | `{success, message}` |
| GET | /api/logs | Recent logs | `{lines: Array<string>}` |
| POST | /api/test-print | Trigger test | `{success, message}` |
| GET | /api/template/status | Template info | `{exists, version, path}` |
| POST | /api/template/generate | Generate template | `{success, template}` |
| GET | /api/receipts/recent | Recent receipts | `{receipts: Array<Object>}` |

**Implementation Details:**
- Port: 8765 (configurable)
- Bind: localhost only (security)
- CORS: Enabled for localhost origins
- Static files: `src/server/public/`
- Error handling: All endpoints return JSON errors with appropriate HTTP status
- If server fails to start: Log error, continue capture service
- Express middleware: body-parser (JSON), cors, express.static


### 7. Management UI

**Purpose:** Browser-based dashboard for monitoring and configuring Tabeza Connect.

**Location:** `src/server/public/`

**Pages:**

**Dashboard (`index.html`):**
- Service status indicator (green/grey circle)
- Total jobs processed counter
- Last activity timestamp
- Configured Bar ID
- Template status (exists/missing, version)
- API URL display
- Watch folder path display
- Navigation links to other pages
- Auto-refresh every 5 seconds via polling /api/status

**Template Generator (`template.html`):**
- Modal overlay (shown when template.json missing)
- 3-step workflow with progress indicator
- Step 1: "Print your first test receipt from your POS"
- Step 2: "Print a DIFFERENT receipt (different items/prices)"
- Step 3: "Print one more DIFFERENT receipt"
- Real-time receipt detection via polling /api/receipts/recent every 2s
- Checkmark display when receipt captured
- Loading spinner during template generation
- Success message with close button
- Error message with retry button

**Configuration (`config.html`):**
- Form with text inputs for Bar ID, API URL, Watch Folder
- Save button
- Success/error message display
- Input validation (Bar ID non-empty, API URL valid HTTPS)
- Loads current config from /api/config on page load
- POSTs updates to /api/config on save

**Log Viewer (`logs.html`):**
- Monospace text display
- Last 100 lines from service.log
- Color-coded log levels (INFO=blue, WARN=yellow, ERROR=red)
- Auto-refresh every 5 seconds
- Manual refresh button
- Auto-scroll to bottom on new logs
- "No logs available" message if file missing

**Technology Stack:**
- Vanilla JavaScript (no frameworks)
- CSS Grid for layout
- Fetch API for HTTP requests
- Responsive design for desktop browsers
- Minimal dependencies for fast loading

### 8. System Tray

**Purpose:** Provide quick access to Management UI via Windows system tray icon.

**Module:** `src/tray/index.js` (separate process)

**Interface:**
```javascript
class SystemTray {
  constructor(config) { }

  /**
   * Initialize and show tray icon
   */
  start() { }

  /**
   * Remove tray icon and exit
   */
  stop() { }

  /**
   * Update icon based on service status
   * @param {string} status - 'online' | 'offline'
   */
  updateIcon(status) { }

  /**
   * Poll service status
   */
  async pollStatus() { }
}
```

**Implementation Details:**
- Uses `electron` for tray icon (packaged with pkg)
- Icon files: `assets/icon-green.ico` (online), `assets/icon-grey.ico` (offline)
- Context menu items:
  - "Open Dashboard" → Opens http://localhost:8765
  - "Send Test Print" → POSTs to /api/test-print
  - "View Logs" → Opens http://localhost:8765/logs
  - "Quit" → Exits tray process (service continues)
- Status polling: Every 10 seconds via GET /api/status
- Auto-start: Registry key `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\TabezaTray`
- Separate executable: `TabezaTray.exe` (compiled separately)
- Communication: HTTP to localhost:8765

**Registry Integration:**
- Installer creates Run key pointing to `C:\Program Files\TabezaConnect\TabezaTray.exe`
- Launches automatically on user login
- Does not require admin privileges

### 9. Heartbeat Service

**Purpose:** Report device online status to cloud for monitoring.

**Module:** `src/service/heartbeat/heartbeat-service.js`

**Interface:**
```javascript
class HeartbeatService {
  constructor(config) { }

  /**
   * Start sending heartbeats
   */
  start() { }

  /**
   * Stop sending heartbeats
   */
  stop() { }

  /**
   * Send single heartbeat to cloud
   * @returns {Promise<void>}
   */
  async sendHeartbeat() { }

  /**
   * Generate driver ID from hostname
   * @returns {string} Format: "driver-{HOSTNAME}"
   */
  static generateDriverId() { }
}
```

**Implementation Details:**
- Interval: 30 seconds
- Endpoint: POST /api/printer/heartbeat
- Payload: `{barId, driverId, version, status: 'online'}`
- Driver ID format: `driver-{HOSTNAME}` (e.g., "driver-VENUE-PC-01")
- Version: Read from package.json
- Error handling: Log warning on failure, retry on next interval
- Uses axios with 10s timeout
- Starts automatically when capture service starts

## Data Models

### Configuration Object

```typescript
interface Config {
  barId: string;           // Venue identifier
  apiUrl: string;          // Cloud API base URL
  watchFolder: string;     // Path to TabezaPrints folder
  httpPort: number;        // Management UI port
  source: 'env' | 'registry' | 'config' | 'default';
}
```

### Template Object

```typescript
interface Template {
  version: string;         // Template version (e.g., "1.2")
  posSystem: string;       // POS system name
  patterns: {
    item_line: string;     // Regex for item lines
    total_line: string;    // Regex for total line
    receipt_number: string; // Regex for receipt number
  };
  confidence_threshold: number; // Minimum confidence (0.0-1.0)
}
```

### Parsed Receipt Object

```typescript
interface ParsedReceipt {
  parsed: boolean;         // True if template parsing succeeded
  confidence: number;      // Confidence score 0.0-1.0
  items: Array<{
    name: string;          // Item name
    qty: number;           // Quantity (positive integer)
    price: number;         // Price per unit (positive number)
  }>;
  total: number;           // Total amount
  receiptNumber: string;   // Receipt identifier
  rawText: string;         // Stripped plain text
}
```

### Queue Item Object

```typescript
interface QueueItem {
  id: string;              // UUID
  barId: string;           // Venue identifier
  driverId: string;        // Device identifier
  timestamp: string;       // ISO 8601 timestamp
  parsed: boolean;         // Parsing success flag
  confidence: number;      // Confidence score
  receipt: ParsedReceipt;  // Parsed receipt data
  enqueuedAt: string;      // ISO 8601 timestamp
  uploadAttempts: number;  // Retry counter
  lastUploadError: string | null; // Last error message
}
```

### Heartbeat Payload

```typescript
interface HeartbeatPayload {
  barId: string;           // Venue identifier
  driverId: string;        // Device identifier (driver-{HOSTNAME})
  version: string;         // Application version
  status: 'online';        // Always 'online' when sending
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following testable properties and performed reflection to eliminate redundancy:

**Redundancy Analysis:**
- Registry reading properties (1.1, 1.2, 1.3) can be combined into a single property about reading all registry keys
- ESC/POS stripping properties (2.2, 2.3) are both about preserving specific characters and can be combined
- Template parser extraction properties (3.3, 3.4, 3.5) are all about applying regex patterns and can be combined
- Item validation properties (14.3, 14.4, 14.5) are all about validating extracted item fields and can be combined
- Queue idempotence properties (15.1, 15.3, 15.4) all test the same exactly-once semantics
- Template generator properties (16.1, 16.2, 16.3) all test order independence and determinism

**Final Properties (After Redundancy Elimination):**

### Property 1: Configuration Priority Cascade

*For any* combination of configuration sources (environment variables, registry, config.json, defaults), the Registry Reader should select the value from the highest priority source that contains a non-null value, following the priority order: environment variables → registry → config.json → defaults.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 2: Configuration Fallback Resilience

*For any* configuration source that fails to read (registry error, missing config file), the Registry Reader should log a warning and continue to the next priority source without throwing an exception.

**Validates: Requirements 1.5**

### Property 3: ESC/POS Character Preservation

*For any* raw print data containing printable ASCII characters (0x20-0x7E) and newline characters (0x0A, 0x0D), the ESC/POS Stripper should preserve all these characters in the output plain text.

**Validates: Requirements 2.2, 2.3**

### Property 4: ESC/POS Control Code Removal

*For any* raw print data containing ESC sequences (0x1B + command bytes) or GS sequences (0x1D + command bytes), the ESC/POS Stripper should remove all these control sequences from the output.

**Validates: Requirements 2.1, 2.4, 2.5**

### Property 5: Template Pattern Application

*For any* receipt text and valid template, the Template Parser should apply all regex patterns (item_line, total_line, receipt_number) and extract the matched data into the corresponding fields.

**Validates: Requirements 3.2, 3.3, 3.4, 3.5**

### Property 6: Confidence Score Calculation

*For any* parsing result, the Template Parser should calculate confidence as the ratio of successful pattern matches to total patterns, producing a value between 0.0 and 1.0.

**Validates: Requirements 3.6**

### Property 7: Receipt Total Validation

*For any* parsed receipt with items and total, the sum of (item.qty * item.price) for all items should equal the total within 0.01 tolerance, otherwise the receipt should be rejected.

**Validates: Requirements 14.2, 14.6**

### Property 8: Extracted Item Validation

*For any* parsed receipt, all extracted items should have a non-empty name string, a positive integer quantity, and a positive number price.

**Validates: Requirements 14.3, 14.4, 14.5**

### Property 9: Queue File Creation

*For any* parsed receipt, the Queue System should write a JSON file to the pending folder with a UUID filename containing all required fields: id, barId, driverId, timestamp, parsed, confidence, receipt, enqueuedAt, uploadAttempts, lastUploadError.

**Validates: Requirements 4.1, 4.2**

### Property 10: Upload Success State Transition

*For any* pending receipt that uploads successfully (HTTP 2xx), the Upload Worker should move the file from pending\ to uploaded\ and not attempt to upload it again.

**Validates: Requirements 4.5**

### Property 11: Upload Retry with Exponential Backoff

*For any* pending receipt that fails to upload, the Upload Worker should increment the uploadAttempts counter and retry with exponential backoff delays (5s, 10s, 20s, 40s) for up to 4 attempts.

**Validates: Requirements 4.6, 4.7**

### Property 12: Queue Restart Resilience

*For any* set of pending receipts in the queue folder, when the Capture Service restarts, the Upload Worker should resume processing all pending files in chronological order (by enqueuedAt).

**Validates: Requirements 4.9**

### Property 13: Queue Exactly-Once Semantics

*For any* receipt, uploading the same receipt multiple times should result in the same cloud state, and once a receipt is moved to uploaded\, it should never be re-uploaded even after service restart.

**Validates: Requirements 15.1, 15.3, 15.4**

### Property 14: Heartbeat Payload Structure

*For any* heartbeat sent to the cloud, the payload should include barId, driverId (in format "driver-{HOSTNAME}"), version (from package.json), and status set to "online".

**Validates: Requirements 11.2, 11.3, 11.4**

### Property 15: Driver ID Format

*For any* Windows hostname, the generated driver ID should follow the format "driver-{HOSTNAME}" and be included in all cloud API requests.

**Validates: Requirements 12.1, 12.2, 12.3**

### Property 16: HTTP Server Fault Isolation

*For any* HTTP server startup failure, the Capture Service should continue running and processing receipts without interruption.

**Validates: Requirements 5.11**

### Property 17: Configuration Validation

*For any* configuration update request, the Configuration Page should validate that Bar ID is non-empty and API URL is a valid HTTPS URL before allowing the save operation.

**Validates: Requirements 8.9, 8.10**

### Property 18: Template Generator Order Independence

*For any* set of 3 test receipts [A, B, C], generating a template from receipts in order [A, B, C] should produce equivalent regex patterns to generating from [C, B, A] or any other permutation.

**Validates: Requirements 16.1, 16.2, 16.3**


## Error Handling

### Registry Reader Errors

**Scenario:** Windows Registry key does not exist or cannot be read
- **Handling:** Catch exception, log warning with key name, return null
- **Recovery:** Continue to next priority source (config.json or defaults)
- **User Impact:** None if fallback sources provide values

**Scenario:** Config.json file is malformed JSON
- **Handling:** Catch parse exception, log warning, return null
- **Recovery:** Use default values
- **User Impact:** Service starts with defaults, user can fix via Management UI

**Scenario:** Bar ID is missing from all sources
- **Handling:** Log error, allow service to start
- **Recovery:** Upload Worker will fail with clear error message
- **User Impact:** User must configure Bar ID via Management UI before uploads work

### ESC/POS Stripper Errors

**Scenario:** Raw data contains unexpected control sequences
- **Handling:** Skip unknown sequences, continue processing
- **Recovery:** Best-effort stripping, preserve as much text as possible
- **User Impact:** May result in some control codes in output, but parsing should still work

**Scenario:** Raw data is empty or null
- **Handling:** Return empty string
- **Recovery:** Parser will mark as parsed: false
- **User Impact:** Receipt uploaded as unparsed, user prompted to complete template setup

### Template Parser Errors

**Scenario:** Template.json file does not exist
- **Handling:** Return `{parsed: false, rawText: plainText}`
- **Recovery:** Upload unparsed receipt to cloud
- **User Impact:** Management UI prompts user to complete template setup

**Scenario:** Template.json is malformed JSON
- **Handling:** Catch parse exception, log error, treat as missing template
- **Recovery:** Upload unparsed receipts
- **User Impact:** User must regenerate template via Management UI

**Scenario:** Regex pattern fails to compile
- **Handling:** Catch regex error, log error, skip that pattern
- **Recovery:** Continue with remaining patterns, lower confidence score
- **User Impact:** Partial parsing, may need template regeneration

**Scenario:** Parsed total does not match sum of items
- **Handling:** Log warning, set confidence to 0.0, mark as parsed: false
- **Recovery:** Upload as unparsed receipt
- **User Impact:** Receipt flagged for review, may indicate template needs adjustment

### Queue System Errors

**Scenario:** Pending folder does not exist
- **Handling:** Create folder automatically on first enqueue
- **Recovery:** Continue normal operation
- **User Impact:** None

**Scenario:** Disk full when writing queue file
- **Handling:** Catch write exception, log error, archive to failed\ folder
- **Recovery:** Receipt lost for this print job
- **User Impact:** One receipt not uploaded, user should monitor disk space

**Scenario:** Queue file is corrupted (malformed JSON)
- **Handling:** Catch parse exception, log error, move to failed\ folder
- **Recovery:** Skip to next pending file
- **User Impact:** One receipt not uploaded, file preserved in failed\ for manual recovery

### Upload Worker Errors

**Scenario:** Network timeout during upload
- **Handling:** Catch timeout exception, increment uploadAttempts, retry with backoff
- **Recovery:** Retry up to 4 times, then leave in pending\ for next restart
- **User Impact:** Delayed upload, automatic retry on next service start

**Scenario:** Cloud API returns 4xx error (bad request)
- **Handling:** Log error with response body, move to failed\ folder (no retry)
- **Recovery:** Receipt not uploaded, preserved for manual review
- **User Impact:** Receipt flagged for review, may indicate data format issue

**Scenario:** Cloud API returns 5xx error (server error)
- **Handling:** Treat as temporary failure, retry with backoff
- **Recovery:** Retry up to 4 times
- **User Impact:** Delayed upload, automatic retry

### HTTP Server Errors

**Scenario:** Port 8765 already in use
- **Handling:** Catch bind exception, log error, continue capture service
- **Recovery:** Capture service runs without Management UI
- **User Impact:** Cannot access Management UI, must stop conflicting process

**Scenario:** Static files missing from public\ folder
- **Handling:** Return 404 for missing files, log warning
- **Recovery:** Server continues running, other endpoints work
- **User Impact:** Management UI may not load correctly

**Scenario:** API endpoint throws unhandled exception
- **Handling:** Express error middleware catches, returns 500 JSON response
- **Recovery:** Server continues running, other requests work
- **User Impact:** Single request fails, user can retry

### Heartbeat Service Errors

**Scenario:** Network unavailable when sending heartbeat
- **Handling:** Catch network exception, log warning, continue
- **Recovery:** Retry on next 30s interval
- **User Impact:** Device shows offline in staff dashboard temporarily

**Scenario:** Cloud API rejects heartbeat (4xx/5xx)
- **Handling:** Log warning with response, continue
- **Recovery:** Retry on next interval
- **User Impact:** Device may show offline in staff dashboard

### System Tray Errors

**Scenario:** Tray process crashes
- **Handling:** Windows restarts on next login (via Run key)
- **Recovery:** Capture service unaffected, continues running
- **User Impact:** No tray icon until next login, can access Management UI via browser

**Scenario:** Cannot connect to localhost:8765
- **Handling:** Show grey icon, log warning
- **Recovery:** Poll every 10s until server available
- **User Impact:** Tray shows offline, menu items may not work

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests:** Verify specific examples, edge cases, and error conditions
- Template parser with known receipt formats
- Queue file operations with specific filenames
- HTTP endpoint responses with mock data
- Configuration validation with specific invalid inputs
- Template generator workflow state transitions

**Property-Based Tests:** Verify universal properties across all inputs
- Configuration priority cascade with random sources
- ESC/POS stripping with random control sequences
- Template parsing with random receipt structures
- Queue system resilience with random failure scenarios
- Upload retry logic with random network conditions

Both approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across the input space.

### Property-Based Testing Configuration

**Library:** fast-check (JavaScript property-based testing library)

**Test Configuration:**
- Minimum 100 iterations per property test (due to randomization)
- Each property test must reference its design document property
- Tag format: `Feature: management-ui-and-missing-features, Property {number}: {property_text}`

**Example Property Test Structure:**
```javascript
const fc = require('fast-check');

describe('Property 1: Configuration Priority Cascade', () => {
  it('should select value from highest priority source', () => {
    // Feature: management-ui-and-missing-features, Property 1: Configuration Priority Cascade
    fc.assert(
      fc.property(
        fc.record({
          env: fc.option(fc.string()),
          registry: fc.option(fc.string()),
          config: fc.option(fc.string()),
          default: fc.string()
        }),
        (sources) => {
          const result = RegistryReader.loadConfig(sources);
          const expected = sources.env ?? sources.registry ?? sources.config ?? sources.default;
          return result.value === expected;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Test Coverage

**Registry Reader:**
- Test reading existing registry keys
- Test handling missing registry keys
- Test malformed config.json
- Test priority cascade with specific combinations
- Test default value fallback

**ESC/POS Stripper:**
- Test stripping common ESC/POS sequences
- Test preserving printable ASCII
- Test preserving newlines
- Test handling empty input
- Test handling binary data without control codes

**Template Parser:**
- Test parsing with valid template and receipt
- Test handling missing template.json
- Test handling malformed template JSON
- Test confidence calculation with partial matches
- Test total validation with mismatched sums
- Test item validation with invalid data

**Queue System:**
- Test enqueue creates file with UUID
- Test dequeue returns oldest pending file
- Test markUploaded moves file to uploaded\
- Test markFailed updates attempt counter
- Test scanPending returns all pending files sorted

**Upload Worker:**
- Test successful upload moves file
- Test failed upload increments counter
- Test exponential backoff delays
- Test max attempts leaves file in pending\
- Test restart resumes pending uploads

**HTTP Server:**
- Test all API endpoints return correct responses
- Test static file serving
- Test CORS headers
- Test error handling returns JSON
- Test server failure does not stop capture service

**Management UI:**
- Test dashboard displays status data
- Test template generator workflow state transitions
- Test configuration validation
- Test log viewer displays log lines

**Heartbeat Service:**
- Test heartbeat payload structure
- Test driver ID generation format
- Test error handling continues on failure

### Integration Testing

**End-to-End Receipt Flow:**
1. Write test data to order.prn
2. Verify file watcher detects change
3. Verify ESC/POS stripping produces plain text
4. Verify template parsing extracts data
5. Verify queue file created in pending\
6. Verify upload worker sends to cloud
7. Verify file moved to uploaded\

**Template Generator Workflow:**
1. Start with no template.json
2. Simulate 3 receipt captures
3. Verify UI detects receipts
4. Verify template generation API call
5. Verify template.json created
6. Verify subsequent receipts parsed with template

**Configuration Update Flow:**
1. Load current config in UI
2. Update Bar ID value
3. Submit form
4. Verify API call updates config
5. Verify service uses new config

### Manual Testing Checklist

**Installation:**
- [ ] Installer creates registry keys
- [ ] Installer opens Management UI in browser
- [ ] Management UI detects missing template
- [ ] Template generator modal appears

**Template Setup:**
- [ ] Print test receipt 1, verify detection
- [ ] Print test receipt 2, verify detection
- [ ] Print test receipt 3, verify detection
- [ ] Verify template generation completes
- [ ] Verify template.json created
- [ ] Verify subsequent receipts parsed

**Queue Resilience:**
- [ ] Disconnect network, print receipt
- [ ] Verify receipt queued in pending\
- [ ] Reconnect network
- [ ] Verify receipt uploaded automatically
- [ ] Verify file moved to uploaded\

**System Tray:**
- [ ] Verify tray icon appears on login
- [ ] Verify icon color reflects service status
- [ ] Verify "Open Dashboard" opens browser
- [ ] Verify "Send Test Print" triggers capture
- [ ] Verify "View Logs" opens log viewer
- [ ] Verify "Quit" exits tray but service continues

**Error Scenarios:**
- [ ] Delete template.json, verify unparsed upload
- [ ] Stop HTTP server, verify capture continues
- [ ] Fill disk, verify error logged
- [ ] Corrupt queue file, verify moved to failed\


## Implementation Notes

### File Structure

```
src/
├── service/
│   ├── index.js                    # Main service entry (existing)
│   ├── config/
│   │   └── registry-reader.js      # Configuration loader
│   ├── parser/
│   │   ├── escpos-stripper.js      # Control code removal
│   │   └── template-parser.js      # Regex-based parsing
│   ├── queue/
│   │   ├── queue-manager.js        # Queue file operations
│   │   └── upload-worker.js        # Background uploader
│   └── heartbeat/
│       └── heartbeat-service.js    # Status reporting
├── server/
│   ├── index.js                    # HTTP server
│   ├── routes/
│   │   ├── status.js               # GET /api/status
│   │   ├── config.js               # GET/POST /api/config
│   │   ├── logs.js                 # GET /api/logs
│   │   ├── test-print.js           # POST /api/test-print
│   │   └── template.js             # Template endpoints
│   └── public/
│       ├── index.html              # Dashboard
│       ├── template.html           # Template generator
│       ├── config.html             # Configuration page
│       ├── logs.html               # Log viewer
│       ├── css/
│       │   └── styles.css          # Shared styles
│       └── js/
│           ├── dashboard.js        # Dashboard logic
│           ├── template.js         # Template generator logic
│           ├── config.js           # Configuration logic
│           └── logs.js             # Log viewer logic
└── tray/
    └── index.js                    # System tray (separate process)
```

### Dependencies

**New Dependencies:**
- `fast-check`: Property-based testing library
- `axios`: HTTP client for cloud API calls
- `express`: HTTP server framework
- `cors`: CORS middleware for Express
- `electron`: System tray icon (tray process only)

**Existing Dependencies:**
- `chokidar`: File watching (already in use)
- `pkg`: Executable compilation (already in use)

### Build Process

**Main Service:**
```bash
pkg src/service/index.js --targets node20-win-x64 --output TabezaConnect.exe
```

**System Tray:**
```bash
pkg src/tray/index.js --targets node20-win-x64 --output TabezaTray.exe
```

**Assets:**
- Copy `src/server/public/` to pkg virtual filesystem
- Copy `assets/icon-green.ico` and `assets/icon-grey.ico` to pkg virtual filesystem

### Configuration Priority Implementation

```javascript
function loadConfig() {
  const config = {
    barId: null,
    apiUrl: null,
    watchFolder: null,
    httpPort: null,
    source: null
  };

  // Priority 1: Environment variables
  if (process.env.TABEZA_BAR_ID) {
    config.barId = process.env.TABEZA_BAR_ID;
    config.source = 'env';
  }
  if (process.env.TABEZA_API_URL) {
    config.apiUrl = process.env.TABEZA_API_URL;
  }
  if (process.env.TABEZA_WATCH_FOLDER) {
    config.watchFolder = process.env.TABEZA_WATCH_FOLDER;
  }

  // Priority 2: Windows Registry
  const registryConfig = readRegistry();
  if (!config.barId && registryConfig.barId) {
    config.barId = registryConfig.barId;
    config.source = 'registry';
  }
  if (!config.apiUrl && registryConfig.apiUrl) {
    config.apiUrl = registryConfig.apiUrl;
  }
  if (!config.watchFolder && registryConfig.watchFolder) {
    config.watchFolder = registryConfig.watchFolder;
  }

  // Priority 3: Config file
  const fileConfig = readConfigFile();
  if (!config.barId && fileConfig.barId) {
    config.barId = fileConfig.barId;
    config.source = 'config';
  }
  if (!config.apiUrl && fileConfig.apiUrl) {
    config.apiUrl = fileConfig.apiUrl;
  }
  if (!config.watchFolder && fileConfig.watchFolder) {
    config.watchFolder = fileConfig.watchFolder;
  }

  // Priority 4: Defaults
  if (!config.apiUrl) {
    config.apiUrl = 'https://tabeza.co.ke';
    if (!config.source) config.source = 'default';
  }
  if (!config.watchFolder) {
    config.watchFolder = 'C:\\ProgramData\\Tabeza\\TabezaPrints';
  }
  if (!config.httpPort) {
    config.httpPort = 8765;
  }

  return config;
}
```

### Service Startup Sequence

1. **Initialize Logging:** Create log directory, open log file
2. **Load Configuration:** Run priority cascade, log final values
3. **Generate Driver ID:** Read hostname, format as "driver-{HOSTNAME}"
4. **Create Queue Folders:** Ensure pending\ and uploaded\ exist
5. **Start Capture Service:** Initialize file watcher
6. **Scan Pending Queue:** Resume any pending uploads
7. **Start Upload Worker:** Begin 2s polling loop
8. **Start Heartbeat Service:** Begin 30s heartbeat loop
9. **Start HTTP Server:** Bind to port 8765 (optional, failure isolated)
10. **Log Ready Message:** "Tabeza Connect v1.7.0 ready"

### Installer Integration

**Inno Setup Script Addition:**
```pascal
[Run]
Filename: "{cmd}"; Parameters: "/C timeout /T 5 /NOBREAK"; \
  StatusMsg: "Starting Tabeza Connect service..."; Flags: runhidden
Filename: "{sys}\cmd.exe"; Parameters: "/C start http://localhost:8765"; \
  StatusMsg: "Opening Management UI..."; Flags: runhidden nowait
```

**Registry Keys Created:**
```
HKLM\SOFTWARE\Tabeza\TabezaConnect\BarID = {user_input}
HKLM\SOFTWARE\Tabeza\TabezaConnect\APIUrl = https://tabeza.co.ke
HKLM\SOFTWARE\Tabeza\TabezaConnect\WatchFolder = C:\ProgramData\Tabeza\TabezaPrints

HKCU\Software\Microsoft\Windows\CurrentVersion\Run\TabezaTray = 
  "C:\Program Files\TabezaConnect\TabezaTray.exe"
```

### Performance Targets

- **ESC/POS Stripping:** < 5ms for receipts < 10KB
- **Template Parsing:** < 5ms for typical receipts
- **Queue Enqueue:** < 10ms (file write)
- **Queue Dequeue:** < 5ms (file read)
- **HTTP API Response:** < 100ms for all endpoints
- **Management UI Load:** < 500ms initial page load
- **Heartbeat Overhead:** < 50ms per 30s interval

### Security Considerations

**HTTP Server:**
- Bind to localhost only (no external access)
- No authentication required (local-only access)
- CORS restricted to localhost origins
- Input validation on all POST endpoints

**Configuration:**
- Bar ID stored in registry (readable by LocalService account)
- No sensitive credentials stored locally
- API URL validated as HTTPS only

**Queue Files:**
- Stored in C:\ProgramData\Tabeza (LocalService has write access)
- No encryption (local filesystem security)
- UUID filenames prevent collisions

**System Tray:**
- Runs under user account (not elevated)
- Communicates via HTTP to localhost only
- No sensitive operations

### Monitoring and Observability

**Logging:**
- All components log to `C:\ProgramData\Tabeza\logs\service.log`
- Log format: `[YYYY-MM-DD HH:MM:SS] [LEVEL] message`
- Log levels: INFO, WARN, ERROR
- Log rotation: Not implemented (manual cleanup required)

**Metrics:**
- Job count: Tracked in memory, displayed in dashboard
- Last activity: Timestamp of last receipt capture
- Queue stats: Pending/uploaded/failed counts
- Heartbeat status: Last successful heartbeat timestamp

**Health Checks:**
- HTTP server: GET /api/status returns service health
- System tray: Polls /api/status every 10s
- Cloud monitoring: Heartbeat every 30s

### Deployment Checklist

**Pre-Installation:**
- [ ] Venue has Bar ID from Tabeza dashboard
- [ ] Thermal printer is connected and working
- [ ] Windows PC meets requirements (Windows 10+, Node.js not required)

**Installation:**
- [ ] Run TabezaConnect-Setup.exe as Administrator
- [ ] Enter Bar ID when prompted
- [ ] Select physical printer for pooling
- [ ] Wait for service registration
- [ ] Browser opens to Management UI

**Post-Installation:**
- [ ] Complete template generator workflow (3 test receipts)
- [ ] Verify template.json created
- [ ] Print test receipt, verify parsing
- [ ] Check dashboard shows "online" status
- [ ] Verify system tray icon appears (green)

**Verification:**
- [ ] Print receipt from POS
- [ ] Check dashboard job count increments
- [ ] Check queue\uploaded\ contains receipt file
- [ ] Check cloud dashboard shows receipt
- [ ] Check heartbeat shows device online

## Summary

This design implements all missing components required to complete Tabeza Connect v1.7.0 as specified in the architecture document. The implementation follows a fault-tolerant design where the core capture service continues operating even if optional components fail. The queue system ensures no receipts are lost during network outages or service restarts. The Management UI provides a user-friendly interface for configuration and monitoring without requiring manual file editing. Property-based testing ensures correctness across the input space, while unit tests verify specific scenarios and edge cases.

Key design decisions:
- Configuration priority cascade enables flexible deployment
- ESC/POS stripping preserves only essential characters for parsing
- Template-based parsing is fast (< 5ms) and works offline
- Queue system provides exactly-once upload semantics
- HTTP server failure is isolated from capture service
- System tray provides convenient access without requiring browser bookmarks
- Heartbeat service enables cloud monitoring of device health

The implementation is ready for development following the task breakdown in tasks.md.
