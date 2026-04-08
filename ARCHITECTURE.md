# Tabeza Connect — Architecture Reference

**Version:** 1.7.0  
**Audience:** Developers  
**Last Updated:** 2026-03-04

---

## What Is Tabeza Connect?

Tabeza Connect is a **set-and-forget Windows agent** that bridges POS systems to the Tabeza platform. It's infrastructure, not a user-facing app — designed for reliability, auto-start, and minimal operator intervention.

### Platform Role

```
┌─────────────────────────────────────────────────────────────┐
│                    Tabeza Platform                          │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Tabeza     │  │    Staff     │  │   Customer   │    │
│  │   Connect    │→ │     App      │  │    Wallet    │    │
│  │  (Ingestion) │  │  (Control)   │  │ (Experience) │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│         ↓                                                   │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Supabase (Single Source of Truth)      │  │
│  │  • Receipts  • Venues  • Staff  • Loyalty Events   │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Tabeza Connect's Job:**
- Capture receipt data from POS systems via Windows Printer Pooling
- Parse receipts into structured JSON
- Stream events reliably to Supabase
- Run 24/7 without user intervention

**What It's NOT:**
- Not a user-facing dashboard (that's the Staff App)
- Not a customer experience (that's the Wallet)
- Not a configuration UI (setup happens once, then it's invisible)

The venue's POS and physical printer work exactly as they always have. Tabeza Connect runs silently alongside them, observing every print job without interfering.

---

## The Problem It Solves

When a POS prints a receipt, the output is raw ESC/POS — a printer command format full of binary control codes. The Tabeza platform needs clean structured data: what items were ordered, at what prices, and what the total was. Tabeza Connect bridges that gap locally on the venue's Windows machine, then streams the result to Supabase.

### Design Principles

1. **Infrastructure-grade reliability** - Auto-start on boot, survive crashes, queue offline
2. **Zero operator attention** - Once configured, it should never need manual intervention
3. **Minimal footprint** - Small installer (~45MB), low memory, no visible UI during normal operation
4. **Safe auto-update** - Can update itself without breaking the venue's workflow
5. **Supabase-first** - All data flows to Supabase; Connect is just the ingestion agent

---

## System Overview

```
+--------------------------------------------------------+
|                    Venue Windows PC                    |
|                                                        |
|   POS System                                           |
|       |                                                |
|       |  prints to "Tabeza Agent"                |
|       v                                                |
|   Windows Printer Pooling                              |
|       |                         |                      |
|       | physical port           | Local Port           |
|       v                         v                      |
|   Thermal Printer         order.prn                    |
|   (paper receipt)   (C:\ProgramData\Tabeza\           |
|                        TabezaPrints\)                  |
|                               |                        |
|                               v                        |
|                  Tabeza Connect Service                 |
|                  +-------------------------+           |
|                  | 1. Detect file change   |           |
|                  | 2. Strip ESC/POS bytes  |           |
|                  | 3. Parse with           |           |
|                  |    template.json        |           |
|                  | 4. Write to queue\      |           |
|                  |    pending\             |           |
|                  | 5. Upload Worker sends  |           |
|                  |    to cloud (with       |           |
|                  |    offline retry)       |           |
|                  +-------------------------+           |
|                               |                        |
+-------------------------------+------------------------+
                                | HTTPS
                                v
              +----------------------------------+
              |         Tabeza Cloud             |
              |  tabeza.co.ke (Vercel+Supabase)  |
              |                                  |
              |  Stores parsed receipt in DB     |
              |  Delivers digital receipt to     |
              |  customer's phone                |
              +----------------------------------+
```

---

## How Windows Printer Pooling Works

Windows Printer Pooling is a standard Windows feature that sends one print job to multiple ports simultaneously. The installer creates a printer called **"Tabeza Agent"** with two ports:

- **Physical port** (e.g. `USB001`) — delivers the job to the thermal printer as normal
- **TabezaCapturePort** (a **Local Port**) — writes the same job to `order.prn` on disk

The venue staff point their POS to "Tabeza Agent". From that point on, every receipt simultaneously prints on paper and gets written to `order.prn`. Windows manages both ports — Tabeza Connect only reads the file.

**About the Local Port type:** A Local Port is a standard Windows port type that silently writes raw print data to a configured file path on every job. It is different from a FILE port, which opens a Save As dialog requiring a user to choose a filename each time. The Local Port writes automatically with no user interaction, which is what makes the capture completely invisible to venue staff.

---

## The Parsing System

Raw ESC/POS is not directly useful as data. Before uploading, Tabeza Connect parses each captured receipt into structured JSON using a **regex template** stored locally at `C:\ProgramData\Tabeza\template.json`.

### How the Template Is Created (One-time setup per venue)

Every POS has a consistent receipt layout — the same column structure, the same total line format, every time. During initial setup, the venue owner completes a guided 3-step workflow in the Management UI at `http://localhost:8765`.

