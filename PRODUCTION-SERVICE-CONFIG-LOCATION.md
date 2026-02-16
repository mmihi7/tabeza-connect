# Production Service Config Location

## Discovery
The TabezaConnect Windows service is installed at:
- **Service Binary**: `C:\Program Files\Tabeza\TabezaService.exe`
- **Working Directory**: `C:\Program Files\Tabeza\`
- **Config File**: `C:\Program Files\Tabeza\config.json`

This is NOT the same as the development location at `c:\Projects\TabezaConnect\`.

## Why No Heartbeats?

The production service at `C:\Program Files\Tabeza\` is using a different config.json than the one we've been editing at `c:\Projects\TabezaConnect\config.json`.

The production config.json likely:
1. Doesn't exist
2. Has wrong barId
3. Has wrong apiUrl

## Solution: Update Production Config

Run this script as administrator:
```cmd
Right-click: c:\Projects\Tabz\dev-tools\scripts\update-production-service-config.bat
Select: "Run as administrator"
```

This will:
1. Create/update `C:\Program Files\Tabeza\config.json` with correct barId
2. Restart the TabezaConnect service
3. Service will start sending heartbeats
4. Driver will appear in database
5. Staff app will see the printer

## Manual Steps (Alternative)

If you prefer to do it manually:

### Step 1: Create Config File
Create `C:\Program Files\Tabeza\config.json` with:
```json
{
  "barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
  "apiUrl": "https://staff.tabeza.co.ke",
  "watchFolder": "C:\\Users\\mwene\\TabezaPrints",
  "logLevel": "info",
  "logPath": "C:\\Users\\mwene\\AppData\\Roaming\\Tabeza\\logs",
  "service": {
    "name": "TabezaConnect",
    "displayName": "Tabeza Connect Service",
    "description": "Captures receipt data from POS and syncs with Tabeza staff app",
    "port": 8765
  },
  "printer": {
    "name": "Tabeza Receipt Printer",
    "port": "FILE:",
    "outputPath": "C:\\Users\\mwene\\TabezaPrints\\pending"
  },
  "sync": {
    "intervalSeconds": 30,
    "retryAttempts": 3,
    "retryDelaySeconds": 60
  }
}
```

### Step 2: Start Service
```cmd
sc start TabezaConnect
```

### Step 3: Verify Heartbeat
Wait 30 seconds, then:
```cmd
cd c:\Projects\Tabz
node dev-tools\scripts\diagnose-printer-visibility.js
```

Should see: "Found 1 driver(s) in database"

## Development vs Production

- **Development**: `c:\Projects\TabezaConnect\` - for testing changes
- **Production**: `C:\Program Files\Tabeza\` - Windows service location

When you rebuild TabezaService.exe, you need to:
1. Copy it to `C:\Program Files\Tabeza\TabezaService.exe`
2. Restart the service: `sc stop TabezaConnect && sc start TabezaConnect`

## Service Management Commands

```cmd
REM Check status
sc query TabezaConnect

REM Stop service
sc stop TabezaConnect

REM Start service
sc start TabezaConnect

REM Restart service
sc stop TabezaConnect && timeout /t 2 && sc start TabezaConnect

REM View service config
"C:\Program Files\Tabeza\nssm\win64\nssm.exe" get TabezaConnect AppDirectory
"C:\Program Files\Tabeza\nssm\win64\nssm.exe" get TabezaConnect Application
```
