# Test Captain's Orders - Quick Guide

## 🚀 Ready to Test!

The Captain's Orders component is now integrated into your staff dashboard. Here's how to test it live.

## ⚡ Quick Start (3 Steps)

### Step 1: Start the TCP Server

```cmd
cd packages\printer-service
START-TCP-SERVER.bat
```

You should see:
```
╔════════════════════════════════════════════════════════════╗
║         TABEZA TCP SERVER - Production Ready              ║
╚════════════════════════════════════════════════════════════╝

✅ Server started successfully!

🌐 Listening on: 127.0.0.1:9100
☁️  Tabeza API: http://localhost:3003
🏪 Bar ID: 438c80c1-fe11-4ac5-8a48-2fc45104ba31

⏳ Waiting for print jobs...
```

### Step 2: Open Staff Dashboard

1. Open your browser
2. Go to: http://localhost:3003
3. Log in with your staff credentials
4. You should see the dashboard with tabs

### Step 3: Print from Notepad

1. Open Notepad
2. Type this:
   ```
   Test Receipt
   1 x Beer 150
   1 x Fries 100
   Total 250
   ```
3. File → Print
4. Select "TABEZA Test Printer"
5. Click Print

## 🎯 What Should Happen

### In TCP Server Console:
```
═══════════════════════════════════════════════════════════
📄 NEW PRINT JOB RECEIVED
═══════════════════════════════════════════════════════════
⏰ Time: 07/02/2026, 20:30:45
🔌 From: 127.0.0.1:xxxxx
🆔 Connection ID: 1738963845123

📦 Chunk 1: Received 256 bytes

✅ Print job complete
📊 Total size: 256 bytes in 1 chunks

💾 Saved locally: print-1738963845123.bin

📝 TEXT PREVIEW:
───────────────────────────────────────────────────────────
Test Receipt
1 x Beer 150
1 x Fries 100
Total 250
───────────────────────────────────────────────────────────

☁️  Sending to Tabeza cloud...
✅ Successfully sent to Tabeza!
📋 Job ID: abc123-def456-ghi789

🎯 Next steps:
   1. Open staff dashboard
   2. Go to Captain's Orders
   3. Assign this order to a tab
```

### In Staff Dashboard:

1. **Scroll down** below the tab cards
2. Look for **⚓ Captain's Orders** section
3. You should see a card with:
   - **Total:** KES 250.00
   - **Items:** Beer, Fries
   - **Timestamp:** Just now
   - **Button:** "Assign Tab" (blue)

### When You Click "Assign Tab":

1. Modal opens
2. Shows the receipt details:
   - Beer - KES 150.00
   - Fries - KES 100.00
   - Total: KES 250.00
3. Shows list of open tabs (radio buttons)
4. Select a tab
5. Click "Assign Order"

### After Assignment:

1. Receipt disappears from Captain's Orders
2. Success! The order is now assigned to the tab
3. Customer will see it as a pending order (needs approval)

## 🔍 Where to Look

### Captain's Orders Location
- **Page:** Staff Dashboard (main page)
- **Position:** Below the tab cards, above the footer
- **Section Title:** "⚓ Captain's Orders"
- **Visibility:** Only shows when `authority_mode = 'pos'`

### If You Don't See It

**Check 1: Authority Mode**
```sql
SELECT id, name, authority_mode, venue_mode 
FROM bars 
WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
```

Should show:
- `authority_mode = 'pos'`
- `venue_mode = 'basic'` or `'venue'`

**Check 2: Print Jobs**
```sql
SELECT id, status, received_at, parsed_data 
FROM print_jobs 
WHERE bar_id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31' 
AND status = 'no_match'
ORDER BY received_at DESC;
```

Should show unassigned print jobs.

**Check 3: Dev Server**
Make sure `pnpm dev:staff` is running on port 3003.

## 🎨 What It Looks Like

### Empty State
```
┌─────────────────────────────────────────────────┐
│ ⚓ Captain's Orders                              │
├─────────────────────────────────────────────────┤
│                                                 │
│  No pending orders. All orders have been        │
│  assigned to tabs.                              │
│                                                 │
└─────────────────────────────────────────────────┘
```

### With Orders
```
┌─────────────────────────────────────────────────┐
│ ⚓ Captain's Orders              [2 waiting]     │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ KES 250.00                    [Assign Tab]  │ │
│ │ Beer, Fries                                 │ │
│ │ Just now                                    │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ KES 180.00                    [Assign Tab]  │ │
│ │ Coffee, Cake                                │ │
│ │ 2m ago                                      │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Assignment Modal
```
┌─────────────────────────────────────────────────┐
│ Assign Order to Tab                        [X]  │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ KES 250.00                                  │ │
│ │ Beer - KES 150.00                           │ │
│ │ Fries - KES 100.00                          │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ○ Tab #1 - Opened 5m ago                        │
│ ● Tab #2 - Opened 10m ago                       │
│ ○ Tab #3 - Opened 15m ago                       │
│                                                 │
│ [Cancel]              [Assign Order]            │
└─────────────────────────────────────────────────┘
```

## 🐛 Troubleshooting

### "No pending orders" but I just printed
1. Check TCP server console - did it send successfully?
2. Check browser console (F12) - any errors?
3. Refresh the page (F5)
4. Check database: `SELECT * FROM print_jobs WHERE status = 'no_match'`

### TCP server not receiving prints
1. Check printer is installed: `Get-Printer -Name "TABEZA Test Printer"`
2. Check printer port: Should be `127.0.0.1:9100`
3. Restart TCP server
4. Try printing again

### Captain's Orders section not visible
1. Check authority mode in database
2. Make sure you're logged in as staff
3. Check browser console for errors
4. Try hard refresh (Ctrl+F5)

### Assignment fails
1. Check tab is still open
2. Check tab belongs to same bar
3. Check browser console for error details
4. Check API endpoint: http://localhost:3003/api/printer/assign-receipt

## 📊 Success Checklist

- [ ] TCP server starts without errors
- [ ] Dev server running on port 3003
- [ ] Staff dashboard loads
- [ ] Captain's Orders section visible
- [ ] Print from Notepad
- [ ] Receipt appears in Captain's Orders
- [ ] Click "Assign Tab"
- [ ] Modal opens with tab list
- [ ] Select a tab
- [ ] Click "Assign Order"
- [ ] Receipt disappears
- [ ] Order appears in tab details

## 🎉 You're Done!

Once all checklist items are complete, the system is working end-to-end!

**Next:** Test with a real POS system or train staff on the workflow.

---

**Need Help?**
- Check `CAPTAINS-ORDERS-INTEGRATION-COMPLETE.md` for full details
- Check `NOTEPAD-TO-TABEZA-INTEGRATION.md` for system overview
- Check TCP server console for detailed logs
- Check browser console (F12) for errors

**Happy Testing!** 🚀⚓
