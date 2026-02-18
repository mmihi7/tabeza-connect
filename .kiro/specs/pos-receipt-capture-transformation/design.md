# Design Document: POS Receipt Capture Transformation

## Overview

This design transforms Tabeza's printer integration from a blocking intermediary to a passive receipt capture system. The current architecture requires TabezaConnect to be in the print path (POS → TabezaConnect → Printer), creating a critical dependency. The new architecture allows POS systems to print directly to printers while Tabeza passively observes and captures receipt data.

**CRITICAL CLARIFICATION**: The "Tabeza printer drivers" referenced throughout product documentation refers to the TabezaConnect Capture Service - a Windows background service that watches the Windows print spooler directory and silently copies print jobs AFTER they have been sent to the printer. The printer never knows Tabeza exists. The POS never knows Tabeza exists. This is why it's called a driver/capture service - it integrates at the OS print layer, not the application layer.

### Core Architectural Shift

**Current (Blocking):**
```
POS → TabezaConnect → Printer ❌
```

**New (Passive):**
```
POS ────────► Printer (instant, receipt prints in 1ms)
     │
     └──────► Windows Spooler
                    │
                    └──► TabezaConnect watches here
                              │
                              └──► Capture Service reads SPL file silently
                                        │
                                        └──► Saved locally + uploaded to cloud
```

### Key Design Principles

1. **Printing Never Depends on Tabeza**: POS prints directly to printer with zero latency. Tabeza observes the print stream - it never owns it.
2. **Asynchronous Capture**: Receipt capture succeeds even if internet/cloud/AI is offline
3. **ESC/POS Primary Format**: Capture ESC/POS bytes first, text second, image as fallback
4. **AI for Templates, Not Routine Parsing**: AI generates venue template during onboarding. Regex handles production (1-5ms, zero cost). AI fallback for edge cases (async, rare). Both fail → physical receipt is sufficient.
5. **Immutable Raw Capture**: Never modify original receipt data
6. **Physical Receipt is Final Fallback**: Digital parsing is additive. It enhances customer experience; it does not replace the paper receipt. If parsing fails entirely, the customer still has their physical receipt. The venue is unaffected.
7. **Digital Authority is Singular**: Every venue operates with exactly one digital order authority. Manual/traditional ordering always coexists. Tabeza adapts to the venue - never the reverse. `(POS authority OR Tabeza authority) AND Manual service`

### System Components

1. **TabezaConnect Capture Service** (Windows): Monitors print spooler, captures receipts, queues locally
2. **Cloud Ingestion API**: Accepts raw receipts, queues for parsing
3. **Parsing Orchestrator**: Coordinates regex and AI parsing with confidence scoring
4. **Regex Parser**: Fast deterministic parsing (1-5ms, handles 95-99%)
5. **AI Fallback Parser**: Claude Haiku or GPT-4o-mini for edge cases only
6. **AI Template Generator**: Creates venue-specific regex templates during onboarding
7. **Self-Healing Template Engine**: Automatic template improvement through learning events
8. **Receipt-to-Tab Linking**: Customer claims receipts from "Recent receipts" list
9. **Staff App Integration**: Receipt viewing, template management, unclaim action

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VENUE COMPUTER                           │
│                                                             │
│  ┌──────────┐                                              │
│  │   POS    │                                              │
│  │  System  │                                              │
│  └────┬─────┘                                              │
│       │                                                     │
│       ├──────────► Thermal Printer (instant)               │
│       │                                                     │
│       └──────────► Windows Print Spooler                   │
│                           │                                 │
│                           ▼                                 │
│                  ┌─────────────────┐                       │
│                  │  TabezaConnect  │                       │
│                  │ Capture Service │                       │
│                  └────────┬────────┘                       │
│                           │                                 │
│                           ▼                                 │
│                  ┌─────────────────┐                       │
│                  │  Local Queue    │                       │
│                  │  (Persistent)   │                       │
│                  └────────┬────────┘                       │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            │ HTTPS (async)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      TABEZA CLOUD                           │
│                                                             │
│  ┌──────────────────┐                                      │
│  │  Ingestion API   │                                      │
│  └────────┬─────────┘                                      │
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────┐                                      │
│  │   Redis Queue    │                                      │
│  └────────┬─────────┘                                      │
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────┐                                      │
│  │    Parsing       │                                      │
│  │  Orchestrator    │                                      │
│  └────┬─────────────┘                                      │
│       │                                                     │
│       ├──────► Regex Parser (1-5ms, 95-99%)               │
│       │                                                     │
│       └──────► AI Parser (300ms, edge cases)              │
│                                                             │
│  ┌──────────────────┐                                      │
│  │   PostgreSQL     │                                      │
│  │   - raw_receipts │                                      │
│  │   - receipts     │                                      │
│  │   - templates    │                                      │
│  └──────────────────┘                                      │
│                                                             │
│  ┌──────────────────┐                                      │
│  │  Customer PWA    │ (receives digital receipt)          │
│  └──────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```


### TabezaConnect Capture Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           TabezaConnect Capture Service                     │
│                                                             │
│  ┌──────────────────┐                                      │
│  │ Service          │                                      │
│  │ Controller       │                                      │
│  └────────┬─────────┘                                      │
│           │                                                 │
│           ├──────► Spool Monitor                           │
│           │        - Watches C:\Windows\...\spool\PRINTERS │
│           │        - Detects .SPL/.SHD files               │
│           │                                                 │
│           ├──────► Print Job Processor                     │
│           │        - Extracts ESC/POS bytes                │
│           │        - Converts to text                      │
│           │        - Generates metadata                    │
│           │                                                 │
│           ├──────► Local Persistent Queue                  │
│           │        - C:\ProgramData\Tabeza\queue\          │
│           │        - Survives reboot                       │
│           │                                                 │
│           ├──────► Upload Worker                           │
│           │        - Async upload to cloud                 │
│           │        - Exponential backoff retry             │
│           │                                                 │
│           └──────► Config Manager                          │
│                    - Venue ID                              │
│                    - Device ID                             │
│                    - API endpoint                          │
└─────────────────────────────────────────────────────────────┘
```

### Parsing Orchestrator Flow

```
Receipt Ingested
      │
      ▼
Load Venue Template
      │
      ▼
Apply Regex Parser ──────► Confidence ≥ 80% ──► Save Receipt
      │                                              │
      │                                              ▼
      └──► Confidence < 80% ──► AI Parser ──► Success? ──► Save Receipt
                                      │                        │
                                      │                        ▼
                                      │              Store Learning Event
                                      │                        │
                                      ▼                        ▼
                                   Failed ──► Log to      Template Evolution
                                           parse_failures   (10+ events)
```

## Components and Interfaces

### 1. TabezaConnect Capture Service (Windows)

**Technology**: Node.js (current) or Rust (recommended for production)

**Core Modules**:

#### Spool Monitor
```typescript
interface SpoolMonitor {
  watchDirectory: string; // C:\Windows\System32\spool\PRINTERS
  fileTypes: string[];    // ['.SPL', '.SHD']
  pollInterval: number;   // 500ms
  
  onFileDetected(filePath: string): void;
  waitForWriteComplete(filePath: string): Promise<void>;
}
```

