# Current Printer Status

## ✅ What's Working

Your printer "TABEZA Virtual Printer" is installed and configured:
- **Name:** TABEZA Virtual Printer
- **Driver:** Generic / Text Only ✅ (Correct!)
- **Port:** FILE: ⚠️ (Will prompt for filename)

## How It Currently Works

When you print from your POS:

1. POS sends print job to "TABEZA Virtual Printer"
2. Windows shows a "Save As" dialog
3. You must navigate to: `C:\Users\mwene\TabezaPrints`
4. Save the file (any name is fine, e.g., `receipt.prn`)
5. Tabeza service detects the new file
6. Service processes and relays to cloud
7. File moves to `processed/` folder

## ⚠️ Current Limitation

**You must manually save each print job to the correct folder.**

This works but requires manual intervention for each receipt.

## 🎯 Recommended: Configure Automatic Folder Output

To make printing fully automatic (no "Save As" dialog), you need to change the printer port from `FILE:` to a specific folder path.

### Steps to Configure Automatic Output:

1. **Open Control Panel**
   - Press `Windows + R`
   - Type: `control printers`
   - Press Enter

2. **Open Printer Properties**
   - Find "TABEZA Virtual Printer"
   - Right-click → **Printer properties** (not just "Properties")

3. **Go to Ports Tab**
   - Click the **Ports** tab

4. **Add New Local Port**
   - Click **Add Port...** button
   - Select **Local Port**
   - Click **New Port...**

5. **Enter Output Path**
   - Port Name: `C:\Users\mwene\TabezaPrints\receipt.prn`
   - Click **OK**

6. **Select the New Port**
   - Find your new port in the list
   - Check the checkbox next to it
   - **Uncheck FILE:**
   - Click **Apply** → **OK**

### After Configuration:

When you print:
- ✅ No "Save As" dialog
- ✅ Files automatically go to `C:\Users\mwene\TabezaPrints`
- ✅ Service automatically detects and processes
- ✅ Fully automated workflow

## Testing Your Current Setup

### Test with Notepad:

1. Open Notepad
2. Type: "Test Receipt - $(Get-Date)"
3. File → Print
4. Select "TABEZA Virtual Printer"
5. Click Print
6. **Save As dialog appears**
7. Navigate to: `C:\Users\mwene\TabezaPrints`
8. Save as: `test-receipt.txt`

### Check Service Console:

You should see:
```
📄 New print file detected: test-receipt.txt
📤 Sending to cloud: https://staff.tabeza.co.ke/api/printer/relay
✅ Print job relayed successfully
```

### Check Folder:

- File should move to: `C:\Users\mwene\TabezaPrints\processed\`

## Next Steps

1. **Option A: Use Current Setup (Manual)**
   - Keep FILE: port
   - Manually save each print job to the folder
   - Works but requires manual intervention

2. **Option B: Configure Automatic (Recommended)**
   - Follow steps above to add local port
   - Fully automated - no manual saving needed
   - Better for production use

3. **After Printer is Working:**
   - Configure service with Bar ID (Settings page)
   - Apply database migration: `database/add-printer-relay-tables.sql`
   - Test with real POS system

## Service Configuration

Your Tabeza Printer Service needs to be configured with your Bar ID:

1. Open: http://localhost:3003/settings
2. Go to **Configuration** tab
3. Find **Printer Setup** section
4. Copy your Bar ID
5. Service will show configuration instructions

## Database Migration

Once printer is working, apply the database migration:

1. Open Supabase SQL Editor
2. Copy contents of: `database/add-printer-relay-tables.sql`
3. Run the SQL
4. This creates tables for print jobs and digital receipts

## Support

If you need help:
- Check service console for errors
- Visit: http://localhost:8765/api/status
- Verify folder exists: `C:\Users\mwene\TabezaPrints`
