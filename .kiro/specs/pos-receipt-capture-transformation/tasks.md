# Implementation Plan: POS Receipt Capture Transformation

## Overview

This plan transforms TabezaConnect from a blocking print intermediary to a passive receipt capture system. The implementation follows a phased approach: database schema → capture service transformation → cloud parsing infrastructure → AI template generation → receipt-to-tab linking → self-healing system.

**CRITICAL CLARIFICATION**: The "Tabeza printer drivers" referenced throughout product documentation refers to the TabezaConnect Capture Service - a Windows background service that watches the Windows print spooler directory and silently copies print jobs AFTER they have been sent to the printer. The printer never knows Tabeza exists. The POS never knows Tabeza exists.

**Core Architectural Shift**:
- **Current (Blocking)**: POS → TabezaConnect → Printer ❌
- **New (Passive)**: POS → Printer (instant, 1ms) + Windows Spooler → TabezaConnect watches silently ✅

**Technology Stack**:
- TabezaConnect Capture Service: Node.js (current, production-ready)
- Cloud API: TypeScript/Next.js (existing stack)
- Database: PostgreSQL/Supabase (existing)
- Queue: Supabase Edge Functions + Database Triggers (existing)
- AI: Claude Haiku or GPT-4o-mini (new)

**Key Design Principles**:
1. Printing never depends on Tabeza - POS prints directly with zero latency
2. Asynchronous capture succeeds even if internet/cloud/AI is offline
3. ESC/POS primary format, text secondary, image fallback
4. AI for templates during onboarding, regex for production (1-5ms, zero cost)
5. AI fallback for edge cases only (async, rare)
6. Immutable raw receipt storage
7. Physical receipt is final fallback - digital parsing is additive
8. Digital authority is singular: (POS authority OR Tabeza authority) AND Manual service

**Implementation Language**: TypeScript (for all cloud components and capture service)

## Tasks

- [x] 1. Database Schema Setup
  - [x] 1.1 Create new POS receipt tables
    - Create migration file for `raw_pos_receipts`, `pos_receipts`, `pos_receipt_items` tables
    - Create `receipt_status` enum type with values: CAPTURED, PARSING, PARSED, UNCLAIMED, CLAIMED, PAID, VOID, PARSE_FAILED
    - Add indexes for performance: bar_id, timestamp, device_id, status, confidence_score
    - Add composite index for unclaimed receipts: (bar_id, status) WHERE status = 'UNCLAIMED'
    - Add index for recent receipts query: (bar_id, created_at DESC) WHERE status = 'UNCLAIMED'
    - _Requirements: 14.1, 14.2, 14.3_
  
  - [x] 1.2 Create parsing template tables
    - Create `receipt_parsing_templates` table with JSONB patterns and semantic_map
    - Include fields: patterns, semantic_map, known_edge_cases, confidence_threshold, accuracy, receipt_samples_used
    - Create `template_learning_events` table for AI learning with promoted_to_template flag
    - Create `pos_parse_failures` table with error tracking fields: regex_confidence, ai_attempted, ai_succeeded
    - Add indexes for active templates: (bar_id, active) and (bar_id, version DESC)
    - Add indexes for learning events: (bar_id, created_at DESC) and (promoted_to_template)
    - _Requirements: 14.4, 14.5, 14.6_
  
  - [x] 1.3 Create tab-receipt linking table
    - Create `tab_pos_receipts` join table with composite primary key (tab_id, pos_receipt_id)
    - Add foreign key constraints to `tabs` and `pos_receipts` with CASCADE delete
    - Add indexes on both tab_id and pos_receipt_id for bidirectional lookups
    - Add linked_at timestamp for tracking when receipt was claimed
    - _Requirements: 14.3_
  
  - [x] 1.4 Run database migrations
    - Test migrations in development environment
    - Verify all indexes are created correctly using EXPLAIN ANALYZE
    - Validate foreign key constraints work as expected (test cascade deletes)
    - Test cascade deletes for data integrity (delete bar → all receipts deleted)
    - Verify enum types are created correctly
    - _Requirements: 14.1-14.6_

