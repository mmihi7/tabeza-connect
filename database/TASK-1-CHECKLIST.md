# Task 1: Database Schema and Realtime Setup - Checklist

## Overview
This checklist guides you through setting up the `unmatched_receipts` table and enabling Supabase Realtime for the POS Receipt Assignment Modal.

## Prerequisites
- ✅ Supabase project created
- ✅ Environment variables configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY)
- ✅ Database access via Supabase Dashboard

---

## Step 1: Run the Migration SQL

### Option A: Via Supabase Dashboard (Recommended)
1. Open Supabase Dashboard
2. Go to **SQL Editor**
3. Open the file: `database/create-unmatched-receipts-table.sql`
4. Copy the entire SQL content
5. Paste into SQL Editor
6. Click **Run**
7. Verify: "Success. No rows returned"

### Option B: Via Supabase CLI
```bash
supabase db push
```

---

## Step 2: Enable Supabase Realtime

### Via Supabase Dashboard (Recommended)
1. Go to **Database** → **Replication**
2. Find the `unmatched_receipts` **TABLE** (NOT the `unmatched_receipt_stats` view)
3. Toggle **Enable** for the `unmatched_receipts` table
4. Verify the toggle is green/enabled

**⚠️ IMPORTANT:** 
- Enable Realtime on `unmatched_receipts` (the TABLE)
- Do NOT enable on `unmatched_receipt_stats` (the VIEW)
- Supabase cannot enable Realtime on views, only tables

### Via SQL (Alternative)
Run this in SQL Editor:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE unmatched_receipts;
```

---

## Step 3: Verify the Setup

Run the verification script:
```bash
node dev-tools/scripts/verify-unmatched-receipts.js
```

**Expected Output:**
```
✅ Table exists and is accessible
✅ All required columns present
✅ Can insert receipts
✅ expires_at auto-generated
✅ created_at auto-generated
✅ Can update receipts
✅ assigned_at auto-set by trigger
✅ Query successful (<100ms)
✅ Query performance acceptable (< 1s)
✅ Statistics view accessible
✅ RLS enabled (service key has access)

📊 Verification Summary: 11 passed, 0 failed
```

---

## Step 4: Test Realtime Events

### Terminal 1: Start the listener
```bash
node dev-tools/scripts/test-unmatched-receipts-realtime.js
```

**Expected Output:**
```
📡 Connection status: SUBSCRIBED
✅ Successfully subscribed to unmatched_receipts events
```

### Terminal 2: Insert a test receipt
```bash
node dev-tools/scripts/insert-test-receipt.js
```

**Expected Output:**
```
✅ Test receipt inserted successfully!
```

### Back to Terminal 1: Verify event received
**Expected Output:**
```
✅ Event 1 received at 2024-01-15T14:30:00.000Z
📦 Payload: { ... }
📄 Receipt Details:
   ID: abc-123
   Bar ID: venue-456
   Status: pending
   ...
```

---

## Acceptance Criteria Checklist

- [ ] ✅ Table created with all columns and indexes
- [ ] ✅ Realtime enabled and tested with Supabase client
- [ ] ✅ Can insert and query receipts successfully
- [ ] ✅ Triggers work (assigned_at auto-set)
- [ ] ✅ RLS policies configured
- [ ] ✅ Statistics view accessible
- [ ] ✅ Real-time events received within 1 second

---

## Troubleshooting

### Issue: "Table does not exist"
**Solution:** Run the migration SQL in Supabase Dashboard SQL Editor

### Issue: "No events received"
**Solution:** 
1. Check Realtime is enabled: Database → Replication
2. Verify RLS policies allow SELECT
3. Check Supabase logs for errors

### Issue: "Permission denied"
**Solution:** 
1. Verify SUPABASE_SECRET_KEY is set correctly
2. Check user has admin/service role permissions

### Issue: "assigned_at not auto-set"
**Solution:** 
1. Verify trigger was created: Check SQL output
2. Re-run migration SQL

---

## Next Steps After Completion

Once all checks pass:
1. ✅ Mark Task 1 as complete
2. ➡️ Move to Task 2: Real-Time Receipt Delivery (React hook)
3. 📝 Document any issues encountered

---

## Notes

- **Service Key vs Secret Key**: Use `SUPABASE_SECRET_KEY` (newer naming)
- **Manual Migration**: You run SQL directly in Supabase Dashboard
- **My Role**: I create test scripts and verify functionality
- **Your Role**: Run migrations and confirm results

