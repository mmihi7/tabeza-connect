# POS Receipt Capture Transformation - Database Migration Guide

## Overview

This migration transforms Tabeza's printer integration from a blocking intermediary to a passive receipt capture system. The database changes support:

1. **Raw receipt storage** - Immutable ESC/POS byte capture
2. **Parsed receipt storage** - Structured line items and totals
3. **Template management** - Venue-specific regex patterns
4. **Self-healing learning** - AI-driven template evolution
5. **Tab-receipt linking** - Customer receipt claiming

## Migration Files

### 1. Core Receipt Tables
**File**: `create-pos-receipt-capture-tables.sql`

Creates:
- `receipt_status` enum (CAPTURED, PARSING, PARSED, UNCLAIMED, CLAIMED, PAID, VOID, PARSE_FAILED)
- `raw_pos_receipts` - Immutable raw receipt data from print spooler
- `pos_receipts` - Parsed structured receipts
- `pos_receipt_items` - Line items from parsed receipts
- `tab_pos_receipts` - Join table linking receipts to customer tabs

**Requirements**: 14.1, 14.2, 14.3

### 2. Parsing Template Tables
**File**: `create-receipt-parsing-templates.sql`

Creates:
- `receipt_parsing_templates` - Venue-specific regex patterns
- `template_learning_events` - AI parsing results for evolution
- `pos_parse_failures` - Failed parsing attempts for monitoring

**Requirements**: 14.4, 14.5, 14.6

## Application Steps

### Prerequisites

1. **Backup your database**:
   ```bash
   pg_dump -h your-db-host -U postgres -d postgres > backup_before_pos_capture.sql
   ```

2. **Verify existing tables**:
   - `bars` table exists
   - `tabs` table exists
   - `user_bars` table exists (for RLS policies)

### Step 1: Apply Core Receipt Tables

```bash
# Connect to Supabase SQL Editor or use psql
psql -h your-db-host -U postgres -d postgres -f create-pos-receipt-capture-tables.sql
```

**Verify**:
```sql
-- Check tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('raw_pos_receipts', 'pos_receipts', 'pos_receipt_items', 'tab_pos_receipts');

-- Check enum created
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = 'receipt_status'::regtype 
ORDER BY enumsortorder;

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('raw_pos_receipts', 'pos_receipts', 'pos_receipt_items', 'tab_pos_receipts');
```

### Step 2: Apply Parsing Template Tables

```bash
psql -h your-db-host -U postgres -d postgres -f create-receipt-parsing-templates.sql
```

**Verify**:
```sql
-- Check tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('receipt_parsing_templates', 'template_learning_events', 'pos_parse_failures');

-- Check helper functions
SELECT proname FROM pg_proc 
WHERE proname IN ('get_active_template', 'count_recent_parse_failures', 'get_template_history');

-- Check trigger
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name = 'trigger_deactivate_old_templates';
```

### Step 3: Enable Realtime (Optional)

If using Supabase Realtime for customer receipt updates:

```sql
-- Already included in migration, but verify:
SELECT schemaname, tablename FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND tablename IN ('pos_receipts', 'pos_receipt_items', 'tab_pos_receipts');
```

## Testing the Migration

### 1. Test Raw Receipt Insertion

```sql
-- Insert a test raw receipt
INSERT INTO raw_pos_receipts (bar_id, device_id, timestamp, text, metadata)
VALUES (
  (SELECT id FROM bars LIMIT 1),
  'test-device-001',
  NOW(),
  'Test Receipt\nBeer x2  500.00\nTotal    500.00',
  '{"jobId": "test-001", "source": "manual", "fileSize": 100}'::jsonb
)
RETURNING id;
```

### 2. Test Parsed Receipt Insertion

