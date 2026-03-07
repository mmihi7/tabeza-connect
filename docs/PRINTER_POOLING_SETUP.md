# Windows Printer Pooling Setup for Tabeza Connect

## Overview
Windows Printer Pooling allows your POS system to print to **both** your physical printer AND Tabeza Connect simultaneously.

## What This Does
- POS prints to "Tabeza POS Printer"
- Windows automatically sends the job to **TWO destinations**:
  1. **Physical printer** - Receipt prints on paper ✅
  2. **TabezaConnect** - Receipt uploads to cloud ✅

## Step-by-Step Setup

### 1. Open Printer Settings
1. Press `Windows Key + R`
2. Type `control printers` and press Enter
3. OR: Start → Settings → Devices → Printers & Scanners

### 2. Create Tabeza Capture Port
1. In Printers window, click **"Print server properties"** (top bar)
2. Go to **"Ports"** tab
3. Click **"Add Port..."**
4. Select **"Local Port"** → Click **"New Port..."**
5. Enter port name: `TabezaCapturePort`
6. Click **OK** → **Close**

### 3. Find Your Physical Printer Port
1. Right-click your **actual receipt printer** → **"Properties"**
2. Go to **"Ports"** tab
3. Note the checked port (usually `USB001`, `USB002`, etc.)
4. Click **Cancel**

### 4. Create Tabeza POS Printer (Pooled)
1. Click **"Add a printer"**
2. Select **"Add a local printer"**
3. Choose **"Use an existing port"**
4. **Select BOTH ports**:
   - Hold `Ctrl` key
   - Click your physical port (e.g., `USB001`)
   - Click `TabezaCapturePort`
   - Both should be highlighted
5. Click **"Next"**
6. Choose your printer manufacturer/model
7. Name it: **`Tabeza POS Printer`**
8. Click **"Next"** → **"Finish"**

### 5. Test the Setup
1. Right-click **"Tabeza POS Printer"** → **"Set as default printer"**
2. Print a test receipt from your POS
3. Check:
   - ✅ Receipt prints on paper
   - ✅ TabezaConnect tray icon turns green
   - ✅ Check http://localhost:8765/api/status

## Troubleshooting

### If Receipt Doesn't Print
- Wrong physical port selected
- Physical printer offline
- Check physical printer properties

### If Tabeza Doesn't Capture
- `TabezaCapturePort` not created correctly
- TabezaConnect service not running
- Check watch folder: `C:\ProgramData\Tabeza\TabezaPrints`

### If Both Fail
- Port pooling not configured correctly
- Recreate "Tabeza POS Printer" from step 4

## Verification
After setup, you should see:
- **"Tabeza POS Printer"** in your printer list
- **Two ports checked** in its properties
- **Green tray icon** when printing
- **Receipts appear** in Tabeza dashboard

## Support
If you need help:
1. Check TabezaConnect tray icon status
2. Visit http://localhost:8765 for diagnostics
3. Contact Tabeza support
