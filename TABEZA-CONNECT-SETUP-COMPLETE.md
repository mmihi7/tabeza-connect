# Tabeza Connect - Setup Complete ✅

## Implementation Status

### ✅ Completed
1. **Electron Main Process** (`electron-main.js`)
   - First-run detection
   - Setup window management
   - Config save/load
   - Auto-start shortcut creation
   - System tray icon
   - Printer service process management
   - Single instance lock

2. **Setup Window** (`setup.html`)
   - Professional green-themed UI
   - Bar ID input with validation
   - Clear instructions
   - Error handling
   - Loading states
   - Responsive design

3. **Console Branding** (`index.js`)
   - Updated to "Tabeza Connect"
   - Green theme messaging
   - "Bridge your POS to the cloud" tagline

4. **Package Configuration** (`package.json`)
   - Electron dependencies added
   - Build scripts configured
   - electron-builder setup
   - NSIS installer config

5. **Green Logo** (`assets/logo-green.svg`)
   - Created green version of Tabeza logo
   - Ready for use in UI

### ⏳ Remaining Tasks

#### 1. Create Windows Icon File
You need to convert the green logo to ICO format for Windows:

**Option A: Online Converter (Easiest)**
1. Go to https://convertio.co/svg-ico/
2. Upload `packages/printer-service/assets/logo-green.svg`
3. Convert to ICO with multiple sizes (16x16, 32x32, 48x48, 256x256)
4. Download and save as `packages/printer-service/assets/icon.ico`

**Option B: ImageMagick (Command Line)**
```bash
cd packages/printer-service/assets

# Install ImageMagick first: https://imagemagick.org/script/download.php
magick convert logo-green.svg -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

**Option C: GIMP (Free Software)**
1. Open `logo-green.svg` in GIMP
2. Export as ICO
3. Select multiple sizes in export dialog
4. Save as `icon.ico`

#### 2. Install Dependencies
```bash
cd packages/printer-service
npm install
```

This installs:
- `electron` (v28.0.0)
- `electron-builder` (v24.9.1)
- Other dependencies

#### 3. Test Electron App
```bash
cd packages/printer-service
npm run start:electron
```

Expected behavior:
- If no config exists: Setup window appears
- If config exists: Service starts, tray icon appears

#### 4. Build Windows Installer
```bash
cd packages/printer-service
npm run build:electron
```

Output: `dist/Tabeza Connect Setup 1.0.0.exe`

## File Structure

```
packages/printer-service/
├── assets/
│   ├── logo-green.svg          ✅ Created
│   └── icon.ico                ⏳ Need to create
├── electron-main.js            ✅ Created
├── setup.html                  ✅ Created
├── index.js                    ✅ Updated branding
├── package.json                ✅ Updated
└── public/
    └── configure.html          ✅ Exists
