# Tabeza Connect v1.7.15 - Distribution Release Notes

**Release Date**: April 10, 2026  
**Build Type**: Complete Package (No Internet Required)  
**Installer Size**: 314.8 MB (300 MB compressed)  
**Platform**: Windows 10/11 (x64)

---

## 🎯 What's New in v1.7.15

This release includes critical bug fixes that improve installation reliability, printer setup, window management, error handling, and uninstallation cleanup.

### Critical Bug Fixes

#### 1. Bar ID Persistence (Bug 1) ✅
**Problem**: Bar ID entered during installation was not persisted to config.json  
**Solution**:
- Installer now writes Bar ID directly to config.json before service registration
- Added registry-to-config migration on first service startup
- Added environment variable fallback for Bar ID
- Service now reads Bar ID from multiple sources with priority: env vars → registry → config.json

**Impact**: Users no longer see "✗ Bar ID not configured" after successful installation

#### 2. POS Printer Setup (Bug 2) ✅
**Problem**: Printer setup failed with cryptic exit code -196608 and no actionable guidance  
**Solution**:
- Added exit code interpretation with specific error messages
- Added prerequisite validation (checks for printer driver and RedMon before setup)
- Improved error messages with actionable recovery steps:
  - UAC cancelled: "Administrator privileges required. Please grant UAC permission and try again."
  - Driver missing: "Printer driver not found. Please install the printer driver and try again."
  - RedMon missing: "RedMon port monitor not installed. Please run the full installer to configure RedMon."

**Impact**: Users get clear guidance on how to fix printer setup issues

#### 3. Window Focus Stealing (Bug 3) ✅
**Problem**: Tabeza window repeatedly stole focus from other applications  
**Solution**:
- Removed aggressive focus() calls in showManagementUI()
- Added focus guard to prevent programmatic focus changes
- Added debouncing to prevent rapid focus changes
- Window only comes to front when explicitly invoked by user (clicking tray icon)

**Impact**: Users can work in other applications without interruption

#### 4. EPIPE Broken Pipe Errors (Bug 4) ✅
**Problem**: RedMon registry check failures generated cascading EPIPE errors  
**Solution**:
- Wrapped console operations in try/catch blocks
- Replaced execSync with async exec to avoid blocking and pipe issues
- Added circuit breaker to prevent cascading errors
- Errors are now logged to file instead of causing pipe failures

**Impact**: Clean error logs, no more EPIPE error spam

#### 5. RedMon Dependency Validation (Bug 5) ✅
**Problem**: App continued running without RedMon, causing silent receipt capture failures  
**Solution**:
- Added mandatory dependency check on app startup
- Shows clear user-facing error dialog when RedMon is missing
- Enters degraded mode that prevents receipt capture attempts
- Provides installation instructions to user

**Impact**: Users are immediately notified if RedMon is missing, preventing silent failures

#### 6. Incomplete Uninstallation (Bug 6) ✅
**Problem**: Uninstaller left registry entries, causing confusion on reinstall  
**Solution**:
- Added registry cleanup to uninstaller (removes HKLM\SOFTWARE\Tabeza\Connect)
- Added service environment variable cleanup
- Added pre-install cleanup prompt when old registry entries are detected
- Users can choose to clean up old configuration or preserve it

**Impact**: Clean uninstallation, no configuration conflicts on reinstall

---

## 📦 What's Included

### Complete Electron Distribution
- ✅ Electron 28.3.3 runtime (~280MB)
- ✅ Node.js dependencies bundled
- ✅ No internet downloads required during installation

### Windows Printer Pooling
- ✅ Automatic "Tabeza Agent" printer creation
- ✅ Local Port configuration for receipt capture
- ✅ Physical printer passthrough

### PowerShell Scripts
- ✅ Installation and configuration scripts
- ✅ Service registration and management
- ✅ Printer setup and verification
- ✅ Uninstallation cleanup

### Folder Structure
- ✅ C:\ProgramData\Tabeza\ (main data folder)
- ✅ Queue system for offline resilience
- ✅ Logs and processed receipts folders

### Windows Service
- ✅ Auto-start on boot
- ✅ Runs under LocalService account
- ✅ Environment variables configured

---

## 🚀 Installation Process

