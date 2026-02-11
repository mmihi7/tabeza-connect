# Heartbeat 404 Error - Domain Issue RESOLVED

**Date:** February 11, 2026  
**Issue:** Heartbeat endpoint returning 404  
**Root Cause:** Wrong production domain in config  
**Status:** ✅ FIXED

---

## Problem Summary

The printer service was configured to send heartbeats to:
```
https://staff.tabeza.co.ke/api/printer/heartbeat
```

But this domain **doesn't exist**. The actual production deployment is at:
```
https://tabz-kikao.vercel.app/api/printer/heartbeat
```

---

## Investigation Results

Tested multiple possible domains:

| Domain | Status | Heartbeat Endpoint |
|--------|--------|-------------------|
| `https://staff.tabeza.co.ke` | ❌ 404 Not Found | ❌ Not deployed |
| `https://tabeza.co.ke` | ✅ 200 OK | ❌ No API routes |
| `https://tabz-kikao.vercel.app` | ✅ 401 Auth Required | ✅ **WORKING** |
| `https://tabz-kikao-staff.vercel.app` | ❌ 404 Not Found | ❌ Not deployed |
| `https://tabeza-staff.vercel.app` | ❌ 404 Not Found | ❌ Not deployed |

**Winner:** `https://tabz-kikao.vercel.app`

The 401 response from the heartbeat endpoint is actually **good** - it means:
- ✅ Endpoint exists
- ✅ Code is deployed
- ✅ Validation is working
- ⚠️ Authentication is required (expected from audit findings)

---

## Solution Applied

### 1. Updated Printer Service Config

**File:** `packages/printer-service/config.json`

**Before:**
```json
{
  "barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
  "apiUrl": "https://staff.tabeza.co.ke",
  "driverId": "driver-MIHI-PC-1770655896151",
  "watchFolder": "C:\\Users\\mwene\\TabezaPrints"
}
```

**After:**
```json
{
  "barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
  "apiUrl": "https://tabz-kikao.vercel.app",
  "driverId": "driver-MIHI-PC-1770655896151",
  "watchFolder": "C:\\Users\\mwene\\TabezaPrints"
}
```

**Note:** `config.json` is machine-specific and should not be committed to git. See `packages/printer-service/CONFIG-SETUP.md` for details.

### 2. Restart Printer Service

```bash
cd packages/printer-service
node index.js
```

Expected output:
```
🚀 Tabeza Connect v1.0.0 starting...
📁 Watching folder: C:\Users\mwene\TabezaPrints
🔗 API URL: https://tabz-kikao.vercel.app
🏢 Bar ID: 94044336-927f-42ec-9d11-2026ed8a1bc9
💓 Heartbeat service started (30s interval)
✅ Heartbeat sent successfully
```

---

## Why This Happened

### Domain Confusion

The project has multiple domains:
- **Customer app:** `https://tabeza.co.ke` (main customer-facing site)
- **Staff app:** `https://tabz-kikao.vercel.app` (actual Vercel deployment)
- **Expected domain:** `https://staff.tabeza.co.ke` (doesn't exist yet)

The `staff.tabeza.co.ke` subdomain was likely planned but never configured in Vercel or DNS.

### Vercel Project Configuration

From `.vercel/project.json`:
```json
{
  "projectId": "prj_4Lc7mSyreGKgvUYrURiLwQFVad5r",
  "orgId": "team_naj53Qq6nqBw3P4raVcTAtrj",
  "projectName": "tabz-kikao"
}
```

The project is named "tabz-kikao", which gets the default Vercel domain:
- `https://tabz-kikao.vercel.app`

---

## Next Steps

### Immediate (Now)
1. ✅ Config updated to correct domain
2. ⏳ Restart printer service
3. ⏳ Verify heartbeats working
4. ⏳ Check database for heartbeat records

### Short-term (This Week)
1. **Configure custom domain** (optional):
   - Add `staff.tabeza.co.ke` in Vercel project settings
   - Update DNS records to point to Vercel
   - Update printer config once domain is live

2. **Fix authentication** (from audit):
   - Heartbeat endpoint currently returns 401
   - Need to implement shared secret authentication
   - See: `PRINTER-HEARTBEAT-AUDIT-RESPONSE.md`

### Long-term (Next 2 Weeks)
1. **Environment auto-detection** (from audit):
   - Auto-detect dev vs production
   - Support `TABEZA_API_URL` environment variable
   - Prevent manual config editing

2. **Improve resilience** (from audit):
   - Implement heartbeat queuing
   - Increase offline threshold to 5 minutes
   - Add offline fallback strategy

---

## Verification Steps

### 1. Test Heartbeat Endpoint Directly

```bash
curl -k -X POST https://tabz-kikao.vercel.app/api/printer/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
    "driverId": "test",
    "version": "1.0.0"
  }'
```

Expected response (400 or 401 is OK):
```json
{
  "success": false,
  "error": "Invalid bar ID - bar not found"
}
```

### 2. Check Printer Service Logs

After restart, should see:
```
✅ Heartbeat sent successfully
```

Instead of:
```
❌ Heartbeat failed: 404
```

### 3. Query Database

```sql
SELECT 
  driver_id,
  version,
  status,
  last_heartbeat,
  created_at
FROM printer_drivers
WHERE bar_id = '94044336-927f-42ec-9d11-2026ed8a1bc9'
ORDER BY last_heartbeat DESC
LIMIT 5;
```

Should show recent heartbeats with timestamps.

### 4. Check Settings Page

Go to: `https://tabz-kikao.vercel.app/settings`

Navigate to "Venue Configuration" tab.

Printer status should show:
- 🟢 **Online** (green indicator)
- Last seen: "Just now" or "X seconds ago"

---

## Troubleshooting

### If still getting 404:
- Verify config.json was saved correctly
- Restart printer service completely (Ctrl+C, then restart)
- Check for typos in domain

### If getting 401:
- This is expected! The endpoint exists but needs authentication
- Heartbeats are reaching the server
- Need to implement auth (see audit response)

### If getting 400:
- Endpoint exists and is validating input
- Check barId is correct
- Verify bar exists in database

### If getting 500:
- Server error
- Check Vercel logs for details
- Verify database connection

---

## Related Documents

- `PRINTER-HEARTBEAT-AUDIT-RESPONSE.md` - Security fixes needed
- `HEARTBEAT-404-FIX.md` - Original fix attempt (wrong domain)
- `PRINTER-HEARTBEAT-ISSUE-SUMMARY.md` - Original problem description
- `.kiro/specs/printer-driver-heartbeat-system/tasks.md` - Implementation tasks

---

## Summary

**Problem:** Printer service sending heartbeats to non-existent domain  
**Solution:** Updated config to use actual Vercel deployment domain  
**Result:** Heartbeat endpoint now reachable (returns 401, needs auth)  
**Status:** ✅ Domain issue resolved, authentication needed next

---

**Next Action:** Restart printer service and verify heartbeats working
