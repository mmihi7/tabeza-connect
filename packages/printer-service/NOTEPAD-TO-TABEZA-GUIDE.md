# Notepad to Tabeza - Complete Guide

## 🎯 What This Does

Allows you to print from **any application** (Notepad, Word, Excel, etc.) and have it appear in **Captain's Orders** on the Tabeza staff dashboard.

**Flow:**
```
Notepad → Print → TABEZA Test Printer → TCP Server → Tabeza Cloud → Captain's Orders
```

## 📋 Prerequisites

- Windows 10 or later
- Node.js installed
- Tabeza staff dashboard running (or deployed)
- Your Bar ID from Tabeza

## 🚀 Quick Start (5 Minutes)

### Step 1: Set Your Bar ID

Open Command Prompt and set your Bar ID:

```cmd
set TABEZA_BAR_ID=your-actual-bar-id-here
```

**How to find your Bar ID:**
1. Open Tabeza staff dashboard
2. Go to Settings
3. Copy your Bar ID

**Optional:** Set API URL if not using localhost:
```cmd
set TABEZA_API_URL=https://your-tabeza-domain.com
```

### Step 2: Install the Test Printer

Open PowerShell as Administrator:

```powershell
cd packages/printer-service
.\setup-test-printer.ps1
```

This creates "TABEZA Test Printer" that sends to localhost:9100.

### Step 3: Start the TCP Server

```cmd
cd packages/printer-service
node tabeza-tcp-server.js
```

You should see:
```
✅ Server started successfully!
🌐 Listening on: 127.0.0.1:9100
☁️  Tabeza API: http://localhost:3003
🏪 Bar ID: your-bar-id
⏳ Waiting for print jobs...
```

**Keep this window open!**

### Step 4: Test with Notepad

1. Open **Notepad**
2. Type some text:
   ```
   1 x Tusker 250
   1 x White Cap 250
   Total 500
   ```
3. Click **File → Print**
4. Select **"TABEZA Test Printer"**
5. Click **Print**

### Step 5: Check Captain's Orders

1. Open Tabeza staff dashboard
2. Go to **Captain's Orders** section
3. You should see your print job!
4. Click **"Assign Tab"** to assign it to a customer

## 🎉 Success!

You've successfully connected Notepad to Tabeza!

## 📊 What Happens Behind the Scenes

1. **Notepad prints** → Windows sends data to "TABEZA Test Printer"
2. **Printer port** → Configured to send to localhost:9100
3. **TCP Server** → Receives data on port 9100
4. **Parse & Send** → Extracts text and sends to Tabeza API
5. **Cloud Storage** → Stored in `print_jobs` table as "no_match"
6. **Captain's Orders** → Appears in staff dashboard
7. **Staff assigns** → Captain selects which tab gets the order
8. **Customer receives** → Digital receipt delivered to customer app

## 🔧 Advanced Configuration

### Permanent Environment Variables

To avoid setting Bar ID every time:

**Windows:**
1. Search for "Environment Variables"
2. Click "Edit system environment variables"
3. Click "Environment Variables"
4. Under "User variables", click "New"
5. Variable name: `TABEZA_BAR_ID`
6. Variable value: `your-bar-id`
7. Click OK

### Run as Windows Service

To run the TCP server automatically on startup:

```cmd
npm install -g node-windows
node install-service.js
```

(You'll need to create `install-service.js` - let me know if you want this)

### Custom Port

Edit `tabeza-tcp-server.js`:

```javascript
const CONFIG = {
  port: 9101, // Change this
  // ...
};
```

Then update printer port:
```powershell
Set-PrinterPort -Name "TABEZA_TEST_PORT" -PrinterHostAddress "127.0.0.1" -PortNumber 9101
```

## 🧪 Testing Different Scenarios

### Test 1: Simple Receipt
```
Beer 150
Soda 50
Total 200
```

### Test 2: Multiple Items
```
2 x Tusker 250
1 x Nyama Choma 450
3 x Soda 50
Subtotal 950
Tax 95
Total 1045
```

### Test 3: Table Number
```
Table 5
1 x Burger 350
1 x Fries 150
Total 500
```

## 🐛 Troubleshooting

### "Port 9100 already in use"

**Solution 1:** Find what's using it:
```cmd
netstat -ano | findstr :9100
taskkill /PID [PID] /F
```

**Solution 2:** Use different port (see Custom Port above)

### "TABEZA_BAR_ID is required"

Make sure you set the environment variable:
```cmd
set TABEZA_BAR_ID=your-bar-id
```

### "Failed to send to Tabeza"

**Check API URL:**
```cmd
curl http://localhost:3003/api/printer/relay
```

Should return: `{"status":"online"}`

**Check Bar ID is valid:**
- Open staff dashboard
- Verify Bar ID in settings

### "Printer not found"

Re-run the setup script:
```powershell
.\setup-test-printer.ps1
```

Verify printer exists:
```powershell
Get-Printer -Name "TABEZA Test Printer"
```

### No data received

**Check printer port:**
```powershell
Get-PrinterPort -Name "TABEZA_TEST_PORT" | Format-List
```

Should show:
- PrinterHostAddress: 127.0.0.1
- PortNumber: 9100

**Check firewall:**
```powershell
Test-NetConnection -ComputerName localhost -Port 9100
```

## 📝 Next Steps

### For Production Use:

1. **Deploy to real server:**
   - Set `TABEZA_API_URL` to your production URL
   - Use your production Bar ID

2. **Configure POS:**
   - Instead of Notepad, configure your POS
   - Point POS printer to "TABEZA Test Printer"
   - All POS receipts will flow to Captain's Orders

3. **Staff training:**
   - Show staff how to use Captain's Orders
   - Explain tab assignment workflow
   - Practice with test prints

4. **Monitor:**
   - Check `received-prints/` folder for saved prints
   - Monitor TCP server console for errors
   - Check Captain's Orders regularly

## 🎯 Real-World Usage

Once this is working with Notepad, you can use it with:

- ✅ **POS Systems** - Configure POS to print to TABEZA printer
- ✅ **Word/Excel** - Print invoices, reports, anything
- ✅ **PDF Readers** - Print PDF receipts
- ✅ **Web Browsers** - Print web pages
- ✅ **Any Windows app** - If it can print, it can send to Tabeza

The TCP server doesn't care what sends the data - it just receives, parses, and forwards to Tabeza!

## 💡 Pro Tips

1. **Keep server running:** Use Windows Service or Task Scheduler
2. **Monitor logs:** Check console output for errors
3. **Test regularly:** Print test receipts to verify system works
4. **Backup prints:** The `received-prints/` folder keeps all raw data
5. **Train staff:** Make sure they know how to use Captain's Orders

## 🆘 Need Help?

If you're stuck:

1. Check the console output for error messages
2. Verify all environment variables are set
3. Test with Notepad first before trying POS
4. Check the `received-prints/` folder to see if data is being saved
5. Verify Tabeza API is running and accessible

---

**You're all set!** Print from Notepad and watch it appear in Captain's Orders. 🚀
