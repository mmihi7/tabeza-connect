# Printer Driver Management - Design

## Architecture Overview

This feature fixes driver ID persistence issues and adds cleanup for stale drivers. The `printer_drivers` table already exists, but the driver ID generation needs to be fixed to prevent accumulation of stale records.

## Current State

### Existing Table: printer_drivers

The table already exists with the correct schema:

```sql
create table public.printer_drivers (
  id uuid not null default gen_random_uuid(),
  bar_id uuid not null,
  driver_id text not null,
  version text not null,
  status text not null default 'online',
  last_heartbeat timestamp with time zone not null default now(),
  first_seen timestamp with time zone not null default now(),
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  
  constraint printer_drivers_pkey primary key (id),
  constraint printer_drivers_driver_id_key unique (driver_id),
  constraint printer_drivers_bar_id_fkey foreign key (bar_id) 
    references bars (id) on delete cascade,
  constraint printer_drivers_status_check check (
    status = any (array['online'::text, 'offline'::text, 'error'::text])
  )
);
```

### Problem: Driver ID Generation

**Current implementation** (TabezaConnect/src/service/index.js):
```javascript
function generateDriverId() {
  const { hostname } = require('os');
  return `driver-${hostname()}-${Date.now()}`; // ❌ Includes timestamp
}
```

**Issues:**
- Creates new driver_id on every restart
- Accumulates stale driver records
- Makes it hard to identify active driver
- Wastes database space

**Example:**
- First start: `driver-MIHI-PC-1770655896151`
- Second start: `driver-MIHI-PC-1771173052946`
- Third start: `driver-MIHI-PC-1771234567890`
- Result: 3 records for the same machine!

## Solution Design

### 1. Fix Driver ID Generation

**New implementation:**
```javascript
function generateDriverId() {
  const { hostname } = require('os');
  return `driver-${hostname()}`; // ✅ Hostname only, no timestamp
}
```

**Benefits:**
- Same driver_id across restarts
- Upsert updates existing record
- No stale driver accumulation
- Easy to identify which machine

**Example:**
- First start: `driver-MIHI-PC`
- Second start: `driver-MIHI-PC` (same!)
- Third start: `driver-MIHI-PC` (same!)
- Result: 1 record, always updated

### 2. Add Stale Driver Cleanup

**Create cleanup function** (Supabase Edge Function or cron job):

```typescript
// cleanup-stale-drivers.ts
import { createClient } from '@supabase/supabase-js';

export async function cleanupStaleDrivers() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
  
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('printer_drivers')
    .delete()
    .lt('last_heartbeat', sevenDaysAgo)
    .select();
  
  if (error) {
    console.error('Cleanup failed:', error);
    return { success: false, error };
  }
  
  console.log(`Cleaned up ${data.length} stale drivers`);
  return { success: true, count: data.length, drivers: data };
}
```

**Schedule:** Run daily at 3 AM via Supabase cron or external scheduler.

### 3. Update Staff App Queries

**Show only active drivers (heartbeat within 5 minutes):**

```typescript
// Get active drivers for a bar
async function getActiveDrivers(barId: string) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('printer_drivers')
    .select('*')
    .eq('bar_id', barId)
    .gte('last_heartbeat', fiveMinutesAgo)
    .order('last_heartbeat', { ascending: false });
  
  return { data, error };
}

// Get all drivers (including stale) for debugging
async function getAllDrivers(barId: string) {
  const { data, error } = await supabase
    .from('printer_drivers')
    .select('*')
    .eq('bar_id', barId)
    .order('last_heartbeat', { ascending: false });
  
  return { data, error };
}
```

## Migration Strategy

### Migration File: `058_printer_drivers_table.sql`

