# 🎉 Tabeza Connect - Complete Implementation Guide

## What is Tabeza Connect?

**Tabeza Connect** is the desktop application that bridges POS systems with Tabeza cloud for digital receipts. It's the rebranded "Tabeza Printer Service" with a user-friendly setup experience.

### Key Features
- ✅ **First-run setup window** - No terminal needed
- ✅ **Auto-start on Windows login** - Set it and forget it
- ✅ **System tray integration** - Always accessible
- ✅ **Green branding** - Represents "connection"
- ✅ **Single instance** - Prevents conflicts

## 🎯 When to Use Tabeza Connect

### Required For:
- **Tabeza Basic mode** (POS-authoritative)
- **Tabeza Venue mode with POS authority**

### Not Needed For:
- **Tabeza Venue mode with Tabeza authority** (no POS integration)

## 📋 What's Been Implemented

### ✅ Completed Files

1. **Package Configuration**
   - `packages/printer-service/package.json`
   - Renamed to `@tabeza/connect`
   - Electron dependencies added
   - Build scripts configured

2. **Electron Main Process**
   - `packages/printer-service/electron-main.js`
   - First-run detection
   - Setup window management
   - Config loading/saving
   - Auto-start shortcut creation
   - System tray icon
   - Single instance lock
   - Printer service process management