The installer performs these steps automatically:

1. **Pre-Installation Check** (NEW in v1.7.15)
   - Detects previous installation remnants
   - Prompts user to clean up old registry entries
   - Ensures fresh installation state

2. **Folder Structure Creation**
   - Creates C:\ProgramData\Tabeza\ with all subfolders
   - Sets proper permissions for LocalService account

3. **Bar ID Configuration** (FIXED in v1.7.15)
   - Writes Bar ID to config.json immediately
   - Sets registry values for fallback
   - Configures service environment variables

4. **Windows Printer Pooling**
   - Creates "Tabeza Agent" printer
   - Configures Local Port for receipt capture
   - Maintains physical printer functionality

5. **Windows Service Registration**
   - Registers TabezaConnect service
   - Sets auto-start configuration
   - Starts the service

6. **Verification**
   - Verifies all components installed correctly
   - Checks service status
   - Validates printer configuration

7. **Post-Installation**
   - Launches system tray application
   - Opens management UI at localhost:8765
   - Shows post-installation instructions

---

## 🗑️ Uninstallation Process (IMPROVED in v1.7.15)

The uninstaller now properly cleans up all components:

1. Stops tray application
2. Stops Windows Service
3. Deletes Windows Service
4. **Removes registry entries** (NEW)
5. **Removes service environment variables** (NEW)
6. Removes Tabeza Agent printer
7. Cleans up log files and processed receipts
8. Preserves config.json and template.json (optional)

---

## ✅ Testing Summary

All 6 critical bugs have been tested and verified fixed:

- **Test Suites**: 11 passed, 1 skipped (requires admin)
- **Tests**: 87 passed, 3 skipped (registry operations)
- **Bug Condition Tests**: All PASS (bugs are fixed)
- **Preservation Tests**: All PASS (no regressions)

### Test Coverage

- ✅ Bar ID persistence from installer to runtime
- ✅ Printer setup error handling and validation
- ✅ Window focus management
- ✅ EPIPE error prevention
- ✅ RedMon dependency validation
- ✅ Complete uninstallation cleanup
- ✅ No regressions in existing functionality

---

## 📋 System Requirements

- **Operating System**: Windows 10 or Windows 11
- **Architecture**: 64-bit (x64)
- **Privileges**: Administrator rights required for installation
- **Disk Space**: 500 MB free space
- **RAM**: 2 GB minimum, 4 GB recommended
- **Network**: Internet connection for cloud sync (not required for installation)

---

## 🔧 Upgrade Instructions

### From v1.7.10 or Earlier

1. **Backup your configuration** (optional but recommended):
   - Copy `C:\ProgramData\Tabeza\config.json`
   - Copy `C:\ProgramData\Tabeza\template.json`

2. **Run the new installer**:
   - The installer will detect the previous installation
   - Choose "No" when asked to clean up old configuration (to preserve settings)
   - Or choose "Yes" for a fresh installation

3. **Verify the upgrade**:
   - Check that Bar ID is still configured
   - Verify receipt template is still present
   - Test printer setup

### Fresh Installation

1. **Run the installer**: `TabezaConnect-Setup-v1.7.15.exe`
2. **Enter your Bar ID** when prompted
3. **Complete the installation** wizard
4. **Configure your receipt template** via the management UI

---

## 🐛 Known Issues

None at this time. All critical bugs from v1.7.10 have been resolved.

---

## 📞 Support

- **Website**: https://tabeza.co.ke
- **Email**: support@tabeza.co.ke
- **Documentation**: See `GUIDE.md` and `ARCHITECTURE.md` in the installation folder

---

## 📝 Version History

### v1.7.15 (April 10, 2026)
- Fixed Bar ID persistence from installer to runtime
- Fixed POS printer setup error handling
- Fixed window focus stealing
- Fixed EPIPE broken pipe errors
- Fixed RedMon dependency validation
- Fixed incomplete uninstallation cleanup
- Updated to Electron 28.3.3
- Improved error messages and user guidance

### v1.7.10 (Previous Release)
- Initial stable release
- Windows Printer Pooling implementation
- Queue system for offline resilience
- Template generator with AI support

---

**Built with ❤️ in Nairobi, Kenya**
