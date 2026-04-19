# TabezaConnect Configuration Schema

This document describes all configuration options available in `config.json`.

## Root Configuration

### Required Fields

- **`barId`** (string): Unique identifier for the bar/venue
  - Example: `"438c80c1-fe11-4ac5-8a48-2fc45104ba31"`

- **`driverId`** (string): Unique identifier for this device/driver
  - Example: `"driver-MIHI-PC"`

- **`apiUrl`** (string): Tabeza Cloud API endpoint
  - Default: `"https://tabeza.co.ke"`

- **`watchFolder`** (string): Base folder for file operations
  - Example: `"C:\\TabezaPrints"`

- **`captureMode`** (string): Capture mode to use
  - Options: `"spooler"`, `"bridge"`, `"pooling"`
  - Default: `"spooler"`

### Optional Fields

- **`logLevel`** (string): Logging verbosity level
  - Options: `"debug"`, `"info"`, `"warn"`, `"error"`
  - Default: `"info"`

- **`logPath`** (string): Directory for log files
  - Default: `"C:\\ProgramData\\Tabeza\\logs"`

## Capture Modes

### Bridge Mode (`captureMode: "bridge"`)

Intercepts print jobs and forwards them to both physical printer and Tabeza Cloud.

**Configuration:**
```json
"bridge": {
  "enabled": true,
  "printerName": "EPSON L3210 Series",
  "captureFolder": "C:\\TabezaPrints",
  "tempFolder": "C:\\TabezaPrints\\temp",
  "autoConfigure": true
}
```

**Fields:**
- **`enabled`** (boolean): Enable bridge mode
  - Default: `false`
- **`printerName`** (string): Name of physical printer to forward to
- **`captureFolder`** (string): Folder to capture print jobs
- **`tempFolder`** (string): Temporary storage for processing
- **`autoConfigure`** (boolean): Automatically configure printer settings
  - Default: `true`

### Pooling Mode (`captureMode: "pooling"`)

Monitors a single capture file written by Windows printer pool. This mode enables passive observation of POS receipts without intercepting print jobs.

**Configuration:**
```json
"pooling": {
  "enabled": true,
  "captureFile": "C:\\TabezaPrints\\order.prn",
  "tempFolder": "C:\\ProgramData\\Tabeza\\captures",
  "stabilityChecks": 3,
  "stabilityDelay": 100
}
```

**Fields:**
- **`enabled`** (boolean): Enable pooling mode
  - Default: `false`
- **`captureFile`** (string): Path to the file that receives print data from printer pool
  - Default: `"C:\\TabezaPrints\\order.prn"`
  - This file is written by the Windows printer pool
- **`tempFolder`** (string): Directory where stable capture files are copied with unique timestamps
  - Default: `"{watchFolder}\\captures"` (e.g., `"C:\\TabezaPrints\\captures"`)
  - Each captured file is saved as `capture_{timestamp}.prn`
- **`stabilityChecks`** (number): Number of consecutive checks to verify file has finished receiving data
  - Default: `3`
  - File size and modification time must remain unchanged across all checks
- **`stabilityDelay`** (number): Delay in milliseconds between stability checks
  - Default: `100`
  - Total stability verification time = `stabilityChecks * stabilityDelay` (default: 300ms)

**How Pooling Mode Works:**
1. Configure Windows printer pool named "TabezaConnect"
2. Add physical printer and file printer (targeting `captureFile`) to the pool
3. POS prints to "TabezaConnect" printer pool
4. Windows routes print job to both physical printer and capture file
5. TabezaConnect monitors capture file for changes
6. When file becomes stable (unchanged for 3 checks), it's copied to temp folder
7. Receipt data is queued and uploaded to Tabeza Cloud
8. Original capture file is preserved (not deleted)

**Requirements:**
- Windows printer pooling must be configured
- Capture file path must be writable
- Temp folder must be writable
- POS must print to the configured printer pool

### Spooler Mode (`captureMode: "spooler"`)

Monitors Windows print spooler for new print jobs (legacy mode).

**Configuration:** No additional configuration section required.

## Service Configuration

```json
"service": {
  "name": "TabezaConnect",
  "displayName": "TabezaConnect",
  "description": "Captures receipt data from POS and syncs with Tabeza staff app",
  "port": 8765
}
```

**Fields:**
- **`name`** (string): Internal service name
- **`displayName`** (string): Display name shown in Windows Services
- **`description`** (string): Service description
- **`port`** (number): HTTP API port for status endpoint
  - Default: `8765`
## Printer Configuration

### Virtual Printer

```json
"printer": {
  "name": "TabezaConnect",
  "port": "FILE:",
  "outputPath": "C:\\TabezaPrints\\pending"
}
```

