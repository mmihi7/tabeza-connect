# Tabeza POS Connect - WiX Installer

## Overview

This is a **single WiX installer** that downloads and installs Tabeza POS Connect in one seamless process.

## Architecture

```
TabezaConnect-Setup-1.2.0.msi (2-3 MB)
    ↓
Downloads TabezaConnect.exe from GitHub during install
    ↓
Installs to Program Files
    ↓
Creates shortcuts + auto-start
```

## Features

### Professional Installer
- ✅ **MSI Format** - Native Windows installer
- ✅ **Enterprise Ready** - Group Policy compatible
- ✅ **Rollback Support** - Safe installation
- ✅ **Digital Signature Ready** - Code signing support

### User Experience
- ✅ **Modern UI** - Professional WiX interface
- ✅ **Download Progress** - Real-time progress updates
- ✅ **Error Handling** - Clear error messages
- ✅ **Silent Install** - `/quiet` parameter support

### Installation Features
- ✅ **Desktop Shortcut** - Quick access
- ✅ **Start Menu** - Program folder with shortcuts
- ✅ **Auto-start** - Launches with Windows
- ✅ **Registry Entries** - Proper uninstall info
- ✅ **Program Files** - Standard installation location

## Building

### Prerequisites

1. **Install WiX Toolset v3.11+**
   - Download from: https://wixtoolset.org/releases/
   - Add to PATH during installation

2. **Install Visual Studio Build Tools**
   - Required for C# custom actions
   - Download from: Visual Studio Installer

### Build Process

```cmd
# Build the installer
.\build-wix.bat

# Enter version when prompted (e.g., 1.2.0)
```

### Build Steps

1. **Compile WiX Source** - `candle` compiles Product.wxs
2. **Link to MSI** - `light` creates final installer
3. **Package Assets** - License, banners, dialogs
4. **Output MSI** - Ready for distribution

## Files

### Core Files
- `Product.wxs` - Main WiX installer definition
- `DownloadCA.cs` - C# custom action for downloading
- `build-wix.bat` - Build automation script

### Generated Files
- `DownloadCA.dll` - Compiled custom action
- `Product.wixobj` - Compiled WiX object
- `TabezaConnect-Setup-1.2.0.msi` - Final installer

### Assets
- `LICENSE.rtf` - Rich text license file
- `banner.bmp` - Installation banner
- `dialog.bmp` - Custom dialog images

## Installation Process

### User Experience
1. **Launch MSI** - Double-click installer
2. **Welcome Screen** - Professional welcome
3. **License Agreement** - RTF license display
4. **Install Location** - Choose Program Files
5. **Download Progress** - Real-time download bar
6. **Installation** - Copy files and create shortcuts
7. **Completion** - Success message

### Technical Process
1. **Custom Action** - Downloads TabezaConnect.exe
2. **File Copy** - Copies to installation directory
3. **Shortcut Creation** - Desktop + Start Menu
4. **Registry Setup** - Auto-start + uninstall info
5. **Rollback** - Undo if installation fails

## Advantages over NSIS

### Enterprise Features
- ✅ **MSI Format** - Standard Windows installer
- ✅ **Group Policy** - Corporate deployment
- ✅ **Patch System** - Update management
- ✅ **Digital Signatures** - Code signing
- ✅ **Rollback** - Transactional installation

### Professional Benefits
- ✅ **Better Error Handling** - Windows Installer logging
- ✅ **Repair Function** - Fix broken installations
- ✅ **Upgrade Support** - Major upgrade handling
- ✅ **Validation** - Digital signature verification

## Deployment

### GitHub Release
1. Upload `TabezaConnect-Setup-1.2.0.mi` to releases
2. Update release notes to mention WiX installer
3. Test installation on clean Windows system

### Corporate Distribution
- Deploy via Group Policy
- Silent installation with `/quiet`
- Centralized management
- Standard MSI deployment

## Troubleshooting

### Common Issues

**Build Errors**:
- Ensure WiX Toolset is in PATH
- Install Visual Studio Build Tools for C# compilation
- Check .NET Framework availability

**Installation Errors**:
- Verify internet connection for download
- Check administrator privileges
- Ensure sufficient disk space

**Download Failures**:
- Verify GitHub repository access
- Check version number in URL
- Test network connectivity

### Support
- **Documentation**: https://tabeza.co.ke/docs
- **Technical Support**: https://tabeza.co.ke/support
- **Issues**: https://github.com/billoapp/TabezaConnect/issues

## Next Steps

### Future Enhancements
- Auto-update checking
- Hash verification
- Multi-language support
- Custom themes
- Advanced logging

### Testing
- Test on Windows 10/11
- Verify silent installation
- Test rollback scenarios
- Validate uninstall process

---

**This WiX installer provides enterprise-grade installation for Tabeza POS Connect with professional features and reliability.**
