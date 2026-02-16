# Customer-Friendly Installer - Requirements

## 1. Overview

Transform Tabeza's printer service installation from a developer-centric process requiring 15+ manual steps into a customer-friendly 3-step, 2-minute installation experience. This enables non-technical bar and restaurant owners to integrate their POS systems with Tabeza without understanding the underlying technology stack.

## 2. Problem Statement

### Current State
- Users must install Node.js, pnpm, and Git manually
- Configuration requires editing environment variables and creating batch files
- Printer setup involves manual driver/port/folder configuration
- Process takes 30-60 minutes and requires command-line proficiency
- 15+ steps create a fundamental barrier to adoption

### Target State
- Download single executable file
- Run installer with GUI wizard
- Enter bar code and select printer
- Complete setup in 2 minutes with zero technical knowledge

## 3. User Stories

### US-1: Non-Technical Installation
**As a** bar owner with no technical background  
**I want to** install Tabeza printer integration by downloading and running a single file  
**So that** I can connect my POS to Tabeza without hiring technical support

**Acceptance Criteria:**
- 1.1: Single .exe file downloads from Tabeza website
- 1.2: No prerequisite software installation required
- 1.3: Installer runs without administrator privileges (with fallback to admin mode)
- 1.4: Installation completes in under 2 minutes
- 1.5: No command-line interaction required

### US-2: Automated Printer Configuration
**As a** restaurant owner  
**I want the** installer to automatically configure my virtual printer  
**So that** I don't need to understand Windows printer drivers and ports

**Acceptance Criteria:**
- 2.1: Installer creates Generic/Text Only printer automatically
- 2.2: FILE: port configured to output to watch folder
- 2.3: Watch folder (C:\TabezaPrints) created with proper permissions
- 2.4: Printer appears in POS system's printer list immediately
- 2.5: Test print functionality verifies configuration

### US-3: Dual-Printer Architecture
**As a** bar owner  
**I want** Tabeza to work alongside my physical printer  
**So that** my POS always prints receipts even if Tabeza is offline

**Acceptance Criteria:**
- 3.1: POS can print to both physical printer and Tabeza virtual printer
- 3.2: Physical printer continues working if Tabeza service crashes
- 3.3: Physical printer continues working if Windows PC goes offline
- 3.4: Physical printer continues working during Tabeza updates
- 3.5: Tabeza never blocks, delays, or interferes with physical printing

### US-4: Progressive Configuration
**As a** venue owner  
**I want to** complete basic setup immediately and configure advanced options later  
**So that** I can start using Tabeza quickly without being overwhelmed

**Acceptance Criteria:**
- 4.1: Minimum configuration requires only bar code entry
- 4.2: All other settings have sensible defaults
- 4.3: Advanced configuration accessible via system tray menu
- 4.4: Configuration changes apply without reinstallation
- 4.5: Users reach working state in 3 steps maximum

### US-5: Self-Healing System
**As a** bar manager  
**I want the** system to automatically recover from common failures  
**So that** I don't need technical support for routine issues

**Acceptance Criteria:**
- 5.1: Service recreates watch folder if deleted
- 5.2: Service reconfigures if printer settings change
- 5.3: Failed uploads queue and retry automatically
- 5.4: Windows restarts service on crash via recovery settings
- 5.5: System tray shows health status (green/yellow/red)

### US-6: Offline-First Operation
**As a** restaurant owner with unreliable internet  
**I want** receipts to queue locally when offline  
**So that** I don't lose data during connectivity issues

**Acceptance Criteria:**
- 6.1: Receipts detected while offline queue with timestamps
- 6.2: Service attempts upload with exponential backoff
- 6.3: Queued receipts upload in order when connectivity resumes
- 6.4: System tray indicates offline status
- 6.5: No data loss during offline periods

### US-7: Secure Auto-Updates
**As a** bar owner  
**I want** Tabeza to update automatically with security verification  
**So that** I always have the latest features without manual intervention

