# Upload Worker Documentation

## Overview

The Upload Worker is a background process that continuously monitors the local queue and uploads captured receipts to the cloud API asynchronously. It implements exponential backoff retry logic and handles network failures gracefully.

**CORE TRUTH**: Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Upload Worker Flow                        │
│                                                              │
│  Local Queue (Pending)                                       │
│         │                                                    │
│         ▼                                                    │
│  Dequeue Receipt                                             │
│         │                                                    │
│         ▼                                                    │
│  Upload to Cloud API ──────► Success ──► Mark Uploaded      │
│         │                                      │             │
│         │                                      ▼             │
│         │                              Remove from Queue     │
│         │                                                    │
│         ▼                                                    │
│  Failure ──► Retry with Exponential Backoff                 │
│         │                                                    │
│         ├──► Attempt 1: Wait 5s                             │
│         ├──► Attempt 2: Wait 10s                            │
│         ├──► Attempt 3: Wait 20s                            │
│         └──► Attempt 4: Wait 40s                            │
│                   │                                          │
│                   ▼                                          │
│         Max Retries ──► Keep in Queue                        │
│                         (Retry on restart)                   │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Non-Blocking Operation
- Runs as a separate background process
- Never blocks the capture service
- Capture continues even if upload fails

### 2. Exponential Backoff Retry
- **Attempt 1**: Wait 5 seconds
- **Attempt 2**: Wait 10 seconds
- **Attempt 3**: Wait 20 seconds
- **Attempt 4**: Wait 40 seconds
- **After 4 attempts**: Keep in queue for next service restart

### 3. Offline Mode Support
- Receipts remain in queue when offline
- Automatic resume when connectivity restored
- No data loss during network outages

### 4. Queue Persistence
- Queue survives system reboots
- Service restarts resume processing
- Scans queue directory on startup

### 5. Graceful Error Handling
- Network errors don't crash the worker
- Timeout protection (30 seconds default)
- Detailed error logging

## Configuration

```javascript
const uploadWorker = new UploadWorker({
  localQueue: localQueueInstance,
  apiEndpoint: 'https://api.tabeza.co.ke',
  barId: 'bar-uuid',
  deviceId: 'device-uuid',
  pollInterval: 2000,        // Check queue every 2 seconds
  uploadTimeout: 30000,      // 30 second timeout
});
```

### Required Options

| Option | Type | Description |
|--------|------|-------------|
| `localQueue` | LocalQueue | Local queue instance |
| `apiEndpoint` | string | Cloud API endpoint URL |
| `barId` | string | Bar/venue UUID |
| `deviceId` | string | Device UUID |

### Optional Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pollInterval` | number | 2000 | Queue polling interval (ms) |
| `uploadTimeout` | number | 30000 | Upload timeout (ms) |

## Usage

### Basic Usage

```javascript
const LocalQueue = require('./localQueue');
const UploadWorker = require('./uploadWorker');

// Initialize local queue
const localQueue = new LocalQueue({
  queuePath: 'C:\\ProgramData\\Tabeza\\queue',
});
await localQueue.initialize();

// Create upload worker
const uploadWorker = new UploadWorker({
  localQueue,
  apiEndpoint: 'https://api.tabeza.co.ke',
  barId: 'bar-123',
  deviceId: 'device-456',
});

// Start worker
await uploadWorker.start();

// Worker runs continuously in background...

// Stop worker (on service shutdown)
await uploadWorker.stop();
```

### Event Handling

```javascript
// Listen to upload events
uploadWorker.on('upload-success', (receiptId) => {
  console.log(`Receipt uploaded: ${receiptId}`);
});

uploadWorker.on('upload-retry', (receiptId, attempt, delay) => {
  console.log(`Retrying ${receiptId} (attempt ${attempt}, delay ${delay}ms)`);
});

uploadWorker.on('upload-failed', (receiptId, error) => {
  console.error(`Upload failed: ${receiptId}`, error);
});

uploadWorker.on('started', () => {
  console.log('Worker started');
});

uploadWorker.on('stopped', () => {
  console.log('Worker stopped');
});
```

### Monitoring

```javascript
// Get worker statistics
const stats = await uploadWorker.getStats();

console.log('Upload Statistics:');
console.log(`  Attempts: ${stats.uploadsAttempted}`);
console.log(`  Succeeded: ${stats.uploadsSucceeded}`);
console.log(`  Failed: ${stats.uploadsFailed}`);
console.log(`  Retries: ${stats.retriesAttempted}`);
console.log(`  Queue size: ${stats.queueSize}`);
console.log(`  Online: ${stats.isOnline}`);
console.log(`  Last success: ${stats.lastUploadSuccess}`);
console.log(`  Last failure: ${stats.lastUploadFailure}`);
```

### Force Processing

```javascript
// Force immediate queue processing (useful for testing)
await uploadWorker.forceProcess();
```

## API Endpoint

