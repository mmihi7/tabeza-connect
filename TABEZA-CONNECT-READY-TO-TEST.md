# Tabeza Connect - Ready to Test! 🚀

## ✅ What's Complete

All code is written and ready:

1. ✅ **Electron Main Process** (`electron-main.js`)
   - First-run setup detection
   - Bar ID configuration
   - Auto-start shortcut creation
   - System tray icon
   - Process management

2. ✅ **Setup Window** (`setup.html`)
   - Beautiful green-themed UI
   - Bar ID input with validation
   - Professional design
   - Error handling

3. ✅ **Green Logo** (`assets/logo-green.svg`)
   - Copied from `public/logo - green.svg`
   - Ready for conversion to ICO

4. ✅ **Console Branding** (`index.js`)
   - Updated to "Tabeza Connect"
   - Green theme messaging

5. ✅ **Package Configuration** (`package.json`)
   - Electron dependencies listed
   - Build scripts configured
   - Ready for npm install

## 🎯 Your Action Items (30 minutes)

### Step 1: Create Windows Icon (5 minutes) ⏰
**You need to do this manually:**

1. Open browser: https://convertio.co/svg-ico/
2. Upload: `C:\Projects\Tabz\packages\printer-service\assets\logo-green.svg`
3. Click "Convert"
4. Download the ICO file
5. Save as: `C:\Projects\Tabz\packages\printer-service\assets\icon.ico`

**See detailed instructions:** `packages/printer-service/CREATE-ICON-NOW.md`

### Step 2: Install Dependencies (2 minutes)
```bash
cd C:\Projects\Tabz\packages\printer-service
npm install
```

This installs:
- electron (v28.0.0)
- electron-builder (v24.9.1)
- All other dependencies

### Step 3: Test Electron App (5 minutes)
```bash
npm run start:electron
```

**Expected behavior:**
- Setup window appears (green theme)
- You can enter a test Bar ID (e.g., "test_venue_123")
- Click "Save & Start Service"
- Window closes
- Green tray icon appears in system tray (bottom-right)
- Printer service starts in background

**Test the tray icon:**
- Right-click the green icon
- Should see menu with Bar ID
- Try "Open Configuration" option
- Try "Restart Service" option

### Step 4: Build Windows Installer (5 minutes)
```bash
npm run build:electron
```

**Output location:**
- `dist/Tabeza Connect Setup 1.0.0.exe`
- File size: ~100-150 MB

### Step 5: Test the Installer (10 minutes)
1. Close the Electron app if running
2. Delete test config: `del %APPDATA%\Tabeza\config.json`
3. Run the installer: `dist\Tabeza Connect Setup 1.0.0.exe`
4. Follow installation wizard
5. App should launch automatically
6. Setup window appears
7. Enter Bar ID and save
8. Verify tray icon appears
9. Check startup shortcut created:
   - Open: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\`
   - Should see "Tabeza Connect.lnk"
10. Restart Windows and verify auto-start works

## 📋 Testing Checklist

### Setup Flow
- [ ] Setup window has green theme
- [ ] Can enter Bar ID
- [ ] Empty Bar ID shows error
- [ ] Short Bar ID shows error
- [ ] Valid Bar ID saves successfully
- [ ] Window closes after save

### System Tray
- [ ] Green icon appears
- [ ] Right-click shows menu
- [ ] Menu shows correct Bar ID
- [ ] "Open Configuration" works
- [ ] "Restart Service" works
- [ ] "Exit" closes app

### Auto-Start
- [ ] Startup shortcut created
- [ ] Service auto-starts after reboot
- [ ] Config persists across restarts

### Service Functionality
- [ ] Printer service starts
- [ ] Can access http://localhost:8765/api/status
- [ ] Test print works (if configured)

## 🐛 Common Issues & Solutions

### "Cannot find module 'electron'"
```bash
npm install
```

### "icon.ico not found"
You need to create the icon file first (Step 1)

### Setup window doesn't appear
Delete config and try again:
```bash
del %APPDATA%\Tabeza\config.json
npm run start:electron
```

### Tray icon doesn't show
- Check Task Manager for "Tabeza Connect" process
- Try restarting the app
- Check Windows notification area settings

### Build fails
```bash
# Clean and rebuild
rmdir /s /q dist node_modules
npm install
npm run build:electron
```

## 📁 Important File Locations

### Development
- Source code: `C:\Projects\Tabz\packages\printer-service\`
- Logo: `assets/logo-green.svg`
- Icon: `assets/icon.ico` (you need to create this)

### After Installation
- Installed app: `C:\Program Files\Tabeza Connect\`
- Config file: `%APPDATA%\Tabeza\config.json`
- Logs folder: `%APPDATA%\Tabeza\logs\`
- Startup shortcut: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Tabeza Connect.lnk`

## 🎉 Success Criteria

You'll know it's working when:

1. ✅ Setup window appears with green theme
2. ✅ Can configure Bar ID successfully
3. ✅ Green tray icon appears after setup
4. ✅ Tray menu shows correct Bar ID
5. ✅ Service auto-starts after Windows restart
6. ✅ Installer creates working installation
7. ✅ No terminal window needed

## 📚 Documentation Reference

- **Quick Start:** `packages/printer-service/QUICK-START.md`
- **Icon Creation:** `packages/printer-service/CREATE-ICON-NOW.md`
- **Full Details:** `TABEZA-CONNECT-IMPLEMENTATION-SUMMARY.md`
- **Setup Guide:** `TABEZA-CONNECT-SETUP-COMPLETE.md`

## 🚀 After Testing

Once everything works:

1. **Upload installer** to hosting/CDN
2. **Add download link** to Staff Dashboard Settings page
3. **Create user guide** (video or documentation)
4. **Test with real venue** (beta testing)
5. **Roll out to all venues**

## 💡 Tips

- Test on a clean Windows machine if possible
- Try both fresh install and upgrade scenarios
- Verify uninstall removes everything cleanly
- Check that service connects to production API
- Test with real Bar ID from Staff Dashboard

---

## 🎯 Start Here

**Right now, do this:**

1. Open browser: https://convertio.co/svg-ico/
2. Upload `logo-green.svg` from assets folder
3. Download as `icon.ico`
4. Save to assets folder
5. Run `npm install`
6. Run `npm run start:electron`

**Estimated time:** 30 minutes total

---

**Status:** Ready for icon creation and testing
**Next Action:** Create icon.ico file (5 minutes)
**Documentation:** Complete ✅
**Code:** Complete ✅
**Testing:** Ready to begin ⏰
