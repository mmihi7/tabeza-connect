# Tabeza Connect - Configuration Guide

**How to Configure Your Printer Service with Your Bar ID**

## ✅ Method 1: Auto-Configure (Easiest - Recommended)

This is the easiest way to configure your printer service!

### Steps:

1. **Start the printer service**
   - Double-click `tabeza-connect.exe` (or run from source)
   - You'll see a terminal window that says "Tabeza Printer Service Running"
   - **Keep this window open!**

2. **Open Tabeza Staff App**
   - Go to: https://staff.tabeza.co.ke/settings
   - Or for local dev: http://localhost:3003/settings

3. **Click "Auto-Configure Printer Service" button**
   - Scroll to the "Printer Configuration" section
   - Click the blue "Auto-Configure Printer Service" button
   - Wait a few seconds

4. **Done!** ✅
   - You'll see a success message
   - The printer service terminal will show your Bar ID
   - Heartbeats will start sending automatically

### What This Does:
- Automatically detects your Bar ID from your logged-in session
- Configures the printer service with the correct API URL
- Saves the configuration so it persists across restarts

---

## Method 2: Web Configuration Page

If the auto-configure button doesn't work, use the web interface:

### Steps:

1. **Start the printer service** (keep terminal open)

2. **Open the configuration page**
   - Go to: http://localhost:8765/configure.html
   - You'll see a simple configuration form

3. **Get your Bar ID**
   - Open Tabeza Staff App: https://staff.tabeza.co.ke/settings
   - Your Bar ID is shown at the top of the settings page
   - Copy it (it looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

4. **Enter configuration**
   - Paste your Bar ID into the form
   - API URL is pre-filled (usually correct)
   - Click "Configure"

5. **Done!** ✅
   - You'll see a success message
   - Check the printer service terminal - it should show your Bar ID

---

## Method 3: Manual API Call (Advanced)

For developers or troubleshooting:

### Using curl:

```bash
curl -X POST http://localhost:8765/api/configure \
  -H "Content-Type: application/json" \
  -d "{\"barId\":\"YOUR-BAR-ID-HERE\",\"apiUrl\":\"https://staff.tabeza.co.ke\"}"
```

### Using PowerShell:

```powershell
$body = @{
    barId = "YOUR-BAR-ID-HERE"
    apiUrl = "https://staff.tabeza.co.ke"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8765/api/configure" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

---

## Verification

After configuration, verify it's working:

### 1. Check the Terminal Window

You should see:
```
╔════════════════════════════════════════╗
║   Tabeza Printer Service Running      ║
╠════════════════════════════════════════╣
║  Port:     8765                        ║
║  Bar ID:   a1b2c3d4-e5f6-7890...      ║  ← Your Bar ID here!
║  Driver:   driver-YOURPC-17708...     ║
╚════════════════════════════════════════╝

💓 Starting heartbeat service...
✅ Heartbeat sent successfully
```

### 2. Check Staff App

- Go to Settings → Printer Configuration
- You should see: "🟢 Printer Connected"
- Last seen time should be recent (< 1 minute ago)

### 3. Test Print (Optional)

- In Settings, click "Test Print"
- A test receipt should appear in your unmatched receipts

---

## Troubleshooting

### "Bar ID: Not configured"

**Problem:** Printer service is running but not configured

**Solutions:**
1. Use Method 1 (Auto-Configure button) - easiest!
2. Use Method 2 (Web configuration page)
3. Check if you're logged into the staff app

### "Cannot connect to printer service"

**Problem:** Auto-configure can't reach the printer service

**Solutions:**
1. Make sure printer service is running (check for terminal window)
2. Check if port 8765 is available:
   ```bash
   netstat -ano | findstr :8765
   ```
3. Try restarting the printer service
4. Use Method 2 (Web configuration) instead

### "Heartbeat not sending"

**Problem:** Configured but no heartbeats

**Solutions:**
1. Check Bar ID is correct (compare with staff app)
2. Check API URL is correct:
   - Production: `https://staff.tabeza.co.ke`
   - Local dev: `http://localhost:3003`
3. Check firewall isn't blocking outgoing connections
4. Restart printer service

### Configuration Not Persisting

**Problem:** Configuration resets when you restart

**Solution:**
- Check if `config.json` file exists in printer service folder
- Make sure printer service has write permissions
- Try running as administrator

---

## Configuration File Location

The configuration is saved in:
```
packages/printer-service/config.json
```

Example content:
```json
{
  "barId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "apiUrl": "https://staff.tabeza.co.ke",
  "driverId": "driver-YOURPC-1770829952890",
  "watchFolder": "C:\\Users\\YourName\\TabezaPrints"
}
```

---

## For Venue Owners

### First Time Setup:

1. Download Tabeza Connect from: https://tabeza.co.ke/downloads
2. Extract and run `tabeza-connect.exe`
3. Log into Tabeza Staff App
4. Go to Settings
5. Click "Auto-Configure Printer Service"
6. Done! Your printer is now connected

### Daily Use:

- Just start the printer service (double-click the exe)
- It will automatically reconnect using saved configuration
- Keep the terminal window open while using

---

## Support

If you're still having issues:

1. Check the troubleshooting section above
2. Check printer service logs in the terminal
3. Contact support: support@tabeza.co.ke
4. Include:
   - Error messages from terminal
   - Your Bar ID
   - Screenshot of the issue

---

**Last Updated:** 2025-01-11  
**Version:** 1.0.0
