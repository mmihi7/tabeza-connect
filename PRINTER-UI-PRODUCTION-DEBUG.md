# Printer UI Not Showing in Production - Debug Guide

## Current Status
- ✅ Popos is configured correctly (venue_mode: basic, authority_mode: pos)
- ✅ Local dev shows printer UI
- ✅ Just deployed to Vercel
- ❌ Production still not showing printer UI

## Possible Causes

### 1. Browser Cache (Most Likely)
Production is serving cached version of the page.

**Fix:**
1. Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. Or clear browser cache completely
3. Or open in incognito/private window

### 2. Vercel Build Cache
Vercel might be serving a cached build.

**Fix:**
1. Go to Vercel Dashboard
2. Find the staff app deployment
3. Click "Redeploy" and check "Use existing Build Cache" is OFF
4. Or add `?nocache=1` to the URL to bypass CDN cache

### 3. Code Not Deployed
The PrinterStatusIndicator changes might not be in the deployed build.

**Check:**
1. Go to production URL
2. Open browser DevTools (F12)
3. Go to Sources tab
4. Search for "PrinterStatusIndicator" in the code
5. Verify the component exists

### 4. Environment Variables
Production might be missing required env vars.

**Check in Vercel Dashboard:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- All other `NEXT_PUBLIC_*` vars

## Quick Test Steps

### Step 1: Check Browser Console
1. Open production site: https://staff.tabeza.co.ke
2. Open DevTools (F12)
3. Go to Console tab
4. Look for any errors related to:
   - PrinterStatusIndicator
   - Component loading
   - API calls to `/api/printer/driver-status`

### Step 2: Check Network Tab
1. Stay in DevTools
2. Go to Network tab
3. Refresh page
4. Look for call to `/api/printer/driver-status`
5. If missing, component isn't rendering

### Step 3: Check React DevTools
1. Install React DevTools extension
2. Open production site
3. Look for `PrinterStatusIndicator` component in tree
4. If missing, conditional logic is hiding it

### Step 4: Verify Deployment
1. Check Vercel deployment logs
2. Verify build completed successfully
3. Check deployment timestamp matches your deploy time
4. Look for any build warnings/errors

## Expected Behavior

For Popos (venue_mode: basic, authority_mode: pos), the dashboard should show:

```
┌─────────────────────────────────────┐
│  Stats Cards (Revenue, Tabs, etc)  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  🖨️ Printer Service: Connected      │
│  [Refresh] [Test Print]             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  📋 Captain's Orders                │
│  (Unmatched receipts)               │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Tabs List                          │
└─────────────────────────────────────┘
```

## Debug Code to Add

Add this to the dashboard page temporarily to debug:

```typescript
// Add after the venueMode/authorityMode state
useEffect(() => {
  console.log('🔍 Dashboard Debug:', {
    venueMode,
    authorityMode,
    shouldShowPrinter: venueMode === 'basic' || (venueMode === 'venue' && authorityMode === 'pos'),
    barId: bar?.id,
    barName: bar?.name
  });
}, [venueMode, authorityMode, bar]);
```

This will log to console whether the printer UI should show.

## If Still Not Working

1. **Check the actual deployed code:**
   - View source of production page
   - Search for "PrinterStatusIndicator"
   - If not found, deployment didn't include the component

2. **Force a clean build:**
   ```bash
   # Locally
   cd apps/staff
   rm -rf .next
   cd ../..
   pnpm build:staff
   
   # Then redeploy to Vercel
   ```

3. **Check Vercel build logs:**
   - Look for any errors during build
   - Verify all files were included
   - Check if monorepo build is working correctly

## Contact Info

If none of this works, provide:
1. Screenshot of production dashboard
2. Browser console logs
3. Network tab showing API calls
4. Vercel deployment URL and timestamp
