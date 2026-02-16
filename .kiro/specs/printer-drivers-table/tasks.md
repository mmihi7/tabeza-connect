# Printer Driver Management - Tasks

## Task List

- [x] 1. Fix Driver ID Generation in TabezaConnect
  - [x] 1.1 Update `generateDriverId()` to remove timestamp
  - [x] 1.2 Remove driver_id persistence logic (no longer needed)
  - [x] 1.3 Rebuild TabezaService.exe with pkg
  - [x] 1.4 Test driver ID consistency across restarts

- [x] 2. Clean Up Existing Stale Drivers
  - [x] 2.1 Identify stale drivers in database
  - [x] 2.2 Delete stale drivers manually
  - [x] 2.3 Verify only active drivers remain

- [x] 3. Create Stale Driver Cleanup Job
  - [x] 3.1 Create cleanup function/script
  - [x] 3.2 Test cleanup logic
  - [x] 3.3 Schedule daily execution
  - [x] 3.4 Add logging

- [x] 4. Update Staff App Queries
  - [x] 4.1 Add function to get active drivers only
  - [x] 4.2 Update UI to show active drivers
  - [x] 4.3 Add option to view all drivers (debug)
  - [x] 4.4 Add visual indicator for online/offline

- [x] 5. Test End-to-End
  - [x] 5.1 Start TabezaConnect service
  - [x] 5.2 Verify driver registers with hostname-only ID
  - [x] 5.3 Restart service
  - [x] 5.4 Verify same driver record is updated
  - [x] 5.5 Verify no new records created

## Task Details

### 1. Fix Driver ID Generation in TabezaConnect

**Goal:** Remove timestamp from driver ID to ensure consistency across restarts.

**File:** `TabezaConnect/src/service/index.js`

**Changes:**

**1.1 Update generateDriverId() function:**

Find (line ~22):
```javascript
function generateDriverId() {
  const { hostname } = require('os');
  return `driver-${hostname()}-${Date.now()}`;
}
```

Replace with:
```javascript
function generateDriverId() {
  const { hostname } = require('os');
  return `driver-${hostname()}`;
}
```

**1.2 Remove driver_id persistence logic:**

The service currently tries to save/load driver_id from config.json. This is no longer needed since the driver_id is deterministic (based on hostname only).

Find (around line 700-720):
```javascript
// Try to load saved driver_id from config file if it exists
try {
  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (savedConfig.driverId) {
      config.driverId = savedConfig.driverId;
      console.log('✅ Reusing existing driver ID from config file');
    }
  }
} catch (error) {
  // Ignore errors - will generate new driver_id
}
```

Remove this entire block (it's no longer needed).

**1.3 Rebuild TabezaService.exe:**

```batch
cd c:\Projects\TabezaConnect
pkg src\service\index.js --target node18-win-x64 --output TabezaService.exe
```

**1.4 Test driver ID consistency:**

1. Start service: `TabezaService.exe`
2. Note the driver_id in console output
3. Stop service (Ctrl+C)
4. Start service again
5. Verify driver_id is the same

**Acceptance Criteria:**
- generateDriverId() returns hostname-only ID
- Driver ID is consistent across restarts
- No timestamp in driver ID
- Service compiles successfully

### 2. Clean Up Existing Stale Drivers

**Goal:** Remove old driver records from database.

**Steps:**

**2.1 Identify stale drivers:**

Query database:
```sql
select * from printer_drivers
where bar_id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'
order by last_heartbeat desc;
```

Current stale drivers:
- `test-driver-id` (last heartbeat: Feb 12)
- `driver-MIHI-PC-1770655896151` (last heartbeat: Feb 12)

**2.2 Delete stale drivers:**

```sql
delete from printer_drivers
where bar_id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'
  and driver_id in (
    'test-driver-id',
    'driver-MIHI-PC-1770655896151'
  );
```

**2.3 Verify cleanup:**

```sql
select * from printer_drivers
where bar_id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
```

Should return empty result (or only the new hostname-only driver after restart).

**Acceptance Criteria:**
- Stale drivers identified
- Stale drivers deleted
- Database clean

### 3. Create Stale Driver Cleanup Job

**Goal:** Automate cleanup of drivers with no heartbeat for >7 days.

**Option A: Supabase Edge Function**

Create file: `supabase/functions/cleanup-stale-drivers/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('printer_drivers')
      .delete()
      .lt('last_heartbeat', sevenDaysAgo)
      .select();
    
    if (error) throw error;
    
    console.log(`Cleaned up ${data.length} stale drivers:`, data);
    
    return new Response(
      JSON.stringify({ success: true, count: data.length, drivers: data }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

**Option B: Node.js Script**

Create file: `Tabz/dev-tools/scripts/cleanup-stale-drivers.js`

```javascript
const { createClient } = require('@supabase/supabase-js');

async function cleanupStaleDrivers() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
  );
  
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('printer_drivers')
    .delete()
    .lt('last_heartbeat', sevenDaysAgo)
    .select();
  
  if (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  }
  
  console.log(`✅ Cleaned up ${data.length} stale drivers`);
  data.forEach(driver => {
    console.log(`   - ${driver.driver_id} (last heartbeat: ${driver.last_heartbeat})`);
  });
}

