# Receipt Parsing Flow - When DeepSeek AI & Regex Fallback Are Used

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. POS SYSTEM PRINTS                                                │
│    - POS sends print job to "Tabeza Receipt Printer"               │
│    - Windows routes to virtual printer (Print to File)             │
│    - File saved to: C:\Users\[user]\TabezaPrints\receipt.prn       │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. PRINTER SERVICE DETECTS FILE                                     │
│    Location: packages/printer-service/index.js                      │
│    - Chokidar file watcher detects new .prn file                   │
│    - Reads raw print data (ESC/POS commands + text)                │
│    - Converts to Base64                                             │
│    - NO PARSING YET - just raw data                                │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. SEND TO CLOUD API                                                │
│    Endpoint: POST /api/printer/relay                                │
│    Location: apps/staff/app/api/printer/relay/route.ts             │
│    Payload: {                                                       │
│      driverId: "driver-DESKTOP-123-1234567890",                    │
│      barId: "uuid-of-bar",                                         │
│      rawData: "base64-encoded-print-data",                         │
│      printerName: "Tabeza Receipt Printer",                        │
│      documentName: "receipt.prn",                                  │
│      parsedData: null  ← NO PARSING YET                            │
│    }                                                                │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. CLOUD API RECEIVES & PARSES                                      │
│    Location: apps/staff/app/api/printer/relay/route.ts (line 38+)  │
│                                                                     │
│    Step 4a: Check if parsedData provided                           │
│    ├─ If parsedData exists → Use it (skip parsing)                │
│    └─ If parsedData is null → PARSE NOW ⚠️                         │
│                                                                     │
│    Step 4b: Decode Base64 to text                                  │
│    const decodedData = Buffer.from(rawData, 'base64')              │
│                        .toString('utf-8');                          │
│                                                                     │
│    Step 4c: Call parseReceipt() function                           │
│    finalParsedData = await parseReceipt(                           │
│      decodedData,    ← Raw receipt text                            │
│      barId,          ← For logging                                 │
│      documentName    ← For logging                                 │
│    );                                                               │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. DEEPSEEK AI PARSER (FIRST ATTEMPT)                              │
│    Location: packages/shared/services/receiptParser.ts             │
│    Function: parseWithDeepSeek()                                    │
│                                                                     │
│    ✅ IF DEEPSEEK_API_KEY is set in .env:                          │
│    ├─ Initialize OpenAI client with DeepSeek endpoint              │
│    ├─ Send receipt text to DeepSeek API                            │
│    ├─ Request: model='deepseek-chat', JSON response format         │
│    ├─ Timeout: 10 seconds max                                      │
│    ├─ Temperature: 0.1 (deterministic)                             │
│    └─ Returns: { items: [...], total: 1050.00, receiptNumber }    │
│                                                                     │
│    ❌ IF DEEPSEEK_API_KEY not set:                                 │
│    └─ Skip DeepSeek, go directly to regex fallback                 │
│                                                                     │
│    ⚠️ IF DEEPSEEK FAILS (timeout, error, invalid response):        │
│    └─ Fall back to regex parser                                    │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 6. REGEX FALLBACK PARSER (IF DEEPSEEK FAILS)                       │
│    Location: packages/shared/services/receiptParser.ts             │
│    Function: parseWithRegex()                                       │
│                                                                     │
│    Pattern Matching:                                                │
│    ├─ Detect items section: "QTY", "ITEM", "AMOUNT"               │
│    ├─ Parse item lines:                                            │
│    │  • Pattern 1: "2    Tusker Lager 500ml       500.00"         │
│    │  • Pattern 2: "Item Name    $10.00"                          │
│    ├─ Extract total: "TOTAL: 1050.00"                             │
│    └─ Extract receipt number: "Receipt #: RCP-123456"             │
│                                                                     │
│    Returns: { items: [...], total: 1050.00, receiptNumber }       │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 7. STORE IN DATABASE                                                │
│    Table: print_jobs                                                │
│    {                                                                │
│      id: "uuid",                                                   │
│      bar_id: "uuid",                                               │
│      raw_data: "base64...",                                        │
│      parsed_data: {                                                │
│        items: [                                                    │
│          { name: "Tusker Lager 500ml", price: 250.00 },          │
│          { name: "Nyama Choma", price: 800.00 }                   │
│        ],                                                          │
│        total: 1050.00,                                            │
│        receiptNumber: "RCP-123456",                               │
│        rawText: "full receipt text..."                            │
│      },                                                            │
│      status: "no_match",  ← Appears in Captain's Orders           │
│      received_at: "2024-01-15T10:30:00Z"                          │
│    }                                                               │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 8. CAPTAIN'S ORDERS DISPLAYS                                        │
│    Component: apps/staff/components/printer/CaptainsOrders.tsx     │
│    - Shows parsed items from parsed_data.items                     │
│    - Shows total from parsed_data.total                            │
│    - Staff clicks "Assign to Tab"                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 9. ASSIGN TO TAB                                                    │
│    Endpoint: POST /api/printer/assign-receipt                      │
│    Location: apps/staff/app/api/printer/assign-receipt/route.ts    │
│                                                                     │
│    Transform items for tab_order:                                  │
│    receiptItems.map(item => ({                                     │
│      name: item.name,           ← From parsed_data                │
│      quantity: 1,               ← Assume 1 (POS doesn't have qty) │
│      total: item.price || 0     ← From parsed_data                │
│    }))                                                             │
│                                                                     │
│    Create tab_order:                                               │
│    {                                                               │
│      tab_id: "selected-tab-uuid",                                 │
│      items: [...transformed items...],                            │
│      total: 1050.00,                                              │
│      status: "pending",                                           │
│      initiated_by: "staff"                                        │
│    }                                                               │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 10. CUSTOMER SEES ORDER                                             │
│     - Order appears in customer app as "pending"                   │
│     - Shows items from tab_order.items                             │
│     - Customer must approve before it's confirmed                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Summary: When Each Parser Runs

### DeepSeek AI Parser
**Runs:** In step 5, when cloud API receives the print job
**Triggers when:**
- `DEEPSEEK_API_KEY` is set in `.env`
- Receipt text is decoded from base64
- `parseReceipt()` is called

**Advantages:**
- ✅ Handles complex receipt formats
- ✅ Understands context (e.g., "2x Tusker" vs "Tusker x2")
- ✅ Ignores headers/footers automatically
- ✅ More accurate item extraction

**Limitations:**
- ⏱️ 10-second timeout
- 💰 Costs per API call (very cheap though)
- 🌐 Requires internet connection

### Regex Fallback Parser
**Runs:** In step 6, when DeepSeek fails or is unavailable
**Triggers when:**
- `DEEPSEEK_API_KEY` is not set, OR
- DeepSeek API times out (>10s), OR
- DeepSeek returns invalid JSON, OR
- DeepSeek API is down

**Advantages:**
- ✅ No API key needed
- ✅ Works offline
- ✅ Instant (no network delay)
- ✅ Free

**Limitations:**
- ⚠️ Pattern matching only
- ⚠️ May miss complex formats
- ⚠️ Requires specific receipt structure

## Current Issue

Based on your report that "there are no order items, just a total", the problem is likely:

1. **Parsing is working** (you see the total)
2. **Items array is empty or malformed** (no items displayed)

This could mean:
- DeepSeek/regex extracted the total but not the items
- Items are in wrong format in `parsed_data`
- Items transformation in assign-receipt API is failing

## Next Steps

Run this to check what's actually in the database:
```bash
# From project root
node dev-tools/scripts/check-tab-order-items.js
```

This will show you:
- What items are stored in `tab_orders.items`
- If items array is empty
- If items have correct structure (name, quantity, total)
