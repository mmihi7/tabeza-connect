# Tabeza Connect - Final Steps to Run

## ✅ What's Done
- Package.json fixed (removed escpos-parser reference)
- Dependencies installed successfully
- Green logo copied to assets folder
- All code is ready

## 🎯 Next Steps (Manual)

### Step 1: Approve Electron Build (One Time)

When you run the electron app, pnpm will ask to approve the electron build script. 

**In your terminal:**
```bash
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron
```

**You'll see:**
```
? Choose which packages to build
❯ ○ electron
```

**Press:**
1. `SPACE` to select electron (it will show ●)
2. `ENTER` to confirm
3. When asked "Do you approve?", type `y` and press `ENTER`

### Step 2: Test the Electron App

After approving, the app should launch automatically.

**Expected:**
- Setup window appears (green theme)
- You can enter a test Bar ID
- Click "Save & Start Service"
- Green tray icon appears

### Step 3: Create Icon File (Still Needed)

Before building the installer, you need to create the Windows icon:

1. Go to: https://convertio.co/svg-ico/
2. Upload: `C:\Projects\Tabz\packages\printer-service\assets\logo-green.svg`
3. Download as `icon.ico`
4. Save to: `C:\Projects\Tabz\packages\printer-service\assets\icon.ico`

### Step 4: Build Installer

After icon is created:

```bash
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect build:electron
```

Output will be in: `packages/printer-service/dist/`

## 🐛 Troubleshooting

### "electron is not recognized"
This means the build approval didn't complete. Try again:
```bash
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron
```
And approve when prompted.

### Setup window doesn't appear
Delete test config:
```bash
del %APPDATA%\Tabeza\config.json
```
Then run again.

### Build fails - "icon.ico not found"
You need to create the icon file first (Step 3 above).

## 📋 Quick Command Reference

```bash
# Test Electron app
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron

# Build installer (after icon is created)
pnpm --filter @tabeza/connect build:electron

# Check if dependencies are installed
cd packages\printer-service
dir node_modules\electron
```

## ✅ Success Checklist

- [ ] Approved electron build script
- [ ] Electron app launches
- [ ] Setup window appears with green theme
- [ ] Can enter and save Bar ID
- [ ] Tray icon appears after setup
- [ ] Created icon.ico file
- [ ] Built installer successfully
- [ ] Installer runs and works

## 🎉 Almost There!

You're very close! Just need to:
1. Approve the electron build (one time)
2. Test the app
3. Create the icon file
4. Build the installer

Total time: ~10 minutes
