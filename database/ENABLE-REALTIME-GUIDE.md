# 🔴 Enable Realtime - Visual Guide

## The Problem

You tried to enable Realtime on the **VIEW** (`unmatched_receipt_stats`) instead of the **TABLE** (`unmatched_receipts`).

Supabase cannot enable Realtime on views, only tables.

---

## The Solution (1 minute)

### Step 1: Go to Database → Replication

In your Supabase Dashboard:
1. Click **"Database"** in the left sidebar
2. Click the **"Replication"** tab at the top

### Step 2: Find the TABLE (not the view)

You'll see a list of tables and views. Look for:

```
✅ unmatched_receipts          <-- THIS ONE (the TABLE)
❌ unmatched_receipt_stats     <-- NOT this one (the VIEW)
```

### Step 3: Enable the TABLE

1. Find the row for `unmatched_receipts` (the TABLE)
2. Click the toggle switch on the right side
3. The toggle should turn **green** when enabled

---

## How to Tell Them Apart

### TABLE: `unmatched_receipts`
- This is the actual data storage
- Has columns: id, bar_id, receipt_data, status, etc.
- **This is what you need to enable**

### VIEW: `unmatched_receipt_stats`
- This is a computed view (like a saved query)
- Shows statistics about receipts
- **Do NOT enable this**

---

## After Enabling

Once you enable Realtime on `unmatched_receipts`, run:

```bash
# Terminal 1: Listen for events
node dev-tools/scripts/test-unmatched-receipts-realtime.js
```

```bash
# Terminal 2: Insert test receipt
node dev-tools/scripts/insert-test-receipt.js
```

**Expected:** Terminal 1 should show "✅ Event 1 received" within 1 second

---

## Still Having Issues?

If you still don't see the table:
1. Refresh the Supabase Dashboard page
2. Make sure you ran the migration SQL successfully
3. Check the SQL Editor for any errors

If Realtime still doesn't work:
1. Try the SQL method: `ALTER PUBLICATION supabase_realtime ADD TABLE unmatched_receipts;`
2. Check Supabase logs for errors
3. Verify your Supabase project is on a paid plan (Realtime has limits on free tier)
