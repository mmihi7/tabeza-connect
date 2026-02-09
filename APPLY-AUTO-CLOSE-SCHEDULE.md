# Apply Auto-Close Schedule - Step by Step

## The Problem

The automatic tab closure function exists but isn't running automatically. We need to schedule it using pg_cron.

## The Solution

Apply the migration in Supabase Dashboard (API doesn't support pg_cron setup).

## Step-by-Step Instructions

### Step 1: Open Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in the left sidebar

### Step 2: Open the Migration File

1. In your code editor, open: `supabase/migrations/054_schedule_auto_close_tabs.sql`
2. Select ALL the content (Ctrl+A)
3. Copy it (Ctrl+C)

### Step 3: Run the Migration

1. In Supabase SQL Editor, click "New Query"
2. Paste the migration content (Ctrl+V)
3. Click "Run" button (or press Ctrl+Enter)
4. You should see: **"Success. No rows returned"**

### Step 4: Verify It Worked

Still in SQL Editor, run this query:

```sql
SELECT * FROM cron.job WHERE jobname = 'auto-close-tabs-hourly';
```

**Expected Result:**
You should see one row with:
- `jobname`: auto-close-tabs-hourly
- `schedule`: 0 * * * *
- `command`: SELECT auto_close_tabs_outside_business_hours();
- `active`: true

### Step 5: Check When It Will Run

Run this query to see the schedule:

```sql
SELECT 
    jobname,
    schedule,
    active,
    database
FROM cron.job 
WHERE jobname = 'auto-close-tabs-hourly';
```

The schedule `0 * * * *` means:
- Runs at minute 0 of every hour
- Examples: 10:00, 11:00, 12:00, 1:00, 2:00, etc.

### Step 6: Test the Function (Optional)

Back in your terminal, test that the function works:

```bash
node dev-tools/scripts/test-auto-tab-closure.js
```

This will show you what would happen to your current open tabs.

## What Happens Next?

1. **First Run:** Top of the next hour (e.g., if it's 10:15 PM now, it runs at 11:00 PM)
2. **Every Hour:** The job runs automatically at minute 0
3. **What It Does:** 
   - Checks ALL venues
   - Only processes tabs outside business hours
   - Closes tabs with zero balance
   - Moves tabs with balance to overdue
   - Cancels pending orders when appropriate

## Monitoring

### Check Recent Runs

In Supabase SQL Editor:

```sql
SELECT 
    start_time,
    end_time,
    status,
    return_message
FROM cron.job_run_details
WHERE jobid = (
    SELECT jobid FROM cron.job WHERE jobname = 'auto-close-tabs-hourly'
)
ORDER BY start_time DESC
LIMIT 10;
```

### Check Auto-Closure Activity

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

### "Success. No rows returned" - Is this correct?

**Yes!** This is the expected result. The migration creates the schedule but doesn't return any data.

### How do I know it's actually scheduled?

Run the verification query from Step 4. If you see the job, it's scheduled.

### When will it run for the first time?

At the top of the next hour. If it's 10:15 PM now, it will run at 11:00 PM.

### Can I trigger it manually to test?

Yes! In Supabase SQL Editor:

```sql
SELECT * FROM auto_close_tabs_outside_business_hours();
```

This will run the function immediately and show you the results.

### What if I see an error?

**Error: "extension pg_cron does not exist"**
- pg_cron may not be enabled on your Supabase plan
- Contact Supabase support or use the Edge Function alternative

**Error: "function auto_close_tabs_outside_business_hours does not exist"**
- Apply migration 053 first: `supabase/migrations/053_automatic_tab_closure.sql`

**Error: "permission denied"**
- Make sure you're using the service role key, not the anon key

## Alternative: Edge Function

If pg_cron doesn't work, you can use the Edge Function approach:

1. Deploy the Edge Function:
   ```bash
   supabase functions deploy auto-close-tabs
   ```

2. Set up a cron trigger in Supabase Dashboard
3. Or use an external cron service to call the function URL

See `dev-tools/docs/auto-close-schedule-setup.md` for details.

## Summary

✅ **After applying the migration:**
- Job runs every hour automatically
- Processes all venues in one run
- Only affects tabs outside business hours
- Logs all activity to audit_logs
- No further action needed

The system is now fully automated!