#### Print Job Processor
```typescript
interface PrintJobProcessor {
  extractESCPOS(buffer: Buffer): {
    isESCPOS: boolean;
    bytes: Buffer;
  };
  
  convertToText(escposBytes: Buffer): string;
  
  generateMetadata(file: string): {
    jobId: string;
    timestamp: string;
    fileSize: number;
  };
}
```

#### Local Queue
```typescript
interface LocalQueue {
  queuePath: string; // C:\ProgramData\Tabeza\queue\
  
  enqueue(receipt: RawReceipt): Promise<string>;
  dequeue(): Promise<RawReceipt | null>;
  markUploaded(receiptId: string): Promise<void>;
  getQueueSize(): Promise<number>;
}

interface RawReceipt {
  id: string;
  barId: string;
  deviceId: string;
  timestamp: string;
  escposBytes: string; // base64
  text: string;
  metadata: Record<string, any>;
}
```

#### Upload Worker
```typescript
interface UploadWorker {
  maxRetries: number;
  baseDelay: number; // 5000ms
  
  start(): void;
  stop(): void;
  uploadReceipt(receipt: RawReceipt): Promise<void>;
  retryWithBackoff(attempt: number): Promise<void>;
}
```


### 2. Cloud Ingestion API

**Endpoint**: `POST /api/receipts/ingest`

**Request**:
```typescript
interface IngestRequest {
  barId: string;
  deviceId: string;
  timestamp: string;
  escposBytes: string; // base64
  text: string;
  metadata: {
    jobId: string;
    source: 'spool-monitor' | 'manual';
    fileSize: number;
  };
}
```

**Response**:
```typescript
interface IngestResponse {
  success: boolean;
  receiptId: string;
  queuedForParsing: boolean;
}
```

**Implementation**:
```typescript
async function ingestReceipt(req: IngestRequest): Promise<IngestResponse> {
  // 1. Save to raw_pos_receipts table (immutable)
  const receiptId = await db.raw_pos_receipts.insert({
    bar_id: req.barId,
    device_id: req.deviceId,
    timestamp: req.timestamp,
    escpos_bytes: req.escposBytes,
    text: req.text,
    metadata: req.metadata,
  });
  
  // 2. Queue for parsing (async, non-blocking)
  await queue.add('parse-receipt', { receiptId });
  
  // 3. Return immediately (< 100ms)
  return {
    success: true,
    receiptId,
    queuedForParsing: true,
  };
}
```

### 3. Parsing Orchestrator

**Queue Worker**:
```typescript
interface ParsingOrchestrator {
  processReceipt(receiptId: string): Promise<void>;
  loadTemplate(barId: string): Promise<ParsingTemplate>;
  calculateConfidence(result: ParseResult): number;
  handleLowConfidence(receiptId: string, text: string): Promise<void>;
  storeStructuredReceipt(receipt: StructuredReceipt): Promise<void>;
}

interface ParsingTemplate {
  id: string;
  barId: string;
  version: number;
  patterns: {
    itemLine: RegExp;
    quantity: RegExp;
    price: RegExp;
    subtotal: RegExp;
    tax: RegExp;
    total: RegExp;
  };
  active: boolean;
}

interface ParseResult {
  items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  confidence: number;
}

interface LineItem {
  lineNumber: number;
  quantity: number;
  itemName: string;
  unitPrice: number;
  totalPrice: number;
}
```

**Processing Flow**:
```typescript
async function processReceipt(receiptId: string): Promise<void> {
  // 1. Load raw receipt
  const raw = await db.raw_pos_receipts.findById(receiptId);
  
  // 2. Load bar template
  const template = await loadTemplate(raw.bar_id);
  
  // 3. Apply regex parser
  const result = await regexParser.parse(raw.text, template);
  
  // 4. Check confidence
  if (result.confidence >= 0.80) {
    // High confidence - save immediately
    await storeStructuredReceipt(receiptId, result);
  } else {
    // Low confidence - invoke AI
    await handleLowConfidence(receiptId, raw.text);
  }
}
```

### 4. Regex Parser

**Core Logic**:
```typescript
interface RegexParser {
  parse(text: string, template: ParsingTemplate): Promise<ParseResult>;
  extractLineItems(text: string, pattern: RegExp, semanticMap: string[]): LineItem[];
  extractTotal(text: string, pattern: RegExp): number;
  calculateConfidence(result: ParseResult, text: string, maxConfidence: number): number;
}

async function parse(text: string, template: ParsingTemplate): Promise<ParseResult> {
  const startTime = Date.now();
  
  const lines = text.split('\n');
  const items: LineItem[] = [];
  let subtotal = 0;
  let tax = 0;
  let total = 0;
  let confidence = 0;
  
  // Extract line items
  for (const line of lines) {
    const itemMatch = line.match(new RegExp(template.patterns.itemLine));
    if (itemMatch) {
      const semanticMap = template.semanticMap.itemLine;
      items.push({
        lineNumber: items.length + 1,
        quantity: parseInt(itemMatch[semanticMap.indexOf('qty') + 1]),
        itemName: itemMatch[semanticMap.indexOf('name') + 1].trim(),
        unitPrice: parseFloat(itemMatch[semanticMap.indexOf('unit_price') + 1]),
        totalPrice: parseFloat(itemMatch[semanticMap.indexOf('line_total') + 1]),
      });
      confidence += 1; // Each item found adds to confidence
    }
    
    // Extract totals
    const totalMatch = line.match(new RegExp(template.patterns.totalLine));
    if (totalMatch) {
      total = parseFloat(totalMatch[1].replace(/,/g, ''));
      confidence += 2; // Total is critical
    }
    
    const taxMatch = line.match(new RegExp(template.patterns.taxLine));
    if (taxMatch) {
      tax = parseFloat(taxMatch[1]);
      confidence += 1;
    }
    
    const subtotalMatch = line.match(new RegExp(template.patterns.subtotal));
    if (subtotalMatch) {
      subtotal = parseFloat(subtotalMatch[1].replace(/,/g, ''));
      confidence += 1;
    }
  }
  
  // Reconciliation check: sum of items should equal total
  const itemsSum = items.reduce((acc, i) => acc + i.totalPrice, 0);
  if (Math.abs(itemsSum - total) > 0.01) {
    confidence -= 2; // Mismatch reduces confidence significantly
  }
  
  // Calculate max possible confidence
  const maxConfidence = items.length + 4; // items + total + tax + subtotal + reconciliation
  
  // Calculate confidence ratio
  const confidenceRatio = confidence / maxConfidence;
  
  const duration = Date.now() - startTime;
  console.log(`Regex parsing completed in ${duration}ms, confidence: ${confidenceRatio.toFixed(2)}`);
  
  return {
    items,
    subtotal,
    tax,
    total,
    confidence: confidenceRatio,
  };
}
```

