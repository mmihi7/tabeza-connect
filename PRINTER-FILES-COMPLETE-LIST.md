# Complete Printer Integration File List

## Quick Diagnosis

**Run this first**: `test-printer-connection.bat`

This will tell you exactly what's wrong.

## All Files Involved

### 🔧 Printer Service (Local Backend)

#### Core Service
- `packages/printer-service/index.js` - Main service (port 8765)
- `packages/printer-service/package.json` - Dependencies

#### Configuration
- `packages/printer-service/config.json` - Saved Bar ID (created after configuration)

#### Public Files
- `packages/printer-service/public/configure.html` - Fallback config page

#### Helper Scripts
- `START-PRINTER-SERVICE.bat` - Easy start script (NEW)
- `test-printer-connection.bat` - Connection diagnostic (NEW)

### 🌐 Staff App API Routes

#### Printer API Endpoints
- `apps/staff/app/api/printer/driver-status/route.ts` - Status check & test print
- `apps/staff/app/api/printer/configure-service/route.ts` - Auto-configure
- `apps/staff/app/api/printer/relay/route.ts` - Receive print jobs
- `apps/staff/app/api/printer/acknowledge-print/` - Acknowledge received prints
- `apps/staff/app/api/printer/assign-receipt/` - Assign receipt to tab
- `apps/staff/app/api/printer/pending-prints/` - Get pending prints
- `apps/staff/app/api/printer/configure-local/` - Local configuration

### 🎨 UI Components

#### Settings Page
- `apps/staff/app/settings/page.tsx` - Main settings page with printer UI

#### Printer Components
- `apps/staff/components/PrinterStatusIndicator.tsx` - Status indicator component

### 📚 Documentation

#### Setup Guides
- `PRINTER-AUTO-CONFIGURE-COMPLETE.md` - Auto-config feature docs
- `PRINTER-SERVICE-STARTUP-GUIDE.md` - User guide for starting service
- `PRINTER-PRODUCTION-FIXES.md` - Production deployment fixes
- `DEPLOY-PRINTER-UI-NOW.md` - Deployment instructions
- `PRINTER-CONNECTION-AUDIT.md` - Connection troubleshooting (NEW)
- `QUICK-START-PRINTER.md` - Quick start guide (NEW)

#### Technical Docs
- `PRINTER-SERVICE-DETECTED.md` - Service detection implementation
- `PRINTER-UI-DEPLOYMENT-COMPLETE.md` - UI deployment summary
- `PRINTER-SERVICE-USER-GUIDE.md` - End-user guide
- `PRINTER-TEST-COMPLETE.md` - Testing documentation
- `RUN-PRINTER-SERVICE-FROM-SOURCE.md` - Running from source
- `CONFIGURE-PRINTER-FOR-LOCAL-DEV.md` - Local dev setup

### 🧪 Test Scripts

- `dev-tools/scripts/test-printer-service-connection.js` - Connection test
- `dev-tools/scripts/configure-printer-service-local.js` - Local config script

## Connection Chain

### When Everything Works (Local Dev)

```
1. Browser
   URL: http://localhost:3003/settings
   ↓
2. Settings Page Component
   File: apps/staff/app/settings/page.tsx
   Function: checkPrinterServiceStatus()
   ↓
3. Fetch API Call
   fetch('/api/printer/driver-status')
   ↓
4. Staff App API Route
   File: apps/staff/app/api/printer/driver-status/route.ts
   ↓
5. Proxy to Local Service
   fetch('http://localhost:8765/api/status')
   ↓
6. Printer Service
   File: packages/printer-service/index.js
   Endpoint: GET /api/status
   ↓
7. Response Chain (reverse)
   Printer Service → API Route → Settings Page → Browser
   ↓
8. UI Update
   Component: PrinterStatusIndicator.tsx
   Shows: "✅ Connected"
```

### When It Fails (Production)

