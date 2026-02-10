# Printer Connection Audit - Complete File List

## The Problem

Printer service is running, but Settings page shows "Disconnected" with error: `fetch failed`

## Critical Question: Where Are You Accessing Settings?

### ❌ If you're on: `https://staff.tabeza.co.ke/settings`
**This will NOT work!** Here's why:
- Production Vercel server is trying to connect to `localhost:8765`
- But "localhost" on Vercel's server is Vercel's server, not your computer
- Your printer service is running on YOUR computer
- Vercel can't reach your local computer

### ✅ If you're on: `http://localhost:3003/settings`
**This SHOULD work!** Because:
- Your browser is on your computer
- Your printer service is on your computer
- Both are on the same "localhost"

## Solution

You need to run the Staff app **locally** to test the printer service:

```bash
# Terminal 1: Start printer service
cd packages/printer-service
node index.js

# Terminal 2: Start staff app
cd apps/staff
npm run dev
# or
pnpm dev

# Then visit: http://localhost:3003/settings
```

## All Files Involved in Printer Connection

### 1. Printer Service (Backend - Runs Locally)
```
packages/printer-service/
├── index.js                    ← Main service file (runs on port 8765)
├── package.json                ← Dependencies
└── public/
    └── configure.html          ← Fallback config page
```

**Key Endpoints**:
- `GET /api/status` - Health check
- `POST /api/configure` - Receives Bar ID configuration
- `POST /api/test-print` - Test print endpoint

### 2. Staff App API Routes (Proxy Layer)
```
apps/staff/app/api/printer/
├── driver-status/
│   └── route.ts               ← Checks if service is running (GET/POST)
├── configure-service/
│   └── route.ts               ← Auto-configure endpoint (POST)
└── relay/
    └── route.ts               ← Receives print jobs from service (POST)
```

**What they do**:
- `driver-status` → Proxies to `http://localhost:8765/api/status`
- `configure-service` → Proxies to `http://localhost:8765/api/configure`
- `relay` → Receives print data and creates unmatched receipts

### 3. Settings Page UI
```
apps/staff/app/settings/page.tsx
```

**Key Functions**:
- `checkPrinterServiceStatus()` - Calls `/api/printer/driver-status`
- `handleAutoConfigurePrinter()` - Calls `/api/printer/configure-service`
- Conditional UI based on `printerServiceStatus` state

### 4. Printer Status Component
```
apps/staff/components/PrinterStatusIndicator.tsx
```

**What it does**:
- Polls `/api/printer/driver-status` every 10 seconds
- Shows visual status (Connected/Disconnected)
- Provides "Test Print" button

## Connection Flow Diagram

### ✅ WORKING (Local Development):
```
Browser (localhost:3003)
    ↓ fetch('/api/printer/driver-status')
Staff App (localhost:3003)
    ↓ fetch('http://localhost:8765/api/status')
Printer Service (localhost:8765)
    ↓ responds with status
Staff App
    ↓ returns status to browser
Browser shows "Connected" ✅
```

### ❌ NOT WORKING (Production):
```
Browser (staff.tabeza.co.ke)
    ↓ fetch('/api/printer/driver-status')
Vercel Server (staff.tabeza.co.ke)
    ↓ fetch('http://localhost:8765/api/status')
    ↓ "localhost" = Vercel's server, not your computer
    ✗ Connection refused / fetch failed
Vercel Server
    ↓ returns error
Browser shows "Disconnected" ❌
```

## Why Production Can't Work (Yet)

The printer service runs on the **venue's local computer**. Production Vercel can't reach it because:

1. **Network Isolation**: Vercel servers are in the cloud, your computer is behind a router/firewall
2. **localhost means different things**:
   - On your computer: `localhost` = your computer
   - On Vercel: `localhost` = Vercel's server
3. **No direct connection**: Vercel can't make HTTP requests to your home/office computer

## How to Test Locally

### Step 1: Start Printer Service
```bash
# Option A: Use the batch file
START-PRINTER-SERVICE.bat

# Option B: Manual
cd packages/printer-service
node index.js
```

**Expected output**:
```
✅ Tabeza Printer Service - Running
Port: 8765
Bar ID: ⚠️  NOT CONFIGURED
```

### Step 2: Start Staff App Locally
```bash
# In a NEW terminal
cd apps/staff
pnpm dev
```

**Expected output**:
```
ready - started server on 0.0.0.0:3003
```

### Step 3: Open Local Settings
1. Open browser
2. Go to: `http://localhost:3003/settings`
3. Navigate to "Venue Configuration" tab
4. Should show: "✅ Service Running - Ready to Configure"

### Step 4: Test Connection
```bash
# In a third terminal, test the connection
curl http://localhost:8765/api/status
```

**Expected response**:
```json
{
  "status": "running",
  "version": "1.0.0",
  "printerName": "Tabeza Receipt Printer",
  "timestamp": "2026-02-09T...",
  "barId": "",
  "driverId": "driver-...",
  "watchFolder": "C:\\Users\\...\\TabezaPrints",
  "configured": false
}
```

## Debugging Checklist

### ✅ Printer Service Running?
```bash
# Check if port 8765 is listening
netstat -ano | findstr :8765
```

Should show something like:
```
TCP    0.0.0.0:8765    0.0.0.0:0    LISTENING    12345
```

### ✅ Staff App Running Locally?
```bash
# Check if port 3003 is listening
netstat -ano | findstr :3003
```

Should show:
```
TCP    0.0.0.0:3003    0.0.0.0:0    LISTENING    67890
```

### ✅ Can Browser Reach Printer Service?
Open in browser: `http://localhost:8765/api/status`

Should see JSON response with service status.

### ✅ Can Staff App Reach Printer Service?
```bash
# From staff app directory
curl http://localhost:8765/api/status
```

Should see JSON response.

## Common Issues

### Issue 1: "fetch failed" on localhost:3003
**Cause**: Printer service not running
**Fix**: Start printer service first

### Issue 2: "fetch failed" on staff.tabeza.co.ke
**Cause**: Trying to use production with local service
**Fix**: Use localhost:3003 instead

### Issue 3: Port 8765 already in use
**Cause**: Another instance running
**Fix**: 
```bash
# Find process using port 8765
netstat -ano | findstr :8765
# Kill the process (replace PID with actual number)
taskkill /PID <PID> /F
```

### Issue 4: Staff app not starting
**Cause**: Dependencies not installed
**Fix**:
```bash
cd apps/staff
pnpm install
pnpm dev
```

## Files to Check for Errors

### 1. Printer Service Console
Look for:
- ✅ "Tabeza Printer Service - Running"
- ✅ "Port: 8765"
- ❌ Any error messages

### 2. Staff App Console
Look for:
- ✅ "ready - started server on 0.0.0.0:3003"
- ❌ Any compilation errors

### 3. Browser Console (F12)
Look for:
- ❌ "Failed to load resource: net::ERR_CONNECTION_REFUSED"
- ❌ "fetch failed"
- ❌ "RefreshCw is not defined"

## Next Steps

1. **Confirm where you're accessing Settings**:
   - Production (`staff.tabeza.co.ke`) → Won't work with local service
   - Local (`localhost:3003`) → Should work

2. **If using production**:
   - Start staff app locally: `cd apps/staff && pnpm dev`
   - Visit `http://localhost:3003/settings`

3. **If using local and still not working**:
   - Check both services are running
   - Check browser console for errors
   - Test direct connection: `http://localhost:8765/api/status`

---

**Most likely issue**: You're trying to use production Vercel with local printer service. This can't work due to network isolation. You need to run the staff app locally to test the printer service.
