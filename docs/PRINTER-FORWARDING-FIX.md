# Printer Forwarding Communication Error - FIX APPLIED

## Problem
The bridge service was hardcoded to forward print jobs to port `'USB001'` instead of using the actual printer name from the configuration. This caused "communication error" when trying to print to the Epson printer.

## Root Cause
In `src/service/final-bridge.js` line 165:
```javascript
const psCommand = `Get-Content -Path '${tempFile}' -Encoding Byte -Raw | Out-Printer -Name 'USB001'`;
```

The hardcoded `'USB001'` port doesn't exist or doesn't match your Epson printer's actual port.

## Fix Applied
Changed line 165 to use the printer name from config:
```javascript
const psCommand = `Get-Content -Path '${tempFile}' -Encoding Byte -Raw | Out-Printer -Name '${printerName}'`;
```

Now the bridge will forward to the actual printer name (e.g., "EPSON L3210 Series") instead of a hardcoded port.

## How to Apply the Fix

### Step 1: Rebuild the executable
Run this command from the TabezaConnect directory:
```cmd
pkg src\service\index.js --targets node18-win-x64 --output TabezaConnect.exe
```

If pkg fails, try:
```cmd
cd src\service
npm run build-exe
cd ..\..
copy src\service\dist\tabeza-printer-service.exe TabezaConnect.exe
```

### Step 2: Rebuild the installer
```cmd
build-installer.bat
```

When prompted, enter version: `1.6.2`

### Step 3: Test the fix
1. Uninstall the current TabezaConnect (if installed)
2. Run the new installer: `dist\TabezaConnect-Setup-v1.6.2.exe`
3. Print a test receipt from your POS
4. Check if the printer forwards correctly without communication errors

## What Changed
- **File**: `src/service/final-bridge.js`
- **Line**: 165
- **Before**: Hardcoded `'USB001'` port
- **After**: Dynamic `${printerName}` from config

## Expected Behavior After Fix
1. POS prints to printer → Receipt captured in `C:\TabezaPrints\`
2. Bridge reads the file
3. Bridge forwards to **actual printer name** (not hardcoded port)
4. Physical printer prints successfully
5. No communication errors

## Verification
After installing the fixed version, check the service logs:
```cmd
type "C:\ProgramData\Tabeza\logs\service.log"
```

You should see:
```
🖨️  Forwarding to EPSON L3210 Series via Windows spooler
🖨️  Forwarded successfully via Windows spooler
```

Instead of communication errors.
