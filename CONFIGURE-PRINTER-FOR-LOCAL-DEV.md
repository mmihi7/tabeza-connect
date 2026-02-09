# Configure Printer Service for Local Development

## Problem
You're getting "Cloud API error: 405" because the printer service is trying to send data to **production** (`https://staff.tabeza.co.ke`) instead of your **local dev server** (`http://localhost:3003`).

The production server doesn't have the relay endpoint yet, so it returns 405.

## Solution (2 minutes)

### Step 1: Get Your Bar ID

1. Open your staff app: http://localhost:3003
2. Go to Settings
3. Find your Bar ID (it's a UUID like `abc123-def456-...`)
4. Copy it

### Step 2: Configure Printer Service

Run this command (replace `YOUR_BAR_ID` with your actual Bar ID):

```bash
node dev-tools/scripts/configure-printer-service-local.js YOUR_BAR_ID
```

**Example**:
```bash
node dev-tools/scripts/configure-printer-service-local.js 12345678-1234-1234-1234-123456789abc
```

This will:
- ✅ Configure printer service to use `http://localhost:3003`
- ✅ Set your Bar ID
- ✅ Test the connection

### Step 3: Restart Dev Server (if needed)

If your staff app isn't running or needs a restart:

```bash
# In the root directory
pnpm dev:staff
```

Or if you're running all apps:
```bash
pnpm dev
```

### Step 4: Test It

1. Go to staff dashboard: http://localhost:3003
2. Look for the printer status indicator (should show "Connected")
3. Click "Test Print" button
4. Should see success message
5. Check "Captain's Orders" section for the test receipt

## What This Does

The printer service has a configuration that determines where to send print data:

**Before** (default):
```json
{
  "apiUrl": "https://staff.tabeza.co.ke",  // ❌ Production
  "barId": ""
}
```

**After** (local dev):
```json
{
  "apiUrl": "http://localhost:3003",  // ✅ Local dev server
  "barId": "your-bar-id-here"
}
```

## Troubleshooting

### "Printer service is not running"
Start the printer service:
```bash
cd packages/printer-service
npm start
```

### "Could not reach local dev server"
Make sure the staff app is running:
```bash
pnpm dev:staff
```

### Still getting 405 errors
1. Restart the dev server (Ctrl+C, then `pnpm dev:staff`)
2. Clear browser cache (Ctrl+Shift+R)
3. Check that the relay endpoint exists: `apps/staff/app/api/printer/relay/route.ts`

## For Production

When you're ready to deploy, reconfigure the printer service to use production:

```bash
# This will be done on the actual venue computer
Invoke-WebRequest -Uri "http://localhost:8765/api/configure" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"barId": "YOUR_BAR_ID", "apiUrl": "https://staff.tabeza.co.ke"}'
```

## Configuration File Location

The configuration is saved to:
```
packages/printer-service/config.json
```

You can edit this file directly if needed.
