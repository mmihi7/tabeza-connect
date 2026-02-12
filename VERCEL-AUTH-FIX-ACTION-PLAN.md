# Vercel Authentication Fix - Action Plan

## Current Situation

Your printer service is getting **401 Unauthorized** errors from Vercel:

```
❌ Heartbeat failed (attempt 1/3): Production heartbeat failed: 401
```

## Root Cause Confirmed

The test with `test-heartbeat-direct.js` shows that **Vercel Authentication is STILL ACTIVE**. The response contains:
- Status: 401 Unauthorized
- HTML page with "Authentication Required"
- SSO redirect cookies

This means the main "Vercel Authentication" toggle is still ON.

## The Fix (3 Steps)

### Step 1: Turn OFF Vercel Authentication

1. Go to: https://vercel.com/mwenes-projects/tabz-kikao/settings/deployment-protection

2. Look for the main toggle labeled **"Vercel Authentication"**

3. Turn it **OFF** (not just enable bypass - turn the whole thing OFF)

4. Click **Save** and wait for the green "Saved" confirmation

### Step 2: Wait for Propagation

- Wait **2-3 minutes** for Vercel's edge network to update
- Settings changes can take a moment to propagate globally

### Step 3: Test Again

Run the test script:

```bash
node test-heartbeat-direct.js
```

**Expected result:**
```
✅ SUCCESS - Heartbeat endpoint is working!
Status: 200 OK
```

**If you still get 401:**
- Wait another 2-3 minutes
- Try redeploying: `git commit --allow-empty -m "redeploy" && git push`
- Check if you're looking at the correct project in Vercel

## Alternative: Use Localhost for Development

If you can't disable Vercel Authentication right now, use localhost:

```bash
# Terminal 1: Start staff app locally
cd apps/staff
npm run dev

# Terminal 2: Configure printer service for localhost
set TABEZA_API_URL=http://localhost:3003
set TABEZA_BAR_ID=438c80c1-fe11-4ac5-8a48-2fc45104ba31
node packages/printer-service/index.js
```

This bypasses Vercel entirely and uses your local development server.

## Why This Happened

You enabled "Protection Bypass for Automation" but that only works when Vercel Authentication is ON. Since you want the printer service to work without tokens, you need to turn OFF Vercel Authentication completely.

## Verification Checklist

- [ ] Vercel Authentication toggle is OFF in dashboard
- [ ] Waited 2-3 minutes for propagation
- [ ] `node test-heartbeat-direct.js` returns 200 OK
- [ ] Printer service shows: `✅ Heartbeat sent successfully`
- [ ] No more 401 errors in printer service logs

## Next Steps After Fix

Once heartbeats work:

1. Restart printer service
2. Verify heartbeats every 30 seconds
3. Check database for `printer_drivers` records
4. Test print functionality

---

**Current Status:** Waiting for Vercel Authentication to be disabled  
**Action Required:** Turn OFF "Vercel Authentication" in Vercel dashboard  
**Test Command:** `node test-heartbeat-direct.js`
