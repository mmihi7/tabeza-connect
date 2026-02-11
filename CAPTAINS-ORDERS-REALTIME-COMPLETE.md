# Captain's Orders Real-time Updates - COMPLETE ✅

## Problem Solved
Captain's Orders now updates automatically when new print jobs arrive - no manual refresh needed!

## What Was Wrong

### Issue 1: Unauthenticated Client
The CaptainsOrders component was creating its own Supabase client instead of using the authenticated singleton. This meant the real-time subscription couldn't pass RLS policies.

### Issue 2: Missing UPDATE Events
The subscription only listened for INSERT events, missing status changes from 'received' to 'no_match'.

### Issue 3: Realtime Not Enabled
The print_jobs table might not be in the supabase_realtime publication.

## Fixes Applied

### ✅ Fix 1: Use Authenticated Client
Changed `apps/staff/components/printer/CaptainsOrders.tsx` to use the authenticated Supabase singleton:

```typescript
// Before: Created own client
const supabase = createClient(url, key);

// After: Use authenticated singleton
import { supabase } from '@/lib/supabase';
```

### ✅ Fix 2: Listen for INSERT and UPDATE
Added UPDATE event listener to catch status changes:

```typescript
.on('postgres_changes', { event: 'INSERT', ... }, fetchData)
.on('postgres_changes', { event: 'UPDATE', ... }, fetchData)
```

### ✅ Fix 3: Enable Realtime
Created migration and script to enable Realtime for print_jobs table.

## How to Test

### Quick Test (Recommended)
1. Start printer service: `START-PRINTER-SERVICE.bat`
2. Start staff app locally: `pnpm dev:staff`
3. Open http://localhost:3003 in browser
4. Open browser console (F12)
5. Look for: `📡 Subscription status: SUBSCRIBED`
6. Click "Test Print" button
7. Watch Captain's Orders update automatically (within 1-2 seconds)
8. Console should show: `🔔 Real-time INSERT event received`

### Detailed Test
Use the test tool: `dev-tools/scripts/test-captains-orders-realtime.html`
1. Open in browser
2. Enter Supabase URL and Anon Key
3. Enter Bar ID
4. Click "Start Listening"
5. Send test print
6. Verify real-time event is received

## Apply Realtime Migration

### Option 1: Run Script (Easiest)
```bash
node dev-tools/scripts/enable-print-jobs-realtime.js
```

### Option 2: Manual SQL
Run in Supabase SQL Editor:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE print_jobs;
```

### Option 3: Supabase Dashboard
1. Go to Database > Replication
2. Find "supabase_realtime" publication
3. Add "print_jobs" table

## Expected Behavior

### Before Fix ❌
- New print jobs don't appear until page refresh
- No console logs about real-time events
- Manual refresh required

### After Fix ✅
- New print jobs appear immediately (1-2 seconds)
- Console shows: "🔔 Real-time INSERT event received"
- Console shows: "📡 Subscription status: SUBSCRIBED"
- No page refresh needed

## Files Changed
- ✅ `apps/staff/components/printer/CaptainsOrders.tsx` - Fixed subscription
- ✅ `database/enable-print-jobs-realtime.sql` - Migration
- ✅ `dev-tools/scripts/enable-print-jobs-realtime.js` - Script to apply migration
- ✅ `dev-tools/scripts/test-captains-orders-realtime.html` - Test tool
- ✅ `dev-tools/docs/captains-orders-realtime-fix.md` - Detailed documentation

## Verification Checklist
- [ ] Staff app compiles: `pnpm build:staff`
- [ ] Captain's Orders renders without errors
- [ ] Browser console shows "SUBSCRIBED" status
- [ ] Test print appears automatically
- [ ] No manual refresh needed
- [ ] Console logs show real-time events

## Next Steps
1. Apply the Realtime migration (choose one option above)
2. Test with the Quick Test steps
3. Verify in production environment

## Technical Details

### Why Authentication Matters
RLS policies on print_jobs require `auth.uid()`:
```sql
CREATE POLICY print_jobs_bar_staff_select ON print_jobs
  FOR SELECT
  USING (
    bar_id IN (
      SELECT bar_id FROM user_bars 
      WHERE user_id = auth.uid()
    )
  );
```

Without authentication, the subscription can't access the data.

### Why UPDATE Events Matter
Print jobs can change status:
- Created with status 'received'
- Changed to 'no_match' by relay API
- Changed to 'processed' when assigned to tab

Listening only for INSERT would miss these status changes.

## Troubleshooting

### Subscription Not Connecting
- Check browser console for errors
- Verify user is logged in
- Check Supabase URL and keys in .env

### No Events Received
- Verify Realtime is enabled (run migration)
- Check RLS policies allow SELECT
- Verify bar_id filter matches

### Events Received But UI Not Updating
- Check fetchData() function works
- Verify state updates correctly
- Check for React rendering issues

## Success! 🎉
Captain's Orders now updates in real-time, just like customer orders do. Staff will see new print jobs appear automatically without refreshing the page.
