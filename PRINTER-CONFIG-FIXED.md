# Printer Service Configuration - Fixed

**Date:** February 11, 2026  
**Issue:** Hardcoded config values and wrong barId  
**Status:** ✅ RESOLVED

---

## Problems Fixed

### 1. Wrong Bar ID
- **Was:** `94044336-927f-42ec-9d11-2026ed8a1bc9` (incorrect)
- **Now:** `438c80c1-fe11-4ac5-8a48-2fc45104ba31` (correct)

### 2. Wrong API Domain
- **Was:** `https://staff.tabeza.co.ke` (doesn't exist)
- **Now:** `https://tabz-kikao.vercel.app` (actual deployment)

### 3. Config File in Repository
- **Issue:** `config.json` was being tracked by git
- **Fix:** Already in `.gitignore`, not tracked
- **Created:** `config.example.json` as template
- **Created:** `CONFIG-SETUP.md` with documentation

---

## Current Configuration

Your local `config.json` now has:

```json
{
  "barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
  "apiUrl": "https://tabz-kikao.vercel.app",
  "driverId": "driver-MIHI-PC-1770655896151",
  "watchFolder": "C:\\Users\\mwene\\TabezaPrints"
}
```

---

## Why config.json Should NOT Be in Git

The `config.json` file is **machine-specific** and **venue-specific**:

1. **Different per venue:**
   - Each venue has a unique `barId`
   - Different venues = different configs

2. **Different per machine:**
   - `driverId` is auto-generated per installation
   - `watchFolder` path varies by user/machine
   - Developer machines use `localhost:3003`
   - Production machines use `tabz-kikao.vercel.app`

3. **Security:**
   - In the future, will contain API secrets
   - Should never be committed to public repos

---

## How Configuration Works

### On First Run

When the printer service starts for the first time:

1. Checks if `config.json` exists
2. If not, uses defaults:
   ```javascript
   {
     barId: '',
     apiUrl: 'http://localhost:3003',
     driverId: generateDriverId(),
     watchFolder: 'C:\\Users\\YourName\\TabezaPrints'
   }
   ```
3. Service runs but is "unconfigured" (`configured: false`)

### Configuration Methods

**Method 1: Auto-Configure (Recommended)**
- Go to staff app settings
- Click "Auto-Configure Printer Service"
- Config is created automatically

**Method 2: API Call**
```bash
curl -X POST http://localhost:8765/api/configure \
  -H "Content-Type: application/json" \
  -d '{
    "barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
    "apiUrl": "https://tabz-kikao.vercel.app"
  }'
```

**Method 3: Manual File**
- Copy `config.example.json` to `config.json`
- Edit with your values
- Restart service

### Environment Variable Override

For easy dev/prod switching:

```bash
# Production
set TABEZA_API_URL=https://tabz-kikao.vercel.app
set TABEZA_BAR_ID=438c80c1-fe11-4ac5-8a48-2fc45104ba31
node index.js

# Development
set TABEZA_API_URL=http://localhost:3003
set TABEZA_BAR_ID=438c80c1-fe11-4ac5-8a48-2fc45104ba31
node index.js
```

---

## Next Steps

### 1. Restart Printer Service

```bash
cd packages/printer-service
node index.js
```

Expected output:
```
🚀 Tabeza Connect v1.0.0 starting...
📁 Watching folder: C:\Users\mwene\TabezaPrints
🔗 API URL: https://tabz-kikao.vercel.app
🏢 Bar ID: 438c80c1-fe11-4ac5-8a48-2fc45104ba31
💓 Heartbeat service started (30s interval)
✅ Heartbeat sent successfully
```

### 2. Verify Heartbeats

Check database:
```sql
SELECT 
  driver_id,
  version,
  status,
  last_heartbeat,
  created_at
FROM printer_drivers
WHERE bar_id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'
ORDER BY last_heartbeat DESC;
```

### 3. Check Settings Page

Go to: `https://tabz-kikao.vercel.app/settings`

Should show:
- 🟢 Printer Status: Online
- Last seen: "Just now"

---

## For Other Developers

If you're setting up the printer service on your machine:

1. **DO NOT** copy someone else's `config.json`
2. **DO** use one of the configuration methods above
3. **DO** use environment variables for dev/prod switching
4. **DO** read `packages/printer-service/CONFIG-SETUP.md`

---

## Related Files

- `packages/printer-service/config.json` - Your local config (gitignored)
- `packages/printer-service/config.example.json` - Template
- `packages/printer-service/CONFIG-SETUP.md` - Setup guide
- `packages/printer-service/.gitignore` - Includes `config.json`
- `HEARTBEAT-DOMAIN-FIX.md` - Domain issue resolution

---

## Summary

✅ Correct barId: `438c80c1-fe11-4ac5-8a48-2fc45104ba31`  
✅ Correct domain: `https://tabz-kikao.vercel.app`  
✅ Config properly gitignored  
✅ Documentation created  
✅ Example config provided  

**Ready to restart printer service and test!**
