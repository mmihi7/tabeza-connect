# Where is the config.json File?

## Quick Answer

The `config.json` file should be located at:
```
c:\Projects\TabezaConnect\config.json
```

This is the same directory where `TabezaService.exe` is located.

## How to Find It

### Option 1: Run the Search Script (Recommended)
Open PowerShell and run:
```powershell
cd c:\Projects\Tabz
.\dev-tools\scripts\find-config-files.ps1
```

This will:
- Search all common locations
- Show you where config.json files exist
- Display the bar_id from each file
- Tell you if no config file exists

### Option 2: Manual Search
Open PowerShell and run:
```powershell
Get-ChildItem -Path "c:\Projects\TabezaConnect" -Filter "config.json" -Recurse
```

### Option 3: Check with File Explorer
1. Open File Explorer
2. Navigate to: `c:\Projects\TabezaConnect`
3. Look for `config.json`
4. If you don't see it, enable "Show hidden files" in View options

## If Config File Doesn't Exist

If the config file doesn't exist, you need to create it.

### Create Config File (Easy Way)
Run this PowerShell script:
```powershell
cd c:\Projects\Tabz
.\dev-tools\scripts\create-fresh-config.ps1
```

This will create a fresh `config.json` at `c:\Projects\TabezaConnect\config.json`

### Create Config File (Manual Way)
1. Open Notepad
2. Copy this content:
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
3. Save as: `c:\Projects\TabezaConnect\config.json`
4. Make sure "Save as type" is "All Files" (not .txt)

## Understanding Config File Locations

TabezaConnect looks for config.json in this order:

### 1. Environment Variables (Highest Priority)
If these are set, config.json is ignored:
- `TABEZA_BAR_ID`
- `TABEZA_API_URL`
- `TABEZA_WATCH_FOLDER`

### 2. Next to the Executable
When running `TabezaService.exe`, it looks for:
```
c:\Projects\TabezaConnect\config.json
```

### 3. Installation Directory (If Installed as Service)
If installed as a Windows service:
```
C:\Program Files\TabezaConnect\config.json
```
or
```
C:\ProgramData\Tabeza\config.json
```

## Common Issues

### Issue: "Cannot install printer - barId already exists"

**Cause**: An old config.json file exists with a bar_id

**Solution**: Delete the old config and create a fresh one
```powershell
# Delete old config
Remove-Item "c:\Projects\TabezaConnect\config.json" -Force

# Create fresh config
cd c:\Projects\Tabz
.\dev-tools\scripts\create-fresh-config.ps1
```

### Issue: "Config file not found"

**Cause**: No config.json exists

**Solution**: Create one
```powershell
cd c:\Projects\Tabz
.\dev-tools\scripts\create-fresh-config.ps1
```

### Issue: "Access Denied" when creating config

**Cause**: Insufficient permissions

**Solution**: Run PowerShell as Administrator

### Issue: Multiple config files found

**Cause**: Old installations left config files behind

**Solution**: Delete all old configs and create a fresh one
```powershell
cd c:\Projects\Tabz
.\dev-tools\scripts\cleanup-tabeza-config.ps1
.\dev-tools\scripts\create-fresh-config.ps1
```

## Verify Config File

After creating the config, verify it exists:

```powershell
# Check if file exists
Test-Path "c:\Projects\TabezaConnect\config.json"

# Show file content
Get-Content "c:\Projects\TabezaConnect\config.json"

# Show just the bar_id
(Get-Content "c:\Projects\TabezaConnect\config.json" | ConvertFrom-Json).barId
```

## Next Steps

Once you have a valid config.json:

1. **Start the service**:
   ```cmd
   cd c:\Projects\TabezaConnect
   TabezaService.exe
   ```

2. **Verify it's working**:
   - Look for "✅ Configuration loaded successfully" in console
   - Look for "driver-MIHI-PC" (hostname-only, no timestamp)
   - Look for "✅ Heartbeat sent successfully"

3. **Check database**:
   ```cmd
   cd c:\Projects\Tabz
   node dev-tools\scripts\identify-stale-drivers.js
   ```

## Quick Reference

| Action | Command |
|--------|---------|
| Find config files | `.\dev-tools\scripts\find-config-files.ps1` |
| Create fresh config | `.\dev-tools\scripts\create-fresh-config.ps1` |
| Delete all configs | `.\dev-tools\scripts\cleanup-tabeza-config.ps1` |
| Verify config exists | `Test-Path "c:\Projects\TabezaConnect\config.json"` |
| Show config content | `Get-Content "c:\Projects\TabezaConnect\config.json"` |

## Still Can't Find It?

If you still can't find the config file:

1. **Search your entire C: drive** (this may take a while):
   ```powershell
   Get-ChildItem -Path "C:\" -Filter "config.json" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.DirectoryName -like "*Tabeza*" }
   ```

2. **Check Windows Registry** (if installed as service):
   ```powershell
   Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\TabezaConnect" -ErrorAction SilentlyContinue
   ```

3. **Ask for help** with the output from:
   ```powershell
   cd c:\Projects\Tabz
   .\dev-tools\scripts\find-config-files.ps1
   ```
