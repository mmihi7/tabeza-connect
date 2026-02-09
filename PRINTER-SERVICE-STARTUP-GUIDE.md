# Tabeza Printer Service - Startup Guide

## The Issue: "Installed" ≠ "Running"

Many users download and install the printer service but don't realize they need to **actively run it**. The service doesn't auto-start - you must manually launch it and keep it running.

## ✅ Correct Setup Process

### Step 1: Download the Service
1. Go to Tabeza Settings → Venue Configuration tab
2. Click "Download Printer Service"
3. Save `tabeza-printer-service.exe` to your Downloads folder

### Step 2: Run the Service (CRITICAL!)
1. Open your **Downloads** folder
2. Find `tabeza-printer-service.exe`
3. **Double-click it** to run
4. A terminal/command window will open
5. You should see: **"✅ Tabeza Printer Service - Running"**
6. **KEEP THIS WINDOW OPEN!** ⚠️

### Step 3: Configure the Service
1. Go back to Tabeza Settings (keep the terminal open!)
2. Click **"Auto-Configure Printer Service"** button
3. Wait for "✅ Configured successfully!" message
4. Done! Your printer is now connected

## 🚨 Common Mistakes

### ❌ Mistake 1: Closing the Terminal
**Problem**: User runs the service, sees it start, then closes the terminal window.
**Result**: Service stops immediately.
**Solution**: Keep the terminal window open at all times.

### ❌ Mistake 2: Only Installing, Not Running
**Problem**: User downloads the .exe file but never runs it.
**Result**: Service never starts, configuration fails.
**Solution**: Double-click the .exe file to actually run it.

### ❌ Mistake 3: Running Once Then Forgetting
**Problem**: User runs it once, configures it, then closes it.
**Result**: Service stops, no more print jobs are processed.
**Solution**: Service must run continuously whenever you need printing.

## 🎯 How to Know It's Working

### ✅ Service is Running:
- Terminal window is open
- Shows "✅ Tabeza Printer Service - Running"
- Settings page shows "Printer Service: Connected" (green)
- Auto-configure button works

### ❌ Service is NOT Running:
- No terminal window visible
- Settings page shows "Printer Service: Disconnected" (red)
- Auto-configure button fails with connection error
- Error: "Cannot connect to printer service"

## 💡 Pro Tips

### Tip 1: Pin to Taskbar
Right-click `tabeza-printer-service.exe` → Pin to Taskbar
Now you can start it with one click!

### Tip 2: Create Desktop Shortcut
Right-click `tabeza-printer-service.exe` → Send to → Desktop (create shortcut)
Double-click the shortcut to start the service.

### Tip 3: Minimize, Don't Close
You can minimize the terminal window, but **don't close it**.
It will keep running in the background.

## 🔧 Troubleshooting

### "Cannot connect to printer service"
**Cause**: Service is not running.
**Fix**: 
1. Check if terminal window is open
2. If not, run `tabeza-printer-service.exe` again
3. Try auto-configure again

### "Service was working, now it's not"
**Cause**: Terminal window was closed.
**Fix**:
1. Run `tabeza-printer-service.exe` again
2. Service will resume from saved configuration
3. No need to reconfigure!

### "I restarted my computer"
**Cause**: Service doesn't auto-start on boot.
**Fix**:
1. Run `tabeza-printer-service.exe` again after restart
2. Service will load saved configuration automatically

## 🚀 Future Improvement: Windows Service

We're working on a Windows Service installer (MSI) that will:
- Auto-start when Windows boots
- Run in background (no terminal window)
- Restart automatically if it crashes
- Show in Windows Services panel

Until then, you must manually run the .exe file and keep it running!

## 📋 Quick Reference

| Action | What It Does |
|--------|--------------|
| Download .exe | Gets the file to your computer |
| Double-click .exe | **Starts the service** (REQUIRED!) |
| Keep terminal open | Service stays running |
| Close terminal | Service stops immediately |
| Auto-configure button | Connects service to your venue |
| Restart computer | Service stops, must run again |

## ✅ Success Checklist

- [ ] Downloaded `tabeza-printer-service.exe`
- [ ] Double-clicked it to run
- [ ] Terminal window is open and shows "Running"
- [ ] Clicked "Auto-Configure" in Settings
- [ ] Settings shows "Printer Service: Connected"
- [ ] Terminal window is still open (not closed!)

If all boxes are checked, you're good to go! 🎉

## 🆘 Still Having Issues?

1. Make sure terminal window is open
2. Check Settings → Venue Configuration tab
3. Look at printer status indicator
4. Try "Check Again" button
5. If still failing, restart the service:
   - Close terminal window
   - Run `tabeza-printer-service.exe` again
   - Click "Auto-Configure" again

---

**Remember**: The service is like a music player - it only works while it's running! 🎵
