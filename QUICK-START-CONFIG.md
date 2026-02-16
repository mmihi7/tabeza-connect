# Quick Start: Fix Config Issue and Test

## Problem
You can't install/run TabezaService because of config issues.

## Solution (3 Steps)

### Step 1: Find Config Files
Open PowerShell and run:
```powershell
cd c:\Projects\Tabz
.\dev-tools\scripts\find-config-files.ps1
```

**This will show you:**
- Where config.json files exist
- What bar_id they contain
- Or tell you if no config exists

### Step 2: Create Fresh Config
Run:
```powershell
cd c:\Projects\Tabz
.\dev-tools\scripts\create-fresh-config.ps1
```

**This will:**
- Create a new config.json at `c:\Projects\TabezaConnect\config.json`
- Ask if you want to overwrite if one already exists
- Set the correct bar_id for testing

### Step 3: Start Service
Open Command Prompt and run:
```cmd
cd c:\Projects\TabezaConnect
TabezaService.exe
```

**Look for:**
- ✅ "Configuration loaded successfully"
- ✅ "Driver ID: driver-MIHI-PC" (no timestamp!)
- ✅ "Heartbeat sent successfully"

## That's It!

If you see those success messages, the service is working correctly.

## Verify in Database

Open another terminal and run:
```cmd
cd c:\Projects\Tabz
node dev-tools\scripts\identify-stale-drivers.js
```

**Expected:**
- 1 driver found
- Driver ID: `driver-MIHI-PC`
- Status: online
- Recent heartbeat

## If Something Goes Wrong

### Error: "barId already exists"
Run the cleanup script first:
```powershell
cd c:\Projects\Tabz
.\dev-tools\scripts\cleanup-tabeza-config.ps1
```
Then go back to Step 2.

### Error: "Config file not found"
Just run Step 2 - it will create the file.

### Error: "Access Denied"
Run PowerShell as Administrator.

## Full Documentation

- **Find config**: `WHERE-IS-CONFIG-FILE.md`
- **Fix barId error**: `FIX-BARID-ALREADY-EXISTS-ERROR.md`
- **Complete test guide**: `TASK-5-E2E-TEST-MANUAL-STEPS.md`
- **Reset config**: `dev-tools/docs/reset-tabeza-service-config.md`

## Scripts Available

| Script | Purpose |
|--------|---------|
| `find-config-files.ps1` | Find all config.json files |
| `create-fresh-config.ps1` | Create new config.json |
| `cleanup-tabeza-config.ps1` | Delete all config files |
| `identify-stale-drivers.js` | Check database for drivers |

All scripts are in: `c:\Projects\Tabz\dev-tools\scripts\`
