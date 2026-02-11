# 🎉 Tabeza Connect - Ready to Run!

## ✅ Everything is Complete

All files are ready:
- ✅ Package.json configured
- ✅ Dependencies installed
- ✅ Green logo created
- ✅ Icon.ico file exists
- ✅ Electron main process ready
- ✅ Setup window HTML ready
- ✅ Auto-start logic implemented

## 🚀 Run It Now

### Open PowerShell and run:

```powershell
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron
```

### What You'll See:

1. **First time only:** pnpm will ask to approve electron build
   - Press `SPACE` to select electron
   - Press `ENTER` to confirm
   - Type `y` and press `ENTER` to approve

2. **Setup window appears** with green theme
   - Enter your Bar ID (from Tabeza Staff Dashboard → Settings)
   - Click "Save & Start Service"

3. **Green tray icon appears** in system tray (bottom-right)
   - Right-click for menu options
   - Service is now running

4. **Auto-start configured** - will start on Windows login

## 🎯 Test Bar ID

For testing, you can use any Bar ID format like:
- `test-bar-123`
- `venue_abc456`
- `my-test-venue`

(Must be at least 5 characters, alphanumeric with underscores/hyphens)

## 📦 Build Installer (Optional)

After testing, build the installer:

```powershell
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect build:electron
```

Installer will be in: `packages\printer-service\dist\Tabeza Connect Setup.exe`

## 🔧 Tray Icon Features

Right-click the green tray icon to:
- View current Bar ID
- See connection status
- Open configuration page
- Open staff dashboard
- Restart service
- View logs
- Exit

## 📁 Config Location

Configuration saved to:
```
%APPDATA%\Tabeza\config.json
```

To reset and see setup window again:
```powershell
del %APPDATA%\Tabeza\config.json
```

## 🎨 Branding

- **Name:** Tabeza Connect
- **Color:** Green (#4CAF50, #2E7D32)
- **Tagline:** "Bridge your POS to the cloud"
- **Icon:** Green connection symbol

## ✅ Success Checklist

- [ ] Run `pnpm --filter @tabeza/connect start:electron`
- [ ] Approve electron build (first time only)
- [ ] Setup window appears with green theme
- [ ] Enter test Bar ID
- [ ] Click "Save & Start Service"
- [ ] Green tray icon appears
- [ ] Right-click tray icon to see menu
- [ ] Service is running on port 8765

## 🐛 Troubleshooting

### Setup window doesn't appear
Delete config and try again:
```powershell
del %APPDATA%\Tabeza\config.json
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron
```

### "npm error" messages
Don't use `npm` commands. Always use `pnpm` from root directory.

### Tray icon doesn't appear
Check if service is running:
```powershell
netstat -ano | findstr :8765
```

### Want to see console logs
Run the Node.js service directly:
```powershell
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start
```

## 🎉 You're Done!

Everything is ready. Just run the command and test it!

```powershell
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron
```
