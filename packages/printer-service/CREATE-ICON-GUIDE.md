# Create Windows Icon for Tabeza Connect

## Quick Start (Easiest Method)

### Option 1: Online Converter (Recommended)
1. Go to https://convertio.co/svg-ico/
2. Click "Choose Files"
3. Select `assets/logo-green.svg`
4. Click "Convert"
5. Download the ICO file
6. Save as `assets/icon.ico`

**Done!** ✅

---

## Alternative Methods

### Option 2: CloudConvert (Also Easy)
1. Go to https://cloudconvert.com/svg-to-ico
2. Upload `assets/logo-green.svg`
3. Click "Convert"
4. Download and save as `assets/icon.ico`

### Option 3: ImageMagick (Command Line)

**Install ImageMagick:**
- Windows: https://imagemagick.org/script/download.php#windows
- Or use Chocolatey: `choco install imagemagick`

**Convert:**
```bash
cd packages/printer-service/assets
magick convert logo-green.svg -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

### Option 4: GIMP (Free Software)

**Install GIMP:**
- Download from https://www.gimp.org/downloads/

**Steps:**
1. Open GIMP
2. File → Open → Select `logo-green.svg`
3. Set size to 256x256 when prompted
4. File → Export As
5. Change filename to `icon.ico`
6. In export dialog, check these sizes:
   - 256x256
   - 128x128
   - 64x64
   - 48x48
   - 32x32
   - 16x16
7. Click Export

### Option 5: Inkscape (Vector Editor)

**Install Inkscape:**
- Download from https://inkscape.org/

**Steps:**
1. Open `logo-green.svg` in Inkscape
2. File → Export PNG Image
3. Set width/height to 256
4. Export as `logo-256.png`
5. Use online converter to convert PNG to ICO
6. Or use ImageMagick: `magick convert logo-256.png icon.ico`

---

## Icon Requirements

### Sizes Needed
Windows icons should include multiple sizes:
- 256x256 (Windows 10/11 high-res)
- 128x128 (Large icons)
- 64x64 (Medium icons)
- 48x48 (Standard icons)
- 32x32 (Small icons)
- 16x16 (Tiny icons, taskbar)

### Color Depth
- 32-bit (RGBA) for transparency
- PNG compression inside ICO

### File Size
- Target: < 100 KB
- Acceptable: < 500 KB

---

## Verification

After creating `icon.ico`:

### Check File Exists
```bash
ls -la assets/icon.ico
```

### Check File Size
Should be between 10 KB - 500 KB

### Visual Check
- Right-click `icon.ico` in Windows Explorer
- Select "Open with" → "Photos" or "Paint"
- Should show green Tabeza logo
- Should be clear and not pixelated

### Test in Electron
```bash
npm run start:electron
```

- Setup window should show icon in title bar
- System tray should show green icon
- Installer should use icon

---

## Troubleshooting

### "Icon not found" error
- Make sure file is named exactly `icon.ico`
- Make sure it's in `assets/` folder
- Check file path in `package.json` build config

### Icon looks blurry
- Recreate with higher resolution source
- Ensure multiple sizes are included
- Use PNG compression, not JPEG

### Icon has white background
- Source SVG should have transparent background
- Use 32-bit color depth with alpha channel
- Check "preserve transparency" in converter

### Icon doesn't appear in installer
- Rebuild installer: `npm run build:electron`
- Check `package.json` → `build.nsis.installerIcon`
- Verify path is correct: `assets/icon.ico`

---

## Quick Test

After creating icon:

```bash
# 1. Install dependencies (if not done)
npm install

# 2. Test Electron app
npm run start:electron

# 3. Check if icon appears in:
#    - Window title bar
#    - System tray
#    - Taskbar

# 4. Build installer
npm run build:electron

# 5. Check installer icon
#    - Right-click dist/Tabeza Connect Setup 1.0.0.exe
#    - Should show green icon
```

---

## Final Checklist

- [ ] `icon.ico` file created
- [ ] File is in `assets/` folder
- [ ] File size is reasonable (< 500 KB)
- [ ] Icon looks clear when viewed
- [ ] Multiple sizes included (16-256)
- [ ] Transparency preserved
- [ ] Electron app shows icon
- [ ] Installer shows icon
- [ ] System tray shows icon

---

**Estimated Time:** 5-10 minutes
**Recommended Method:** Online converter (Option 1)
**Next Step:** Run `npm install` then `npm run start:electron`
