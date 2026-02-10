# ✅ Printer Test Print - Complete Guide

**Date:** February 9, 2026  
**Status:** Printer service is configured, but test prints may not be reaching Captain's Orders

---

## 🎯 Current Status

### What's Working ✅
1. Printer service is running on port 8765
2. Printer service is configured with:
   - Bar ID: `ceb3a64e-b45d-4590-8929-09e660000659` (Naivas)
   - API URL: `http://localhost:3003`
   - Status: configured = true
3. Test print endpoint responds successfully
4. All code fixes have been applied

### What Needs Verification ⚠️
1. Is the staff app running on `localhost:3003`?
2. Are test prints reaching the `/api/printer/relay` endpoint?
3. Are unmatched receipts being created in the database?
4. Do they appear in Captain's Orders?

---

## 🧪 Complete Test Procedure

### Step 1: Verify Staff App is Running

**Check if staff app is running:**
```bash
# Open a NEW terminal (not in printer-service folder)
cd C:\Projects\Tabz
cd apps\staff
pnpm dev
```

**Expected output:**
```
▲ Next.js 15.x.x
- Local:        http://localhost:3003
- Ready in X.Xs
```

**IMPORTANT:** The staff app MUST be running on localhost:3003 for test prints to work!

---

### Step 2: Verify Printer Service is Running

The printer service is already running (Process ID: 24300).

**To check status:**
```bash
curl http://localhost:8765/api/status
```

**Expected response:**
```json
{
  "status": "running",
  "barId": "ceb3a64e-b45d-4590-8929-09e660000659",
  "configured": true
}
```

---

### Step 3: Send Test Print

**Option A: From Settings Page (Recommended)**
1. Go to `http://localhost:3003/settings`
2. Click "Venue Configuration" tab
3. Find the printer section
4. Click "Test Print" button

**Option B: Direct API Call**
```bash
curl -X POST http://localhost:8765/api/test-print ^
  -H "Content-Type: application/json" ^
  -d "{\"testMessage\":\"Test from command line\"}"
```

**Expected response:**
```json
{
  "success": true,
  "jobId": "test-1234567890",
  "message": "Test print sent successfully"
}
```

---

### Step 4: Check Printer Service Logs

Look at the printer service terminal window. You should see:

```
📄 Test print for bar: ceb3a64e-b45d-4590-8929-09e660000659 to http://localhost:3003
📤 Sending to cloud: http://localhost:3003/api/printer/relay
   Bar ID: ceb3a64e-b45d-4590-8929-09e660000659
   Document: Test Receipt
✅ Cloud response: Job ID test-1234567890
```

**If you see an error here, that's the problem!**

Common errors:
- `ECONNREFUSED` → Staff app not running
- `404` → Staff app running but relay endpoint not found
- `400 Missing required fields` → Data structure issue

---

### Step 5: Check Staff App Logs

Look at the staff app terminal window. You should see:

```
📥 Received print job from printer service: {
  driverId: 'driver-MIHI-PC-1770655896151',
  barId: 'ceb3a64e-b45d-4590-8929-09e660000659',
  documentName: 'Test Receipt',
  dataSize: 123,
  metadata: { jobId: 'test-1234567890', source: 'test' }
}
✅ Created unmatched receipt: abc-123-def-456
```

**If you don't see this, the relay endpoint isn't being reached!**

---

### Step 6: Check Captain's Orders

1. Go to `http://localhost:3003` (staff dashboard)
2. Look for "Captain's Orders" section
3. You should see a new unmatched receipt:
   - Document: "Test Receipt"
   - Time: Just now
   - Status: Pending

**If the receipt doesn't appear:**
- Check if unmatched_receipts table exists in database
- Check RLS policies allow viewing
- Check if you're logged in as staff for the correct venue

---

## 🐛 Troubleshooting

### Issue: "Test print sent successfully" but no receipt in Captain's Orders

**Diagnosis Steps:**

1. **Check if staff app is running:**
   ```bash
   curl http://localhost:3003/api/printer/relay
   ```
   Should return 405 (Method Not Allowed) - means endpoint exists
   
   If returns connection error → staff app not running

2. **Check printer service logs:**
   Look for the line: `📤 Sending to cloud: http://localhost:3003/api/printer/relay`
   
   If you see an error after this → problem with relay endpoint

3. **Check staff app logs:**
   Look for: `📥 Received print job from printer service`
   
   If you don't see this → request not reaching staff app

4. **Manually test relay endpoint:**
   ```bash
   # From C:\Projects\Tabz directory
   node test-relay-direct.js
   ```
   
   This will directly call the relay endpoint and show any errors

---

### Issue: Printer service says "Service not configured"

**Solution:**
The service IS configured (we verified this). The issue is the UI might be cached.

1. Refresh the settings page (Ctrl+R)
2. Check printer service status again
3. The "Test Print" button should appear

---

### Issue: "Cannot connect to printer service"

**Solution:**
The printer service is running (Process ID: 24300).

If you still see this error:
1. Check if another process is using port 8765
2. Restart the printer service:
   ```bash
   # Kill the process
   taskkill /PID 24300 /F
   
   # Start it again
   cd C:\Projects\Tabz\packages\printer-service
   node index.js
   ```

---

## 📊 Expected Flow

```
User clicks "Test Print"
    ↓
Browser → POST /api/printer/driver-status
    ↓
Staff App API → POST localhost:8765/api/test-print
    ↓
Printer Service validates configuration
    ↓
Printer Service creates test receipt
    ↓
Printer Service → POST localhost:3003/api/printer/relay
    ↓
Staff App API receives print data
    ↓
Staff App creates unmatched_receipt in database
    ↓
Staff App returns success
    ↓
Receipt appears in Captain's Orders ✅
```

---

## 🎯 Quick Checklist

Before testing, verify:

- [ ] Staff app running on localhost:3003
- [ ] Printer service running on localhost:8765
- [ ] Printer service configured (barId and apiUrl set)
- [ ] Logged into staff app as venue staff
- [ ] On the correct venue (Naivas or Popos)
- [ ] Captain's Orders section visible on dashboard

---

## 🔧 Manual Test Script

If automated test doesn't work, run this manually:

```bash
# 1. Check staff app is running
curl http://localhost:3003

# 2. Check printer service is running
curl http://localhost:8765/api/status

# 3. Send test print
curl -X POST http://localhost:8765/api/test-print ^
  -H "Content-Type: application/json" ^
  -d "{\"testMessage\":\"Manual test\"}"

# 4. Check if relay endpoint received it
# Look at staff app terminal logs

# 5. Query database directly
# Use Supabase dashboard to check unmatched_receipts table
```

---

## ✅ Success Criteria

Test is successful when:

1. ✅ Test print command returns success
2. ✅ Printer service logs show "Sending to cloud"
3. ✅ Staff app logs show "Received print job"
4. ✅ Staff app logs show "Created unmatched receipt"
5. ✅ Receipt appears in Captain's Orders
6. ✅ Receipt can be assigned to a tab

---

## 📝 Next Steps After Success

Once test prints are working:

1. Test with real POS receipts
2. Configure POS to print to the watch folder
3. Verify automatic receipt detection
4. Test receipt assignment to tabs
5. Test receipt matching logic

All the code is in place - we just need to verify the complete flow is working!
