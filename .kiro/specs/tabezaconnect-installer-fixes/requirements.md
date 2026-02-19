# TabezaConnect Installer Fixes - Requirements

## Overview
The current TabezaConnect v1.2.0 installer has critical deployment blockers that prevent users from installing the service. This spec addresses installer reliability, security warnings, and user experience issues.

## Problem Statement

### Current Issues
1. **Admin Rights Failure**: Installer shows "Error 5: Access is denied" even when run as administrator
2. **Excessive Security Warnings**: Antivirus software (Avast, Windows Defender) blocks installation with multiple warnings
3. **Branding Inconsistency**: Technical name "TabezaConnect" used instead of user-facing "Tabeza POS Connect"
4. **Missing Legal Agreement**: No terms and conditions acceptance during installation

### Impact
- Users cannot install the service
- Support burden increases dramatically
- Venues cannot go live with POS integration
- Professional credibility is damaged

## User Stories

### 1. As a venue owner
I want to install Tabeza Connect without encountering access denied errors
So that I can start using POS integration immediately

**Acceptance Criteria:**
- Installer runs successfully when executed as administrator
- No "Error 5: Access is denied" messages appear
- Installation prompts for Bar ID during setup
- Installation requires acceptance of combined terms and conditions
- Service starts automatically after installation

### 2. As a venue owner
I want to accept terms and conditions during installation
So that I understand my rights and responsibilities

**Acceptance Criteria:**
- Installer displays a combined terms and conditions checkbox
- Checkbox includes link to full terms at tabeza.co.ke
- Installation cannot proceed without accepting terms
- Acceptance is logged for compliance purposes

### 3. As a venue owner
I want to see "Tabeza POS Connect" (with space) in all user-facing contexts
So that the branding is consistent and professional

**Acceptance Criteria:**
- Windows Programs list shows "Tabeza POS Connect"
- Start menu shows "Tabeza POS Connect"
- Service display name is "Tabeza POS Connect"
- Installer window title shows "Tabeza POS Connect Setup"
- Technical files (exe, service name) can remain "TabezaConnect"

### 4. As a venue owner
I want clear installation instructions that work
So that I can install without technical support

**Acceptance Criteria:**
- Installation guide matches actual installer behavior
- Troubleshooting steps address common issues
- Alternative installation methods are documented
- Support contact information is provided

## Technical Requirements

### 1. Admin Rights Handling
**Requirement 1.1**: Installer must properly request and verify administrator privileges
- Use Windows UAC elevation correctly
- Verify admin rights before attempting file operations
- Provide clear error messages if admin rights are insufficient

**Requirement 1.2**: Temporary directory permissions must be handled correctly
- Use appropriate temp directory with write permissions
- Clean up temp files after installation
- Handle antivirus-locked directories gracefully

### 2. Terms and Conditions
**Requirement 2.1**: Installer must display terms and conditions acceptance
- Show checkbox with text: "I accept the Terms of Service and Privacy Policy"
- Include clickable link to https://tabeza.co.ke/terms
- Checkbox must be unchecked by default
- Next/Install button disabled until checkbox is checked

**Requirement 2.2**: Terms acceptance must be logged
- Record acceptance timestamp in installation log
- Store Bar ID associated with acceptance
- Include version of terms accepted (e.g., "v1.0")

### 3. Branding Consistency
**Requirement 3.1**: User-facing names must use "Tabeza POS Connect" (with space)
- AppName in Inno Setup: "Tabeza POS Connect"
- Service display name: "Tabeza POS Connect Service"
- Windows Programs list: "Tabeza POS Connect"
- Start menu entries: "Tabeza POS Connect"

**Requirement 3.2**: Technical names can remain "TabezaConnect" (no space)
- Executable filename: TabezaConnect-Setup-v1.2.0.exe
- Service internal name: TabezaConnectService
- Installation directory: C:\Program Files\TabezaConnect
- Registry keys: TabezaConnect

### 4. Antivirus Compatibility
**Requirement 4.1**: Installer must minimize antivirus false positives
- Use standard Windows installer patterns
- Avoid suspicious behaviors (rapid file creation, registry modifications)
- Use well-known temp directories with proper permissions

**Requirement 4.2**: Installation must handle antivirus interference
- Retry file operations if temporarily blocked
- Provide clear error messages if antivirus blocks installation
- Document antivirus exclusion steps for IT departments

## Non-Functional Requirements

### Security
- No security vulnerabilities in installer code
- Secure handling of Bar ID and configuration data
- Terms acceptance logged for compliance

### Reliability
- Installation success rate > 95%
- Graceful handling of edge cases (existing installation, locked files)
- Automatic rollback on installation failure

### Usability
- Installation completes in < 2 minutes
- Clear progress indicators throughout installation
- Helpful error messages with actionable solutions

### Compatibility
- Works on Windows 10 and Windows 11
- Compatible with major antivirus software (Defender, Avast, Norton, McAfee)
- Handles both standard and restricted corporate environments

## Out of Scope
- macOS installer fixes (separate spec if needed)
- Automatic updates (future enhancement)
- Silent installation mode (future enhancement)
- Multi-language support (future enhancement)

## Success Metrics
- Installation success rate increases from current ~30% to >95%
- Support tickets related to installation decrease by 80%
- Average installation time < 2 minutes
- Zero "Error 5: Access is denied" reports after fix

## Dependencies
- Inno Setup compiler
- Access to TabezaConnect repository
- Terms of Service and Privacy Policy published at tabeza.co.ke/terms

## Risks
- **Antivirus false positives**: Unsigned installers may trigger warnings (acceptable for MVP)
- **SmartScreen warnings**: Windows may show "Unknown Publisher" warning (acceptable for MVP)
- **Admin rights complexity**: Some corporate environments may still block installation

## Assumptions
- We can modify the Inno Setup script
- We can update GitHub release artifacts
- Terms of Service and Privacy Policy will be available online
- Users will accept some security warnings for MVP (unsigned installer)