**Confidence Calculation with Reconciliation**:
```typescript
function calculateConfidence(result: ParseResult, maxConfidence: number): number {
  let score = 0;
  
  // Items found (1 point each)
  score += result.items.length;
  
  // Totals found (2 points for total, 1 each for tax/subtotal)
  if (result.total > 0) score += 2;
  if (result.tax >= 0) score += 1;
  if (result.subtotal > 0) score += 1;
  
  // Reconciliation check (critical - deduct 2 points if mismatch)
  const calculatedTotal = result.items.reduce((sum, item) => sum + item.totalPrice, 0);
  if (Math.abs(calculatedTotal - result.total) > 0.01) {
    score -= 2; // Mismatch is worse than missing data
  }
  
  // Return as ratio (0.00 to 1.00)
  return score / maxConfidence;
}
```

**Confidence Thresholds**:
```
≥ 0.85  → Accept and save (high confidence)
< 0.85  → AI fallback (low confidence or reconciliation failure)
= 0.00  → AI fallback (no patterns matched at all)
```

**Why Reconciliation Matters**: A receipt where items parse correctly but totals don't reconcile is worse than a clean failure. It indicates a parsing error that could lead to incorrect charges. The confidence system catches these partial failures.


### 5. AI Template Generator (Onboarding)

**Purpose**: Generate venue-specific regex templates during onboarding using AI analysis of test receipts.

**Onboarding Flow**:
```typescript
interface OnboardingTemplateGenerator {
  analyzeTestReceipts(receipts: RawReceipt[]): Promise<ParsingTemplate>;
  generateRegexPatterns(receipts: RawReceipt[]): Promise<RegexPatterns>;
  testTemplate(template: ParsingTemplate, receipts: RawReceipt[]): Promise<number>;
  saveTemplate(venueId: string, template: ParsingTemplate): Promise<void>;
}

// Onboarding steps:
// 1. Venue installs TabezaConnect Capture Service
// 2. Staff print 5-10 test receipts on the POS (normal orders - variety is better than volume)
// 3. Capture service uploads all test receipts
// 4. AI analyzes ALL receipts together (not just one - sees variation from the start)
// 5. AI generates: regex patterns, semantic map, edge case patterns, confidence threshold
// 6. Template saved to venue profile
// 7. Onboarding complete - regex takes over

async function generateBarTemplate(barId: string, testReceipts: RawReceipt[]): Promise<void> {
  // Use AI to analyze all test receipts together
  const prompt = `Analyze these ${testReceipts.length} receipts from the same bar and generate regex patterns.

${testReceipts.map((r, i) => `Receipt ${i + 1}:\n${r.text}`).join('\n---\n')}

Generate:
1. Regex patterns for: item_line, total_line, tax_line, void_marker, discount_line
2. Semantic map: which capture group = which field (name, qty, unit_price, line_total)
3. Known edge cases: split bills, happy hour markers, void reprints, etc.
4. Recommended confidence threshold (0.80-0.90)

Return as JSON with this structure:
{
  "patterns": {
    "item_line": "regex pattern",
    "total_line": "regex pattern",
    ...
  },
  "semantic_map": {
    "item_line": ["name", "qty", "unit_price", "line_total"],
    "currency": "KES",
    "tax_inclusive": true
  },
  "known_edge_cases": ["split_bill_header", "happy_hour_suffix", ...],
  "confidence_threshold": 0.85
}`;

  const response = await ai.chat({
    model: 'claude-haiku', // or 'gpt-4o-mini'
    messages: [
      {
        role: 'system',
        content: 'You are a receipt parsing expert. Generate precise regex patterns for receipt parsing.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.1,
  });

  const templateData = JSON.parse(response.content);
  
  // Test template against all test receipts
  const accuracy = await testTemplate(templateData, testReceipts);
  
  // Save template
  await db.receipt_parsing_templates.insert({
    bar_id: barId,
    version: 1,
    patterns: templateData.patterns,
    semantic_map: templateData.semantic_map,
    known_edge_cases: templateData.known_edge_cases,
    confidence_threshold: templateData.confidence_threshold,
    active: true,
    accuracy,
    created_at: new Date().toISOString(),
    receipt_samples_used: testReceipts.length,
  });
}
```

**Template Structure**:
```typescript
interface ParsingTemplate {
  id: string;
  venueId: string;
  version: number;
  confidenceThreshold: number; // e.g., 0.85
  patterns: {
    itemLine: string;    // "^(.{1,24})\\s+(\\d+)\\s+([\\d.]+)\\s+([\\d.]+)$"
    totalLine: string;   // "^TOTAL\\s+KES\\s+([\\d,.]+)$"
    taxLine: string;     // "^(?:VAT|LEVY|SERVICE).*?([\\d.]+)$"
    voidMarker: string;  // "\\*\\*VOID\\*\\*|CANCELLED|REFUND"
    discountLine: string; // "^(?:DISC|DISCOUNT|PROMO).*?-?([\\d.]+)$"
  };
  semanticMap: {
    itemLine: string[];  // ["name", "qty", "unit_price", "line_total"]
    currency: string;    // "KES"
    taxInclusive: boolean;
  };
  knownEdgeCases: string[]; // ["split_bill_header", "happy_hour_suffix", ...]
  active: boolean;
  accuracy: number;
  createdAt: string;
  receiptSamplesUsed: number;
}
```

### 6. AI Fallback Parser

**Purpose**: Handle edge cases that regex cannot parse with sufficient confidence.

**Claude Haiku / GPT-4o-mini Integration**:
```typescript
interface AIParser {
  model: 'claude-haiku' | 'gpt-4o-mini';
  maxTokens: number;
  temperature: number;
  
  parse(text: string, venueContext: VenueContext): Promise<ParseResult>;
  buildPrompt(text: string, venueContext: VenueContext): string;
  validateResponse(response: any): ParseResult;
}

interface VenueContext {
  currency: string;
  taxInclusive: boolean;
  knownEdgeCases: string[];
}

async function parse(text: string, venueContext: VenueContext): Promise<ParseResult> {
  const prompt = buildPrompt(text, venueContext);
  
  const response = await ai.chat({
    model: 'claude-haiku', // or 'gpt-4o-mini' - both are fast and cost-effective
    messages: [
      {
        role: 'system',
        content: 'You are a receipt parser. Extract line items, quantities, prices, subtotal, tax, and total from receipt text. Return JSON only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.1, // Low temperature for deterministic output
    max_tokens: 1000,
  });
  
  const parsed = JSON.parse(response.content);
  return validateResponse(parsed);
}

function buildPrompt(text: string, venueContext: VenueContext): string {
  return `Parse this receipt and return JSON with this structure:
{
  "items": [
    {
      "lineNumber": 1,
      "quantity": 2,
      "itemName": "Beer",
      "unitPrice": 250.00,
      "totalPrice": 500.00
    }
  ],
  "subtotal": 500.00,
  "tax": 80.00,
  "total": 580.00
}

Venue context:
- Currency: ${venueContext.currency}
- Tax inclusive: ${venueContext.taxInclusive}
- Known edge cases: ${venueContext.knownEdgeCases.join(', ')}

Receipt text:
${text}`;
}
```

