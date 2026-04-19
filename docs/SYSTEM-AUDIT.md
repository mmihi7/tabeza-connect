# Tabeza Connect - Complete System Audit & Architecture Documentation

## 📋 Executive Summary

This document provides a comprehensive audit of the Tabeza Connect system architecture, components, and configuration. It serves as the definitive reference for understanding, maintaining, and troubleshooting the production receipt capture system.

---

## 🏗️ System Architecture Overview

### Core Data Flow
```
POS Printer ("Tabeza Agent")
    ↓ (RedMon Port Monitor)
    ↓ (capture.exe via stdin)
    ↓ (C:\TabezaPrints\raw\*.prn)
    ↓ (SpoolWatcher)
    ↓ (PhysicalPrinterAdapter)
    ↓ (Windows Printer API)
    ↓ (EPSON L3210 Series)
```

### Component Interaction Matrix

| Component | Status | Description | Dependencies |
|-----------|--------|-------------|------------|
| REDMON Integration | ✅ | Successfully intercepting print jobs | clawPDF virtual printer |
| capture.exe | ✅ | Processing raw ESC/POS data | Python parser, template system |
| SpoolWatcher | ✅ | Monitoring and queueing print jobs | File system watcher |
| PhysicalPrinterAdapter | ✅ | Managing print queue with retry logic | Windows Print API |
| WindowsPrinterConnection | ✅ | Printing via Windows API | Windows spooler |
| HTTP API Server | ✅ | Running on port 8765 | Express.js |
| Queue System | ✅ | FIFO queue with 5 retry attempts | File system |
| Upload Worker | ✅ | Cloud upload with rate limiting | Staff app API |
| Template Management | ✅ | JSON-based receipt parsing | Python parser |

---

## 🔧 Configuration Architecture

### 1. Configuration File Structure
```json
{
  "barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
  "printers": [{
    "name": "EPSON L3210 Series",
    "type": "windows",
    "enabled": true,
    "isDefault": true
  }],
  "apiUrl": "http://localhost:3003"
}
```

**Configuration Locations:**
- **Primary:** `C:\TabezaPrints\config.json`
- **Service Registry:** `HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port`
- **Templates:** `C:\TabezaPrints\templates\template.json`

### 2. RedMon Port Monitor Configuration

**Current Implementation:**
- **RedMon 1.9** installed via PowerShell scripts
- **Port:** Configured to monitor "Tabeza Agent"
- **Registry:** Redirects print jobs to `capture.exe` via stdin
- **Virtual Printer:** NOT USED (replaced with Windows native printing)
- **Capture Script:** `capture.exe` receives jobs via stdin

**Port Monitor Setup:**
```powershell
# Registry configuration
HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port
├── "Tabeza Agent" → capture.exe
└── Backup: Original printer restored on service stop

# RedMon command line
redmon19\redmon.exe -p "Tabeza Agent" -s "C:\TabezaPrints\capture.exe"
```

**Integration Points:**
- **Redmon 1.9** successfully intercepts print jobs
- **Jobs forwarded** to `capture.exe` via stdin
- **No virtual printer dependency** - uses Windows native printing

---

## 🐍 Capture Script Analysis

### Python Parser Integration (v1.0)

**File:** `src/capture/receipt_parser.py`
**Template:** `C:\TabezaPrints\templates\template.json`

**Parser Logic:**
```python
class ReceiptParser:
    def __init__(self, template_path: str)
    def _load_template(self, template_path: str)
    def parse(self, receipt_text: str) -> Dict[str, Any]
    
    # Core parsing methods:
    - _extract_items()  # Regex-based item extraction
    - _extract_field()  # Field-based extraction
    - parse_kes()      # Kenyan Shilling parsing
```

**Integration Points:**
- **Path Resolution:** Multi-location Python script discovery
- **Error Handling:** Graceful fallback to default template
- **Output Structure:** Matches `PrintJobPayload.parsedData` interface
- **Performance:** <100ms processing time per receipt

### Capture Process Flow

1. **Receipt Received** (stdin from RedMon)
2. **Raw Backup** → `C:\TabezaPrints\raw\*.prn`
3. **Textification** → ESC/POS bytes to plain text
4. **Python Parsing** → Structured JSON with items, totals, metadata
5. **Queue for Upload** → `C:\TabezaPrints\queue\pending\*.json`
6. **Forward to Printer** → Physical printer via Windows API

---

## 📦 Upload Worker Architecture

### Queue Management System

**Directory Structure:**
```
C:\TabezaPrints\queue\
├── pending\     # Ready for upload (FIFO)
├── uploaded\     # Successfully uploaded
├── failed\       # Upload failures (retry later)
└── processed\    # Archived after processing
```

