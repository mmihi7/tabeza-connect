# Migration Module

This module provides functionality for detecting and migrating from the legacy pooling-based printer architecture to the new virtual printer architecture.

## Overview

The migration module helps identify existing Tabeza Connect installations that use the old Windows printer pooling approach and determines if migration to the new clawPDF-based virtual printer is needed.

## Components

### 1. PowerShell Detection Script

**Location:** `scripts/detect-pooling-printer.ps1`

**Purpose:** Detects the legacy "Tabeza Agent" with pooling configuration.

**Usage:**

```powershell
# Text output (default)
.\scripts\detect-pooling-printer.ps1

# JSON output for programmatic use
.\scripts\detect-pooling-printer.ps1 -OutputFormat json

# Verbose mode
.\scripts\detect-pooling-printer.ps1 -Verbose
```

**Exit Codes:**
- `0` - No migration needed (printer not found or not using pooling)
- `1` - Migration needed (pooling printer detected)
- `2` - Error during detection

### 2. Node.js Detection Module

**Location:** `src/service/migration/detect-pooling.js`

**Purpose:** Provides programmatic access to pooling printer detection from Node.js code.

**Usage:**

```javascript
const { detectPoolingPrinter, isMigrationNeeded, getSummary } = require('./src/service/migration/detect-pooling');

// Full detection
const result = await detectPoolingPrinter({ verbose: true });
console.log(result);

// Quick migration check
const needsMigration = await isMigrationNeeded();
if (needsMigration) {
    console.log('Migration required!');
}

// Human-readable summary
const summary = getSummary(result);
console.log(summary);
```

## Detection Logic

The detection script checks for:

1. **Printer Existence**: Does "Tabeza Agent" exist in Windows?
2. **Pooling Configuration**: Does the printer have multiple ports configured?
3. **Capture Port**: Does "TabezaCapturePort" (Local Port) exist?
4. **Configuration Files**: Are config.json and template.json present?

### Migration Decision

Migration is needed if:
- Printer exists **AND**
- (Has pooling enabled **OR** Has TabezaCapturePort)

## Detection Result Object

```typescript
{
    exists: boolean,              // Printer exists
    printerName: string | null,   // Printer name (if found)
    hasPooling: boolean,          // Multiple ports configured
    ports: string[],              // Array of port names
    hasCapturePort: boolean,      // TabezaCapturePort exists
    driverName: string | null,    // Printer driver name
    migrationNeeded: boolean,     // Migration required
    details: Array<{              // Detailed log messages
        type: string,             // "Info", "Success", "Warning", "Error"
        message: string,
        timestamp: string
    }>,
    error: string | null          // Error message (if failed)
}
```

## Testing

Run the test script to verify detection:

```bash
node scripts/test-pooling-detection.js
```

This will:
1. Execute the detection
2. Display the full result object
3. Check if migration is needed
4. Show a human-readable summary

## Integration Points

### Installer (Inno Setup)

The installer can call the PowerShell script during installation:

```pascal
[Code]
function CheckPoolingPrinter(): Boolean;
var
  ResultCode: Integer;
begin
  // Run detection script
  Exec('powershell.exe', 
       '-ExecutionPolicy Bypass -File "scripts\detect-pooling-printer.ps1"',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  // ResultCode 1 means migration needed
  Result := (ResultCode = 1);
end;
```

### Service Startup

The service can check on startup and warn users:

```javascript
const { isMigrationNeeded } = require('./migration/detect-pooling');

async function checkMigrationStatus() {
    const needsMigration = await isMigrationNeeded({ verbose: true });
    
    if (needsMigration) {
        console.warn('⚠️  Legacy pooling printer detected!');
        console.warn('   Migration to virtual printer is recommended.');
        console.warn('   Please run the installer to upgrade.');
        
        // Show notification in system tray
        // Log warning to service log
        // Display banner in Management UI
    }
}
```

### Management UI

The Management UI can display migration status:

```javascript
// API endpoint: GET /api/migration/status
app.get('/api/migration/status', async (req, res) => {
    const result = await detectPoolingPrinter();
    res.json(result);
});
```

## Fallback Detection

If PowerShell execution fails, the Node.js module includes a fallback using direct WMI queries:

```javascript
// Fallback uses WMIC commands
wmic printer where "Name='Tabeza Agent'" get Name,DriverName,PortName
wmic path Win32_TCPIPPrinterPort where "Name='TabezaCapturePort'" get Name
```

This ensures detection works even in restricted environments.

## Error Handling

The detection is designed to be non-fatal:

- If detection fails, it returns an error message but doesn't crash
- Fallback detection attempts WMI queries if PowerShell fails
- Service can continue running even if detection fails
- Errors are logged but don't block installation/startup

## Future Enhancements

Planned improvements:

1. **Automatic Migration**: Detect and migrate in one step
2. **Backup Creation**: Automatically backup old configuration
3. **Rollback Support**: Restore old configuration if migration fails
4. **Progress Reporting**: Real-time migration progress updates
5. **Validation**: Verify migration success after completion

## Related Files

- `scripts/detect-pooling-printer.ps1` - PowerShell detection script
- `src/service/migration/detect-pooling.js` - Node.js detection module
- `scripts/test-pooling-detection.js` - Test script
- `files/installer-pkg.iss` - Installer script (will integrate detection)

## Support

For issues or questions about migration:

- Check service logs: `C:\ProgramData\Tabeza\logs\service.log`
- Run detection manually: `.\scripts\detect-pooling-printer.ps1 -Verbose`
- Contact support: support@tabeza.co.ke