The worker uploads receipts to the cloud ingestion API:

**Endpoint**: `POST /api/receipts/ingest`

**Request Payload**:
```json
{
  "barId": "bar-uuid",
  "deviceId": "device-uuid",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "escposBytes": "base64-encoded-data",
  "text": "Receipt text content",
  "metadata": {
    "source": "spool-monitor",
    "fileSize": 1024,
    "enqueuedAt": "2024-01-15T10:30:01.000Z",
    "uploadAttempts": 0
  }
}
```

**Response**:
```json
{
  "success": true,
  "receiptId": "receipt-uuid",
  "queuedForParsing": true
}
```

## Error Handling

### Network Errors
- **ENOTFOUND**: DNS resolution failed (offline)
- **ECONNREFUSED**: API endpoint unreachable
- **Timeout**: Upload exceeded 30 seconds

All network errors trigger exponential backoff retry.

### HTTP Errors
- **4xx**: Client errors (logged, no retry)
- **5xx**: Server errors (retry with backoff)

### Timeout Protection
- Default timeout: 30 seconds
- Prevents hanging on slow connections
- Aborts request and retries

## Performance

### Upload Latency
- **Target**: < 20ms per receipt
- **Typical**: 50-100ms (including network)
- **Timeout**: 30 seconds maximum

### Queue Processing
- **Poll interval**: 2 seconds
- **Concurrent uploads**: 1 at a time (sequential)
- **Throughput**: ~30 receipts/minute

### Retry Delays
- **Total retry time**: 75 seconds (5s + 10s + 20s + 40s)
- **Max attempts**: 4 retries
- **Backoff strategy**: Exponential (doubles each time)

## Testing

### Unit Tests

```bash
cd TabezaConnect/src/service
npm test -- uploadWorker.test.js
```

### Manual Testing

```bash
cd TabezaConnect
node test-upload-worker.js
```

This script:
1. Creates test queue
2. Enqueues sample receipts
3. Starts upload worker
4. Monitors progress
5. Simulates random failures (20% chance)
6. Shows statistics

## Integration with Capture Service

The upload worker integrates with the capture service:

```javascript
// In capture service main file
const spoolMonitor = new SpoolMonitor();
const localQueue = new LocalQueue();
const uploadWorker = new UploadWorker({
  localQueue,
  apiEndpoint: config.apiEndpoint,
  barId: config.barId,
  deviceId: config.deviceId,
});

// Start all components
await localQueue.initialize();
await spoolMonitor.start();
await uploadWorker.start();

// Handle spool monitor events
spoolMonitor.on('file-detected', async (filePath, receiptData) => {
  // Enqueue receipt
  await localQueue.enqueue({
    barId: config.barId,
    deviceId: config.deviceId,
    timestamp: new Date().toISOString(),
    escposBytes: receiptData.escposBytes,
    text: receiptData.text,
    metadata: receiptData.metadata,
  });
  
  // Upload worker processes queue automatically
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await uploadWorker.stop();
  await spoolMonitor.stop();
});
```

## Troubleshooting

### Worker Not Uploading

**Check**:
1. Worker is running: `uploadWorker.isRunning === true`
2. Queue has receipts: `await localQueue.getQueueSize()`
3. API endpoint is correct: `uploadWorker.apiEndpoint`
4. Network connectivity: `stats.isOnline`

### Uploads Failing

**Check**:
1. API endpoint reachable: `curl https://api.tabeza.co.ke/health`
2. Bar ID and Device ID are valid
3. Error logs: `stats.lastError`
4. Network firewall settings

### Queue Growing

**Possible causes**:
1. API endpoint down (check `stats.isOnline`)
2. Network issues (check `stats.lastError`)
3. Invalid credentials (check API response)
4. Rate limiting (check API response)

**Solution**:
- Worker will automatically retry when connectivity restored
- Check `stats.retriesAttempted` to see retry activity
- Receipts remain in queue until successfully uploaded

## Requirements Validation

This implementation satisfies the following requirements:

- **6.1**: Background worker runs continuously ✅
- **6.2**: Uploads receipts asynchronously ✅
- **6.3**: Exponential backoff retry (5s, 10s, 20s, 40s) ✅
- **6.4**: Never blocks capture process ✅
- **6.5**: Removes receipts after successful upload ✅
- **2.6**: Resumes processing on service restart ✅

## Security Considerations

1. **API Authentication**: Ensure API endpoint uses HTTPS
2. **Credentials**: Store bar ID and device ID securely
3. **Data Privacy**: Receipt data is encrypted in transit
4. **Error Logging**: Don't log sensitive receipt content

## Future Enhancements

1. **Batch Uploads**: Upload multiple receipts in one request
2. **Compression**: Compress receipt data before upload
3. **Priority Queue**: Prioritize recent receipts
4. **Adaptive Retry**: Adjust retry delays based on error type
5. **Health Monitoring**: Expose metrics endpoint
