# Tabeza Connect Installer - Implementation Status

## Completed Tasks

### Phase 1: Installer Foundation ✅

#### 1.1 Node.js Runtime Bundling ✅
- ✅ Created `download-nodejs.js` - Downloads portable Node.js v18.19.0
- ✅ Automatic extraction to `nodejs-bundle/` directory
- ✅ Verification of node.exe and version checking
- ✅ Private installation strategy (no conflicts with system Node.js)
- ⏳ Testing with native modules (chokidar) - needs verification

#### 1.2 Inno Setup Configuration ⏳
- ⏳ Need to create `.iss` file for Inno Setup
- ⏳ Need to install Inno Setup 6.x
- ⏳ Configure installation paths and permissions
- ⏳ Add license agreement screen
- ⏳ Test on clean Windows 10 VM

#### 1.3 Windows Service Registration ✅
- ✅ Created `register-service.ps1` - Full service registration
- ✅ Service wrapper batch file generation
- ✅ Automatic recovery configuration (restart on failure)
- ✅ LocalSystem account configuration
- ⏳ Testing service start/stop/restart
- ⏳ Verify service runs on system boot

#### 1.4 Watch Folder Creation ✅
- ✅ Created `create-folders.ps1` - Complete folder structure
- ✅ Proper folder permissions (Everyone: Full Control)
- ✅ Subfolders: processed, errors, queue
- ✅ README.txt generation with instructions
- ⏳ Test folder recreation if deleted
- ⏳ Test with non-admin user accounts

### Phase 2: Automated Printer Configuration ✅

#### 2.1 Dual-Printer Detection ✅
- ✅ Created `detect-printers.ps1` - Physical printer detection
- ✅ Receipt/thermal printer identification by keywords
- ✅ Warning if no physical printer found
- ✅ JSON export of detection results
- ⏳ Test with 3+ different printer brands

#### 2.2 Virtual Printer Setup ✅
- ✅ Created `configure-printer.ps1` - Complete printer setup
- ✅ Generic/Text Only driver installation
- ✅ FILE: port configuration
- ✅ Registry configuration for default save path
- ✅ Printer naming: "Tabeza Receipt Printer"
- ⏳ Verify printer appears in POS printer list

#### 2.3 POS Compatibility Testing ⏳
- ⏳ Test with Square POS
- ⏳ Test with Toast POS
- ⏳ Test with Clover POS
- ⏳ Test with generic Windows POS software
- ⏳ Test with Notepad (baseline)
- ⏳ Document compatibility matrix

#### 2.4 Error Handling ⏳
- ✅ Basic error handling in PowerShell scripts
- ⏳ Handle missing printer drivers
- ⏳ Handle permission errors
- ⏳ Handle port conflicts
- ⏳ Create troubleshooting guide

### Phase 3: System Tray and Monitoring ⏳

#### 3.1 System Tray Application ✅ (Existing)
- ✅ Electron-based tray app exists (electron-main.js)
- ✅ Status icons implemented
- ✅ Tray menu structure complete
- ⏳ Test tray app startup on boot

#### 3.2 Status Monitoring ⏳
- ⏳ Implement service health check (localhost:8765)
- ⏳ Implement cloud heartbeat check
- ⏳ Update tray icon based on status
- ⏳ Show receipt count in menu
- ⏳ Display last heartbeat time

#### 3.3 User Actions ⏳
- ⏳ Implement test print functionality
- ⏳ Implement "Open Dashboard" action
- ⏳ Implement "Settings" action
- ⏳ Implement "Exit" action
- ⏳ Add Windows notifications for events

#### 3.4 Offline Mode Handling ⏳
- ⏳ Detect offline status
- ⏳ Show yellow icon when offline
- ⏳ Display queue size in menu
- ⏳ Show "Syncing..." when reconnecting
- ⏳ Test with network disconnection

### Phase 4: Security and Polish ⏳

#### 4.1 EV Code Signing Certificate ⏳
- ⏳ Research certificate providers (DigiCert, Sectigo)
- ⏳ Purchase EV code signing certificate
- ⏳ Complete validation process (2-3 weeks)
- ⏳ Install certificate on build machine
- ⏳ Test signing process

#### 4.2 Executable Signing ⏳
- ⏳ Sign installer executable with EV certificate
- ⏳ Sign service executable
- ⏳ Sign tray application executable
- ⏳ Verify signatures with signtool
- ⏳ Test on Windows 10/11 (no SmartScreen warning)

#### 4.3 Auto-Update Implementation ⏳
- ⏳ Create update manifest structure
- ⏳ Implement manifest signing
- ⏳ Implement signature verification
- ⏳ Create update download mechanism
- ⏳ Implement backup/rollback system
- ⏳ Test update process end-to-end

#### 4.4 Non-Admin Installation ⏳
- ⏳ Detect admin vs non-admin mode
- ⏳ Install to user directory if non-admin
- ⏳ Use NetworkService for service account
- ⏳ Test in enterprise environment
- ⏳ Document limitations of non-admin mode

### Phase 5: Mode-Based Configuration ⏳

