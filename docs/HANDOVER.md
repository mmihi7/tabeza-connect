# Tabeza Connect — AI Handover Brief

**Date:** 2026-03-18  
**Purpose:** Advisory context for a new AI session continuing work on this codebase.

---

## What This System Is

Tabeza Connect is a Windows desktop service installed at a bar or restaurant. Its job is to silently intercept every receipt printed by the venue's POS system, parse it into structured JSON, and upload it to the Tabeza cloud so customers can receive digital receipts on their phones.

The venue's POS and physical printer are never touched. The system observes a copy of each print job.

---

## How It Works (Current Architecture)

```
POS prints to "Tabeza Agent" (virtual Windows printer)
    ↓
Redmon port monitor intercepts the raw ESC/POS bytes
    ↓
Redmon pipes bytes via stdin to: node src/capture/index.js --bar-id <id>
    ↓
capture script:
  - saves raw bytes → C:\TabezaPrints\raw\<timestamp>.prn
  - strips ESC/POS control codes → saves plain text → C:\TabezaPrints\text\<timestamp>.txt
  - if template exists: parses receipt → queues JSON for cloud upload
  - if no template yet: counts text\ files, triggers template generation at 3+
    ↓
SpoolWatcher (in service/index.js) watches C:\TabezaPrints\raw\ for .prn files
    ↓
On new .prn file: reads bytes, archives to processed\, emits forwardJob event, deletes from raw\
    ↓
PhysicalPrinterAdapter receives forwardJob, enqueues it
    ↓
Worker loop (sequential, not setInterval) calls WindowsPrinterConnection.send()
    ↓
WindowsPrinterConnection writes bytes to temp file, calls raw-print.ps1
    ↓
raw-print.ps1 uses Win32 WritePrinter API (pDataType="RAW") → EPSON L3210 Series
```

**Key constraint:** Redmon is the ONLY capture mechanism. No Windows Printer Pooling, no clawPDF.

---

## File Layout

```
C:\TabezaPrints\
├── config.json          ← runtime config (barId, apiUrl, printers[])
├── raw-print.ps1        ← written by win-printer.js on first connect (Win32 raw print)
├── raw\                 ← .prn files written by capture script, deleted by SpoolWatcher
├── text\                ← .txt files (textified receipts), persisted for template generation
├── processed\           ← archived .prn copies after successful forwarding
├── failed\              ← .prn files that failed to process
├── failed_prints\       ← JSON job files that failed after 5 print attempts
├── temp\                ← temporary .prn files used during printing (auto-deleted)
├── templates\
│   └── template.json    ← regex template for receipt parsing (written after AI generation)
├── queue\
│   ├── pending\         ← JSON receipts waiting to upload to cloud
│   └── uploaded\        ← JSON receipts successfully uploaded (audit trail)
├── parsed\              ← parsed receipt JSON files
└── logs\
    └── service.log
```

---

## Configuration

`C:\TabezaPrints\config.json` (also at `C:\Projects\tabeza-connect\config.json` in dev):

```json
{
  "barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
  "apiUrl": "http://localhost:3003",
  "printers": [{ "name": "EPSON L3210 Series", "type": "windows", "enabled": true, "isDefault": true }]
}
```

- `apiUrl` points to the staff app dev server (`http://localhost:3003`) in dev, `https://tabeza.co.ke` in prod
- Redmon registry: `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Ports\TabezaCapturePort`
  - `Command = node`
  - `Arguments = C:\Projects\tabeza-connect\src\capture\index.js --bar-id 438c80c1-fe11-4ac5-8a48-2fc45104ba31`
  - `Output = EPSON L3210 Series` (Redmon also forwards to physical printer)

---

## Key Source Files

