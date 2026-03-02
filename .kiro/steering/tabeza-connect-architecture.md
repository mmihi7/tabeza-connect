# Tabeza Connect - Architecture & Product Definition

## Purpose
Define the complete architecture, goals, and constraints of Tabeza Connect to prevent scope drift and ensure consistent development.

---

## Product Overview

**Tabeza Connect** is a Windows desktop application that bridges POS systems with the Tabeza cloud platform. It captures receipt data from thermal printers and syncs it to the cloud for digital receipt delivery and analytics.

### Target Users
- Bar and restaurant owners using **Tabeza Basic** mode
- Venues with existing POS systems
- Windows 10/11 environments

### Core Value Proposition
Enable venues to go digital **without changing their existing POS workflow**. Tabeza Connect sits invisibly between the POS and printer, capturing receipt data for cloud sync.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Tabeza Connect v1.7.0                        │
│                  (Single Windows Executable)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Part 1: Background Service (Windows Service)           │    │
│  ├────────────────────────────────────────────────────────┤    │
│  │ • File watcher (chokidar)                              │    │
│  │ • Monitors: C:\ProgramData\Tabeza\TabezaPrints\        │    │
│  │ • Uploads raw receipt data to cloud                    │    │
│  │ • Archives processed receipts                          │    │
│  │ • Runs as: LocalService                                │    │
│  │ • Auto-starts: Yes (Windows Service)                   │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Part 2: Management UI (HTTP Server + Web Interface)    │    │
│  ├────────────────────────────────────────────────────────┤    │
│  │ • HTTP server on localhost:8765                        │    │
│  │ • Serves HTML/CSS/JS from src/public/                  │    │
│  │ • API endpoints for configuration                      │    │
│  │ • Template generation workflow                         │    │
│  │ • System tray icon for access                          │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│              Tabeza Cloud (tabeza.co.ke)                         │
├─────────────────────────────────────────────────────────────────┤
│ • Receives raw receipt data                                     │
│ • Generates parsing templates (DeepSeek AI)                     │
│ • Stores templates in Supabase                                  │
│ • Delivers digital receipts to customers                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Windows Printer Pooling (MANDATORY)

**How it works:**
```
POS System
    ↓ prints to
"Tabeza POS Printer" (virtual printer)
    ↓ Windows Printer Pooling sends to TWO ports:
    ├─→ Physical Port (USB001, etc.) → Paper receipt prints ✅
    └─→ TabezaCapturePort (FILE:) → order.prn written ✅
```

**Key Points:**
- Windows handles the physical print via pooling
- Tabeza Connect NEVER forwards to physical printer
- Service ONLY watches the capture file and uploads to cloud
- Requires: Tabeza printer drivers (from tabeza.co.ke)

### 2. File Watcher Service

**Responsibilities:**
- Watch `C:\ProgramData\Tabeza\TabezaPrints\order.prn`
- Detect new/changed files (chokidar with 1.5s stability threshold)
- Read raw print data (ESC/POS format)
- Upload to cloud API
- Archive to `processed/` or `failed/` subfolders
- Truncate order.prn to 0 bytes (keep file for next job)

**NOT Responsible For:**
- Parsing receipts (done in cloud)
- Forwarding to physical printer (done by Windows)
- Template generation (done in cloud)

### 3. Management UI (Web Interface)

**Access:** `http://localhost:8765` (opened via system tray icon)

**Features:**
- **Dashboard:** Service status, jobs processed, Bar ID, template status
- **Configuration:** Set Bar ID, API URL, watch folder
- **Template Generator:** 
  - Upload 3+ test receipts
  - Send to cloud API: `/api/receipts/generate-template`
  - Receive regex template from DeepSeek AI
  - Store template locally (for future local parsing)
- **Logs Viewer:** View service logs
- **Printer Status:** Check Tabeza POS Printer configuration

**Technology:**
- Node.js HTTP server (built-in `http` module)
- Static HTML/CSS/JS (no framework needed)
- REST API endpoints for AJAX calls

### 4. System Tray Integration

**Purpose:** Provide easy access to management UI

