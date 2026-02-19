# TabezaConnect Technical Names Reference

## Quick Reference Guide

This document provides a quick reference for all technical and user-facing names in the TabezaConnect installer.

## Naming Convention Summary

| Context | Format | Example |
|---------|--------|---------|
| **Technical Names** | No space: `TabezaConnect` | `TabezaConnect-Setup-v1.3.0.exe` |
| **User-Facing Names** | With spaces: `Tabeza POS Connect` | `Tabeza POS Connect Service` |

## Complete Name Mapping

### Executable & Files

| Item | Technical Name | Location |
|------|----------------|----------|
| Installer Executable | `TabezaConnect-Setup-v1.3.0.exe` | `OutputBaseFilename` in installer.iss |
| Installation Directory | `C:\Program Files\TabezaConnect` | `DefaultDirName={autopf}\TabezaConnect` |
| Config File | `config.json` | `{app}\config.json` |
| Icon File | `icon.ico` | `{app}\icon.ico` |

### Windows Service

| Item | Name | Location |
|------|------|----------|
| Service Internal Name | `TabezaConnect` | sc.exe commands |
| Service Display Name | `Tabeza POS Connect Service` | PowerShell scripts |
| Service Description | `Tabeza POS receipt capture and relay service` | PowerShell scripts |

### Registry

| Item | Path | Location |
|------|------|----------|
| Registry Root Key | `HKLM\Software\Tabeza\Connect` | `[Registry]` section |
| InstallPath Value | `{app}` | Registry value |
| Version Value | `1.3.0` | Registry value |
| BarId Value | User-provided | Registry value |

### User Interface

| Item | Display Name | Location |
|------|--------------|----------|
| Application Name | `Tabeza POS Connect` | `AppName` in installer.iss |
| Start Menu Group | `Tabeza POS Connect` | `DefaultGroupName` |
| Programs List Entry | `Tabeza POS Connect` | Windows Programs & Features |
| Uninstaller Name | `Tabeza POS Connect` | `UninstallDisplayName` |

### Directories

| Purpose | Path | Permissions |
|---------|------|-------------|
| Application Files | `C:\Program Files\TabezaConnect` | Admin only |
| User Data | `%APPDATA%\Tabeza` | User modify |
| Logs | `%APPDATA%\Tabeza\logs` | User modify |
| Print Queue | `%APPDATA%\TabezaPrints` | User modify |
| Terms Log | `C:\Program Files\TabezaConnect\logs` | Admin write, user read |

## Verification Commands

### Check Installation

```powershell
# Check if service exists
Get-Service -Name "TabezaConnect" -ErrorAction SilentlyContinue

# Check installation directory
Test-Path "C:\Program Files\TabezaConnect"

# Check registry
Get-ItemProperty "HKLM:\Software\Tabeza\Connect" -ErrorAction SilentlyContinue

# Check user data directory
Test-Path "$env:APPDATA\Tabeza"
```

### Run Automated Verification

```powershell
# Basic check
.\verify-technical-names.ps1

# Verbose output
.\verify-technical-names.ps1 -Verbose

# Custom path
.\verify-technical-names.ps1 -InstallerPath "path\to\installer.iss"
```

## Common Patterns

### ✅ CORRECT Usage

**Technical contexts (no space):**
```
TabezaConnect-Setup-v1.3.0.exe
C:\Program Files\TabezaConnect
sc.exe start TabezaConnect
HKLM\Software\Tabeza\Connect
```

**User-facing contexts (with spaces):**
```
Tabeza POS Connect
Tabeza POS Connect Service
Welcome to Tabeza POS Connect Setup
```

### ❌ INCORRECT Usage

**Don't use spaces in technical names:**
```
Tabeza Connect-Setup-v1.3.0.exe          ❌
C:\Program Files\Tabeza Connect          ❌
sc.exe start "Tabeza Connect"            ❌
HKLM\Software\Tabeza Connect             ❌
```

**Don't remove spaces from user-facing names:**
```
TabezaConnect                            ❌ (in UI)
TabezaConnectService                     ❌ (as display name)
```

## File Locations to Check

When verifying technical names, check these files:

1. **installer.iss** - Main installer script
   - `OutputBaseFilename`
   - `DefaultDirName`
   - `AppName`
   - `DefaultGroupName`
   - `UninstallDisplayName`
   - Registry keys
   - Service commands

2. **PowerShell Scripts** (`src/installer/scripts/`)
   - `register-service.ps1` - Service name and display name
   - `configure-firewall.ps1` - Firewall rule names
   - `verify-installation.ps1` - Service checks

3. **Documentation**
   - `README.md` - Installation instructions
   - `BUILD-AND-DEPLOY.md` - Build commands
   - `AFTER-INSTALL.txt` - Post-install guide

4. **Configuration Files**
   - `config.template.json` - Configuration template
   - `package.json` - Package metadata (if exists)

## Requirement Validation

This naming convention satisfies **Requirement 3.2**:

> Technical names must remain "TabezaConnect" (no space)
> - Executable filename: TabezaConnect-Setup-v1.3.0.exe
> - Service internal name: TabezaConnectService
> - Installation directory: C:\Program Files\TabezaConnect
> - Registry keys: TabezaConnect

**Status:** ✅ Verified

## Related Requirements

- **Requirement 3.1**: User-facing names use "Tabeza POS Connect" (with space)
- **Requirement 1.1**: Installer must properly request administrator privileges
- **Requirement 2.1**: Installer must display terms and conditions acceptance

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.3.0 | 2026-02-19 | Initial technical names verification |

## Support

For questions about naming conventions:
- Review this document
- Run `verify-technical-names.ps1`
- Check the full checklist in `TECHNICAL_NAMES_CHECKLIST.md`
