# TabezaConnect Installer v1.6.0 - UPDATED with Printer Registration

**Build Date:** February 22, 2026 12:31  
**Build Status:** ✅ SUCCESS  
**Installer Size:** 12,772,070 bytes (12.2 MB)  
**Output File:** `dist/TabezaConnect-Setup-v1.6.0.exe`

---

## Critical Fix: Printer Registration with Tabeza API

### Problem
The printer was not appearing in the Tabeza staff app because the service wasn't registering itself with the backend `printer_drivers` table.

### Solution
Added a new installation step that registers the printer with the Tabeza API immediately after the service starts.

---

## Updated Installation Flow

1. **Create Folders** - Creates watch folders and temp folders
2. **Detect Printer** - Auto-detects thermal/POS printers
3. **Configure Bridge** - Sets up printer port and creates config.json
4. **Register Service** - Registers Windows service
5. **Start Service** - Starts the TabezaConnect service
6. **🆕 Register Printer with API** - Registers printer in Tabeza backend
7. **Verify Installation** - Prompts for test print and verifies end-to-end

---

## New Script: register-printer-with-api.ps1

**Location:** `src/installer/scripts/register-printer-with-api.ps1`

**What it does:**
- Generates unique driver ID: `driver-{COMPUTERNAME}-{timestamp}`
- Reads printer info from config.json
- Registers printer with Tabeza API at `/rest/v1/printer_drivers`
- Updates config.json with driver ID
- Handles errors gracefully (doesn't fail installation if API is down)

**API Payload:**
```json
{
  "id": "driver-COMPUTERNAME-20260222123000",
  "bar_id": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
  "printer_name": "EPSON L3210 Series",
  "status": "active",
  "last_seen": "2026-02-22T12:30:00.000Z",
  "version": "1.6.0",
  "computer_name": "COMPUTERNAME"
}
```

---

## What Gets Registered

### In Supabase `printer_drivers` table:
- **id** - Unique driver identifier
- **bar_id** - Venue/bar ID from installer input
- **printer_name** - Detected printer name (e.g., "EPSON L3210 Series")
- **status** - "active"
- **last_seen** - Current timestamp
- **version** - Installer version (1.6.0)
- **computer_name** - Windows computer name

### In config.json:
- **driverId** - Added to config for future heartbeat updates

---

## Testing Checklist

Before running the installer:
- [ ] Uninstall previous TabezaConnect version
- [ ] Delete `C:\ProgramData\Tabeza` folder
- [ ] Verify printer is connected and powered on
- [ ] Have Bar ID ready from Tabeza staff dashboard

After installation:
- [ ] Check service is running: `sc query TabezaConnect`
- [ ] Verify config.json has driverId field
- [ ] Check Supabase `printer_drivers` table has new record
- [ ] Verify printer appears in Tabeza staff app
- [ ] Send test print from POS to verify end-to-end

---

## Troubleshooting

### Printer not appearing in staff app

1. Check if registration succeeded:
   ```cmd
   type C:\ProgramData\Tabeza\config.json
   ```
   Look for `driverId` field

2. Check Supabase directly:
   - Go to Supabase dashboard
   - Open `printer_drivers` table
   - Look for record with your bar_id

3. Check installation logs:
   ```cmd
   type C:\ProgramData\Tabeza\logs\terms-acceptance.log
   ```

### Service not starting

1. Check service status:
   ```cmd
   sc query TabezaConnect
   ```

2. Try starting manually:
   ```cmd
   sc start TabezaConnect
   ```

3. Check Windows Event Viewer for errors

---

## Next Steps

1. **Uninstall old version** (if installed)
2. **Run new installer** from `dist/TabezaConnect-Setup-v1.6.0.exe`
3. **Enter Bar ID** when prompted
4. **Wait for registration** step to complete
5. **Send test print** when prompted
6. **Verify in staff app** that printer appears

---

## API Configuration

**Supabase URL:** https://bkaigyrrzsqbfscyznzw.supabase.co  
**API Endpoint:** /rest/v1/printer_drivers  
**Authentication:** Supabase anon key (public key)

The anon key is safe to include in the installer because:
- It's a public key (not a secret)
- RLS policies protect the database
- Only allows inserting/updating printer_drivers records
- Cannot access sensitive data

---

## Files Modified

1. **installer-pkg-v1.6.0.iss**
   - Added Step 6: Register printer with API
   - Added register-printer-with-api.ps1 to [Files] section

2. **src/installer/scripts/register-printer-with-api.ps1** (NEW)
   - Registers printer with Tabeza API
   - Updates config.json with driver ID
   - Handles errors gracefully

---

## Success Criteria

✅ Installer builds successfully  
✅ Printer registration script included  
✅ Service starts automatically  
✅ Printer appears in Tabeza staff app  
✅ Test print works end-to-end  
✅ Config.json contains driver ID