**Acceptance Criteria:**
- 7.1: Updates signed with EV code signing certificate
- 7.2: Signature verification before accepting updates
- 7.3: Update manifest signing prevents tampering
- 7.4: HTTPS enforcement for update server communications
- 7.5: Rollback mechanism for failed updates
- 7.6: Configurable maintenance windows (avoid business hours)

### US-8: System Tray Monitoring
**As a** bar staff member  
**I want** visual feedback on printer service status  
**So that** I know when the system is working correctly

**Acceptance Criteria:**
- 8.1: Green icon indicates normal operation
- 8.2: Yellow icon indicates warnings (offline mode)
- 8.3: Red icon indicates errors requiring attention
- 8.4: Click icon reveals dashboard with receipt count, queue status, heartbeat
- 8.5: One-click test print functionality

## 4. Technical Requirements

### TR-1: Installer Foundation
- Bundle Node.js runtime in private installation location
- Use Inno Setup for Windows installer creation
- Register Windows service with automatic recovery
- Create watch folder structure automatically
- Handle both admin and non-admin installation modes

### TR-2: Automated Printer Setup
- PowerShell script for printer configuration
- Registry configuration for default save path
- Generic/Text Only driver (built into Windows)
- FILE: port configuration (built into Windows)
- Compatibility testing with 5+ POS systems

### TR-3: Security Implementation
- EV code signing certificate ($300-500/year)
- Cryptographic signature verification
- Update manifest signing
- HTTPS-only update communications
- Rollback mechanism for failed updates

### TR-4: Node.js Bundling
- Bundle Node.js runtime (not pkg tool)
- Private installation in Program Files\Tabeza
- Include all native modules (chokidar, etc.)
- No conflicts with system Node.js installations
- Support for runtime file path operations

