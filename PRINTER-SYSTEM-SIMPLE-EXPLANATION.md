# Printer System - Simple Explanation

## What Files Do What

### 1. Printer Service (The Local Server)
**File**: `packages/printer-service/index.js`

**What it does**:
- Runs a small web server on your computer (port 8765)
- Listens for configuration requests
- Watches a folder for print files from POS
- Sends print data to Tabeza cloud

**How to start it**:
```bash
cd packages/printer-service
node index.js
```

**What you should see**:
```
✅ Tabeza Printer Service - Running
Port: 8765
```

---

### 2. Staff App API Routes (The Middleman)

#### File: `apps/staff/app/api/printer/driver-status/route.ts`
**What it does**:
- Checks if printer service is running
- Asks: "Is localhost:8765 alive?"
- Returns: "Connected" or "Disconnected"

#### File: `apps/staff/app/api/printer/configure-service/route.ts`
**What it does**:
- Sends Bar ID to printer service
- Tells printer service: "You belong to this venue"

#### File: `apps/staff/app/api/printer/relay/route.ts`
**What it does**:
- Receives print jobs from printer service
- Creates "unmatched receipts" in database
- Shows them in Captain's Orders

---

### 3. Settings Page (The User Interface)
**File**: `apps/staff/app/settings/page.tsx`

**What it does**:
- Shows printer status (Connected/Disconnected)
- Has "Auto-Configure" button
- Calls the API routes above

**Key functions**:
- `checkPrinterServiceStatus()` - Checks if service is running
- `handleAutoConfigurePrinter()` - Sends Bar ID to service

---

### 4. Printer Status Component (The Status Display)
**File**: `apps/staff/components/PrinterStatusIndicator.tsx`

**What it does**:
- Shows green "Connected" or red "Disconnected"
- Refreshes status every 10 seconds
- Has "Test Print" button

---

## What's Supposed to Happen

### Step 1: User Starts Printer Service
```
User double-clicks: START-PRINTER-SERVICE.bat
    ↓
Terminal opens
    ↓
Shows: "✅ Tabeza Printer Service - Running"
    ↓
Service listens on localhost:8765
```

### Step 2: User Opens Settings Page
```
User visits: http://localhost:3003/settings
    ↓
Settings page loads
    ↓
Calls: checkPrinterServiceStatus()
    ↓
Fetches: /api/printer/driver-status
```

### Step 3: API Checks Service
```
API route receives request
    ↓
Tries to connect to: http://localhost:8765/api/status
    ↓
If service responds: Returns "Connected"
    ↓
If service doesn't respond: Returns "Disconnected"
```

### Step 4: UI Updates
```
Settings page receives response
    ↓
If "Connected": Shows green status + "Auto-Configure" button
    ↓
If "Disconnected": Shows red status + instructions
```

### Step 5: User Clicks Auto-Configure
```
User clicks: "Auto-Configure Printer Service"
    ↓
Settings page calls: handleAutoConfigurePrinter()
    ↓
Sends Bar ID to: /api/printer/configure-service
    ↓
API sends Bar ID to: http://localhost:8765/api/configure
    ↓
Printer service saves Bar ID to config.json
    ↓
Returns: "Success!"
    ↓
User sees: "✅ Configured successfully!"
```

---

## The Flow in Pictures

### Normal Flow (Everything Working)
```
┌─────────────┐
│   Browser   │ "Is printer connected?"
└──────┬──────┘
       │ fetch('/api/printer/driver-status')
       ↓
┌─────────────┐
│  Staff App  │ "Let me check..."
│  (Vercel)   │
└──────┬──────┘
       │ fetch('http://localhost:8765/api/status')
       ↓
┌─────────────┐
│   Printer   │ "Yes, I'm here!"
│   Service   │
│ (localhost) │
└──────┬──────┘
       │ { status: "running" }
       ↓
┌─────────────┐
│  Staff App  │ "Printer is connected!"
└──────┬──────┘
       │ { installed: true, status: "running" }
       ↓
┌─────────────┐
│   Browser   │ Shows: "✅ Connected"
└─────────────┘
```

### When Service Not Running
```
┌─────────────┐
│   Browser   │ "Is printer connected?"
└──────┬──────┘
       │ fetch('/api/printer/driver-status')
       ↓
┌─────────────┐
│  Staff App  │ "Let me check..."
└──────┬──────┘
       │ fetch('http://localhost:8765/api/status')
       ↓
       ✗ Connection refused
       ↓
┌─────────────┐
│  Staff App  │ "Can't reach printer service"
└──────┬──────┘
       │ { installed: false, error: "fetch failed" }
       ↓
┌─────────────┐
│   Browser   │ Shows: "❌ Disconnected"
└─────────────┘
```

---

## Why It Might Not Work

### Problem 1: Printer Service Not Running
**Symptom**: "fetch failed"
**Cause**: You didn't start the printer service
**Fix**: Run `START-PRINTER-SERVICE.bat`

### Problem 2: Using Production URL
**Symptom**: "fetch failed" even when service is running
**Cause**: You're on `https://staff.tabeza.co.ke` (production)
**Why it fails**: 
- Production server is in the cloud (Vercel)
- Your printer service is on your computer
- They can't talk to each other
**Fix**: Use `http://localhost:3003/settings` instead

### Problem 3: Staff App Not Running Locally
**Symptom**: Can't access localhost:3003
**Cause**: Staff app isn't running
**Fix**: Run `cd apps/staff && pnpm dev`

---

## The Key Insight

**The printer service MUST run on the same computer as the browser.**

Why?
- Browser makes request to Staff App
- Staff App tries to connect to `localhost:8765`
- "localhost" means "this computer"
- If Staff App is on Vercel, "localhost" = Vercel's computer
- If Staff App is on your computer, "localhost" = your computer

**That's why you need to run Staff App locally to test the printer service!**

---

## Summary

1. **Printer Service** (`packages/printer-service/index.js`) - Runs on your computer, port 8765
2. **API Routes** (`apps/staff/app/api/printer/*`) - Middleman between browser and service
3. **Settings Page** (`apps/staff/app/settings/page.tsx`) - UI that shows status
4. **Status Component** (`apps/staff/components/PrinterStatusIndicator.tsx`) - The green/red indicator

**To test locally**:
1. Start printer service: `START-PRINTER-SERVICE.bat`
2. Start staff app: `cd apps/staff && pnpm dev`
3. Visit: `http://localhost:3003/settings`
4. Should show: "✅ Connected"
5. Click: "Auto-Configure Printer Service"
6. Done!

**Why production doesn't work**:
- Production = Vercel server in the cloud
- Printer service = Your computer
- They're not on the same network
- Can't connect to each other
