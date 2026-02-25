# Printer Management UI - Requirements

## Overview
Create a self-service web interface that allows venue owners to manage their physical printer configuration without technical support. The UI enables users to view their current printer, select a different printer when hardware is replaced, and verify the configuration works correctly.

## Problem Statement

### Current Issues
1. **No Printer Management UI**: Users cannot see which printer is configured
2. **Manual Config Editing**: Changing printers requires editing JSON files
3. **No Self-Service**: Printer replacement requires support intervention
4. **No Verification**: Users can't test if printer change worked
5. **Hidden Configuration**: Bridge settings not visible to users

### Impact
- High support burden for printer replacements
- Users stuck when printer hardware fails
- No way to verify printer configuration
- Configuration drift without visibility

## User Stories

### 1. As a venue owner
I want to see which physical printer Tabeza is currently using
So that I know my system configuration

**Acceptance Criteria:**
- Web UI shows current printer name
- Shows printer status (Ready, Error, Offline)
- Shows printer port information
- Shows last successful print timestamp
- Updates in real-time when printer status changes

### 2. As a venue owner
I want to select a different printer when I replace my hardware
So that I can continue using Tabeza without calling support

**Acceptance Criteria:**
- Dropdown shows all available printers
- Excludes non-receipt printers (PDF, Fax, etc.)
- Shows printer status next to each option
- "Update Printer" button saves the change
- Bridge restarts automatically with new printer
- Success message confirms the change
- POS configuration remains unchanged (still prints to "Tabeza POS Connect")

### 3. As a venue owner
I want to send a test print to verify my printer works
So that I know the system is configured correctly

**Acceptance Criteria:**
- "Send Test Print" button available
- Test receipt goes through full chain (capture + upload + physical print)
- Physical receipt prints on configured printer
- Success/failure message shown in UI
- Test receipt clearly labeled as "TEST PRINT"
- Test includes timestamp and printer name

### 4. As a venue owner
I want to see the bridge status and activity
So that I know the system is working

**Acceptance Criteria:**
- Shows if bridge is running or stopped
- Shows capture folder path
- Shows recent activity (last print time)
- Shows error messages if bridge has issues
- Updates automatically without page refresh

### 5. As a venue owner
I want clear instructions when changing printers
So that I understand what will happen

**Acceptance Criteria:**
- Help text explains: "Your POS will continue printing to 'Tabeza POS Connect' - no POS changes needed"
- Warning shown before changing printer
- Confirmation required for printer change
- Instructions for testing after change

## Technical Requirements

### 1. Web UI Architecture
**Requirement 1.1**: Single-page application at `localhost:8765/printer-settings.html`
- Responsive design (works on desktop and tablet)
- Modern UI with clear visual hierarchy
- Real-time updates via API polling
- No page reloads required

**Requirement 1.2**: Navigation integration
- Link from main configure.html page
- Link from service status page
- Accessible from system tray menu (future)

### 2. API Endpoints
**Requirement 2.1**: GET `/api/printers/list`
```json
{
  "success": true,
  "printers": [
    {
      "name": "EPSON L3210 Series",
      "port": "USB001",
      "status": "Normal",
      "driver": "EPSON L3210 Series"
    },
    {
      "name": "Star TSP143III",
      "port": "TCP/IP_192.168.1.100",
      "status": "Normal",
      "driver": "Star TSP100"
    }
  ]
}
```

**Requirement 2.2**: POST `/api/printers/set-physical`
```json
// Request
{
  "printerName": "Star TSP143III"
}

// Response
{
  "success": true,
  "message": "Physical printer updated to: Star TSP143III"
}
```

**Requirement 2.3**: POST `/api/printers/test`
```json
// Request
{}

// Response
{
  "success": true,
  "message": "Test print sent successfully"
}
```

**Requirement 2.4**: GET `/api/status` (enhanced)
```json
{
  "status": "running",
  "barId": "xxx-xxx-xxx",
  "bridge": {
    "enabled": true,
    "printerName": "EPSON L3210 Series",
    "captureFolder": "C:\\ProgramData\\Tabeza\\TabezaPrints",
    "lastActivity": "2026-02-21T10:30:00Z",
    "status": "running"
  }
}
```

### 3. Printer Detection
**Requirement 3.1**: Exclude non-receipt printers
```powershell
$excluded = "Microsoft|OneNote|Fax|PDF|AnyDesk|XPS|Send To|Adobe"
$printers = Get-Printer | Where-Object { 
    $_.Name -notmatch $excluded 
}
```

