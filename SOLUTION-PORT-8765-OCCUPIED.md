# Solution: Port 8765 Occupied - Cannot Start TabezaService

## Problem
Port 8765 is persistently occupied, preventing TabezaService.exe from starting. This means:
- No heartbeat is sent to Supabase
- No driver record is created in the database
- Staff app cannot see the printer

## Root Cause
Multiple TabezaService.exe instances are running, or zombie processes are holding the port.

## Solution: Kill Everything and Start Fresh

### Step 1: Run the Kill-All-And-Start Script

```cmd
cd c:\Projects\Tabz
.\dev-tools\scripts\kill-all-tabeza-and-start.bat
```

This script will:
1. Kill ALL TabezaService.exe processes
2. Kill ANY process using port 8765
3. Wait 3 seconds for ports to be released
4. Verify port 8765 is free
5. Start TabezaService.exe in a new window

### Step 2: Verify Service Started

You should see a new window open with:
```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🔗 Tabeza Connect - Running                             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

📍 Service Status:
   • Port: 8765
   • Driver ID: driver-MIHI-PC
   • Bar ID: 438c80c1-fe11-4ac5-8a48-2fc45104ba31
   • API URL: https://staff.tabeza.co.ke
   • Watch Folder: C:\Users\mwene\TabezaPrints

✅ Configuration Complete!
```

### Step 3: Wait for First Heartbeat

Wait 30-60 seconds for the first heartbeat to be sent. You should see:
```
💓 Sending heartbeat to production: https://staff.tabeza.co.ke
✅ Heartbeat sent successfully
```

### Step 4: Verify Driver in Database

```cmd
cd c:\Projects\Tabz
node dev-tools\scripts\diagnose-printer-visibility.js
```

Expected output:
```
✅ Found 1 driver(s) in database

Driver: driver-MIHI-PC
  Bar ID: 438c80c1-fe11-4ac5-8a48-2fc45104ba31
  Status: 🟢 ACTIVE (last heartbeat: 15 seconds ago)
  Version: 1.0.0
```

### Step 5: Check Staff App

Open the staff app and navigate to Settings → Printer Drivers. You should now see:
- Driver ID: driver-MIHI-PC
- Status: Active
- Last Heartbeat: Just now

## If Port is Still Occupied After Script

If the script reports "Port 8765 is still in use", you have two options:

### Option A: Find and Kill the Stubborn Process Manually

```cmd
netstat -ano | findstr :8765
```

This will show something like:
```
TCP    0.0.0.0:8765    0.0.0.0:0    LISTENING    4332
```

The last number (4332) is the PID. Kill it:
```cmd
taskkill /F /PID 4332
```

Then run the script again.

### Option B: Restart Your Computer

This is the nuclear option but guaranteed to work:
1. Restart your computer
2. After restart, run: `cd c:\Projects\TabezaConnect && .\TabezaService.exe`
3. Wait 30 seconds
4. Verify with diagnostic script

## Prevention: Only Run One Instance

To prevent this issue in the future:
1. Only run TabezaService.exe ONCE
2. Keep the window open (don't close and reopen)
3. If you need to restart, use Ctrl+C to stop it first
4. Or use the kill-all script before starting again

## Troubleshooting

### Service starts but no heartbeat
Check the service window for errors. Common issues:
- Invalid config.json (should have barId, apiUrl, watchFolder)
- Network connectivity issues
- Firewall blocking outbound connections

### Heartbeat sent but not in database
Check the API URL in config.json:
```json
{
  "barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
  "apiUrl": "https://staff.tabeza.co.ke",
  "watchFolder": "C:\\Users\\mwene\\TabezaPrints"
}
```

### Driver appears but shows as inactive
The driver is considered active if heartbeat was received within the last 5 minutes. If it shows as inactive:
- Check if the service window is still open
- Check for error messages in the service window
- Restart the service using the kill-all script

## Success Criteria

You know everything is working when:
1. ✅ TabezaService.exe is running (window is open)
2. ✅ Heartbeat messages appear every 30 seconds
3. ✅ Diagnostic script shows "Found 1 driver(s) in database"
4. ✅ Driver status is "ACTIVE"
5. ✅ Staff app shows the printer in Settings → Printer Drivers
