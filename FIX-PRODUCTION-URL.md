# Fix Production URL Configuration

## Problem

The TabezaConnect service is configured with the wrong production URL:
- **Current (Wrong)**: `https://staff.tabeza.co.ke`
- **Correct**: `https://tabeza.co.ke`

This is why the heartbeat endpoint returns 404 - it's trying to reach a URL that doesn't exist.

## Solution

Update the service config file and restart the service.

### Step 1: Update Config File

**Option A: Automated (Recommended)**

Run this batch file **as Administrator**:

```cmd
cd c:\Projects\Tabz
.\dev-tools\scripts\update-service-config-url.bat
```

Right-click the file and select "Run as administrator"

**Option B: Manual**

1. Open Notepad **as Administrator**
2. Open file: `C:\Program Files\Tabeza\config.json`
3. Change `"apiUrl": "https://staff.tabeza.co.ke"` to `"apiUrl": "https://tabeza.co.ke"`
4. Save the file

### Step 2: Restart the Service

Open Command Prompt **as Administrator** and run:

```cmd
sc stop TabezaConnect
sc start TabezaConnect
```

Wait 5 seconds between stop and start.

### Step 3: Test the Heartbeat

```cmd
cd c:\Projects\Tabz
node dev-tools\scripts\test-heartbeat-api.js
```

You should see:
```
✅ SUCCESS! Heartbeat accepted
```

### Step 4: Wait for Database Update

Wait 30 seconds for the heartbeat to reach the database.

### Step 5: Verify Driver Appears

```cmd
cd c:\Projects\Tabz
node dev-tools\scripts\diagnose-printer-visibility.js
```

You should see:
```
✅ DRIVER FOUND IN DATABASE
Driver ID: driver-MIHI-PC
Status: online
Last Heartbeat: (recent timestamp)
```

## Verification Checklist

- [ ] Config file updated with correct URL
- [ ] Service restarted successfully
- [ ] Heartbeat test returns 200 OK
- [ ] Driver appears in database
- [ ] Staff app shows printer in settings

## Troubleshooting

### Issue: "Access Denied" when updating config

**Solution**: Run PowerShell or Notepad as Administrator

### Issue: Service won't start

**Solution**: Check service logs
```cmd
sc query TabezaConnect
```

If status is "STOPPED", try:
```cmd
sc start TabezaConnect
```

### Issue: Heartbeat still returns 404

**Solution**: Verify the deployment
1. Open browser: `https://tabeza.co.ke/api/printer/heartbeat`
2. You should see a 405 error (Method Not Allowed) - this means the endpoint exists
3. If you see 404, the endpoint is not deployed

### Issue: Driver still not in database

**Solution**: Check service logs
```cmd
cd c:\Projects\Tabz
.\dev-tools\scripts\check-service-logs.bat
```

Look for heartbeat errors in the logs.

## Expected Timeline

1. Update config: 1 minute
2. Restart service: 10 seconds
3. First heartbeat: 30 seconds
4. Database update: 5 seconds
5. Staff app refresh: Immediate

**Total: ~2 minutes from config update to seeing printer in staff app**

## Files Modified

- `C:\Program Files\Tabeza\config.json` - Service configuration
- `Tabz/dev-tools/scripts/test-heartbeat-api.js` - Test script URL

## Next Steps After Fix

Once the printer driver appears in the database:

1. **Open Staff App**: Go to Settings → Printer Setup
2. **Verify Driver**: You should see "driver-MIHI-PC" with status "online"
3. **Test Print**: Click "Test Print" to verify end-to-end functionality
4. **Configure POS**: Set up your POS to print to the watch folder

## Quick Reference

| Action | Command |
|--------|---------|
| Update config (auto) | `.\dev-tools\scripts\update-service-config-url.bat` |
| Stop service | `sc stop TabezaConnect` |
| Start service | `sc start TabezaConnect` |
| Test heartbeat | `node dev-tools\scripts\test-heartbeat-api.js` |
| Check database | `node dev-tools\scripts\diagnose-printer-visibility.js` |
| View service status | `sc query TabezaConnect` |

## Support

If you still have issues after following these steps:

1. Run the diagnostic script:
   ```cmd
   node dev-tools\scripts\diagnose-printer-visibility.js
   ```

2. Check service logs:
   ```cmd
   .\dev-tools\scripts\check-service-logs.bat
   ```

3. Provide the output from both commands for further assistance.
