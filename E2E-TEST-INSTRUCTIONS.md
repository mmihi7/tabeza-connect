# End-to-End Test - Quick Instructions

## Current Status
Tasks 1-4 are complete. Now we need to test the complete fix end-to-end.

## Quick Test Steps

### 1. Create Config File
Run this in PowerShell (as Administrator):
```powershell
$config = @"
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
"@

$config | Out-File -FilePath "c:\Projects\TabezaConnect\config.json" -Encoding UTF8
Write-Host "✅ Config file created!" -ForegroundColor Green
```

### 2. Start Service (Terminal 1)
```cmd
cd c:\Projects\TabezaConnect
TabezaService.exe
```

**Look for**: `driver-MIHI-PC` (no timestamp!)

### 3. Check Database (Terminal 2)
```cmd
cd c:\Projects\Tabz
node dev-tools/scripts/identify-stale-drivers.js
```

**Expected**: 1 driver with ID `driver-MIHI-PC`

### 4. Restart Service
In Terminal 1:
- Press `Ctrl+C` to stop
- Wait 10 seconds
- Run `TabezaService.exe` again

### 5. Check Database Again
```cmd
node dev-tools/scripts/identify-stale-drivers.js
```

**Expected**: Still 1 driver (not 2!), heartbeat updated

## Success Criteria
✅ Driver ID has no timestamp
✅ Only 1 driver record exists
✅ Same record updated on restart
✅ Heartbeat continues working

## Full Documentation
See: `dev-tools/docs/e2e-test-guide.md`
