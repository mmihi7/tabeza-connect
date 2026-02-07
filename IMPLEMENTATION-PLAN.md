# POS-to-Tab Integration Implementation Plan

## Goal
Connect any POS system to Tabeza and automatically deliver receipts to customer tabs.

## Current Status
- ✅ Printer service running (monitors folder)
- ✅ Printer installed (TABEZA Virtual Printer)
- ⚠️ Database tables not created yet
- ⚠️ Receipt parsing not implemented
- ⚠️ Tab matching not implemented

## Implementation Steps

### Step 1: Apply Database Migration ✅
Create tables for print jobs and digital receipts.

**Action:** Run `database/add-printer-relay-tables.sql` in Supabase SQL Editor

**Tables Created:**
- `print_jobs` - Raw print data from POS
- `digital_receipts` - Parsed receipts delivered to customers
- `print_job_stats` - Statistics view

### Step 2: Enhance Printer Relay API ⏳
Update `/api/printer/relay` to:
- Store print jobs in database
- Parse receipt data
- Match to customer tabs
- Create digital receipts

### Step 3: Build Receipt Parser ⏳
Create parser to extract:
- Items and prices
- Total amount
- Receipt number
- Timestamp
- Table number (if present)

### Step 4: Implement Tab Matching ⏳
Match receipts to tabs using:
- Table number (if available)
- Amount matching
- Timestamp proximity
- Manual staff selection (fallback)

### Step 5: Test Complete Flow ⏳
1. Print from POS → File appears in folder
2. Service detects → Sends to cloud
3. API parses → Matches to tab
4. Receipt delivered → Customer sees it

## Technical Architecture

```
┌─────────────┐
│  POS System │
└──────┬──────┘
       │ Print
       ▼
┌─────────────────────┐
│ TABEZA Virtual      │
│ Printer (Windows)   │
└──────┬──────────────┘
       │ Output to Folder
       ▼
┌─────────────────────┐
│ C:\Users\mwene\     │
│ TabezaPrints\       │
└──────┬──────────────┘
       │ File Detected
       ▼
┌─────────────────────┐
│ Tabeza Printer      │
│ Service (Node.js)   │
└──────┬──────────────┘
       │ POST /api/printer/relay
       ▼
┌─────────────────────┐
│ Cloud API           │
│ - Parse receipt     │
│ - Match to tab      │
│ - Store in DB       │
└──────┬──────────────┘
       │ Create digital_receipt
       ▼
┌─────────────────────┐
│ Customer Tab        │
│ (Real-time update)  │
└─────────────────────┘
```

## Files to Modify

1. `apps/staff/app/api/printer/relay/route.ts` - Main relay endpoint
2. `packages/shared/lib/services/receipt-parser.ts` - NEW: Parse print data
3. `packages/shared/lib/services/tab-matcher.ts` - NEW: Match receipts to tabs
4. `apps/staff/app/api/printer/match-tab/route.ts` - NEW: Manual tab matching

## Next Actions

1. ✅ Apply database migration
2. ⏳ Create receipt parser
3. ⏳ Create tab matcher
4. ⏳ Update relay API
5. ⏳ Test end-to-end flow