```
1. Browser
   URL: https://staff.tabeza.co.ke/settings
   ↓
2. Settings Page Component
   (Same as above)
   ↓
3. Fetch API Call
   fetch('/api/printer/driver-status')
   ↓
4. Vercel Server API Route
   File: apps/staff/app/api/printer/driver-status/route.ts
   ↓
5. Proxy Attempt
   fetch('http://localhost:8765/api/status')
   ↓
6. ❌ FAILS HERE
   "localhost" on Vercel = Vercel's server
   Your printer service is on YOUR computer
   Network isolation prevents connection
   ↓
7. Error Response
   { error: "fetch failed" }
   ↓
8. UI Update
   Shows: "❌ Disconnected"
```

## Critical Files for Debugging

### 1. Check Printer Service is Running
**File**: `packages/printer-service/index.js`
**Check**: Terminal should show "✅ Tabeza Printer Service - Running"

### 2. Check API Route Exists
**File**: `apps/staff/app/api/printer/driver-status/route.ts`
**Check**: File should export GET and POST functions

### 3. Check Settings Page Calls API
**File**: `apps/staff/app/settings/page.tsx`
**Check**: Look for `checkPrinterServiceStatus()` function

### 4. Check Component Renders Status
**File**: `apps/staff/components/PrinterStatusIndicator.tsx`
**Check**: Look for status state and conditional rendering

## Environment Variables

### Printer Service
- `TABEZA_BAR_ID` - Bar ID (optional, can be configured via API)
- `TABEZA_API_URL` - API URL (default: https://staff.tabeza.co.ke)

### Staff App
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Supabase key
- `SUPABASE_SECRET_KEY` - Service role key (for relay endpoint)

## Ports Used

- **8765** - Printer service (local)
- **3003** - Staff app (local dev)
- **3002** - Customer app (local dev)

## Common File Issues

### Issue: "RefreshCw is not defined"
**File**: `apps/staff/app/settings/page.tsx`
**Fix**: Check line 5 has `RefreshCw` in imports
```typescript
import { ..., RefreshCw } from 'lucide-react';
```

### Issue: "404 on /api/printer/driver-status"
**File**: `apps/staff/app/api/printer/driver-status/route.ts`
**Fix**: Ensure file exists and exports GET function

### Issue: "fetch failed"
**Files**: All of them are fine!
**Fix**: You're on production, need to use localhost:3003

## How to Verify Each File

### 1. Printer Service
```bash
cd packages/printer-service
node index.js
# Should see: "✅ Tabeza Printer Service - Running"
```

### 2. API Route
```bash
# In browser or curl
curl http://localhost:8765/api/status
# Should see JSON response
```

### 3. Staff App
```bash
cd apps/staff
pnpm dev
# Should see: "ready - started server on 0.0.0.0:3003"
```

### 4. Full Chain
```bash
# Visit in browser
http://localhost:3003/settings
# Should see printer status indicator
```

## File Modification History

### Recently Modified
1. `apps/staff/app/settings/page.tsx` - Added RefreshCw import, conditional UI
2. `apps/staff/app/api/printer/configure-service/route.ts` - NEW auto-configure endpoint
3. `apps/staff/app/api/printer/driver-status/route.ts` - NEW status check endpoint
4. `packages/printer-service/index.js` - Improved startup messages

### Recently Created
1. `START-PRINTER-SERVICE.bat` - Easy start script
2. `test-printer-connection.bat` - Diagnostic script
3. `PRINTER-CONNECTION-AUDIT.md` - Troubleshooting guide
4. `QUICK-START-PRINTER.md` - Quick start guide
5. `DEPLOY-PRINTER-UI-NOW.md` - Deployment guide

## Next Steps for Audit

1. **Run diagnostic**: `test-printer-connection.bat`
2. **Check printer service**: Is it running? Check terminal
3. **Check staff app**: Is it running locally? Check port 3003
4. **Check URL**: Are you on localhost:3003 or production?
5. **Check browser console**: Any JavaScript errors?
6. **Check network tab**: What's the actual error from /api/printer/driver-status?

---

**Most Important Question**: Are you accessing `http://localhost:3003/settings` or `https://staff.tabeza.co.ke/settings`?

If production → That's why it's not working! Use localhost:3003 instead.
