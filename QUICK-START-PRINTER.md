# Quick Start: Printer Service

## The Problem You're Seeing

```
Error: fetch failed
```

This means the printer service isn't running on your computer. The browser is trying to connect to `localhost:8765` but nothing is listening there.

## Solution: Start the Printer Service

### Option 1: Double-Click the Batch File (Easiest)
1. Find `START-PRINTER-SERVICE.bat` in your project root
2. **Double-click it**
3. A terminal window will open
4. You should see: "✅ Tabeza Printer Service - Running"
5. **Keep this window open!**

### Option 2: Run from Command Line
```bash
cd packages/printer-service
node index.js
```

## What You Should See

When the service starts successfully, you'll see:

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ✅ Tabeza Printer Service - Running                     ║
║                                                           ║
║   ⚠️  KEEP THIS WINDOW OPEN - Service must stay running  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

📍 Service Status:
   • Port: 8765
   • Driver ID: driver-YOUR-COMPUTER-...
   • Bar ID: ⚠️  NOT CONFIGURED
   • Watch Folder: C:\Users\YourName\TabezaPrints

⚠️  CONFIGURATION REQUIRED

To connect this service to your Tabeza account:

📋 Easy Setup (Recommended):
   1. Keep this window open (service is running)
   2. Open Tabeza Settings in your browser
   3. Go to: http://localhost:3003/settings
   4. Navigate to "Venue Configuration" tab
   5. Click "Auto-Configure Printer Service" button
   6. Done! ✅
```

## Then Go Back to Settings Page

1. **Keep the terminal window open**
2. Go back to your browser
3. Refresh the Settings page
4. You should now see: **"✅ Service Running - Ready to Configure"**
5. Click **"Auto-Configure Printer Service"** button
6. Done!

## Troubleshooting

### Still seeing "Disconnected"?
- Make sure the terminal window is still open
- Click "Check Again" button in Settings
- Check the terminal - it should show "Running"

### Terminal window closed?
- Run `START-PRINTER-SERVICE.bat` again
- The service will load your saved configuration automatically

### Port 8765 already in use?
- Another instance might be running
- Close all terminal windows
- Run `START-PRINTER-SERVICE.bat` again

## Remember

**The printer service is like a music player - it only works while it's running!** 🎵

Keep the terminal window open whenever you need the printer to work.

---

**Next Step**: Double-click `START-PRINTER-SERVICE.bat` now! 🚀
