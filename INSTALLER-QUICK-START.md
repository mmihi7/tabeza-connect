# Tabeza Connect Installer - Quick Start Guide

**Version:** 1.7.15  
**One-Click Setup for Venue Owners**

---

## For Developers: Building the Installer

### Quick Build (3 steps)

1. **Ensure TabezaConnect.exe exists:**
   ```powershell
   # Should exist at: dist/win-ia32-unpacked/TabezaConnect.exe
   # If not, it was built by electron-builder
   ```

2. **Run the build script:**
   ```powershell
   .\build-installer.ps1
   ```

3. **Find your installer:**
   ```
   installer-output/TabezaConnect-Setup-v1.7.15.exe
   ```

That's it! The installer is ready for distribution.

---

## For Venue Owners: Installing Tabeza Connect

### Installation Steps

1. **Download the installer:**
   - Get it from your Tabeza Staff app
   - Or download from: https://github.com/mmihi7/tabeza-connect/releases/latest

2. **Run the installer:**
   - Double-click `TabezaConnect-Setup-v1.7.15.exe`
   - Click "Yes" when Windows asks for admin permission

3. **Enter your Bar ID:**
   - Find it in your Tabeza Staff dashboard
   - Go to: Settings → Venue Details → Bar ID
   - Copy and paste it into the installer

4. **Wait for installation:**
   - The installer will:
     - ✓ Install the Tabeza Connect service
     - ✓ Configure your printer (if you have one)
     - ✓ Start the background service
     - ✓ Launch the system tray icon

5. **Complete setup:**
   - A browser window will open automatically
   - Follow the 3-step template setup wizard
   - Print 3 test receipts from your POS
   - Done! Tabeza Connect is now running

---

## What Gets Installed

### Files
- **C:\Program Files\TabezaConnect\** - Application files
- **C:\ProgramData\Tabeza\** - Configuration and logs

### Windows Service
- **Name:** TabezaConnect
- **Startup:** Automatic (starts on boot)
- **Account:** LocalService

### Printer
- **Name:** Tabeza Agent
- **Type:** Virtual printer with pooling
- **Ports:** Your physical printer + capture port

### System Tray
- **Icon:** Green when online, grey when offline
- **Right-click menu:** Open dashboard, view logs, quit

---

## After Installation

### Accessing the Dashboard

1. **From system tray:**
   - Right-click the Tabeza icon
   - Click "Open Dashboard"

2. **From browser:**
   - Go to: http://localhost:8765

### Configuring Your POS

Point your POS system to print to: **Tabeza Agent**

Your receipts will now:
- ✓ Print on paper (as normal)
- ✓ Get captured digitally
- ✓ Upload to Tabeza cloud
- ✓ Appear in customer wallets

---

## Troubleshooting

### Service not starting?

```powershell
# Check service status
sc query TabezaConnect

# Start manually
sc start TabezaConnect

# View logs
notepad C:\ProgramData\Tabeza\logs\service.log
```

### Printer not appearing?

1. Open Windows Settings → Printers & Devices
2. Look for "Tabeza Agent"
3. If missing, run: `C:\Program Files\TabezaConnect\scripts\configure-pooling-printer.ps1`

### Dashboard not opening?

1. Check if service is running: `sc query TabezaConnect`
2. Try opening manually: http://localhost:8765
3. Check firewall isn't blocking port 8765

---

## Uninstalling

1. Go to: Settings → Apps → Installed apps
2. Find "TabezaConnect"
3. Click "Uninstall"

The uninstaller will:
- ✓ Stop the service
- ✓ Remove the printer
- ✓ Delete application files
- ✓ Keep your configuration (in case you reinstall)

---

## Support

**Need help?**
- Email: support@tabeza.co.ke
- Phone: +254 XXX XXX XXX
- Website: https://tabeza.co.ke/support

**Found a bug?**
- GitHub Issues: https://github.com/mmihi7/tabeza-connect/issues

---

## Technical Details

### System Requirements
- Windows 10 or Windows 11 (64-bit)
- 100 MB free disk space
- Administrator access (for installation only)
- Internet connection (for cloud sync)

### What's Included
- ✓ Complete standalone package
- ✓ No additional downloads required
- ✓ All dependencies bundled
- ✓ Offline-capable (queues receipts when internet is down)

### Architecture
- **Capture:** Windows Printer Pooling
- **Processing:** Local regex parser (1-5ms per receipt)
- **Upload:** Background worker with retry logic
- **Storage:** Supabase (PostgreSQL)

---

**Built with ❤️ in Nairobi, Kenya**