**Requirement 3.2**: Show printer status
- Normal → Green indicator
- Error → Red indicator
- Offline → Gray indicator
- Unknown → Yellow indicator

### 4. Bridge Integration
**Requirement 4.1**: Runtime printer change
- Update config.json with new printer name
- Stop current bridge instance
- Update bridge configuration
- Start bridge with new printer
- Verify bridge is running

**Requirement 4.2**: No service restart required
- Bridge restarts independently
- Main service continues running
- No downtime for other features
- Seamless transition

### 5. Test Print
**Requirement 5.1**: Test receipt format
```
========================================
       TABEZA TEST PRINT
========================================
Date: 2026-02-21 10:30:00
Printer: EPSON L3210 Series

This is a test print to verify your
printer configuration is working.

If you can read this, your printer
is configured correctly!

========================================
    Powered by Tabeza
========================================
```

**Requirement 5.2**: Test print workflow
1. Create test receipt file
2. Write to capture folder
3. Bridge detects file
4. Bridge uploads to cloud (test mode)
5. Bridge forwards to physical printer
6. Physical receipt prints
7. File deleted after processing

### 6. Error Handling
**Requirement 6.1**: User-friendly error messages
- "No printers detected" → "Please ensure printer is powered on and drivers are installed"
- "Bridge not running" → "Service is not running. Please restart TabezaConnect service"
- "Test print failed" → "Could not send test print. Check printer connection"
- "Update failed" → "Could not update printer. Check printer is available"

**Requirement 6.2**: Graceful degradation
- If API fails, show cached data with warning
- If printer list fails, allow manual entry
- If test print fails, show troubleshooting steps
- If bridge restart fails, show manual restart instructions

## UI/UX Requirements

### 1. Visual Design
**Requirement 1.1**: Consistent with existing UI
- Match color scheme of configure.html
- Use same fonts and spacing
- Consistent button styles
- Same header/footer layout

**Requirement 1.2**: Clear visual hierarchy
- Current printer prominently displayed
- Change printer section clearly separated
- Test print button easily accessible
- Status information always visible

### 2. User Guidance
**Requirement 2.1**: Contextual help text
- Explain what each section does
- Clarify that POS configuration doesn't change
- Provide troubleshooting tips
- Link to full documentation

**Requirement 2.2**: Confirmation dialogs
- Confirm before changing printer
- Warn if printer is offline
- Confirm before sending test print
- Show success/failure clearly

### 3. Responsive Design
**Requirement 3.1**: Mobile-friendly
- Works on tablets (iPad, Android tablets)
- Touch-friendly buttons (min 44px)
- Readable text on small screens
- No horizontal scrolling

**Requirement 3.2**: Desktop-optimized
- Efficient use of screen space
- Keyboard shortcuts supported
- Fast navigation
- Clear focus indicators

## Non-Functional Requirements

### Performance
- Page load time < 2 seconds
- API response time < 500ms
- Printer list refresh < 1 second
- Test print initiated < 1 second
- Bridge restart < 5 seconds

### Reliability
- API calls retry on failure (3 attempts)
- Graceful handling of service downtime
- No data loss during printer change
- Bridge always restarts successfully

### Usability
- Zero technical knowledge required
- < 3 clicks to change printer
- < 5 seconds to send test print
- Clear success/failure feedback
- No ambiguous states

### Security
- Only accessible from localhost
- No authentication required (localhost only)
- No sensitive data exposed
- Config changes logged for audit

## Success Metrics
- Printer replacement time reduced from 30 minutes (with support) to 2 minutes (self-service)
- Support tickets for printer changes reduced by 95%
- User satisfaction score > 4.5/5 for printer management
- Zero failed printer changes due to UI issues
- 100% of users can successfully change printer without help

## Dependencies
- TabezaConnect service running on localhost:8765
- PowerShell available for printer detection
- Windows Print Spooler service running
- Bridge service integrated into main service

## Risks
- **PowerShell execution may be blocked** by antivirus (Mitigation: Document exclusions)
- **Printer list may be empty** on some systems (Mitigation: Show helpful error message)
- **Bridge restart may fail** (Mitigation: Provide manual restart instructions)
- **Test print may not reach printer** (Mitigation: Show troubleshooting steps)

## Assumptions
- User has admin rights (service already installed)
- User can access localhost:8765 in browser
- At least one printer is installed on system
- User knows how to send print from their POS

## Out of Scope
- Automatic printer discovery over network (future)
- Multiple printer support (future)
- Printer driver installation (future)
- Remote printer management (future)
- Mobile app for printer management (future)
- Printer usage statistics (future)
- Printer maintenance alerts (future)
