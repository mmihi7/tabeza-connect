# Printer Modal Interception - Requirements

## Overview

Transform the printer service from a passive file watcher to an active print job interceptor that shows a modal when staff prints from POS, allowing them to select which customer tab to deliver the receipt to.

## Problem Statement

**Current Flow (BAD UX):**
```
POS → Print → "Save As" dialog → Staff manually saves → Service picks up file → Cloud
```

**Issues:**
- Staff must manually save each print job
- Extra clicks and friction
- Breaks POS workflow
- Not seamless

**Desired Flow (GOOD UX):**
```
POS → Print → Tabeza Modal Opens → Staff selects Tab # → Receipt delivered to customer
              ↓ (if no tab selected)
              Print physically to receipt printer
```

**Benefits:**
- No "Save As" dialog
- Seamless POS workflow
- Staff stays in flow
- One-click tab selection
- Fallback to physical print

## User Stories

### 1. Staff Prints from POS with Tab Selection
**As a** waiter using the POS system  
**I want** a modal to appear when I print a receipt  
**So that** I can quickly select which customer tab to deliver it to

**Acceptance Criteria:**
1.1. When staff clicks "Print" in POS, Tabeza modal appears immediately  
1.2. Modal shows list of open tabs with tab numbers  
1.3. Staff can click a tab number to deliver receipt  
1.4. Receipt is delivered to customer's phone within 2 seconds  
1.5. Modal closes automatically after selection  
1.6. POS workflow continues normally (no blocking)

### 2. Staff Prints Physically When No Tab
**As a** waiter  
**I want** to print physically when customer doesn't have a tab  
**So that** I can still serve walk-in customers normally

**Acceptance Criteria:**
2.1. Modal has "Print Physically" button  
2.2. Clicking "Print Physically" sends job to physical receipt printer  
2.3. Modal closes after physical print  
2.4. No digital receipt is created

### 3. Staff Cancels Print Job
**As a** waiter  
**I want** to cancel a print job if I made a mistake  
**So that** I don't deliver incorrect receipts

**Acceptance Criteria:**
3.1. Modal has "Cancel" button  
3.2. Clicking "Cancel" discards the print job  
3.3. No receipt is printed (digital or physical)  
3.4. Modal closes

### 4. Modal Shows Receipt Preview
**As a** waiter  
**I want** to see what's on the receipt before selecting a tab  
**So that** I can verify I'm delivering the correct order

**Acceptance Criteria:**
4.1. Modal shows receipt total amount  
4.2. Modal shows list of items (first 5 items)  
4.3. Modal shows timestamp  
4.4. Preview is readable and clear

### 5. Fast Tab Selection (Keyboard Shortcuts)
**As a** waiter in a busy environment  
**I want** keyboard shortcuts to select tabs quickly  
**So that** I can work faster during rush hours

**Acceptance Criteria:**
5.1. Pressing number keys (1-9) selects corresponding tab  
5.2. Pressing Enter confirms selection  
5.3. Pressing Escape cancels  
5.4. Pressing P prints physically

### 6. Service Runs in Background
**As a** venue owner  
**I want** the printer service to run automatically on startup  
**So that** staff don't have to manually start it

**Acceptance Criteria:**
6.1. Service starts automatically when Windows starts  
6.2. Service runs in system tray (not visible window)  
6.3. Service shows notification icon when active  
6.4. Right-click icon shows status and settings

### 7. Offline Mode Support
**As a** waiter  
**I want** the system to work even if internet is temporarily down  
**So that** I can continue serving customers

**Acceptance Criteria:**
7.1. If cloud API is unreachable, modal still appears  
7.2. Modal shows "Offline - Print Physically Only" message  
7.3. Physical print still works  
7.4. Digital delivery is queued for when connection returns

## Technical Requirements

### Architecture

