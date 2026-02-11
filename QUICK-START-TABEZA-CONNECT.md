# ⚡ Tabeza Connect - Quick Start

## 🚀 Run It Now

```powershell
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron
```

## 📋 First Time Setup

1. **Approve build** (one time only)
   - Press `SPACE` to select electron
   - Press `ENTER` to confirm
   - Type `y` and press `ENTER`

2. **Enter Bar ID** in setup window
   - Get from: Staff Dashboard → Settings
   - Format: `venue_abc123` or `test-bar-123`

3. **Click "Save & Start Service"**

4. **Done!** Green tray icon appears

## 🔧 Common Commands

```powershell
# Test the app
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron

# Build installer
pnpm --filter @tabeza/connect build:electron

# Reset config (to see setup again)
del %APPDATA%\Tabeza\config.json
```

## 🐛 Quick Fixes

### "npm error"
❌ Don't use `npm` commands
✅ Use `pnpm` from root directory

### Setup window won't show
```powershell
del %APPDATA%\Tabeza\config.json
```

### Check if running
```powershell
netstat -ano | findstr :8765
```

## 📁 Important Paths

- **Config:** `%APPDATA%\Tabeza\config.json`
- **Startup:** `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`
- **Installer:** `packages\printer-service\dist\`

## ✅ Success Indicators

- ✅ Green tray icon visible
- ✅ Right-click shows menu
- ✅ Port 8765 listening
- ✅ Config file exists

## 📚 Full Documentation

See `TABEZA-CONNECT-COMPLETE-GUIDE.md` for detailed information.
