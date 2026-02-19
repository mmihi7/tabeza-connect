# Receipt Parsing Trigger Setup Guide

## Overview

This migration creates a database trigger that automatically invokes the `parse-receipt` Edge Function whenever a new raw receipt is inserted into the `raw_pos_receipts` table. The trigger uses Supabase's built-in `pg_net` extension for non-blocking HTTP requests.

## Architecture

```
Raw Receipt Inserted
        ↓
Database Trigger Fires (AFTER INSERT)
        ↓
pg_net.http_post() - Async HTTP Request
        ↓
Edge Function: parse-receipt
        ↓
Regex Parser → AI Fallback
        ↓
Structured Receipt Saved
```

## Prerequisites

1. ✅ `raw_pos_receipts` table exists (Task 1.1 completed)
2. ✅ `parse-receipt` Edge Function deployed (Task 3.2 completed)
3. ✅ Supabase project with pg_net extension available (pre-installed)

## Migration File

**File**: `database/create-receipt-parsing-trigger.sql`

**What it does**:
- Enables `pg_net` extension for HTTP requests from PostgreSQL
- Creates `trigger_receipt_parsing()` function that calls the Edge Function
- Creates `trigger_parse_receipt_on_insert` trigger on `raw_pos_receipts` table
- Handles errors gracefully (receipt ingestion never fails due to parsing trigger)

## Configuration Required

Before running the migration, you need to configure two database settings:

### Option 1: Set Database-Level Configuration (Recommended)

Run these commands in Supabase SQL Editor:

```sql
-- Set your Supabase project URL
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project-ref.supabase.co';

-- Set your service role key (for authenticated Edge Function calls)
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
```

**Where to find these values**:
- **Supabase URL**: Project Settings → API → Project URL
- **Service Role Key**: Project Settings → API → service_role key (secret)

### Option 2: Modify Trigger Function (Alternative)

If you prefer to hardcode the URL, edit the trigger function:

```sql
-- Replace this line in the trigger function:
edge_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/parse-receipt';

-- With your actual URL:
edge_function_url := 'https://your-project-ref.supabase.co/functions/v1/parse-receipt';
```

## Installation Steps

### Step 1: Apply the Migration

**Via Supabase Dashboard**:
1. Go to SQL Editor in Supabase Dashboard
2. Create a new query
3. Copy the contents of `database/create-receipt-parsing-trigger.sql`
4. Run the query

**Via Supabase CLI**:
```bash
# From project root
supabase db push --file database/create-receipt-parsing-trigger.sql
```

### Step 2: Configure Settings (if using Option 1)

```sql
-- Replace with your actual values
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://xxxxx.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'eyJhbGc...';
```

### Step 3: Verify Installation

```sql
-- 1. Check pg_net extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_net';
-- Expected: 1 row showing pg_net extension

-- 2. Check trigger exists
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'trigger_parse_receipt_on_insert';
-- Expected: 1 row showing trigger on raw_pos_receipts

-- 3. Check function exists
SELECT 
  proname as function_name,
  prosrc as source_code
FROM pg_proc 
WHERE proname = 'trigger_receipt_parsing';
-- Expected: 1 row showing the function
```

## Testing the Trigger

### Test 1: Insert a Test Receipt

```sql
-- Insert a test receipt (replace 'your-bar-id' with actual bar ID)
INSERT INTO raw_pos_receipts (bar_id, device_id, timestamp, text, metadata)
VALUES (
  'your-bar-id-uuid-here',
  'test-device-001',
  NOW(),
  'TEST RECEIPT
Item 1  2  10.00  20.00
Item 2  1  15.00  15.00
SUBTOTAL  35.00
TAX  5.60
TOTAL  KES 40.60',
  '{"source": "test", "jobId": "test-123"}'::jsonb
);
```

### Test 2: Check Trigger Fired

```sql
-- Check if the receipt was inserted
SELECT id, bar_id, device_id, created_at 
FROM raw_pos_receipts 
ORDER BY created_at DESC 
LIMIT 1;

-- Check pg_net request queue (to see if HTTP request was made)
SELECT 
  id,
  created,
  url,
  method,
  headers,
  body
FROM net._http_response 
ORDER BY created DESC 
LIMIT 5;
```

### Test 3: Verify Parsing Completed

Wait a few seconds for the Edge Function to process, then:

```sql
-- Check if parsed receipt was created
SELECT 
  pr.id,
  pr.raw_receipt_id,
  pr.status,
  pr.parsing_method,
  pr.confidence_score,
  pr.total
FROM pos_receipts pr
JOIN raw_pos_receipts rpr ON pr.raw_receipt_id = rpr.id
WHERE rpr.device_id = 'test-device-001'
ORDER BY pr.created_at DESC
LIMIT 1;
```

