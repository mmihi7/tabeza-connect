# Tabeza Capture Script

The Redmon-based receipt capture script that processes print jobs from the Redmon port monitor.

## Overview

This script is invoked by Redmon for each print job sent to the "Tabeza POS Printer". It:

1. Reads raw ESC/POS bytes from stdin
2. Saves raw bytes to disk (archival)
3. Strips ESC/POS control codes to produce plain text
4. Parses the text using a local template
5. Saves parsed JSON
6. Queues the receipt for upload to the cloud

## Architecture

```
Redmon Port Monitor
    ↓ (pipes stdin)
capture.exe
    ├─→ Save raw (.prn)
    ├─→ Textify (strip ESC/POS)
    ├─→ Parse (apply template)
    ├─→ Save parsed (.json)
    └─→ Queue for upload
```

## Performance Targets

- Total processing time: < 100ms per receipt
- Memory usage: < 50MB per invocation
- Handles receipts up to 1MB

## Configuration

The script is configured via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `TABEZA_BAR_ID` | Venue identifier (required) | - |
| `TABEZA_API_URL` | Cloud API URL | `https://tabeza.co.ke` |
| `TABEZA_CAPTURE_PATH` | Base path for captured files | `C:\TabezaPrints` |
| `TABEZA_LOG_LEVEL` | Log level (ERROR, WARN, INFO, DEBUG) | `INFO` |
| `TABEZA_LOG_PATH` | Path for log files | `C:\ProgramData\Tabeza\logs` |

## File Structure

```
C:\TabezaPrints\
├── raw\                    # Raw ESC/POS files (.prn)
├── text\                   # Textified plain text (.txt)
├── parsed\                 # Parsed JSON (.json)
├── queue\
│   ├── pending\           # Awaiting upload
│   └── uploaded\          # Successfully uploaded
└── errors\                # Error diagnostics
```

## Building

To build the standalone executable:

```bash
cd src/capture
node build-capture.js
```

This will create `dist/capture.exe` (~40-50 MB).

## Testing

To test the capture script locally:

```bash
# Test with sample ESC/POS data
echo "Sample receipt data" | node index.js

# Or use a test file
node index.js < test-receipt.prn
```

## Logging

Logs are written to:
- Console (stdout/stderr)
- File: `C:\ProgramData\Tabeza\logs\capture.log`

Log format (JSON):
```json
{
  "timestamp": "2026-03-08T10:00:00.000Z",
  "level": "INFO",
  "component": "capture",
  "message": "Receipt captured",
  "data": {
    "filename": "20260308-100000-123",
    "size": 2048,
    "duration": 45
  },
  "pid": 1234
}
```

## Error Handling

The script handles errors gracefully:

- **Stdin read failure**: Exits with code 1, logs error
- **Disk space low**: Logs warning, continues processing
- **File write failure**: Logs error, continues with next stage
- **Parse failure**: Logs error, queues with `parsed: false`
- **Template missing**: Uses default template, logs warning

## Integration with Redmon

Redmon configuration:
```
Port Name: TabezaCapturePort
Program: C:\Program Files\TabezaConnect\capture.exe
Arguments: (none)
Run as: LocalService
```

## Dependencies

- Node.js 20 (bundled in executable)
- uuid (for queue IDs)
- textifier module (ESC/POS processing)
- receiptParser module (template-based parsing)

## Performance Monitoring

Key metrics logged:
- Capture duration (total time)
- Textify duration
- Parse duration
- File sizes (raw, text)
- Parse confidence
- Queue status

## Troubleshooting

**Problem: No data received from stdin**
- Check Redmon port configuration
- Verify capture.exe path is correct
- Check Windows Event Viewer for Redmon errors

**Problem: Parse confidence always low**
- Check if template.json exists
- Verify template patterns match receipt format
- Review sample receipts in text/ folder

**Problem: Files not being saved**
- Check disk space (minimum 100MB required)
- Verify folder permissions (SYSTEM and Administrators)
- Check logs for write errors

## Related Documentation

- [Design Document](../../.kiro/specs/redmon-receipt-capture/design.md)
- [Requirements](../../.kiro/specs/redmon-receipt-capture/requirements.md)
- [Tasks](../../.kiro/specs/redmon-receipt-capture/tasks.md)
