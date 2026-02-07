# Simple Connection Diagram

## The Answer: POS Prints to a Windows Printer

```
┌──────────────┐
│  POS System  │  ← Any POS (Square, Toast, Custom, etc.)
└──────┬───────┘
       │
       │ Clicks "Print Receipt"
       │ Sends to printer named "TABEZA Virtual Printer"
       │
       ▼
┌─────────────────────────────────────────┐
│  Windows Printer                        │
│  Name: "TABEZA Virtual Printer"         │  ← You already have this!
│  Driver: Generic / Text Only            │
│  Port: Outputs to folder                │
└──────┬──────────────────────────────────┘
       │
       │ Saves print job as file
       │
       ▼
┌─────────────────────────────────────────┐
│  Folder                                 │
│  C:\Users\mwene\TabezaPrints\          │  ← Files appear here
│  receipt-12345.prn                      │
└──────┬──────────────────────────────────┘
       │
       │ Node.js watches this folder
       │
       ▼
┌─────────────────────────────────────────┐
│  Node.js Service                        │
│  tabeza-printer-service.exe             │  ← Running on your machine
│  - Detects new files                    │
│  - Reads content                        │
│  - Sends to cloud                       │
└──────┬──────────────────────────────────┘
       │
       │ HTTP POST
       │
       ▼
┌─────────────────────────────────────────┐
│  Cloud API                              │
│  staff.tabeza.co.ke/api/printer/relay   │
│  - Parse receipt                        │
│  - Match to tab                         │
│  - Deliver to customer                  │
└─────────────────────────────────────────┘
```

## Key Point

**The POS doesn't connect to Node.js!**

The POS just prints to a regular Windows printer.
Windows saves the print job to a folder.
Node.js watches that folder.

## Why This Works

Every POS system knows how to print. That's all we need!

## What You Need to Do

1. **Configure the printer** (5 min)
   - Change port from `FILE:` to folder path
   - See: `PRINTER-PORT-SETUP-GUIDE.md`

2. **Test it** (2 min)
   - Print from Notepad
   - Check folder for file
   - Check service console

3. **Configure POS** (5 min)
   - Select "TABEZA Virtual Printer" in POS settings
   - Test print
   - Done!

## Example: How Square POS Would Use This

```
Square POS:
1. Go to Settings → Hardware → Printers
2. Add Printer → Select "TABEZA Virtual Printer"
3. Set as receipt printer
4. Done!

When cashier rings up sale:
- Square prints to "TABEZA Virtual Printer"
- Windows saves to folder
- Node.js sends to cloud
- Customer gets digital receipt

Square doesn't know about Tabeza!
It just prints to a Windows printer.
```

## This Works With

- ✅ Square
- ✅ Toast  
- ✅ Clover
- ✅ Any POS that can print
- ✅ Even custom POS systems

Because they all know how to print to a Windows printer!
