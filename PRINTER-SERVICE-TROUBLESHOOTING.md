# Printer Service Troubleshooting Guide

## Current Situation

The printer service shows "Bar ID: Not configured" even though the batch file creates a config.json file. This is because the compiled Electron app can't read config files from the Downloads folder.

## Solution Steps

### Step 1: Verify Environment Variables Work

1. **Copy `TEST-ENV-VARS.bat` to your Downloads folder**
2. **Double-click it**
3. **Check the output** - you should see:
   ```
   Bar ID from env: 438c80c1-fe11-4ac5-8a48-2fc45104ba31
   API URL from env: https://tabz-kikao.vercel.app
   ```

If this works, environment variables are functioning correctly.

### Step 2: Use the New Batch File

1. **Copy `START-PRINTER-WITH-BARID.bat` to your Downloads folder**
2. **Double-click it**
3. **Enter your Bar ID**: `438c80c1-fe11-4ac5-8a48-2fc45104ba31`
4. **Check the service output** - you should see:
   ```
   📍 Service Status:
      • Bar ID: 438c80c1-fe11-4ac5-8a48-2fc45104ba31
      • API URL: https://tabz-kikao.vercel.app
      • Config Source: Environment Variables
   ```

### Step 3: Verify Heartbeats Are Sent

After the service starts, wait 30 seconds, then run:

```bash
cd Tabz
node dev-tools/scripts/check-printer-heartbeats.js
```

You should see heartbeat records in the database.

## Common Issues

### Issue 1: "Bar ID: Not configured" Still Shows

**Cause**: The Electron app isn't reading environment variables

**Solutions**:
1. Make sure you're using `START-PRINTER-WITH-BARID.bat`, not `RUN-PRINTER-SERVICE.bat`
2. Check that the batch file sets the variables BEFORE starting the .exe
3. Try running from source code instead (see below)

### Issue 2: No Heartbeats in Database

**Cause**: Network issue or API endpoint not reachable

**Check**:
1. Is the service showing "💓 Sending heartbeat..." messages?
2. Are there any error messages in the console?
3. Can you access `https://tabz-kikao.vercel.app` in your browser?

**Test the endpoint manually**:
```bash
curl -X POST https://tabz-kikao.vercel.app/api/printer/heartbeat ^
  -H "Content-Type: application/json" ^
  -d "{\"barId\":\"438c80c1-fe11-4ac5-8a48-2fc45104ba31\",\"driverId\":\"test-driver\",\"version\":\"1.0.0\"}"
```

### Issue 3: Electron App Doesn't Support Environment Variables

**Workaround**: Run from source code instead of the compiled .exe

1. **Install Node.js** (if not already installed)
2. **Navigate to the printer service folder**:
   ```bash
   cd Tabz\packages\printer-service
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Set environment variables and run**:
   ```bash
   set TABEZA_BAR_ID=438c80c1-fe11-4ac5-8a48-2fc45104ba31
   set TABEZA_API_URL=https://tabz-kikao.vercel.app
   node index.js
   ```

## Alternative: Rebuild the Electron App

If environment variables don't work with the current Electron build, we need to rebuild it with the updated code.

### Option A: Quick Rebuild (Local)

```bash
cd Tabz\packages\printer-service
npm install
npm run build
```

This creates a new .exe with the updated code.

### Option B: Use Auto-Configure Button

Instead of manual configuration, use the Auto-Configure button in the staff app:

1. **Start the printer service** (even if not configured)
2. **Open staff app**: `https://tabz-kikao.vercel.app/settings`
3. **Click "Auto-Configure Printer Service"**
4. **Service will receive config automatically**

## Diagnostic Commands

### Check if service is running:
```bash
curl http://localhost:8765/api/status
```

### Check database for heartbeats:
```bash
cd Tabz
node dev-tools/scripts/check-printer-heartbeats.js
```

### Test heartbeat endpoint:
```bash
curl -X POST https://tabz-kikao.vercel.app/api/printer/heartbeat ^
  -H "Content-Type: application/json" ^
  -d "{\"barId\":\"438c80c1-fe11-4ac5-8a48-2fc45104ba31\",\"driverId\":\"test-driver\",\"version\":\"1.0.0\"}"
```

## Expected Behavior

### When Working Correctly:

1. **Service starts** with Bar ID visible
2. **Heartbeats sent** every 30 seconds
3. **Console shows**:
   ```
   💓 Sending heartbeat to production: https://tabz-kikao.vercel.app
   ✅ Heartbeat sent successfully
   ```
4. **Database has records**:
   ```
   🟢 Driver: driver-MIHI-PC-...
      Bar ID: 438c80c1-fe11-4ac5-8a48-2fc45104ba31
      Status: online
      Last Heartbeat: [recent timestamp]
      Online: YES ✅
   ```
5. **Staff app shows**: "Printer service is online"

## Next Steps

1. **Try `TEST-ENV-VARS.bat`** to verify environment variables work
2. **Try `START-PRINTER-WITH-BARID.bat`** to start the service
3. **Check the console output** for "Config Source: Environment Variables"
4. **Wait 30 seconds** and check for heartbeat messages
5. **Run the database check** to verify heartbeats are recorded

If none of this works, we'll need to either:
- Rebuild the Electron app with the updated code
- Run from source code instead of the .exe
- Use the Auto-Configure button approach

Let me know what you see when you try these steps!
