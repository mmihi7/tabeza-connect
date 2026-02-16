# TabezaConnect Build Fix - ZIP Compression Issue

## Problem
The build was crashing during the ZIP compression step because PowerShell's `Compress-Archive` command struggles with large directories containing thousands of files (like Node.js node_modules).

## Solution
Replaced PowerShell ZIP compression with a Node.js-based solution using the `archiver` package, which is more reliable for large file sets.

## Changes Made

### 1. Created New ZIP Script
**File:** `TabezaConnect/src/installer/create-zip.js`
- Uses Node.js `archiver` package for reliable ZIP creation
- Handles large directories with thousands of files
- Shows progress during compression
- Maximum compression level (9)

### 2. Updated Root Package.json
**File:** `TabezaConnect/package.json`
- Added `archiver` as a dev dependency
- This is needed for the build process

### 3. Updated Build Script
**File:** `TabezaConnect/src/installer/build-installer.js`
- Replaced PowerShell `Compress-Archive` command with Node.js script
- More reliable and cross-platform compatible

### 4. Created Dependency Installer
**File:** `TabezaConnect/INSTALL-BUILD-DEPS.bat`
- Simple batch file to install build dependencies
- Run this once before building

## How to Build Now

### Build the Installer (One Command)
From the Tabz directory, run:
```cmd
BUILD-TABEZACONNECT.bat
```

Or from TabezaConnect directory:
```cmd
cd c:\Projects\TabezaConnect
npm run build
```

The build script will automatically install the `archiver` package if it's not already installed.

## Build Process

The build now follows these steps:

1. **Download Node.js** (~28 MB)
   - Downloads Node.js v18.19.0 for Windows
   - Extracts to `src/installer/nodejs-bundle/nodejs/`

2. **Prepare Service Files**
   - Copies service files from `src/service/`
   - Copies public HTML files from `src/public/`
   - Creates installer batch file

3. **Install Dependencies**
   - Uses bundled npm to install production dependencies
   - Installs into `nodejs-bundle/service/node_modules/`

4. **Copy Installer Scripts**
   - Copies PowerShell scripts for printer setup
   - Copies service registration scripts

5. **Create ZIP Package** (NEW METHOD)
   - Uses Node.js archiver instead of PowerShell
   - Compresses entire nodejs-bundle directory
   - Creates `dist/TabezaConnect-Setup-v1.0.0.zip`

## Expected Output

After successful build:
```
✅ ZIP package created successfully
   Size: ~35-40 MB
   Files: [number] bytes
   Path: c:\Projects\TabezaConnect\dist\TabezaConnect-Setup-v1.0.0.zip
```

## Troubleshooting

### Issue: "Cannot find module 'adm-zip'"
**Solution:** The build script will auto-install it. If it fails, manually run:
```cmd
cd c:\Projects\TabezaConnect
npm install adm-zip --no-save
```

### Issue: Build still fails at ZIP step
**Solution:** 
1. Check if `dist/` directory exists
2. Ensure you have write permissions
3. Try deleting `dist/` folder and rebuilding

### Issue: "npm: command not found"
**Solution:** Ensure Node.js is installed and in your PATH

## Next Steps After Successful Build

1. **Verify the ZIP file**
   ```cmd
   dir c:\Projects\TabezaConnect\dist\TabezaConnect-Setup-v1.0.0.zip
   ```

2. **Test the installer**
   - Extract the ZIP on a clean Windows VM
   - Run `install.bat` as administrator
   - Verify service starts correctly

3. **Commit to Git**
   ```cmd
   cd c:\Projects\TabezaConnect
   git add .
   git commit -m "Fix ZIP compression using Node.js archiver"
   git push origin main
   ```

4. **Create Release**
   ```cmd
   git tag v1.0.0
   git push origin v1.0.0
   ```

## Technical Details

### Why PowerShell Failed
- `Compress-Archive` has a 2GB file limit
- Struggles with directories containing >10,000 files
- Node.js node_modules typically has 15,000+ files
- Can crash or hang on large file sets

### Why Node.js Archiver Works
- Designed for large file sets
- Streams files efficiently
- No arbitrary file count limits
- Better error handling
- Cross-platform compatible

## Files Modified

1. `TabezaConnect/package.json` - Added archiver dependency
2. `TabezaConnect/src/installer/build-installer.js` - Updated ZIP creation
3. `TabezaConnect/src/installer/create-zip.js` - New ZIP script
4. `TabezaConnect/INSTALL-BUILD-DEPS.bat` - New dependency installer
5. `Tabz/BUILD-TABEZACONNECT.bat` - Improved error handling

---

**Status:** Ready to build ✅  
**Next Action:** Run `INSTALL-BUILD-DEPS.bat` then `BUILD-TABEZACONNECT.bat`  
**Created:** 2026-02-12
