# How to Configure TABEZA Virtual Printer to Print to Folder

## Current Situation

You have:
- ✅ TABEZA Virtual Printer installed in Windows
- ✅ Tabeza Printer Service running (monitoring folder)
- ❓ Printer port configuration unknown

## What We Need

The printer must be configured to output files to: `C:\Users\mwene\TabezaPrints`

## Step-by-Step Configuration

### Option 1: Configure Existing Printer to Print to Folder

1. **Open Printer Properties**
   - Press `Windows + R`
   - Type: `control printers`
   - Press Enter
   - Find "TABEZA Virtual Printer"
   - Right-click → **Printer properties** (not just "Properties")

2. **Go to Ports Tab**
   - Click the **Ports** tab at the top

3. **Add a New Local Port**
   - Click **Add Port...** button
   - Select **Local Port** from the list
   - Click **New Port...**

4. **Enter the Output Path**
   - In the "Port Name" field, enter:
     ```
     C:\Users\mwene\TabezaPrints\receipt.prn
     ```
   - Click **OK**

5. **Select the New Port**
   - Find the port you just created in the list
   - Check the checkbox next to it
   - Uncheck any other ports
   - Click **Apply** then **OK**

### Option 2: Use FILE: Port (Prompts for filename each time)

1. **Open Printer Properties**
   - Same as Option 1 above

2. **Go to Ports Tab**
   - Click the **Ports** tab

3. **Select FILE: Port**
   - Find **FILE:** in the port list
   - Check the checkbox next to it
   - Uncheck any other ports
   - Click **Apply** then **OK**

4. **When Printing**
   - Each time you print, Windows will ask where to save
   - Navigate to: `C:\Users\mwene\TabezaPrints`
   - Save the file (any name is fine)
   - The service will detect and process it

### Option 3: Create a New Printer with Correct Port

If the above doesn't work, create a fresh printer:

1. **Open Devices and Printers**
   - Press `Windows + R`
   - Type: `control printers`
   - Press Enter

2. **Add a Printer**
   - Click **Add a printer** at the top
   - Click **The printer that I want isn't listed**
   - Select **Add a local printer or network printer with manual settings**
   - Click **Next**

3. **Create a New Port**
   - Select **Create a new port**
   - Port type: **Local Port**
   - Click **Next**
   - Enter port name: `C:\Users\mwene\TabezaPrints\receipt.prn`
   - Click **OK**

4. **Select Printer Driver**
   - Manufacturer: **Generic**
   - Printers: **Generic / Text Only**
   - Click **Next**

5. **Name the Printer**
   - Printer name: **TABEZA Virtual Printer**
   - Click **Next**
   - Do NOT share the printer
   - Click **Next**
   - Click **Finish**

## Verify Configuration

Run this PowerShell script to check your configuration:

```powershell
.\check-printer-config.ps1
```

You should see:
- ✅ Printer found
- ✅ Port configured to FILE or local folder
- ✅ Tabeza service running

## Test the Setup

### Test 1: Print from Notepad

1. Open Notepad
2. Type some text: "Test Receipt"
3. File → Print
4. Select "TABEZA Virtual Printer"
5. Click Print

**Expected Result:**
- File appears in `C:\Users\mwene\TabezaPrints`
- Tabeza service console shows: "📄 New print file detected"
- File moves to `processed/` subfolder
- Receipt appears in Tabeza cloud

### Test 2: Check Service Console

The service console should show:
```
📄 New print file detected: receipt.prn
📤 Sending to cloud: https://staff.tabeza.co.ke/api/printer/relay
✅ Print job relayed successfully
```

## Troubleshooting

### Printer Not Printing to Folder

**Problem:** Files don't appear in the watch folder

**Solutions:**
1. Check printer port is set to FILE: or local folder path
2. Ensure folder exists: `C:\Users\mwene\TabezaPrints`
3. Check folder permissions (should be writable)
4. Try printing from Notepad first (simpler than POS)

### Service Not Detecting Files

**Problem:** Files appear but service doesn't process them

**Solutions:**
1. Check service is running: Visit http://localhost:8765/api/status
2. Restart the service
3. Check service console for errors
4. Verify watch folder path matches printer output path

### Permission Denied Errors

**Problem:** Can't write to folder or create port

**Solutions:**
1. Run as Administrator when configuring printer
2. Check folder permissions
3. Create folder manually if it doesn't exist

## Next Steps

After printer is configured:

1. ✅ Verify printer outputs to folder
2. ✅ Verify service detects files
3. ✅ Configure service with Bar ID (from Settings page)
4. ✅ Test with real POS system
5. ✅ Apply database migration: `database/add-printer-relay-tables.sql`

## Support

If you're still having issues:
1. Run `.\check-printer-config.ps1` and share the output
2. Check the service console for error messages
3. Try Option 3 (create new printer from scratch)
4. Contact support with screenshots of printer properties
