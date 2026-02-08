# Unmatched Receipts Table Migration

## Overview

The `unmatched_receipts` table is the core database component for the **POS Receipt Assignment Modal** feature. This table stores receipts intercepted from POS systems that are awaiting assignment to customer tabs via the Staff PWA.

## Purpose

In **Tabeza Basic** and **Tabeza Venue (POS Authority)** modes:
- POS systems print receipts to the Tabeza virtual printer
- Receipts are intercepted and sent to the cloud
- Staff receive real-time notifications in the browser
- Staff assign receipts to customer tabs via modal interface
- Customers receive digital receipts on their devices

**CORE TRUTH**: Manual service always exists. Digital authority is singular. Tabeza adapts to the venue — never the reverse.

## Table Schema

```sql
CREATE TABLE unmatched_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
  receipt_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  assigned_to_tab_id UUID REFERENCES tabs(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour')
);
```

### Columns

- **id**: Unique identifier for the receipt
- **bar_id**: Reference to the venue (enforces venue isolation)
- **receipt_data**: Complete receipt information in JSONB format
- **status**: Current state (`pending`, `assigned`, `expired`)
- **created_at**: When the receipt was intercepted
- **assigned_at**: When the receipt was assigned to a tab (auto-set by trigger)
- **assigned_to_tab_id**: Reference to the customer tab (if assigned)
- **expires_at**: Expiration timestamp (1 hour from creation)

### Receipt Data Format

The `receipt_data` JSONB column contains:

```json
{
  "venueName": "Joe's Bar",
  "timestamp": "2024-01-15T14:30:00.000Z",
  "items": [
    {
      "name": "Tusker Lager",
      "quantity": 2,
      "unitPrice": 250,
      "total": 500
    }
  ],
  "subtotal": 1450,
  "tax": 232,
  "total": 1682
}
```

## Indexes

Performance-optimized indexes for common queries:

- `idx_unmatched_receipts_bar_status` - Fast filtering by venue and status
- `idx_unmatched_receipts_expires` - Efficient expiration cleanup
- `idx_unmatched_receipts_created_at` - Chronological ordering
- `idx_unmatched_receipts_assigned_tab` - Tab assignment lookups

## Triggers and Functions

### Auto-Assignment Timestamp

```sql
CREATE TRIGGER trigger_update_receipt_assigned_at
  BEFORE UPDATE ON unmatched_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_receipt_assigned_at();
```

Automatically sets `assigned_at` when status changes to `assigned`.

### Expiration Function

```sql
CREATE FUNCTION expire_old_receipts() RETURNS void
```

Marks receipts older than 1 hour as `expired`. Can be called manually or via cron job.

## Row Level Security (RLS)

### Policies

1. **Bar Staff Select**: Staff can view receipts for their venues only
2. **System Insert**: Printer service can insert receipts (authenticated via service key)
3. **Bar Staff Update**: Staff can update receipts for assignment

### Security Model

- Venue isolation enforced at database level
- Staff must be associated with venue via `user_bars` table
- Printer service uses service role key for inserts
- Customer data never exposed to unauthorized users

## Supabase Realtime

### Configuration

Enable Realtime in Supabase Dashboard:
1. Go to **Database > Replication**
2. Enable replication for `unmatched_receipts` table
3. Or run: `ALTER PUBLICATION supabase_realtime ADD TABLE unmatched_receipts;`

### Event Types

The Staff PWA subscribes to:
- **INSERT** events: New receipts from POS
- Filtered by `bar_id` for venue isolation
- Triggers modal display within 500ms

## Migration Steps

### 1. Apply Schema

```bash
node database/apply-unmatched-receipts-migration.js
```

This script:
- Creates the table with all columns and indexes
- Sets up triggers and functions
- Configures RLS policies
- Inserts sample data for testing
- Verifies table structure

### 2. Enable Realtime

In Supabase Dashboard:
- Database > Replication
- Enable for `unmatched_receipts`

Or via SQL:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE unmatched_receipts;
```

### 3. Test Realtime

```bash
# Terminal 1: Listen for events
node dev-tools/scripts/test-unmatched-receipts-realtime.js

# Terminal 2: Insert test receipt
node dev-tools/scripts/insert-test-receipt.js
```

### 4. Verify

```bash
node dev-tools/scripts/verify-unmatched-receipts.js
```

## Usage Examples

### Insert Receipt (from Printer Service)

```javascript
const { data, error } = await supabase
  .from('unmatched_receipts')
  .insert({
    bar_id: 'venue-uuid',
    receipt_data: {
      venueName: 'Joe\'s Bar',
      timestamp: new Date().toISOString(),
      items: [...],
      subtotal: 1450,
      tax: 232,
      total: 1682
    }
  })
  .select()
  .single();
