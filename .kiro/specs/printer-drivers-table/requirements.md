# Printer Driver Management - Requirements

## Overview
The Tabeza staff app tracks printer service instances (drivers) via the `printer_drivers` table. However, there are issues with driver ID persistence and stale driver cleanup that need to be addressed.

## Problem Statement
- TabezaConnect generates a new driver_id on each restart (includes timestamp)
- This creates multiple stale driver records in the database
- Old drivers accumulate and clutter the system
- Difficult to identify which driver is currently active
- Service tries to persist driver_id but path is incorrect for PKG executables

## User Stories

### 1. As a venue owner, I want my printer service to maintain a consistent identity
**Acceptance Criteria:**
- 1.1 Driver ID persists across service restarts
- 1.2 Same machine always uses the same driver_id
- 1.3 Driver ID is based on hostname only (no timestamp)
- 1.4 Service reuses existing driver record instead of creating new ones

### 2. As a system administrator, I want stale drivers to be cleaned up automatically
**Acceptance Criteria:**
- 2.1 Drivers with no heartbeat for >7 days are automatically deleted
- 2.2 Cleanup runs daily via scheduled job
- 2.3 Cleanup logs which drivers were removed
- 2.4 Active drivers are never deleted

### 3. As a venue owner, I want to see only active printer services
**Acceptance Criteria:**
- 3.1 Staff app displays drivers with heartbeat in last 5 minutes
- 3.2 Stale drivers (>5 minutes) are hidden from main view
- 3.3 Option to view all drivers including stale ones
- 3.4 Clear visual indicator for online vs offline status

## Technical Context

### Current State
- `printer_drivers` table exists with correct schema
- TabezaConnect service sends heartbeat every 30 seconds
- Driver ID includes timestamp: `driver-${hostname()}-${Date.now()}`
- Each restart creates a new driver_id
- Old drivers accumulate in database (currently 2+ stale drivers)

### Required Changes
- Fix driver ID generation to exclude timestamp
- Use hostname-based driver ID: `driver-${hostname()}`
- Ensure driver_id persists across restarts
- Add cleanup job to remove stale drivers (>7 days)
- Update staff app to show only active drivers

## Implementation Requirements

### 1. Fix Driver ID Generation
**Current:**
```javascript
function generateDriverId() {
  const { hostname } = require('os');
  return `driver-${hostname()}-${Date.now()}`; // ❌ Includes timestamp
}
```

**Required:**
```javascript
function generateDriverId() {
  const { hostname } = require('os');
  return `driver-${hostname()}`; // ✅ Hostname only
}
```

### 2. Add Stale Driver Cleanup
**Create cleanup function:**
- Delete drivers with `last_heartbeat` older than 7 days
- Run daily via cron job or scheduled task
- Log cleanup actions

**SQL:**
```sql
delete from printer_drivers
where last_heartbeat < now() - interval '7 days';
```

### 3. Update Staff App Queries
**Show only active drivers (heartbeat within 5 minutes):**
```typescript
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

const { data: activeDrivers } = await supabase
  .from('printer_drivers')
  .select('*')
  .eq('bar_id', barId)
  .gte('last_heartbeat', fiveMinutesAgo)
  .order('last_heartbeat', { ascending: false });
```

## Dependencies
- Supabase database access
- Existing `bars` table
- Existing heartbeat endpoint code

## Success Criteria
- ✅ `printer_drivers` table exists in database
- ✅ Heartbeat endpoint successfully stores driver information
- ✅ No database errors when heartbeat is received
- ✅ Staff app can query and display connected drivers
- ✅ Drivers are properly associated with bars
- ✅ Stale drivers can be identified (last_heartbeat > 2 minutes ago)

## Out of Scope
- UI for displaying printer drivers (separate feature)
- Driver management features (restart, configure, etc.)
- Print job queue management
- Receipt processing logic

## References
- Heartbeat endpoint: `Tabz/apps/staff/app/api/printer/heartbeat/route.ts`
- TabezaConnect service: `TabezaConnect/src/service/index.js`
- Database tables documentation: `Tabz/.kiro/steering/tables.md`