**From that point on, AI plays no role in receipt processing.** Every receipt is parsed locally using the saved template — deterministically, in 1–5ms.

### Template Format

```json
{
  "version": "1.2",
  "posSystem": "AccelPOS",
  "patterns": {
    "item_line":      "^(.+?)\\s+(\\d+)\\s+([0-9,]+\\.\\d{2})$",
    "total_line":     "^TOTAL\\s+([0-9,]+\\.\\d{2})$",
    "receipt_number": "^Receipt\\s*#?:\\s*(\\S+)$"
  },
  "confidence_threshold": 0.85
}
```

### Parsed Output

```json
{
  "items": [
    { "name": "Tusker Lager 500ml", "qty": 2, "price": 500.00 },
    { "name": "Nyama Choma",        "qty": 1, "price": 800.00 }
  ],
  "total": 1300.00,
  "receiptNumber": "RCP-001234",
  "confidence": 0.97
}
```

### Before Setup Is Complete (No Template)

If `template.json` does not exist, the service still uploads the receipt but includes the raw text and marks it `parsed: false`. The Management UI will prompt the user to complete template setup.

---

## Application Structure

TabezaConnect.exe is a single pkg-compiled binary. It runs two things at the same time:

### Part A — Capture & Parse Service

Registered as a Windows Service named `TabezaConnect`, running under the `LocalService` account, auto-starting on every boot — no user login required. This is the core worker:

- Watches `C:\ProgramData\Tabeza\TabezaPrints\order.prn` using chokidar
- Waits 1.5 seconds after a file change to ensure the POS has finished writing
- Reads the file and strips ESC/POS control bytes to get plain text
- Runs the local regex parser against `template.json`
- Writes the parsed receipt to the **local queue** as a JSON file
- Truncates `order.prn` back to 0 bytes (the file must stay on disk for the next job)
- Archives a timestamped copy to `processed\` on success, `failed\` on error
- The **Upload Worker** (running concurrently) picks items from the queue and POSTs them to the cloud
- Sends a heartbeat to the cloud every 30 seconds

### The Queue System

Capture and upload are deliberately separated into two independent processes. This is what makes the service resilient to internet outages.

**How it works:**

```
Capture process                   Upload Worker
──────────────                    ─────────────
Detects receipt                   Polls queue every 2 seconds
     │                                   │
Parses it locally                  Picks next pending item
     │                                   │
Writes {uuid}.json          ──►    POSTs to cloud
to pending\                              │
     │                            Success → moves to uploaded\
Truncates order.prn               Failure → retries with backoff:
                                    Attempt 1: wait 5s
                                    Attempt 2: wait 10s
                                    Attempt 3: wait 20s
                                    Attempt 4: wait 40s
                                    After 4 attempts: stays in
                                    pending\ until next restart
```

**Key properties:**
- The capture process never waits for an upload to succeed before processing the next receipt
- If the internet goes down, receipts pile up in `pending\` safely as JSON files on disk
- When the internet comes back, the upload worker drains the queue automatically
- If the service restarts (reboot, crash), the upload worker scans `pending\` on startup and resumes where it left off — no receipts are lost
- Each pending receipt is a self-contained JSON file named by UUID — no database, no SQLite dependency

**Queue folder layout:**
```
C:\ProgramData\Tabeza\queue\
├── pending\
│   ├── a3f2c1b0-...json    ← waiting to upload
│   └── d9e4f5a2-...json    ← waiting to upload
└── uploaded\
    └── 06634799-...json    ← kept as audit trail
