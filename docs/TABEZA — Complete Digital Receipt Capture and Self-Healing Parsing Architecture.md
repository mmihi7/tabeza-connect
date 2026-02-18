---

# TABEZA — Complete Digital Receipt Capture & Self-Healing Parsing Architecture

Version: 1.0
Purpose: Production Engineering Blueprint
Scope: Windows Capture Service + Cloud Parsing + AI Self-Healing

---

# 1. Core Architectural Principles (Non-Negotiable)

## Principle 1: Printing must never depend on Tabeza

Tabeza must never block or delay printing.

Correct model:

```
POS ─────────► Printer (instant)

POS ─────────► Tabeza Capture Service ─────────► Cloud
```

Tabeza observes only.

Never:

```
POS ─► Tabeza ─► Printer   ❌
```

---

## Principle 2: Capture must be asynchronous and fault-tolerant

Capture must succeed even if:

* internet is offline
* cloud unavailable
* AI unavailable

Printing must continue uninterrupted.

---

## Principle 3: ESC/POS is the primary capture format

Capture priority:

```
ESC/POS bytes (primary)
Extracted text (secondary)
Rendered image (fallback only)
```

---

## Principle 4: AI is used for template creation and evolution, not routine parsing

AI is used during setup and controlled learning phases to generate and improve receipt parsing templates. Once a template is established, all routine receipt parsing is performed deterministically using regex, ensuring speed, reliability, and zero operational latency.

AI is only invoked when:

A venue is first onboarded (initial template generation), or

The regex parser detects insufficient confidence or repeated failures (template improvement phase)

AI is never required for normal operations. The production parsing path is always:

Receipt captured → Regex parsing → Structured receipt


AI operates asynchronously in the background to refine templates, ensuring the system becomes more accurate over time without affecting live receipt processing.

This guarantees:

Instant receipt availability

Deterministic performance

Minimal operational cost

Continuous self-improvement without operational dependency

---

## Principle 5: Raw capture is immutable

Never modify raw receipt data.

Always store original.

---

# 2. Complete System Architecture Overview

```
VENUE COMPUTER
────────────────────────────

POS System
   │
   ├──► Thermal Printer
   │
   └──► Tabeza Windows Capture Service
              │
              ▼
         Cloud API


CLOUD
────────────────────────────

Ingestion API
   │
Queue
   │
Parsing Orchestrator
   │
   ├── Regex parser
   ├── AI fallback parser
   └── Template learning engine

Database
   │
Customer PWA
```

---

# 3. Windows Capture Service Architecture (Critical Component)

Runs locally on venue Windows machine.

Installed as a native Windows Service.

---

# 3.1 Responsibilities

The capture service must:

Monitor print spooler
Capture raw ESC/POS or text
Convert ESC/POS to text
Store locally if offline
Upload asynchronously
Retry failed uploads

Never block printing.

---

# 3.2 Windows Service Internal Architecture

```
TabezaCaptureService.exe
│
├── Service Controller
│
├── Spool Monitor
│     ├── watches spool directory
│     └── detects new print jobs
│
├── Print Job Processor
│     ├── extracts ESC/POS bytes
│     ├── extracts text
│     └── generates metadata
│
├── Local Persistent Queue
│     ├── stores pending receipts
│     └── survives reboot
│
├── Upload Worker
│     ├── uploads receipts asynchronously
│     └── retries failed uploads
│
└── Config Manager
      ├── venue ID
      ├── device ID
      └── API endpoint
```

---

# 3.3 Windows Service Lifecycle

```
Service Start
    │
    ├── Load configuration
    ├── Start spool monitor
    ├── Start upload worker
    └── Start local queue processor

Service Running
    │
    ├── Detect print job
    ├── Capture receipt
    ├── Save locally
    └── Upload async

Service Stop
    │
    └── Graceful shutdown
```

---

# 3.4 Spool Monitoring Implementation

Monitor directory:

```
C:\Windows\System32\spool\PRINTERS
```

Detect files:

```
*.SPL
*.SHD
```

Example code (Node.js prototype):

```js
const fs = require("fs");

const SPOOL_PATH = "C:\\Windows\\System32\\spool\\PRINTERS";

fs.watch(SPOOL_PATH, (eventType, filename) => {

    if (!filename.endsWith(".SPL")) return;

    const fullPath = `${SPOOL_PATH}\\${filename}`;

    setTimeout(() => {
        processPrintFile(fullPath);
    }, 500);

});
```

