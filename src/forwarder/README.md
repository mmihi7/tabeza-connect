# Printer Forwarder Module

The Printer Forwarder module handles forwarding captured raw ESC/POS bytes to physical thermal printers after receipt capture. It supports three communication methods: USB (via serialport), network (raw TCP), and serial ports.

## Architecture

```
Capture Script
    ↓ (raw ESC/POS bytes)
Printer Forwarder
    ├─→ USB Printer (via serialport)
    ├─→ Network Printer (via TCP socket)
    └─→ Serial Printer (via serialport)
```

## Features

- **Multiple Communication Methods**: USB, network (TCP), and serial port support
- **Automatic Retry**: Exponential backoff retry logic (5s, 10s, 20s, 40s, 60s)
- **Failed Print Handling**: Saves failed prints to disk for manual recovery
- **Status Tracking**: Real-time status monitoring (online/offline, success/failure counts)
- **Connection Management**: Automatic connection handling and cleanup
- **Performance**: < 200ms forwarding latency target

## Usage

### Basic Usage

```javascript
const { createPrinterForwarder } = require('./forwarder');

// Create logger (winston or console)
const logger = console;

// USB Printer
const usbForwarder = createPrinterForwarder({
  type: 'usb',
  port: 'COM3',
  baudRate: 9600,
  timeout: 5000
}, logger);

// Network Printer
const networkForwarder = createPrinterForwarder({
  type: 'network',
  ip: '192.168.1.100',
  networkPort: 9100,
  timeout: 5000
}, logger);

// Forward print job
const rawBytes = Buffer.from(/* ESC/POS data */);
await forwarder.forward(rawBytes, {
  filename: 'receipt-001.prn',
  timestamp: new Date().toISOString()
});

// Check status
const status = forwarder.getStatus();
console.log('Printer online:', status.online);
console.log('Total forwarded:', status.totalForwarded);
console.log('Total failed:', status.totalFailed);

// Close connection when done
await forwarder.close();
```

### Configuration Options

#### USB/Serial Printer

```javascript
{
  type: 'usb' | 'serial',
  port: 'COM3',           // Required: COM port
  baudRate: 9600,         // Optional: Default 9600
  timeout: 5000           // Optional: Default 5000ms
}
```

#### Network Printer

```javascript
{
  type: 'network',
  ip: '192.168.1.100',    // Required: Printer IP address
  networkPort: 9100,      // Optional: Default 9100
  timeout: 5000           // Optional: Default 5000ms
}
```

## Classes

### PrinterForwarder (Base Class)

Abstract base class that implements:
- Configuration validation
- Retry logic with exponential backoff
- Failed print handling
- Status tracking
- Error handling

### USBPrinterForwarder

Handles USB and serial port communication using the `serialport` library.

**Methods:**
- `openConnection()`: Opens serial port connection
- `forwardToDevice(rawBytes)`: Sends data to USB printer
- `closeConnection()`: Closes serial port
- `static listPorts()`: Lists available serial ports

### NetworkPrinterForwarder

Handles network printer communication using raw TCP sockets.

**Methods:**
- `openConnection()`: Creates TCP connection
- `forwardToDevice(rawBytes)`: Sends data to network printer
- `closeConnection()`: Closes TCP socket
- `static testConnection(ip, port, timeout)`: Tests printer connectivity

## Retry Strategy

The forwarder automatically retries failed operations with exponential backoff:

1. **Attempt 1**: Immediate
2. **Attempt 2**: Wait 5s
3. **Attempt 3**: Wait 10s
4. **Attempt 4**: Wait 20s
5. **Attempt 5**: Wait 40s
6. **Attempt 6**: Wait 60s

After 6 failed attempts, the print job is saved to `C:\TabezaPrints\failed_prints\` for manual recovery.

## Failed Print Handling

When a print job fails after all retries:

1. Raw bytes saved to: `failed_prints\YYYYMMDD-HHMMSS-failed.prn`
2. Metadata saved to: `failed_prints\YYYYMMDD-HHMMSS-failed.json`

Metadata includes:
- Error message
- Print job size
- Printer configuration
- Timestamp
- Original metadata

## Status Tracking

The `getStatus()` method returns:

```javascript
{
  online: boolean,           // Printer reachability
  lastError: string | null,  // Last error message
  lastSuccess: Date | null,  // Last successful forward
  totalForwarded: number,    // Total successful forwards
  totalFailed: number        // Total failed forwards
}
```

## Error Handling

### Common Errors

**USB/Serial Errors:**
- Port not found
- Port access denied
- Write timeout
- Device disconnected

**Network Errors:**
- Connection refused
- Connection timeout
- Write timeout
- Network unreachable

### Error Recovery

All errors trigger the retry mechanism. After exhausting retries:
- Print job saved to `failed_prints\`
- Status updated to offline
- Error logged with details

## Testing

### Unit Tests

```bash
npm test src/forwarder/__tests__/PrinterForwarder.test.js
npm test src/forwarder/__tests__/USBPrinterForwarder.test.js
npm test src/forwarder/__tests__/NetworkPrinterForwarder.test.js
npm test src/forwarder/__tests__/index.test.js
```

### Integration Tests

```bash
npm test src/forwarder/__tests__/integration.test.js
```

## Performance

**Targets:**
- Forwarding latency: < 200ms
- USB write: < 100ms
- Network write: < 150ms
- Retry overhead: Minimal (async)

**Benchmarks:**
- Small receipts (< 1KB): ~50ms
- Medium receipts (1-10KB): ~100ms
- Large receipts (10-100KB): ~200ms

## Integration with Capture Script

```javascript
const { createPrinterForwarder } = require('./forwarder');

// Load printer config
const config = loadConfig();

// Create forwarder
const forwarder = createPrinterForwarder(
  config.printer,
  logger
);

// In capture script
async function processReceipt(rawBytes) {
  // 1. Save raw bytes
  await saveRaw(rawBytes);
  
  // 2. Textify
  const plainText = textify(rawBytes);
  
  // 3. Parse
  const parsed = parse(plainText);
  
  // 4. Queue for upload
  await queueUpload(parsed);
  
  // 5. Forward to physical printer (non-blocking)
  forwarder.forward(rawBytes, {
    filename: `${timestamp}.prn`
  }).catch(error => {
    logger.error('Forward failed', { error: error.message });
  });
}
```

## Troubleshooting

### USB Printer Not Found

1. Check COM port in Device Manager
2. Verify printer is powered on
3. Try different USB port
4. Check printer drivers installed

### Network Printer Unreachable

1. Ping printer IP address
2. Verify printer is on same network
3. Check firewall settings
4. Verify port 9100 is open

### Slow Forwarding

1. Check network latency (for network printers)
2. Verify USB cable quality (for USB printers)
3. Check printer buffer status
4. Monitor system resources

### Failed Prints Accumulating

1. Check printer status
2. Verify configuration
3. Test printer manually
4. Review error logs

## Dependencies

- `serialport`: ^12.0.0 (USB/serial communication)
- `net`: Built-in Node.js module (TCP communication)
- `fs`: Built-in Node.js module (file operations)

## License

MIT

## Support

For issues or questions, contact Tabeza support at support@tabeza.co.ke
