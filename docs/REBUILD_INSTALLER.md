# How to Rebuild the TabezaConnect Installer

This guide explains how to rebuild the TabezaConnect installer with the updated printer configuration.

## Prerequisites

### 1. Install Required Tools

#### Node.js
- Download from: https://nodejs.org/
- Version: 18.x or later
- Verify: `node --version`

#### pkg (Node.js packager)
```bash
npm install -g pkg
```
Verify: `pkg --version`

#### Inno Setup 6
- Download from: https://jrsoftware.org/isinfo.php
- Choose "Inno Setup 6.x.x with Encryption"
- Install with default options
- Verify: Check if `C:\Program Files (x86)\Inno Setup 6\ISCC.exe` exists

### 2. Verify Your Changes

Make sure these files have been updated:
- ✅ `src/service/index.js` - Fixed missing functions
- ✅ `src/installer/scripts/configure-printer.ps1` - Updated printer name to "TabezaConnect"
- ✅ `installer.iss` - Updated uninstaller to remove correct printer

## Build Process

### Step 1: Navigate to TabezaConnect Directory

```bash
cd c:\Projects\TabezaConnect
```

### Step 2: Run the Build Script

```bash
build-pkg.bat
```

This script will:
1. ✅ Check prerequisites (pkg, Inno Setup, service files)
2. 🔨 Build `TabezaService.exe` using pkg
3. 📦 Create Windows installer using Inno Setup
4. 📁 Output installer to `dist/` folder

### Step 3: Wait for Build to Complete

You'll see output like:
```
========================================
Tabeza Connect Build Script
========================================

Checking prerequisites...
[OK] pkg is installed
[OK] Inno Setup is installed
[OK] Service files found

========================================
Step 1: Building standalone executable
========================================

Building TabezaService.exe with pkg...
> pkg@5.8.1
> Targets: node18-win-x64

[SUCCESS] TabezaService.exe created
          Size: 45 MB

========================================
Step 2: Creating Windows Installer
========================================

Building installer...
Inno Setup Compiler
Compiling: installer-pkg.iss
...
Successful compile (X.XX sec)

========================================
BUILD COMPLETE!
========================================

Output: dist\TabezaConnect-Setup-v1.3.0.exe
Size: 48 MB
```

## Output

The installer will be created at:
```
c:\Projects\TabezaConnect\dist\TabezaConnect-Setup-v1.3.0.exe
```

## What's Included in the Installer

The installer now includes:
- ✅ TabezaService.exe (with fixed spooler monitoring)
- ✅ Updated printer installation script (uses NULL port)
- ✅ PowerShell configuration scripts
- ✅ Documentation
- ✅ Service registration scripts

## Testing the Installer

### Test on a Clean Windows VM

1. **Create a Windows VM** (VirtualBox, VMware, or Hyper-V)
   - Windows 10 or 11
   - Fresh install (no previous TabezaConnect)

2. **Copy the installer** to the VM
   ```
   dist\TabezaConnect-Setup-v1.3.0.exe
   ```

3. **Run as Administrator**
   - Right-click → "Run as administrator"
   - Follow the installation wizard
   - Enter a test Bar ID

4. **Verify Installation**
   - Check Services: `services.msc` → Look for "TabezaConnect"
   - Check Printers: Settings → Printers → Look for "TabezaConnect"
   - Check Files: `C:\Program Files\TabezaConnect\`

5. **Test Receipt Capture**
   - Open Notepad
   - Type some text
   - File → Print → Select "TabezaConnect"
   - Print
   - Check logs: `C:\ProgramData\Tabeza\logs\`
   - Verify receipt was captured

## Troubleshooting Build Issues

### "pkg not found"
```bash
npm install -g pkg
```

### "Inno Setup not found"
- Install from: https://jrsoftware.org/isinfo.php
- Or add to PATH: `C:\Program Files (x86)\Inno Setup 6\`

### "Service files not found"
- Verify `src/service/index.js` exists
- Make sure you're in the TabezaConnect directory

### "pkg build failed"
- Check Node.js version: `node --version` (should be 18.x+)
- Try cleaning: Delete `TabezaService.exe` and rebuild
- Check for syntax errors in `src/service/index.js`

### "Installer build failed"
- Check `installer-pkg.iss` exists
- Verify all source files referenced in the .iss file exist
- Check Inno Setup logs in the output

## Advanced: Manual Build Steps

If the automated script fails, you can build manually:

### 1. Build Executable
```bash
cd c:\Projects\TabezaConnect
pkg src\service\index.js --targets node18-win-x64 --output TabezaService.exe
```

### 2. Build Installer
```bash
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer-pkg.iss
```

## Signing the Installer (Production)

For production deployment, sign the installer:

```bash
signtool sign /f "certificate.pfx" /p "password" /t http://timestamp.digicert.com dist\TabezaConnect-Setup-v1.3.0.exe
```

This removes Windows SmartScreen warnings.

## Distribution

Once built and tested:

1. **Upload to your server**
   - https://tabeza.co.ke/downloads/TabezaConnect-Setup-v1.3.0.exe

2. **Update documentation**
   - Update download links
   - Update version numbers

3. **Notify customers**
   - Send update notification
   - Provide upgrade instructions

## Version Numbering

Current version: **1.3.0**

To change version:
1. Update `installer-pkg.iss` → `AppVersion=1.3.1`
2. Update `build-pkg.bat` if needed
3. Rebuild

## Quick Reference

```bash
# Full rebuild
cd c:\Projects\TabezaConnect
build-pkg.bat

# Output location
dist\TabezaConnect-Setup-v1.3.0.exe

# Test installation
# (Run on clean Windows VM as Administrator)
```

## Next Steps After Building

1. ✅ Test on clean Windows VM
2. ✅ Verify printer installation works
3. ✅ Test receipt capture from spooler
4. ✅ Sign installer (production)
5. ✅ Deploy to download server
6. ✅ Update documentation
7. ✅ Notify customers

---

**Questions?** Check the Inno Setup documentation: https://jrsoftware.org/ishelp/
