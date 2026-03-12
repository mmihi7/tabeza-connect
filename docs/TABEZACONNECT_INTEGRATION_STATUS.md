# TabezaConnect Integration Status

## Summary
TabezaConnect v1.3.0 is installed and should now be communicating with the staff app. Here's what was fixed and what to verify.

---

## ✅ What Was Fixed

### 1. Printer Heartbeat API
**Created**: `apps/staff/app/api/printer/heartbeat/route.ts`
- Receives heartbeats from TabezaConnect every 30 seconds
- Updates `printer_drivers` table with connection status
- Tracks: online/offline status, version, last seen time

### 2. Printer Status UI Component
**Created**: `apps/staff/components/PrinterStatus.tsx`
- Shows real-time printer connection status
- Displays: Connected/Disconnected, last seen time, version
- Auto-updates via Supabase Realtime subscriptions

### 3. Receipt Ingestion API
**Already Exists**: `apps/staff/app/api/receipts/ingest/route.ts`
- Receives raw receipt data from TabezaConnect
- Saves to `raw_pos_receipts` table
- Triggers automatic parsing via database trigger

---

## 🔍 What to Verify

### Step 1: Check TabezaConnect Service Status
On the Windows machine where TabezaConnect is installed:

1. Open Services (`services.msc`)
2. Find "Tabeza POS Connect" service
3. Verify status is "Running"
4. Check "Log On" tab - should be "Local System"

### Step 2: Check TabezaConnect Logs
Navigate to: `C:\ProgramData\Tabeza\logs\`

Look for:
- ✅ "Starting Windows print spooler monitor..."
- ✅ "💓 Sending heartbeat to production..."
- ✅ "✅ Heartbeat sent successfully"
- ❌ Any error messages

### Step 3: Check Database Tables

**Check printer_drivers table:**
```sql
SELECT * FROM printer_drivers 
WHERE bar_id = 'YOUR_BAR_ID' 
ORDER BY last_heartbeat DESC;
```

Expected result:
- One row with `status = 'online'`
- `last_heartbeat` within last 60 seconds
- `driver_id` matching the Windows machine name

**Check raw_pos_receipts table:**
```sql
SELECT COUNT(*) FROM raw_pos_receipts 
WHERE bar_id = 'YOUR_BAR_ID';
```

Expected result:
- Count increases when you print a test receipt from POS

### Step 4: Test Receipt Capture

1. Print a test receipt from your POS system
2. Wait 5-10 seconds
3. Check `raw_pos_receipts` table for new entry
4. Check `pos_receipts` table for parsed receipt (if parsing is configured)

---

## 🚨 Common Issues & Solutions

### Issue 1: Heartbeat Not Received
**Symptoms**: No rows in `printer_drivers` table

**Possible Causes**:
1. Service not running
2. Wrong API URL configured
3. Firewall blocking outbound HTTPS
4. Wrong Bar ID

**Solution**:
```bash
# Check TabezaConnect config
cd "C:\Program Files\TabezaConnect"
type config.json

# Verify:
# - barId matches your venue
# - apiUrl points to correct staff app URL
```

### Issue 2: Receipts Not Uploading
**Symptoms**: Receipts in local queue but not in database

**Possible Causes**:
1. Network connectivity issues
2. API endpoint not accessible
3. Authentication/CORS issues

**Solution**:
```bash
# Check local queue
dir "C:\ProgramData\Tabeza\queue\pending"

# Check upload worker logs
type "C:\ProgramData\Tabeza\logs\upload-worker.log"
```

### Issue 3: Service Crashes on Startup
**Symptoms**: Service starts then immediately stops

**Possible Causes**:
1. Missing configuration
2. Permission issues accessing spooler
3. Port 8765 already in use

**Solution**:
```bash
# Check Windows Event Viewer
eventvwr.msc
# Navigate to: Windows Logs > Application
# Look for TabezaConnect errors
```

---

## 📊 Integration Architecture

```
POS System
    │
    ├─► Printer (instant, 0ms latency)
    │
    └─► Windows Spooler (C:\Windows\System32\spool\PRINTERS)
            │
            ▼
        TabezaConnect Service
            │
            ├─► Local Queue (C:\ProgramData\Tabeza\queue)
            │       │
            │       ▼
            │   Upload Worker (async, retry logic)
            │       │
            │       ▼
            ├─► POST /api/receipts/ingest
            │       │
            │       ▼
            │   raw_pos_receipts table
            │       │
            │       ▼
            │   Database Trigger
            │       │
            │       ▼
            │   pos_receipts table (parsed)
            │
            └─► POST /api/printer/heartbeat (every 30s)
                    │
                    ▼
                printer_drivers table
                    │
                    ▼
                Staff App UI (real-time)
```

---

## 🎯 Next Steps

### Immediate (Testing)
1. ✅ Verify heartbeat is being received
2. ✅ Verify printer shows as "Connected" in staff app
3. ✅ Print test receipt and verify it appears in database
4. ✅ Check parsing is working (if templates configured)

### Short-term (UI Integration)
1. Add `<PrinterStatus barId={barId} />` component to staff dashboard
2. Create "Unclaimed Receipts" view for staff to assign to tabs
3. Add receipt assignment workflow
4. Show assigned receipts in customer tab view

### Medium-term (Enhancements)
1. Add receipt parsing template generation UI
2. Implement AI fallback for parsing failures
3. Add receipt void/correction workflow
4. Create reporting dashboard for captured receipts

---

## 📞 Support

**If TabezaConnect is not connecting:**
1. Check service is running
2. Check logs in `C:\ProgramData\Tabeza\logs\`
3. Verify config in `C:\Program Files\TabezaConnect\config.json`
4. Test network connectivity to staff app URL
5. Check Windows Firewall isn't blocking outbound HTTPS

**If receipts are not uploading:**
1. Check local queue: `C:\ProgramData\Tabeza\queue\pending\`
2. Check upload worker logs
3. Verify `/api/receipts/ingest` endpoint is accessible
4. Check Supabase connection from staff app

---

**Last Updated**: February 19, 2026  
**TabezaConnect Version**: v1.3.0  
**Staff App**: Next.js 15 + Supabase
