# Apply Migration 057 - Fix Old Tab Closure

## Problem
The 2 Popos tabs from yesterday (opened 17-19h ago) haven't been closed because:
- They were opened yesterday at ~3 PM
- Should have closed at 01:55 AM today
- But Popos reopened at 09:30 AM today
- At 11:27 AM (current time), Popos is OPEN (within business hours)
- Current function only closes tabs when venue is CURRENTLY outside business hours
- So tabs from yesterday don't get closed if venue reopens before hourly cron runs

## Solution
Migration 057 adds logic to close old tabs (>24h) with zero balance regardless of current business hours.

## Steps to Apply

### 1. Open Supabase Dashboard
Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new

### 2. Copy and Paste Migration 057
The migration is in: `supabase/migrations/057_close_old_tabs_regardless_of_hours.sql`

Copy the entire contents and paste into the SQL Editor.

### 3. Run the Migration
Click "Run" button in the SQL Editor.

### 4. Verify Migration Applied
Run this query to check:
```sql
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'auto_close_tabs_outside_business_hours'
AND routine_schema = 'public';
```

You should see the updated function definition with the new logic.

### 5. Test the Function Manually
Run this to close the 2 Popos tabs:
```sql
SELECT * FROM auto_close_tabs_outside_business_hours();
```

Expected result:
```
tabs_closed: 2
tabs_moved_to_overdue: 0
pending_orders_cancelled: 0
```

### 6. Verify Tabs Are Closed
Check the Popos tabs:
```sql
SELECT 
    t.id,
    t.tab_number,
    t.status,
    t.opened_at,
    t.closed_at,
    t.closed_by,
    EXTRACT(EPOCH FROM (NOW() - t.opened_at)) / 3600 as age_hours,
    b.name as bar_name
FROM tabs t
JOIN bars b ON t.bar_id = b.id
WHERE b.name = 'Popos'
ORDER BY t.opened_at DESC
LIMIT 5;
```

Both tabs should now show:
- `status = 'closed'`
- `closed_by = 'system'`
- `closed_at` = current timestamp

### 7. Check Audit Logs
Verify the closure was logged:
```sql
SELECT 
    action,
    details,
    created_at
FROM audit_logs
WHERE action = 'tab_auto_closed'
AND details->>'reason' = 'old_tab_zero_balance'
ORDER BY created_at DESC
LIMIT 5;
```

## What Changed

### Before (Migration 053-056)
```sql
-- Only processed tabs if:
IF NOT is_within_business_hours_at_time(v_tab.bar_id, NOW()) 
   AND DATE(v_tab.opened_at) = CURRENT_DATE THEN
```

This meant:
- Only tabs opened TODAY
- Only when venue is CURRENTLY closed
- Old tabs from yesterday were ignored

### After (Migration 057)
```sql
-- Check if tab is old (>24h)
v_is_old_tab := (NOW() - v_tab.opened_at) > INTERVAL '24 hours';

-- Process tab if:
IF (v_is_old_tab AND v_balance <= 0) OR 
   (NOT is_within_business_hours_at_time(v_tab.bar_id, NOW())) THEN
```

This means:
- Tabs >24h old with zero balance are closed regardless of current hours
- Current-day tabs are still processed when outside business hours
- Handles both scenarios correctly

## Hourly Cron Job
The cron job (scheduled in migration 054) will now:
1. Close old tabs (>24h) with zero balance at ANY time
2. Close/move current-day tabs when outside business hours
3. Run every hour to catch different venue closing times

## Expected Behavior Going Forward

### Scenario 1: Tab opened today
- Opens at 3 PM
- Venue closes at 1:55 AM
- Cron runs at 2 AM → Tab closed (if zero balance) or moved to overdue (if balance)

### Scenario 2: Tab from yesterday (your case)
- Opened yesterday at 3 PM
- Should have closed at 1:55 AM today
- Venue reopened at 9:30 AM today
- Cron runs at 10 AM → Tab closed (because >24h old with zero balance)
- No longer depends on current business hours status

### Scenario 3: Multi-day tab with balance
- Opened 2 days ago
- Has outstanding balance
- Will be moved to overdue when outside business hours
- Staff can then decide to close or keep open

## Success Criteria
✅ Migration 057 applied successfully
✅ 2 Popos tabs closed
✅ Audit logs show closure reason: "old_tab_zero_balance"
✅ Hourly cron will now handle both old tabs and current-day tabs
