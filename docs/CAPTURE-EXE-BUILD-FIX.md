# Capture.exe Build Configuration - Fixed ✅

**Date:** 2026-03-09  
**Issue:** Tabeza POS Printer not created because capture.exe was missing  
**Status:** Fixed

## Problem

The Redmon printer configuration script (`configure-redmon-printer.ps1`) was failing because it couldn't find `capture.exe` at the expected location:
- Expected: `C:\Program Files\TabezaConnect\capture.exe`
- Actual: File didn't exist

The capture.exe is required by Redmon to process print jobs:
1. POS prints to "Tabeza POS Printer"
2. Redmon intercepts the print job
3. Redmon pipes the data to `capture.exe` via stdin
4. capture.exe processes and uploads the receipt

## Root Cause

1. **capture.exe wasn't being built** - No build script was running before electron-builder
2. **capture.exe wasn't included in the installer** - Not listed in `extraResources`

## Solution

### 1. Added capture.exe to extraResources

Updated `package.json` to include capture.exe in the electron-builder output:

```json
"extraResources": [
  {
    "from": "dist",
    "to": ".",
    "filter": [
      "capture.exe"
    ]
  },
  // ... other resources
]
```

This copies `dist/capture.exe` to the root of the installation directory.

### 2. Added Build Scripts

Added scripts to build capture.exe before building the Electron app:

```json
"scripts": {
  "build:capture": "cd src/capture && npm run build",
  "prebuild": "npm run build:capture",
  "build": "electron-builder",
  // ...
}
```

The `prebuild` script automatically runs before any `build` command, ensuring capture.exe is always built first.

## Build Process

### Manual Build

```bash
# Build capture.exe only
npm run build:capture

# Build everything (capture.exe + Electron app)
npm run build
```

### What Happens

1. **prebuild hook runs** → Executes `npm run build:capture`
2. **build:capture runs** → Changes to `src/capture` and runs `npm run build`
3. **pkg compiles** → Creates `dist/capture.exe` from `src/capture/index.js`
4. **electron-builder runs** → Copies `dist/capture.exe` to installer via extraResources
5. **NSIS installer** → Installs capture.exe to `C:\Program Files\TabezaConnect\`

## File Locations

### Development
```
tabeza-connect/
├── src/capture/
│   ├── index.js           ← Source code
│   ├── package.json       ← Build script: pkg index.js
│   └── build-capture.js
└── dist/
    └── capture.exe        ← Built executable (~40-50 MB)
```

### Production (After Installation)
```
C:\Program Files\TabezaConnect\
├── TabezaConnect.exe      ← Main Electron app
├── capture.exe            ← Capture script (NEW!)
├── resources/
│   ├── scripts/           ← PowerShell scripts
│   ├── redmon19/          ← Redmon installer
│   └── public/            ← Dashboard HTML
└── assets/
    └── icon-green.ico
```

## How Redmon Uses capture.exe

### Redmon Port Configuration (Registry)

```
HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port\Ports\TabezaCapturePort

Command      : C:\Program Files\TabezaConnect\capture.exe
Arguments    : --bar-id UNCONFIGURED
Output       : (empty = stdin)
ShowWindow   : 0 (hidden)
RunUser      : 0 (LocalService)
Delay        : 300ms
```

### Data Flow

```
POS System
    ↓ (prints to)
Tabeza POS Printer
    ↓ (Generic/Text Only driver)
Redmon Port Monitor
    ↓ (pipes stdin to)
capture.exe
    ↓ (processes and saves)
C:\TabezaPrints\order.prn
    ↓ (watched by)
Tabeza Connect Service
    ↓ (uploads to)
Tabeza Cloud
```

## Testing Checklist

- [ ] Build capture.exe: `npm run build:capture`
- [ ] Verify dist/capture.exe exists (~40-50 MB)
- [ ] Build installer: `npm run build:installer`
- [ ] Install Tabeza Connect
- [ ] Verify capture.exe exists at `C:\Program Files\TabezaConnect\capture.exe`
- [ ] Check "Tabeza POS Printer" exists in Windows Devices
- [ ] Verify Redmon port configuration in registry
- [ ] Test print job → Should create order.prn

## Files Modified

1. **package.json**
   - Added `build:capture` script
   - Added `prebuild` hook
   - Added capture.exe to `extraResources`

## Next Steps

1. Build the project: `npm run build`
2. Install and test the printer configuration
3. Verify capture.exe is working by printing a test receipt

---

**Implementation Status:** ✅ Complete - Ready for Build and Testing