**Cost Analysis**: At bar volumes (~200-300 receipts/night), with 95-99% handled by regex, AI fallback cost is negligible (2-10 receipts/night × $0.0001/receipt = $0.0002-0.001/night).

### 7. Receipt-to-Tab Linking

**Purpose**: Enable customers to claim receipts and link them to their open tabs without QR codes.

**How It Works**:
```
Customer opens Tabeza PWA
         │
         ▼
App shows: "Recent receipts at this venue"
┌─────────────────────────────────────────┐
│  20:14  —  KES 540   Beer × 3           │
│  20:09  —  KES 1,200  Chicken Wings...  │
│  19:58  —  KES 300   Tusker             │
└─────────────────────────────────────────┘
         │
Customer taps their receipt
         │
         ▼
"Assign to tab?" → Yes
         │
         ▼
Receipt linked to customer's open tab
Items appear in tab. Total updates.
Payment via M-Pesa now available.
```

**Why This Works Without QR Codes**:
- Customer is already checked in to a specific venue via their Tabeza session
- System knows: which venue they're at, that they have an open tab, the current time
- "Recent unclaimed receipts at this venue in the last 30 minutes" is a very short list (2-4 options)
- Identifying your receipt by time and amount is trivially easy

**Claim API**:
```typescript
interface ClaimReceiptRequest {
  receiptId: string;
  barId: string;
  tabId: string;
}

interface ClaimReceiptResponse {
  success: boolean;
  tab: {
    id: string;
    items: LineItem[];
    total: number;
    currency: string;
  };
}

// POST /api/receipts/claim
async function claimReceipt(req: ClaimReceiptRequest): Promise<ClaimReceiptResponse> {
  // Validation:
  // - Receipt must be UNCLAIMED
  // - Receipt must belong to this bar
  // - Tab must be OPEN
  // - Receipt timestamp within session window (last 30 minutes)
  
  const receipt = await db.pos_receipts.findOne({
    id: req.receiptId,
    bar_id: req.barId,
    status: 'UNCLAIMED',
  });
  
  if (!receipt) {
    throw new Error('Receipt not found or already claimed');
  }
  
  const tab = await db.tabs.findOne({
    id: req.tabId,
    bar_id: req.barId,
    status: 'open',
  });
  
  if (!tab) {
    throw new Error('Tab not found or closed');
  }
  
  // Atomic update: UNCLAIMED → CLAIMED
  await db.pos_receipts.update(
    { id: req.receiptId },
    {
      status: 'CLAIMED',
      claimed_by_tab_id: req.tabId,
      claimed_at: new Date().toISOString(),
    }
  );
  
  // Link receipt to tab
  await db.tab_pos_receipts.insert({
    tab_id: req.tabId,
    pos_receipt_id: req.receiptId,
    linked_at: new Date().toISOString(),
  });
  
  // Return updated tab
  const updatedTab = await getTabWithReceipts(req.tabId);
  
  return {
    success: true,
    tab: updatedTab,
  };
}
```

**Receipt States**:
```typescript
enum ReceiptStatus {
  CAPTURED = 'CAPTURED',       // Received from capture service, not yet parsed
  PARSING = 'PARSING',         // Currently being processed
  PARSED = 'PARSED',           // Structured data available, UNCLAIMED
  UNCLAIMED = 'UNCLAIMED',     // Visible in customer "Recent receipts"
  CLAIMED = 'CLAIMED',         // Linked to a customer tab
  PAID = 'PAID',               // Payment confirmed
  VOID = 'VOID',               // Marked void by staff (not claimable)
  PARSE_FAILED = 'PARSE_FAILED', // Regex and AI both failed (physical receipt only)
}
```

**Conflict Prevention**:
- A receipt can only be claimed once (atomic update)
- Claimed receipts are hidden from other customers' "Recent receipts" list
- If customer claims wrong receipt by mistake, staff can unclaim from dashboard

### 8. Self-Healing Template Engine

**Learning Event Storage**:
```typescript
interface TemplateLearningEvent {
  id: string;
  venueId: string;
  rawReceiptId: string;
  aiOutput: ParseResult;
  newPatternDetected: string | null;
  promotedToTemplate: boolean;
  createdAt: string;
}

async function storeLearningEvent(
  barId: string,
  receiptId: string,
  aiResult: ParseResult
): Promise<void> {
  await db.template_learning_events.insert({
    bar_id: barId,
    raw_receipt_id: receiptId,
    ai_output: aiResult,
    new_pattern_detected: null, // Will be set by background worker
    promoted_to_template: false,
    created_at: new Date().toISOString(),
  });
  
  // Background worker checks: has this pattern appeared 3+ times?
  // If yes, generate new regex pattern and create template version + 1
}
```

**Learning Loop**:
```
AI fallback succeeds on edge case
         │
         ▼
Store learning event in template_learning_events
         │
         ▼
Background worker checks: has this pattern appeared 3+ times?
         │
    ┌────┴────────────────────┐
   Yes                       No
    │                         │
    ▼                         ▼
Generate new regex       Store as known anomaly
pattern for this case    (don't pollute template)
    │
    ▼
Create template_version + 1
    │
    ▼
All future receipts use updated template
```

**Template Evolution Example**:
```
Version 1 → Initial template from onboarding (8 test receipts)
Version 2 → Added VAT line variant (detected after 3 AI fallbacks)
Version 3 → Added happy hour price suffix pattern
Version 4 → Added split bill header recognition
```

**Template Generation**:
```typescript
async function generateNewTemplate(venueId: string): Promise<void> {
  // 1. Load recent learning events
  const events = await db.template_learning_events
    .where({ venue_id: venueId })
    .orderBy('created_at', 'desc')
    .limit(20);
  
  // 2. Load corresponding raw receipts
  const receipts = await db.raw_receipts
    .whereIn('id', events.map(e => e.raw_receipt_id));
  
  // 3. Use AI to generate regex patterns
  const patterns = await generatePatternsFromExamples(receipts, events);
  
  // 4. Test new template against historical data
  const accuracy = await testTemplate(patterns, receipts, events);
  
  // 5. If accuracy improved by 5%+, activate new template
  const currentTemplate = await db.parsing_templates
    .where({ venue_id: venueId, active: true })
    .first();
  
  if (accuracy > (currentTemplate?.accuracy || 0) + 0.05) {
    await activateNewTemplate(venueId, patterns, accuracy);
  }
}

async function generatePatternsFromExamples(
  receipts: RawReceipt[],
  events: TemplateLearningEvent[]
): Promise<ParsingTemplate['patterns']> {
  // Use AI to analyze receipt patterns and generate regex
  const prompt = `Analyze these receipts and generate regex patterns for parsing:

${receipts.map((r, i) => `
Receipt ${i + 1}:
${r.text}

Parsed Output:
${JSON.stringify(events[i].aiOutput, null, 2)}
`).join('\n---\n')}

Generate regex patterns for:
1. Item line (quantity, name, price)
2. Subtotal
3. Tax
4. Total

