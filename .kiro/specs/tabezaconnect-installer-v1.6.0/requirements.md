# Silent Bridge Installer - Requirements

## Overview
Integrate the working Silent Bridge system into the TabezaConnect installer to provide a seamless, zero-configuration setup experience. The installer should automatically detect printers, configure the bridge, and verify the complete system without requiring manual intervention.

## Problem Statement

### Current Issues
1. **Manual Bridge Setup**: Users must manually configure the bridge after installation
2. **Two Config Files**: Separate `config.json` and `bridge-config.json` cause confusion
3. **No Printer Detection**: Users must manually identify their thermal printer
4. **Error State Not Cleared**: Printer stays in error state after port reconfiguration
5. **No End-to-End Verification**: Installation completes without testing the full chain
6. **Race Condition**: `fwd_temp.prn` causes issues with concurrent print jobs
7. **Technical Terminology**: Users see "bridge", "port", "spooler" during setup

### Impact
- High support burden for printer configuration
- Users ship broken installations without knowing
- Printer replacement requires support intervention
- Configuration drift between main service and bridge

## User Stories

### 1. As a venue owner
I want the installer to automatically detect and configure my printer
So that I can start using the system immediately without technical knowledge

**Acceptance Criteria:**
- Installer detects all available printers automatically
- Excludes obvious non-receipt printers (PDF, Fax, OneNote, etc.)
- Configures the detected printer silently without user input
- No technical terms shown to user during setup
- User only sees "Setting up your printer..." progress message

### 2. As a venue owner
I want the installer to verify my printer works before completing
So that I know the system is ready to use

**Acceptance Criteria:**
- Installer prompts: "Send a test print from your POS now"
- Waits for print job to arrive (30 second timeout)
- Verifies digital capture works
- Verifies physical printing works
- Shows clear success/failure message
- Installation fails if verification fails

### 3. As a venue owner
I want a single configuration file that controls everything
So that I don't have to manage multiple config files

**Acceptance Criteria:**
- Single `config.json` file contains all settings
- Bridge configuration merged into main config
- No separate `bridge-config.json` file
- Service reads from one unified config
- Installer writes one unified config

### 4. As a venue owner
I want my printer to work immediately after installation
So that I don't have to troubleshoot error states

**Acceptance Criteria:**
- Installer restarts print spooler after port reconfiguration
- Printer status is "Normal" after installation
- No "Error" status shown in Windows printer list
- Print queue is cleared before completion
- Printer is ready to accept jobs immediately

### 5. As a venue owner
I want the system to handle multiple print jobs without issues
So that busy periods don't cause problems

**Acceptance Criteria:**
- Bridge uses unique temp files per job (timestamp + random)
- No race conditions when multiple jobs arrive quickly
- Each job processed independently
- Temp files cleaned up after processing
- No file locking issues

## Technical Requirements

### 1. Unified Configuration
**Requirement 1.1**: Single config.json structure
```json
{
  "barId": "xxx-xxx-xxx",
  "apiUrl": "https://tabeza.co.ke",
  "bridge": {
    "enabled": true,
    "printerName": "EPSON L3210 Series",
    "originalPort": "USB001",
    "captureFolder": "C:\\ProgramData\\Tabeza\\TabezaPrints",
    "tempFolder": "C:\\ProgramData\\Tabeza\\temp",
    "autoConfigure": true
  },
  "service": {
    "name": "TabezaConnect",
    "displayName": "TabezaConnect",
    "port": 8765
  }
}
```

**Requirement 1.2**: Eliminate bridge-config.json
- Remove all references to separate bridge config
- Bridge reads from unified config.json
- Installer only writes one config file

### 2. Printer Detection
**Requirement 2.1**: Broad printer detection
```powershell
$excluded = "Microsoft|OneNote|Fax|PDF|AnyDesk|XPS|Send To|Adobe"
$printers = Get-Printer | Where-Object { 
    $_.Name -notmatch $excluded -and 
    $_.PrinterStatus -ne "Offline"
}
```

**Requirement 2.2**: Intelligent printer selection
- Prefer printers with receipt-related keywords (Receipt, Thermal, POS, TM-, RP-, Epson, Star, Citizen, Bixolon, Sam4s)
- Fall back to first available printer if no matches
- Store original port information for restoration if needed