cleanupStaleDrivers();
```

**Schedule:** Use cron, Windows Task Scheduler, or Supabase cron to run daily at 3 AM.

**Acceptance Criteria:**
- Cleanup function created
- Function deletes drivers >7 days old
- Function logs cleanup actions
- Scheduled to run daily

### 4. Update Staff App Queries

**Goal:** Show only active drivers in staff app.

**File:** Create `Tabz/packages/shared/lib/services/printer-driver-queries.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const ACTIVE_THRESHOLD_MINUTES = 5;

export async function getActiveDrivers(barId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
  
  const thresholdTime = new Date(
    Date.now() - ACTIVE_THRESHOLD_MINUTES * 60 * 1000
  ).toISOString();
  
  const { data, error } = await supabase
    .from('printer_drivers')
    .select('*')
    .eq('bar_id', barId)
    .gte('last_heartbeat', thresholdTime)
    .order('last_heartbeat', { ascending: false });
  
  return { data, error };
}

export async function getAllDrivers(barId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
  
  const { data, error } = await supabase
    .from('printer_drivers')
    .select('*')
    .eq('bar_id', barId)
    .order('last_heartbeat', { ascending: false });
  
  return { data, error };
}

export function isDriverActive(lastHeartbeat: string): boolean {
  const heartbeatTime = new Date(lastHeartbeat).getTime();
  const now = Date.now();
  const diffMinutes = (now - heartbeatTime) / (60 * 1000);
  
  return diffMinutes <= ACTIVE_THRESHOLD_MINUTES;
}
```

**Acceptance Criteria:**
- Query functions created
- Active drivers filtered by 5-minute threshold
- Helper function to check driver status
- Exported for use in staff app

### 5. Test End-to-End

**Goal:** Verify the complete fix works as expected.

**Test Steps:**

**5.1 Start TabezaConnect service:**
```batch
cd c:\Projects\TabezaConnect
TabezaService.exe
```

**5.2 Verify driver registers:**
- Check console output for driver_id
- Should be: `driver-MIHI-PC` (no timestamp)
- Query database:
  ```sql
  select * from printer_drivers
  where bar_id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
  ```
- Should show one record with `driver_id = 'driver-MIHI-PC'`

**5.3 Restart service:**
- Stop service (Ctrl+C)
- Wait 10 seconds
- Start service again

**5.4 Verify same driver record updated:**
- Query database again
- Should still show only one record
- `last_heartbeat` should be updated
- `driver_id` should be the same

**5.5 Verify no new records created:**
- Count records:
  ```sql
  select count(*) from printer_drivers
  where bar_id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';
  ```
- Should return 1 (not 2 or 3)

**Acceptance Criteria:**
- Driver ID is hostname-only
- Same driver record updated on restart
- No new records created
- Heartbeat continues working
- Staff app can query active drivers

## Testing Checklist

### Manual Testing
- [ ] Update generateDriverId() function
- [ ] Remove driver_id persistence code
- [ ] Rebuild TabezaService.exe
- [ ] Test driver ID consistency
- [ ] Clean up stale drivers
- [ ] Create cleanup job
- [ ] Update staff app queries
- [ ] Test end-to-end flow

### Integration Testing
- [ ] Test heartbeat with hostname-only driver ID
- [ ] Test driver record upsert behavior
- [ ] Test cleanup job deletes old drivers
- [ ] Test active driver queries
- [ ] Test staff app displays active drivers

### Production Verification
- [ ] Deploy updated TabezaService.exe
- [ ] Monitor heartbeat logs
- [ ] Verify no new stale drivers accumulate
- [ ] Verify cleanup job runs daily
- [ ] Monitor for 7 days

## Success Criteria

- ✅ Driver ID is hostname-only (no timestamp)
- ✅ Same driver record updated on restart
- ✅ No stale driver accumulation
- ✅ Cleanup job removes old drivers
- ✅ Staff app shows active drivers only
- ✅ No database errors

## Estimated Time

- Task 1: 30 minutes (fix driver ID generation)
- Task 2: 15 minutes (clean up stale drivers)
- Task 3: 1 hour (create cleanup job)
- Task 4: 1 hour (update staff app queries)
- Task 5: 30 minutes (test end-to-end)

**Total: ~3 hours**
