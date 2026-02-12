# Tabeza Printer Service - Quick Start Guide

**Date:** February 11, 2026  
**Your Bar ID:** `438c80c1-fe11-4ac5-8a48-2fc45104ba31`  
**Production URL:** `https://tabz-kikao.vercel.app`

---

## What You Have

You have the portable executable: `tabeza-printer-service.exe` in your Downloads folder.

This is a standalone app that doesn't need installation - just run it!

---

## How to Start the Printer Service

### Option 1: Double-Click the .exe (Easiest)

1. Go to your Downloads folder
2. Double-click `tabeza-printer-service.exe`
3. A window will open showing the service status
4. **Keep this window open** - closing it stops the service

### Option 2: Use the Batch File

1. Double-click `RUN-PRINTER-SERVICE.bat` (in this folder)
2. Press any key to start
3. **Keep the window open**

---

## What You Should See

When the service starts, you'll see:

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🔗 Tabeza Connect - Running                             ║
║                                                           ║
║   Bridge your POS to the cloud                           ║
║                                                           ║
║   ⚠️  KEEP THIS WINDOW OPEN - Service must stay running  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

📍 Service Status:
   • Port: 8765
   • Driver ID: driver-MIHI-PC-...
   • Bar ID: 438c80c1-fe11-4ac5-8a48-2fc45104ba31
   • Watch Folder: C:\Users\mwene\TabezaPrints

💓 Heartbeat service started (30s interval)
✅ Heartbeat sent successfully
```

---

## Configure the Service (If Needed)

If the service shows "NOT CONFIGURED", you have two options:

### Option A: Auto-Configure (Recommended)

1. Keep the printer service window open
2. Go to: https://tabz-kikao.vercel.app/settings
3. Navigate to "Venue Configuration" tab
4. Click "Auto-Configure Printer Service" button
5. Done! ✅

### Option B: Manual Configuration

1. Keep the printer service window open
2. Double-click `UPDATE-PRINTER-CONFIG.bat`
3. Wait for "Configuration updated!" message
4. Check the printer service window for confirmation

---

## Verify It's Working

### 1. Check the Printer Service Window

You should see:
```
✅ Heartbeat sent successfully
```

Every 30 seconds.

### 2. Check the Settings Page

1. Go to: https://tabz-kikao.vercel.app/settings
2. Navigate to "Venue Configuration" tab
3. Look for the printer status indicator

Should show:
- 🟢 **Printer Status: Online**
- Last seen: "Just now" or "X seconds ago"

### 3. Check the Database (Optional)

If you want to verify in the database:

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

---

## Troubleshooting

### "Port 8765 is already in use"

Another instance is running. To fix:

1. Close all printer service windows
2. Run: `kill-port-8765.bat` (if you have it)
3. Or restart your computer
4. Start the service again

### "Configuration Required"

The service needs your bar ID. Use one of the configuration methods above.

### Heartbeats Failing

Check:
1. Internet connection is working
2. Firewall isn't blocking port 8765
3. The API URL is correct: `https://tabz-kikao.vercel.app`

### Service Keeps Stopping

Make sure:
1. You're not closing the window
2. Your computer isn't going to sleep
3. No antivirus is blocking the app

---

## Important Notes

### Keep the Window Open

The printer service MUST stay running for heartbeats to work. If you close the window, the service stops.

### Auto-Start (Coming Soon)

In the future, we'll add:
- Windows service installation
- Auto-start on boot
- System tray icon
- Start menu shortcut

For now, you need to run it manually.

### Config File Location

The service creates a config file at:
```
C:\Users\mwene\Downloads\config.json
```

This file is specific to your machine and should not be shared.

---

## Next Steps

1. ✅ Start the printer service (double-click the .exe)
2. ✅ Verify heartbeats are working (check the window)
3. ✅ Check the settings page shows "Online"
4. ⏳ Set up your POS to print to: `C:\Users\mwene\TabezaPrints`

---

## Need Help?

If something isn't working:

1. Check the printer service window for error messages
2. Check the settings page for status
3. Try restarting the service
4. Check your internet connection

---

**Ready to go!** Just double-click `tabeza-printer-service.exe` in your Downloads folder.
