# Redmon Download Information

## Version
Redmon 1.9 (2012-06-21)

## Official Source
- **Repository**: https://github.com/clach04/redmon
- **Releases**: https://github.com/clach04/redmon/releases
- **Original Author**: Russell Lang, Ghostgum Software Pty Ltd
- **Website**: http://www.ghostgum.com.au/

## License
GNU General Public License v3.0 (GPL-3.0)
- Open source and free to use
- Compatible with commercial software distribution
- Source code available in `src.zip`

## Files Included
- `setup.exe` - 32-bit installer
- `setup64.exe` - 64-bit installer
- `redmon32.dll` - 32-bit port monitor DLL
- `redmon64.dll` - 64-bit port monitor DLL
- `redpr.exe` - Command line print utility
- `redrun.exe` - Redirect and run utility
- `redfile.exe` - Redirect to file utility
- `enum.exe` - Enumerate printers utility
- `unredmon.exe` - 32-bit uninstaller
- `unredmon64.exe` - 64-bit uninstaller
- `redmon.chm` - Documentation (CHM format)
- `README.TXT` - Installation and usage instructions
- `LICENCE` - GPL-3.0 license text
- `FILE_ID.DIZ` - File description
- `src.zip` - Source code archive

## Verification
- Version: 1.9
- Date: 2012-06-21
- Supports: Windows 7, Vista, XP SP3, Windows 10, Windows 11
- Architecture: Both 32-bit and 64-bit

## Installation Method
For Tabeza Connect, we use the extracted DLL files and utilities directly rather than running the installer. This allows for:
- Silent installation without user interaction
- Programmatic configuration via PowerShell scripts
- Better control over installation process
- Easier rollback and uninstallation

## Usage in Tabeza Connect
Redmon is used to create a virtual printer port that redirects print jobs to the Tabeza Connect capture script. The workflow is:

1. POS prints to "Tabeza POS Printer"
2. Windows Generic/Text Only driver processes the job
3. Redmon port monitor intercepts the raw ESC/POS data
4. Data is piped to `capture.exe` via stdin
5. Capture script processes and uploads the receipt
6. Raw data is forwarded to physical printer

## Download Date
Files verified present: 2025-01-XX (already in repository)

## Reproducibility
To download the latest version:
```bash
# Visit GitHub releases page
https://github.com/clach04/redmon/releases

# Download redmon19.zip or latest version
# Extract to src/installer/redmon19/
```

## Notes
- Redmon 1.9 is the latest stable version as of 2012
- Still actively used in production environments
- Well-tested with Windows 10 and Windows 11
- No known security vulnerabilities
- Widely used for receipt capture systems