**Expected Results**:
- `status`: 'UNCLAIMED' (if parsing succeeded) or 'PARSE_FAILED' (if both regex and AI failed)
- `parsing_method`: 'regex' or 'ai'
- `confidence_score`: 0.00 to 1.00
- `total`: Should match the receipt total

## Troubleshooting

### Issue: Trigger doesn't fire

**Check 1**: Verify trigger is enabled
```sql
SELECT tgenabled FROM pg_trigger WHERE tgname = 'trigger_parse_receipt_on_insert';
-- Should return 'O' (enabled)
```

**Check 2**: Check PostgreSQL logs for errors
```sql
-- Look for NOTICE or WARNING messages from the trigger
SELECT * FROM pg_stat_statements WHERE query LIKE '%trigger_receipt_parsing%';
```

### Issue: Edge Function not called

**Check 1**: Verify pg_net extension is working
```sql
-- Test pg_net with a simple request
SELECT net.http_get('https://httpbin.org/get');
-- Should return a request_id
```

**Check 2**: Verify configuration settings
```sql
-- Check if settings are configured
SELECT 
  current_setting('app.settings.supabase_url', true) as supabase_url,
  current_setting('app.settings.service_role_key', true) as service_key;
-- Should return your configured values (service_key will be masked)
```

**Check 3**: Check Edge Function logs
- Go to Supabase Dashboard → Edge Functions → parse-receipt → Logs
- Look for incoming requests from the trigger

### Issue: Parsing fails

**Check 1**: Verify Edge Function is deployed
```bash
# Test Edge Function directly
curl -X POST https://your-project.supabase.co/functions/v1/parse-receipt \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"receipt_id": "test-receipt-id"}'
```

**Check 2**: Check for parsing errors
```sql
-- Look for PARSE_FAILED receipts
SELECT 
  rpr.id,
  rpr.text,
  pr.status,
  pr.parsing_method
FROM raw_pos_receipts rpr
LEFT JOIN pos_receipts pr ON pr.raw_receipt_id = rpr.id
WHERE pr.status = 'PARSE_FAILED' OR pr.id IS NULL
ORDER BY rpr.created_at DESC
LIMIT 10;
```

## Performance Considerations

### Non-Blocking Design

The trigger uses `pg_net.http_post()` which is **asynchronous**:
- ✅ Receipt ingestion completes in < 100ms
- ✅ Parsing happens in background (1-5ms for regex, ~300ms for AI)
- ✅ No blocking or waiting during insert

### Error Handling

The trigger has built-in error handling:
- If Edge Function call fails, the insert still succeeds
- Errors are logged as PostgreSQL warnings
- Receipt data is never lost

### Monitoring

Monitor trigger performance:

```sql
-- Count receipts by parsing status
SELECT 
  status,
  COUNT(*) as count,
  AVG(confidence_score) as avg_confidence
FROM pos_receipts
GROUP BY status;

-- Check parsing latency
SELECT 
  pr.parsing_method,
  AVG(EXTRACT(EPOCH FROM (pr.created_at - rpr.created_at))) as avg_latency_seconds
FROM pos_receipts pr
JOIN raw_pos_receipts rpr ON pr.raw_receipt_id = rpr.id
GROUP BY pr.parsing_method;
```

## Rollback

If you need to remove the trigger:

```sql
-- Drop trigger
DROP TRIGGER IF EXISTS trigger_parse_receipt_on_insert ON raw_pos_receipts;

-- Drop function
DROP FUNCTION IF EXISTS trigger_receipt_parsing();

-- Optionally disable pg_net (not recommended, other features may use it)
-- DROP EXTENSION IF EXISTS pg_net;
```

## Next Steps

After successful installation:

1. ✅ Test with real receipts from TabezaConnect Capture Service
2. ✅ Monitor parsing success rate in Supabase Dashboard
3. ✅ Proceed to Task 5: Regex Parsing Engine
4. ✅ Proceed to Task 7: AI Fallback Parser

## Requirements Satisfied

- ✅ **Requirement 7.4**: Cloud API queues receipts for parsing asynchronously
- ✅ **Requirement 7.5**: Cloud API never parses receipts inline during ingestion

## Related Files

- `database/create-pos-receipt-capture-tables.sql` - Table definitions
- `supabase/functions/parse-receipt/index.ts` - Edge Function implementation
- `database/create-receipt-parsing-templates.sql` - Template tables

## Support

For issues or questions:
1. Check Supabase Dashboard → Database → Logs
2. Check Edge Functions → parse-receipt → Logs
3. Review this README's Troubleshooting section
