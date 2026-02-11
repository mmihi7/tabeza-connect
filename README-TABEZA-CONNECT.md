# 🔗 Tabeza Connect

**Bridge your POS to the cloud**

Tabeza Connect is a desktop application that enables POS systems to send receipts to Tabeza for digital receipt delivery and customer engagement.

## ⚡ Quick Start

```powershell
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron
```

First time: Approve electron build, enter Bar ID, done!

## 📖 Documentation

- **[Complete Guide](TABEZA-CONNECT-COMPLETE-GUIDE.md)** - Full implementation details
- **[Quick Start](QUICK-START-TABEZA-CONNECT.md)** - Fast reference
- **[Status](TABEZA-CONNECT-STATUS.md)** - Implementation status
- **[NPM Error Fix](TABEZA-CONNECT-NPM-ERROR-FIX.md)** - Troubleshooting

## 🎯 What It Does

1. **First Run:** Shows setup window to configure Bar ID
2. **Auto-Start:** Runs automatically on Windows login
3. **System Tray:** Lives in system tray with right-click menu
4. **Receipt Bridge:** Watches for POS receipts and sends to Tabeza
5. **Digital Receipts:** Customers get receipts on their phones

## 🎨 Features

- ✅ User-friendly setup (no terminal needed)
- ✅ Auto-start on Windows login
- ✅ System tray integration
- ✅ Single instance enforcement
- ✅ Green branding (connection theme)
- ✅ Configuration management
- ✅ Service monitoring

## 🔧 Requirements

- **Windows 10/11**
- **Node.js 18+**
- **pnpm** (for development)
- **Tabeza venue in Basic or Venue+POS mode**

## 📦 Build Installer

```powershell
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect build:electron
```

Output: `packages/printer-service/dist/Tabeza Connect Setup.exe`

## 🏗️ Architecture

```
Electron App (electron-main.js)
├── Setup Window (setup.html)
├── System Tray
├── Config Management
├── Auto-Start Setup
└── Printer Service (index.js)
    ├── Receipt Watching
    ├── DeepSeek Parser
    └── Tabeza API Client
```

## 🎨 Branding

- **Name:** Tabeza Connect
- **Colors:** Green (#4CAF50, #2E7D32)
- **Icon:** Green connection symbol
- **Tagline:** "Bridge your POS to the cloud"

## 📁 Key Files

```
packages/printer-service/
├── electron-main.js      # Electron main process
├── setup.html            # First-run setup window
├── index.js              # Printer service
├── package.json          # Package config
└── assets/
    ├── logo-green.svg    # Green logo
    └── icon.ico          # Windows icon
```

## 🔍 Configuration

**Location:** `%APPDATA%\Tabeza\config.json`

**Structure:**
```json
{
  "barId": "venue_abc123",
  "apiUrl": "https://staff.tabeza.co.ke",
  "driverId": "driver-HOSTNAME-1234567890",
  "watchFolder": "C:\\Users\\USERNAME\\TabezaPrints",
  "autoStart": true
}
```

## 🐛 Troubleshooting

### Setup window doesn't appear
```powershell
del %APPDATA%\Tabeza\config.json
```

### "npm error" messages
Use `pnpm` from root, not `npm` from subdirectory

### Check if running
```powershell
netstat -ano | findstr :8765
```

## 📚 Related Documentation

- [Parser Architecture](dev-tools/docs/captains-order-parsing-rule.md)
- [API Integration](apps/staff/app/api/printer/relay/route.ts)
- [Receipt Parser](packages/shared/services/receiptParser.ts)

## ✅ Status

**Implementation:** ✅ Complete  
**Testing:** Ready  
**Documentation:** Complete  
**Build:** Ready

## 🎯 Use Cases

### Tabeza Basic Mode
- **Required:** Yes
- **Purpose:** Bridge POS receipts to Tabeza
- **Authority:** POS-only

### Tabeza Venue + POS Mode
- **Required:** Yes
- **Purpose:** Mirror POS receipts digitally
- **Authority:** POS-authoritative

### Tabeza Venue + Tabeza Mode
- **Required:** No
- **Purpose:** N/A (no POS integration)
- **Authority:** Tabeza-authoritative

## 🚀 Getting Started

1. **Run the app:**
   ```powershell
   cd C:\Projects\Tabz
   pnpm --filter @tabeza/connect start:electron
   ```

2. **First time setup:**
   - Approve electron build
   - Enter Bar ID from Staff Dashboard
   - Click "Save & Start Service"

3. **Verify:**
   - Green tray icon appears
   - Right-click for menu
   - Service running on port 8765

4. **Done!**
   - Service auto-starts on login
   - Receipts automatically sent to Tabeza

## 📞 Support

For issues:
1. Check documentation above
2. Review logs in `%APPDATA%\Tabeza\logs`
3. Verify config in `%APPDATA%\Tabeza\config.json`
4. Check service status: `netstat -ano | findstr :8765`

---

**Version:** 1.0.0  
**Status:** Ready to Test  
**Last Updated:** 2026-02-11
