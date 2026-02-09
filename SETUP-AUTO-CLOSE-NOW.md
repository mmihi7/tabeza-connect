# Setup Automatic Tab Closure - Quick Start

## What This Does

Automatically closes or moves tabs to overdue after business hours:
- **Zero balance OR pending orders** → Close tab (cancel pending orders)
- **Positive balance with pending orders** → Move to overdue (cancel pending orders)
- **Positive balance without pending orders** → Move to overdue

## Why Every Hour?

Each venue has different closing times (10 PM, 2 AM, 11:30 PM, etc.). Running every hour catches each venue shortly after their specific closing time. The function only processes tabs that are:
- In 'open' status
- Opened today
- Currently outside business hours

So it's safe and efficient to run every hour.

## Quick Setup (2 Steps)

### Step 1: Apply the Migration in Supabase Dashboard

**You MUST use Supabase Dashboard for this (API doesn't support pg_cron setup)**

1. Go to your Supabase Dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy the entire contents of: `supabase/migrations/054_schedule_auto_close_tabs.sql`
5. Paste into the SQL Editor
6. Click "Run" (or press Ctrl+Enter)

You should see: "Success. No rows returned"

### Step 2: Verify It's Set Up

**In Supabase Dashboard SQL Editor, run:**

```sql
SELECT * FROM cron.job WHERE jobname = 'auto-close-tabs-hourly';
```

You should see:
- **jobname:** auto-close-tabs-hourly
- **schedule:** 0 * * * *
- **active:** true

**Or test the function works:**

```bash
node dev-tools/scripts/test-auto-tab-closure.js
```

This will show you what would happen to your current open tabs.

## When Will It Run?

- **First run:** Top of the next hour (e.g., if it's 10:15 PM now, it runs at 11:00 PM)
- **Subsequent runs:** Every hour at minute 0 (11:00, 12:00, 1:00, etc.)
- **What it does:** Checks ALL venues, processes tabs outside business hours

## Monitoring

### Check if job is scheduled:
```sql
SELECT * FROM cron.job WHERE jobname = 'auto-close-tabs-hourly';
```

### Check recent runs:
```sql
SELECT 
    start_time,
    status,
    return_message
FROM cron.job_run_details
WHERE jobid = (
    SELECT jobid FROM cron.job WHERE jobname = 'auto-close-tabs-hourly'
)
ORDER BY start_time DESC
LIMIT 10;
```

### Check recent auto-closures:
```sql
SELECT 
    al.created_at,
    al.action,
    al.details->>'tab_number' as tab_number,
    al.details->>'balance' as balance,
    b.name as bar_name
FROM audit_logs al
JOIN tabs t ON al.tab_id = t.id
JOIN bars b ON t.bar_id = b.id
WHERE al.action IN (
    'tab_auto_closed',
    'tab_moved_to_overdue',
    'pending_orders_auto_cancelled'
)
ORDER BY al.created_at DESC
LIMIT 20;
```

## Troubleshooting

### Job not running?

**Check if active:**
```sql
UPDATE cron.job 
SET active = true 
WHERE jobname = 'auto-close-tabs-hourly';
```

### No tabs being closed?

**Manually trigger to test:**
```sql
SELECT * FROM auto_close_tabs_outside_business_hours();
```

**Check business hours:**
```sql
SELECT 
    name,
    business_hours_mode,
    business_hours_simple
FROM bars;
```

### Need to disable temporarily?

```sql
UPDATE cron.job 
SET active = false 
WHERE jobname = 'auto-close-tabs-hourly';
```

### Need to remove completely?

```sql
SELECT cron.unschedule('auto-close-tabs-hourly');
```

## Files Reference

- **Migration:** `supabase/migrations/054_schedule_auto_close_tabs.sql`
- **Function:** `supabase/migrations/053_automatic_tab_closure.sql`
- **Verify Script:** `dev-tools/scripts/verify-auto-close-schedule.js`
- **Test Script:** `dev-tools/scripts/test-auto-tab-closure.js`
- **Setup Script:** `dev-tools/scripts/setup-auto-close-schedule.js`
- **Full Docs:** `dev-tools/docs/auto-close-schedule-setup.md`
- **Summary:** `AUTO-CLOSE-SCHEDULE-COMPLETE.md`

## That's It!

Once you apply the migration, the system will automatically close or move tabs to overdue every hour. No further action needed!

Check the audit_logs table to see it working.