**Components:**
1. **Windows Printer Port Monitor** (C++ or C#)
   - Intercepts print jobs sent to "TABEZA Virtual Printer"
   - Captures raw print data
   - Triggers modal display
   - Routes to physical printer or cloud

2. **Modal Application** (Electron or Native Windows)
   - Shows when print job is intercepted
   - Displays open tabs from cloud API
   - Handles user selection
   - Sends receipt to selected tab or physical printer

3. **Background Service** (Node.js or Windows Service)
   - Manages printer port monitor
   - Communicates with cloud API
   - Handles offline queue
   - Runs on system startup

### Print Job Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. POS System                                               │
│    Staff clicks "Print" → Sends to "TABEZA Virtual Printer"│
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│ 2. Windows Printer Port Monitor (Intercepts)               │
│    • Captures raw print data (ESC/POS commands)             │
│    • Pauses print job                                       │
│    • Triggers modal application                             │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│ 3. Tabeza Modal Application (Shows)                        │
│    • Fetches open tabs from cloud API                       │
│    • Parses receipt data (items, total)                     │
│    • Displays tab selection UI                              │
│    • Waits for user input                                   │
└────────────────┬────────────────────────────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
┌────────▼──────┐  ┌────▼────────────────────────────────────┐
│ 4a. Tab       │  │ 4b. Physical Print                      │
│ Selected      │  │     • Send to physical receipt printer  │
│               │  │     • Complete print job                │
│ • Send to     │  │     • Close modal                       │
│   cloud API   │  └─────────────────────────────────────────┘
│ • Create      │
│   tab_order   │
│ • Close modal │
└───────────────┘
```

### Technology Stack

**Option 1: Full Native (Best Performance)**
- Printer Port Monitor: C++ (Windows DDK)
- Modal Application: C# WPF or WinForms
- Background Service: Windows Service (C#)

**Option 2: Hybrid (Easier Development)**
- Printer Port Monitor: C++ (Windows DDK)
- Modal Application: Electron (JavaScript/HTML/CSS)
- Background Service: Node.js with node-windows

**Option 3: Pure .NET (Recommended)**
- Printer Port Monitor: C# (using Windows Print Spooler API)
- Modal Application: C# WPF
- Background Service: Windows Service (C#)
- All in one solution, easier to maintain

### API Requirements

**New Endpoints Needed:**

1. **GET /api/printer/open-tabs?barId=xxx**
   - Returns list of open tabs for modal
   - Fast response (< 200ms)
   - Includes tab number, table number, opened time

2. **POST /api/printer/deliver-receipt**
   - Delivers receipt to selected tab
   - Creates tab_order with pending status
   - Returns success/failure

3. **POST /api/printer/queue-offline**
   - Queues receipt for later delivery
   - Used when offline
   - Syncs when connection returns

### Installation Requirements

**Installer Must:**
1. Install printer driver
2. Create virtual printer "TABEZA Virtual Printer"
3. Install port monitor DLL
4. Install modal application
5. Install background service
6. Configure service to start on boot
7. Add system tray icon
8. Request admin permissions (required for printer driver)

**Installer Format:**
- MSI (Windows Installer) - preferred
- Or EXE with admin elevation

## Non-Functional Requirements

### Performance
- Modal must appear within 500ms of print button press
- Tab list must load within 200ms
- Receipt delivery must complete within 2 seconds
- No blocking of POS workflow

### Reliability
- Service must auto-restart if crashed
- Offline queue must persist across restarts
- Print jobs must never be lost
- Fallback to physical print always available

### Security
- All API communication over HTTPS
- Bar ID and credentials stored securely
- No sensitive data in logs
- Admin permissions only for installation

### Usability
- Modal must be always-on-top (never hidden behind POS)
- Large, touch-friendly buttons (for tablets)
- Clear visual feedback for selections
- Keyboard shortcuts for power users

## Out of Scope

- Automatic tab matching (staff always selects manually)
- Receipt editing or modification
- Multiple printer support (one printer per venue)
- Mobile app for modal (Windows only)
- Receipt templates or customization

## Success Metrics

1. **Speed:** Modal appears in < 500ms
2. **Accuracy:** 100% of receipts delivered to correct tab (staff selection)
3. **Reliability:** 99.9% uptime for background service
4. **Adoption:** Staff prefer this over manual entry
5. **Efficiency:** Reduces receipt delivery time by 80%

## Dependencies

- Windows 10 or later (for printer port monitor API)
- .NET Framework 4.8 or .NET 6+ (for C# components)
- Admin rights for installation
- Internet connection for cloud API (with offline fallback)
- Physical receipt printer (for fallback)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Printer driver conflicts | High | Test with common POS systems, provide uninstaller |
| Modal blocks POS workflow | High | Make modal non-blocking, add timeout auto-close |
| Cloud API downtime | Medium | Offline queue, fallback to physical print |
| Complex installation | Medium | Create automated installer, provide support docs |
| Windows updates break driver | Low | Test on Windows Update preview builds |

## Future Enhancements

- Automatic tab matching based on table number
- Receipt preview with full formatting
- Multi-printer support
- Receipt analytics and reporting
- Mobile app for modal (iOS/Android tablets)
