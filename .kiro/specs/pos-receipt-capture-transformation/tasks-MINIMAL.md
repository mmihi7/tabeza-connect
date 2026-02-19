# POS Receipt Capture - MINIMAL Implementation Plan

## What's Already Complete ✅

### Phase 1: Database Schema ✅
- [x] 1.1 Create POS receipt tables (raw_pos_receipts, pos_receipts, pos_receipt_items)
- [x] 1.2 Create parsing template tables (receipt_parsing_templates)
- [x] 1.3 Create tab-receipt linking table (tab_pos_receipts)
- [x] 1.4 Run database migrations

### Phase 2: TabezaConnect Capture Service ✅
- [x] 2.1 Remove blocking print relay
- [x] 2.2 Implement Windows print spooler monitoring
- [x] 2.3 Implement ESC/POS byte extraction and conversion
- [x] 2.4 Implement local persistent queue
- [x] 2.5 Implement async upload worker

**Status**: Capture pipeline is PRODUCTION READY. All 73+ unit tests passing.

---

## What's Left To Do ⏳

### Phase 3: Cloud Receipt Ingestion & Parsing

- [ ] 3.1 Create cloud ingestion endpoint
  - Implement `POST /api/receipts/ingest` in Next.js API routes
  - Accept: barId, deviceId, timestamp, escposBytes (base64), text, metadata
  - Validate required fields (barId, text)
  - Save to `raw_pos_receipts` table immediately (< 100ms)
  - Return success response with receipt ID
  - Never parse inline (async only)

- [ ] 3.2 Create Supabase Edge Function for parsing
  - Create `supabase/functions/parse-receipt/index.ts`
  - Load raw receipt from `raw_pos_receipts`
  - Load bar template from `receipt_parsing_templates`
  - Try regex parser first (< 5ms)
  - Fallback to AI if confidence < 85%
  - Save to `pos_receipts` + `pos_receipt_items` if successful
  - Set status: 'UNCLAIMED' (success) or 'PARSE_FAILED' (both fail)

- [ ] 3.3 Create database trigger
  - Create `trigger_receipt_parsing()` function
  - Use pg_net.http_post to call Edge Function
  - Trigger on INSERT to `raw_pos_receipts`
  - Pass receipt_id to Edge Function

### Phase 4: Regex Parser

- [ ] 4.1 Implement regex parser core
  - Load bar templates from database
  - Apply regex patterns to extract line items
  - Extract totals (subtotal, tax, total)
  - Complete within 5ms
  - Handle edge cases from template

- [ ] 4.2 Implement confidence scoring
  - Calculate confidence: items found (1pt each), totals (2pts)
  - Reconciliation check: sum(items) = total (±0.01)
  - Return confidence ratio (0.00-1.00)

- [ ] 4.3 Implement conditional save
  - Save if confidence ≥ 85%
  - Trigger AI fallback if < 85%
  - Use database transactions
  - Store parsing_method, template_version, confidence_score

### Phase 5: AI Fallback Parser

- [ ] 5.1 Implement Claude Haiku integration
  - Set up Anthropic API client
  - Build prompt with receipt text + bar context
  - Parse AI response to extract structured data
  - Handle errors: timeout (10s), rate limit, server errors
  - Temperature: 0.1 (deterministic)

- [ ] 5.2 Implement format validation
  - Ensure AI output matches regex format
  - Validate required fields: items, subtotal, tax, total
  - Validate data types and ranges
  - Reject invalid responses

- [ ] 5.3 Implement success handling
  - Save to `pos_receipts` + `pos_receipt_items`
  - Store learning event in `template_learning_events`
  - Set parsing_method: 'ai'
  - Set status: 'UNCLAIMED'

### Phase 6: Staff Dashboard - Receipt Management

- [ ] 6.1 Staff dashboard - Unclaimed receipts view
  - Display unclaimed receipts for bar (real-time)
  - Show: time, total, currency, confidence, parsing method
  - Show item preview (first 2-3 items)
  - Real-time updates via Supabase Realtime
  - Show notification when new receipt arrives