```sql
-- Insert a test parsed receipt
WITH raw AS (
  SELECT id, bar_id FROM raw_pos_receipts LIMIT 1
)
INSERT INTO pos_receipts (
  raw_receipt_id, bar_id, subtotal, tax, total, 
  confidence_score, parsing_method, status
)
SELECT 
  raw.id, raw.bar_id, 500.00, 80.00, 580.00,
  0.95, 'regex', 'UNCLAIMED'
FROM raw
RETURNING id;
```

### 3. Test Template Creation

```sql
-- Insert a test template
INSERT INTO receipt_parsing_templates (
  bar_id, version, patterns, semantic_map, active
)
VALUES (
  (SELECT id FROM bars LIMIT 1),
  1,
  '{
    "itemLine": "^(.{1,24})\\\\s+(\\\\d+)\\\\s+([\\\\d.]+)$",
    "totalLine": "^TOTAL\\\\s+([\\\\d,.]+)$"
  }'::jsonb,
  '{
    "itemLine": ["name", "qty", "line_total"],
    "currency": "KES",
    "taxInclusive": true
  }'::jsonb,
  true
)
RETURNING id, version;
```

### 4. Test RLS Policies

```sql
-- Test as staff user (requires actual user_id)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub TO 'your-user-uuid';

-- Should return receipts for bars where user is staff
SELECT COUNT(*) FROM pos_receipts;

-- Reset
RESET ROLE;
```

## Data Model Relationships

```
bars (existing)
  ├─→ raw_pos_receipts (NEW)
  │     └─→ pos_receipts (NEW)
  │           ├─→ pos_receipt_items (NEW)
  │           └─→ tab_pos_receipts (NEW) ←─┐
  │                                          │
  ├─→ receipt_parsing_templates (NEW)       │
  ├─→ template_learning_events (NEW)        │
  ├─→ pos_parse_failures (NEW)              │
  │                                          │
  └─→ tabs (existing) ──────────────────────┘
```

## Key Constraints

1. **Immutability**: `raw_pos_receipts` never modified after insert
2. **Single active template**: Only one template per bar can be active
3. **Confidence bounds**: All confidence scores between 0.00 and 1.00
4. **Status flow**: Receipts progress through defined status states
5. **Authority mode**: Only applies to bars with `authority_mode = 'pos'`

## Rollback Plan

If you need to rollback:

```sql
-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS tab_pos_receipts CASCADE;
DROP TABLE IF EXISTS pos_receipt_items CASCADE;
DROP TABLE IF EXISTS pos_receipts CASCADE;
DROP TABLE IF EXISTS raw_pos_receipts CASCADE;
DROP TABLE IF EXISTS pos_parse_failures CASCADE;
DROP TABLE IF EXISTS template_learning_events CASCADE;
DROP TABLE IF EXISTS receipt_parsing_templates CASCADE;

-- Drop enum
DROP TYPE IF EXISTS receipt_status CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS get_active_template(UUID);
DROP FUNCTION IF EXISTS count_recent_parse_failures(UUID, INT);
DROP FUNCTION IF EXISTS get_template_history(UUID);
DROP FUNCTION IF EXISTS deactivate_old_templates();
```

## Post-Migration Steps

1. **Update TypeScript types** in `packages/shared/types/database.ts`
2. **Configure TabezaConnect** capture service with bar IDs
3. **Generate initial templates** during venue onboarding
4. **Monitor parse failures** in first week of deployment
5. **Verify realtime subscriptions** work for customer PWA

## Support

For issues or questions:
- Check logs in `pos_parse_failures` table
- Review template accuracy in `receipt_parsing_templates`
- Monitor learning events in `template_learning_events`
- Contact: dev@tabeza.co.ke

## CORE TRUTH REMINDER

```typescript
// CORE TRUTH: Manual service always exists. 
// Digital authority is singular. 
// Tabeza adapts to the venue — never the reverse.
```

This migration applies ONLY to venues with:
- `venue_mode = 'basic'` (always POS authority)
- `venue_mode = 'venue'` AND `authority_mode = 'pos'`

Venues with `authority_mode = 'tabeza'` do NOT use this system.