Delay ensures file write complete.

---

# 3.5 ESC/POS Extraction

```js
function extractEscPos(buffer) {

    const isEscPos =
        buffer.includes(Buffer.from([0x1B, 0x40])) ||
        buffer.includes(Buffer.from([0x1D, 0x56]));

    return isEscPos;
}
```

---

# 3.6 ESC/POS to Text Conversion

Example:

```js
function escPosToText(buffer) {

    return buffer
        .toString("ascii")
        .replace(/[^\x20-\x7E\n]/g, "")
        .trim();
}
```

Result:

```
Beer     1    300
TOTAL         300
```

---

# 3.7 Local Persistent Queue

Local storage folder:

```
C:\ProgramData\Tabeza\queue\
```

Each receipt saved as:

```
receipt-uuid.json
```

Example:

```json
{
  "id": "uuid",
  "venueId": "venue-123",
  "timestamp": "2026-02-17T20:00:00Z",
  "escpos": "base64",
  "text": "Beer 1 300"
}
```

---

# 3.8 Upload Worker

Runs continuously.

```js
async function uploadWorker() {

  while(true) {

    const receipt = await getNextLocalReceipt();

    try {

        await uploadToCloud(receipt);

        markAsUploaded(receipt.id);

    } catch {

        await sleep(5000);

    }

  }
}
```

Never blocks capture.

---

# 4. Cloud Ingestion API

Endpoint:

```
POST /api/receipts/ingest
```

Example:

```js
app.post("/api/receipts/ingest", async (req, res) => {

  const receiptId = await saveRawReceipt(req.body);

  await queue.add("parse", receiptId);

  res.json({ success: true });

});
```

Immediate response.

Never parse inline.

---

# 5. Parsing Orchestrator Architecture

Core brain of parsing.

```
Queue
  │
  ▼
Orchestrator
  │
  ├── Load template
  ├── Run regex parser
  ├── Calculate confidence
  │
  ├── High confidence → Save
  │
  └── Low confidence → AI fallback
```

---

# 6. Regex Parsing Engine

Fast deterministic parsing.

Example:

```js
const match = line.match(template.patterns.item_line);
```

Speed:

```
1–5 ms
```

Handles 95–99%.

---

# 7. AI Fallback Parser

Runs only when regex confidence low.

Example:

```js
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [...]
});
```

Handles edge cases.

---

# 8. Self-Healing Template Learning

When AI succeeds:

Store learning event:

```
template_learning_events
```

When repeated enough:

Create new template version.

---

# Template evolution example

```
Version 1 → initial template
Version 2 → added VAT pattern
Version 3 → added happy hour format
```

Fully autonomous.

---

# 9. Database Structure Overview

Core tables:

```
venues
devices
raw_receipts
receipts
receipt_items
parsing_templates
template_learning_events
parse_failures
```

---

# 10. End-to-End Timing Model

Typical timeline:

```
0 ms    POS prints
1 ms    Printer prints
5 ms    Capture service saves receipt
20 ms   Uploaded to cloud
30 ms   Regex parsing complete
300 ms  AI fallback complete (rare)
```

Customer sees receipt almost instantly.

---

# 11. Failure Safety Model

Even if everything fails:

```
Printing still works
Venue unaffected
Customer still gets paper receipt
```

Digital layer is additive.

---

# 12. Deployment Architecture

Capture Service:

```
Venue Windows Machine
```

Cloud:

```
API servers
Parsing workers
PostgreSQL
Redis queue
```

---

# 13. Recommended Tech Stack

Capture Service:

```
Rust (best)
or
Node.js (faster dev)
```

Cloud:

```
Node.js
PostgreSQL
Redis
OpenAI API
```

---

# 14. Recommended Implementation Order

Build in this exact order:

Step 1
Windows Capture Service

Step 2
Cloud ingestion API

Step 3
Regex parser

Step 4
Database schema

Step 5
Parsing orchestrator

Step 6
AI fallback parser

Step 7
Self-healing template engine

---

# 15. Final System Properties

Tabeza becomes:

Passive
Non-blocking
Self-healing
Highly scalable
Low-cost
POS-agnostic

---

# Final Advisory Summary

Correct architecture guarantees:

Instant printing
Zero disruption
Universal POS compatibility
Self-improving parsing
Near-perfect accuracy
Massive scalability

---

If you want, the next step is I can generate a **production-ready Windows Service implementation in Rust (recommended) or Node.js**, including installer and auto-update system.
