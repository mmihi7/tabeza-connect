# Connect Your Actual POS System to Tabeza

Now that testing is complete, here's how to connect your real POS system.

## Prerequisites

✅ Printer service running (`START-PRINTER-SERVICE-WORKING.bat`)  
✅ Test receipts working  
✅ Watch folder exists: `C:\Users\mwene\TabezaPrints`

## Option 1: Print to File (Recommended - Easiest)

This is the simplest method - configure your POS to save receipts as text files.

### Steps:

1. **Open your POS printer settings**
   - Go to POS system settings
   - Find "Printers" or "Receipt Printer" section

2. **Add a new printer**
   - Click "Add Printer" or "New Printer"
   - Name it: "Tabeza Receipt Relay"

3. **Select printer driver**
   - Choose: "Generic / Text Only"
   - Or: "Generic Text Printer"
   - Or: "Plain Text"

4. **Configure printer port**
   - Port type: **FILE**
   - Output folder: `C:\Users\mwene\TabezaPrints`

5. **Test from POS**
   - Print a test receipt from your POS
   - File should appear in watch folder
   - Printer service will detect it within 2 seconds
   - Check staff app for the receipt

### Advantages:
- ✅ No additional software needed
- ✅ Works with any POS system
- ✅ Most reliable method
- ✅ Easy to troubleshoot

---

## Option 2: Microsoft Print to PDF

Use Windows built-in PDF printer and manually save to watch folder.

### Steps:

1. **In your POS, select printer**
   - Choose: "Microsoft Print to PDF"

2. **When printing**
   - POS will prompt for save location
   - Navigate to: `C:\Users\mwene\TabezaPrints`
   - Save as: `.txt` or `.prn` file (not PDF!)
   - Click Save

3. **Printer service detects file**
   - Service processes it automatically
   - Receipt appears in staff app

### Advantages:
- ✅ No POS configuration needed
- ✅ Works immediately

### Disadvantages:
- ❌ Manual save each time
- ❌ Staff must remember to save to correct folder
- ❌ Not fully automatic

---

## Option 3: Network Printer with Folder Output

If you have a network printer that supports "Print to Folder" feature.

### Steps:

1. **Configure network printer**
   - Access printer web interface
   - Enable "Print to Folder" or "Scan to Folder"
   - Set destination: `\\MIHI-PC\TabezaPrints` (network share)

2. **Share the watch folder**
   - Right-click `C:\Users\mwene\TabezaPrints`
   - Properties → Sharing → Advanced Sharing
   - Share name: `TabezaPrints`
   - Permissions: Full Control for printer

3. **Configure POS**
   - Point POS to network printer
   - Printer automatically saves copies to folder

### Advantages:
- ✅ Fully automatic
- ✅ Physical receipts still print
- ✅ Digital copy saved automatically

### Disadvantages:
- ❌ Requires compatible printer
- ❌ More complex setup
- ❌ Network configuration needed

---

## Option 4: Virtual Printer (Advanced)

Create a virtual printer that intercepts print jobs.

### Requirements:
- Virtual printer software (e.g., PDFCreator, Bullzip)
- Auto-save configuration

### Steps:

1. **Install virtual printer software**
   - Download PDFCreator or similar
   - Install with default settings

2. **Configure auto-save**
   - Set output format: Plain Text (.txt)
   - Set auto-save folder: `C:\Users\mwene\TabezaPrints`
   - Enable "Auto-save without prompting"

3. **Configure POS**
   - Select virtual printer as receipt printer
   - Test print from POS

### Advantages:
- ✅ Fully automatic
- ✅ No manual intervention

### Disadvantages:
- ❌ Requires additional software
- ❌ More complex setup
- ❌ May need license for commercial use

---

## Recommended Setup for Your POS

Based on your setup, I recommend **Option 1: Print to File**.

### Quick Setup Instructions:

1. Open your POS system
2. Go to Settings → Printers
3. Add new printer: "Tabeza Relay"
4. Driver: Generic Text
5. Port: FILE
6. Folder: `C:\Users\mwene\TabezaPrints`
7. Test print

That's it! Every receipt will automatically:
1. Save to watch folder
2. Get detected by printer service
3. Send to cloud
4. Parse with AI
5. Appear in staff app
6. Ready to assign to tabs

---

## Testing Your POS Connection

After configuring your POS:

### 1. Print a test receipt from POS

### 2. Check printer service terminal
You should see:
```
📄 New print file detected: receipt-123.txt
📤 Sending to cloud: https://tabz-kikao.vercel.app/api/printer/relay
✅ Print job relayed successfully
```

### 3. Verify in staff app
- Go to `https://tabz-kikao.vercel.app`
- Check "Captain's Orders" section
- Your receipt should appear
- Click "Assign Tab" to link it to a customer

### 4. Check database (optional)
```cmd
node dev-tools/scripts/verify-print-job-flow.js
```

---

## Troubleshooting

### POS doesn't have "Print to File" option

**Solution:** Use Option 2 (Microsoft Print to PDF) or Option 4 (Virtual Printer)

### Files not appearing in watch folder

**Check:**
- Folder path is correct: `C:\Users\mwene\TabezaPrints`
- POS has write permissions to folder
- Files are being saved (check folder manually)

### Printer service not detecting files

**Check:**
- Printer service is running
- Watch folder path is correct
- Files are `.txt`, `.prn`, or similar text format (not `.pdf`)

### Receipts not parsing correctly

**Check:**
- Receipt format is plain text
- Receipt contains item names and prices
- Receipt has clear structure (not encrypted or binary)

---

## Production Checklist

Before going live with customers:

- [ ] POS configured to print to watch folder
- [ ] Test receipt successfully processed
- [ ] Receipt appears in staff app
- [ ] Staff can assign receipts to tabs
- [ ] Printer service runs automatically on startup
- [ ] Watch folder has enough disk space
- [ ] Backup/archive strategy for processed receipts

---

## Next Steps

1. **Configure your POS** using Option 1 (recommended)
2. **Print a test receipt** from your actual POS
3. **Verify it appears** in Captain's Orders
4. **Assign it to a test tab** to complete the flow
5. **Train your staff** on the assignment process

---

**Need Help?**

If you encounter issues:
1. Check printer service terminal for errors
2. Verify files are being created in watch folder
3. Run verification script: `node dev-tools/scripts/verify-print-job-flow.js`
4. Check Supabase database for received receipts

**Your system is ready for production!** 🚀
