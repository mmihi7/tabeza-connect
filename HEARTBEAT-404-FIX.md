# Heartbeat 404 Error - Fix Guide

**Error:** `❌ Heartbeat failed: 404`  
**Cause:** Heartbeat API endpoint not deployed to production  
**Solution:** Merge `new-settings` branch to `main`

---

## Problem

The printer service is sending heartbeats to:
```
https://staff.tabeza.co.ke/api/printer/heartbeat
```

But getting **404 Not Found** because:
1. The heartbeat endpoint code exists on `new-settings` branch
2. The `new-settings` branch hasn't been merged to `main` yet
3. Vercel only deploys from `main` branch
4. Therefore, production doesn't have the endpoint

---

## Solution Steps

### Step 1: Merge new-settings to main

```bash
# Switch to main branch
git checkout main

# Merge new-settings
git merge new-settings

# Push to GitHub (triggers Vercel deployment)
git push origin main
```

### Step 2: Wait for Vercel Deployment

- Vercel will automatically detect the push to `main`
- Deployment usually takes 2-5 minutes
- Monitor at: https://vercel.com/your-team/staff-app/deployments

### Step 3: Verify Endpoint Exists

After deployment completes, test the endpoint:

```bash
curl -X POST https://staff.tabeza.co.ke/api/printer/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "barId": "94044336-927f-42ec-9d11-2026ed8a1bc9",
    "driverId": "driver-test",
    "version": "1.0.0"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Heartbeat received",
  "driver": {
    "id": "driver-test",
    "version": "1.0.0",
    "status": "online",
    "lastHeartbeat": "2026-02-11T..."
  }
}
```

### Step 4: Restart Printer Service

Once the endpoint is deployed:

1. Stop the printer service (Ctrl+C)
2. Restart it:
   ```bash
   node packages/printer-service/index.js
   ```
3. Watch for successful heartbeats:
   ```
   ✅ Heartbeat connection restored
   ```

---

## What Gets Deployed

When you merge to `main`, these files will be deployed:

1. **Heartbeat API Endpoint**
   - `apps/staff/app/api/printer/heartbeat/route.ts`
   - Receives heartbeats from printer service
   - Stores in `printer_drivers` table

2. **Driver Status API Endpoint**
   - `apps/staff/app/api/printer/driver-status/route.ts`
   - Checks if printer is online (heartbeat < 2 min)
   - Used by settings page

3. **Configure Service API Endpoint**
   - `apps/staff/app/api/printer/configure-service/route.ts`
   - Auto-configures printer with barId
   - Used by "Auto-Configure" button

4. **Updated Settings Page**
   - `apps/staff/app/settings/page.tsx`
   - Shows printer status
   - Database-first check (fixes mixed content issue)

---

## Verification Checklist

After deployment:

- [ ] Heartbeat endpoint returns 200 (not 404)
- [ ] Printer service shows: `✅ Heartbeat connection restored`
- [ ] Database has records in `printer_drivers` table
- [ ] Settings page shows printer as "online"
- [ ] No more 404 errors in printer service logs

---

## Troubleshooting

### If still getting 404 after merge:

1. **Check Vercel deployment status:**
   - Go to Vercel dashboard
   - Verify deployment completed successfully
   - Check deployment logs for errors

2. **Check if endpoint was included in build:**
   ```bash
   # In Vercel deployment logs, look for:
   ✓ Compiled /api/printer/heartbeat
   ```

3. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R
   - Or clear cache completely

4. **Verify branch was actually merged:**
   ```bash
   git log main --oneline -5
   # Should show commits from new-settings
   ```

### If heartbeats still fail after endpoint is live:

1. **Check printer service config:**
   ```bash
   # Should point to production
   cat packages/printer-service/config.json
   # apiUrl should be: "https://staff.tabeza.co.ke"
   ```

2. **Check barId is valid:**
   - Verify barId exists in database
   - Check for typos in config.json

3. **Check network connectivity:**
   ```bash
   # Test if you can reach production
   curl https://staff.tabeza.co.ke/api/health
   ```

---

## Timeline

- **Merge to main:** 1 minute
- **Vercel deployment:** 2-5 minutes
- **Endpoint available:** Immediately after deployment
- **Heartbeats working:** Within 30 seconds of restart

**Total time:** ~5-10 minutes

---

## Next Steps After Fix

Once heartbeats are working:

1. **Verify in database:**
   ```sql
   SELECT * FROM printer_drivers 
   WHERE bar_id = '94044336-927f-42ec-9d11-2026ed8a1bc9'
   ORDER BY last_heartbeat DESC;
   ```

2. **Check settings page:**
   - Go to https://staff.tabeza.co.ke/settings
   - Navigate to "Venue Configuration" tab
   - Printer status should show "online" (green)

3. **Monitor for 24 hours:**
   - Watch for any heartbeat failures
   - Check database for consistent heartbeats
   - Verify no 404 errors

4. **Address security issues:**
   - Implement authentication (from audit response)
   - Add environment auto-detection
   - See: `PRINTER-HEARTBEAT-AUDIT-RESPONSE.md`

---

**Status:** Ready to merge  
**Branch:** new-settings → main  
**Action:** Run merge commands above
