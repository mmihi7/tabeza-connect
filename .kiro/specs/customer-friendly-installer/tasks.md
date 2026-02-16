# Customer-Friendly Installer - Implementation Tasks

## Phase 1: Installer Foundation (Week 1)

### 1.1 Node.js Runtime Bundling
- [x] Download portable Node.js v18.19.0 for Windows
- [x] Create extraction script for private installation
- [ ] Test bundled Node.js in Program Files\Tabeza
- [ ] Verify no conflicts with system Node.js
- [ ] Test native module loading (chokidar, etc.)

**Status:** Download and extraction working. The script successfully:
- Downloads Node.js v18.19.0 (27.97 MB)
- Extracts to `installer/nodejs-bundle/nodejs/`
- Verifies node.exe exists and is functional

**Next:** Test the full installer build process with `npm run build:installer:new`

### 1.2 Inno Setup Configuration
- [ ] Install Inno Setup 6.x
- [ ] Create base installer script (.iss file)
- [ ] Configure installation paths and permissions
- [ ] Add license agreement screen
- [ ] Test on clean Windows 10 VM

### 1.3 Windows Service Registration
- [ ] Create service wrapper batch file
- [ ] Implement PowerShell service registration script
- [ ] Configure automatic recovery settings
- [ ] Test service start/stop/restart
- [ ] Verify service runs on system boot

### 1.4 Watch Folder Creation
- [ ] Create folder structure script (TabezaPrints, processed, errors)
- [ ] Set proper folder permissions
- [ ] Test folder recreation if deleted
- [ ] Verify service can write to folders
- [ ] Test with non-admin user accounts

## Phase 2: Automated Printer Configuration (Week 2)

### 2.1 Dual-Printer Detection
- [ ] Create PowerShell script to detect physical printers
- [ ] Identify receipt/thermal printers by driver name
- [ ] Warn if no physical printer found
- [ ] Log physical printer configuration
- [ ] Test with 3+ different printer brands

### 2.2 Virtual Printer Setup
- [ ] Add Generic/Text Only printer driver
- [ ] Configure FILE: port for virtual printer
- [ ] Set default save path via registry
- [ ] Name printer "Tabeza Receipt Printer"
- [ ] Verify printer appears in POS printer list

### 2.3 POS Compatibility Testing
- [ ] Test with Square POS
- [ ] Test with Toast POS
- [ ] Test with Clover POS
- [ ] Test with generic Windows POS software
- [ ] Test with Notepad (baseline)
- [ ] Document compatibility matrix

### 2.4 Error Handling
- [ ] Handle missing printer drivers
- [ ] Handle permission errors
- [ ] Handle port conflicts
- [ ] Provide actionable error messages
- [ ] Create troubleshooting guide

## Phase 3: System Tray and Monitoring (Week 3)

### 3.1 System Tray Application
- [ ] Install systray2 npm package
- [ ] Create tray application entry point
- [ ] Design status icons (green/yellow/red/gray)
- [ ] Implement tray menu structure
- [ ] Test tray app startup on boot

### 3.2 Status Monitoring
- [ ] Implement service health check (localhost:8765)
- [ ] Implement cloud heartbeat check
- [ ] Update tray icon based on status
- [ ] Show receipt count in menu
- [ ] Display last heartbeat time

### 3.3 User Actions
- [ ] Implement test print functionality
- [ ] Implement "Open Dashboard" action
- [ ] Implement "Settings" action
- [ ] Implement "Exit" action
- [ ] Add Windows notifications for events

### 3.4 Offline Mode Handling
- [ ] Detect offline status
- [ ] Show yellow icon when offline
- [ ] Display queue size in menu
- [ ] Show "Syncing..." when reconnecting
- [ ] Test with network disconnection

## Phase 4: Security and Polish (Week 4)

### 4.1 EV Code Signing Certificate
- [ ] Research certificate providers (DigiCert, Sectigo)
- [ ] Purchase EV code signing certificate
- [ ] Complete validation process (2-3 weeks)
- [ ] Install certificate on build machine
- [ ] Test signing process

### 4.2 Executable Signing
- [ ] Sign installer executable with EV certificate
- [ ] Sign service executable
- [ ] Sign tray application executable
- [ ] Verify signatures with signtool
- [ ] Test on Windows 10/11 (no SmartScreen warning)

### 4.3 Auto-Update Implementation
- [ ] Create update manifest structure
- [ ] Implement manifest signing
- [ ] Implement signature verification
- [ ] Create update download mechanism
- [ ] Implement backup/rollback system
- [ ] Test update process end-to-end

### 4.4 Non-Admin Installation
- [ ] Detect admin vs non-admin mode
- [ ] Install to user directory if non-admin
- [ ] Use NetworkService for service account
- [ ] Test in enterprise environment
- [ ] Document limitations of non-admin mode

## Phase 5: Mode-Based Configuration (Week 5)

