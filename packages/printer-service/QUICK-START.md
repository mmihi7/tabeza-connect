# Tabeza Connect - Quick Start Guide

## 🚀 Get Running in 5 Steps

### Step 1: Create Windows Icon (5 minutes)
```bash
# Go to: https://convertio.co/svg-ico/
# Upload: assets/logo-green.svg
# Download as: icon.ico
# Save to: assets/icon.ico
```

**Or use ImageMagick:**
```bash
cd assets
magick convert logo-green.svg -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

### Step 2: Install Dependencies (2 minutes)
```bash
cd packages/printer-service
npm install
```

### Step 3: Test Electron App (2 minutes)
```bash
npm run start:electron
```

**Expected:**
- Setup window appears
- Enter any test Bar ID (e.g., "test_venue_123")
- Click "Save & Start Service"
- Tray icon appears (green)
- Service starts

### Step 4: Build Installer (5 minutes)
```bash
npm run build:electron
```

**Output:**
- `dist/Tabeza Connect Setup 1.0.0.exe`

### Step 5: Test Installer (10 minutes)
```bash
# Run the installer
cd dist
start "Tabeza Connect Setup 1.0.0.exe"
```

**Verify:**
- Installer runs
- Setup window appears
- Can configure Bar ID
- Service starts
- Tray icon appears
- Auto-start works (check Startup folder)

---

## ✅ Success Checklist

After completing all steps:

- [ ] `icon.ico` file exists in `assets/`
- [ ] Dependencies installed (`node_modules/` exists)
- [ ] Electron app runs (`npm run start:electron`)
- [ ] Setup window appears and works
- [ ] Tray icon appears after setup
- [ ] Installer builds successfully
- [ ] Installer runs on test machine
- [ ] Auto-start shortcut created
- [ ] Service connects to cloud

---

## 🐛 Troubleshooting

### "Cannot find module 'electron'"
```bash
npm install
```

### "icon.ico not found"
Create the icon file first (Step 1)

### Setup window doesn't appear
Delete config and try again:
```bash
# Windows
del %APPDATA%\Tabeza\config.json
npm run start:electron
```

### Tray icon doesn't appear
- Check if Electron process is running (Task Manager)
- Try restarting: Close and run `npm run start:electron` again

### Build fails
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build:electron
```

---

## 📁 File Locations

### Development
- Source: `packages/printer-service/`
- Config: `packages/printer-service/config.json` (if running from source)

### Installed App
- Executable: `C:\Program Files\Tabeza Connect\`
- Config: `%APPDATA%\Tabeza\config.json`
- Logs: `%APPDATA%\Tabeza\logs\`
- Startup: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\`

---

## 🎯 Next Steps After Testing

1. **Upload installer** to hosting/CDN
2. **Add download link** to Staff Dashboard Settings
3. **Create user documentation** (video/guide)
4. **Announce to venues** via email/dashboard
5. **Monitor support requests** for issues

---

## 📞 Need Help?

- **Documentation:** See `TABEZA-CONNECT-IMPLEMENTATION-SUMMARY.md`
- **Icon Guide:** See `CREATE-ICON-GUIDE.md`
- **Full Details:** See `TABEZA-CONNECT-SETUP-COMPLETE.md`

---

**Estimated Total Time:** 30 minutes
**Difficulty:** Easy
**Prerequisites:** Node.js, npm, Windows machine