```

**Each pending receipt file:**
```json
{
  "id": "a3f2c1b0-4d1e-4f9a-b3c2-1234567890ab",
  "barId": "venue-bar-id",
  "driverId": "driver-HOSTNAME",
  "timestamp": "2026-03-02T10:00:00.000Z",
  "parsed": true,
  "confidence": 0.97,
  "receipt": {
    "items": [...],
    "total": 1300.00,
    "receiptNumber": "RCP-123456",
    "rawText": "..."
  },
  "enqueuedAt": "2026-03-02T10:00:00.005Z",
  "uploadAttempts": 0,
  "lastUploadError": null
}
```

### Part B — Management UI

An Express HTTP server on `localhost:8765`. Serves a web dashboard accessed via the system tray icon or automatically opened after installation:

- **Dashboard** — service status, job count, last activity, Bar ID, template status
- **Template Generator** — guided 3-step real-time workflow:
  - Prompts user to print test receipt 1 → detects and uploads → shows "✓ Receipt 1 received"
  - Prompts user to print test receipt 2 → detects and uploads → shows "✓ Receipt 2 received"  
  - Prompts user to print test receipt 3 → detects and uploads → shows "✓ Receipt 3 received"
  - Sends all 3 to cloud DeepSeek AI → generates template → saves locally
  - Shows success message when complete
- **Configuration** — set Bar ID, API URL, watch folder
- **Log Viewer** — tail `service.log` in the browser

The management UI is entirely optional for receipt capture. Part A runs independently and keeps working whether or not the UI is open or the HTTP server is running.

### System Tray Icon

A separate lightweight process that launches at Windows login via a registry `Run` key. Shows a coloured icon in the system tray (green = online, grey = offline/unconfigured) with a right-click menu: open dashboard, send test print, view logs, quit.

The tray communicates with the management UI server via HTTP on `localhost:8765`. It is display-only — receipt capture happens in the Windows Service regardless of whether the tray is running.

---

## Data Flows

### Every Receipt — Normal Operation

```
Capture (immediate)
─────────────────────────────────────────────────────
 1.  Staff prints from POS
 2.  Windows Pooling writes ESC/POS bytes to order.prn
     via the Local Port (TabezaCapturePort)
 3.  chokidar detects the file change
 4.  Service waits 1.5s for write to stabilise
 5.  Reads order.prn
 6.  Strips ESC/POS control bytes → plain text
 7.  Local regex parser runs against template.json  (1–5ms)
 8.  Produces: { items, total, receiptNumber, confidence }
 9.  Writes {uuid}.json to queue\pending\
10.  Truncates order.prn to 0 bytes
11.  Archives copy to processed\YYYYMMDD-HHMMSS.prn

Upload Worker (concurrent, runs every 2 seconds)
─────────────────────────────────────────────────────
12.  Picks next file from queue\pending\
13.  POSTs parsed JSON to /api/receipts/ingest
14.  On success: moves file to queue\uploaded\
15.  Cloud stores receipt in Supabase
16.  Customer receives digital receipt notification

     If POST fails:
     → Retries with exponential backoff (5s, 10s, 20s, 40s)
     → After 4 attempts: file stays in pending\
     → Will retry automatically on next service start
```

### Template Setup — Once per Venue (Guided Real-Time Flow)

```
1.  After Tabeza Connect installation completes, installer opens browser to localhost:8765
2.  Management UI detects no template exists (template.json missing)
3.  Modal appears: "Complete Setup — Generate Receipt Template"
4.  Step 1/3: "Print your first test receipt from your POS"
    → User prints receipt from POS → Tabeza Connect captures and uploads raw text
    → UI polls local service API and shows "✓ Receipt 1 received"
5.  Step 2/3: "Print a DIFFERENT receipt (different items/prices)"
    → User prints receipt → Tabeza Connect captures and uploads
    → UI shows "✓ Receipt 2 received"
6.  Step 3/3: "Print one more DIFFERENT receipt"
    → User prints receipt → Tabeza Connect captures and uploads
    → UI shows "✓ Receipt 3 received"
7.  UI shows loading spinner: "Generating template with AI... (this may take 30-60 seconds)"
8.  UI POSTs all 3 receipts to cloud: /api/receipts/generate-template
9.  Cloud DeepSeek AI analyses samples and generates regex template
10. Cloud returns template JSON
11. Service saves template to C:\ProgramData\Tabeza\template.json
12. UI shows: "✅ Success! Template parser created. You can now print 
    normally and manage digital receipts on the Tabeza Platform."
