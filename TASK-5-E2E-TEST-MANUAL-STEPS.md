# Task 5: End-to-End Test - Manual Execution Required

## Status
Tasks 1-4 are **COMPLETE**. Task 5 requires manual execution due to system constraints.

## Why Manual Execution is Needed
The automated test requires:
1. Starting/stopping the TabezaService.exe process
2. Monitoring console output in real-time
3. Verifying driver ID format from console logs
4. Multiple restarts with timing delays

These operations are best performed manually to ensure accurate observation of the service behavior.

## What Has Been Prepared

### ✅ Completed Tasks
- **Task 1**: Driver ID generation fixed (no timestamp)
- **Task 2**: Stale drivers cleaned up
- **Task 3**: Cleanup job created
- **Task 4**: Staff app queries updated

### 📝 Test Documentation Created
1. **Comprehensive Test Guide**: `dev-tools/docs/e2e-test-guide.md`
   - Step-by-step instructions
   - Expected outputs
   - Success criteria
   - Troubleshooting guide

2. **Quick Instructions**: `E2E-TEST-INSTRUCTIONS.md`
   - Fast reference for testing
   - PowerShell commands ready to copy/paste

3. **Database Query Script**: `dev-tools/scripts/identify-stale-drivers.js`
   - Already tested and working
   - Shows all drivers for the test bar

## Manual Test Procedure

### Step 1: Create Config File
Open PowerShell as Administrator and run:

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
Write-Host "✅ Config file created at c:\Projects\TabezaConnect\config.json" -ForegroundColor Green
```

### Step 2: Open Two Terminal Windows

**Terminal 1** (for running the service):
```cmd
cd c:\Projects\TabezaConnect
```

**Terminal 2** (for database queries):
```cmd
cd c:\Projects\Tabz
```

### Step 3: Start Service (First Time)

In **Terminal 1**, run:
```cmd
TabezaService.exe
```

**Watch for**:
- ✅ Service starts successfully
- ✅ Driver ID shown: `driver-MIHI-PC` (or `driver-<YOUR_HOSTNAME>`)
- ❌ NO timestamp like `driver-MIHI-PC-1234567890123`

**Wait 30 seconds** for heartbeat to be sent.

### Step 4: Check Database

In **Terminal 2**, run:
```cmd
node dev-tools\scripts\identify-stale-drivers.js
```

**Expected output**:
```
✅ Active drivers (heartbeat < 5 min): 1
❌ Stale drivers (heartbeat > 5 min): 0

Driver: driver-MIHI-PC
Status: online
Last heartbeat: 2026-02-15T... (recent)
```

**Verify**:
- ✅ Only ONE driver record
- ✅ Driver ID is `driver-MIHI-PC` (no timestamp)
- ✅ Status is `online`
- ✅ Heartbeat is recent

### Step 5: Restart Service

In **Terminal 1**:
1. Press `Ctrl+C` to stop the service
2. Wait for graceful shutdown message
3. **Wait 10 seconds**
4. Run `TabezaService.exe` again

**Watch for**:
- ✅ Service starts successfully
- ✅ **SAME** driver ID: `driver-MIHI-PC`
- ❌ NOT a different ID

**Wait 30 seconds** for heartbeat to be sent.

### Step 6: Check Database Again

In **Terminal 2**, run:
```cmd
node dev-tools\scripts\identify-stale-drivers.js
```

**Expected output**:
```
✅ Active drivers (heartbeat < 5 min): 1
❌ Stale drivers (heartbeat > 5 min): 0

Driver: driver-MIHI-PC
Status: online
Last heartbeat: 2026-02-15T... (UPDATED - newer than before)
```

**Verify**:
- ✅ Still only ONE driver record (not 2!)
- ✅ Same driver ID: `driver-MIHI-PC`
- ✅ Heartbeat timestamp is UPDATED (newer)
- ✅ No duplicate records

### Step 7: Stop Service

In **Terminal 1**:
- Press `Ctrl+C` to stop the service

## Success Criteria Checklist

Mark each item after verification:

- [ ] **5.1** - Service started successfully
- [ ] **5.2** - Driver ID is hostname-only (no timestamp)
- [ ] **5.3** - Service restarted successfully
- [ ] **5.4** - Same driver record updated (heartbeat timestamp changed)
- [ ] **5.5** - No new records created (still only 1 driver)

## Expected Results

### ✅ PASS Criteria
- Driver ID format: `driver-MIHI-PC` (no timestamp)
- Database shows exactly 1 driver record
- Heartbeat timestamp updates after restart
- No duplicate driver records created

### ❌ FAIL Indicators
- Driver ID has timestamp: `driver-MIHI-PC-1234567890123`
- Multiple driver records in database
- New record created on restart
- Heartbeat not updating

## Troubleshooting

### Issue: Service won't start
**Solution**: Check that config.json was created correctly at `c:\Projects\TabezaConnect\config.json`

### Issue: Multiple drivers in database
**Solution**: The fix may not have been applied correctly. Check:
1. `TabezaConnect/src/service/index.js` - verify generateDriverId() has no timestamp
2. Rebuild: `cd c:\Projects\TabezaConnect && pkg src\service\index.js --target node18-win-x64 --output TabezaService.exe`

### Issue: Driver ID still has timestamp
**Solution**: The service executable wasn't rebuilt. Run:
```cmd
cd c:\Projects\TabezaConnect
pkg src\service\index.js --target node18-win-x64 --output TabezaService.exe
```

## After Testing

Once all success criteria are met:
1. Stop the service (Ctrl+C in Terminal 1)
2. Mark all subtasks as complete
3. Document any issues encountered
4. Proceed to production deployment if all tests pass

## Next Steps After Task 5

If all tests pass:
1. Deploy updated TabezaService.exe to production
2. Monitor for 24 hours
3. Verify no new stale drivers accumulate
4. Confirm cleanup job runs successfully

## Documentation References

- **Full Test Guide**: `dev-tools/docs/e2e-test-guide.md`
- **Quick Instructions**: `E2E-TEST-INSTRUCTIONS.md`
- **Requirements**: `.kiro/specs/printer-drivers-table/requirements.md`
- **Design**: `.kiro/specs/printer-drivers-table/design.md`
- **Tasks**: `.kiro/specs/printer-drivers-table/tasks.md`

## Notes

This manual test is necessary to verify the fix works correctly before production deployment. The test should take approximately 5-10 minutes to complete.

**Important**: Do not skip this test. It verifies the core functionality of the driver ID fix and prevents stale driver accumulation in production.