| File | Role |
|------|------|
| `src/capture/index.js` | Invoked by Redmon per print job. Reads stdin, saves raw+text, triggers template gen |
| `src/service/index.js` | Main service entry. Starts all components. Contains inlined HTTP server (SimpleHTTPServer) |
| `src/service/spool-watcher.js` | Watches `raw\` for .prn files, emits `forwardJob` events |
| `src/service/printer-adapter.js` | Receives forwardJob events, manages print queue, calls WindowsPrinterConnection |
| `src/service/connections/win-printer.js` | Sends raw ESC/POS bytes via Win32 WritePrinter API |
| `src/service/receiptParser.js` | Parses plain text receipts using regex template |
| `src/service/uploadWorker.js` | Polls `queue/pending/`, POSTs to cloud, moves to `queue/uploaded/` |
| `src/service/heartbeat/heartbeat-service.js` | POSTs heartbeat to `/api/printer/heartbeat` every 30s |

---

## Bugs Fixed in This Session

### 1. Multiple print jobs per receipt
**Root cause:** `SpoolWatcher` uses `ignoreInitial: false`, so chokidar fires `add` events for files already in `raw\` at startup. Two events for the same file could both pass the `processingFiles` check before either completed, resulting in the same job being enqueued twice.

**Fix 1 — `spool-watcher.js`:** Mark `processedFiles.add(filePath)` immediately on first detection (before async processing), not after success. This blocks any duplicate `add` event at the gate.

**Fix 2 — `printer-adapter.js` `enqueueJob()`:** Added deduplication check — if a job with the same `jobId` is already in `forwardQueue`, silently drop the duplicate.

**Fix 3 (previous session) — `printer-adapter.js`:** Replaced `setInterval` with a self-scheduling `async _runWorkerLoop()` that `await`s each `processForwardQueue()` call before waiting 2s. This prevents concurrent processing of the same job when `Out-Printer` takes ~9s.

### 2. Jibberish output and multiple pages
**Root cause:** `Out-Printer` (PowerShell) routes data through the Windows GDI print pipeline. GDI treats the input as a text document — it mangles binary ESC/POS control bytes and splits on `\n`, producing one page per line.

**Fix — `win-printer.js` rewritten:** Now uses a PowerShell `Add-Type` C# snippet that calls the Win32 `WritePrinter` API directly with `pDataType = "RAW"`. This tells the Windows spooler to pass bytes straight through to the printer driver without any interpretation. The PS script is written to `C:\TabezaPrints\raw-print.ps1` on first connect and reused on every print.

### 3. Template generation not triggering / dashboard showing 0 receipts
**Root cause:** `capture.exe` and `/api/template/status` were counting files in `raw\`, but SpoolWatcher deletes files from `raw\` after forwarding. Count was always 0.

**Fix:** Both now count `.txt` files in `text\` instead. The `text\` folder is never cleared — it accumulates one file per receipt, giving an accurate count for template generation.

### 4. Heartbeat JSON parse error
**Root cause:** `heartbeat-service.js` called `.json()` on responses without checking `Content-Type`, crashing on non-JSON error responses.

**Fix:** Added `Content-Type` check before calling `.json()`.

---

## Proposed Next Changes

### P0 — Apply Redmon registry fix (requires admin terminal)

The other AI's advisory confirmed: Redmon's `Output` field must be cleared. If set, Redmon passes bytes through the Windows GDI pipeline — same root cause as the jibberish bug. Node's `raw-print.ps1` must be the only print path.

Run in an **admin PowerShell**:
```powershell
.\scripts\fix-redmon-registry.ps1
```

This sets:
- `Command = C:\nvm4w\nodejs\node.exe`
- `Arguments = C:\Projects\tabeza-connect\src\capture\index.js --bar-id 438c80c1-...`
- `Output = ` (empty — Redmon no longer prints)

Then restart the print spooler (the script does this automatically).

### P0b — Switch to PM2 for process management

To prevent single-point-of-failure if Node crashes:
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2-startup install   # run the output command as admin
```

`ecosystem.config.js` is at the project root. PM2 will restart the service within 1s of any crash. SpoolWatcher picks up any `.prn` files in `raw\` on restart — no receipts lost.

### P1 — Verify raw print is working correctly
After the `win-printer.js` rewrite, confirm:
- Receipt prints cleanly (no jibberish)
- Only one copy per print job
- `raw-print.ps1` is created at `C:\TabezaPrints\raw-print.ps1`
- Logs show `WritePrinter result: "OK:<bytes>"`

If `WritePrinter` fails with an access error, the service may need to run as a user account (not `LocalService`) that has print permissions. Check Windows Event Viewer → Application log.

### P2 — Template generation end-to-end
Once printing is clean, test the full template flow:
1. Print 3 different receipts
2. Dashboard at `http://127.0.0.1:8765` should show `capturedReceipts` incrementing 1→2→3
3. On 3rd print, `capture.exe` auto-calls `/api/receipts/generate-template` on the staff app
4. Template saved to `C:\TabezaPrints\templates\template.json`
5. Subsequent receipts are parsed and queued for cloud upload

The staff app endpoint is at `http://localhost:3003/api/receipts/generate-template`. Verify this route exists and accepts `{ test_receipts: string[], bar_id: string }`.

### P3 — Cloud upload pipeline
Once template exists, receipts are queued in `queue/pending/`. The `UploadWorker` POSTs them to `http://localhost:3003/api/receipts/ingest`. Verify:
- The staff app has this route
- Supabase `unmatched_receipts` table exists with correct schema
- `SUPABASE_SECRET_KEY` (not `SUPABASE_SERVICE_ROLE_KEY`) is set in the staff app env

### P4 — `text\` folder cleanup
Currently `text\` accumulates forever. After template generation succeeds, old `.txt` files should be archived or deleted. Suggest: after `triggerTemplateGeneration()` completes successfully in `capture/index.js`, move processed `.txt` files to a `text/archived/` subfolder.

### P5 — `capture.exe` rebuild for production
In dev, Redmon calls `node src/capture/index.js` directly. For production, rebuild `capture.exe`:
```bash
node src/capture/build-capture.js
copy dist\capture.exe C:\TabezaPrints\capture.exe
```
Then update Redmon registry to call `C:\TabezaPrints\capture.exe` instead of node.

---

## Things to Never Change

- Redmon is the only capture mechanism. Do not add Windows Printer Pooling or clawPDF.
- `capture.exe` receives bytes via stdin only. Do not change this interface.
- Physical printing to EPSON L3210 is mandatory — SpoolWatcher → PhysicalPrinterAdapter → WindowsPrinterConnection.
- Template save path is always `C:\TabezaPrints\templates\template.json`.
- `apiUrl` in config is `http://localhost:3003` in dev (staff app). Do not hardcode `https://tabeza.co.ke` in dev paths.
- `SUPABASE_SECRET_KEY` is the correct env var name (not `SUPABASE_SERVICE_ROLE_KEY`).
