# Production Readiness – Tabeza Connect

*Extracted from `GUIDE.md` – last updated 2026‑03‑22*

## Executive Summary
Tabeza Connect is now successfully capturing POS receipts and forwarding them to physical printers. The system uses REDMON port monitoring to intercept print jobs, processes them through a robust queue system, and reliably prints receipts using Windows‑native printing APIs.

## System Architecture

Physical printing is the primary goal and is guaranteed by a robust forwarding pipeline:

```
POS Printer ("Tabeza Agent")
         ↓
   REDMON Port Monitor
         ↓
   capture.exe (stdin)
         ↓
   C:\TabezaPrints\raw\*.prn
         ↓
     SpoolWatcher
         ↓
   PhysicalPrinterAdapter
         ↓
   Windows Printer API
         ↓
   Thermal Printer (paper receipt)
```

- **Physical printing** is the final step of the pipeline—receipts are printed via Windows native APIs with automatic retry and queue persistence.
- **Capture path** runs in parallel, ensuring digital receipts are uploaded to the cloud without blocking physical printing.
- **Failure resilience**: If any component before the printer fails, the job remains in the queue and will be retried until successful.
- **Duplicate prevention**: Each print job is uniquely identified; duplicate detection ensures no receipt is printed more than once, even when retries occur.
## ✅ Working Components
| Component | Status | Description |
|-----------|--------|-------------|
| REDMON Integration | ✅ | Successfully intercepting print jobs |
| capture.exe | ✅ | Processing raw ESC/POS data |
| SpoolWatcher | ✅ | Monitoring and queueing print jobs |
| PhysicalPrinterAdapter | ✅ | Managing print queue with retry logic |
| WindowsPrinterConnection | ✅ | Printing via Windows API |
| HTTP API Server | ✅ | Running on port 8765 |
| Queue System | ✅ | FIFO queue with 5 retry attempts |
| Failed Job Management | ✅ | Failed jobs stored in `failed_prints` |

## 🔧 Configuration Guardrails
### Configuration File Protection
```json
{
  "barId": "venue-bar-id",
  "printers": [{
    "name": "Thermal Printer (e.g., EPSON L3210 Series)",
    "type": "windows",
    "enabled": true,
    "isDefault": true
  }]
}
```
- ✅ Configuration validated on service start
- ✅ Invalid printer types rejected
- ✅ Missing printers fall back to queue without crashing
- ✅ Config file changes trigger auto‑reload

### File System Integrity
```
C:\TabezaPrints\
├── raw\           # Incoming print jobs (read‑only for capture.exe)
├── processed\     # Archived jobs (read‑only after processing)
├── failed_prints\ # Failed print jobs (requires manual review)
├── temp\          # Temporary print files (auto‑cleaned)
├── logs\          # Service logs (rotated automatically)
├── queue\         # Cloud upload queue
│   ├── pending\   # Receipts pending upload (FIFO)
│   └── uploaded\  # Successfully uploaded receipts (audit trail)
├── templates\     # Receipt parsing templates (template.json)
├── text\          # Sample receipts for template generation
├── failed\        # Failed receipts (upload failures)
└── config.json    # Protected configuration
```
- ✅ Directories created with proper permissions
- ✅ Temp files automatically cleaned after printing
- ✅ Failed jobs preserved for retry
- ✅ Log rotation prevents disk overflow

### Process Guardrails
```javascript
// Queue protection
maxRetries: 5
retryBackoff: [5000, 10000, 20000, 40000]

// Disk space protection
minDiskSpace: 104857600  // 100MB minimum
maxFileSize: 1048576      // 1MB max per file
```
- ✅ Exponential backoff prevents printer flooding
- ✅ Failed jobs moved after 5 attempts
- ✅ Disk space monitoring prevents crashes
- ✅ File size limits prevent memory issues

### API Security
```
http://127.0.0.1:8765/
├── /api/status          # Read‑only
├── /api/printers        # Read‑only
├── /api/queue           # Read‑only
├── /api/configure       # Protected (requires existing config)
└── /template.html       # Local UI only
```
- ✅ Bound to localhost only (127.0.0.1)
- ✅ No external network exposure
- ✅ Configuration changes require existing config
- ✅ CORS disabled for security

## 🛡️ Anti‑Tampering Measures
### Runtime Protection
- Service auto‑restarts on crash (max 3 attempts)
- Health checks every 30 seconds
- Memory usage monitored
- CPU usage throttled

### File Integrity
- `config.json` checksum verified on load
- `capture.exe` hash verified
- Log files append‑only
- Temp directory auto‑cleaned

### Print Queue Protection
- FIFO order preserved
- Duplicate job detection
- Job size validation
- Printer status verification before sending

### Error Recovery
- Network timeouts: 30 seconds
- Printer offline: queue preserved
- Disk full: pause processing
- Service crash: resume from queue

## 📊 Monitoring & Alerts
### Key Metrics to Monitor
```json
{
  "jobsReceived": 0,
  "jobsForwarded": 0,
  "jobsFailed": 0,
  "queueDepth": 0,
  "printersConfigured": 1,
  "diskSpace": "OK"
}
```
### Health Check Endpoint
```bash
curl http://127.0.0.1:8765/api/status
```
### Log Monitoring
```bash
# Real‑time log tail
Get-Content C:\TabezaPrints\logs\service.log -Wait

# Check for errors
Select-String "ERROR" C:\TabezaPrints\logs\service.log
```

## 🚨 Incident Response
### If Printer Stops Working
1. Check printer status: `http://127.0.0.1:8765/api/printers`
2. Verify queue depth: `http://127.0.0.1:8765/api/queue`
3. Check logs: `C:\TabezaPrints\logs\service.log`
4. Retry failed jobs via API: `POST /api/queue/retry`

### If Service Crashes
1. Service auto‑restarts within 3 seconds
2. Queue preserved in memory
3. Failed jobs written to disk
4. Check Windows Event Viewer for crash dumps

### If Disk Space Low
1. Service pauses automatically
2. Alerts in logs every 5 minutes
3. Auto‑resumes when space available
4. Old logs auto‑rotated

## ✅ Production Readiness Checklist
- [x] Printer communication reliable (Windows API)
- [x] Queue system tested with failures
- [x] Disk space monitoring active
- [x] Log rotation configured
- [x] Auto‑recovery mechanisms in place
- [x] Local API secured
- [x] Failed job preservation
- [x] Configuration validation
- [x] Memory leak prevention
- [x] CPU usage optimization

---

*This document is a condensed reference for production deployments. For detailed design and implementation notes, see `ARCHITECTURE.md` and `GUIDE.md`.*