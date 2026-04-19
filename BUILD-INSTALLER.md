# Building the Tabeza Connect Installer

**Version:** 1.7.15  
**Last Updated:** 2026-04-08

This guide explains how to build the complete Tabeza Connect installer package for distribution.

---

## Prerequisites

### Required Software

1. **Inno Setup 6.x** (Free)
   - Download from: https://jrsoftware.org/isdl.php
   - Install with default options
   - Add to PATH (optional but recommended)

2. **Node.js 18+** (Already installed)
   - Required for building the PKG executable

3. **PowerShell 5.1+** (Built into Windows)
   - Used by installer scripts

### Required Files

Before building, ensure these files exist:

```
tabeza-connect/
├── dist/win-ia32-unpacked/TabezaConnect.exe  ← PKG compiled binary
├── assets/icon-green.ico                      ← Application icon
├── config.template.json                       ← Configuration template
├── LICENSE.txt                                ← License file
├── src/installer/scripts/*.ps1                ← PowerShell scripts
├── Plan/README.txt                            ← Documentation
├── Plan/BEFORE-INSTALL.txt
├── Plan/AFTER-INSTALL.txt
└── installer-pkg-v1.7.15.iss                  ← Inno Setup script
```

---

## Build Process

### Step 1: Build the PKG Executable (if not already built)

The TabezaConnect.exe file should already exist in `dist/win-ia32-unpacked/`. If you need to rebuild it:

```powershell
# Install PKG globally (if not already installed)
npm install -g pkg

# Build the executable
pkg . --targets node18-win-x64 --output TabezaConnect.exe

# Move to dist folder
mkdir -p dist/win-ia32-unpacked
move TabezaConnect.exe dist/win-ia32-unpacked/
```

### Step 2: Verify All Files Exist

Run this PowerShell script to verify all required files:

```powershell
# Check required files
$requiredFiles = @(
    "dist\win-ia32-unpacked\TabezaConnect.exe",
    "assets\icon-green.ico",
    "config.template.json",
    "LICENSE.txt",
    "installer-pkg-v1.7.15.iss"
)

$missing = @()
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        $missing += $file
    }
}

if ($missing.Count -gt 0) {
    Write-Host "Missing files:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "  - $_" }
    exit 1
} else {
    Write-Host "All required files present!" -ForegroundColor Green
}
```

### Step 3: Build the Installer

#### Option A: Using Inno Setup GUI

1. Open Inno Setup Compiler
2. File → Open → Select `installer-pkg-v1.7.15.iss`
3. Build → Compile
4. Wait for compilation to complete
5. Installer will be created in `installer-output/TabezaConnect-Setup-v1.7.15.exe`

#### Option B: Using Command Line

```powershell
# Compile using ISCC (Inno Setup Command Line Compiler)
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer-pkg-v1.7.15.iss

# Or if ISCC is in PATH:
iscc installer-pkg-v1.7.15.iss
```

### Step 4: Test the Installer

**IMPORTANT:** Test on a clean Windows VM before distribution!

1. Copy `installer-output/TabezaConnect-Setup-v1.7.15.exe` to test machine
2. Run installer as Administrator
3. Enter a test Bar ID (e.g., `test-venue-001`)
4. Complete installation
5. Verify:
   - [ ] Service is running (`sc query TabezaConnect`)
   - [ ] System tray icon appears
   - [ ] Management UI opens at http://localhost:8765
   - [ ] "Tabeza Agent" printer appears in Windows Settings
   - [ ] Folders created in `C:\ProgramData\Tabeza\`

---

## Installer Contents

### What Gets Installed

```
C:\Program Files\TabezaConnect\
├── TabezaConnect.exe           (~45 MB - PKG compiled binary)
├── icon-green.ico
├── config.json                 (created from template)
├── scripts\
│   ├── create-folders.ps1
│   ├── configure-pooling-printer.ps1
│   ├── register-service-pkg.ps1
│   ├── verify-installation.ps1
│   └── uninstall-pooling-printer.ps1
└── docs\
    ├── README.txt
    ├── BEFORE-INSTALL.txt
    └── AFTER-INSTALL.txt

C:\ProgramData\Tabeza\
├── config.json                 (runtime configuration)
├── logs\
│   └── service.log
├── TabezaPrints\
│   ├── order.prn               (capture file)
│   ├── processed\
│   └── failed\
└── queue\
    ├── pending\                (offline queue)
    └── uploaded\               (audit trail)
```

### Registry Keys Created

```
HKLM\Software\Tabeza\Connect\
├── InstallPath = "C:\Program Files\TabezaConnect"
├── Version = "1.7.15"
└── BarId = "<user-entered-bar-id>"

HKCU\Software\Microsoft\Windows\CurrentVersion\Run\
└── TabezaConnect = "C:\Program Files\TabezaConnect\TabezaConnect.exe"
```

### Windows Service Created

```
Service Name:    TabezaConnect
Display Name:    TabezaConnect
Account:         LocalService
Startup Type:    Automatic
Binary Path:     C:\Program Files\TabezaConnect\TabezaConnect.exe
Environment:
  - TABEZA_BAR_ID=<user-entered-bar-id>
  - TABEZA_API_URL=https://tabeza.co.ke
  - TABEZA_WATCH_FOLDER=C:\ProgramData\Tabeza\TabezaPrints
```

---

## Distribution

### GitHub Release

1. Create a new release on GitHub:
   ```
   Tag: v1.7.15
   Title: Tabeza Connect v1.7.15
   ```

2. Upload the installer:
   ```
   TabezaConnect-Setup-v1.7.15.exe (~50 MB)
   ```

3. Add release notes describing changes

### Staff App Integration

The installer will be linked from the Tabeza Staff app:

```
https://github.com/mmihi7/tabeza-connect/releases/latest/download/TabezaConnect-Setup-v1.7.15.exe
```

Staff can download directly from the app's "Printer Setup" section.

---

## Troubleshooting Build Issues

### Issue: "TabezaConnect.exe not found"

**Solution:** Build the PKG executable first (see Step 1)

### Issue: "icon-green.ico not found"

**Solution:** Ensure the assets folder exists with the icon file

### Issue: "PowerShell scripts not found"

**Solution:** Verify `src/installer/scripts/` contains all required .ps1 files

### Issue: Inno Setup compilation errors

**Solution:** 
1. Check all file paths in the .iss script are correct
2. Ensure all Source files exist
3. Check for syntax errors in the [Code] section

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.7.15 | 2026-04-08 | Updated installer script, added queue folders, verified all components |
| 1.7.0 | 2026-03-04 | Initial PKG-based installer with printer pooling |

---

## Support

For build issues or questions:
- Email: support@tabeza.co.ke
- GitHub Issues: https://github.com/mmihi7/tabeza-connect/issues

---

**Built with ❤️ in Nairobi, Kenya**