13. All future receipts parsed locally with no AI involvement
```

**Key UX Benefits:**
- Real-time feedback as each receipt is captured
- No need to navigate file system or select files
- Immediate validation that printer is working correctly
- Clear progress indicator (1/3, 2/3, 3/3)
- Guided workflow prevents user confusion
- Happens immediately after installation while user is at the PC

### Heartbeat — Every 30 Seconds

```
1.  Service POSTs { barId, driverId, version, status: "online" }
    to /api/printer/heartbeat
2.  Cloud updates printer_drivers table in Supabase
3.  Staff app reads driver status and shows green/grey indicator
```

---

## Cloud API Endpoints

| Endpoint | Method | Called By | Purpose |
|---|---|---|---|
| `/api/receipts/ingest` | POST | Service (every print) | Upload parsed receipt data |
| `/api/printer/heartbeat` | POST | Service (every 30s) | Signal device is online |
| `/api/receipts/generate-template` | POST | Management UI (setup) | Generate regex template via AI |
| `/api/printer/driver-status` | GET | Staff app | Read device online/offline status |

### Parsed Receipt Payload

```json
{
  "barId":      "venue-bar-id",
  "driverId":   "driver-HOSTNAME",
  "timestamp":  "2026-03-02T10:00:00.000Z",
  "parsed":     true,
  "confidence": 0.97,
  "receipt": {
    "items": [
      { "name": "Tusker Lager 500ml", "qty": 2, "price": 500.00 },
      { "name": "Nyama Choma",        "qty": 1, "price": 800.00 }
    ],
    "total":         1300.00,
    "receiptNumber": "RCP-001234",
    "rawText":       "... stripped plain text ..."
  },
  "metadata": {
    "source":          "pooling-capture",
    "templateVersion": "1.2",
    "parseTimeMs":     3
  }
}
```

### No-Template Fallback Payload

```json
{
  "barId":     "venue-bar-id",
  "driverId":  "driver-HOSTNAME",
  "timestamp": "2026-03-02T10:00:00.000Z",
  "parsed":    false,
  "rawText":   "... stripped plain text ...",
  "metadata": {
    "source": "pooling-capture",
    "reason": "no-template"
  }
}
```

---

## Configuration

Configuration is loaded in this priority order (highest wins):

1. **Environment variables** — set on the Windows Service by the installer
2. **Windows Registry** — `HKLM\SOFTWARE\Tabeza\TabezaConnect`
3. **Config file** — `C:\ProgramData\Tabeza\config.json`

| Setting | Environment Variable | Default |
|---|---|---|
| Bar ID | `TABEZA_BAR_ID` | _(required, set during install)_ |
| API URL | `TABEZA_API_URL` | `https://tabeza.co.ke` |
| Watch folder | `TABEZA_WATCH_FOLDER` | `C:\ProgramData\Tabeza\TabezaPrints` |

---

## File System Layout

```
C:\Program Files\TabezaConnect\
├── TabezaConnect.exe            <- single compiled binary (~45 MB)
├── assets\
│   └── icon-green.ico
└── scripts\                    <- PowerShell scripts called by installer
    ├── create-folders.ps1
    ├── configure-pooling-printer.ps1
    ├── register-service-pkg.ps1
    └── verify-installation.ps1

C:\ProgramData\Tabeza\
├── config.json                  <- runtime configuration
├── template.json                <- regex template (written after setup)
├── logs\
│   └── service.log
└── TabezaPrints\
    ├── order.prn                <- live capture file (always present on disk)
    ├── processed\              <- timestamped archive of successful captures
    └── failed\                 <- timestamped archive of captures that failed to parse

C:\ProgramData\Tabeza\queue\
├── pending\                    <- receipts parsed but not yet uploaded (survives reboots)
│   └── {uuid}.json             <- one file per receipt
└── uploaded\                   <- receipts successfully sent to cloud (audit trail)

Windows Registry: HKLM\SOFTWARE\Tabeza\TabezaConnect
├── BarID
├── APIUrl
└── WatchFolder

Windows Service: TabezaConnect
├── Display Name:  Tabeza POS Connect
├── Account:       LocalService
├── Startup:       Automatic
└── Environment:   TABEZA_BAR_ID, TABEZA_API_URL, TABEZA_WATCH_FOLDER
```

