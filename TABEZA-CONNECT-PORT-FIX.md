# 🔧 Tabeza Connect - Port 8765 Conflict Fix

## Problem Identified

When running `pnpm --filter @tabeza/connect start:electron`, the service crashes with:

```
Error: listen EADDRINUSE: address already in use :::8765
```

**Root Cause:** Port 8765 is already occupied by another process (likely a previous instance that didn't shut down cleanly).

## ✅ Fixes Applied

### 1. Created Port Cleanup Script
**File:** `packages/printer-service/kill-port-8765.bat`

Automatically finds and kills any process using port 8765.

### 2. Enhanced Error Handling in Electron
**File:** `packages/printer-service/electron-main.js`

- Changed from `stdio: 'inherit'` to `stdio: ['ignore', 'pipe', 'pipe']`
- Now captures service stdout and stderr separately
- Shows error dialog if service crashes
- Provides helpful troubleshooting hints

### 3. Added Port Availability Check
**File:** `packages/printer-service/index.js`

- Checks if port 8765 is available before starting
- Shows clear error message if port is in use
- Exits gracefully with instructions

### 4. Created Troubleshooting Guide
**File:** `TABEZA-CONNECT-TROUBLESHOOTING.md`

Comprehensive guide covering all common issues and solutions.

## 🚀 How to Fix and Run

### Step 1: Kill Process Using Port 8765

```cmd
cd C:\Projects\Tabz\packages\printer-service
kill-port-8765.bat
```

**Expected output:**
```
Checking for processes using port 8765...
Found process: 7696
Killed process 7696
Port 8765 should now be free
```

### Step 2: Verify Port is Free

```cmd
netstat -ano | findstr :8765
```

**Expected output:** Nothing (empty result means port is free)

### Step 3: Test Service Standalone

```cmd
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start
```

**Expected output:**
```
╔═══════════════════════════════════════════════════════════╗
║   🔗 Tabeza Connect - Running                             ║
╚═══════════════════════════════════════════════════════════╝
```

If this works, press Ctrl+C to stop it.

### Step 4: Test Electron App

```cmd
pnpm --filter @tabeza/connect start:electron
```

**Expected result:**
- Setup window appears (if first run)
- OR service starts and tray icon appears (if configured)

## 🔍 Verification

### Check if Service is Running

```cmd
netstat -ano | findstr :8765
```

**Expected output:**
```
TCP    0.0.0.0:8765           0.0.0.0:0              LISTENING       <PID>
TCP    [::]:8765              [::]:0                 LISTENING       <PID>
```

### Test Service Endpoint

Open browser: http://localhost:8765/api/status

**Expected response:**
```json
{
  "status": "running",
  "version": "1.0.0",
  "printerName": "Tabeza Receipt Printer",
  "configured": true,
  "barId": "your-bar-id"
}
```

## 🎯 What Changed

### Before:
- Service crashed silently
- No error messages visible
- Port conflict not detected
- No cleanup tools

### After:
- ✅ Port availability check before starting
- ✅ Clear error messages with troubleshooting hints
- ✅ Error dialog in Electron app
- ✅ Cleanup script (`kill-port-8765.bat`)
- ✅ Comprehensive troubleshooting guide
- ✅ Better logging and error handling

## 🐛 If It Still Doesn't Work

### Option 1: Restart Computer
Restart your computer to clear all port bindings, then try again.

### Option 2: Use Different Port
Edit `packages/printer-service/index.js`:

```javascript
const PORT = 8766; // Changed from 8765
```

Then update references in:
- `apps/staff/components/PrinterStatusIndicator.tsx`
- `apps/staff/app/settings/page.tsx`
- Any other files that reference port 8765

### Option 3: Check Task Manager
1. Open Task Manager (Ctrl+Shift+Esc)
2. Look for "Tabeza Connect" or "electron.exe" or "node.exe"
3. End all instances
4. Try again

## 📋 Testing Checklist

After applying the fix:

- [ ] Run `kill-port-8765.bat`
- [ ] Verify port is free with `netstat`
- [ ] Test service standalone (`pnpm start`)
- [ ] Test Electron app (`pnpm start:electron`)
- [ ] Verify tray icon appears
- [ ] Test tray menu options
- [ ] Verify service responds on port 8765
- [ ] Test auto-start shortcut creation

## 🎉 Success Indicators

You'll know it's working when:

1. ✅ No error messages in console
2. ✅ Green tray icon appears in system tray
3. ✅ Right-click tray icon shows menu
4. ✅ http://localhost:8765/api/status returns JSON
5. ✅ http://localhost:8765/configure.html loads
6. ✅ Service stays running (doesn't exit immediately)

## 📚 Related Documentation

- `TABEZA-CONNECT-TROUBLESHOOTING.md` - Full troubleshooting guide
- `TABEZA-CONNECT-STATUS.md` - Implementation status
- `TABEZA-CONNECT-COMPLETE-GUIDE.md` - Complete implementation guide

---

**Status:** ✅ Fixes Applied - Ready to Test
**Next Action:** Run `kill-port-8765.bat` then test Electron app
**Last Updated:** 2026-02-11 15:50