```

### Query Pending Receipts (Staff PWA)

```javascript
const { data, error } = await supabase
  .from('unmatched_receipts')
  .select('*')
  .eq('bar_id', venueId)
  .eq('status', 'pending')
  .order('created_at', { ascending: false });
```

### Assign Receipt to Tab

```javascript
const { data, error } = await supabase
  .from('unmatched_receipts')
  .update({
    status: 'assigned',
    assigned_to_tab_id: tabId
  })
  .eq('id', receiptId)
  .select()
  .single();
```

### Subscribe to Real-Time Events

```javascript
const channel = supabase
  .channel('receipts')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'unmatched_receipts',
      filter: `bar_id=eq.${venueId}`
    },
    (payload) => {
      // Show modal with payload.new
    }
  )
  .subscribe();
```

## Monitoring

### Statistics View

```sql
SELECT * FROM unmatched_receipt_stats;
```

Returns per-venue statistics:
- Pending count
- Assigned count
- Expired count
- Average assignment time
- Last receipt timestamp

### Common Queries

```sql
-- Receipts awaiting assignment
SELECT COUNT(*) FROM unmatched_receipts 
WHERE status = 'pending' AND bar_id = 'venue-uuid';

-- Assignment success rate (last 24 hours)
SELECT 
  COUNT(*) FILTER (WHERE status = 'assigned') * 100.0 / COUNT(*) as success_rate
FROM unmatched_receipts
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Expired receipts (need attention)
SELECT COUNT(*) FROM unmatched_receipts 
WHERE status = 'expired' AND created_at > NOW() - INTERVAL '24 hours';
```

## Maintenance

### Cleanup Old Receipts

```sql
-- Mark expired receipts
SELECT expire_old_receipts();

-- Delete old receipts (older than 7 days)
DELETE FROM unmatched_receipts 
WHERE created_at < NOW() - INTERVAL '7 days';
```

### Performance Monitoring

```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'unmatched_receipts';

-- Check table size
SELECT pg_size_pretty(pg_total_relation_size('unmatched_receipts'));
```

## Troubleshooting

### Realtime Not Working

1. **Check Replication**: Verify table is in replication publication
   ```sql
   SELECT * FROM pg_publication_tables WHERE tablename = 'unmatched_receipts';
   ```

2. **Check RLS Policies**: Ensure policies allow SELECT for staff
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'unmatched_receipts';
   ```

3. **Test Connection**: Run `test-unmatched-receipts-realtime.js`

### Receipts Not Appearing

1. **Check Bar ID**: Verify `bar_id` matches venue
2. **Check Status**: Ensure status is `pending`
3. **Check Expiration**: Verify `expires_at` is in future
4. **Check RLS**: Ensure user has access to venue

### Performance Issues

1. **Check Indexes**: Verify indexes are being used
2. **Cleanup Old Data**: Delete receipts older than 7 days
3. **Monitor Table Size**: Keep table under 100k rows
4. **Optimize Queries**: Use indexes in WHERE clauses

## Related Tables

- **bars**: Venue information (venue_mode, authority_mode)
- **tabs**: Customer tabs for assignment
- **tab_orders**: Orders created from assigned receipts
- **print_jobs**: Raw print data from printer service
- **digital_receipts**: Final delivered receipts

## Authority Mode Constraints

### Basic Mode (POS Authority)
- ✅ Receipts flow: POS → Printer → Cloud → Modal → Tab
- ✅ Staff assigns via modal
- ❌ Staff cannot create orders in Tabeza
- ✅ Printer drivers required

### Venue Mode (POS Authority)
- ✅ Receipts flow: POS → Printer → Cloud → Modal → Tab
- ✅ Customer can request orders
- ❌ Staff cannot create orders in Tabeza
- ⚠️ Printer drivers optional but recommended

### Venue Mode (Tabeza Authority)
- ❌ This table not used
- ✅ Tabeza creates orders directly
- ❌ No POS integration

## Next Steps

After migration:
1. ✅ Enable Realtime in Supabase Dashboard
2. ✅ Test with `test-unmatched-receipts-realtime.js`
3. ✅ Implement Staff PWA modal component
4. ✅ Connect printer service to cloud API
5. ✅ Test end-to-end flow with real POS

## Support

For issues or questions:
- Check Supabase logs for errors
- Review RLS policies for access issues
- Monitor `unmatched_receipt_stats` view
- Test with provided scripts in `dev-tools/scripts/`