### 3. Error State Handling
**Requirement 3.1**: Spooler restart after port reconfiguration
```powershell
# After setting folder port
Restart-Service Spooler -Force
Start-Sleep -Seconds 3
```

**Requirement 3.2**: Verify printer status
- Check printer status after spooler restart
- Log printer status for diagnostics
- Fail installation if printer remains in error state

### 4. Race Condition Fix
**Requirement 4.1**: Unique temp files
```javascript
const tmpFile = path.join(
    config.bridge.tempFolder,
    `fwd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.prn`
);
```

**Requirement 4.2**: Temp file cleanup
- Delete temp file after forwarding completes
- Handle cleanup errors gracefully
- Don't block on cleanup failures

### 5. End-to-End Verification
**Requirement 5.1**: Real test print verification
- Prompt user to send test print from POS
- Watch capture folder for new files (30 second timeout)
- Verify file is processed (deleted after upload + forward)
- Show clear success/failure message

**Requirement 5.2**: Verification failure handling
- If no print detected: Warn but allow installation to complete
- If processing fails: Show error and suggest troubleshooting
- Log verification results for support

### 6. Silent User Experience
**Requirement 6.1**: No technical terminology
- User never sees: "bridge", "port", "spooler", "capture", "folder port", "forwarding"
- User only sees: "Setting up your printer...", "Configuring service...", "Verifying installation..."

**Requirement 6.2**: Progress indicators
- Clear progress messages during each step
- No silent failures
- Actionable error messages if something fails

## Installer Flow

### Revised Installation Steps
1. **Welcome screen**
2. **Terms acceptance** (with checkbox)
3. **Bar ID entry**
4. **Silent printer setup** (no user interaction)
   - Detect printers
   - Configure folder port
   - Configure bridge
   - Restart spooler
   - Register service
   - Start service
5. **Verification prompt**: "Send a test print from your POS now"
6. **Done**

### PowerShell Scripts Required

#### 1. `detect-thermal-printer.ps1`
- Detect all printers (exclude non-receipt)
- Prefer receipt-related printers
- Save detected printer to JSON
- Exit with error if no printers found

#### 2. `configure-bridge.ps1`
- Load detected printer info
- Create capture and temp folders
- Set folder permissions (Everyone: Full Control)
- Create folder port
- Reconfigure printer to use folder port
- Restart spooler to clear error state
- Create unified config.json
- Verify printer status

#### 3. `verify-bridge.ps1`
- Check service is running
- Check config exists and is valid
- Check printer exists and is ready
- Prompt for test print
- Watch for print job (30 second timeout)
- Verify processing (file deleted)
- Show success/failure message

## Non-Functional Requirements

### Reliability
- Installation success rate > 95%
- Printer detection works with all major brands
- Spooler restart always clears error state
- No race conditions under load

### Usability
- Installation completes in < 5 minutes
- User performs < 5 actions total
- No technical knowledge required
- Clear error messages with solutions

### Compatibility
- Works with Windows 10 and Windows 11
- Supports all ESC/POS compatible printers
- Handles USB, network, and Bluetooth printers
- Works with corporate firewall restrictions

### Security
- Folder permissions properly configured
- No security vulnerabilities in scripts
- Config file protected from unauthorized access
- Temp files cleaned up properly

## Success Metrics
- Installation time reduced from 15 minutes to 5 minutes
- User actions reduced from 10+ to 3
- Support tickets for printer setup reduced by 90%
- Zero "printer not working" reports after installation
- 100% of installations include working bridge

## Dependencies
- Inno Setup 6.x compiler
- PowerShell 5.1+ on target system
- Windows Print Spooler service
- Working thermal/POS printer connected

## Risks
- **Printer detection may fail** on unusual printer names (Mitigation: Broad exclusion pattern)
- **Spooler restart may be blocked** by antivirus (Mitigation: Document antivirus exclusions)
- **Verification may timeout** on slow systems (Mitigation: 30 second timeout with skip option)

## Assumptions
- User has thermal/POS printer already installed with drivers
- User has admin rights to run installer
- Printer is powered on and connected during installation
- User can send test print from their POS system

## Out of Scope
- Automatic printer driver installation
- Support for non-Windows operating systems
- Silent installation mode (future enhancement)
- Multiple printer support (future enhancement)
- Printer auto-discovery over network (future enhancement)