```

## User Experience Flow

### First Run
1. User downloads `Tabeza Connect Setup.exe` from Staff Dashboard
2. User runs installer
3. Installer extracts to `C:\Program Files\Tabeza Connect\`
4. App launches automatically after install
5. Setup window appears (green theme, professional)
6. User copies Bar ID from Staff Dashboard
7. User pastes Bar ID into setup window
8. User clicks "Save & Start Service"
9. Config saved to `%APPDATA%\Tabeza\config.json`
10. Startup shortcut created automatically
11. Service starts
12. Green tray icon appears (bottom-right)
13. Setup window closes

### Subsequent Runs
1. Windows starts
2. Tabeza Connect auto-starts from Startup folder
3. Reads config from `%APPDATA%\Tabeza\config.json`
4. Starts printer service silently
5. Green tray icon appears
6. No window shown (runs in background)

### System Tray Menu
Right-click tray icon:
- **Bar: venue_abc123** (shows current Bar ID)
- **● Connected** (status indicator)
- Open Configuration (opens web UI)
- Open Staff Dashboard (opens Tabeza)
- Restart Service
- View Logs
- About Tabeza Connect
- Exit

## Configuration Storage

**Location:** `%APPDATA%\Tabeza\config.json`

**Example:**
```json
{
  "barId": "venue_abc123",
  "apiUrl": "https://staff.tabeza.co.ke",
  "driverId": "driver-DESKTOP-ABC123-1707654321000",
  "watchFolder": "C:\\Users\\Username\\TabezaPrints",
  "installedAt": "2026-02-11T10:30:00Z",
  "autoStart": true,
  "notificationShown": false
}
```

## Auto-Start Implementation

**Method:** Windows Startup Folder Shortcut

**Location:** 
```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Tabeza Connect.lnk
```

**Created by:** `electron-main.js` using VBScript

**Behavior:**
- Shortcut created during first-run setup
- Points to installed EXE
- Runs on Windows login
- No UAC prompt required
- User can disable by removing shortcut

## Testing Checklist

Before releasing to users:

### Setup Flow
- [ ] First run shows setup window
- [ ] Setup window has green theme
- [ ] Bar ID input validates correctly
- [ ] Empty Bar ID shows error
- [ ] Short Bar ID (<5 chars) shows error
- [ ] Invalid characters show error
- [ ] Valid Bar ID saves successfully
- [ ] Setup window closes after save

### Auto-Start
- [ ] Startup shortcut created in Startup folder
- [ ] Service auto-starts on Windows restart
- [ ] No duplicate instances allowed
- [ ] Config persists across restarts

### System Tray
- [ ] Green tray icon appears
- [ ] Tray shows correct Bar ID
- [ ] Right-click menu works
- [ ] "Open Configuration" opens web UI
- [ ] "Restart Service" restarts successfully
- [ ] "Exit" closes cleanly

### Service Functionality
- [ ] Printer service starts with correct Bar ID
- [ ] Receipts sent with Bar ID in payload
- [ ] Test print works from Staff Dashboard
- [ ] File watcher monitors correct folder
- [ ] Cloud polling works

### Uninstall
- [ ] Uninstaller removes app files
- [ ] Startup shortcut removed
- [ ] Config preserved (optional)
- [ ] No orphaned processes

## Build Output

After running `npm run build:electron`:

```
dist/
├── Tabeza Connect Setup 1.0.0.exe    (NSIS installer)
├── win-unpacked/                      (Unpacked app files)
└── builder-effective-config.yaml      (Build config)
```

**Installer Features:**
- Custom install location
- Desktop shortcut option
- Start menu shortcut
- Run after install
- Uninstaller included

## Distribution

### Staff Dashboard Integration

Add download section in Settings:

```typescript
<div className="printer-service-download">
  <h2>🔗 Tabeza Connect</h2>
  <p>Bridge your POS system with Tabeza cloud</p>
  
  <div className="bar-id-display">
    <label>Your Bar ID:</label>
    <code>{barId}</code>
    <button onClick={copyBarId}>📋 Copy</button>
  </div>
  
  <a 
    href="/downloads/tabeza-connect-setup.exe" 
    className="download-btn"
    download
  >
    ⬇️ Download Tabeza Connect
  </a>
  
  <div className="instructions">
    <h3>Quick Setup:</h3>
    <ol>
      <li>Download and run the installer</li>
      <li>Copy your Bar ID above</li>
      <li>Paste when prompted</li>
      <li>Done! Look for green tray icon ✅</li>
    </ol>
  </div>
</div>
```

### File Hosting

Upload installer to:
- `public/downloads/tabeza-connect-setup.exe`
- Or use CDN/cloud storage
- Update download link in Staff Dashboard

## Next Steps

1. **Create icon.ico** (see instructions above)
2. **Install dependencies:** `npm install`
3. **Test Electron app:** `npm run start:electron`
4. **Build installer:** `npm run build:electron`
5. **Test installer** on clean Windows machine
6. **Upload to Staff Dashboard** download section
7. **Update documentation** with download link
8. **Announce to users** via email/dashboard notification

## Support Resources

### For Users
- Installation guide: Link to video/docs
- Troubleshooting: Common issues and fixes
- Support email: support@tabeza.co.ke

### For Developers
- Source code: `packages/printer-service/`
- Build process: This document
- Testing: Run through checklist above

## Success Criteria

✅ Non-technical users can install without help
✅ Setup takes less than 2 minutes
✅ Auto-start works reliably
✅ Service runs silently in background
✅ Green tray icon provides clear status
✅ Uninstall is clean and complete

## Branding Consistency

- **Name:** Tabeza Connect (not "Printer Service")
- **Color:** Green (#4CAF50, #2E7D32)
- **Icon:** Green connection/link symbol
- **Tagline:** "Bridge your POS to the cloud"
- **Tone:** Professional, simple, reliable

---

**Status:** Ready for icon creation and testing
**Next Action:** Create `icon.ico` file from green logo
**Estimated Time:** 30 minutes to complete remaining tasks
