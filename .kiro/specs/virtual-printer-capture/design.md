# Design Document: Virtual Printer Capture Architecture (clawPDF-Based)

## Overview

This design specifies the migration of Tabeza Connect from Windows printer pooling to a robust virtual printer architecture using clawPDF as the foundation. The clawPDF-based solution eliminates the need for custom Windows driver development while providing reliable print job capture and forwarding capabilities.

### Current Architecture Limitations

The existing Windows printer pooling approach has a fundamental flaw: Windows pooling does not duplicate print jobs to multiple ports. Once a job prints to one port in the pool, it cannot print to another. This makes reliable capture impossible while maintaining physical printing.

### Proposed Solution

A clawPDF-based virtual printer that:
- Leverages clawPDF (https://github.com/clawsoftware/clawPDF), an open-source virtual printer for Windows
- Appears as "Tabeza POS Printer" to POS systems
- Captures print jobs as raw PostScript files to a monitored spool folder
- Integrates with Tabeza Connect service to process, parse, and forward jobs
- Eliminates months of C++ driver development and code signing complexity

### Design Goals

1. **Zero POS Reconfiguration** - POS systems continue printing to "Tabeza POS Printer" without changes
2. **Transparent Operation** - Physical receipts print exactly as before
3. **Reliable Capture** - 100% capture rate with no data loss
4. **Fault Isolation** - clawPDF failures do not affect physical printing
5. **Backward Compatibility** - Existing config.json, template.json, and queue system remain unchanged
6. **Performance** - < 100ms capture time, < 200MB memory footprint
7. **No Custom Driver Development** - Leverage proven open-source infrastructure

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Tabeza Connect Application                   │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Electron Main Process                        │ │
│  │  - System tray management                                       │ │
│  │  - Window lifecycle                                             │ │
│  │  - IPC coordination                                             │ │
│  │  - State synchronization                                        │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                   Background Service (Node.js)                  │ │
│  │                                                                  │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │  Virtual Printer Driver Interface                        │  │ │
│  │  │  - Named pipe server (\\.\pipe\TabezaPrinter)           │  │ │
│  │  │  - Receives print jobs from driver                       │  │ │
│  │  │  - Job validation and queuing                            │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                  │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │  Capture Service (existing)                              │  │ │
│  │  │  - ESC/POS processor                                     │  │ │
│  │  │  - Receipt parser                                        │  │ │
│  │  │  - Local queue management                                │  │ │
│  │  │  - Upload worker                                         │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                  │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │  Physical Printer Adapter (NEW)                          │  │ │
│  │  │  - USB printer communication                             │  │ │
│  │  │  - Network printer communication                         │  │ │
│  │  │  - Serial port communication                             │  │ │
│  │  │  - Printer status detection                              │  │ │
│  │  │  - Job forwarding queue                                  │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                  │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │  HTTP Server (localhost:8765)                            │  │ │
│  │  │  - Management UI                                         │  │ │
│  │  │  - Printer configuration API                             │  │ │
│  │  │  - Status monitoring                                     │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ Named Pipe
                                │ (\\.\pipe\TabezaPrinter)
                                │
┌─────────────────────────────────────────────────────────────────────┐
│                    Virtual Printer Driver (C++)                      │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Print Processor                                                │ │
│  │  - Receives jobs from Windows Print Spooler                    │ │
│  │  - Validates job data                                          │ │
│  │  - Sends to service via named pipe                             │ │
│  │  - Returns success/failure to spooler                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Port Monitor                                                   │ │
│  │  - Implements IMonitor2 interface                              │ │
│  │  - Manages "TabezaVirtualPort"                                 │ │
│  │  - Handles port configuration                                  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Driver Configuration                                           │ │
│  │  - Registry settings                                            │ │
│  │  - Service connection parameters                               │ │
│  │  - Timeout and retry configuration                             │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ Windows Print Spooler API
                                │
┌─────────────────────────────────────────────────────────────────────┐
│                      Windows Print Spooler                           │
│  - Receives jobs from POS systems                                   │
│  - Routes to "Tabeza POS Printer"                                   │
│  - Manages print queue                                              │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ Print API
                                │
┌─────────────────────────────────────────────────────────────────────┐
│                          POS System                                  │
│  - Prints to "Tabeza POS Printer"                                   │
│  - No configuration changes required                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
┌──────────────┐
│  POS System  │
└──────┬───────┘
       │ Print Job
       │ (ESC/POS commands)
       ▼
┌─────────────────────────────────────┐
│   Windows Print Spooler             │
│   - Queues job                      │
│   - Routes to "Tabeza POS Printer"  │
└──────┬──────────────────────────────┘
       │
       │ Spooled Job
       ▼
┌─────────────────────────────────────┐
│   Virtual Printer Driver            │
│   - Print Processor receives job    │
│   - Validates data                  │
│   - Generates job ID                │
└──────┬──────────────────────────────┘
       │
       │ Named Pipe Message
       │ { jobId, data, size, timestamp }
       ▼
┌─────────────────────────────────────┐
│   Tabeza Connect Service            │
│   - Named pipe server receives job  │
│   - Writes to capture file          │
│   - Queues for forwarding           │
└──────┬──────────────────────────────┘
       │
       ├─────────────────────────────────┐
       │                                 │
       │ Capture Path                    │ Forward Path
       ▼                                 ▼
┌──────────────────────┐    ┌──────────────────────────┐
│  Capture Service     │    │  Physical Printer        │
│  - Save to disk      │    │  Adapter                 │
│  - Parse ESC/POS     │    │  - Detect printer type   │
│  - Extract data      │    │  - Open connection       │
│  - Queue for upload  │    │  - Send raw data         │
└──────┬───────────────┘    │  - Verify completion     │
       │                    └──────┬───────────────────┘
       │                           │
       │ Parsed JSON               │ Raw ESC/POS
       ▼                           ▼
┌──────────────────────┐    ┌──────────────────────────┐
│  Upload Worker       │    │  Physical Printer        │
│  - POST to cloud     │    │  - Prints receipt        │
│  - Retry on failure  │    │  - Returns status        │
└──────────────────────┘    └──────────────────────────┘
```

## Components and Interfaces

### 1. Virtual Printer Driver (C++)

#### 1.1 Print Processor

**Responsibility:** Receives print jobs from Windows Print Spooler and forwards to service.

**Interface:**
```cpp
class TabezaPrintProcessor : public IPrintProcessor {
public:
    // IPrintProcessor implementation
    HRESULT OpenPrintProcessor(
        HANDLE hPrinter,
        LPWSTR pPrinterName,
        PPRINTPROCESSOROPENDATA pOpenData,
        PHANDLE phPrintProcessor
    );
    
    HRESULT PrintDocumentOnPrintProcessor(
        HANDLE hPrintProcessor,
        LPWSTR pDocumentName
    );
    
    HRESULT ClosePrintProcessor(HANDLE hPrintProcessor);
    
private:
    // Internal methods
    HRESULT SendJobToService(
        const BYTE* pData,
        DWORD dwSize,
        LPCWSTR pDocumentName
    );
    
    HRESULT ConnectToNamedPipe();
    void DisconnectFromNamedPipe();
    
    HANDLE m_hPipe;
    CRITICAL_SECTION m_cs;
};
```

**Key Algorithms:**

1. **Job Reception Algorithm**
```
FUNCTION PrintDocumentOnPrintProcessor(hPrintProcessor, pDocumentName):
    1. Acquire critical section lock
    2. Read print data from spooler
    3. Validate data size (must be > 0, < 10MB)
    4. Generate unique job ID (UUID)
    5. Create job metadata:
       - jobId
       - timestamp
       - documentName
       - dataSize
    6. Attempt to send to service via named pipe:
       a. Connect to \\.\pipe\TabezaPrinter
       b. Send metadata (JSON header)
       c. Send raw print data
       d. Wait for acknowledgment (timeout: 5 seconds)
    7. If send fails:
       - Log error to Windows Event Log
       - Return ERROR_PRINT_PROCESSOR_ALREADY_INSTALLED (non-fatal)
       - Spooler will retry
    8. Release critical section lock
    9. Return S_OK
```

2. **Named Pipe Communication Protocol**
```
Message Format:
┌────────────────────────────────────────┐
│ Header (256 bytes)                     │
│ - Magic: "TABEZA01" (8 bytes)         │
│ - Version: 1 (4 bytes)                │
│ - JobID: UUID (36 bytes)              │
│ - DataSize: uint32 (4 bytes)          │
│ - Timestamp: ISO8601 (32 bytes)       │
│ - DocumentName: UTF-16 (128 bytes)    │
│ - Reserved: (44 bytes)                │
├────────────────────────────────────────┤
│ Data (variable length)                 │
│ - Raw print data (ESC/POS commands)   │
└────────────────────────────────────────┘

Response Format:
┌────────────────────────────────────────┐
│ Status (4 bytes)                       │
│ - 0x00000000: Success                 │
│ - 0x00000001: Service busy            │
│ - 0x00000002: Invalid data            │
│ - 0x00000003: Disk full               │
└────────────────────────────────────────┘
```

#### 1.2 Port Monitor

**Responsibility:** Manages the virtual port "TabezaVirtualPort" and provides configuration UI.

**Interface:**
```cpp
class TabezaPortMonitor : public IMonitor2 {
public:
    // IMonitor2 implementation
    BOOL OpenPort(LPWSTR pName, PHANDLE pHandle);
    BOOL StartDocPort(HANDLE hPort, LPWSTR pPrinterName, 
                      DWORD JobId, DWORD Level, LPBYTE pDocInfo);
    BOOL WritePort(HANDLE hPort, LPBYTE pBuffer, 
                   DWORD cbBuf, LPDWORD pcbWritten);
    BOOL EndDocPort(HANDLE hPort);
    BOOL ClosePort(HANDLE hPort);
    
    // Configuration
    BOOL AddPortUI(HWND hWnd, LPWSTR pMonitorName, LPWSTR* ppPortName);
    BOOL ConfigurePortUI(HWND hWnd, LPWSTR pPortName);
    BOOL DeletePortUI(HWND hWnd, LPWSTR pPortName);
    
private:
    struct PortContext {
        HANDLE hPipe;
        DWORD jobId;
        std::vector<BYTE> buffer;
    };
    
    std::map<HANDLE, PortContext> m_ports;
    CRITICAL_SECTION m_cs;
};
```

**Key Algorithms:**

1. **Port Write Buffering**
```
FUNCTION WritePort(hPort, pBuffer, cbBuf, pcbWritten):
    1. Acquire critical section lock
    2. Find port context by handle
    3. Append pBuffer to context.buffer
    4. Set *pcbWritten = cbBuf
    5. Release critical section lock
    6. Return TRUE
    
    Note: Data is buffered until EndDocPort is called
```

2. **Document Completion**
```
FUNCTION EndDocPort(hPort):
    1. Acquire critical section lock
    2. Find port context by handle
    3. Get complete buffered data
    4. Send to service via named pipe:
       - Connect to \\.\pipe\TabezaPrinter
       - Send job metadata + buffered data
       - Wait for acknowledgment
    5. Clear buffer
    6. Release critical section lock
    7. Return TRUE
```

### 2. Named Pipe Server (Node.js)

**Responsibility:** Receives print jobs from driver and routes to capture/forward services.

**Location:** `src/service/driver-interface.js` (NEW)

**Interface:**
```javascript
class DriverInterface {
    constructor(config) {
        this.pipeName = '\\\\.\\pipe\\TabezaPrinter';
        this.server = null;
        this.activeConnections = new Set();
        this.jobQueue = [];
        this.config = config;
    }
    
    async start() {
        // Create named pipe server
        // Listen for driver connections
        // Handle incoming print jobs
    }
    
    async handlePrintJob(jobData) {
        // Validate job data
        // Write to capture file
        // Queue for forwarding
        // Send acknowledgment to driver
    }
    
    async stop() {
        // Close all connections
        // Stop named pipe server
    }
}
```

**Key Algorithms:**

1. **Named Pipe Server Loop**
```
FUNCTION start():
    1. Create named pipe: \\.\pipe\TabezaPrinter
    2. Set pipe mode: PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE
    3. Set buffer sizes: 1MB in, 4KB out
    4. LOOP forever:
        a. Wait for client connection (ConnectNamedPipe)
        b. When client connects:
            - Spawn async handler
            - Create new pipe instance for next client
        c. In handler:
            - Read message header (256 bytes)
            - Validate magic number "TABEZA01"
            - Read data (header.dataSize bytes)
            - Call handlePrintJob(header, data)
            - Send response (4 bytes status code)
            - Disconnect client
```

2. **Print Job Handling**
```
FUNCTION handlePrintJob(header, data):
    1. Validate job data:
       - Check data size > 0 and < 10MB
       - Verify header.magic === "TABEZA01"
       - Verify header.version === 1
    
    2. Generate capture filename:
       - Format: order_{timestamp}_{jobId}.prn
       - Path: C:\TabezaPrints\order.prn (overwrite)
    
    3. Write to capture file:
       - Atomic write (write to temp, then rename)
       - Preserve all bytes exactly
    
    4. Queue for forwarding:
       - Add to forwardQueue with metadata
       - Wake up forwarding worker
    
    5. Return status:
       - 0x00000000 if success
       - 0x00000003 if disk full
       - 0x00000002 if invalid data
```

### 3. Physical Printer Adapter (Node.js)

**Responsibility:** Forwards captured print jobs to physical printers.

**Location:** `src/service/printer-adapter.js` (NEW)

**Interface:**
```javascript
class PhysicalPrinterAdapter {
    constructor(config) {
        this.config = config;
        this.printers = new Map(); // printerName -> PrinterConnection
        this.forwardQueue = [];
        this.isRunning = false;
    }
    
    async start() {
        // Load printer configuration
        // Initialize printer connections
        // Start forwarding worker
    }
    
    async forwardJob(jobData) {
        // Select target printer
        // Send raw data to printer
        // Handle errors and retries
    }
    
    async detectPrinters() {
        // Scan for USB printers
        // Scan for network printers
        // Scan for serial printers
        // Return list of available printers
    }
    
    async testPrint(printerName) {
        // Send test receipt to printer
        // Return success/failure
    }
    
    async stop() {
        // Close all printer connections
        // Stop forwarding worker
    }
}
```

**Printer Connection Types:**

1. **USB Printer Connection**
```javascript
class USBPrinterConnection {
    constructor(vendorId, productId) {
        this.device = null;
        this.endpoint = null;
    }
    
    async connect() {
        // Use node-usb to open device
        // Find bulk OUT endpoint
        // Claim interface
    }
    
    async send(data) {
        // Write data to endpoint
        // Wait for transfer complete
        // Return bytes written
    }
    
    async getStatus() {
        // Read printer status
        // Parse status bytes
        // Return { ready, paperOut, error }
    }
    
    async disconnect() {
        // Release interface
        // Close device
    }
}
```

2. **Network Printer Connection**
```javascript
class NetworkPrinterConnection {
    constructor(host, port = 9100) {
        this.host = host;
        this.port = port;
        this.socket = null;
    }
    
    async connect() {
        // Create TCP socket
        // Connect to host:port
        // Set keepalive
    }
    
    async send(data) {
        // Write data to socket
        // Wait for drain
        // Return bytes written
    }
    
    async getStatus() {
        // Send ESC/POS status query
        // Read response
        // Parse status
    }
    
    async disconnect() {
        // Close socket
    }
}
```

3. **Serial Printer Connection**
```javascript
class SerialPrinterConnection {
    constructor(portName, baudRate = 9600) {
        this.portName = portName;
        this.baudRate = baudRate;
        this.port = null;
    }
    
    async connect() {
        // Open serial port
        // Set baud rate, data bits, stop bits
        // Set flow control
    }
    
    async send(data) {
        // Write data to port
        // Wait for drain
        // Return bytes written
    }
    
    async getStatus() {
        // Send status query
        // Read response
        // Parse status
    }
    
    async disconnect() {
        // Close port
    }
}
```

**Key Algorithms:**

1. **Forwarding Worker Loop**
```
FUNCTION forwardingWorker():
    WHILE isRunning:
        1. Wait for job in forwardQueue (or timeout 1 second)
        2. If no job, continue
        3. Get next job from queue
        4. Get target printer from config
        5. Attempt to forward:
            a. Check printer status
            b. If printer not ready:
                - Requeue job
                - Wait 5 seconds
                - Continue
            c. Send raw data to printer
            d. Wait for completion
            e. If success:
                - Log success
                - Remove from queue
            f. If failure:
                - Increment retry count
                - If retries < 5:
                    - Requeue with exponential backoff
                - Else:
                    - Move to failed queue
                    - Log error
```

2. **Printer Auto-Detection**
```
FUNCTION detectPrinters():
    1. Initialize results array
    
    2. Scan USB devices:
        FOR EACH USB device:
            IF device class == PRINTER (0x07):
                - Get vendor ID, product ID
                - Get device name
                - Add to results as USB printer
    
    3. Scan network (common ports):
        FOR EACH IP in local subnet:
            TRY connect to port 9100 (timeout 100ms):
                IF success:
                    - Send ESC/POS identity query
                    - Read response
                    - Add to results as network printer
    
    4. Scan serial ports:
        FOR EACH COM port (COM1-COM9):
            TRY open port:
                IF success:
                    - Send ESC/POS identity query
                    - Read response
                    - Add to results as serial printer
    
    5. Return results array
```

## Data Models

### Print Job Model

```typescript
interface PrintJob {
    // Job identification
    jobId: string;              // UUID generated by driver
    timestamp: string;          // ISO 8601 timestamp
    documentName: string;       // Document name from POS
    
    // Raw data
    rawData: Buffer;            // Complete ESC/POS data
    dataSize: number;           // Size in bytes
    
    // Processing state
    captured: boolean;          // Written to disk
    capturedAt?: string;        // Capture timestamp
    parsed: boolean;            // Successfully parsed
    parsedAt?: string;          // Parse timestamp
    forwarded: boolean;         // Sent to physical printer
    forwardedAt?: string;       // Forward timestamp
    uploaded: boolean;          // Sent to cloud
    uploadedAt?: string;        // Upload timestamp
    
    // Error tracking
    forwardAttempts: number;    // Number of forward attempts
    lastForwardError?: string;  // Last forward error message
    uploadAttempts: number;     // Number of upload attempts
    lastUploadError?: string;   // Last upload error message
}
```

### Printer Configuration Model

```typescript
interface PrinterConfig {
    // Printer identification
    name: string;               // User-friendly name
    type: 'usb' | 'network' | 'serial';
    
    // Connection parameters
    connection: USBConnection | NetworkConnection | SerialConnection;
    
    // Behavior
    isDefault: boolean;         // Use for all jobs
    enabled: boolean;           // Currently active
    
    // Status
    status: 'ready' | 'busy' | 'offline' | 'error';
    lastStatusCheck: string;    // ISO 8601 timestamp
    lastError?: string;         // Last error message
}

interface USBConnection {
    vendorId: number;           // USB vendor ID
    productId: number;          // USB product ID
    serialNumber?: string;      // Device serial number
}

interface NetworkConnection {
    host: string;               // IP address or hostname
    port: number;               // TCP port (default 9100)
}

interface SerialConnection {
    portName: string;           // COM port name (e.g., "COM1")
    baudRate: number;           // Baud rate (default 9600)
    dataBits: number;           // Data bits (default 8)
    stopBits: number;           // Stop bits (default 1)
    parity: 'none' | 'even' | 'odd';
}
```

### Driver Status Model

```typescript
interface DriverStatus {
    // Driver state
    installed: boolean;         // Driver is installed
    running: boolean;           // Service is connected
    version: string;            // Driver version
    
    // Statistics
    jobsReceived: number;       // Total jobs from driver
    jobsForwarded: number;      // Successfully forwarded
    jobsFailed: number;         // Failed to forward
    
    // Performance
    avgForwardTime: number;     // Average forward time (ms)
    avgCaptureTime: number;     // Average capture time (ms)
    
    // Health
    lastJobAt?: string;         // Last job timestamp
    lastErrorAt?: string;       // Last error timestamp
    lastError?: string;         // Last error message
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Print Job Interception Completeness

*For any* print job sent to "Tabeza POS Printer", the Virtual_Printer_Driver SHALL intercept the job and deliver it to the Tabeza_Capture_Service via named pipe.

**Validates: Requirements 1.4, 2.1**

### Property 2: Capture File Data Integrity (Round-Trip)

*For any* print job data received by the Tabeza_Capture_Service, reading the corresponding Capture_File SHALL return data identical to the original print job (byte-for-byte equality).

**Validates: Requirements 2.4, 3.2**

### Property 3: Capture File Naming Uniqueness

*For any* two print jobs captured within the same millisecond, the generated Capture_File names SHALL be unique (using timestamp format YYYYMMDD-HHMMSS-mmm plus job ID).

**Validates: Requirements 2.3**

### Property 4: Print Job Ordering Preservation

*For any* sequence of print jobs arriving at the Tabeza_Capture_Service, the jobs SHALL be processed in the same order they were received (FIFO ordering).

**Validates: Requirements 2.5, 6.8**

### Property 5: Forward Data Integrity (Round-Trip)

*For any* print job forwarded to a physical printer, the data sent to the printer SHALL be identical to the data received from the POS system (byte-for-byte equality).

**Validates: Requirements 3.2, 3.8**

### Property 6: Offline Queue Persistence

*For any* print job added to the Job_Queue when the physical printer is offline, the job SHALL remain in the queue after a service restart until successfully forwarded.

**Validates: Requirements 4.1, 4.3, 6.6**

### Property 7: Exponential Backoff Retry Intervals

*For any* failed forwarding attempt, the retry intervals SHALL follow the exponential backoff sequence: 5s, 10s, 20s, 40s, 60s (capped at 60s).

**Validates: Requirements 4.2, 6.5**

### Property 8: Queue Draining Order

*For any* Job_Queue containing multiple pending jobs, when the physical printer becomes available, jobs SHALL be forwarded in the order they were added to the queue (FIFO ordering).

**Validates: Requirements 4.3**

### Property 9: Forwarding Failure Logging

*For any* forwarding failure, the Tabeza_Capture_Service SHALL create a log entry containing timestamp, error code, and printer status.

**Validates: Requirements 4.5**

### Property 10: ESC/POS Control Code Stripping

*For any* Capture_File containing ESC/POS data, the Receipt_Parser SHALL produce plain text output with all binary control codes removed.

**Validates: Requirements 5.1**

### Property 11: Parsed Receipt Structure

*For any* successfully parsed receipt, the JSON output SHALL contain fields for items (array), quantities (numbers), prices (numbers), and total (number).

**Validates: Requirements 5.3**

### Property 12: Confidence Score Range

*For any* parsed receipt, the confidence score SHALL be a number between 0.0 and 1.0 (inclusive).

**Validates: Requirements 5.4**

### Property 13: Upload Queue Addition

*For any* receipt parsed with success=true, the Tabeza_Capture_Service SHALL add the receipt to the upload queue.

**Validates: Requirements 6.1**

### Property 14: Upload Payload Structure

*For any* receipt uploaded to /api/receipts/ingest, the payload SHALL contain fields for barId, driverId, timestamp, and confidence.

**Validates: Requirements 6.2, 6.3**

### Property 15: Successful Upload File Movement

*For any* receipt upload that receives HTTP 200 response, the Tabeza_Capture_Service SHALL move the receipt file from pending/ to uploaded/ folder.

**Validates: Requirements 6.4**

### Property 16: Upload Queue Draining Order

*For any* pending upload queue containing multiple receipts, when internet connectivity is restored, receipts SHALL be uploaded in the order they were captured.

**Validates: Requirements 6.7, 6.8**

### Property 17: Pretty Printer Round-Trip

*For any* valid parsed receipt JSON, pretty-printing then parsing SHALL produce equivalent structured data (items, quantities, prices, total match).

**Validates: Requirements 14.8**

### Property 18: Multi-Printer Routing Consistency

*For any* print job and configured routing rules, the Physical_Printer_Adapter SHALL always select the same target printer given the same job characteristics and printer availability.

**Validates: Requirements 16.4**

### Property 19: API Endpoint Correctness

*For any* receipt upload, the Tabeza_Capture_Service SHALL POST to the endpoint /api/receipts/ingest (not any other endpoint).

**Validates: Requirements 19.1, 19.2**

### Property 20: API Payload Headers

*For any* cloud API request, the Tabeza_Capture_Service SHALL include the header "X-Tabeza-Connect-Version" with the current version number.

**Validates: Requirements 19.4**

## Error Handling

### Driver-Level Error Handling

**Named Pipe Connection Failures:**
- If the driver cannot connect to the named pipe within 5 seconds:
  1. Log error to Windows Event Log
  2. Return ERROR_PRINT_PROCESSOR_ALREADY_INSTALLED to spooler
  3. Spooler will retry the job automatically
  4. After 3 consecutive failures, display notification to user

**Invalid Print Data:**
- If the driver receives invalid data (size = 0 or size > 10MB):
  1. Log error with job details
  2. Return ERROR_INVALID_DATA to spooler
  3. Job is marked as failed in spooler queue

**Service Not Running:**
- If the Tabeza Connect service is not running:
  1. Driver attempts connection with 5-second timeout
  2. On timeout, log error and return failure to spooler
  3. System tray icon shows red status
  4. User notification: "Tabeza Connect service is not running"

### Service-Level Error Handling

**Disk Space Exhaustion:**
```
IF available disk space < 100MB:
    1. Stop accepting new print jobs
    2. Display critical error notification
    3. Log error with disk space details
    4. Continue forwarding existing jobs
    5. Continue uploading existing queue

IF available disk space < 500MB:
    1. Log warning
    2. Continue normal operation
    3. Display low disk space warning in UI
```

**Physical Printer Offline:**
```
WHEN forwarding job to offline printer:
    1. Add job to Job_Queue
    2. Set job status = "queued"
    3. Start retry timer with exponential backoff
    4. Update UI to show queue depth
    5. Log: "Printer offline, job queued"

WHEN printer comes online:
    1. Detect status change
    2. Start draining Job_Queue
    3. Process jobs in FIFO order
    4. Update UI to show progress
    5. Log: "Printer online, draining queue"
```

**Parse Failures:**
```
WHEN receipt parsing fails:
    1. Set parsed = false
    2. Set confidence = 0.0
    3. Include raw text in upload payload
    4. Mark receipt for manual review
    5. Log: "Parse failed, uploading raw text"
    6. Continue with upload (cloud can handle unparsed receipts)
```

**Upload Failures:**
```
WHEN upload to cloud fails:
    1. Increment uploadAttempts counter
    2. Log error with HTTP status code
    3. IF uploadAttempts < 5:
        a. Calculate backoff delay: 5s * 2^(attempts-1)
        b. Schedule retry
        c. Keep receipt in pending/ folder
    4. ELSE:
        a. Move receipt to failed_uploads/ folder
        b. Log: "Upload failed after 5 attempts"
        c. Display notification to user
        d. Receipt can be manually retried from UI
```

**Named Pipe Server Failures:**
```
WHEN named pipe server crashes:
    1. Log crash details and stack trace
    2. Attempt automatic restart (max 3 times)
    3. IF restart succeeds:
        a. Log: "Named pipe server restarted"
        b. Resume normal operation
    4. ELSE:
        a. Log: "Named pipe server failed to restart"
        b. Display critical error notification
        c. Require manual service restart
```

### Recovery Strategies

**Graceful Degradation:**
- If physical printer forwarding fails, capture and upload continue
- If cloud upload fails, capture and forwarding continue
- If parsing fails, capture and forwarding continue (upload raw text)

**Automatic Recovery:**
- Service automatically reconnects to named pipe on connection loss
- Upload worker automatically resumes when internet is restored
- Forwarding worker automatically resumes when printer comes online

**Manual Recovery:**
- Failed uploads can be retried from Management UI
- Failed forwards can be retried from Management UI
- Service can be restarted from system tray icon

## Testing Strategy

### Dual Testing Approach

This feature requires both unit testing and property-based testing for comprehensive coverage:

**Unit Tests:**
- Specific examples of print job handling
- Edge cases (empty data, oversized data, malformed data)
- Error conditions (disk full, printer offline, network down)
- Integration points (driver ↔ service, service ↔ printer)

**Property-Based Tests:**
- Universal properties across all inputs (data integrity, ordering, retry logic)
- Comprehensive input coverage through randomization
- Minimum 100 iterations per property test

### Property-Based Testing Configuration

**Library:** fast-check (JavaScript/TypeScript property-based testing library)

**Test Configuration:**
```javascript
// Example property test configuration
fc.assert(
    fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 10000 }), // Random print data
        (printData) => {
            // Property: Capture file data integrity
            const jobId = captureService.handlePrintJob(printData);
            const capturedData = fs.readFileSync(getCaptureFilePath(jobId));
            return Buffer.compare(printData, capturedData) === 0;
        }
    ),
    { numRuns: 100 } // Minimum 100 iterations
);
```

**Property Test Tags:**
Each property test must reference its design document property:
```javascript
/**
 * Feature: virtual-printer-capture
 * Property 2: Capture File Data Integrity (Round-Trip)
 * 
 * For any print job data received by the Tabeza_Capture_Service,
 * reading the corresponding Capture_File SHALL return data identical
 * to the original print job (byte-for-byte equality).
 */
test('Property 2: Capture file data integrity', () => {
    // Property test implementation
});
```

### Unit Test Coverage

**Driver Interface Tests:**
- Named pipe message format validation
- Connection timeout handling
- Invalid data rejection
- Concurrent connection handling

**Capture Service Tests:**
- File writing atomicity
- Filename uniqueness
- Disk space checking
- Queue management

**Printer Adapter Tests:**
- USB printer communication
- Network printer communication
- Serial printer communication
- Status detection
- Retry logic
- Queue draining

**Parser Tests:**
- ESC/POS stripping
- Template application
- Confidence scoring
- Fallback behavior

**Upload Worker Tests:**
- API endpoint correctness
- Payload structure
- Retry logic
- Queue persistence

### Integration Tests

**End-to-End Flow:**
1. Send test print job to virtual printer
2. Verify capture file created
3. Verify data integrity
4. Verify forwarding to physical printer
5. Verify parsing completed
6. Verify upload to cloud
7. Verify file moved to uploaded/ folder

**Error Scenario Tests:**
1. Printer offline during forwarding
2. Network down during upload
3. Disk full during capture
4. Service restart with pending queue
5. Driver crash and recovery

### Performance Tests

**Latency Targets:**
- Driver overhead: < 50ms per job
- Capture time: < 100ms per job
- Forward time: < 200ms per job (when printer ready)
- Parse time: < 50ms per receipt

**Throughput Targets:**
- 10 jobs/second sustained
- 1000 pending jobs without degradation

**Memory Targets:**
- Service memory usage: < 200MB
- Driver memory usage: < 50MB

### Test Data Generators

**Print Job Generator:**
```javascript
// Generate random ESC/POS print data
function generatePrintJob() {
    return fc.record({
        header: fc.constant(Buffer.from([0x1B, 0x40])), // ESC @
        content: fc.uint8Array({ minLength: 10, maxLength: 5000 }),
        footer: fc.constant(Buffer.from([0x1D, 0x56, 0x00])) // Cut paper
    }).map(parts => Buffer.concat([parts.header, parts.content, parts.footer]));
}
```

**Receipt Generator:**
```javascript
// Generate random receipt structure
function generateReceipt() {
    return fc.record({
        items: fc.array(fc.record({
            name: fc.string({ minLength: 5, maxLength: 30 }),
            qty: fc.integer({ min: 1, max: 10 }),
            price: fc.float({ min: 0.01, max: 1000.00, noNaN: true })
        }), { minLength: 1, maxLength: 20 }),
        total: fc.float({ min: 0.01, max: 10000.00, noNaN: true }),
        receiptNumber: fc.string({ minLength: 5, maxLength: 20 })
    });
}
```

## File System Structure

### Installation Directories

```
C:\Program Files\TabezaConnect\
├── TabezaConnect.exe                    # Main Electron application
├── resources\
│   ├── app.asar                         # Packaged application code
│   ├── driver\
│   │   ├── TabezaPrinter.dll           # Virtual printer driver (x64)
│   │   ├── TabezaPrinter32.dll         # Virtual printer driver (x86)
│   │   ├── TabezaMonitor.dll           # Port monitor (x64)
│   │   ├── TabezaMonitor32.dll         # Port monitor (x86)
│   │   └── TabezaPrinter.inf           # Driver installation file
│   └── assets\
│       └── icon-green.ico              # Application icon
└── unins000.exe                         # Uninstaller

C:\Windows\System32\spool\drivers\
└── x64\
    └── 3\
        ├── TabezaPrinter.dll           # Installed driver
        └── TabezaMonitor.dll           # Installed monitor
```

### Data Directories

```
C:\TabezaPrints\
├── config.json                          # Service configuration
├── template.json                        # Receipt parsing template
├── order.prn                            # Current capture file (overwritten)
├── logs\
│   ├── service.log                     # Service log
│   ├── driver.log                      # Driver log
│   └── electron.log                    # Electron app log
├── processed\
│   ├── 20260304-143022-001_abc123.prn # Archived successful captures
│   └── 20260304-143025-002_def456.prn
├── failed\
│   └── 20260304-143030-003_ghi789.prn # Archived failed captures
├── queue\
│   ├── pending\
│   │   ├── abc123-def4-5678-90ab-cdef12345678.json  # Pending uploads
│   │   └── def456-abc1-2345-67ab-cdef12345678.json
│   ├── uploaded\
│   │   └── 123456-789a-bcde-f012-3456789abcde.json  # Completed uploads
│   └── failed_uploads\
│       └── 789abc-def0-1234-5678-9abcdef01234.json  # Failed after retries
├── failed_prints\
│   └── 20260304-143035-004_jkl012.prn # Failed to forward after retries
└── templates\
    ├── template.json                   # Active template
    └── template_backup_20260304.json   # Template backup
```

### Registry Configuration

```
HKEY_LOCAL_MACHINE\SOFTWARE\Tabeza\TabezaConnect\
├── BarID                    (REG_SZ)      # Venue bar ID
├── APIUrl                   (REG_SZ)      # Cloud API URL
├── WatchFolder              (REG_SZ)      # Capture folder path
├── DriverVersion            (REG_SZ)      # Installed driver version
└── PrinterConfig            (REG_SZ)      # JSON printer configuration

HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Print\Monitors\Tabeza Monitor\
└── Ports\
    └── TabezaVirtualPort\
        ├── PipeName         (REG_SZ)      # Named pipe path
        └── Timeout          (REG_DWORD)   # Connection timeout (ms)
```

## Migration Strategy

### Phase 1: Parallel Installation (Week 1-2)

**Goal:** Install virtual printer alongside existing pooling printer without disruption.

**Steps:**
1. Install virtual printer driver as "Tabeza POS Printer (New)"
2. Keep existing "Tabeza POS Printer" (pooling) active
3. Test virtual printer with test receipts
4. Verify capture, forwarding, and upload work correctly
5. Monitor for issues

**Rollback:** Simply continue using existing pooling printer.

### Phase 2: Migration (Week 3)

**Goal:** Switch POS systems to use virtual printer.

**Steps:**
1. During off-peak hours:
   a. Backup existing configuration
   b. Remove pooling printer "Tabeza POS Printer"
   c. Rename virtual printer to "Tabeza POS Printer"
   d. Verify POS can print to renamed printer
2. Test with real transactions
3. Monitor for 24 hours

**Rollback:** 
1. Stop Tabeza Connect service
2. Restore pooling printer from backup
3. Restart service

### Phase 3: Cleanup (Week 4)

**Goal:** Remove legacy pooling code and finalize migration.

**Steps:**
1. Verify virtual printer working for 1 week
2. Remove pooling-related code from service
3. Update documentation
4. Release new installer with virtual printer only

**Rollback:** Not applicable (migration complete).

### Backward Compatibility Considerations

**Configuration Files:**
- `config.json` format remains unchanged
- `template.json` format remains unchanged
- Existing templates work with new system

**Queue Files:**
- Existing pending/ uploads processed normally
- Existing uploaded/ files preserved
- Queue format unchanged

**API Integration:**
- Upload payload format unchanged
- API endpoints unchanged
- Heartbeat format unchanged

**User Experience:**
- Printer name remains "Tabeza POS Printer"
- System tray icon behavior unchanged
- Management UI URLs unchanged (localhost:8765)

### Migration Validation Checklist

- [ ] Virtual printer appears in Windows printer list
- [ ] POS can print to virtual printer
- [ ] Receipts print on physical printer
- [ ] Capture files created in C:\TabezaPrints\
- [ ] Parsing works with existing template
- [ ] Uploads succeed to cloud
- [ ] Queue persistence works across restarts
- [ ] System tray icon shows correct status
- [ ] Management UI accessible at localhost:8765
- [ ] Existing config.json loaded correctly
- [ ] Existing template.json loaded correctly
- [ ] Performance meets targets (< 50ms overhead)

## Performance Considerations

### Latency Budget

**Total Print Job Latency:** < 300ms (from POS to physical printer)

**Breakdown:**
- Windows Print Spooler: ~20ms
- Driver processing: < 50ms
- Named pipe transfer: < 10ms
- Service capture: < 100ms
- Printer forwarding: < 200ms (when ready)
- **Total: ~380ms** (target: < 300ms, requires optimization)

**Optimization Strategies:**
1. Use memory-mapped files for capture (faster than write/flush)
2. Pre-allocate named pipe buffers
3. Use async I/O for printer communication
4. Batch small jobs when possible

### Memory Budget

**Total Memory Usage:** < 250MB

**Breakdown:**
- Electron main process: ~80MB
- Background service: ~120MB
- Driver (per job): ~5MB
- Named pipe buffers: ~10MB
- File system cache: ~35MB

**Memory Management:**
- Limit concurrent print jobs to 10
- Clear processed job data after 1 hour
- Rotate logs daily (keep 30 days)
- Compress archived captures after 7 days

### Throughput Targets

**Sustained Throughput:** 10 jobs/second

**Peak Throughput:** 20 jobs/second (burst for 10 seconds)

**Queue Capacity:** 1000 pending jobs

**Stress Test Scenarios:**
1. 100 jobs submitted simultaneously
2. 1000 jobs submitted over 60 seconds
3. Continuous printing for 8 hours
4. Service restart with 500 pending jobs

### Disk I/O Optimization

**Write Strategy:**
- Use buffered writes for capture files
- Flush to disk every 5 seconds or 10 jobs
- Use atomic rename for queue files

**Read Strategy:**
- Memory-map large capture files
- Cache parsed receipts for 5 minutes
- Pre-fetch next queue item

**Disk Space Management:**
- Auto-delete processed/ files older than 30 days
- Auto-delete uploaded/ files older than 7 days
- Compress failed/ files older than 7 days
- Alert when disk space < 1GB

## Security Model

### Driver Security

**Code Signing:**
- Driver DLL must be signed with EV certificate
- Signature verified by Windows on installation
- Unsigned drivers rejected by Windows 10/11

**Privilege Level:**
- Driver runs in kernel mode (required for print processor)
- Minimal kernel-mode code (only print processor interface)
- All business logic in user-mode service

**Attack Surface:**
- Named pipe is only attack vector
- Pipe access restricted to LocalSystem and Administrators
- Input validation on all pipe messages

### Service Security

**Process Isolation:**
- Service runs as LocalSystem (required for printer access)
- No network access except HTTPS to cloud API
- File system access restricted to C:\TabezaPrints\

**Data Protection:**
- Bar ID encrypted in config.json using DPAPI
- API keys never logged in plain text
- Print data encrypted in transit (HTTPS)

**Named Pipe Security:**
```cpp
// Pipe security descriptor
SECURITY_ATTRIBUTES sa;
sa.nLength = sizeof(SECURITY_ATTRIBUTES);
sa.bInheritHandle = FALSE;

// Allow LocalSystem and Administrators only
ConvertStringSecurityDescriptorToSecurityDescriptor(
    L"D:(A;;GA;;;SY)(A;;GA;;;BA)",  // SDDL string
    SDDL_REVISION_1,
    &sa.lpSecurityDescriptor,
    NULL
);

CreateNamedPipe(
    L"\\\\.\\pipe\\TabezaPrinter",
    PIPE_ACCESS_DUPLEX,
    PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE | PIPE_WAIT,
    PIPE_UNLIMITED_INSTANCES,
    1024 * 1024,  // 1MB out buffer
    4096,         // 4KB in buffer
    0,
    &sa
);
```

### Network Security

**HTTPS Only:**
- All cloud API calls use HTTPS
- Certificate validation enabled
- TLS 1.2 minimum

**API Authentication:**
- Bar ID included in all requests
- Driver ID included in all requests
- API version header included

**Rate Limiting:**
- Respect HTTP 429 responses
- Exponential backoff on rate limit
- Max 100 requests/minute per venue

### Input Validation

**Print Job Validation:**
```javascript
function validatePrintJob(header, data) {
    // Check magic number
    if (header.magic !== 'TABEZA01') {
        throw new Error('Invalid magic number');
    }
    
    // Check version
    if (header.version !== 1) {
        throw new Error('Unsupported version');
    }
    
    // Check data size
    if (data.length === 0 || data.length > 10 * 1024 * 1024) {
        throw new Error('Invalid data size');
    }
    
    // Check job ID format (UUID)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(header.jobId)) {
        throw new Error('Invalid job ID format');
    }
    
    return true;
}
```

**Configuration Validation:**
```javascript
function validateConfig(config) {
    // Validate Bar ID format
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(config.barId)) {
        throw new Error('Invalid Bar ID format');
    }
    
    // Validate API URL
    const url = new URL(config.apiUrl);
    if (url.protocol !== 'https:') {
        throw new Error('API URL must use HTTPS');
    }
    
    // Validate watch folder path
    if (!path.isAbsolute(config.watchFolder)) {
        throw new Error('Watch folder must be absolute path');
    }
    
    return true;
}
```

### Audit Logging

**Security Events Logged:**
- Driver installation/uninstallation
- Service start/stop
- Configuration changes
- Failed authentication attempts
- Suspicious print jobs (oversized, malformed)
- Named pipe connection failures

**Log Format:**
```
[2026-03-04T14:30:22.001Z][SECURITY][INFO] Driver installed: version 1.0.0
[2026-03-04T14:30:25.123Z][SECURITY][WARN] Oversized print job rejected: 15MB
[2026-03-04T14:30:30.456Z][SECURITY][ERROR] Named pipe connection failed: Access denied
```

**Log Retention:**
- Security logs kept for 90 days
- Logs rotated daily
- Logs compressed after 7 days
- Logs encrypted at rest (DPAPI)

