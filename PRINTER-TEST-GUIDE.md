# Printer Service Test Guide

Complete guide for testing the printer service end-to-end flow.

## Prerequisites

✅ Printer service is running (`START-PRINTER-SERVICE-WORKING.bat`)  
✅ Service shows Bar ID configured  
✅ Heartbeats are working (visible in terminal)  
✅ Heartbeats are being recorded in Supabase

## Test Flow Overview

```
1. Create Test Receipt
   ↓
2. Save to Watch Folder (C:\Users\mwene\TabezaPrints)
   ↓
3. Printer Service Detects File
   ↓
4. Service Reads & Processes Receipt
   ↓
5. Service Sends to Cloud API
   ↓
6. Cloud Stores in Database
   ↓
7. Cloud Parses with AI (DeepSeek)
   ↓
8. Receipt Available in Staff App
```

## Step 1: Generate Test Receipt

Run the test print job generator:

```cmd
node test-print-job.js
```

### Expected Output:

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Test Print Job Generator                                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

📁 Watch folder: C:\Users\mwene\TabezaPrints

📄 Generating test receipt...
   Receipt #: RCP-123456
   Items: 5
   Total: KES 2320.00

💾 Saving receipt to: test-receipt-1770914031811.txt

╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ✅ Test receipt created successfully!                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

## Step 2: Watch Printer Service Terminal

Immediately after creating the test receipt, check your printer service terminal window.

### Expected Output:

```
📄 New print file detected: test-receipt-1770914031811.txt
📤 Sending to cloud: https://tabz-kikao.vercel.app/api/printer/relay
✅ Print job relayed successfully
```

The file should be moved from the watch folder to:
- `C:\Users\mwene\TabezaPrints\processed\` (if successful)
- `C:\Users\mwene\TabezaPrints\errors\` (if failed)

## Step 3: Verify in Database

Run the verification script:

```cmd
node dev-tools/scripts/verify-print-job-flow.js
```

### Expected Output:

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Print Job Flow Verification                             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

🔍 Checking recent print jobs...

✅ Found 1 recent receipt(s):

📄 Receipt 1:
   ID: abc123...
   Driver ID: driver-MIHI-PC-1770655896151...
   Created: 2/12/2026, 4:45:30 PM
   Status: processed
   Parsed: Yes ✅
   Receipt #: RCP-123456
   Total: 2320.00
   Items: 5

🖨️  Printer Driver Status:
   Driver ID: driver-MIHI-PC-1770655896151...
   Status: online
   Last Heartbeat: 15s ago
   Version: 1.0.0

╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ✅ Verification Complete                                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

📊 Summary:
   • Receipts received: 1
   • Receipts parsed: 1
   • Unmatched receipts: 1
   • Printer driver: online
```

## Step 4: Check Staff App

1. Go to `https://tabz-kikao.vercel.app/settings`
2. Look for "Printer Status" section
3. Should show: **Connected** (green indicator)

## Troubleshooting

### Issue: File not detected

**Symptoms:**
- File stays in watch folder
- No output in printer service terminal

**Solutions:**
1. Check printer service is running
2. Verify watch folder path: `C:\Users\mwene\TabezaPrints`
3. Check file permissions
4. Restart printer service

### Issue: File detected but relay fails

**Symptoms:**
- File detected message appears
- Error sending to cloud
- File moved to `errors` folder

**Solutions:**
1. Check internet connection
2. Verify API URL is correct: `https://tabz-kikao.vercel.app`
3. Check Vercel Authentication is disabled
4. Look at error message in terminal

### Issue: Receipt not parsed

**Symptoms:**
- Receipt in database
- `parsed_data` is null
- Status is "pending"

**Solutions:**
1. Check DeepSeek API key is configured
2. Wait a few minutes (parsing is async)
3. Check cloud logs in Vercel dashboard
4. Verify receipt format is readable

### Issue: Receipt parsed but not matched to tab

**Symptoms:**
- Receipt parsed successfully
- Shows in `unmatched_receipts` table
- Not linked to any tab

**This is expected!** Receipts need to be manually matched to tabs in the staff app.

## Database Tables to Check

### 1. `printer_drivers`
Shows printer service heartbeat status:
```sql
SELECT * FROM printer_drivers 
WHERE bar_id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'
ORDER BY last_heartbeat_at DESC;
```

### 2. `printer_relay_receipts`
Shows all received receipts:
```sql
SELECT * FROM printer_relay_receipts 
WHERE bar_id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'
ORDER BY created_at DESC;
```

### 3. `unmatched_receipts`
Shows receipts waiting to be matched to tabs:
```sql
SELECT * FROM unmatched_receipts 
WHERE bar_id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'
ORDER BY created_at DESC;
```

## Success Criteria

✅ Test receipt file created  
✅ Printer service detected file  
✅ File sent to cloud successfully  
✅ Receipt stored in database  
✅ Receipt parsed by AI  
✅ Receipt shows in unmatched_receipts  
✅ Printer status shows "Connected" in staff app

## Next Steps After Successful Test

1. **Configure your actual POS** to print to the watch folder
2. **Test with real receipts** from your POS
3. **Match receipts to tabs** in the staff app
4. **Monitor the system** for any issues

## POS Configuration Options

### Option 1: Print to File (Recommended)
1. Add new printer in POS
2. Choose "Generic / Text Only" driver
3. Set port to: FILE
4. Set output folder to: `C:\Users\mwene\TabezaPrints`

### Option 2: Microsoft Print to PDF
1. Use Windows built-in "Microsoft Print to PDF"
2. When printing, save to: `C:\Users\mwene\TabezaPrints`
3. Save as `.txt` or `.prn` file

### Option 3: Network Printer Relay
1. Configure POS to print to network printer
2. Set up printer to save copies to watch folder
3. Requires printer with "Print to Folder" feature

---

**Status:** Ready for Testing  
**Last Updated:** 2026-02-12  
**Bar ID:** 438c80c1-fe11-4ac5-8a48-2fc45104ba31