**Fields:**
- **`name`** (string): Virtual printer name
- **`port`** (string): Printer port type
- **`outputPath`** (string): Output directory for print jobs

### Physical Printers

The `printers` array defines physical printers that receive forwarded receipt data.

```json
"printers": [
  {
    "name": "EPSON L3210 Series",
    "type": "windows",
    "enabled": true,
    "isDefault": true,
    "dedupeWindow": 30000,
    "printQuality": {
      "density": 8,
      "heating": 80,
      "speed": 2
    }
  }
]
```

**Fields per printer object:**
- **`name`** (string): Printer name as shown in Windows Devices and Printers.
- **`type`** (string): Printer connection type. Must be `"windows"` for Windows raw printing, `"usb"`, `"network"`, or `"serial"`.
- **`enabled`** (boolean): Whether the printer is active. Default `true`.
- **`isDefault`** (boolean): If multiple printers, this printer receives jobs when no specific printer is selected. Default `false`.
- **`dedupeWindow`** (number, optional): Time window in milliseconds during which duplicate print jobs are suppressed. Default `30000` (30 seconds).
- **`printQuality`** (object, optional): ESC/POS print quality settings.
  - **`density`** (number): Print density (0–8). Higher values produce darker print. Default `8`.
  - **`heating`** (number): Heating duration (0–255). Higher values increase heating time for darker print but may reduce print head life. Default `80`.
  - **`speed`** (number): Print speed (0–2). 0 = slow, 1 = normal, 2 = fast. Default `2`.


## Sync Configuration

```json
"sync": {
  "intervalSeconds": 30,
  "retryAttempts": 3,
  "retryDelaySeconds": 60
}
```

**Fields:**
- **`intervalSeconds`** (number): Interval between sync attempts
  - Default: `30`
- **`retryAttempts`** (number): Number of retry attempts for failed uploads
  - Default: `3`
- **`retryDelaySeconds`** (number): Delay between retry attempts
  - Default: `60`

## Configuration Examples

### Example 1: Pooling Mode Setup

```json
{
  "barId": "bar-123",
  "driverId": "device-456",
  "apiUrl": "https://tabeza.co.ke",
  "watchFolder": "C:\\TabezaPrints",
  "captureMode": "pooling",
  "pooling": {
    "enabled": true,
    "captureFile": "C:\\TabezaPrints\\order.prn",
    "tempFolder": "C:\\ProgramData\\Tabeza\\captures",
    "stabilityChecks": 3,
    "stabilityDelay": 100
  }
}
```

### Example 2: Bridge Mode Setup

```json
{
  "barId": "bar-123",
  "driverId": "device-456",
  "apiUrl": "https://tabeza.co.ke",
  "watchFolder": "C:\\TabezaPrints",
  "captureMode": "bridge",
  "bridge": {
    "enabled": true,
    "printerName": "EPSON L3210 Series",
    "captureFolder": "C:\\TabezaPrints",
    "tempFolder": "C:\\TabezaPrints\\temp",
    "autoConfigure": true
  }
}
```

### Example 3: Spooler Mode Setup (Legacy)

```json
{
  "barId": "bar-123",
  "driverId": "device-456",
  "apiUrl": "https://tabeza.co.ke",
  "watchFolder": "C:\\TabezaPrints",
  "captureMode": "pooling"
}
```

## Backward Compatibility

- All new configuration sections are optional
- Default values are used when fields are missing
- Existing configurations continue to work without modification
- The `captureMode` field determines which capture method is active

## Validation Rules

1. **`captureMode`** must be one of: `"spooler"`, `"bridge"`, `"pooling"`
2. **`barId`** and **`driverId`** are required for all modes
3. **`apiUrl`** must be a valid HTTPS URL
4. **`stabilityChecks`** must be a positive integer (recommended: 2-5)
5. **`stabilityDelay`** must be a positive integer in milliseconds (recommended: 50-200)
6. File paths must be valid Windows paths with proper escaping (`\\` for backslashes)

## Environment Variable Overrides

Configuration values can be overridden using environment variables:

- `TABEZA_BAR_ID` → `barId`
- `TABEZA_DRIVER_ID` → `driverId`
- `TABEZA_API_URL` → `apiUrl`
- `TABEZA_CAPTURE_MODE` → `captureMode`
- `TABEZA_CAPTURE_FILE` → `pooling.captureFile`
- `TABEZA_WATCH_FOLDER` → `watchFolder`

## Notes

- **Pooling mode** is the recommended approach for POS integration as it's passive and non-intrusive
- **Bridge mode** requires printer driver installation and may conflict with some POS systems
- **Spooler mode** is legacy and may be deprecated in future versions
- Always use absolute paths for file and folder configurations
- Ensure all configured folders exist and are writable before starting the service
