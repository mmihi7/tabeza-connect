# Redmon Installation Script

## Overview

The `install-redmon.ps1` script automates the installation of Redmon (Redirected Port Monitor) during Tabeza Connect setup. Redmon is a critical component that enables receipt capture by redirecting print jobs to the Tabeza Connect capture script.

## Purpose

Redmon is an open-source Windows port monitor that intercepts print jobs and pipes them to custom programs. In Tabeza Connect, it:

1. Intercepts print jobs sent to "Tabeza POS Printer"
2. Pipes raw ESC/POS bytes to the capture script via stdin
3. Allows the capture script to process receipts while maintaining normal printer operation

## Script Features

### Architecture Detection
- Automatically detects Windows architecture (32-bit or 64-bit)
- Selects appropriate Redmon installer (`setup.exe` or `setup64.exe`)
- Supports Windows 10 and Windows 11

### Silent Installation
- Runs Redmon installer with `/S` flag for silent installation
- No user interaction required during installation
- Suitable for automated deployment

### Idempotency
- Checks if Redmon is already installed before attempting installation
- Skips installation if Redmon port monitor is already registered
- Safe to run multiple times

### Verification
- Verifies Redmon port monitor registration in Windows registry
- Retries verification up to 5 times with 2-second delays
- Checks Print Spooler service status

### Error Handling
- Validates Redmon installer files exist before installation
- Provides detailed error messages with troubleshooting steps
- Gracefully handles non-fatal errors (permissions, status updates)
- Returns appropriate exit codes (0 = success, 1 = failure)

## Usage

### Basic Usage

```powershell
.\install-redmon.ps1
```

### With Custom Redmon Path

```powershell
.\install-redmon.ps1 -RedmonPath "C:\Custom\Path\redmon19"
```

### With Detailed Output

```powershell
.\install-redmon.ps1 -Detailed
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `RedmonPath` | string | `C:\Program Files\TabezaConnect\redmon19` | Path to Redmon installer files |
| `Detailed` | switch | false | Enable detailed output (DLL paths, versions) |

## Requirements

### Prerequisites
- Windows 10 or Windows 11
- Administrator privileges
- Print Spooler service running
- Redmon installer files in specified path

### Redmon Files Required
- `setup.exe` (32-bit installer)
- `setup64.exe` (64-bit installer)
- `redmon32.dll` or `redmon64.dll` (installed by setup)

## Installation Process

The script follows these steps:

1. **Detect Architecture**: Determines if Windows is 32-bit or 64-bit
2. **Validate Installer**: Checks that appropriate Redmon installer exists
3. **Check Existing Installation**: Queries registry for existing Redmon installation
4. **Install Redmon**: Runs installer silently if not already installed
5. **Verify Registration**: Confirms Redmon port monitor is registered
6. **Check Print Spooler**: Ensures Print Spooler service is running
7. **Write Status**: Updates installation status for tracking

## Registry Verification

The script verifies Redmon installation by checking:

```
HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port
```

This registry key is created by Redmon installer and contains:
- `Driver`: Path to Redmon DLL (redmon32.dll or redmon64.dll)
- Other Redmon configuration values

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success - Redmon installed and verified |
| 1 | Failure - Installation or verification failed |

## Error Scenarios

### Installer Not Found
```
❌ Redmon installer not found: C:\Program Files\TabezaConnect\redmon19\setup64.exe

Expected location: C:\Program Files\TabezaConnect\redmon19
Please ensure Redmon files are included in the installer package.
```

**Solution**: Ensure Redmon files are copied to the installer package before running.

### Installation Failed
```
❌ Redmon installation failed with exit code: 1603

Troubleshooting:
  1. Ensure you have administrator privileges
  2. Check Windows Event Viewer for errors
  3. Try running the installer manually: C:\...\setup64.exe
```

**Solution**: Run installer as administrator or check Event Viewer for specific errors.

### Verification Failed
```
❌ Redmon port monitor registration verification failed

Redmon may not be properly installed.

Troubleshooting:
  1. Restart the Print Spooler service: Restart-Service Spooler
  2. Check registry path: HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port
  3. Try manual installation: C:\...\setup64.exe
  4. Check Windows Event Viewer for errors
```

**Solution**: Restart Print Spooler service or manually verify registry key exists.

## Integration with Installer

This script is called by the main Tabeza Connect installer during setup:

```powershell
# In installer script
& ".\scripts\install-redmon.ps1" -RedmonPath "$InstallDir\redmon19"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Redmon installation failed. Rolling back..."
    # Rollback logic
    exit 1
}
```

## Testing

A test script is provided at `__tests__\install-redmon.test.ps1` that validates:

1. Script file exists
2. PowerShell syntax is valid
3. Required parameters are defined
4. Architecture detection code is present
5. Error handling is implemented
6. Installer validation is performed
7. Registry verification is implemented
8. Silent installation flag is used

Run tests:

```powershell
.\__tests__\install-redmon.test.ps1
```

## Troubleshooting

### Print Spooler Not Running

If Print Spooler is not running, the script will attempt to start it:

```powershell
Start-Service -Name "Spooler"
```

If this fails, manually start the service:

```powershell
# PowerShell
Start-Service Spooler

# Or via Services.msc
services.msc
# Find "Print Spooler" and click Start
```

### Manual Redmon Installation

If automated installation fails, install manually:

1. Navigate to Redmon installer directory
2. Right-click `setup64.exe` (or `setup.exe` for 32-bit)
3. Select "Run as administrator"
4. Follow installation prompts

### Verify Installation Manually

Check if Redmon is installed:

```powershell
# Check registry
Test-Path "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Redirected Port"

# Check DLL exists
Test-Path "C:\Windows\System32\redmon64.dll"
```

## Related Documentation

- [Redmon Official Documentation](http://www.ghostgum.com.au/software/redmon.htm)
- [Tabeza Connect Architecture](../../../.kiro/specs/redmon-receipt-capture/design.md)
- [Receipt Capture Requirements](../../../.kiro/specs/redmon-receipt-capture/requirements.md)

## Version History

- **v1.7.0** (2025-01-XX): Initial implementation for Redmon-based receipt capture
  - Architecture detection (32-bit/64-bit)
  - Silent installation with `/S` flag
  - Registry verification with retry logic
  - Print Spooler service check
  - Comprehensive error handling

## Support

For issues with Redmon installation:

1. Check Windows Event Viewer (Application and System logs)
2. Verify administrator privileges
3. Ensure Print Spooler service is running
4. Review Tabeza Connect installation logs
5. Contact support@tabeza.co.ke

## License

This script is part of Tabeza Connect and is subject to the Tabeza Connect license.

Redmon is licensed under GPL and is distributed separately. See `redmon19/LICENCE` for details.
