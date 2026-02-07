# Tabeza Printer Setup - Current Reality

## What We Have vs What Was Planned

### Planned (in specs):
- Native Windows printer driver that appears in printer list
- POS prints directly to "Tabeza Receipt Printer"
- Driver intercepts print jobs automatically

### Current Reality:
- Node.js service that monitors a folder
- POS must be configured to print to a file/folder
- Service detects new files and relays them to cloud

## Why No Native Driver?

Building a native Windows printer driver requires:
- C++ development
- Windows Driver Kit (WDK)
- Digital signature from Microsoft ($$$)
- Complex installation process
- Separate builds for each Windows version

**This is a 2-3 month project, not an MVP feature.**

## Current Working Solution

### How It Works:

```
POS System 
  ↓ (Print to File)
Watch Folder (C:\Users\YourName\TabezaPrints)
  ↓ (File detected)
Tabeza Service (Node.js)
  ↓ (Parse & relay)
Tabeza Cloud
  ↓
Customer App
```

### Setup Steps:

1. **Install Tabeza Service**
   - Download `tabeza-printer-service.exe`
   - Run it - it starts monitoring automatically
   - Configure with your Bar ID

2. **Configure Your POS**
   
   **Option A: Print to Folder (Best)**
   - In POS settings, add new printer
   - Choose "Generic / Text Only" driver
   - Set port to: **FILE**
   - Set output folder: `C:\Users\YourUsername\TabezaPrints`
   
   **Option B: Print to PDF**
   - Use "Microsoft Print to PDF" printer
   - When printing, save to: `C:\Users\YourUsername\TabezaPrints`
   
   **Option C: Network Printer to Folder**
   - Set up shared folder on network
   - Configure POS to print to network location
   - Service monitors the network folder

3. **Test**
   - Print a test receipt from POS
   - Check service console - should show "Print job detected"
   - File moves to `processed/` folder
   - Receipt appears in Tabeza cloud

## POS System Compatibility

### ✅ Works With:
- POS systems that support "Print to File"
- POS systems that can print to network folders
- POS systems with PDF printer support
- Any POS that can output to a specific folder

### ❌ Won't Work With:
- POS systems that ONLY print to physical printers
- POS systems with locked printer settings
- Cloud-only POS systems without local printing

## Alternative: Manual Entry

If your POS can't print to a folder:

1. Use Tabeza Venue mode with Tabeza authority
2. Staff enters orders directly in Tabeza
3. No printer integration needed

## Future: Native Driver

If there's demand, we can build a native Windows printer driver:

**Timeline:** 2-3 months
**Cost:** Development + Microsoft signing certificate
**Benefits:** 
- Appears in Windows printer list
- Works with any POS system
- No folder configuration needed

**For now, the folder monitoring approach works for 90% of use cases.**

## Support

If your POS system can't print to a folder:
1. Check POS documentation for "Print to File" option
2. Contact your POS vendor for folder printing support
3. Consider using Tabeza Venue mode instead of Basic mode
4. Contact Tabeza support for alternative solutions