---

## Technology Stack

| Layer | Choice | Reason |
|---|---|---|
| Language | Node.js v20 | Strong file-system and HTTP libraries |
| Packaging | **PKG** | Single .exe, native Windows Service support, 45MB footprint |
| File watching | `chokidar` | Reliable watcher with write-stability threshold support |
| HTTP server | `express` | Serves the management UI on localhost:8765 |
| Installer | **Inno Setup 6 + PowerShell** | Full control over Windows Service registration, printer setup |
| Cloud platform | Vercel (Next.js) | Hosts the API routes |
| Database | **Supabase (PostgreSQL)** | Single source of truth for all Tabeza data |
| AI (setup only) | DeepSeek via OpenAI SDK | Generates regex template from sample receipts |

### Why PKG Instead of Electron?

Tabeza Connect is a **Windows Service with printer integration**, not a GUI desktop app. PKG is the right tool because:

- ✅ **Native Windows Service** - Registers with `sc.exe`, runs as LocalService, auto-starts on boot
- ✅ **Smaller footprint** - 45MB vs 80-120MB for Electron
- ✅ **PowerShell integration** - Installer can run printer configuration scripts directly
- ✅ **Simpler architecture** - One executable, one purpose, no Chromium overhead
- ✅ **Production-proven** - Already deployed and working in venues

Electron is designed for GUI apps with complex UIs. Tabeza Connect's UI is minimal (system tray + localhost dashboard), so PKG's simplicity wins.

---

## Database Schema (Relevant Tables)

```sql
-- Tracks which venue devices are online
printer_drivers (
  id                UUID PRIMARY KEY,
  bar_id            UUID,
  driver_id         TEXT,        -- "driver-HOSTNAME"
  status            TEXT,        -- "online" | "offline"
  last_heartbeat_at TIMESTAMP,
  version           TEXT
)

-- Stores each parsed receipt awaiting customer assignment
unmatched_receipts (
  id             UUID PRIMARY KEY,
  bar_id         UUID,
  receipt_number TEXT,
  items          JSONB,          -- [{ name, qty, price }]
  total          NUMERIC,
  raw_text       TEXT,
  confidence     NUMERIC,
  matched        BOOLEAN DEFAULT false,
  created_at     TIMESTAMP
)
```

---

## Installation Process

The Inno Setup installer runs these steps in sequence:

1. Prompts the user for their Bar ID (from the Tabeza dashboard)
2. Copies `TabezaConnect.exe` and supporting files to `C:\Program Files\TabezaConnect\`
3. Creates `C:\ProgramData\Tabeza\TabezaPrints\` with subdirectories and an empty `order.prn`
4. Runs `configure-pooling-printer.ps1` — creates "Tabeza Agent" with pooled ports
5. Writes Bar ID and settings to `HKLM\SOFTWARE\Tabeza\TabezaConnect`
6. Runs `register-service-pkg.ps1` — registers and starts the Windows Service
7. Adds a registry `Run` key so the tray icon launches at user login
8. Opens browser to `http://localhost:8765` for guided template setup

---

## Core Design Principles

**The POS and printer are never affected.** Tabeza Connect reads a copy of the print job written to a file by Windows. If the service is stopped or crashes, the POS continues working and paper receipts print normally.

**Parsing is local and fast.** Every receipt is parsed on the venue machine using a regex template. No internet connection is needed to parse — only to upload. Parse time is 1–5ms.

**AI is a setup tool, not a runtime dependency.** DeepSeek is called once per venue to generate the regex template. It is never called during day-to-day receipt processing.

**The cloud receives structured data.** The upload payload is clean JSON — items, prices, totals. The cloud stores and delivers it without needing to parse anything.

**The application is a single file.** No Node.js installation, no npm, no separate processes to manage. One `.exe` contains everything needed to run.

---

## Planned Enhancements

- **Self-healing template** — when parsing confidence drops across consecutive receipts, automatically request a refreshed template from the cloud
- **Multi-venue support** — one installation serving multiple Bar IDs
- **Live dashboard updates** — WebSocket push instead of polling in the management UI
- **Automatic template versioning** — cloud pushes improved templates as AI refines patterns over time

---

**Last Updated:** 2026-03-02  
**Document Owner:** Tabeza Development Team  
**Status:** Authoritative Reference
