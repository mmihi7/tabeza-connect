# Inno Setup Installer Integration - Requirements

## Overview
Replace the current ZIP-based TabezaConnect installer with a professional Inno Setup (.exe) installer that provides a standard Windows installation experience with automatic admin elevation and integrated configuration.

## User Stories

### US-1: Simple Installation Experience
**As a** venue owner  
**I want** a simple .exe installer with a familiar Windows wizard  
**So that** I can install TabezaConnect without technical knowledge

**Acceptance Criteria:**
- Double-clicking the .exe launches a standard Windows installation wizard
- Installer automatically requests admin elevation
- All steps are guided with clear instructions
- Installation completes without manual file extraction

### US-2: Automated Configuration
**As an** installer  
**I want** the installer to handle all configuration steps automatically  
**So that** I don't need to run separate PowerShell scripts

**Acceptance Criteria:**
- Installer collects Bar ID during installation
- Watch folder is created automatically
- Virtual printer is configured automatically
- Windows service is registered and started automatically
- No manual post-installation steps required

### US-3: Automated Release Process
**As a** developer  
**I want** the Inno Setup build integrated into the release workflow  
**So that** releases are fully automated

**Acceptance Criteria:**
- GitHub Actions workflow compiles the Inno Setup installer
- .exe file is created and validated automatically
- Release includes the .exe installer as an asset
- Download URL works: `/releases/latest/download/TabezaConnect-Setup-v{version}.exe`

### US-4: Professional Uninstallation
**As a** venue owner  
**I want** a proper uninstaller  
**So that** I can cleanly remove TabezaConnect if needed

**Acceptance Criteria:**
- Uninstaller appears in Windows "Add or Remove Programs"
- Uninstaller stops and removes the Windows service
- Uninstaller removes all installed files
- Uninstaller optionally preserves configuration and data

## Technical Requirements

### TR-1: Inno Setup Script
Create a comprehensive Inno Setup script (.iss) that:
- Bundles Node.js runtime from `src/installer/nodejs-bundle/`
- Installs to `C:\Program Files\Tabeza`
- Creates watch folder at `C:\TabezaPrints` with proper permissions
- Configures virtual printer using PowerShell scripts
- Registers Windows service with configuration
- Collects Bar ID via custom wizard page
- Requires admin elevation
- Includes proper version information and branding

### TR-2: Build Integration
Update the build process to:
- Compile Inno Setup script after building nodejs-bundle
- Generate `TabezaConnect-Setup-v{version}.exe`
- Place output in `dist/` directory
- Support both local builds and GitHub Actions
- Validate the generated .exe file

### TR-3: GitHub Actions Integration
Modify the release workflow to:
- Install Inno Setup compiler on Windows runner
- Build the .exe installer
- Validate the .exe artifact
- Upload .exe to GitHub release
- Update release notes to reference .exe installer

### TR-4: PowerShell Script Compatibility
Ensure PowerShell scripts work with Inno Setup:
- Scripts can be called from Inno Setup's `[Run]` section
- Scripts accept command-line parameters
- Scripts provide proper exit codes
- Scripts handle silent/unattended mode

## Non-Functional Requirements

### NFR-1: User Experience
- Installation completes in under 5 minutes
- Progress bar shows installation status
- Clear error messages if installation fails
- Professional branding and icons

### NFR-2: Compatibility
- Works on Windows 10 and later
- Supports both x64 and x86 architectures
- Compatible with Windows Defender and antivirus software

### NFR-3: Maintainability
- Inno Setup script is well-documented
- Build process is reproducible
- Version numbers are automatically synchronized

## Out of Scope
- Multi-language support (English only for now)
- Custom installation paths (fixed to C:\Program Files\Tabeza)
- Portable/standalone version
- Auto-update functionality

## Dependencies
- Inno Setup 6.x compiler
- Existing PowerShell scripts (configure-printer.ps1, register-service.ps1)
- GitHub Actions Windows runner
- Node.js runtime bundle

## Success Metrics
- Installation success rate > 95%
- Average installation time < 3 minutes
- Zero manual post-installation steps required
- GitHub release automation works end-to-end
