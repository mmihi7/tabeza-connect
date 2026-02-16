# Fix "BarID Already Exists" Error

## Problem
You're getting an error saying "there is already a barid" when trying to reinstall TabezaService.exe, even though you deleted all records from the `printer_drivers` table in Supabase.

## Root Cause
The bar_id is stored in a **local config.json file** on your machine, NOT in Supabase. The printer_drivers table only stores the driver registration - the bar_id configuration is local.

## Quick Fix

### Option 1: Run the Cleanup Script (Recommended)
Open PowerShell as Administrator and run:

```powershell
cd c:\Projects\Tabz
.\dev-tools\scripts\cleanup-tabeza-config.ps1
```

This will:
- Stop the TabezaConnect service if running
- Find and delete all config.json files
- Show you a summary of what was deleted

### Option 2: Manual Cleanup
Delete the config file manually:

```powershell
Remove-Item "c:\Projects\TabezaConnect\config.json" -Force -ErrorAction SilentlyContinue
Write-Host "✅ Config file deleted" -ForegroundColor Green
```

## After Cleanup

Once the old config is deleted, create a fresh one:

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
Write-Host "✅ Fresh config.json created!" -ForegroundColor Green
```

## Now You Can Test

After creating the fresh config:

1. **Start the service**:
   ```cmd
   cd c:\Projects\TabezaConnect
   TabezaService.exe
   ```

2. **Verify driver ID** (should be `driver-MIHI-PC` with no timestamp)

3. **Check database**:
   ```cmd
   cd c:\Projects\Tabz
   node dev-tools\scripts\identify-stale-drivers.js
   ```

## Understanding the Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Local Machine                                          │
│                                                         │
│  ┌──────────────────────────────────────┐              │
│  │ config.json (LOCAL FILE)             │              │
│  │ - barId: "438c80c1..."               │              │
│  │ - apiUrl: "https://..."              │              │
│  │ - watchFolder: "C:\..."              │              │
│  └──────────────────────────────────────┘              │
│                    ↓                                    │
│  ┌──────────────────────────────────────┐              │
│  │ TabezaService.exe                    │              │
│  │ - Reads config.json                  │              │
│  │ - Generates driver_id (hostname)     │              │
│  │ - Sends heartbeat to API             │              │
│  └──────────────────────────────────────┘              │
│                    ↓                                    │
└────────────────────┼────────────────────────────────────┘
                     ↓
         ┌───────────────────────┐
         │  Supabase Database    │
         │                       │
         │  printer_drivers      │
         │  - driver_id          │
         │  - bar_id             │
         │  - last_heartbeat     │
         │  - status             │
         └───────────────────────┘
```

**Key Points:**
- `config.json` is LOCAL (on your machine)
- `printer_drivers` table is REMOTE (in Supabase)
- Deleting database records doesn't delete local config
- You need to delete BOTH to start fresh

## Full Documentation
See: `dev-tools/docs/reset-tabeza-service-config.md`