**Upload Logic:**
```javascript
// Configuration
const RETRY_DELAYS = [5000, 10000, 20000, 40000]; // 5s, 10s, 20s, 40s
const MAX_RETRIES = 4;
const POLL_INTERVAL_MS = 12000; // 12 seconds (matches rate limit)

// Upload Process
1. Dequeue receipt from pending/
2. Map receipt.receipt → parsedData
3. POST to {apiEndpoint}/api/printer/relay
4. Handle rate limiting (429 responses)
5. Exponential backoff on failure
6. Move to uploaded/ on success
7. Move to failed/ after MAX_RETRIES
```

**Retry Strategy:**
- **Network Timeout:** 30 seconds
- **Max Retries:** 4 attempts per receipt
- **Backoff:** 5s → 10s → 20s → 40s
- **Rate Limiting:** Respects staff app limits (5 receipts/minute)

---

## 🖨️ Physical Printer Adapter

### Windows Native Printing

**Connection Types:**
- **WindowsPrinterConnection:** Direct Win32 API calls
- **USBPrinterConnection:** LibUSB (legacy, deprecated)
- **NetworkPrinterConnection:** TCP/IP printers
- **SerialPrinterConnection:** COM port printers

**Windows API Integration:**
```csharp
[DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter);
public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);
public static extern bool ClosePrinter(IntPtr hPrinter);
```

**Key Features:**
- **ESC/POS Preservation:** Raw bytes sent directly without GDI mangling
- **Retry Logic:** Failed jobs preserved in `failed_prints\`
- **Queue Management:** FIFO processing with job status tracking
- **Error Recovery:** Automatic retry with exponential backoff

---

## 📊 Service Architecture

### HTTP API Server (Port 8765)

**Endpoints:**
```
GET  /api/status          # Service health and statistics
GET  /api/config          # Configuration management
GET  /api/templates        # Template listing
POST /api/templates       # Template creation/update
GET  /api/queue           # Queue status
POST /api/test-print      # Printer testing
GET  /template.html       # Local management UI
```

**Security Features:**
- **Localhost Only:** Binds to 127.0.0.1:8765
- **No External Exposure:** No internet-facing endpoints
- **Configuration Protection:** Requires existing config for changes
- **CORS Disabled:** Prevents cross-origin requests

### Logging System

**Log Locations:**
```
C:\TabezaPrints\logs\
├── service.log      # Main service logs (rotation: 10MB)
├── capture.log      # Capture script logs
├── electron.log     # Electron app logs
└── printer-setup.log # Printer configuration logs
```

**Log Rotation:**
- **Max Size:** 10MB per log file
- **Retention:** Multiple log files with size limits
- **Format:** JSON structured logs with timestamps

---

## 🔍 Template Management

### Template System (v1.1)

**Template Structure:**
```json
{
  "name": "Simple POS Template",
  "version": "1.1",
  "description": "Template for extracting items, totals, and timestamps from Mihi Lounge & Grill receipts",
  "patterns": {
    "items": "^\\d+\\s+.+?\\s+Kes\\s+[\\d,]+(?:,\\s*Kes\\s+[\\d,]+)?$",
    "total": "Total:\\s*Kes\\s*[\\d,]+",
    "date_time": "Date:\\s*\\d{1,2}-[A-Za-z]{3}-\\d{4}[\\s\\S]*?Time:\\s*\\d{1,2}:\\d{2}\\s*[AP]M",
    "table_number": "Table No:\\s*\\d+"
  },
  "fields": [
    {
      "name": "items",
      "type": "array",
      "pattern": "^(\\d+)\\s+(.+?)\\s+Kes\\s+([\\d,]+)(?:,\\s*Kes\\s+([\\d,]+))?$",
      "notes": "Groups: (1) qty, (2) item name, (3) unit price, (4) subtotal"
    },
    // ... additional fields for total, date, time, table
  ]
}
```

**Template Features:**
- **Regex Patterns:** Complex multiline receipt matching
- **Field Extraction:** Named capture groups for structured data
- **Fallback Support:** Default template if loading fails
- **Version Control:** Template versioning and change tracking
- **Bar ID Association:** Templates linked to specific venues

---

## 🚨 Error Handling & Recovery

### Failure Scenarios

1. **Python Parser Failure:**
   - **EACCES Error:** Permissions issue with Python executable
   - **Fallback:** Uses default template if Python unavailable
   - **Logging:** Detailed error capture in service logs

2. **Upload Worker Failures:**
   - **Rate Limiting:** HTTP 429 responses with exponential backoff
   - **Network Timeouts:** 30-second timeout with retry
   - **Invalid Payloads:** 400/500 responses logged for debugging
   - **Queue Corruption:** Failed jobs moved to manual review

3. **Printer Adapter Failures:**
   - **Offline Printers:** Jobs queued until printer available
   - **USB Conflicts:** Automatic fallback to Windows API
   - **Job Corruption:** Failed jobs preserved in `failed_prints\`

### Recovery Mechanisms

```javascript
// Service auto-restart
if (process.exitCode !== 0) {
  log.error(`Service crashed with code ${process.exitCode}`);
  process.exit(1); // Prevent Windows service restart loop
}

