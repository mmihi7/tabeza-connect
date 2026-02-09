# Tabeza Printer Service - User Setup Guide

## Overview
The Tabeza Printer Service connects your POS system's receipts to the Tabeza cloud platform, enabling digital receipt delivery to customers.

## Who Needs This?
- Venues using **Tabeza Basic** mode (POS integration)
- Venues using **Tabeza Venue** mode with POS authority

## Installation Steps

### Step 1: Download the Printer Service
1. Go to your Tabeza Staff App: https://staff.tabeza.co.ke/settings
2. Scroll to the "Printer Setup" section
3. Click "Download Printer Service"
4. Save the file to your computer (the one connected to your POS printer)

### Step 2: Run the Printer Service
1. Double-click the downloaded file: `tabeza-printer-service.exe`
2. Windows may show a security warning - click "More info" then "Run anyway"
3. A black terminal window will open showing the service status

### Step 3: Configure with Your Bar ID

**Option A: Easy Web Configuration (Recommended)**
1. The terminal will show: `http://localhost:8765/configure.html`
2. Open this link in your web browser
3. You'll see a configuration page
4. Enter your Bar ID (found in Tabeza Settings → Printer Setup)
5. Click "Configure Printer Service"
6. Done! ✅

**Option B: Copy Bar ID from Settings**
1. Go to https://staff.tabeza.co.ke/settings
2. Find the "Printer Setup" section
3. Click "Copy Bar ID" button
4. Paste it in the configuration page

### Step 4: Verify Connection
1. Go back to https://staff.tabeza.co.ke
2. The printer status should now show "Connected" (green)
3. Click "Test Print" to verify it's working

## What Happens Next?

Once configured:
- The printer service runs in the background
- When your POS prints a receipt, it's automatically sent to Tabeza
- Receipts appear in "Captain's Orders" for staff to assign to customer tabs
- Customers receive digital receipts on their phones

## Troubleshooting

### "Disconnected" Status
- Make sure the printer service is running (check the terminal window)
- Verify you entered the correct Bar ID
- Check that port 8765 isn't blocked by firewall

### "Test Print Failed"
- Ensure the printer service is configured with your Bar ID
- Check the terminal window for error messages
- Try restarting the printer service

### Service Won't Start
- Make sure no other program is using port 8765
- Try running as Administrator (right-click → Run as administrator)
- Check Windows Defender isn't blocking it

## Configuration Details

### What Gets Configured?
- **Bar ID**: Links the printer service to your venue
- **API URL**: Points to production (https://staff.tabeza.co.ke)
- **Watch Folder**: Where print files are monitored (C:\Users\YourName\TabezaPrints)

### Configuration File Location
The configuration is saved to:
```
C:\path\to\tabeza-printer-service\config.json
```

You can edit this file manually if needed.

## POS Printer Setup

After configuring the printer service, set up your POS to print to the watch folder:

### Option 1: Print to File
1. In your POS system, add a new printer
2. Choose "Generic / Text Only" printer driver
3. Set printer port to: **FILE**
4. Set output folder to: `C:\Users\YourName\TabezaPrints`

### Option 2: Microsoft Print to PDF
1. Use Windows built-in "Microsoft Print to PDF" printer
2. When printing, save files to: `C:\Users\YourName\TabezaPrints`

## Support

If you need help:
1. Check the terminal window for error messages
2. Visit the configuration page: http://localhost:8765/configure.html
3. Contact Tabeza support with your Bar ID

## Advanced: Command Line Configuration

For technical users, you can configure via PowerShell:

```powershell
Invoke-WebRequest -Uri "http://localhost:8765/api/configure" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"barId": "YOUR_BAR_ID_HERE", "apiUrl": "https://staff.tabeza.co.ke"}'
```

Replace `YOUR_BAR_ID_HERE` with your actual Bar ID from Settings.