Return as JSON with pattern strings.`;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a regex pattern generator for receipt parsing. Generate precise regex patterns.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.1,
  });
  
  const patterns = JSON.parse(response.choices[0].message.content);
  
  return {
    itemLine: new RegExp(patterns.itemLine),
    quantity: new RegExp(patterns.quantity),
    price: new RegExp(patterns.price),
    subtotal: new RegExp(patterns.subtotal),
    tax: new RegExp(patterns.tax),
    total: new RegExp(patterns.total),
  };
}
```

## Data Models

### Database Schema

**IMPORTANT**: This schema integrates with the existing Tabeza database structure. We use `bars` (not venues), `tab_orders` for Tabeza orders, and introduce new tables for POS receipt capture.

#### raw_pos_receipts (NEW)
```sql
CREATE TABLE raw_pos_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL, -- TabezaConnect device ID
  timestamp TIMESTAMPTZ NOT NULL,
  escpos_bytes TEXT, -- base64 encoded ESC/POS data
  text TEXT NOT NULL, -- converted text from ESC/POS
  metadata JSONB, -- {jobId, source, fileSize, printerName}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_raw_pos_receipts_bar ON raw_pos_receipts(bar_id);
CREATE INDEX idx_raw_pos_receipts_timestamp ON raw_pos_receipts(timestamp DESC);
CREATE INDEX idx_raw_pos_receipts_device ON raw_pos_receipts(device_id);

COMMENT ON TABLE raw_pos_receipts IS 'Immutable storage of raw POS receipt data captured from print spooler';
```

#### pos_receipts (NEW)
```sql
CREATE TYPE receipt_status AS ENUM (
  'CAPTURED',      -- Received from capture service, not yet parsed
  'PARSING',       -- Currently being processed
  'PARSED',        -- Structured data available
  'UNCLAIMED',     -- Visible in customer "Recent receipts"
  'CLAIMED',       -- Linked to a customer tab
  'PAID',          -- Payment confirmed
  'VOID',          -- Marked void by staff (not claimable)
  'PARSE_FAILED'   -- Regex and AI both failed (physical receipt only)
);

CREATE TABLE pos_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_receipt_id UUID NOT NULL REFERENCES raw_pos_receipts(id) ON DELETE CASCADE,
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  receipt_number TEXT, -- Extracted from receipt
  subtotal DECIMAL(10, 2) NOT NULL,
  tax DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  parsed_at TIMESTAMPTZ DEFAULT NOW(),
  confidence_score DECIMAL(3, 2) NOT NULL, -- 0.00 to 1.00
  parsing_method TEXT NOT NULL, -- 'regex' or 'ai'
  template_version INT, -- Version of template used
  status receipt_status NOT NULL DEFAULT 'PARSED',
  claimed_by_tab_id UUID REFERENCES tabs(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_receipts_bar ON pos_receipts(bar_id);
CREATE INDEX idx_pos_receipts_raw ON pos_receipts(raw_receipt_id);
CREATE INDEX idx_pos_receipts_tab ON pos_receipts(claimed_by_tab_id);
CREATE INDEX idx_pos_receipts_status ON pos_receipts(status);
CREATE INDEX idx_pos_receipts_confidence ON pos_receipts(confidence_score);
CREATE INDEX idx_pos_receipts_unclaimed ON pos_receipts(bar_id, status) WHERE status = 'UNCLAIMED';
CREATE INDEX idx_pos_receipts_timestamp ON pos_receipts(created_at DESC);

COMMENT ON TABLE pos_receipts IS 'Parsed POS receipts with structured data';
```

#### pos_receipt_items (NEW)
```sql
CREATE TABLE pos_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES pos_receipts(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  quantity INT NOT NULL,
  item_name TEXT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL
);

CREATE INDEX idx_pos_receipt_items_receipt ON pos_receipt_items(receipt_id);
CREATE INDEX idx_pos_receipt_items_line ON pos_receipt_items(receipt_id, line_number);
```

#### receipt_parsing_templates (NEW)
```sql
CREATE TABLE receipt_parsing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  version INT NOT NULL,
  patterns JSONB NOT NULL, -- {itemLine, totalLine, taxLine, voidMarker, discountLine}
  semantic_map JSONB NOT NULL, -- {itemLine: ["name", "qty", "unit_price", "line_total"], currency, taxInclusive}
  known_edge_cases JSONB, -- ["split_bill_header", "happy_hour_suffix", ...]
  confidence_threshold DECIMAL(3, 2) NOT NULL DEFAULT 0.85,
  active BOOLEAN DEFAULT FALSE,
  accuracy DECIMAL(3, 2), -- 0.00 to 1.00
  receipt_samples_used INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);

CREATE INDEX idx_parsing_templates_bar ON receipt_parsing_templates(bar_id);
CREATE INDEX idx_parsing_templates_active ON receipt_parsing_templates(bar_id, active);
CREATE INDEX idx_parsing_templates_version ON receipt_parsing_templates(bar_id, version DESC);

COMMENT ON TABLE receipt_parsing_templates IS 'Venue-specific regex templates for receipt parsing';
```

#### template_learning_events (NEW)
```sql
CREATE TABLE template_learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  raw_receipt_id UUID NOT NULL REFERENCES raw_pos_receipts(id) ON DELETE CASCADE,
  ai_output JSONB NOT NULL, -- Parsed result from AI
  new_pattern_detected TEXT,
  promoted_to_template BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_learning_events_bar ON template_learning_events(bar_id);
CREATE INDEX idx_learning_events_created ON template_learning_events(created_at DESC);
CREATE INDEX idx_learning_events_promoted ON template_learning_events(promoted_to_template);

COMMENT ON TABLE template_learning_events IS 'AI parsing events used for template evolution';
```

#### pos_parse_failures (NEW)
```sql
CREATE TABLE pos_parse_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_receipt_id UUID NOT NULL REFERENCES raw_pos_receipts(id) ON DELETE CASCADE,
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  template_version INT,
  regex_confidence DECIMAL(3, 2),
  ai_attempted BOOLEAN DEFAULT FALSE,
  ai_succeeded BOOLEAN DEFAULT FALSE,
  error_message TEXT NOT NULL,
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pos_parse_failures_bar ON pos_parse_failures(bar_id);
CREATE INDEX idx_pos_parse_failures_created ON pos_parse_failures(created_at DESC);
CREATE INDEX idx_pos_parse_failures_raw ON pos_parse_failures(raw_receipt_id);

COMMENT ON TABLE pos_parse_failures IS 'Failed parsing attempts for monitoring and improvement';
```

#### tab_pos_receipts (NEW - join table)
```sql
CREATE TABLE tab_pos_receipts (
  tab_id UUID NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  pos_receipt_id UUID NOT NULL REFERENCES pos_receipts(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tab_id, pos_receipt_id)
);

CREATE INDEX idx_tab_pos_receipts_tab ON tab_pos_receipts(tab_id);
CREATE INDEX idx_tab_pos_receipts_receipt ON tab_pos_receipts(pos_receipt_id);

COMMENT ON TABLE tab_pos_receipts IS 'Links POS receipts to customer tabs (a tab can have multiple receipts)';
```

### Relationship to Existing Tables

