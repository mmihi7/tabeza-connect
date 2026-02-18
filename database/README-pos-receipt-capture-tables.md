# POS Receipt Capture Tables Migration

## Overview

This migration creates the foundational database schema for the POS Receipt Capture Transformation feature. It transforms TabezaConnect from a blocking print intermediary to a passive receipt capture system.

## Purpose

Enable venues to print receipts directly from their POS to the printer while Tabeza passively observes and captures receipt data asynchronously. This ensures printing never depends on Tabeza's availability.

## Tables Created

### 1. `raw_pos_receipts`
**Purpose**: Immutable storage of raw receipt data captured from Windows print spooler

**Columns**:
- `id` - UUID primary key
- `bar_id` - Reference to venue
- `device_id` - TabezaConnect device identifier
- `timestamp` - When receipt was printed
- `escpos_bytes` - Base64 encoded ESC/POS data (optional)
- `text` - ASCII text converted from ESC/POS
- `metadata` - JSONB with print job details (jobId, source, fileSize, printerName)
- `created_at` - Record creation timestamp

**Indexes**:
- `idx_raw_pos_receipts_bar` - Query by venue
- `idx_raw_pos_receipts_timestamp` - Query by print time
- `idx_raw_pos_receipts_device` - Query by device
- `idx_raw_pos_receipts_created` - Query by creation time

### 2. `pos_receipts`
**Purpose**: Structured parsed receipt data with status tracking

**Columns**:
- `id` - UUID primary key
- `raw_receipt_id` - Reference to raw receipt
- `bar_id` - Reference to venue
- `receipt_number` - Extracted receipt number (optional)
- `subtotal` - Receipt subtotal
- `tax` - Tax amount
- `total` - Total amount
- `currency` - Currency code (default: KES)
- `parsed_at` - When parsing completed
- `confidence_score` - Parsing confidence (0.00 to 1.00)
- `parsing_method` - 'regex' or 'ai'
- `template_version` - Template version used
- `status` - Receipt status (see enum below)
- `claimed_by_tab_id` - Tab that claimed this receipt
- `claimed_at` - When receipt was claimed
- `paid_at` - When payment was confirmed
- `created_at` - Record creation timestamp

**Status Enum Values**:
- `CAPTURED` - Received from capture service, not yet parsed
- `PARSING` - Currently being processed
- `PARSED` - Structured data available
- `UNCLAIMED` - Visible in customer "Recent receipts"
- `CLAIMED` - Linked to a customer tab
- `PAID` - Payment confirmed
- `VOID` - Marked void by staff (not claimable)
- `PARSE_FAILED` - Regex and AI both failed (physical receipt only)

**Indexes**:
- `idx_pos_receipts_bar` - Query by venue
- `idx_pos_receipts_raw` - Link to raw receipt
- `idx_pos_receipts_tab` - Query by claimed tab
- `idx_pos_receipts_status` - Query by status
- `idx_pos_receipts_confidence` - Query by confidence score
- `idx_pos_receipts_timestamp` - Query by creation time
- `idx_pos_receipts_unclaimed` - Composite index for unclaimed receipts (bar_id, status)
- `idx_pos_receipts_recent_unclaimed` - **Optimized for recent receipts query** (bar_id, created_at DESC) WHERE status = 'UNCLAIMED'
- `idx_pos_receipts_parsing_method` - Query by parsing method

### 3. `pos_receipt_items`
**Purpose**: Individual line items from parsed receipts

**Columns**:
- `id` - UUID primary key
- `receipt_id` - Reference to receipt
- `line_number` - Line order in receipt
- `quantity` - Item quantity
- `item_name` - Item description
- `unit_price` - Price per unit
- `total_price` - Line total

**Indexes**:
- `idx_pos_receipt_items_receipt` - Query by receipt
- `idx_pos_receipt_items_line` - Query by receipt and line number

### 4. `tab_pos_receipts`
**Purpose**: Join table linking receipts to customer tabs

**Columns**:
- `tab_id` - Reference to tab
- `pos_receipt_id` - Reference to receipt
- `linked_at` - When link was created

**Indexes**:
- `idx_tab_pos_receipts_tab` - Query by tab
- `idx_tab_pos_receipts_receipt` - Query by receipt

## Security (RLS Policies)

All tables have Row Level Security enabled:

- **Staff**: Can view/update receipts for their venues
- **Customers**: Can view receipts claimed by their tabs
- **Capture Service**: Can insert raw receipts (uses service role key)

## Realtime Subscriptions

Enabled for customer receipt updates:
- `pos_receipts`
- `pos_receipt_items`
- `tab_pos_receipts`

## Constraints

- Confidence score: 0.00 to 1.00
- Parsing method: 'regex' or 'ai'
- Currency: KES, USD, EUR, GBP (extensible)
- Quantities: Must be positive
- Prices: Must be non-negative

## How to Apply

```bash
# Using psql
psql -h <host> -U <user> -d <database> -f create-pos-receipt-capture-tables.sql

# Using Supabase CLI
supabase db push
```

## Validation

After applying, verify with:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('raw_pos_receipts', 'pos_receipts', 'pos_receipt_items', 'tab_pos_receipts');

-- Check enum type
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = 'receipt_status'::regtype 
ORDER BY enumsortorder;

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('raw_pos_receipts', 'pos_receipts', 'pos_receipt_items', 'tab_pos_receipts')
ORDER BY tablename, indexname;
```

## Requirements Validated

This migration validates:
- **Requirement 14.1**: Database includes raw_receipts table with required columns
- **Requirement 14.2**: Database includes receipts table with structured data
- **Requirement 14.3**: Database includes receipt_items table with line-level detail

## Related Files

- Migration: `database/create-pos-receipt-capture-tables.sql`
- Spec: `.kiro/specs/pos-receipt-capture-transformation/`
- Design: `.kiro/specs/pos-receipt-capture-transformation/design.md`

## Notes

- Raw receipts are **immutable** - never modified after insert
- The `idx_pos_receipts_recent_unclaimed` index is specifically optimized for the "Recent receipts" customer query
- A tab can have multiple receipts (one-to-many via join table)
- Receipt status transitions: CAPTURED → PARSING → PARSED → UNCLAIMED → CLAIMED → PAID