```sql
-- Migration: Add printer_drivers table
-- Purpose: Track TabezaConnect printer service instances
-- Date: 2026-02-15

-- Create table
create table public.printer_drivers (
  id uuid not null default gen_random_uuid(),
  bar_id uuid not null,
  driver_id text not null,
  version text not null,
  status text not null default 'online',
  last_heartbeat timestamp with time zone not null,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  
  constraint printer_drivers_pkey primary key (id),
  constraint printer_drivers_driver_id_key unique (driver_id),
  constraint printer_drivers_bar_id_fkey foreign key (bar_id) 
    references bars (id) on delete cascade,
  constraint printer_drivers_status_check check (
    status = any (array['online'::text, 'offline'::text, 'error'::text])
  )
) tablespace pg_default;

-- Create indexes
create index idx_printer_drivers_bar_id 
  on public.printer_drivers using btree (bar_id);

create index idx_printer_drivers_last_heartbeat 
  on public.printer_drivers using btree (last_heartbeat desc);

create index idx_printer_drivers_status 
  on public.printer_drivers using btree (status);

create index idx_printer_drivers_bar_status 
  on public.printer_drivers using btree (bar_id, status);

-- Create trigger for updated_at
create trigger update_printer_drivers_updated_at 
  before update on printer_drivers 
  for each row 
  execute function update_updated_at_column();

-- Enable RLS
alter table public.printer_drivers enable row level security;

-- RLS Policy: Users can view drivers for their bars
create policy "Users can view drivers for their bars"
  on public.printer_drivers
  for select
  using (
    bar_id in (
      select bar_id 
      from user_bars 
      where user_id = auth.uid()
    )
  );

-- RLS Policy: Service role can manage all drivers
create policy "Service role can manage all drivers"
  on public.printer_drivers
  for all
  using (auth.jwt()->>'role' = 'service_role')
  with check (auth.jwt()->>'role' = 'service_role');

-- Add comment
comment on table public.printer_drivers is 
  'Tracks TabezaConnect printer service instances and their heartbeat status';
```

## API Integration

### Existing Heartbeat Endpoint

The heartbeat endpoint at `/api/printer/heartbeat` already has the correct logic:

```typescript
// Upsert driver record
const { data: driver, error: upsertError } = await supabase
  .from('printer_drivers')
  .upsert({
    bar_id: barId,
    driver_id: driverId,
    version,
    status: status || 'online',
    last_heartbeat: now,
    metadata: metadata || {},
    updated_at: now,
  }, {
    onConflict: 'driver_id',
  })
  .select()
  .single();
```

No changes needed to the endpoint - it will work once the table exists.

## Query Patterns

### Get All Drivers for a Bar

```typescript
const { data: drivers } = await supabase
  .from('printer_drivers')
  .select('*')
  .eq('bar_id', barId)
  .order('last_heartbeat', { ascending: false });
```

### Get Online Drivers Only

```typescript
const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

const { data: onlineDrivers } = await supabase
  .from('printer_drivers')
  .select('*')
  .eq('bar_id', barId)
  .eq('status', 'online')
  .gte('last_heartbeat', twoMinutesAgo);
```

### Mark Stale Drivers as Offline

```typescript
const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

const { data: staleDrivers } = await supabase
  .from('printer_drivers')
  .update({ status: 'offline' })
  .eq('bar_id', barId)
  .eq('status', 'online')
  .lt('last_heartbeat', twoMinutesAgo)
  .select();
```

## Performance Considerations

### Index Usage
- `idx_printer_drivers_bar_id`: Used for filtering by bar
- `idx_printer_drivers_last_heartbeat`: Used for finding stale drivers
- `idx_printer_drivers_status`: Used for filtering by status
- `idx_printer_drivers_bar_status`: Composite index for common queries

### Expected Load
- Heartbeat every 30 seconds per driver
- Typical venue: 1-2 drivers
- High-volume venue: 5-10 drivers
- Database writes: ~2-20 per minute per venue
- Very low load, no performance concerns

### Cleanup Strategy
- No automatic cleanup needed (drivers update existing records)
- Optional: Archive drivers with no heartbeat for >30 days
- Optional: Delete drivers when bar is deleted (CASCADE handles this)

## Security Considerations

### RLS Policies
- Users can only see drivers for bars they have access to
- Service role (API endpoints) can manage all drivers
- No direct client access to table (all via API)