**Integration Points**:
- `bars` table: Existing venue table, referenced by all new receipt tables
- `tabs` table: Existing customer tab table, linked to POS receipts via `tab_pos_receipts`
- `tab_orders` table: Existing Tabeza-created orders (separate from POS receipts)
- `devices` table: Existing device tracking, `device_id` in `raw_pos_receipts` references this

**Key Distinction**:
- `tab_orders`: Orders created by Tabeza (staff or customer) when `authority_mode = 'tabeza'`
- `pos_receipts`: Receipts captured from POS when `authority_mode = 'pos'`
- A tab can have EITHER `tab_orders` OR `pos_receipts`, never both (enforced by authority mode)

### TypeScript Interfaces

```typescript
interface RawPOSReceipt {
  id: string;
  barId: string;
  deviceId: string;
  timestamp: string;
  escposBytes: string | null; // base64
  text: string;
  metadata: {
    jobId: string;
    source: 'spool-monitor' | 'manual';
    fileSize: number;
    printerName?: string;
  };
  createdAt: string;
}

interface POSReceipt {
  id: string;
  rawReceiptId: string;
  barId: string;
  receiptNumber: string | null;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  parsedAt: string;
  confidenceScore: number; // 0-1
  parsingMethod: 'regex' | 'ai';
  templateVersion: number | null;
  status: ReceiptStatus;
  claimedByTabId: string | null;
  claimedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

enum ReceiptStatus {
  CAPTURED = 'CAPTURED',
  PARSING = 'PARSING',
  PARSED = 'PARSED',
  UNCLAIMED = 'UNCLAIMED',
  CLAIMED = 'CLAIMED',
  PAID = 'PAID',
  VOID = 'VOID',
  PARSE_FAILED = 'PARSE_FAILED',
}

interface POSReceiptItem {
  id: string;
  receiptId: string;
  lineNumber: number;
  quantity: number;
  itemName: string;
  unitPrice: number;
  totalPrice: number;
}

interface ReceiptParsingTemplate {
  id: string;
  barId: string;
  version: number;
  patterns: {
    itemLine: string;
    totalLine: string;
    taxLine: string;
    voidMarker: string;
    discountLine: string;
  };
  semanticMap: {
    itemLine: string[]; // ["name", "qty", "unit_price", "line_total"]
    currency: string;
    taxInclusive: boolean;
  };
  knownEdgeCases: string[];
  confidenceThreshold: number;
  active: boolean;
  accuracy: number | null;
  receiptSamplesUsed: number | null;
  createdAt: string;
  activatedAt: string | null;
}
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property Reflection

After analyzing all acceptance criteria, I identified several redundant properties that can be consolidated:
- Properties 2.5 and 5.5 both test queue persistence across reboots → Consolidate into one property
- Properties 2.4 and 6.3 both test exponential backoff retry → Consolidate into one property
- Properties 5.4 and 6.5 both test queue cleanup after upload → Consolidate into one property
- Properties 8.3 and 12.3 both test regex parsing performance → Consolidate into one property
- Properties 8.6 and 9.1 both test AI fallback trigger → Consolidate into one property
- Properties 19.1, 19.2, and 19.3 all test round-trip parsing → Consolidate into one comprehensive property

### Core System Properties

#### Property 1: Non-Blocking Print Path
*For any* POS print job, the printer SHALL receive and complete the print without any delay or dependency on Tabeza services, ensuring printing continues even if Tabeza is completely offline.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

#### Property 2: Asynchronous Capture Independence
*For any* print job completion, the Capture_Service SHALL capture receipt data asynchronously without blocking the print process, ensuring capture latency does not affect printing.

**Validates: Requirements 2.1, 6.4**

#### Property 3: Offline Queue Persistence
*For any* captured receipt, if internet connectivity is unavailable, the receipt SHALL be stored in the Local_Queue and SHALL persist across system reboots and service restarts, ensuring no data loss during outages.

**Validates: Requirements 2.2, 2.5, 2.6, 5.5**

#### Property 4: Upload Recovery with Exponential Backoff
*For any* failed upload attempt, the Upload_Worker SHALL retry with exponential backoff (5s, 10s, 20s, 40s), and when connectivity is restored, all queued receipts SHALL be uploaded successfully.

**Validates: Requirements 2.3, 2.4, 6.3**

#### Property 5: Queue Cleanup After Upload
*For any* receipt successfully uploaded to the cloud, the Capture_Service SHALL remove it from the Local_Queue, ensuring the queue only contains pending receipts.

**Validates: Requirements 5.4, 6.5**

#### Property 6: Spool File Detection Latency
*For any* new .SPL or .SHD file appearing in the print spooler directory, the Capture_Service SHALL detect it within 500ms and wait for write completion before processing.

**Validates: Requirements 3.2, 3.3**

#### Property 7: Format Extraction Priority
*For any* print job, the Capture_Service SHALL attempt ESC/POS byte extraction first, then text extraction as fallback, preserving the format hierarchy.

**Validates: Requirements 3.4, 3.5, 4.1, 4.2**

#### Property 8: ESC/POS to Text Conversion Fidelity
*For any* ESC/POS byte sequence, the Capture_Service SHALL convert it to ASCII text while preserving line breaks and spacing, and SHALL store both raw bytes and converted text.

**Validates: Requirements 4.3, 4.4, 4.5**

#### Property 9: Local Queue Data Completeness
*For any* captured receipt, the Local_Queue JSON file SHALL include receipt ID, venue ID, timestamp, ESC/POS data (if available), and text, ensuring all required fields are present.

**Validates: Requirements 5.2, 5.3**

#### Property 10: Cloud Ingestion Performance
*For any* receipt ingestion request, the Cloud_API SHALL save the receipt to raw_receipts table and return a success response within 100ms, without performing inline parsing.

**Validates: Requirements 7.2, 7.3, 7.5**

#### Property 11: Asynchronous Parsing Queue
*For any* ingested receipt, the Cloud_API SHALL queue it for parsing asynchronously, ensuring ingestion and parsing are decoupled.

**Validates: Requirements 7.4**

#### Property 12: Regex Parsing Performance and Confidence
*For any* standard receipt, the Regex_Parser SHALL complete parsing within 5ms and calculate a confidence score based on pattern matches, saving the structured receipt if confidence ≥ 80%.

**Validates: Requirements 8.2, 8.3, 8.4, 8.5, 12.3**

#### Property 13: AI Fallback Trigger
*For any* receipt with regex confidence score < 80%, the Parsing_Orchestrator SHALL invoke the AI_Parser to attempt parsing.

**Validates: Requirements 8.6, 9.1**

#### Property 14: AI Parser Format Consistency
*For any* receipt parsed by the AI_Parser, the output SHALL match the same structured format as the Regex_Parser (items, quantities, prices, subtotal, tax, total), ensuring parser interchangeability.

**Validates: Requirements 9.3, 9.4**

#### Property 15: Learning Event Storage
*For any* successful AI parse, the Parsing_Orchestrator SHALL store a learning event in template_learning_events, enabling template evolution.

**Validates: Requirements 10.1**

#### Property 16: Template Generation Threshold
*For any* venue with 10 or more learning events, the Parsing_Orchestrator SHALL generate and test a new template version, activating it if accuracy improves by 5% or more.

**Validates: Requirements 10.2, 10.3, 10.4, 10.5**

#### Property 17: Raw Receipt Immutability
*For any* raw receipt stored in the raw_receipts table, the data SHALL never be modified after initial insert, ensuring original receipts are preserved for auditing and reprocessing.

**Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**

#### Property 18: End-to-End Receipt Delivery Performance
*For any* printed receipt, the system SHALL deliver the structured receipt to the customer PWA within 30ms for regex-parsed receipts and within 300ms for AI-parsed receipts.

**Validates: Requirements 12.1, 12.2, 12.4, 12.5**

#### Property 19: Parse Failure Tracking
*For any* parsing failure, the Parsing_Orchestrator SHALL store the failure in parse_failures table with receipt ID, venue ID, error message, and timestamp, and SHALL alert administrators when a venue has 5 or more failures.

**Validates: Requirements 13.1, 13.2, 13.5**

#### Property 20: Parse Failure Retry After Template Update
*For any* failed receipt, when a new template version is activated for the venue, the Parsing_Orchestrator SHALL retry parsing the failed receipt.

**Validates: Requirements 13.3**

#### Property 21: Round-Trip Parsing Correctness
*For any* valid structured receipt, formatting it back to text then parsing again SHALL produce an equivalent structured receipt with the same line items, quantities, prices, subtotal, tax, and total.

**Validates: Requirements 19.1, 19.2, 19.3**

#### Property 22: Round-Trip Validation for Template Testing
*For any* new template version, the Template_Learning system SHALL use round-trip validation against historical receipts, and SHALL flag templates that produce different values during round-trip.

**Validates: Requirements 19.4, 19.5**

#### Property 23: POS-Agnostic Printer Compatibility
*For any* printer that outputs to the Windows print spooler (thermal, network, USB, or virtual), the Capture_Service SHALL successfully capture receipts without requiring POS-specific drivers or plugins.

**Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5**

### UI and Integration Properties

#### Property 24: Staff Receipt Display Completeness
*For any* parsed receipt displayed in the Staff_App, the UI SHALL show all line items, totals, confidence score, and parsing errors (if any).

**Validates: Requirements 15.2, 15.4**


## Error Handling

### Capture Service Error Handling

**Print Spooler Access Errors**:
```typescript
try {
  const files = await fs.readdir(SPOOL_PATH);
} catch (error) {
  if (error.code === 'EACCES') {
    console.error('Permission denied accessing print spooler. Run as Administrator.');
    // Continue running, retry on next poll
  } else if (error.code === 'ENOENT') {
    console.error('Print spooler directory not found. Check Windows configuration.');
    // Fatal error - exit service
    process.exit(1);
  }
}
```

**File Processing Errors**:
```typescript
try {
  const receipt = await processPrintFile(filePath);
  await localQueue.enqueue(receipt);
} catch (error) {
  console.error(`Failed to process ${filePath}:`, error);
  // Move file to error folder for manual review
  await moveToErrorFolder(filePath);
  // Log error to local error log
  await logError({
    type: 'file_processing_error',
    file: filePath,
    error: error.message,
    timestamp: new Date().toISOString(),
  });
}
```

**Upload Errors**:
```typescript
async function uploadWithRetry(receipt: RawReceipt, attempt: number = 1): Promise<void> {
  try {
    await uploadToCloud(receipt);
    await localQueue.markUploaded(receipt.id);
  } catch (error) {
    if (attempt >= MAX_RETRIES) {
      console.error(`Upload failed after ${MAX_RETRIES} attempts:`, error);
      // Keep in queue, will retry on next service restart
      return;
    }
    
    const delay = BASE_DELAY * Math.pow(2, attempt - 1);
    console.log(`Upload failed, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`);
    
    await sleep(delay);
    await uploadWithRetry(receipt, attempt + 1);
  }
}
```

### Cloud API Error Handling

**Ingestion Errors**:
```typescript
app.post('/api/receipts/ingest', async (req, res) => {
  try {
    // Validate request
    if (!req.body.venueId || !req.body.text) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: venueId, text',
      });
    }
    
    // Save to database
    const receiptId = await db.raw_receipts.insert(req.body);
    
    // Queue for parsing
    await queue.add('parse-receipt', { receiptId });
    
    res.json({ success: true, receiptId });
  } catch (error) {
    console.error('Ingestion error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});
```

**Parsing Errors**:
```typescript
async function parseReceipt(receiptId: string): Promise<void> {
  try {
    const raw = await db.raw_receipts.findById(receiptId);
    const template = await loadTemplate(raw.venue_id);
    
    // Try regex parsing
    const result = await regexParser.parse(raw.text, template);
    
    if (result.confidence >= 0.80) {
      await storeStructuredReceipt(receiptId, result);
    } else {
      // Try AI parsing
      try {
        const aiResult = await aiParser.parse(raw.text);
        await storeStructuredReceipt(receiptId, aiResult);
        await storeLearningEvent(raw.venue_id, receiptId, aiResult);
      } catch (aiError) {
        // Both parsers failed
        await db.parse_failures.insert({
          raw_receipt_id: receiptId,
          venue_id: raw.venue_id,
          error_message: `Regex confidence: ${result.confidence}, AI error: ${aiError.message}`,
          error_details: {
            regexResult: result,
            aiError: aiError.message,
          },
          created_at: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    console.error(`Parse error for receipt ${receiptId}:`, error);
    await db.parse_failures.insert({
      raw_receipt_id: receiptId,
      venue_id: raw?.venue_id || 'unknown',
      error_message: error.message,
      created_at: new Date().toISOString(),
    });
  }
}
```

**AI API Errors**:
```typescript
async function callOpenAI(text: string): Promise<ParseResult> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [...],
      timeout: 10000, // 10 second timeout
    });
    
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    if (error.code === 'ETIMEDOUT') {
      throw new Error('OpenAI API timeout');
    } else if (error.status === 429) {
      // Rate limit - wait and retry
      await sleep(5000);
      return callOpenAI(text);
    } else if (error.status === 500) {
      throw new Error('OpenAI API server error');
    } else {
      throw error;
    }
  }
}
```

### Database Error Handling

**Connection Errors**:
```typescript
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // Retry connection on failure
  retry: {
    max: 3,
    timeout: 5000,
  },
});

