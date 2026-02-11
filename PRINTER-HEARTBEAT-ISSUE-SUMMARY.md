# Printer Heartbeat System - Issue Summary

**Date:** February 11, 2026  
**Status:** Configuration Issue Identified  
**Severity:** Medium - System functional but not connected to production

---

## Problem Statement

The printer service is running on the local machine, but heartbeats are not appearing in the production database. The production staff app at `https://staff.tabeza.co.ke/settings` shows the printer as "offline" even though the printer service is actively running.

---

## System Architecture

### Components Involved

1. **Printer Service** (Local)
   - Runs on venue computer at `localhost:8765`
   - Sends heartbeats every 30 seconds
   - Configuration stored in `config.json`

2. **Production API** (Cloud)
   - Hosted at `https://staff.tabeza.co.ke`
   - Endpoint: `/api/printer/heartbeat` (POST)
   - Receives heartbeats and stores in database

3. **Production Database** (Cloud)
   - Supabase PostgreSQL
   - Table: `printer_drivers`
   - Stores heartbeat records with timestamps

4. **Staff App UI** (Cloud)
   - Checks database for recent heartbeats
   - Shows "online" if heartbeat < 2 minutes old
   - Shows "offline" if no recent heartbeats

---

## Root Cause Analysis

### Current Configuration

The printer service `config.json` contains:
```json
{
  "barId": "94044336-927f-42ec-9d11-2026ed8a1bc9",
  "apiUrl": "http://localhost:3003",
  "driverId": "driver-MIHI-PC-1770655896151",
  "watchFolder": "C:\\Users\\mwene\\TabezaPrints"
}
```

### The Problem

**The printer service is configured to send heartbeats to `http://localhost:3003` (local development) instead of `https://staff.tabeza.co.ke` (production).**

This means:
- ✅ Printer service IS running
- ✅ Printer service IS configured with correct barId
- ✅ Printer service IS sending heartbeats every 30 seconds
- ❌ Heartbeats are being sent to localhost (which doesn't exist or isn't running)
- ❌ Production API never receives the heartbeats
- ❌ Production database has no heartbeat records
- ❌ Staff app shows printer as "offline"

---

## Why This Happened

### Initial Setup Flow

1. Printer service was initially configured during local development
2. Configuration was saved with `apiUrl: "http://localhost:3003"`
3. The service has been running with this configuration ever since
4. When accessing production (`https://staff.tabeza.co.ke`), the printer service still points to localhost

### Auto-Configure Button Issue

The production staff app has an "Auto-Configure Printer Service" button that should update the printer service configuration. However, there's a **mixed content security issue**:

- Production app runs on HTTPS (`https://staff.tabeza.co.ke`)
- Printer service runs on HTTP (`http://localhost:8765`)
- Modern browsers block HTTPS pages from making HTTP requests to localhost
- This is a security feature called "Mixed Content Blocking"

Therefore, the auto-configure button cannot reach the local printer service from the production HTTPS site.

---

## Evidence

### 1. Printer Service is Running
- Service is active on `localhost:8765`
- Status endpoint responds: `http://localhost:8765/api/status`
- Shows `configured: true` with barId present

### 2. Configuration Points to Wrong URL
```json
"apiUrl": "http://localhost:3003"  // ❌ Should be "https://staff.tabeza.co.ke"
```

### 3. Database Has No Heartbeats
- Production `printer_drivers` table is empty (or has old test data)
- No recent heartbeats for barId `94044336-927f-42ec-9d11-2026ed8a1bc9`

### 4. Browser Console Errors
When accessing production site:
```
Failed to load resource: the server responded with a status of 400 ()
```
This indicates the browser is blocking the HTTP request to localhost from HTTPS.

---

## Solution

### Immediate Fix (Manual Configuration)

**Option 1: Update config.json directly**
1. Stop the printer service (Ctrl+C)
2. Edit `packages/printer-service/config.json`
3. Change `"apiUrl": "http://localhost:3003"` to `"apiUrl": "https://staff.tabeza.co.ke"`
4. Save the file
5. Restart the printer service: `node index.js`

**Option 2: Use configuration script**
1. Run: `node packages/printer-service/configure-for-production.js`
2. Restart the printer service

### Long-term Fix (Code Changes Needed)

To make the auto-configure button work from production, we need to implement one of these approaches:

**Approach A: WebSocket Connection**
- Printer service establishes WebSocket connection to production
- Production can send configuration updates through WebSocket
- Bypasses mixed content restrictions

**Approach B: Local Configuration Page**
- User opens `http://localhost:8765/configure.html` in browser
- Page fetches barId from production API
- Configures printer service locally
- No mixed content issues

**Approach C: Manual Configuration Instructions**
- Provide clear instructions in production UI
- User manually updates config.json
- Simpler but less user-friendly

---

## Testing After Fix

Once the configuration is updated and printer service restarted:

1. **Verify heartbeats are being sent:**
   - Check printer service console logs
   - Should see: `✅ Heartbeat connection restored`

2. **Verify heartbeats reach production:**
   - Check production API logs (Vercel)
   - Should see POST requests to `/api/printer/heartbeat`

3. **Verify database receives heartbeats:**
   - Query `printer_drivers` table
   - Should see records with recent `last_heartbeat` timestamps

4. **Verify UI shows online status:**
   - Refresh `https://staff.tabeza.co.ke/settings`
   - Printer status should show "online" (green)

---

## Related Files

### Configuration
- `packages/printer-service/config.json` - Printer service configuration
- `packages/printer-service/configure-for-production.js` - Configuration script

### Code
- `packages/printer-service/index.js` - Printer service (heartbeat logic)
- `apps/staff/app/api/printer/heartbeat/route.ts` - Heartbeat API endpoint
- `apps/staff/app/api/printer/driver-status/route.ts` - Status check endpoint
- `apps/staff/app/api/printer/configure-service/route.ts` - Auto-configure endpoint
- `apps/staff/app/settings/page.tsx` - Settings UI with printer status

### Database
- `supabase/migrations/059_create_printer_drivers_table.sql` - Database schema

---

## Questions for Second Opinion

1. **Is the root cause analysis correct?**
   - Is the issue really just the wrong apiUrl in config.json?
   - Are there other factors we're missing?

2. **Is the mixed content blocking explanation accurate?**
   - Is this why the auto-configure button doesn't work from production?
   - Are there other security restrictions at play?

3. **What's the best long-term solution?**
   - WebSocket connection?
   - Local configuration page?
   - Something else entirely?

4. **Are there any other issues we should check?**
   - Network/firewall issues?
   - CORS configuration?
   - API endpoint deployment status?

---

## Additional Context

### Deployment Status
- ✅ Database migration 059 deployed to production
- ✅ API endpoints deployed to Vercel
- ✅ Staff app deployed with printer status UI
- ⏳ Code fix for database-first check on `new-settings` branch (not yet merged to main)

### Branch Status
- `main` branch: Has initial deployment (commit bffc627)
- `new-settings` branch: Has fix for mixed content issue (commit 0357fa2)
- Fix changes order of checks: database first, then localhost (only on localhost)

### User Environment
- Windows machine
- Printer service running from source: `node packages/printer-service/index.js`
- Accessing production site: `https://staff.tabeza.co.ke`
- Same machine (printer service and browser on same computer)
