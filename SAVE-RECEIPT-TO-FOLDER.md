# How to Print from Your POS to Tabeza

## The Problem with Notepad Print

When you use Notepad's "Print" feature, Windows adds:
- Print job headers
- Page formatting
- Printer driver metadata
- Extra whitespace and control characters

This makes it hard for the AI to parse the receipt correctly.

## The Right Way: Save Directly to Folder

Instead of printing from Notepad, **save the file directly** to the watch folder.

### Method 1: Save As (Recommended)

1. Open your receipt in Notepad
2. Click **File → Save As**
3. Navigate to: `C:\Users\mwene\TabezaPrints`
4. Save as: `receipt-001.txt` (or any name)
5. Click Save

✅ The printer service will detect it immediately!

### Method 2: Copy File

1. Create your receipt as a `.txt` file anywhere
2. Copy the file
3. Paste into: `C:\Users\mwene\TabezaPrints`

✅ The printer service will detect it immediately!

### Method 3: Use the Test Script (Best for Testing)

We already have a script that creates perfect test receipts:

```cmd
node test-print-job.js
```

This creates a properly formatted receipt and saves it directly to the watch folder.

## For Your Actual POS System

Your POS system should be configured to **save receipts as files**, not print them through Windows Print Dialog.

### Option 1: POS "Print to File" Feature

Most POS systems have a "Print to File" option:

1. Open POS settings
2. Go to Printer Configuration
3. Select: **Print to File** or **Save to Folder**
4. Set output folder: `C:\Users\mwene\TabezaPrints`
5. Set file format: **Plain Text (.txt)**

### Option 2: Generic Text Printer with FILE Port

1. In POS, add new printer
2. Driver: **Generic / Text Only**
3. Port: **FILE**
4. Output folder: `C:\Users\mwene\TabezaPrints`

### Option 3: Virtual Printer (If POS doesn't support Print to File)

If your POS can only print (not save files), you'll need a virtual printer:

1. Install **PDFCreator** or similar
2. Configure it to:
   - Output format: Plain Text (.txt)
   - Auto-save to: `C:\Users\mwene\TabezaPrints`
   - No prompts (automatic)
3. Set this as your receipt printer in POS

## Testing Right Now

To test the system properly without your POS:

### Quick Test (30 seconds):

```cmd
node test-print-job.js
```

This will:
1. Create a realistic receipt
2. Save it to the watch folder
3. Printer service detects it
4. Sends to cloud
5. Parses with AI
6. Shows in staff app

### Manual Test (if you want to create your own):

1. Create a file called `my-receipt.txt`
2. Add this content:

```
========================================
         MY TEST RECEIPT
========================================
Receipt #: 12345
Date: 2/12/2026
Time: 3:00 PM

QTY  ITEM                      AMOUNT
----------------------------------------
2    Tusker Lager 500ml       500.00
1    Nyama Choma              800.00
3    Pilsner 500ml            600.00
----------------------------------------

TOTAL:                       1900.00
========================================
```

3. Save it to: `C:\Users\mwene\TabezaPrints\my-receipt.txt`
4. Watch the printer service terminal!

## Why This Matters

**Printing from Notepad** = Windows adds formatting → AI can't parse → No prices shown

**Saving file directly** = Clean text → AI parses correctly → Prices show up

## Next Steps

1. **Stop printing from Notepad**
2. **Use the test script**: `node test-print-job.js`
3. **Or save files directly** to the watch folder
4. **Configure your actual POS** to save receipts as files

---

**The key insight:** Your POS should **save receipt files**, not **print through Windows**. This gives you clean, parseable text that the AI can understand.