**Features:**
- Icon in Windows system tray
- Right-click menu:
  - "Open Dashboard" → Opens browser to localhost:8765
  - "Service Status" → Shows running/stopped
  - "Exit" → Stops service (admin only)

---

## Data Flow

### Receipt Capture Flow
```
1. POS prints receipt
2. Windows Printer Pooling writes to order.prn
3. File watcher detects change (after 1.5s stability)
4. Service reads raw data
5. Service uploads to https://tabeza.co.ke/api/receipts
6. Service archives to processed/
7. Service truncates order.prn to 0 bytes
8. Cloud parses receipt and delivers to customer
```

### Template Generation Flow
```
1. User opens Management UI (localhost:8765)
2. User uploads 3+ test receipts
3. UI sends receipts to cloud: POST /api/receipts/generate-template
4. Cloud calls DeepSeek AI with receipts
5. DeepSeek returns regex patterns
6. Cloud saves template to Supabase
7. Cloud returns template to Tabeza Connect
8. Tabeza Connect stores template locally
9. Future: Local parsing using stored template
```

---

## Configuration

### Installation Configuration (Installer Prompts)
- **Bar ID:** Required, validated (6+ chars, alphanumeric + hyphens)
- **API URL:** Default `https://tabeza.co.ke`
- **Watch Folder:** Default `C:\ProgramData\Tabeza\TabezaPrints`

### Storage Locations

**Program Files:** `C:\Program Files\TabezaConnect\`
- `TabezaConnect.exe` (pkg-compiled, includes Node.js)
- `scripts\` (PowerShell installer scripts)
- `config.json` (configuration template)
- `docs\` (documentation)

**ProgramData:** `C:\ProgramData\Tabeza\`
- `logs\service.log` (service logs)
- `config.json` (runtime configuration)
- `template.json` (parsing template from cloud)
- `TabezaPrints\` (watch folder)
  - `order.prn` (capture file)
  - `pending\` (offline queue)
  - `processed\` (archived receipts)
  - `failed\` (failed receipts)

**Windows Registry:** `HKLM\Software\Tabeza\Connect\`
- `InstallPath` (installation directory)
- `Version` (installed version)
- `BarId` (venue identifier)

**Windows Service:** `TabezaConnect`
- Display Name: "Tabeza POS Connect"
- Account: LocalService
- Startup: Automatic
- Environment Variables:
  - `TABEZA_BAR_ID`
  - `TABEZA_API_URL`
  - `TABEZA_WATCH_FOLDER`

---

## Technology Stack

### Runtime
- **Node.js:** v18 (bundled via pkg)
- **Platform:** Windows 10/11 x64
- **Packaging:** pkg (single executable)
- **Installer:** Inno Setup 6

### Dependencies
- `chokidar` - File watching
- `https` - Cloud API calls (built-in)
- `http` - Management UI server (built-in)
- `fs` - File operations (built-in)

### Build Process
```bash
# Step 1: Compile service to executable
.\build-step1-pkg.bat
# Creates: TabezaConnect.exe (~40-50 MB)

