# TabezaConnect Automated Setup Guide

## Overview

I've created an automated setup script that copies all necessary files from the Tabz monorepo to the TabezaConnect standalone repository.

## Files Created

1. **setup-tabezaconnect.js** - Main setup script (Node.js)
2. **SETUP-TABEZACONNECT.bat** - Windows batch file to run the script
3. **TABEZACONNECT-SETUP-CHECKLIST.md** - Manual checklist (backup reference)

## Quick Start

### Option 1: Run the Batch File (Easiest)

```cmd
cd c:\Projects\Tabz
SETUP-TABEZACONNECT.bat
```

### Option 2: Run Node Script Directly

```cmd
cd c:\Projects\Tabz
node setup-tabezaconnect.js
```

## What the Script Does

The automated setup script performs the following tasks:

### 1. Directory Structure
Creates all necessary directories in TabezaConnect:
- `src/service/` - Core service files
- `src/installer/` - Installer build scripts
- `src/installer/scripts/` - PowerShell configuration scripts
- `src/public/` - HTML UI files
- `assets/` - Icons and images
- `docs/` - Documentation
- `.github/workflows/` - CI/CD workflows

### 2. Core Service Files
Copies from `packages/printer-service/`:
- `index.js` → `src/service/index.js`
- `package.json` → `src/service/package.json`
- `config.example.json` → `src/service/config.example.json`
- `electron-main.js` → `src/service/electron-main.js`

### 3. Public HTML Files
Copies UI files:
- `configure.html`
- `prompt-manager.html`
- `setup.html`

### 4. Installer Files
Copies installer scripts:
- `download-nodejs.js`
- `build-installer.js`
- All PowerShell scripts from `installer/scripts/`

### 5. Assets
Copies all files from `assets/` directory:
- `icon.ico`
- `logo-green.svg`

### 6. Documentation
Copies and renames documentation:
- `QUICK-START.md` → `docs/INSTALLATION.md`
- `PRINTER-SYSTEM-ARCHITECTURE.md` → `docs/ARCHITECTURE.md`

### 7. Root Configuration Files
Creates new files:
- `package.json` (with build scripts)
- `.gitignore` (comprehensive ignore rules)
- `README.md` (complete project documentation)
- `LICENSE` (MIT license)

### 8. GitHub Actions Workflows
Creates CI/CD workflows:
- `.github/workflows/build-installer.yml` (build on push)
- `.github/workflows/release.yml` (automated releases)

## After Running the Script

### 1. Install Service Dependencies

```cmd
cd c:\Projects\TabezaConnect\src\service
npm install
cd ..\..
```

### 2. Test the Build Process

```cmd
cd c:\Projects\TabezaConnect
npm run build
```

This will:
- Download Node.js v18.19.0 (if not cached)
- Build the installer package
- Create `dist/TabezaConnect-Setup-v1.0.0.zip`

### 3. Verify the Output

Check that the installer was created:
```cmd
dir dist\TabezaConnect-Setup-v1.0.0.zip
```

Expected size: ~30-40 MB (includes bundled Node.js)

### 4. Commit to Git

```cmd
cd c:\Projects\TabezaConnect
git add .
git commit -m "Complete TabezaConnect setup with all service files"
git push origin main
```

### 5. Create First Release

```cmd
git tag v1.0.0
git push origin v1.0.0
```

This will trigger the GitHub Actions release workflow automatically.

## Troubleshooting

### Script Fails to Find TabezaConnect

**Error:** `TabezaConnect directory not found`

**Solution:** Ensure TabezaConnect is cloned at `c:\Projects\TabezaConnect`

```cmd
cd c:\Projects
git clone https://github.com/billoapp/TabezaConnect.git
```

### Missing Source Files

**Error:** `File not found: [filename]`

**Solution:** The script will skip missing files and continue. Check the Tabz monorepo to ensure the source files exist.

### Permission Errors

**Error:** `EACCES: permission denied`

**Solution:** Run the script with administrator privileges or check file permissions.

### Node.js Not Found

**Error:** `node is not recognized`

**Solution:** Install Node.js from https://nodejs.org/ and ensure it's in your PATH.

## Script Output

The script provides colored console output:
- ✅ Green: Successful operations
- ⚠️ Yellow: Warnings (skipped files)
- ❌ Red: Errors
- 🔵 Blue: Information
- 🔷 Cyan: Section headers

## Verification Checklist

After running the script, verify:

- [ ] All directories created
- [ ] Service files copied (4 files)
- [ ] Public HTML files copied (3 files)
- [ ] Installer scripts copied
- [ ] PowerShell scripts copied (4 files)
- [ ] Assets copied (icon.ico, logo-green.svg)
- [ ] Documentation copied (2 files)
- [ ] Root package.json created
- [ ] .gitignore created
- [ ] README.md created
- [ ] LICENSE created
- [ ] GitHub workflows created (2 files)

## Manual Verification Commands

```cmd
cd c:\Projects\TabezaConnect

REM Check directory structure
dir /s /b src

REM Check service files
dir src\service

REM Check installer files
dir src\installer

REM Check PowerShell scripts
dir src\installer\scripts\*.ps1

REM Check assets
dir assets

REM Check documentation
dir docs

REM Check GitHub workflows
dir .github\workflows
```

## Next Steps After Setup

1. **Test locally:**
   - Run `npm run build` to create installer
   - Extract and test on a clean Windows VM

2. **Update Tabz staff app:**
   - Update download link to point to GitHub releases
   - Update documentation with new installation instructions

3. **Monitor GitHub Actions:**
   - Check that build workflow runs successfully
   - Verify release workflow triggers on tags

4. **Create documentation:**
   - Add troubleshooting guide
   - Create video tutorial
   - Document known issues

## Support

If you encounter issues with the automated setup:

1. Check the manual checklist: `TABEZACONNECT-SETUP-CHECKLIST.md`
2. Review the setup guide: `packages/printer-service/TABEZA-CONNECT-REPO-SETUP.md`
3. Check the spec: `.kiro/specs/customer-friendly-installer/`

## Success Criteria

Setup is complete when:
- ✅ All files copied successfully
- ✅ `npm run build` completes without errors
- ✅ Installer ZIP created in `dist/` directory
- ✅ Installer size is ~30-40 MB
- ✅ Can extract and see all expected files
- ✅ Git repository is clean and pushed
- ✅ First release tag created

---

**Created:** 2026-02-12  
**Script Version:** 1.0.0  
**Tested On:** Windows 10/11 with Node.js 18+