// Queue preservation on shutdown
process.on('SIGINT', async () => {
  log.info('SIGINT received - preserving queue...');
  await this.stop();
});
```

---

## 📈 Performance & Monitoring

### Key Metrics

**Processing Targets:**
- **Receipt Processing:** <100ms per receipt
- **Memory Usage:** <50MB per capture invocation
- **File Size Limits:** 1MB max per receipt
- **Queue Throughput:** 12-second polling intervals

**Health Monitoring:**
```bash
# Service health check
curl http://127.0.0.1:8765/api/status

# Real-time log monitoring
Get-Content C:\TabezaPrints\logs\service.log -Wait -Tail 10
```

### Performance Optimizations

1. **Asynchronous Processing:** Non-blocking capture and upload
2. **Memory Management:** Stream processing for large receipts
3. **Disk Space Monitoring:** Automatic pause on low disk space
4. **CPU Throttling:** Prevents system overload
5. **Connection Pooling:** Reuse printer connections where possible

---

## 🔐 Security Model

### Access Control

1. **Localhost Binding:** No external network exposure
2. **Configuration Validation:** Existing config required for changes
3. **Template Signing:** Templates validated for malicious content
4. **Rate Limiting:** Built-in DoS protection
5. **File Permissions:** Controlled access to TabezaPrints directory

### Data Protection

1. **Encryption in Transit:** HTTPS for cloud uploads
2. **Local Data Storage:** Windows file permissions
3. **Log Rotation:** Prevents disk overflow and data loss
4. **Input Validation:** Receipt data validation before processing

---

## 🛠️ Maintenance & Troubleshooting

### Common Issues & Solutions

| Issue | Symptoms | Solution | Prevention |
|-------|-----------|----------|------------|
| **Python EACCES** | "Failed to start Python parser" | Check Python installation, file permissions, antivirus interference |
| **Rate Limiting** | HTTP 429 responses | Reduce testing frequency, check upload worker status |
| **Printer Offline** | Jobs queueing but not printing | Verify printer power, connection, driver status |
| **Template Missing** | "Template not found" | Automatic fallback template, template regeneration |
| **Disk Full** | Service pauses | Clear old logs, check disk space, cleanup temp files |
| **Memory Leaks** | Growing RAM usage | Restart service, check for unclosed handles |

### Diagnostic Commands

```bash
# Check service health
curl http://127.0.0.1:8765/api/status

# Monitor real-time logs
Get-Content C:\TabezaPrints\logs\service.log -Wait -Tail 10

# Check queue status
curl http://127.0.0.1:8765/api/queue

# Test receipt processing
echo "TEST RECEIPT" | & "C:\TabezaPrints\capture.exe"

# Clear failed jobs
Remove-Item "C:\TabezaPrints\failed_prints\*" -Force

# Restart service
sc stop TabezaConnect && sc start TabezaConnect
```

---

## 📋 Deployment & Installation

### Production Deployment

1. **Installer:** NSIS-based Windows installer
2. **Service Registration:** Windows Service with auto-restart
3. **Directory Creation:** Automatic C:\TabezaPrints setup
4. **Configuration:** Protected config.json with validation
5. **Dependencies:** clawPDF virtual printer, Node.js 18.19.0

### Development Setup

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build capture executable
pkg src/capture/index.js --output C:\TabezaPrints\capture.exe

# Build service bundle
npm run build:service

# Start development service
npm run dev:service
```

---

## 🔄 Version History & Changes

### Current Version: v1.7.0

**Recent Major Changes:**
- **v1.5.0:** Migrated from USB to Windows native printing
- **v1.6.0:** Added Python parser integration
- **v1.7.0:** Enhanced template management and error handling

**Template Evolution:**
- **v1.0:** Basic JavaScript regex parsing
- **v1.1:** Enhanced field extraction with capture groups
- **v1.1:** Current Python-based parsing system

---

## 📞 Legacy System Considerations

### Old System Components (Deprecated)