### Data Validation
- Heartbeat endpoint validates bar_id exists
- Status constrained to valid values
- driver_id must be unique
- All required fields enforced by NOT NULL

## Testing Strategy

### Unit Tests
- Test heartbeat endpoint with valid payload
- Test heartbeat endpoint with invalid bar_id
- Test heartbeat endpoint with missing fields
- Test upsert behavior (new vs existing driver)

### Integration Tests
- Test full heartbeat flow from TabezaConnect to database
- Test driver status detection (online vs offline)
- Test RLS policies (user can only see their bars' drivers)

### Manual Testing
1. Start TabezaConnect service with valid bar_id
2. Verify heartbeat appears in printer_drivers table
3. Stop service and wait 2 minutes
4. Verify driver marked as offline
5. Restart service
6. Verify driver marked as online again

## Rollback Plan

If issues arise, rollback is simple:

```sql
-- Drop table (CASCADE will handle foreign keys)
drop table if exists public.printer_drivers cascade;
```

The heartbeat endpoint will return errors, but TabezaConnect will continue running and retry. No data loss.

## Future Enhancements

### Phase 2: Driver Management UI
- Display connected drivers in staff app
- Show driver status (online/offline)
- Show last heartbeat time
- Show driver metadata (hostname, platform)

### Phase 3: Driver Actions
- Restart driver remotely
- Update driver configuration
- View driver logs
- Test print from staff app

### Phase 4: Analytics
- Track driver uptime
- Alert on driver offline
- Monitor heartbeat failures
- Driver performance metrics

## Correctness Properties

### Property 1: Heartbeat Idempotency
**Statement:** Sending the same heartbeat multiple times produces the same result as sending it once.

**Validation:** 
- Send heartbeat with driver_id "test-driver-1"
- Send same heartbeat again
- Verify only one record exists in database
- Verify last_heartbeat is updated

### Property 2: Bar Association Integrity
**Statement:** Every driver record must be associated with a valid bar.

**Validation:**
- Attempt to insert driver with non-existent bar_id
- Verify foreign key constraint prevents insertion
- Verify heartbeat endpoint returns 400 error

### Property 3: Status Constraint
**Statement:** Driver status must always be one of: 'online', 'offline', 'error'.

**Validation:**
- Attempt to insert driver with invalid status
- Verify check constraint prevents insertion
- Verify only valid statuses can be stored

### Property 4: Unique Driver ID
**Statement:** No two drivers can have the same driver_id.

**Validation:**
- Insert driver with driver_id "test-driver-1"
- Attempt to insert different driver with same driver_id
- Verify unique constraint prevents insertion
- Verify upsert updates existing record instead

### Property 5: Timestamp Monotonicity
**Statement:** last_heartbeat timestamp should never decrease for a given driver.

**Validation:**
- Send heartbeat at time T1
- Send heartbeat at time T2 (T2 > T1)
- Verify last_heartbeat is T2
- Attempt to send heartbeat with T0 (T0 < T1)
- Verify last_heartbeat remains T2 (or updates to current time)

## Implementation Notes

### Migration Execution
1. Create migration file: `database/migrations/058_printer_drivers_table.sql`
2. Test migration in local Supabase instance
3. Apply to staging environment
4. Verify heartbeat endpoint works
5. Apply to production environment

### Deployment Steps
1. Apply database migration
2. Verify table exists: `select * from printer_drivers limit 1;`
3. Test heartbeat endpoint with curl
4. Monitor logs for errors
5. Verify TabezaConnect services reconnect successfully

### Monitoring
- Monitor heartbeat endpoint error rate
- Alert if error rate > 5%
- Monitor database table size
- Alert if table grows unexpectedly large

## Success Metrics
- ✅ Zero database errors from heartbeat endpoint
- ✅ All connected drivers appear in printer_drivers table
- ✅ Driver status accurately reflects connection state
- ✅ Heartbeat endpoint response time < 100ms
- ✅ No RLS policy violations
