# Redmon Integration in Installer

## Overview

This document describes how Redmon files are integrated into the Tabeza Connect installer package.

## Task Reference

- **Task**: 2.3 Add Redmon to installer assets
- **Spec**: redmon-receipt-capture
- **Date**: 2025-01-XX

## Changes Made

### 1. Inno Setup Script (TabezaConnect.iss)

Added Redmon files to the `[Files]` section:

```inno
Source: "redmon19\*"; DestDir: "{app}\redmon19"; Flags: ignoreversion recursesubdirs
```

Added Redmon directory to the `[Dirs]` section:

```inno
Name: "{app}\redmon19"
```

### 2. Build Script (build-installer.js)

Added Step 4.5 to copy Redmon files to the nodejs-bundle directory:

```javascript
// Step 4.5: Copy Redmon files
console.log('Step 4.5: Copying Redmon files...\n');

const REDMON_SRC = path.join(INSTALLER_DIR, 'redmon19');
const REDMON_DEST = path.join(NODEJS_BUNDLE_DIR, 'redmon19');

if (fs.existsSync(REDMON_SRC)) {
  copyDirectory(REDMON_SRC, REDMON_DEST);
  console.log('✅ Redmon files copied\n');
} else {
  console.warn('⚠️  Redmon files not found at:', REDMON_SRC);
  console.warn('    Redmon installation will not be available\n');
}
```

## File Structure

After installation, Redmon files will be located at:

```
C:\Program Files\TabezaConnect\
└── redmon19\
    ├── setup.exe           (32-bit installer)
    ├── setup64.exe         (64-bit installer)
    ├── redmon32.dll        (32-bit port monitor DLL)
    ├── redmon64.dll        (64-bit port monitor DLL)
    ├── redpr.exe           (Redmon printer utility)
    ├── redrun.exe          (Redmon run utility)
    ├── redfile.exe         (Redmon file utility)
    ├── enum.exe            (Redmon enumeration utility)
    ├── unredmon.exe        (32-bit uninstaller)
    ├── unredmon64.exe      (64-bit uninstaller)
    ├── redmon.chm          (Help file)
    ├── README.TXT          (Documentation)
    ├── LICENCE             (License file)
    └── ...                 (other files)
```

## Integration with install-redmon.ps1

The `install-redmon.ps1` script expects Redmon files at:

```powershell
$RedmonPath = "C:\Program Files\TabezaConnect\redmon19"
```

The script will:
1. Detect Windows architecture (32-bit or 64-bit)
2. Select appropriate installer (setup.exe or setup64.exe)
3. Run installer silently with `/S` flag
4. Verify installation by checking registry
5. Verify Print Spooler service is running

## Verification

To verify Redmon files are included in the installer:

1. **Check source files exist**:
   ```powershell
   Test-Path "src\installer\redmon19\setup.exe"
   Test-Path "src\installer\redmon19\setup64.exe"
   Test-Path "src\installer\redmon19\redmon64.dll"
   ```

2. **Build installer**:
   ```powershell
   cd src\installer
   .\build-installer.ps1
   ```

3. **Check installer includes Redmon**:
   - Extract installer or run in test environment
   - Verify `C:\Program Files\TabezaConnect\redmon19\` exists
   - Verify all Redmon files are present

4. **Run install-redmon.ps1**:
   ```powershell
   cd "C:\Program Files\TabezaConnect\scripts"
   .\install-redmon.ps1 -Detailed
   ```

## Testing

A test suite is available at:
```
src/installer/scripts/__tests__/verify-redmon-assets.test.js
```

This test verifies:
- All required Redmon files exist in source directory
- Inno Setup script includes Redmon files
- Build script copies Redmon files
- install-redmon.ps1 expects correct path

## Requirements Satisfied

This implementation satisfies the following requirements from the spec:

- **Requirement 1.1**: Installer SHALL download and install Redmon silently
  - ✅ Redmon files are bundled with installer
  - ✅ install-redmon.ps1 installs Redmon silently

- **Design Section 8**: Installer Integration
  - ✅ Redmon files copied to correct location during installation
  - ✅ install-redmon.ps1 script expects files at this location

## Next Steps

After this task is complete:

1. **Task 2.4**: Create printer configuration PowerShell script
   - Configure "Tabeza POS Printer" with Generic/Text Only driver
   - Add Redmon port pointing to capture script

2. **Task 9**: Update Installer for Redmon
   - Add Redmon silent installation step to installer
   - Test printer creation on Windows 10 and 11

## Notes

- Redmon version: 1.9
- License: GPL (compatible with our use case)
- Source: https://github.com/clach04/redmon/releases
- All files are included in the installer package (no download required)
- Silent installation flag: `/S`

## Troubleshooting

If Redmon files are missing from installer:

1. Verify source files exist in `src/installer/redmon19/`
2. Check Inno Setup script includes `Source: "redmon19\*"`
3. Check build-installer.js includes Redmon copy step
4. Rebuild installer with `.\build-installer.ps1`

If installation fails:

1. Check install.log in `C:\Program Files\TabezaConnect\`
2. Run install-redmon.ps1 with `-Detailed` flag
3. Check Windows Event Viewer for errors
4. Verify administrator privileges
5. Check Print Spooler service is running
