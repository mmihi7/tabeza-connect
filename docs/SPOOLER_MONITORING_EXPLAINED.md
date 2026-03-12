# Why Microsoft Print to PDF Doesn't Work with TabezaConnect

## The Problem

**Microsoft Print to PDF bypasses the Windows print spooler entirely.**

When you print to "Microsoft Print to PDF":
1. Windows sends the print job directly to the PDF driver
2. The PDF driver converts it to PDF format immediately
3. **No `.SPL` or `.SHD` files are created in `C:\Windows\System32\spool\PRINTERS`**
4. TabezaConnect never sees the print job

## Why This Matters

TabezaConnect monitors the Windows print spooler directory (`C:\Windows\System32\spool\PRINTERS`) for temporary print files that Windows creates when sending jobs to physical printers. Virtual printers like "Microsoft Print to PDF" don't use this mechanism.

## Which Printers Work with TabezaConnect?

### ✅ WILL WORK:
- **Physical thermal printers** (Epson TM-T88, Star TSP100, etc.)
- **Physical receipt printers** (any ESC/POS compatible printer)
- **Network printers** (that use Windows spooler)
- **Generic/Text Only printer** (Windows built-in driver)
- **USB printers** (any physical printer connected via USB)

### ❌ WON'T WORK:
- Microsoft Print to PDF
- Microsoft XPS Document Writer
- Some virtual/software printers that bypass the spooler

## Solution for Testing

### Option 1: Install a Generic/Text Only Printer (Recommended for Testing)

This creates a virtual printer that DOES use the Windows spooler:

```batch
cd c:\Projects\Tabz
install-test-printer.bat
```

This will:
1. Create a printer called "Tabeza Test Printer"
2. Use the built-in "Generic / Text Only" driver
3. Print jobs will go through the Windows spooler
4. TabezaConnect will capture them
5. Nothing will actually print (it's a test printer)

### Option 2: Use a Real Thermal Printer

If you have a physical thermal printer:
1. Install the printer driver normally
2. Connect the printer
3. Print to it from your POS
4. TabezaConnect will automatically capture the receipt

## How It Works in Production

In a real bar/restaurant:

1. **Bar has a thermal receipt printer** (e.g., Epson TM-T88)
2. **POS prints receipts to that printer** (normal operation)
3. **Windows spooler receives the print job** and creates `.SPL`/`.SHD` files temporarily
4. **TabezaConnect watches the spooler** and captures the receipt data
5. **Print job continues to the physical printer** (zero latency, POS doesn't know Tabeza exists)
6. **Receipt prints normally** AND gets uploaded to Tabeza cloud

## The Key Insight

TabezaConnect is designed to work with **real POS systems printing to real thermal printers**. It's a passive capture system that sits between the POS and the printer at the OS level.

For testing without a physical printer, you need to use a printer driver that actually uses the Windows spooler (like Generic/Text Only), not a virtual PDF printer.

## Next Steps

Run this to install a test printer:
```batch
cd c:\Projects\Tabz
install-test-printer.bat
```

Then print to "Tabeza Test Printer" from any application and watch TabezaConnect capture it!
