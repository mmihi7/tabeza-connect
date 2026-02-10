# ✅ Printer Auto-Configure Button Fix

**Date:** February 9, 2026  
**Issue:** Auto-configure button not showing even when printer service is detected

---

## 🔍 Root Cause

The settings page was checking for `data.isOnline` but the API returns `data.status === 'running'`.

**File:** `apps/staff/app/settings/page.tsx`  
**Line:** ~206

### Before (Broken):
```typescript
const data = await response.json();
setPrinterServiceStatus(data.isOnline ? 'online' : 'offline');
```

### After (Fixed):
```typescript
const data = await response.json();
// Check if printer service is running (status === 'running' means it's online)
setPrinterServiceStatus(data.status === 'running' ? 'online' : 'offline');
```

---

## 🎯 How It Works

### API Response Structure
The `/api/printer/driver-status` GET endpoint returns:
```json
{
  "installed": true,
  "status": "running",
  "version": "1.0.0",
  "printerName": "Tabeza Receipt Printer",
  "lastSeen": "2026-02-09T...",
  "message": "Tabeza printer drivers are installed and running"
}
```

### Settings Page Logic
1. Page loads → calls `checkPrinterServiceStatus()`
2. Fetches `/api/printer/driver-status`
3. If `data.status === 'running'` → sets `printerServiceStatus = 'online'`
4. If `printerServiceStatus === 'online'` → shows auto-configure button
5. Auto-configure button only visible if `printerRequired === true`

---

## ✅ When Auto-Configure Button Shows

The button appears when ALL of these conditions are met:

1. **Venue requires printer** (`printer_required = true` in database)
   - Always true for `venue_mode = 'basic'`
   - True for `venue_mode = 'venue'` with `authority_mode = 'pos'`

2. **Printer service is detected** (`printerServiceStatus === 'online'`)
   - Printer service running on localhost:8765
   - `/api/status` endpoint responding

3. **User is on Venue Configuration tab** (Settings page)

---

## 🧪 Testing Steps

### Step 1: Verify Venue Configuration
Run this to check your venue settings:
```bash
node dev-tools/scripts/check-printer-config.js
```

Expected output for venues that should show printer setup:
```
Venue Mode: basic
Authority Mode: pos
Printer Required: ✅ Yes
Should Show Printer Setup: ✅ Yes
```

### Step 2: Start Printer Service
```bash
cd packages/printer-service
node index.js
```

Expected output:
```
✅ Tabeza Printer Service - Running
📍 Service Status:
   • Port: 8765
   • Bar ID: ⚠️  NOT CONFIGURED
   • API URL: http://localhost:3003 🏠 (LOCAL)
```

### Step 3: Open Settings Page
1. Go to `http://localhost:3003/settings`
2. Click "Venue Configuration" tab
3. Page should automatically check printer status

### Step 4: Verify Button Appears
You should see:
```
✅ Service Running - Ready to Configure

The printer service is running! Click the button below to connect it to your venue:

[Auto-Configure Printer Service]
```

### Step 5: Click Auto-Configure
1. Click the button
2. Should see success message
3. Printer service terminal should show configuration saved

### Step 6: Test Print
1. Click "Test Print" button (appears after configuration)
2. Should succeed without errors
3. Receipt should appear in Captain's Orders

---

## 🐛 Troubleshooting

### Button Still Not Showing

**Check 1: Is printer required for your venue?**
```bash
node dev-tools/scripts/check-printer-config.js
```
Look for: `Printer Required: ✅ Yes`

**Check 2: Is printer service running?**
```bash
curl http://localhost:8765/api/status
```
Should return JSON with `"status": "running"`

**Check 3: Refresh the page**
The status check runs on page load. After starting the printer service, refresh the settings page.

**Check 4: Check browser console**
Open DevTools → Console tab
Look for errors from `/api/printer/driver-status`

**Check 5: Check network tab**
Open DevTools → Network tab
Look for `/api/printer/driver-status` request
Should return 200 with `"status": "running"`

### Button Shows But Configuration Fails

This means the printer service is detected but configuration is failing. Check:

1. **Printer service logs** - Look for configuration request
2. **Browser console** - Look for error messages
3. **Network tab** - Check `/api/printer/configure-service` response

---

## 📊 Configuration Matrix

| Venue Mode | Authority Mode | Printer Required | Shows Printer Setup | Shows Auto-Configure |
|------------|----------------|------------------|---------------------|---------------------|
| Basic      | POS            | ✅ Yes           | ✅ Yes              | ✅ Yes (if detected) |
| Venue      | POS            | ✅ Yes           | ✅ Yes              | ✅ Yes (if detected) |
| Venue      | Tabeza         | ❌ No            | ❌ No               | ❌ No               |

---

## 🎯 Summary

**What was fixed:**
- Changed status check from `data.isOnline` to `data.status === 'running'`

**What this enables:**
- Auto-configure button now appears when printer service is detected
- Button only shows for venues that require printer integration
- Proper environment detection (localhost vs production)

**Next steps after this fix:**
1. Refresh settings page after starting printer service
2. Click "Auto-Configure Printer Service"
3. Click "Test Print" to verify
4. Check Captain's Orders for test receipt

All fixes are now complete and ready for testing!