# Step 2: Build installer
.\build-step2-installer.bat
# Creates: dist\TabezaConnect-Setup-v1.7.0.exe
```

---

## Integration with Tabeza Ecosystem

### Tabeza Basic Mode (ONLY MODE SUPPORTED)

**Authority Model:**
- POS is the ONLY digital authority
- Manual ordering always coexists
- Tabeza Connect MIRRORS receipts, never creates them

**Workflow:**
```
1. Waiter takes order (manual)
2. Waiter enters order in POS
3. POS prints receipt
4. Tabeza Connect captures receipt
5. Cloud parses and delivers digital receipt
6. Customer receives digital receipt on phone
```

**Explicitly NOT Supported:**
- Tabeza Venue mode (customer ordering)
- Menu management
- Staff ordering in Tabeza
- Direct POS API integration

---

## Critical Constraints

### CORE TRUTH (Non-Negotiable)
```
Manual service always exists.
Digital authority is singular (POS only).
Tabeza adapts to the venue — never the reverse.
```

### Technical Constraints
1. **Windows Only:** No macOS, Linux support
2. **Thermal Printers Only:** ESC/POS compatible
3. **Single Venue:** One Bar ID per installation
4. **No Offline Parsing:** Requires cloud connection for parsing
5. **No POS API:** Works via printer capture only

### Security Constraints
1. **LocalService Account:** Service runs with minimal privileges
2. **Localhost Only:** Management UI not exposed to network
3. **No Authentication:** UI accessible to anyone on local machine
4. **HTTPS Required:** All cloud API calls use HTTPS

---

## Success Criteria

### Installation Success
- ✅ Tabeza POS Printer created and configured
- ✅ Windows Service registered and running
- ✅ Watch folder created with correct permissions
- ✅ Bar ID captured and stored
- ✅ System tray icon appears
- ✅ Management UI accessible at localhost:8765

### Runtime Success
- ✅ Service auto-starts on Windows boot
- ✅ Receipts captured within 2 seconds of print
- ✅ 100% upload success rate (with retry)
- ✅ No double-printing (Windows handles physical print)
- ✅ Logs written to ProgramData\Tabeza\logs\
- ✅ Management UI responsive and functional

### User Experience Success
- ✅ Zero POS workflow changes
- ✅ Invisible to staff (runs in background)
- ✅ Easy template generation (3 test prints)
- ✅ Clear status indicators in UI
- ✅ Helpful error messages

---

## Future Enhancements (Out of Scope for v1.7.0)

- Local receipt parsing (currently cloud-only)
- Multi-venue support (one installation, multiple Bar IDs)
- Network-accessible UI (currently localhost only)
- POS API integration (currently printer-only)
- Tabeza Venue mode support
- Real-time dashboard updates (WebSocket)
- Automatic template updates from cloud

---

## Development Guidelines

### When Adding Features
1. **Check Core Truth:** Does this violate "POS is singular authority"?
2. **Check Scope:** Is this Tabeza Basic or Tabeza Venue?
3. **Check Platform:** Is this Windows-specific?
4. **Check Dependencies:** Does this require new npm packages?
5. **Check Installer:** Does this need installer changes?

### Code Comments Required
```javascript
// CORE TRUTH: Manual service always exists. 
// Digital authority is singular. 
// Tabeza adapts to the venue — never the reverse.
```

### Testing Requirements
- Unit tests for core logic
- Integration tests for file watcher
- Manual testing on clean Windows 10/11
- Test with real thermal printer
- Test installer on clean machine

---

## Common Pitfalls to Avoid

❌ **Don't:** Add POS API integration (out of scope)
❌ **Don't:** Parse receipts locally (cloud-only for v1.7.0)
❌ **Don't:** Support Tabeza Venue mode (Basic only)
❌ **Don't:** Forward to physical printer (Windows does this)
❌ **Don't:** Run as LocalSystem (use LocalService)
❌ **Don't:** Expose UI to network (localhost only)
❌ **Don't:** Create orders in Tabeza (POS is authority)

✅ **Do:** Keep it simple and focused
✅ **Do:** Follow Windows service best practices
✅ **Do:** Use printer pooling (no bridge mode)
✅ **Do:** Store templates locally for future use
✅ **Do:** Provide clear error messages
✅ **Do:** Log everything to ProgramData\Tabeza\logs\

---

## Version History

- **v1.7.0** (Current)
  - Removed bridge mode (Windows pooling only)
  - Fixed installer bugs (IsAdminInstallMode, Bar ID, printer)
  - Changed service account to LocalService
  - Added license acceptance to installer
  - Management UI planned (not yet implemented)

---

## Support & Documentation

- **Installation Guide:** `Plan\BEFORE-INSTALL.txt`
- **Post-Install Guide:** `Plan\AFTER-INSTALL.txt`
- **Troubleshooting:** Check `C:\ProgramData\Tabeza\logs\service.log`
- **Printer Drivers:** https://tabeza.co.ke (required for pooling)
- **Support Email:** support@tabeza.co.ke

---

**Last Updated:** 2026-03-02
**Document Owner:** Tabeza Development Team
**Status:** Authoritative Reference