### TR-5: System Tray Application
- Use Node.js systray2 package (not C#)
- Single codebase with printer service
- No inter-process communication overhead
- No .NET runtime dependencies
- Real-time status updates

## 5. Non-Functional Requirements

### NFR-1: Performance
- Installation completes in under 2 minutes
- Service starts within 5 seconds
- Receipt detection within 2 seconds
- Minimal CPU usage (<5% idle)
- Minimal memory footprint (<100MB)

### NFR-2: Reliability
- 99.9% uptime for printer service
- Zero data loss during offline periods
- Automatic recovery from crashes
- Graceful degradation when cloud unavailable
- No interference with POS operations

### NFR-3: Usability
- Zero technical knowledge required
- 3-step installation process
- Clear error messages with actionable guidance
- Visual status indicators
- One-click test functionality

### NFR-4: Security
- Signed executables (no SmartScreen warnings)
- Secure update mechanism
- No elevation of privileges without user consent
- Encrypted communication with cloud
- Audit logging of security events

### NFR-5: Compatibility
- Windows 10 and later
- Works with any POS system that can print
- No conflicts with existing printers
- Supports both admin and non-admin users
- Compatible with enterprise environments

## 6. Constraints

### Technical Constraints
- Must use built-in Windows components (no custom drivers)
- Must not require administrator privileges for normal operation
- Must not interfere with existing POS printer configuration
- Must work offline without cloud connectivity
- Must bundle all dependencies (no external downloads)

### Business Constraints
- Development timeline: 6 weeks maximum
- Annual cost: $300-500 for code signing certificate
- No per-installation licensing fees
- Must support unlimited venues
- Must scale to 1000+ installations

### Regulatory Constraints
- Must comply with Windows driver signing requirements
- Must not violate POS system vendor agreements
- Must respect printer manufacturer warranties
- Must comply with data privacy regulations
- Must provide audit trail for financial transactions

## 7. Success Metrics

### Installation Metrics
- Installation success rate: >95%
- Average installation time: <2 minutes
- Support tickets per installation: <0.1
- User satisfaction score: >4.5/5
- Completion rate without assistance: >90%

### Operational Metrics
- Service uptime: >99.9%
- Receipt processing success rate: >99%
- Average receipt processing time: <5 seconds
- Offline queue recovery rate: 100%
- Auto-update success rate: >98%

### Business Metrics
- Reduction in support tickets: >80%
- Increase in adoption rate: >300%
- Time to first successful receipt: <5 minutes
- Customer retention after installation: >95%
- Net Promoter Score: >50

## 8. Out of Scope

### Explicitly Not Included
- Custom printer driver development
- Third-party software bundling (PDFCreator, etc.)
- Port monitor development
- macOS or Linux support
- Mobile device support
- Cloud-based printer configuration
- Multi-tenant printer sharing
- Receipt format customization in installer
- POS system integration beyond printing

### Future Enhancements (Not in Initial Release)
- Receipt format templates
- Multi-language support
- Remote printer management
- Advanced analytics dashboard
- Integration with accounting software
- Bulk deployment tools for chains
- Custom branding options
- API for third-party integrations

## 9. Dependencies

### External Dependencies
- Windows 10 or later operating system
- Internet connectivity for initial setup and updates
- POS system capable of printing to Windows printers
- Tabeza cloud API (Vercel deployment)
- DeepSeek API for receipt parsing
- Supabase database for receipt storage

### Internal Dependencies
- Existing printer service codebase (packages/printer-service)
- Receipt parser service (packages/shared/services/receiptParser.ts)
- Cloud API endpoints (/api/printer/*)
- Database tables (printer_drivers, printer_relay_receipts, unmatched_receipts)
- Staff app Captain's Orders component

## 10. Risks and Mitigations

### Risk 1: Windows Compatibility Issues
**Risk:** Installer fails on certain Windows configurations  
**Impact:** High - blocks installation  
**Mitigation:** Test on clean VMs with Windows 10, 11, Server editions  
**Contingency:** Provide manual installation fallback documentation

### Risk 2: POS System Incompatibility
**Risk:** Some POS systems cannot print to FILE: port  
**Impact:** Medium - limits adoption  
**Mitigation:** Test with 5+ popular POS systems before release  
**Contingency:** Document alternative integration methods

### Risk 3: Security Certificate Delays
**Risk:** EV code signing certificate takes weeks to obtain  
**Impact:** Medium - delays release  
**Mitigation:** Start certificate procurement in Week 1  
**Contingency:** Release beta without signing for testing

### Risk 4: Node.js Bundling Complexity
**Risk:** Native modules fail in bundled environment  
**Impact:** High - runtime failures  
**Mitigation:** Use full Node.js runtime, not pkg tool  
**Contingency:** Detect and install Node.js if bundling fails

### Risk 5: Update Mechanism Failures
**Risk:** Auto-update breaks existing installations  
**Impact:** Critical - customer downtime  
**Mitigation:** Implement rollback mechanism and staged rollout  
**Contingency:** Manual update instructions and recovery tool

## 11. Compliance Requirements

### Data Privacy
- No personal customer data stored locally
- Receipt data encrypted in transit
- Audit logging of all data access
- GDPR compliance for EU customers
- Right to deletion support

### Financial Compliance
- Audit trail for all receipt processing
- No modification of POS receipt data
- Tamper-evident logging
- Backup and recovery procedures
- Disaster recovery plan

### Software Licensing
- Open source license compliance
- No GPL violations in bundled code
- Attribution for third-party libraries
- License file included in installer
- Terms of service acceptance

## 12. Documentation Requirements

### User Documentation
- 3-page quick start guide
- Installation troubleshooting guide
- System tray feature explanation
- FAQ for common issues
- Video tutorial (2 minutes)

### Technical Documentation
- Architecture overview
- API integration guide
- Security implementation details
- Update mechanism documentation
- Disaster recovery procedures

### Support Documentation
- Common error codes and solutions
- Log file locations and interpretation
- Remote support procedures
- Escalation guidelines
- Known issues and workarounds

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-12  
**Status:** Draft - Ready for Design Phase  
**Owner:** Tabeza Development Team
