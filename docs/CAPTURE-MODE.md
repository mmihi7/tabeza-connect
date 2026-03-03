# TabezaConnect Capture Modes

## Overview

TabezaConnect operates in two modes to support both legacy and modern receipt capture architectures. The mode is controlled by the `CAPTURE_MODE` environment variable or `captureMode` field in `config.json`.

## Modes

### 1. Legacy Mode (`captureMode='folder'`)

**Default mode for backward compatibility**

#### Architecture
```
POS → TabezaConnect → Printer
```

TabezaConnect acts as a blocking intermediary in the print path.

#### How It Works
- Monitors a folder: `C:\ProgramData\Tabeza\TabezaPrints`
- POS system prints to this folder (using "Print to File" or similar)
- TabezaConnect detects new files and processes them
- Files are then forwarded to the printer

#### Use Cases
- Existing installations using folder-based printing
- POS systems configured to print to a specific folder
- Testing and development environments

#### Configuration
```json
{
  "captureMode": "folder",
  "watchFolder": "C:\\ProgramData\\Tabeza\\TabezaPrints"
}
```

Or via environment variable:
```bash
CAPTURE_MODE=folder
TABEZA_WATCH_FOLDER=C:\ProgramData\Tabeza\TabezaPrints
```

---

### 2. Spooler Mode (`captureMode='spooler'`)

**New passive capture mode (recommended for production)**

#### Architecture
```
POS ────────► Printer (instant, receipt prints in 1ms)
     │
     └──────► Windows Spooler
                    │
                    └──► TabezaConnect watches here (passive)
```

TabezaConnect passively observes the print stream without being in the critical path.

#### How It Works
- Monitors Windows print spooler: `C:\Windows\System32\spool\PRINTERS`
- POS prints directly to the thermal printer with zero latency
- TabezaConnect detects `.SPL` and `.SHD` files in the spooler
- Extracts ESC/POS bytes and text from spooler files
- Queues receipts locally and uploads asynchronously to cloud
- **Printing never depends on Tabeza** - if TabezaConnect is offline, receipts still print

#### Benefits
- **Zero latency**: POS prints directly to printer
- **No single point of failure**: Printing works even if TabezaConnect is down
- **Transparent integration**: POS and printer don't know Tabeza exists
- **Offline resilience**: Local queue survives system reboots
- **Async upload**: Network issues don't block printing

#### Use Cases
- Production environments with POS authority
- High-throughput venues (bars, restaurants, supermarkets)
- Venues requiring 100% print reliability
- Tabeza Basic mode (POS-authoritative)
- Tabeza Venue mode with POS authority

#### Configuration
```json
{
  "captureMode": "pooling",
  "watchFolder": "C:\\Windows\\System32\\spool\\PRINTERS"
}
```

Or via environment variable:
```bash
CAPTURE_MODE=spooler
```

#### Requirements
- Windows operating system
- Thermal printer configured in Windows
- POS system printing to Windows printer
- TabezaConnect running as Windows service with appropriate permissions

---

## Migration Path

### From Legacy to Spooler Mode

1. **Verify current setup works**
   ```bash
   # Check current mode
   curl http://localhost:8765/api/status
   ```

2. **Update configuration**
   - Set `CAPTURE_MODE=spooler` in environment variables, OR
   - Update `config.json`: `"captureMode": "pooling"`

3. **Restart TabezaConnect service**
   ```bash
   # Stop service
   net stop TabezaConnect
   
   # Start service
   net start TabezaConnect
   ```

4. **Verify spooler mode is active**
   ```bash
   curl http://localhost:8765/api/status
   # Should show: "captureMode": "pooling"
   ```

5. **Test print from POS**
   - Print should go directly to printer (instant)
   - TabezaConnect should capture receipt from spooler
   - Check logs for successful capture

### Rollback to Legacy Mode

If issues occur, simply set `CAPTURE_MODE=folder` and restart the service.

---

## Implementation Status

### ✅ Completed (Task 2.1)
- Feature flag infrastructure
- Configuration loading with `captureMode` support
- Status endpoint shows current mode
- Backward compatibility maintained

### 🚧 In Progress
- Task 2.2: Windows print spooler monitoring
- Task 2.3: ESC/POS byte extraction
- Task 2.4: Local persistent queue
- Task 2.5: Async upload worker

---

## Core Truth Alignment

This architecture aligns with Tabeza's core operating principles:

> **CORE TRUTH**: Manual service always exists.  
> Digital authority is singular.  
> Tabeza adapts to the venue — never the reverse.

**Spooler mode ensures:**
- Manual service (physical receipts) always works
- POS is the singular digital authority (when configured)
- Tabeza adapts by passively observing, not controlling

**Physical receipt is the final fallback:**
- If TabezaConnect is offline → receipt still prints
- If parsing fails → customer has physical receipt
- If cloud is down → receipt still prints
- Digital parsing is additive, not critical

---

## Troubleshooting

### Check Current Mode
```bash
curl http://localhost:8765/api/status | jq .captureMode
```

### View Logs
```bash
# Windows Event Viewer
eventvwr.msc
# Navigate to: Windows Logs → Application
# Filter by source: TabezaConnect
```

### Test Spooler Access
```powershell
# Check if service can access spooler directory
Test-Path "C:\Windows\System32\spool\PRINTERS"
```

### Common Issues

**Issue**: Spooler mode not working  
**Solution**: Ensure TabezaConnect service has permissions to read spooler directory

**Issue**: Receipts not being captured  
**Solution**: Verify POS is printing to a Windows printer (not "Print to File")

**Issue**: Service won't start in spooler mode  
**Solution**: Check Windows Event Viewer for permission errors

---

## References

- Design Document: `Tabz/.kiro/specs/pos-receipt-capture-transformation/design.md`
- Requirements: `Tabz/.kiro/specs/pos-receipt-capture-transformation/requirements.md`
- Tasks: `Tabz/.kiro/specs/pos-receipt-capture-transformation/tasks.md`