#### 5.1 Bar Configuration API ⏳
- ⏳ Create endpoint to fetch bar configuration
- ⏳ Return venue_mode and authority_mode
- ⏳ Return printer_required flag
- ⏳ Implement caching for offline installs
- ⏳ Test with all mode combinations

#### 5.2 Conditional Printer Installation ⏳
- ⏳ Skip printer setup if printer_required = false
- ⏳ Show appropriate message for Tabeza-only mode
- ⏳ Test Basic mode (printer required)
- ⏳ Test Venue+POS mode (printer required)
- ⏳ Test Venue+Tabeza mode (printer not required)

#### 5.3 Configuration Wizard ⏳
- ⏳ Create bar code entry screen
- ⏳ Validate bar code format (UUID)
- ⏳ Fetch bar configuration from API
- ⏳ Show mode-specific instructions
- ⏳ Display configuration summary

#### 5.4 Post-Install Verification ⏳
- ⏳ Test printer configuration (if required)
- ⏳ Send test heartbeat to cloud
- ⏳ Verify service is running
- ⏳ Display success message with next steps
- ⏳ Provide troubleshooting link if verification fails

## Files Created

### Installer Infrastructure
```
packages/printer-service/installer/
├── README.md                           ✅ Documentation
├── download-nodejs.js                  ✅ Node.js downloader
├── build-installer.js                  ✅ Main build script
├── scripts/
│   ├── detect-printers.ps1            ✅ Printer detection
│   ├── configure-printer.ps1          ✅ Printer setup
│   ├── create-folders.ps1             ✅ Folder creation
│   └── register-service.ps1           ✅ Service registration
└── IMPLEMENTATION-STATUS.md            ✅ This file
```

## Next Steps

### Immediate (Can be done now)
1. Create Inno Setup script (.iss file)
2. Implement bar configuration API endpoint
3. Add mode-based conditional logic to installer
4. Create configuration wizard UI
5. Implement post-install verification

### Testing Required
1. Test installer on clean Windows 10 VM
2. Test with different printer brands
3. Test POS compatibility
4. Test service auto-start on boot
5. Test folder recreation after deletion

### External Dependencies
1. Purchase EV code signing certificate ($300-500)
2. Set up update server infrastructure
3. Create download page on tabeza.co.ke
4. Recruit beta test venues

## Build Commands

```bash
# Download Node.js runtime
npm run download:nodejs

# Build complete installer package
npm run build:installer:new

# Output: dist/TabezaConnect-Setup-v1.0.0.zip
```

## Installation Flow

1. User downloads `TabezaConnect-Setup-v1.0.0.zip`
2. Extracts to temporary location
3. Right-clicks `install.bat` → "Run as administrator"
4. Enters Bar ID when prompted
5. Installer:
   - Copies Node.js runtime to `C:\Program Files\Tabeza`
   - Copies service files
   - Creates watch folder at `C:\TabezaPrints`
   - Configures virtual printer (if required by mode)
   - Registers Windows service
   - Starts service
6. Service runs on port 8765
7. User configures POS to print to "Tabeza Receipt Printer"

## Mode-Based Behavior

### Basic Mode (venue_mode='basic', authority_mode='pos')
- ✅ Printer installation: REQUIRED
- ✅ Watch folder: Created
- ✅ Service: Registered and started
- ⏳ Configuration: Minimal (Bar ID only)

### Venue + POS Mode (venue_mode='venue', authority_mode='pos')
- ✅ Printer installation: REQUIRED
- ✅ Watch folder: Created
- ✅ Service: Registered and started
- ⏳ Configuration: Full (Bar ID + settings)

### Venue + Tabeza Mode (venue_mode='venue', authority_mode='tabeza')
- ❌ Printer installation: SKIPPED
- ❌ Watch folder: NOT CREATED
- ❌ Service: NOT INSTALLED
- ⏳ Message: "Printer integration not needed for Tabeza-only mode"

## Known Issues

1. Registry configuration for FILE: port may not work on all Windows versions
2. Service may fail to start if port 8765 is already in use
3. Printer detection keywords may miss some thermal printer brands
4. Non-admin installation not yet implemented

## Testing Checklist

- [ ] Clean Windows 10 VM installation
- [ ] Clean Windows 11 VM installation
- [ ] Windows Server 2019 installation
- [ ] Admin user account
- [ ] Non-admin user account
- [ ] Enterprise environment (domain-joined)
- [ ] Offline installation (no internet)
- [ ] Multiple printer brands
- [ ] POS system compatibility
- [ ] Service auto-start on boot
- [ ] Folder recreation after deletion
- [ ] Mode-based conditional installation

## Progress Summary

- **Phase 1**: 75% complete (3/4 tasks have code, testing needed)
- **Phase 2**: 50% complete (2/4 tasks complete, testing needed)
- **Phase 3**: 25% complete (existing tray app, needs integration)
- **Phase 4**: 0% complete (requires external dependencies)
- **Phase 5**: 0% complete (needs API and UI work)

**Overall Progress**: ~30% complete (foundational code done, testing and integration needed)
