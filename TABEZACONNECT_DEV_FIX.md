# TabezaConnect Development Mode Fix

## Issue Summary
TabezaConnect v1.3.0 had a critical bug in `src/service/index.js` at line 809 where it called `startSpoolerMonitoring()` which didn't exist. This prevented the service from starting in development mode.

## Root Cause
The service was missing:
1. The `startSpoolerMonitoring()` function implementation
2. LocalQueue and UploadWorker imports
3. Proper initialization of the queue and upload worker
4. Event handlers for the SpoolMonitor

## Fixes Applied

### 1. Added Missing Imports
```javascript
const SpoolMonitor = require('./spoolMonitor');
const LocalQueue = require('./localQueue');
const UploadWorker = require('./uploadWorker');
```

### 2. Added Global Variables
```javascript
let localQueue = null;
let uploadWorker = null;
```

### 3. Created `initializeQueue()` Function
This function:
- Creates a LocalQueue instance
- Initializes the queue directory structure
- Creates an UploadWorker instance
- Starts the upload worker for background processing

### 4. Created `startSpoolerMonitoring()` Function
This function:
- Creates a SpoolMonitor instance
- Sets up event handlers for 'file-detected' and 'error' events
- Enqueues detected receipts to the local queue
- Returns the monitor instance

### 5. Updated `startWatcher()` Function
- Made it async to support queue initialization
- Calls `initializeQueue()` before starting the monitor
- Properly instantiates SpoolMonitor with event handlers

### 6. Updated Shutdown Handler
- Made it async to properly stop the upload worker
- Calls `uploadWorker.stop()` instead of `spoolMonitor.stop()`

### 7. Updated Batch Script
Added `CAPTURE_MODE=spooler` environment variable to `run-tabezaconnect-dev.bat`

## How It Works Now

### Receipt Capture Flow
1. **SpoolMonitor** watches `C:\Windows\System32\spool\PRINTERS`
2. When a print job is detected, it processes the ESC/POS data
3. Receipt data is **enqueued** to LocalQueue (persistent storage)
4. **UploadWorker** runs in background, continuously processing the queue
5. Receipts are uploaded to the cloud API with retry logic
6. Successfully uploaded receipts are moved to the "uploaded" directory

### Offline Resilience
- Receipts are stored locally in `C:\ProgramData\Tabeza\queue\pending\`
- If upload fails, the worker retries with exponential backoff (5s, 10s, 20s, 40s)
- Queue persists across service restarts
- No receipt data is lost during network outages

## Testing Instructions

### Run in Development Mode
```batch
cd c:\Projects\Tabz
run-tabezaconnect-dev.bat
```

### Expected Output
```
🗂️  Initializing local persistent queue...
   Queue path: C:\ProgramData\Tabeza\queue
✅ Local queue initialized (0 pending receipts)

🚀 Starting async upload worker...
   API endpoint: http://localhost:3003
   Bar ID: 438c80c1-fe11-4ac5-8a48-2fc45104ba31
   Device ID: TABEZA-DEV-LOCAL
   Poll interval: 2000ms

✅ Upload worker started successfully

🚀 Starting Windows spooler monitor...
   Monitoring: C:\Windows\System32\spool\PRINTERS
   File types: .SPL, .SHD

✅ Spool monitor started successfully (file watcher mode)
```

### Test Receipt Capture
1. Print a test receipt from your POS to any printer
2. Watch the console for "📄 Receipt detected from spooler"
3. Receipt should be enqueued and uploaded automatically
4. Check `C:\ProgramData\Tabeza\queue\uploaded\` for processed receipts

## Next Steps

### For Production Build
1. Rebuild the installer with these fixes
2. Test installation on a clean Windows machine
3. Verify service starts correctly
4. Test receipt capture with real POS system

### For Continued Development
- Service is now runnable from source
- Can test changes without rebuilding installer
- Use `run-tabezaconnect-dev.bat` for quick testing

## Files Modified
- `TabezaConnect/src/service/index.js` - Added missing functions and imports
- `Tabz/run-tabezaconnect-dev.bat` - Added CAPTURE_MODE environment variable

## Status
✅ **FIXED** - Service can now start in development mode and capture receipts from the Windows print spooler.