- [ ] 2. Transform TabezaConnect Capture Service
  - [x] 2.1 Remove blocking print forwarding logic
    - Remove current print relay code from TabezaConnect service
    - Ensure POS prints directly to printer without TabezaConnect in path
    - Verify printer receives jobs without any intermediary delay (< 1ms)
    - Test that printing continues when TabezaConnect is stopped
    - _Requirements: 1.1, 1.2, 1.5_
  
  - [x] 2.2 Implement Windows print spooler monitoring
    - Add file watcher for `C:\Windows\System32\spool\PRINTERS` directory
    - Detect `.SPL` and `.SHD` files within 500ms of creation
    - Wait for file write completion before processing (check file size stability)
    - Handle permission errors gracefully (log and continue, don't crash)
    - Implement polling fallback if file watcher fails
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 2.3 Implement ESC/POS byte extraction and conversion
    - Detect ESC/POS commands in print files (check for ESC byte 0x1B)
    - Extract ESC/POS byte sequences from `.SPL` files
    - Convert ESC/POS bytes to ASCII text by removing control characters
    - Preserve line breaks (0x0A) and spacing from ESC/POS formatting
    - Store both raw ESC/POS bytes (base64 encoded) and converted text
    - Handle mixed ESC/POS and text content
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 2.4 Implement local persistent queue
    - Create queue directory at `C:\ProgramData\Tabeza\queue\` with proper permissions
    - Save receipts as JSON files with UUID filenames (e.g., `{uuid}.json`)
    - Include all required fields: receipt ID, bar ID, device ID, timestamp, ESC/POS data, text, metadata
    - Ensure queue survives system reboots and service restarts (persistent storage)
    - Implement queue size monitoring and cleanup of old uploaded receipts
    - _Requirements: 5.1, 5.2, 5.3, 5.5_
  
  - [x] 2.5 Implement async upload worker
    - Create background worker that continuously processes queue (separate thread/process)
    - Upload receipts to cloud API asynchronously (never block capture)
    - Implement exponential backoff retry: 5s, 10s, 20s, 40s for failed uploads
    - Mark receipts as uploaded and remove from queue after success
    - Resume processing queued receipts on service restart (scan queue directory on startup)
    - Handle network errors gracefully (offline mode)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 2.6_
  
  - [ ]* 2.6 Write property test for non-blocking print path
    - **Property 1: Non-Blocking Print Path**
    - *For any* POS print job, the printer SHALL receive and complete the print without any delay or dependency on Tabeza services
    - Test with fast-check: generate random print jobs, verify printing completes even when Tabeza is offline
    - Verify printer latency < 1ms (no intermediary delay)
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
  
  - [ ]* 2.7 Write property test for asynchronous capture
    - **Property 2: Asynchronous Capture Independence**
    - *For any* print job completion, the Capture_Service SHALL capture receipt data asynchronously without blocking the print process
    - Test with fast-check: generate random print jobs, verify capture latency doesn't affect printing
    - Verify capture happens after printing completes (not during)
    - **Validates: Requirements 2.1, 6.4**
  
  - [ ]* 2.8 Write property test for queue persistence
    - **Property 3: Offline Queue Persistence**
    - *For any* captured receipt, if internet connectivity is unavailable, the receipt SHALL be stored in the Local_Queue and SHALL persist across system reboots and service restarts
    - Test with fast-check: simulate offline mode, restart service, verify queue intact
    - Verify queue directory survives reboot (persistent storage)
    - **Validates: Requirements 2.2, 2.5, 2.6, 5.5**
  
  - [ ]* 2.9 Write property test for upload retry
    - **Property 4: Upload Recovery with Exponential Backoff**
    - *For any* failed upload attempt, the Upload_Worker SHALL retry with exponential backoff (5s, 10s, 20s, 40s) and successfully upload when connectivity is restored
    - Test with fast-check: simulate network failures, verify retry timing matches exponential backoff
    - Verify all queued receipts eventually upload when connectivity restored
    - **Validates: Requirements 2.3, 2.4, 6.3**
  
  - [ ]* 2.10 Write property test for queue cleanup
    - **Property 5: Queue Cleanup After Upload**
    - *For any* receipt successfully uploaded to the cloud, the Capture_Service SHALL remove it from the Local_Queue
    - Test with fast-check: verify queue only contains pending receipts after successful uploads
    - Verify uploaded receipts are marked and removed from queue
    - **Validates: Requirements 5.4, 6.5**
  
  - [ ]* 2.11 Write property test for spool file detection
    - **Property 6: Spool File Detection Latency**
    - *For any* new .SPL or .SHD file appearing in the print spooler directory, the Capture_Service SHALL detect it within 500ms
    - Test with fast-check: create random spool files, measure detection time
    - Verify detection latency < 500ms for all file types
    - **Validates: Requirements 3.2, 3.3**
  
  - [ ]* 2.12 Write property test for format extraction priority
    - **Property 7: Format Extraction Priority**
    - *For any* print job, the Capture_Service SHALL attempt ESC/POS byte extraction first, then text extraction as fallback
    - Test with fast-check: generate various print formats, verify extraction order (ESC/POS → text → image)
    - Verify fallback chain works correctly
    - **Validates: Requirements 3.4, 3.5, 4.1, 4.2**
  
  - [ ]* 2.13 Write property test for ESC/POS conversion fidelity
    - **Property 8: ESC/POS to Text Conversion Fidelity**
    - *For any* ESC/POS byte sequence, the Capture_Service SHALL convert it to ASCII text while preserving line breaks and spacing
    - Test with fast-check: generate ESC/POS sequences, verify text conversion preserves structure
    - Verify both raw bytes and converted text are stored
    - **Validates: Requirements 4.3, 4.4, 4.5**
  
  - [ ]* 2.14 Write property test for local queue data completeness
    - **Property 9: Local Queue Data Completeness**
    - *For any* captured receipt, the Local_Queue JSON file SHALL include receipt ID, venue ID, timestamp, ESC/POS data (if available), and text
    - Test with fast-check: verify all required fields present in queued receipts
    - Verify queue files are valid JSON and can be parsed
    - **Validates: Requirements 5.2, 5.3**

- [ ] 3. Cloud Receipt Ingestion API
  - [x] 3.1 Create ingestion endpoint
    - Implement `POST /api/receipts/ingest` in Next.js API routes
    - Accept raw receipt data: bar ID, device ID, timestamp, ESC/POS bytes (base64), text, metadata
    - Validate required fields (bar ID, text) and return 400 for missing fields
    - Save to `raw_pos_receipts` table immediately (< 100ms)
    - Return success response with receipt ID within 100ms
    - Never parse receipts inline during ingestion (async only)
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [x] 3.2 Create Supabase Edge Function for parsing
    - Create `supabase/functions/parse-receipt/index.ts` Edge Function
    - Load raw receipt from `raw_pos_receipts` table
    - Load bar-specific template from `receipt_parsing_templates` (active version only)
    - Try regex parser first (fast path, 1-5ms)
    - Fallback to AI if confidence < 85% (slow path, ~300ms)
    - Save structured receipt to `pos_receipts` and `pos_receipt_items` if successful
    - Set status to 'UNCLAIMED' if parsed successfully, 'PARSE_FAILED' if both fail
    - Uses DeepSeek API for AI fallback
    - _Requirements: 7.4, 7.5_
  
  - [x] 3.3 Create database trigger to invoke Edge Function
    - Create `trigger_receipt_parsing()` function using pg_net.http_post
    - Trigger calls Edge Function when raw receipt inserted
    - Pass receipt_id to Edge Function for processing
    - Use Supabase's built-in pg_net extension (no Redis needed)
    - _Requirements: 7.4, 7.5_
  
  - [ ]* 3.4 Write property test for ingestion performance
    - **Property 10: Cloud Ingestion Performance**
    - *For any* receipt ingestion request, the Cloud_API SHALL save the receipt to raw_pos_receipts table and return success within 100ms without inline parsing
    - Test with fast-check: generate random receipts, measure ingestion latency
    - Verify no parsing happens during ingestion (async only)
    - **Validates: Requirements 7.2, 7.3, 7.5**
  
  - [ ]* 3.5 Write property test for async parsing trigger
    - **Property 11: Asynchronous Parsing Trigger**
    - *For any* ingested receipt, the database trigger SHALL invoke the Edge Function for parsing asynchronously
    - Test with fast-check: verify Edge Function called after ingestion, verify ingestion doesn't wait for parsing
    - Verify parsing happens in background via Supabase trigger
    - **Validates: Requirements 7.4**

- [-] 4. Checkpoint - Verify Capture Pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Regex Parsing Engine
  - [ ] 5.1 Implement regex parser core
    - Load bar-specific templates from `receipt_parsing_templates` table
    - Apply regex patterns to extract line items: quantity, name, unit price, line total using semantic map
    - Extract totals using patterns: subtotal, tax, total
    - Complete parsing within 5ms for standard receipts (performance requirement)
    - Handle edge cases from known_edge_cases: split bills, happy hour markers, void reprints, discount lines
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [ ] 5.2 Implement confidence scoring with reconciliation
    - Calculate confidence based on pattern matches: items found (1 point each), totals found (2 points for total, 1 each for tax/subtotal)
    - Perform reconciliation check: sum of line item totals should equal receipt total (within 0.01 tolerance)
    - Deduct confidence points for reconciliation failures (items sum ≠ total)
    - Return confidence ratio (0.00 to 1.00) based on max possible confidence
    - Log reconciliation failures for debugging and template improvement
    - _Requirements: 8.4_
  
  - [ ] 5.3 Implement conditional save logic
    - Save structured receipt to `pos_receipts` and `pos_receipt_items` if confidence ≥ 85%
    - Trigger AI fallback if confidence < 85% (queue for AI parsing, don't block)
    - Use database transactions for atomicity (both tables or neither, rollback on failure)
    - Set receipt status to 'PARSED' if confidence ≥ 85%, 'PARSING' if queued for AI
    - Store parsing_method ('regex'), template_version, and confidence_score
    - _Requirements: 8.5, 8.6_
  
  - [ ]* 5.4 Write property test for parsing performance
    - **Property 12: Regex Parsing Performance and Confidence**
    - *For any* standard receipt, the Regex_Parser SHALL complete parsing within 5ms and calculate a confidence score based on pattern matches, saving the structured receipt if confidence ≥ 85%
    - Test with fast-check: generate random receipts, measure parsing time and confidence
    - Verify parsing latency < 5ms for standard receipts
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5, 12.3**
  
  - [ ]* 5.5 Write property test for round-trip parsing
    - **Property 21: Round-Trip Parsing Correctness**
    - *For any* valid structured receipt, formatting it back to text then parsing again SHALL produce an equivalent structured receipt with the same line items, quantities, prices, subtotal, tax, and total
    - Test with fast-check: parse → format → parse, verify equivalence (within 0.01 tolerance for decimals)
    - Verify all line items preserved with correct quantities and prices
    - **Validates: Requirements 19.1, 19.2, 19.3**
  
  - [ ]* 5.6 Write property test for round-trip template validation
    - **Property 22: Round-Trip Validation for Template Testing**
    - *For any* new template version, the Template_Learning system SHALL use round-trip validation against historical receipts, flagging templates that produce different values during round-trip
    - Test with fast-check: verify template testing includes round-trip validation
    - Verify templates that fail round-trip are not activated
    - **Validates: Requirements 19.4, 19.5**

- [ ] 6. Parsing Orchestrator (Integrated in Edge Function)
  - [ ] 6.1 Implement parsing orchestration in Edge Function
    - Edge Function orchestrates regex → AI fallback flow (no Redis/BullMQ needed)
    - Load raw receipt from `raw_pos_receipts` table
    - Load bar-specific template from `receipt_parsing_templates` (active version only)
    - Apply regex parser first (fast path, 1-5ms)
    - Route to AI fallback if confidence < 85% (slow path, ~300ms)
    - Handle parsing errors gracefully (log and store in pos_parse_failures)
    - Use Supabase database triggers + pg_net for orchestration
    - _Requirements: 8.1, 8.6_
  
  - [ ] 6.2 Implement structured receipt storage
    - Save parsed receipts to `pos_receipts` table with confidence score, parsing_method, template_version
    - Save line items to `pos_receipt_items` table with line numbers (ordered)
    - Use database transactions for atomicity (both tables or neither)
    - Set receipt status to 'UNCLAIMED' for high-confidence receipts (ready for customer claim)
    - Set receipt status to 'PARSE_FAILED' if both regex and AI fail
    - Store parsing metadata: parsing_method ('regex' or 'ai'), template_version used
    - _Requirements: 8.5_
  
  - [ ]* 6.3 Write property test for AI fallback trigger
    - **Property 13: AI Fallback Trigger**
    - *For any* receipt with regex confidence score < 85%, the Parsing_Orchestrator SHALL invoke the AI_Parser
    - Test with fast-check: generate low-confidence receipts, verify AI invocation
    - Verify AI is NOT invoked for high-confidence receipts (≥ 85%)
    - **Validates: Requirements 8.6, 9.1**

- [ ] 7. AI Fallback Parser
  - [ ] 7.1 Implement Claude Haiku / GPT-4o-mini integration
    - Set up API client for Claude Haiku or GPT-4o-mini (choose based on cost/performance)
    - Build prompt with receipt text and bar context: currency, tax inclusive, known edge cases
    - Parse AI response to extract structured data: items, quantities, prices, subtotal, tax, total
    - Handle API errors gracefully: timeout (10s), rate limit (retry with backoff), server errors (log and fail)
    - Set low temperature (0.1) for deterministic output
    - _Requirements: 9.2, 9.3_
  
  - [ ] 7.2 Implement format consistency validation
    - Ensure AI output matches regex parser format exactly (same JSON structure)
    - Validate all required fields present: items array, subtotal, tax, total
    - Validate data types: numbers for prices, integers for quantities, strings for names
    - Validate ranges: prices > 0, quantities > 0, total = subtotal + tax
    - Reject invalid AI responses and log to parse_failures
    - _Requirements: 9.4_
  
  - [ ] 7.3 Implement success handling
    - Save structured receipt to `pos_receipts` and `pos_receipt_items` after AI parsing
    - Store learning event in `template_learning_events` for template evolution
    - Set parsing_method to 'ai' in receipt record
    - Set receipt status to 'UNCLAIMED' (ready for customer claim)
    - Include AI model used and response time in metadata
    - _Requirements: 9.5, 10.1_
  
  - [ ]* 7.4 Write property test for format consistency
    - **Property 14: AI Parser Format Consistency**
    - *For any* receipt parsed by the AI_Parser, the output SHALL match the same structured format as the Regex_Parser
    - Test with fast-check: generate receipts, verify AI output structure matches regex output structure
    - **Validates: Requirements 9.3, 9.4**
  
  - [ ]* 7.5 Write property test for learning event storage
    - **Property 15: Learning Event Storage**
    - *For any* successful AI parse, the Parsing_Orchestrator SHALL store a learning event in template_learning_events
    - Test with fast-check: verify learning event created for each AI success
    - **Validates: Requirements 10.1**
  
  - [ ]* 7.6 Write property test for POS-agnostic compatibility
    - **Property 23: POS-Agnostic Printer Compatibility**
    - *For any* printer that outputs to the Windows print spooler (thermal, network, USB, or virtual), the Capture_Service SHALL successfully capture receipts
    - Test with fast-check: simulate various printer types, verify capture success
    - **Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5**

- [ ] 8. Checkpoint - Verify Parsing Pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. AI Template Generation (Onboarding)
  - [ ] 9.1 Create onboarding template generator
    - Accept 5-10 test receipts from bar during onboarding (variety > volume)
    - Use AI (Claude Haiku or GPT-4o-mini) to analyze ALL receipts together (not one at a time)
    - Generate regex patterns for: item_line, total_line, tax_line, void_marker, discount_line
    - Generate semantic map: which capture group = which field (name, qty, unit_price, line_total)
    - Identify known edge cases: split bills, happy hour markers, void reprints, discount lines
    - Set recommended confidence threshold (0.80-0.90) based on receipt complexity
    - Return JSON with patterns, semantic_map, known_edge_cases, confidence_threshold
    - _Requirements: 20.1, 20.2, 20.3_
  
  - [ ] 9.2 Implement template testing and storage
    - Test generated template against all test receipts (validate accuracy)
    - Calculate accuracy score: percentage of receipts parsed correctly
    - Save template to `receipt_parsing_templates` table with version 1
    - Set as active template (active = true)
    - Store accuracy, sample count, and receipt samples used
    - Include patterns, semantic_map, known_edge_cases in JSONB fields
    - _Requirements: 20.4, 20.5_
  
  - [ ] 9.3 Add onboarding UI flow to staff app
    - Add "Print Test Receipts" step to staff onboarding (after mode/authority selection)
    - Display captured receipts in real-time as they arrive from capture service
    - Show template generation progress with loading indicator and status messages
    - Display generated template patterns and accuracy score
    - Validate template before allowing onboarding completion (accuracy > 70%)
    - Show clear instructions: "Print 5-10 normal orders on your POS (variety is better than volume)"
    - Allow retry if template generation fails or accuracy is too low
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

- [ ] 10. Self-Healing Template Learning
  - [ ] 10.1 Implement learning event storage
    - Store AI parsing results in `template_learning_events` table
    - Include bar ID, raw receipt ID, AI output (structured data as JSONB)
    - Track pattern detection: identify new patterns not in current template
    - Set promoted_to_template to false initially (will be updated by evolution worker)
    - Add timestamp for tracking learning event age
    - _Requirements: 10.1_
  
  - [ ] 10.2 Create background template evolution worker
    - Check for 10+ learning events with similar patterns (pattern similarity detection)
    - Use AI to analyze learning events and generate new regex patterns
    - Create new template version (increment version number from current active)
    - Track which learning events contributed to new template (update promoted_to_template)
    - Run as scheduled job (e.g., daily or weekly) or triggered by event threshold
    - _Requirements: 10.2_
  
  - [ ] 10.3 Implement template testing and activation
    - Test new template against historical receipts (last 100 receipts from bar)
    - Calculate accuracy improvement compared to current active template
    - Activate new template if accuracy improves by 5% or more (set active = true)
    - Deactivate old template (set active = false) and set new template as active
    - Track template evolution in `receipt_parsing_templates` table (version history)
    - Notify bar administrators of template updates via dashboard
    - _Requirements: 10.3, 10.4, 10.5_
  
  - [ ]* 10.4 Write property test for template generation threshold
    - **Property 16: Template Generation Threshold**
    - *For any* venue with 10 or more learning events, the Parsing_Orchestrator SHALL generate and test a new template version, activating it if accuracy improves by 5% or more
    - Test with fast-check: simulate learning events, verify template evolution
    - **Validates: Requirements 10.2, 10.3, 10.4, 10.5**
  
  - [ ]* 10.5 Write property test for raw receipt immutability
    - **Property 17: Raw Receipt Immutability**
    - *For any* raw receipt stored in the raw_receipts table, the data SHALL never be modified after initial insert
    - Test with fast-check: attempt modifications, verify immutability enforced
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**

- [ ] 11. Parse Failure Tracking
  - [ ] 11.1 Implement failure logging
    - Store failures in `pos_parse_failures` table with all context
    - Include raw receipt ID, bar ID, template version used
    - Store regex confidence score and whether AI was attempted
    - Include error message and error details (JSONB with full context)
    - Track whether AI succeeded or failed (ai_attempted, ai_succeeded flags)
    - Add timestamp for failure tracking and analysis
    - _Requirements: 13.1, 13.2_
  
  - [ ] 11.2 Implement failure retry logic
    - Retry failed receipts after template updates (new version activated)
    - Track retry attempts and outcomes in parse_failures table
    - Update receipt status if retry succeeds (PARSE_FAILED → PARSED)
    - Limit retry attempts to prevent infinite loops (max 3 retries per template version)
    - _Requirements: 13.3_
  
  - [ ] 11.3 Create failure monitoring endpoint
    - Add `GET /api/receipts/parse-failures` endpoint with filtering
    - Filter by bar ID and date range (query parameters)
    - Return failure count, error messages, and affected receipts
    - Alert administrators when bar has 5+ failures in last 7 days (email or dashboard notification)
    - Include failure trends and common error patterns in response
    - _Requirements: 13.4, 13.5_
  
  - [ ]* 11.4 Write property test for failure tracking
    - **Property 19: Parse Failure Tracking**
    - *For any* parsing failure, the Parsing_Orchestrator SHALL store the failure with receipt ID, venue ID, error message, and timestamp, and SHALL alert administrators when a venue has 5+ failures
    - Test with fast-check: simulate failures, verify tracking and alerts
    - **Validates: Requirements 13.1, 13.2, 13.5**
  
  - [ ]* 11.5 Write property test for failure retry
    - **Property 20: Parse Failure Retry After Template Update**
    - *For any* failed receipt, when a new template version is activated for the venue, the Parsing_Orchestrator SHALL retry parsing the failed receipt
    - Test with fast-check: simulate template update, verify retry
    - **Validates: Requirements 13.3**

- [ ] 12. Receipt-to-Tab Linking
  - [ ] 12.1 Create "Recent Receipts" API endpoint
    - Add `GET /api/receipts/recent` endpoint with bar filtering
    - Filter by bar ID and status = 'UNCLAIMED' (only show claimable receipts)
    - Return receipts from last 30 minutes only (session window)
    - Include receipt ID, receipt number, total, currency, timestamp, item preview (first 2-3 items)
    - Order by timestamp descending (most recent first)
    - Limit to 20 receipts maximum (prevent overwhelming UI)
    - _Requirements: 15.1_
  
  - [ ] 12.2 Implement receipt delete/discard API
    - Add `DELETE /api/receipts/:id` endpoint for staff
    - Validate receipt is UNCLAIMED (cannot delete claimed receipts)
    - Soft delete: update status to 'VOID' instead of hard delete
    - Set voided_at timestamp and voided_by_staff_id
    - Log deletion in audit_logs table for tracking
    - Return error if receipt already claimed or assigned
    - _Requirements: Staff workflow, database cleanup_
  
  - [ ] 12.3 Implement receipt claim API
    - Add `POST /api/receipts/claim` endpoint with validation
    - Validate receipt is UNCLAIMED and belongs to bar (prevent cross-bar claims)
    - Validate tab is OPEN and belongs to bar (prevent closed tab claims)
    - Validate receipt timestamp within session window (last 30 minutes)
    - Atomically update receipt status from UNCLAIMED to CLAIMED (prevent double claims)
    - Link receipt to tab via `tab_pos_receipts` join table
    - Return updated tab with all receipts and new total
    - Handle claim conflicts gracefully (receipt already claimed by another customer)
    - _Requirements: 15.3_
  
  - [ ] 12.4 Add customer PWA "Recent Receipts" UI
    - Display list of recent unclaimed receipts for current bar
    - Show time, amount, currency, and item preview for each receipt
    - Add "Claim Receipt" button for each receipt
    - Update tab total and items after claiming (real-time update)
    - Show success message after claim with receipt details
    - Handle claim conflicts: show error if receipt already claimed by another customer
    - Refresh list automatically when new receipts arrive (Supabase Realtime)
    - _Requirements: 15.1_
  
  - [ ] 12.5 Add staff unclaim action
    - Add "Unclaim Receipt" button in staff dashboard receipt detail view
    - Update receipt status from CLAIMED back to UNCLAIMED (atomic update)
    - Remove link from `tab_pos_receipts` join table
    - Clear claimed_by_tab_id and claimed_at fields
    - Show confirmation dialog before unclaiming (prevent accidental unclaims)
    - Log unclaim action in audit_logs table for tracking
    - _Requirements: 15.5_
  
  - [ ]* 12.6 Write property test for staff receipt display
    - **Property 24: Staff Receipt Display Completeness**
    - *For any* parsed receipt displayed in the Staff_App, the UI SHALL show all line items, totals, confidence score, and parsing errors
    - Test with fast-check: generate random receipts, verify UI displays all required fields
    - **Validates: Requirements 15.2, 15.4**

- [ ] 13. Staff App Receipt Management
  - [ ] 13.1 Create receipt list view
    - Display recent receipts for bar (paginated, 50 per page)
    - Show parsing status, confidence score, parsing method (regex/ai)
    - Show receipt number, total, timestamp, claimed status
    - Filter by status: CAPTURED, PARSING, PARSED, UNCLAIMED, CLAIMED, PAID, VOID, PARSE_FAILED
    - Filter by date range (date picker)
    - Show parsing errors for PARSE_FAILED receipts (error message preview)
    - Add search by receipt number or amount
    - Add "Delete" button for UNCLAIMED receipts (soft delete to VOID status)
    - Show VOID status badge for deleted receipts
    - _Requirements: 15.1, 15.4_
  
  - [ ] 13.2 Create receipt detail view
    - Show all line items with quantities, names, unit prices, totals
    - Display subtotal, tax, total, currency
    - Show confidence score and parsing method (regex or ai)
    - Display raw receipt text (collapsible section for debugging)
    - Show parsing errors if failed (error message and details)
    - Allow manual correction of parsing errors (edit items, totals, save changes)
    - Show claimed tab information if receipt is claimed (tab number, customer)
    - Add "Unclaim" button if receipt is claimed
    - Add "Delete" button if receipt is UNCLAIMED (with confirmation dialog)
    - Show voided_at and voided_by_staff_id for VOID receipts
    - _Requirements: 15.2, 15.4, 15.5_
  
  - [ ] 13.3 Add template management UI
    - Display active template version and accuracy (current version badge)
    - Show template version history with accuracy metrics over time (chart)
    - Display learning events that contributed to template improvements (list with details)
    - Show template patterns (regex) in read-only view (expandable sections)
    - Allow administrators to activate/deactivate template versions (version switcher)
    - Allow manual template editing (advanced users only, with warnings about breaking changes)
    - Show template testing results before activation (accuracy comparison)
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_
  
  - [ ] 13.4 Add parsing confidence monitoring dashboard
    - Display average confidence score for bar (last 7 days, 30 days)
    - Show chart of confidence scores over time (daily averages, line chart)
    - Alert administrators when confidence drops below 85% (banner notification)
    - Show percentage of receipts requiring AI fallback (pie chart)
    - Display parse failure count (last 7 days) with trend indicator
    - Show list of recent parse failures with links to receipts
    - Add export functionality for confidence data (CSV download)
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 14. Checkpoint - Verify End-to-End Flow
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Integration and Performance Optimization
  - [ ] 15.1 Optimize database queries
    - Add missing indexes based on query patterns (analyze slow query log)
    - Optimize receipt list queries with pagination and proper indexes
    - Add composite indexes for common filter combinations: (bar_id, status, timestamp)
    - Add database query caching for frequently accessed data (templates, bar configs)
    - Use EXPLAIN ANALYZE to identify slow queries and optimize
    - _Requirements: 12.1, 12.2, 12.4_
  
  - [ ] 15.2 Implement database query optimization
    - Use Supabase's built-in caching for frequently accessed data
    - Optimize template queries with proper indexes
    - Use materialized views for complex aggregations (confidence scores, failure rates)
    - Implement query result caching at application level (in-memory cache with TTL)
    - Invalidate caches on updates (template changes, new receipts, config changes)
    - _Requirements: 8.1, 12.1_
  
  - [ ] 15.3 Add real-time receipt updates
    - Use Supabase Realtime subscriptions for receipt status changes
    - Update customer PWA when receipt becomes UNCLAIMED (show in "Recent receipts")
    - Update staff dashboard when new receipts arrive (show notification badge)
    - Update receipt detail view when parsing completes (status change)
    - Handle connection drops gracefully (reconnect and resync)
    - _Requirements: 12.4_
  
  - [ ]* 15.4 Write property test for end-to-end performance
    - **Property 18: End-to-End Receipt Delivery Performance**
    - *For any* printed receipt, the system SHALL deliver the structured receipt to the customer PWA within 30ms for regex-parsed receipts and within 300ms for AI-parsed receipts
    - Test with fast-check: simulate full flow, measure end-to-end latency
    - **Validates: Requirements 12.1, 12.2, 12.4, 12.5**

- [ ] 16. Error Handling and Monitoring
  - [ ] 16.1 Add comprehensive error logging
    - Log capture service errors to local file (`C:\ProgramData\Tabeza\logs\capture.log`)
    - Log cloud API errors to Supabase (separate error_logs table)
    - Include context: receipt ID, bar ID, operation, timestamp, and stack traces
    - Implement log rotation (keep last 30 days, compress old logs)
    - Add log levels: ERROR, WARN, INFO, DEBUG
    - _Requirements: 13.1, 13.2_
  
  - [ ] 16.2 Implement health check endpoints
    - Add `/api/receipts/health` endpoint with component checks
    - Check database connectivity (query test with timeout)
    - Check Supabase Edge Function status (test invocation with timeout)
    - Check AI API availability (test API call with timeout)
    - Return detailed health status with component-level checks (200 OK or 503 Service Unavailable)
    - Include response times for each component
    - _Requirements: 7.1_
  
  - [ ] 16.3 Add monitoring dashboards
    - Create admin dashboard for system health (separate admin route)
    - Display capture service status per bar (last heartbeat, queue size, online/offline)
    - Show parsing success rate (regex vs AI, failures) with charts
    - Display AI fallback usage percentage (trend over time)
    - Show average parsing latency (regex and AI) with percentiles (p50, p95, p99)
    - Display queue depth and processing rate (receipts/minute)
    - Add alerts for anomalies: high failure rate, slow parsing, queue backlog
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 17. Final Checkpoint - Production Readiness
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties (minimum 100 iterations each using fast-check)
- Unit tests validate specific examples and edge cases
- The capture service transformation (Task 2) is critical - POS must print directly without Tabeza in path
- AI template generation (Task 9) is essential for onboarding - generates venue-specific regex templates
- Receipt-to-tab linking (Task 12) is the customer-facing feature that delivers value
- Self-healing template learning (Task 10) improves parsing accuracy over time without manual intervention
- Physical receipt is the final fallback - digital parsing is additive, not required for venue operation
- All code must respect the core truth: Manual service always exists. Digital authority is singular. Tabeza adapts to the venue - never the reverse.

## Implementation Order Rationale

1. **Database Schema (Task 1)**: Foundation for all data storage - must be complete before any other work
2. **Capture Service (Task 2)**: Core transformation - enables passive receipt capture without blocking printing
3. **Cloud Ingestion (Task 3)**: Accepts captured receipts from venues and queues for processing
4. **Checkpoint**: Verify capture pipeline works end-to-end (print → capture → upload → ingest)
5. **Regex Parser (Task 5)**: Fast deterministic parsing (95-99% of receipts, 1-5ms)
6. **Orchestrator (Task 6)**: Coordinates regex and AI parsing with confidence-based routing
7. **AI Fallback (Task 7)**: Handles edge cases regex can't parse (5-1% of receipts, 300ms)
8. **Checkpoint**: Verify parsing pipeline works end-to-end (ingest → parse → store)
9. **AI Template Generation (Task 9)**: Onboarding flow - creates venue templates from test receipts
10. **Self-Healing (Task 10)**: Automatic template improvement through learning events
11. **Parse Failures (Task 11)**: Track and retry failed parses, alert on high failure rates
12. **Receipt Linking (Task 12)**: Customer claims receipts and links to tabs (core customer value)
13. **Staff UI (Task 13)**: Receipt management, template management, and monitoring
14. **Checkpoint**: Verify end-to-end flow (print → capture → parse → claim → pay)
15. **Optimization (Task 15)**: Performance tuning, caching, and real-time updates
16. **Monitoring (Task 16)**: Error handling, health checks, and admin dashboards
17. **Final Checkpoint**: Production readiness validation

## Performance Targets

- **Capture latency**: < 5ms (receipt detected and saved to local queue)
- **Upload latency**: < 20ms (receipt uploaded to cloud API)
- **Regex parsing**: < 5ms (95-99% of receipts)
- **AI parsing**: < 300ms (1-5% of receipts)
- **End-to-end (regex)**: < 30ms (print → customer sees digital receipt)
- **End-to-end (AI)**: < 300ms (print → customer sees digital receipt)

## Failure Modes and Fallbacks

| Scenario | System Behavior | Customer Impact |
|----------|----------------|-----------------|
| Internet offline at venue | Local queue holds receipts, uploads when reconnected | Physical receipt available immediately |
| Cloud API down | Same as above | Physical receipt available immediately |
| AI unavailable | Regex handles 95-99%; rest logged as failures | Physical receipt available immediately |
| Regex fails, AI succeeds | Structured receipt available, template learns | Digital receipt available in ~300ms |
| Both parsers fail | Physical receipt is the receipt | No disruption - physical receipt sufficient |
| Customer claims wrong receipt | Staff can unclaim from dashboard | Staff resolves manually |
| Capture service crashes | POS and printer unaffected | Receipts missed until restart, physical receipts unaffected |

## Testing Strategy

- **Unit tests**: Specific examples, edge cases, error conditions (Jest + @testing-library/react)
- **Property tests**: Universal properties across all inputs (fast-check, 100+ iterations)
- **Integration tests**: End-to-end flows (capture → upload → parse → claim)
- **Performance tests**: Latency benchmarks for each component
- **Coverage goals**: Capture service 90%, Parsing logic 95%, API endpoints 85%, Error handling 100%