- [ ] 6.2 Receipt assignment API
  - `POST /api/receipts/assign`
  - Validate receipt is UNCLAIMED and belongs to bar
  - Validate tab is OPEN and belongs to bar
  - Atomically update status: UNCLAIMED → CLAIMED
  - Set claimed_by_tab_id, claimed_at, assigned_by_staff_id
  - Log in audit_logs

- [ ] 6.3 Receipt deletion API
  - `DELETE /api/receipts/:id`
  - Validate receipt is UNCLAIMED (cannot delete claimed)
  - Soft delete: update status to 'VOID'
  - Set voided_at, voided_by_staff_id
  - Log in audit_logs

- [ ] 6.4 Staff assignment UI component
  - Tab selector dropdown
  - "Assign to Tab" button
  - "Delete" button with confirmation dialog
  - Show receipt details and item preview
  - Handle success/error states
  - Disable buttons during operations

- [ ] 6.5 Receipt list view with filters
  - Filter by status: All, Unclaimed, Claimed, Void, Failed
  - Filter by date range
  - Show status badges
  - Search by receipt number or amount
  - Paginate (50 per page)

- [ ] 6.6 Receipt detail view
  - Show all line items with quantities, prices
  - Display subtotal, tax, total
  - Show confidence score and parsing method
  - Show raw receipt text (collapsible)
  - Show parsing errors if failed
  - "Unassign" button (claimed receipts)
  - "Delete" button (unclaimed receipts)

### Phase 7: Customer App - Tab View

- [ ] 7.1 Customer tab view with receipts
  - Display receipts assigned to customer's tab
  - Show items with quantities and prices
  - Calculate and display total
  - Real-time updates via Supabase Realtime
  - Show notification when receipt added
  - "Pay with M-Pesa" button

### Phase 8: AI Template Generation (Onboarding)

- [ ] 8.1 Onboarding template generator
  - Accept 5-10 test receipts during onboarding
  - Use AI to analyze all receipts together
  - Generate regex patterns: item_line, total_line, tax_line
  - Generate semantic map
  - Identify edge cases
  - Set confidence threshold (0.80-0.90)

- [ ] 8.2 Template testing and storage
  - Test template against all test receipts
  - Calculate accuracy score
  - Save to `receipt_parsing_templates` (version 1)
  - Set as active template

- [ ] 8.3 Onboarding UI flow
  - Add "Print Test Receipts" step to staff onboarding
  - Display captured receipts in real-time
  - Show template generation progress
  - Display accuracy score
  - Validate accuracy > 70% before completion

---

## Implementation Order

1. **Phase 3** (Cloud Ingestion) - Connects TabezaConnect to cloud
2. **Phase 4** (Regex Parser) - Fast parsing (80-95% of receipts)
3. **Phase 5** (AI Fallback) - Handles edge cases (5-20% of receipts)
4. **Phase 6** (Staff Dashboard) - Core staff workflow
5. **Phase 7** (Customer App) - Customer sees receipts
6. **Phase 8** (Onboarding) - Template generation for new venues

---

## Key Simplifications

- ✅ No Redis - Supabase triggers handle queueing
- ✅ No self-healing templates - Manual updates for MVP
- ✅ No complex monitoring - Supabase dashboard
- ✅ No property tests - Manual testing for MVP
- ✅ Minimal UI - Focus on core workflow only

---

## Performance Targets

- Capture latency: < 5ms ✅ (already achieved)
- Upload latency: < 20ms ✅ (already achieved)
- Regex parsing: < 5ms (target)
- AI parsing: < 300ms (target)
- End-to-end (regex): < 30ms (target)
- End-to-end (AI): < 300ms (target)

---

## Next Steps

Start with **Phase 3.1** - Create the cloud ingestion endpoint to receive uploads from TabezaConnect.