3. **Setup Window**
   - `packages/printer-service/setup.html`
   - Green theme (#4CAF50, #2E7D32)
   - Bar ID input with validation
   - Clear instructions
   - Error handling
   - Loading states

4. **Assets**
   - `packages/printer-service/assets/logo-green.svg` ✅
   - `packages/printer-service/assets/icon.ico` ✅

5. **Branding Updates**
   - `packages/printer-service/index.js` - Console branding updated
   - All references changed from "Tabeza Printer Service" to "Tabeza Connect"

## 🚀 How to Run

### Step 1: Open PowerShell

```powershell
cd C:\Projects\Tabz
```

### Step 2: Start Electron App

```powershell
pnpm --filter @tabeza/connect start:electron
```

### Step 3: Approve Build (First Time Only)

You'll see:
```
? Choose which packages to build
  ○ electron
```

**Actions:**
1. Press `SPACE` to select electron (● appears)
2. Press `ENTER` to confirm
3. Type `y` when asked "Do you approve?"
4. Press `ENTER`

### Step 4: Use Setup Window

1. **Setup window appears** with green theme
2. **Enter Bar ID** from Tabeza Staff Dashboard → Settings
3. **Click "Save & Start Service"**
4. **Green tray icon appears** in system tray

### Step 5: Verify It's Running

Right-click the green tray icon to see:
- Current Bar ID
- Connection status
- Configuration options
- Service controls

## 📦 Build Installer

After testing, create the installer:

```powershell
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect build:electron
```

**Output:** `packages\printer-service\dist\Tabeza Connect Setup.exe`

## 🔧 Configuration

### Config File Location
```
%APPDATA%\Tabeza\config.json
```

### Config Structure
```json
{
  "barId": "venue_abc123",
  "apiUrl": "https://staff.tabeza.co.ke",
  "driverId": "driver-HOSTNAME-1234567890",
  "watchFolder": "C:\\Users\\USERNAME\\TabezaPrints",
  "installedAt": "2026-02-11T12:00:00.000Z",
  "autoStart": true,
  "notificationShown": false
}
```

### Reset Configuration

To see setup window again:
```powershell
del %APPDATA%\Tabeza\config.json
```

## 🎨 Branding Guidelines

### Colors
- **Primary Green:** #4CAF50
- **Dark Green:** #2E7D32
- **Light Green:** #E8F5E9

### Naming
- **Product Name:** Tabeza Connect
- **Tagline:** "Bridge your POS to the cloud"
- **Icon:** Green connection symbol (🔗)

### Visual Identity
- Green represents "connection" and "active"
- Distinct from Tabeza Venue (green theme in onboarding)
- Professional, trustworthy, technical

## 🔍 Architecture

### Process Flow

```
Electron Main Process
├── First Run Check
│   ├── No config → Show setup window
│   └── Has config → Start service
├── Setup Window (setup.html)
│   ├── Bar ID input
│   ├── Validation
│   └── Save config
├── Printer Service (index.js)
│   ├── Watch folder for receipts
│   ├── Parse receipts (DeepSeek + regex)
│   └── Send to Tabeza API
└── System Tray
    ├── Status indicator
    ├── Configuration menu
    └── Service controls
```

### Auto-Start Implementation

1. **Shortcut Creation**
   - Location: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`
   - Target: Electron executable
   - Created via VBScript

2. **Single Instance Lock**
   - Prevents multiple instances
   - Focuses existing window if already running

3. **Background Operation**
   - Runs in system tray
   - No console window
   - Minimal resource usage

## 🐛 Troubleshooting

### "npm error" Messages

**Problem:** Using `npm` in a `pnpm` workspace

**Solution:** Always use `pnpm` from root:
```powershell
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron
```

### Setup Window Doesn't Appear

**Problem:** Config already exists

**Solution:** Delete config and restart:
```powershell
del %APPDATA%\Tabeza\config.json
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron
```

### Tray Icon Doesn't Appear

**Problem:** Service failed to start

**Solution:** Check if port 8765 is available:
```powershell
netstat -ano | findstr :8765
```

### Build Fails

**Problem:** Icon file missing

**Solution:** Verify icon exists:
```powershell
dir C:\Projects\Tabz\packages\printer-service\assets\icon.ico
```

### Service Not Receiving Receipts

**Problem:** Watch folder not configured

**Solution:** Check config file has correct `watchFolder` path

## 📚 Related Documentation

### Parser Architecture
- `dev-tools/docs/captains-order-parsing-rule.md`
- Uses DeepSeek API + regex fallback
- Confidence-based approach (high/medium/low)
- Never rejects receipts

### API Integration
- `apps/staff/app/api/printer/relay/route.ts`
- Accepts all receipts (200 OK always)
- Stores confidence level in metadata
- Creates print_jobs record

### Receipt Parser
- `packages/shared/services/receiptParser.ts`
- DeepSeek API for extraction
- Regex fallback for totals
- Returns confidence level

## ✅ Testing Checklist

- [ ] Run `pnpm --filter @tabeza/connect start:electron`
- [ ] Approve electron build (first time)
- [ ] Setup window appears with green theme
- [ ] Enter test Bar ID (e.g., `test-venue-123`)
- [ ] Click "Save & Start Service"
- [ ] Green tray icon appears
- [ ] Right-click tray icon - menu appears
- [ ] Service running on port 8765
- [ ] Config saved to `%APPDATA%\Tabeza\config.json`
- [ ] Startup shortcut created
- [ ] Build installer succeeds
- [ ] Installer runs and installs correctly

## 🎯 Next Steps for Production

### 1. Code Signing
- Sign the installer with a code signing certificate
- Prevents Windows SmartScreen warnings
- Builds trust with users

### 2. Auto-Update
- Implement electron-updater
- Check for updates on startup
- Download and install silently

### 3. Logging
- Add structured logging
- Rotate log files
- Send errors to monitoring service

### 4. Crash Reporting
- Integrate Sentry or similar
- Capture unhandled exceptions
- Send crash reports

### 5. Telemetry
- Track usage metrics
- Monitor connection health
- Measure parsing success rates

## 🎉 Success!

Tabeza Connect is fully implemented and ready to test. Just run:

```powershell
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron
```

The setup window will guide you through the rest!

## 📞 Support

For issues or questions:
1. Check this guide first
2. Review error messages in console
3. Check logs in `%APPDATA%\Tabeza\logs`
4. Verify configuration in `%APPDATA%\Tabeza\config.json`