db.on('error', (err) => {
  console.error('Database connection error:', err);
  // Don't crash - connection pool will retry
});
```

**Transaction Errors**:
```typescript
async function storeStructuredReceipt(
  receiptId: string,
  result: ParseResult
): Promise<void> {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    // Insert receipt
    const receipt = await client.query(
      'INSERT INTO receipts (...) VALUES (...) RETURNING id',
      [...]
    );
    
    // Insert line items
    for (const item of result.items) {
      await client.query(
        'INSERT INTO receipt_items (...) VALUES (...)',
        [receipt.id, ...]
      );
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

## Testing Strategy

### Dual Testing Approach

This system requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Verify specific examples, edge cases, and error conditions
- Specific receipt formats (ESC/POS, text, image)
- Error handling paths (network failures, file access errors)
- Integration points (database, OpenAI API, queue system)
- Edge cases (empty receipts, malformed data, missing fields)

**Property-Based Tests**: Verify universal properties across all inputs
- Round-trip parsing correctness
- Queue persistence across restarts
- Upload retry with exponential backoff
- Parsing performance guarantees
- Format extraction priority

Together, unit tests catch concrete bugs while property tests verify general correctness.

### Property-Based Testing Configuration

**Testing Library**: fast-check (JavaScript/TypeScript)

**Configuration**:
- Minimum 100 iterations per property test
- Each test must reference its design document property
- Tag format: `Feature: pos-receipt-capture-transformation, Property {number}: {property_text}`

**Example Property Test**:
```typescript
import fc from 'fast-check';

// Feature: pos-receipt-capture-transformation, Property 21: Round-Trip Parsing Correctness
describe('Round-trip parsing correctness', () => {
  it('should preserve receipt data through parse-format-parse cycle', async () => {
    await fc.assert(
      fc.asyncProperty(
        receiptGenerator(), // Generates random valid receipts
        async (receipt) => {
          // Parse receipt
          const parsed1 = await regexParser.parse(receipt.text, template);
          
          // Format back to text
          const formatted = formatReceipt(parsed1);
          
          // Parse again
          const parsed2 = await regexParser.parse(formatted, template);
          
          // Should be equivalent
          expect(parsed2.items).toEqual(parsed1.items);
          expect(parsed2.subtotal).toBeCloseTo(parsed1.subtotal, 2);
          expect(parsed2.tax).toBeCloseTo(parsed1.tax, 2);
          expect(parsed2.total).toBeCloseTo(parsed1.total, 2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Testing Strategy

**Capture Service Tests**:
```typescript
describe('Spool Monitor', () => {
  it('should detect new .SPL files within 500ms', async () => {
    const monitor = new SpoolMonitor(testSpoolPath);
    const detected = jest.fn();
    monitor.on('file-detected', detected);
    
    // Create test file
    const startTime = Date.now();
    await fs.writeFile(path.join(testSpoolPath, 'test.SPL'), 'test data');
    
    // Wait for detection
    await waitFor(() => detected.mock.calls.length > 0, { timeout: 1000 });
    
    const detectionTime = Date.now() - startTime;
    expect(detectionTime).toBeLessThan(500);
  });
  
  it('should handle permission denied errors gracefully', async () => {
    const monitor = new SpoolMonitor('/restricted/path');
    
    // Should not crash
    await expect(monitor.start()).resolves.not.toThrow();
  });
});
```

**Parsing Tests**:
```typescript
describe('Regex Parser', () => {
  it('should parse standard receipt format', async () => {
    const receipt = `
      Beer     2    500.00
      Chips    1    150.00
      ----------------------
      Subtotal      650.00
      Tax (16%)     104.00
      ----------------------
      TOTAL         754.00
    `;
    
    const result = await regexParser.parse(receipt, standardTemplate);
    
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({
      lineNumber: 1,
      quantity: 2,
      itemName: 'Beer',
      unitPrice: 250.00,
      totalPrice: 500.00,
    });
    expect(result.subtotal).toBe(650.00);
    expect(result.tax).toBe(104.00);
    expect(result.total).toBe(754.00);
    expect(result.confidence).toBeGreaterThan(0.80);
  });
  
  it('should return low confidence for malformed receipts', async () => {
    const receipt = 'invalid receipt data';
    
    const result = await regexParser.parse(receipt, standardTemplate);
    
    expect(result.confidence).toBeLessThan(0.80);
  });
});
```

**Integration Tests**:
```typescript
describe('End-to-end receipt flow', () => {
  it('should capture, upload, parse, and deliver receipt', async () => {
    // 1. Simulate print job
    await fs.writeFile(
      path.join(testSpoolPath, 'receipt.SPL'),
      testReceiptData
    );
    
    // 2. Wait for capture
    await waitFor(() => localQueue.getQueueSize() > 0);
    
    // 3. Wait for upload
    await waitFor(() => localQueue.getQueueSize() === 0);
    
    // 4. Wait for parsing
    const receipt = await waitFor(() => 
      db.receipts.findOne({ raw_receipt_id: receiptId })
    );
    
    // 5. Verify receipt delivered to customer
    expect(receipt).toBeDefined();
    expect(receipt.confidence_score).toBeGreaterThan(0.80);
  });
});
```

### Performance Testing

**Latency Benchmarks**:
```typescript
describe('Performance benchmarks', () => {
  it('should capture receipt within 5ms', async () => {
    const startTime = performance.now();
    await captureService.processFile(testFile);
    const duration = performance.now() - startTime;
    
    expect(duration).toBeLessThan(5);
  });
  
  it('should parse with regex within 5ms', async () => {
    const startTime = performance.now();
    await regexParser.parse(testReceipt, template);
    const duration = performance.now() - startTime;
    
    expect(duration).toBeLessThan(5);
  });
  
  it('should deliver receipt to customer within 30ms', async () => {
    const startTime = performance.now();
    
    // Full flow: capture → upload → parse → deliver
    await endToEndFlow(testReceipt);
    
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(30);
  });
});
```

### Test Coverage Goals

- **Capture Service**: 90% code coverage
- **Parsing Logic**: 95% code coverage (critical path)
- **API Endpoints**: 85% code coverage
- **Error Handling**: 100% coverage of error paths
- **Property Tests**: All 24 correctness properties implemented


### Platform Scope

The Capture Service is Windows-first, reflecting the reality that the majority of hospitality POS machines in target markets run Windows.

| Platform | Status |
|----------|--------|
| Windows 10/11 | Supported (v1.0) |
| Windows Server | Supported (v1.0) |
| iPad / iOS POS | Roadmap (network print intercept) |
| Android POS | Roadmap |
| Linux/Mac | Not planned |

For non-Windows venues, the fallback is the manual receipt claim flow (customer manually enters receipt details).

### End-to-End Timing Model

```
0 ms     POS sends print job
1 ms     Thermal printer receives job — receipt prints
5 ms     Capture service reads SPL file, saves locally
20 ms    Uploaded to cloud ingestion API
25 ms    Queued for parsing
30 ms    Regex parsing complete → receipt.status = PARSED
~30 ms   Receipt appears in customer "Recent receipts"

--- Edge cases ---
300 ms   AI fallback parsing complete (rare)

--- Both fail ---
∞        Physical receipt exists. Customer unaffected.
```

### Failure Safety Model

| Scenario | Result |
|----------|--------|
| Internet offline at venue | Local queue holds receipts, uploads when reconnected |
| Cloud API down | Same as above |
| AI unavailable | Regex handles 95-99%; rest logged as failures |
| Regex fails, AI succeeds | Structured receipt available, template learns |
| Both fail | Physical receipt is the receipt. No disruption. |
| Customer claims wrong receipt | Staff can unclaim from dashboard |
| Capture service crashes | POS and printer unaffected. Receipts missed until restart. |

