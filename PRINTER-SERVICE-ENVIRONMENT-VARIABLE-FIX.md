# Printer Service Configuration Fix

## Problem Identified

The compiled Electron app (`tabeza-printer-service.exe`) cannot read `config.json` from the Downloads folder because it's packaged and looks for config files inside its own app resources.

## Solution: Use Environment Variables

The printer service code already supports environment variables, which work perfectly with compiled Electron apps.

## How to Use (For End Users)

### Option 1: Use the New Batch File (Recommended)

1. **Download the new batch file**: `START-PRINTER-WITH-BARID.bat`
2. **Place it in your Downloads folder** (same folder as `tabeza-printer-service.exe`)
3. **Double-click** `START-PRINTER-WITH-BARID.bat`
4. **Enter your Bar ID** when prompted
5. **Done!** The service will start with the correct configuration

### Option 2: Manual Environment Variables

If you prefer to set environment variables manually:

```cmd
cd %USERPROFILE%\Downloads
set TABEZA_BAR_ID=438c80c1-fe11-4ac5-8a48-2fc45104ba31
set TABEZA_API_URL=https://tabz-kikao.vercel.app
tabeza-printer-service.exe
```

## What Changed in the Code

### Before (Broken)
```javascript
// Tried to load config.json from __dirname (inside Electron app)
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath));
```

### After (Fixed)
```javascript
// Prioritize environment variables (works with Electron)
const envBarId = process.env.TABEZA_BAR_ID;
const envApiUrl = process.env.TABEZA_API_URL;

if (envBarId && envApiUrl) {
  // Use environment variables
  config = { barId: envBarId, apiUrl: envApiUrl };
} else {
  // Fallback to config file
  config = loadFromFile();
}
```

## Why This Works

1. **Environment variables are inherited by child processes** - When you set `TABEZA_BAR_ID` in the batch file, the Electron app can read it
2. **No file system access needed** - Environment variables are in memory, not on disk
3. **Works with compiled apps** - Electron apps can always read environment variables

## Verification

After starting the service with the new batch file, you should see:

```
📍 Service Status:
   • Port: 8765
   • Driver ID: driver-MIHI-PC-...
   • Bar ID: 438c80c1-fe11-4ac5-8a48-2fc45104ba31
   • API URL: https://tabz-kikao.vercel.app
   • Config Source: Environment Variables  ← This confirms it's working!
```

## Next Steps for User

1. **Stop the current printer service** (if running)
2. **Use the new batch file**: `START-PRINTER-WITH-BARID.bat`
3. **Check the database** for heartbeat records:
   ```sql
   SELECT * FROM printer_drivers 
   WHERE bar_id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'
   ORDER BY last_heartbeat DESC;
   ```

## Files Updated

- `packages/printer-service/index.js` - Prioritize environment variables
- `START-PRINTER-WITH-BARID.bat` - New batch file that sets environment variables
- `PRINTER-SERVICE-ENVIRONMENT-VARIABLE-FIX.md` - This documentation

## Technical Details

### Configuration Priority (New)
1. **Environment variables** (highest priority)
   - `TABEZA_BAR_ID`
   - `TABEZA_API_URL`
2. **Config file** (fallback)
   - `config.json` in app directory
3. **Defaults** (if nothing else)
   - Empty barId
   - `http://localhost:3003` for API URL

### Why the Old Approach Failed

The batch file created `config.json` in Downloads folder:
```
C:\Users\mwene\Downloads\config.json
```

But the Electron app looked for it in its app resources:
```
C:\Users\mwene\AppData\Local\Programs\tabeza-printer-service\resources\app\config.json
```

These are different locations, so the app never saw the config file.

## Future Improvements

For a better user experience, we should:

1. **Build a proper installer** that:
   - Creates a Start Menu shortcut
   - Stores config in `%APPDATA%\Tabeza\config.json`
   - Adds Tabeza logo icon
   - Includes auto-start functionality

2. **Add a first-run wizard** that:
   - Prompts for Bar ID on first launch
   - Saves to proper location
   - Tests connection
   - Shows success message

3. **Use the Auto-Configure button** in staff app settings:
   - Generates a one-time setup token
   - User clicks button in printer service
   - Service fetches config from API using token
   - No manual Bar ID entry needed

But for now, environment variables solve the immediate problem.
