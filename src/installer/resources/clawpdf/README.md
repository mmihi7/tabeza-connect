# ClawPDF MSI Installer Bundle

## Overview

This directory contains the clawPDF 0.9.3 MSI installer that will be bundled with the Tabeza Connect installer. The clawPDF virtual printer is a core component of the virtual printer capture architecture.

## Required File

**File:** `clawPDF-0.9.3-setup.msi`  
**Version:** 0.9.3  
**Download URL:** https://github.com/clawsoftware/clawPDF/releases/download/v0.9.3/clawPDF-0.9.3-setup.msi

## Download Instructions

### Manual Download (Required)

1. Visit the clawPDF releases page: https://github.com/clawsoftware/clawPDF/releases/tag/v0.9.3
2. Download the file: `clawPDF-0.9.3-setup.msi`
3. Place the downloaded MSI file in this directory: `tabeza-connect/src/installer/resources/clawpdf/`
4. Verify the file integrity (optional but recommended):
   - File size: ~15-20 MB
   - SHA256 checksum: (to be verified after download)

### Verification

After downloading, verify the file exists:

```powershell
# Check if file exists
Test-Path "src/installer/resources/clawpdf/clawPDF-0.9.3-setup.msi"
```

## Integration with Installer

The MSI file will be:

1. **Bundled** - Included in the Tabeza Connect installer package
2. **Extracted** - Copied to a temporary location during installation
3. **Executed** - Installed silently using the script `src/installer/scripts/install-clawpdf.ps1`
4. **Configured** - Configured using the script `src/installer/scripts/configure-clawpdf.ps1`

## Inno Setup Integration

The Inno Setup script (`TabezaConnect.iss`) will reference this file:

```iss
[Files]
; ClawPDF MSI installer (bundled)
Source: "src\installer\resources\clawpdf\clawPDF-0.9.3-setup.msi"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Run]
; Install clawPDF silently
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\install-clawpdf.ps1"" -MsiPath ""{tmp}\clawPDF-0.9.3-setup.msi"""; StatusMsg: "Installing clawPDF virtual printer..."; Flags: runhidden waituntilterminated
```

## License Information

**ClawPDF License:** AGPL v3  
**Project:** https://github.com/clawsoftware/clawPDF  
**License URL:** https://github.com/clawsoftware/clawPDF/blob/master/LICENSE

ClawPDF is open-source software licensed under the GNU Affero General Public License v3.0. This allows us to:
- Use the software for commercial purposes
- Distribute the software
- Modify the software
- Bundle it with our installer

**Important:** As per AGPL v3 requirements:
- We must provide access to the source code of clawPDF (via the GitHub repository)
- Any modifications to clawPDF itself must be released under AGPL v3
- We are not modifying clawPDF, only using it as-is and configuring it via registry settings

## File Structure

```
src/installer/resources/clawpdf/
├── README.md                          # This file
├── clawPDF-0.9.3-setup.msi           # MSI installer (MANUAL DOWNLOAD REQUIRED)
└── LICENSE.txt                        # ClawPDF license (AGPL v3)
```

## Build Process Integration

### Before Building Installer

1. Ensure `clawPDF-0.9.3-setup.msi` exists in this directory
2. Run verification script (to be created):
   ```powershell
   .\src\installer\scripts\verify-clawpdf-bundle.ps1
   ```

### During Build

The Inno Setup compiler will:
1. Include the MSI in the installer package
2. Increase installer size by ~15-20 MB
3. Extract MSI to temp directory during installation
4. Execute silent installation via PowerShell script

### After Installation

The clawPDF MSI will:
1. Install clawPDF to `C:\Program Files\clawPDF\`
2. Register the virtual printer driver
3. Create default printer profiles
4. Our configuration script will then customize the "Tabeza POS Printer" profile

## Troubleshooting

### File Not Found During Build

**Error:** `Source file not found: src\installer\resources\clawpdf\clawPDF-0.9.3-setup.msi`

**Solution:**
1. Download the MSI from the URL above
2. Place it in this directory
3. Rebuild the installer

### Wrong Version Downloaded

**Error:** Installation fails or version mismatch

**Solution:**
- Ensure you downloaded version 0.9.3 specifically
- Check the file properties to verify version number
- Re-download if necessary

### Checksum Verification Failed

**Solution:**
- Re-download the MSI from the official GitHub releases page
- Verify the download completed successfully
- Check for file corruption

## Security Considerations

1. **Source Verification:** Always download from the official GitHub releases page
2. **Checksum Verification:** Verify file integrity before bundling
3. **Code Signing:** The clawPDF MSI is signed by the clawPDF developers
4. **Antivirus:** Some antivirus software may flag virtual printer drivers - this is normal

## Alternative Download Methods

If the GitHub releases page is unavailable:

1. **Clone Repository:**
   ```bash
   git clone https://github.com/clawsoftware/clawPDF.git
   cd clawPDF
   git checkout v0.9.3
   ```
   Then build from source (requires Visual Studio)

2. **Archive.org:** Check for archived releases
3. **Contact Support:** Reach out to clawPDF maintainers

## Notes for Developers

- **Do not commit the MSI file to git** - It's too large and binary files bloat the repository
- Add `clawPDF-0.9.3-setup.msi` to `.gitignore`
- Document the download step in build instructions
- Consider hosting a copy on Tabeza infrastructure for reliability
- Update this README if the version changes

## Version History

- **v0.9.3** - Current version (2024)
  - Stable release
  - Windows 10/11 compatible
  - Supports silent installation
  - Configurable via registry

## Related Documentation

- [ClawPDF Installation Script](../../scripts/install-clawpdf.ps1)
- [ClawPDF Configuration Script](../../scripts/configure-clawpdf.ps1)
- [Virtual Printer Capture Spec](../../../.kiro/specs/virtual-printer-capture/requirements.md)
- [Tabeza Connect Architecture](../../../../ARCHITECTURE.md)

## Support

For issues with:
- **ClawPDF itself:** https://github.com/clawsoftware/clawPDF/issues
- **Tabeza Connect integration:** Contact Tabeza development team
- **Installation problems:** Check `C:\TabezaPrints\logs\installer.log`
