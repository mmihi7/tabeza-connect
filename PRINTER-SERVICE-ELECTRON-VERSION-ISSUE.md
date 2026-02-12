# Printer Service - Electron Version Issue

## Problem Identified

The `tabeza-printer-service.exe` file was compiled BEFORE we made the environment variable changes to the code. This means:

1. ✅ The batch file correctly sets environment variables
2. ✅ The service shows the Bar ID (so it IS reading the env vars)
3. ❌ But it's using OLD code that doesn't prioritize environment variables correctly
4. ❌ The heartbeat might not be starting properly

## Evidence

The console output shows:
```
║  Bar ID:   438c80c1-fe11-4ac5-8a48-2fc45104ba31           ║
```

But it's missing the new "Config Source: Environment Variables" line we added, which proves it's running old code.

## Solution Options

### Option 1: Run from Source Code (Immediate Fix)

This uses the LATEST code with all our fixes:

1. **Use the new batch file**: `RUN-PRINTER-FROM-SOURCE.bat`
2. **Enter your Bar ID** when prompted
3. **Service will run with updated code**

This will show:
```
📍 Service Status:
   • Bar ID: 438c80c1-fe11-4ac5-8a48-2fc45104ba31
   • API URL: https://tabz-kikao.vercel.app
   • Config Source: Environment Variables  ← NEW LINE
```

And you should see heartbeat messages:
```
💓 Starting heartbeat service...
💓 Sending heartbeat to production: https://tabz-kikao.vercel.app
✅ Heartbeat sent successfully
```

### Option 2: Rebuild the Electron App

Rebuild the .exe with the updated code:

```bash
cd C:\Projects\Tabz\packages\printer-service
npm install
npm run build
```

This creates a new `tabeza-printer-service.exe` with the latest code.

### Option 3: Wait for Official Release

We can package a new release with:
- Updated code
- Proper installer
- Tabeza logo icon
- Auto-start functionality
- Start Menu shortcut

## Why This Happened

The development workflow was:

1. **Created Electron app** → Compiled to .exe
2. **User downloaded .exe** → Placed in Downloads folder
3. **We updated the code** → Added environment variable priority
4. **User still has old .exe** → Doesn't have the new code

The .exe is a snapshot of the code at compile time. It doesn't automatically update when we change the source code.

## Recommended Action

**Use Option 1 (Run from Source)** for immediate testing:

1. **Stop the current service** (Ctrl+C in the window)
2. **Run**: `RUN-PRINTER-FROM-SOURCE.bat`
3. **Enter Bar ID**: `438c80c1-fe11-4ac5-8a48-2fc45104ba31`
4. **Wait 30 seconds**
5. **Check database**: Run `CHECK-HEARTBEAT-NOW.bat`

You should see heartbeat records in the database.

## What to Expect

### With Source Code (Updated):
```
📍 Service Status:
   • Port: 8765
   • Driver ID: driver-MIHI-PC-...
   • Bar ID: 438c80c1-fe11-4ac5-8a48-2fc45104ba31
   • API URL: https://tabz-kikao.vercel.app
   • Config Source: Environment Variables

✅ Configuration Complete!

💓 Starting heartbeat service...
💓 Sending heartbeat to production: https://tabz-kikao.vercel.app
✅ Heartbeat sent successfully
```

### With Old .exe:
```
║  Bar ID:   438c80c1-fe11-4ac5-8a48-2fc45104ba31           ║

Service is ready to receive print jobs.
```
(Missing heartbeat messages and config source line)

## Next Steps

1. **Try running from source** using `RUN-PRINTER-FROM-SOURCE.bat`
2. **Check for heartbeat messages** in the console
3. **Verify in database** using `CHECK-HEARTBEAT-NOW.bat`
4. **Check staff app** - should show "Printer service is online"

If this works, we know the code is correct and we just need to rebuild the Electron app.

## Files Created

- `RUN-PRINTER-FROM-SOURCE.bat` - Runs service from source code
- `CHECK-HEARTBEAT-NOW.bat` - Checks database for heartbeats
- `TEST-ENV-VARS.bat` - Tests if environment variables work
- `PRINTER-SERVICE-TROUBLESHOOTING.md` - Full troubleshooting guide
- `PRINTER-SERVICE-ELECTRON-VERSION-ISSUE.md` - This document

## Technical Details

### Why Environment Variables Work But Code Doesn't

The Electron app CAN read environment variables (that's why Bar ID shows up), but the OLD code has this logic:

```javascript
// OLD CODE (in the .exe)
function loadConfig() {
  // Try config file FIRST
  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath));
  }
  
  // THEN try environment variables
  return {
    barId: process.env.TABEZA_BAR_ID || '',
    apiUrl: process.env.TABEZA_API_URL || 'http://localhost:3003'
  };
}
```

The NEW code (in source) has:

```javascript
// NEW CODE (in source files)
function loadConfig() {
  // Check environment variables FIRST
  const envBarId = process.env.TABEZA_BAR_ID;
  const envApiUrl = process.env.TABEZA_API_URL;
  
  if (envBarId && envApiUrl) {
    console.log('✅ Using configuration from environment variables');
    return { barId: envBarId, apiUrl: envApiUrl, ... };
  }
  
  // THEN try config file
  // ...
}
```

The priority order changed, which is why we need to use the updated code.
