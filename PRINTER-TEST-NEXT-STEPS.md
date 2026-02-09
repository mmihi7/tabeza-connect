# Printer Test - Next Steps

## Current Status

✅ **Fixed Issues**:
1. Relay endpoint created (`/api/printer/relay`)
2. TypeScript compilation errors resolved
3. Database trigger configured
4. Printer service syntax error fixed

⚠️ **Remaining Issues**:
1. Printer service needs to be started from source
2. Printer service needs to be configured for local dev
3. Next.js build cache may be corrupted (browser errors)

## Quick Fix Steps

### Step 1: Clean Next.js Build Cache

```bash
# In the root directory
cd apps/staff
Remove-Item -Recurse -Force .next
cd ../..
```

### Step 2: Start Printer Service from Source

```bash
cd packages/printer-service
npm start
```

You should see:
```
✅ Tabeza Printer Service - Running
⚠️  CONFIGURATION REQUIRED
```

### Step 3: Configure Printer Service (in a NEW PowerShell window)

```powershell
Invoke-WebRequest -Uri "http://localhost:8765/api/configure" -Method POST -ContentType "application/json" -Body '{"barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31", "apiUrl": "http://localhost:3003"}'
```

### Step 4: Restart Staff App

```bash
# Stop the current dev server (Ctrl+C)
# Then restart it
pnpm dev:staff
```

### Step 5: Test It!

1. Go to http://localhost:3003
2. Look for printer status indicator (should show "Connected")
3. Click "Test Print" button
4. Should see success message
5. Check "Captain's Orders" for the test receipt

## If You Still Get Errors

### Browser Cache
Clear browser cache: `Ctrl+Shift+Delete` or hard refresh: `Ctrl+Shift+R`

### Printer Service Not Running
Make sure you see the printer service running in its terminal with the startup message.

### 405 Errors
This means the printer service is trying to reach production instead of localhost. Make sure Step 3 (configuration) completed successfully.

## Summary

The core issue was that you were running the **compiled exe** version of the printer service, which can't save configuration files. For development, you need to run it from **source code** using `npm start`.

Once configured, the test print flow will work:
```
Test Print Button → Staff App → Printer Service → Relay Endpoint → Database → Captain's Orders
```
