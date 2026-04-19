# CRITICAL FIX: USB Module Missing Native Bindings

## Problem

The service crashes on startup with:
```
Error: No native build was found for platform=win32 arch=x64 runtime=node abi=137
```

This is because the `usb` package requires native bindings that weren't included in the Electron build.

## Root Cause

The service has these dependencies that require native compilation:
- `usb`: ^2.17.0 (for USB printer detection)
- `serialport`: ^12.0.0 (for serial printer communication)

**TabezaConnect doesn't need these** because it uses Windows Printer Pooling (RedMon) instead of direct USB/serial communication.

## Solution

### Option 1: Remove USB Dependencies (Recommended)

Remove these from `src/service/package.json`:
```json
"usb": "^2.17.0",
"serialport": "^12.0.0"
```

Then rebuild:
```bash
cd src/service
npm install
cd ../..
npm run build:win:x64
```

### Option 2: Rebuild Native Modules for Electron

```bash
cd src/service
npm install --save-dev electron-rebuild
npx electron-rebuild
```

### Option 3: Make USB Import Optional (Quick Patch)

Find where `usb` is imported and wrap it in try/catch:

```javascript
let usb;
try {
  usb = require('usb');
} catch (e) {
  console.log('USB module not available - USB printer detection disabled');
  usb = null;
}
```

## Recommended Action

**Remove the USB and SerialPort dependencies** since TabezaConnect uses RedMon port monitoring, not direct hardware communication.

This will:
- Eliminate native module compilation issues
- Reduce package size
- Simplify deployment
- Remove unnecessary dependencies

## Files to Update

1. `src/service/package.json` - Remove usb and serialport
2. Any code that imports these modules - Make imports optional or remove
3. Rebuild Electron distribution
4. Rebuild installer

## Testing After Fix

```bash
cd "C:\Program Files\TabezaConnect\resources"
node service\index.js
```

Should see:
```
=== HTTP SERVER: Attempting to bind to 127.0.0.1:8765 ===
✓ HTTP server listening on http://127.0.0.1:8765
```

Not:
```
Error: No native build was found...
```