### 5.1 Bar Configuration API
- [ ] Create endpoint to fetch bar configuration
- [ ] Return venue_mode and authority_mode
- [ ] Return printer_required flag
- [ ] Implement caching for offline installs
- [ ] Test with all mode combinations

### 5.2 Conditional Printer Installation
- [ ] Skip printer setup if printer_required = false
- [ ] Show appropriate message for Tabeza-only mode
- [ ] Test Basic mode (printer required)
- [ ] Test Venue+POS mode (printer required)
- [ ] Test Venue+Tabeza mode (printer not required)

### 5.3 Configuration Wizard
- [ ] Create bar code entry screen
- [ ] Validate bar code format (UUID)
- [ ] Fetch bar configuration from API
- [ ] Show mode-specific instructions
- [ ] Display configuration summary

### 5.4 Post-Install Verification
- [ ] Test printer configuration (if required)
- [ ] Send test heartbeat to cloud
- [ ] Verify service is running
- [ ] Display success message with next steps
- [ ] Provide troubleshooting link if verification fails

## Phase 6: Beta Testing and Documentation (Week 6)

### 6.1 Beta Testing
- [ ] Recruit 3 beta test venues
- [ ] Provide installation instructions
- [ ] Monitor installation success rate
- [ ] Collect feedback on user experience
- [ ] Fix critical issues discovered

### 6.2 User Documentation
- [ ] Write 3-page quick start guide
- [ ] Create installation troubleshooting guide
- [ ] Document system tray features
- [ ] Create FAQ for common issues
- [ ] Record 2-minute video tutorial

### 6.3 Technical Documentation
- [ ] Document architecture overview
- [ ] Document security implementation
- [ ] Document update mechanism
- [ ] Create disaster recovery guide
- [ ] Document known issues and workarounds

### 6.4 Support Documentation
- [ ] Create error code reference
- [ ] Document log file locations
- [ ] Create remote support procedures
- [ ] Define escalation guidelines
- [ ] Create support ticket templates

## Phase 7: Production Release

### 7.1 Pre-Release Checklist
- [ ] All tests passing on Windows 10/11
- [ ] EV code signing working
- [ ] Auto-update tested end-to-end
- [ ] Documentation complete
- [ ] Support team trained

### 7.2 Release Preparation
- [ ] Create release notes
- [ ] Set up update server
- [ ] Configure download page
- [ ] Prepare marketing materials
- [ ] Schedule release announcement

### 7.3 Deployment
- [ ] Upload signed installer to download server
- [ ] Update website download link
- [ ] Send announcement to existing customers
- [ ] Monitor installation success rate
- [ ] Respond to support tickets

### 7.4 Post-Release Monitoring
- [ ] Monitor installation metrics (first 48 hours)
- [ ] Track support ticket volume
- [ ] Collect user feedback
- [ ] Identify and fix critical bugs
- [ ] Plan first update release

---

## Testing Checklist

### Installation Testing
- [ ] Clean Windows 10 VM
- [ ] Clean Windows 11 VM
- [ ] Windows Server 2019
- [ ] Admin user account
- [ ] Non-admin user account
- [ ] Enterprise environment (domain-joined)
- [ ] Offline installation (no internet)

### Printer Testing
- [ ] No existing printers
- [ ] One physical printer
- [ ] Multiple physical printers
- [ ] Network printer
- [ ] USB printer
- [ ] Bluetooth printer

### POS System Testing
- [ ] Square POS
- [ ] Toast POS
- [ ] Clover POS
- [ ] Generic Windows POS
- [ ] Notepad (baseline)

### Mode Testing
- [ ] Basic mode installation
- [ ] Venue + POS mode installation
- [ ] Venue + Tabeza mode installation
- [ ] Mode switching after installation

### Update Testing
- [ ] Update from v1.0.0 to v1.0.1
- [ ] Update with service running
- [ ] Update with service stopped
- [ ] Failed update rollback
- [ ] Update during business hours (should defer)

### Security Testing
- [ ] Signature verification
- [ ] Tampered update rejection
- [ ] HTTPS enforcement
- [ ] Certificate expiration handling
- [ ] Malicious update detection

---

## Success Criteria

### Installation Metrics
- [ ] Installation success rate >95%
- [ ] Average installation time <2 minutes
- [ ] Support tickets per installation <0.1
- [ ] User satisfaction score >4.5/5
- [ ] Completion rate without assistance >90%

### Operational Metrics
- [ ] Service uptime >99.9%
- [ ] Receipt processing success rate >99%
- [ ] Average receipt processing time <5 seconds
- [ ] Offline queue recovery rate 100%
- [ ] Auto-update success rate >98%

### Business Metrics
- [ ] Reduction in support tickets >80%
- [ ] Increase in adoption rate >300%
- [ ] Time to first successful receipt <5 minutes
- [ ] Customer retention after installation >95%
- [ ] Net Promoter Score >50

---

**Timeline:** 6 weeks  
**Team Size:** 2-3 developers  
**Dependencies:** EV code signing certificate (2-3 week lead time)  
**Risk Level:** Medium (security and compatibility testing critical)
