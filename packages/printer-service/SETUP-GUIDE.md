# Tabeza Printer Service - Setup Guide

## What This Service Does

The Tabeza Printer Service monitors a folder on your computer for print files from your POS system and automatically relays them to Tabeza cloud for digital receipt delivery.

**Important:** This is NOT a printer driver. It's a file monitoring service that works with your existing POS printer setup.

## How It Works

```
POS System → Prints to File → Watch Folder → Tabeza Service → Cloud → Customer App
```

## Installation Steps

### 1. Download & Install

1. Download `tabeza-printer-service.exe` from GitHub releases
2. Run the .exe file
3. The service will start automatically and show a configuration screen

### 2. Configure the Service

**Option A: Via Settings Page (Recommended)**
1. Open Tabeza Staff App: http://localhost:3003/settings
2. Go to **Settings → Configuration** tab
3. Find the **Printer Setup** section
4. Copy your **Bar ID**
5. The service will show instructions on how to configure

**Option B: Via PowerShell**
```powershell
Invoke-WebRequest -Uri "http://localhost:8765/api/configure" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"barId": "YOUR_BAR_ID_HERE"}'
```

### 3. Configure Your POS System

You have two options:

#### Option A: Print to Folder (Recommended)
1. In your POS system, add a new printer
2. Choose **"Generic / Text Only"** printer driver
3. Set printer port to: **FILE**
4. Set output folder to: `C:\Users\YourUsername\TabezaPrints`
5. Test print from your POS

#### Option B: Use Windows Print to PDF
1. In your POS, select **"Microsoft Print to PDF"** as printer
2. When printing, save files to: `C:\Users\YourUsername\TabezaPrints`
3. The service will automatically detect and process them

## Watch Folder Location

Default: `C:\Users\YourUsername\TabezaPrints`

The service creates these subfolders:
- `processed/` - Successfully relayed receipts
- `errors/` - Failed receipts (check these if issues occur)

## Checking Service Status

Visit: http://localhost:8765/api/status

You should see:
```json
{
  "status": "running",
  "barId": "your-bar-id",
  "watchFolder": "C:\\Users\\YourUsername\\TabezaPrints",
  "configured": true
}
```

## Testing the Setup

1. Create a test file in the watch folder:
   - Open Notepad
   - Type some text (e.g., "Test Receipt")
   - Save as `test.txt` in `C:\Users\YourUsername\TabezaPrints`

2. Watch the service console - you should see:
   ```
   📄 New print file detected: test.txt
   📤 Sending to cloud: https://staff.tabeza.co.ke/api/printer/relay
   ✅ Print job relayed successfully
   ```

3. The file will move to `processed/` folder

## Troubleshooting

### Service Not Detecting Files
- Check the watch folder path is correct
- Ensure files are fully written before being detected
- Check the service console for errors

### Files Going to Error Folder
- Check service console for error messages
- Verify Bar ID is configured correctly
- Check internet connection

### POS Can't Print to Folder
- Some POS systems don't support "Print to File"
- Use "Microsoft Print to PDF" as alternative
- Or use a network printer that saves to the watch folder

## Running as Windows Service

To run the service automatically on Windows startup:

```powershell
# Install as Windows service
npm run install-service

# Uninstall service
npm run uninstall-service
```

## Support

If you encounter issues:
1. Check the service console for error messages
2. Visit http://localhost:8765/api/status to verify configuration
3. Check the `errors/` folder for failed print jobs
4. Contact Tabeza support with error details
