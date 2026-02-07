# How ANY POS Connects to Tabeza - Step by Step

## The Key: POS Doesn't Connect Directly to Node.js!

**The POS connects to a Windows PRINTER, and the printer outputs to a FOLDER that Node.js watches.**

## The Complete Flow (Visual)

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: POS System                                          │
│ (Any POS - Square, Toast, Clover, Custom, etc.)            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ POS clicks "Print Receipt"
                 │ Sends to printer: "TABEZA Virtual Printer"
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Windows Printer System                              │
│                                                              │
│ Printer Name: "TABEZA Virtual Printer"                      │
│ Driver: Generic / Text Only (built into Windows)            │
│ Port: FILE: or Local Port                                   │
│ Output: C:\Users\mwene\TabezaPrints\receipt.prn            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Windows saves print job as file
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Folder on Computer                                  │
│                                                              │
│ Location: C:\Users\mwene\TabezaPrints\                     │
│ File appears: receipt-12345.prn                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Node.js service detects new file (chokidar)
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Node.js Service (tabeza-printer-service.exe)       │
│                                                              │
│ - Watches folder for new files                              │
│ - Reads file content                                        │
│ - Sends to cloud API                                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ HTTP POST to cloud
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Cloud API (staff.tabeza.co.ke)                     │
│                                                              │
│ - Receives receipt data                                     │
│ - Parses receipt text                                       │
│ - Matches to customer tab                                   │
│ - Stores in database                                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Real-time update
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 6: Customer Tab (customer app)                         │
│                                                              │
│ Customer sees digital receipt on their phone                │
└─────────────────────────────────────────────────────────────┘
```

## The Magic: Windows Printer as Bridge

**POS systems don't need to know about Tabeza!**

They just print to a regular Windows printer. Windows handles the rest.

### How to Configure (One-Time Setup)

#### In Windows:
1. Open Control Panel → Devices and Printers
2. Find "TABEZA Virtual Printer" (you already have this!)
3. Right-click → Printer Properties
4. Go to Ports tab
5. Add new Local Port: `C:\Users\mwene\TabezaPrints\receipt.prn`
6. Select that port
7. Done!

#### In POS System:
1. Go to POS printer settings
2. Select printer: "TABEZA Virtual Printer"
3. Done!

**That's it!** The POS now prints to Tabeza automatically.

## Real Example: Square POS

```
Square POS Settings:
├── Printers
│   └── Receipt Printer
│       ├── Name: TABEZA Virtual Printer  ← Select this
│       └── Auto-print: Yes
```

When cashier completes sale:
1. Square sends print job to "TABEZA Virtual Printer"
2. Windows saves to folder
3. Node.js detects file
4. Sends to cloud
5. Customer gets receipt

**Square doesn't know about Tabeza. It just prints to a Windows printer.**

## Why This Works with ANY POS

Every POS system can print receipts. That's all we need!

### Compatible POS Systems:
- ✅ Square
- ✅ Toast
- ✅ Clover
- ✅ Lightspeed
- ✅ Shopify POS
- ✅ Custom POS systems
- ✅ ANY system that can print

### Requirements:
1. POS must be able to select a printer
2. That's it!

## Current Status on Your Machine

You already have:
- ✅ Windows printer installed: "TABEZA Virtual Printer"
- ✅ Node.js service running: `tabeza-printer-service.exe`
- ✅ Folder created: `C:\Users\mwene\TabezaPrints`

What's missing:
- ⏳ Printer port configuration (currently set to FILE:)
- ⏳ Cloud API enhancement (parse and match receipts)
- ⏳ Database tables (store receipts)

## Next Steps

### 1. Configure Printer Port (5 minutes)
Change from `FILE:` to automatic folder output:
- Follow guide in `PRINTER-PORT-SETUP-GUIDE.md`

### 2. Test with Notepad (2 minutes)
1. Open Notepad
2. Type: "Test Receipt - Beer 150.00"
3. Print to "TABEZA Virtual Printer"
4. File appears in folder
5. Service detects and sends to cloud

### 3. Configure Real POS (5 minutes)
1. Open POS printer settings
2. Select "TABEZA Virtual Printer"
3. Test print
4. Done!

## Summary

**POS → Windows Printer → Folder → Node.js → Cloud → Customer**

The POS doesn't connect to Node.js directly. It prints to a Windows printer, which outputs to a folder, which Node.js watches.

This is why it works with ANY POS system - they all know how to print!