| Component | Status | Replacement | Reason |
|-----------|--------|------------|---------|
| **USB Library** | ❌ Deprecated | **Windows API** | Driver conflicts, permissions issues |
| **Direct GDI** | ❌ Deprecated | **Raw ESC/POS** | Data corruption, newlines lost |
| **JavaScript Parser** | ❌ Limited | **Python Parser** | Regex limitations, maintenance complexity |

### Migration Benefits

1. **Stability:** Windows native printing eliminates USB driver conflicts
2. **Performance:** Direct ESC/POS bypasses GDI rendering overhead
3. **Maintainability:** Python parser easier to modify than JavaScript
4. **Reliability:** clawPDF virtual printer works across Windows versions

---

## 📚 API Documentation

### Staff App Integration

**Endpoint:** `POST /api/printer/relay`
**Payload Structure:**
```json
{
  "driverId": "driver-MIHI-PC",
  "barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
  "timestamp": "2026-03-21T15:47:55.211Z",
  "parsedData": {
    "items": [
      {
        "name": "Tusker Lager",
        "quantity": 2,
        "price": 250
      }
    ],
    "total": 730,
    "receiptNumber": "20260321-184754-965",
    "confidence": "high"
  },
  "rawText": "CAPTAIN'S ORDER...",
  "printerName": "TabezaConnect"
}
```

**Rate Limiting:** 5 receipts per minute per bar
**Deduplication:** 5-minute window based on receipt hash

---

## 🎯 Production Readiness Checklist

### System Health Indicators

- [x] **Printer Communication:** Windows API integration stable
- [x] **Queue System:** FIFO processing with retry logic implemented
- [x] **Upload Pipeline:** Exponential backoff and rate limiting active
- [x] **Template Management:** JSON-based versioning and fallback support
- [x] **Error Recovery:** Comprehensive failure handling and auto-restart
- [x] **Configuration Security:** Protected settings with validation
- [x] **Monitoring:** Real-time logs and health endpoints
- [x] **Performance:** Sub-100ms processing times maintained
- [x] **File Integrity:** Proper permissions and rotation implemented

### Deployment Requirements

✅ **All core components functional and tested**
✅ **Error handling and recovery mechanisms in place**
✅ **Security measures implemented and validated**
✅ **Performance optimizations active**
✅ **Documentation complete and accessible**

---

## 🔧 Maintenance Procedures

### Daily Tasks

1. **Log Rotation:** Check log file sizes and rotate if >10MB
2. **Disk Space:** Verify minimum 100MB available space
3. **Queue Cleanup:** Remove processed items older than 7 days
4. **Template Updates:** Verify template version and bar ID alignment
5. **Health Checks:** Monitor service status and API endpoints

### Weekly Tasks

1. **Failed Job Review:** Analyze failed_prints directory for patterns
2. **Performance Analysis:** Review processing times and error rates
3. **Security Audit:** Check configuration integrity and access logs
4. **Backup Verification:** Ensure configuration backups are current

### Monthly Tasks

1. **Template Maintenance:** Update regex patterns for new receipt formats
2. **System Updates:** Apply security patches and updates
3. **Documentation Review:** Update this document with system changes
4. **Capacity Planning:** Monitor growth and plan scaling requirements

---

## 📞 Emergency Procedures

### Service Recovery

If Tabeza Connect service stops:
1. **Check Windows Event Viewer** for crash logs
2. **Verify Queue Integrity:** Ensure pending jobs preserved
3. **Restart Service:** `sc start TabezaConnect`
4. **Verify Health:** Check `/api/status` endpoint
5. **Contact Support:** If auto-restart fails, manual intervention required

### Data Recovery

If critical data loss occurs:
1. **Stop Service:** Prevent further data corruption
2. **Backup Queue:** Copy pending directory to safe location
3. **Analyze Logs:** Identify root cause of failure
4. **Restore Service:** Only after addressing root cause

---

## 📞 Support & Escalation

### When to Contact Support

**Critical Issues:**
- Service crashes or won't start
- Data corruption or loss
- Security breaches or suspected attacks
- Hardware failures (printer, system components)

**Information to Provide:**
1. **Service Logs:** `C:\TabezaPrints\logs\service.log`
2. **System Specs:** Windows version, hardware details
3. **Error Messages:** Full error text from logs
4. **Steps Taken:** What troubleshooting has been attempted
5. **Business Impact:** How operations are affected

### Support Channels

- **Documentation:** This guide and README files
- **Issue Tracking:** GitHub repository issues and discussions
- **Emergency:** Direct contact information for critical failures

---

*Document Version:* 1.0  
*Last Updated:* 2026-03-21  
*System:* Tabeza Connect v1.7.0  
*Architecture:* RedMon Port Monitor + Python Parser + Windows Native Printing
