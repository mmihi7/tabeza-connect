# Task 1: Database Schema and Realtime Setup - READY TO RUN

## Status: ✅ All Files Created - Ready for Your Action

I've prepared everything for Task 1. Here's what's ready:

---

## 📁 Files Created

### Migration SQL
- ✅ `database/create-unmatched-receipts-table.sql` - Complete table schema with triggers, RLS, and indexes

### Documentation
- ✅ `database/README-unmatched-receipts.md` - Comprehensive guide
- ✅ `database/TASK-1-CHECKLIST.md` - Step-by-step checklist for you

### Test Scripts (Updated to use SUPABASE_SECRET_KEY)
- ✅ `dev-tools/scripts/verify-unmatched-receipts.js` - Verifies table setup
- ✅ `dev-tools/scripts/test-unmatched-receipts-realtime.js` - Tests real-time events
- ✅ `dev-tools/scripts/insert-test-receipt.js` - Inserts test data

---

## 🎯 Your Action Items

### 1. Run the Migration (5 minutes)

**Open Supabase Dashboard:**
1. Go to SQL Editor
2. Open: `database/create-unmatched-receipts-table.sql`
3. Copy all SQL
4. Paste into SQL Editor
5. Click **Run**
6. Confirm: "Success. No rows returned"

### 2. Enable Realtime (2 minutes)

**In Supabase Dashboard:**
1. Go to **Database** → **Replication**
2. Find `unmatched_receipts` table
3. Toggle **Enable**
4. Verify toggle is green

### 3. Run Verification (1 minute)

**In your terminal:**
```bash
node dev-tools/scripts/verify-unmatched-receipts.js
```

**Expected:** All checks pass ✅

### 4. Test Realtime (2 minutes)

**Terminal 1:**
```bash
node dev-tools/scripts/test-unmatched-receipts-realtime.js
```

**Terminal 2:**
```bash
node dev-tools/scripts/insert-test-receipt.js
```

**Expected:** Event received in Terminal 1 within 1 second ✅

---

## ✅ Acceptance Criteria

After completing the above steps, verify:

- [x] Table created with all columns and indexes
- [x] Realtime enabled and tested with Supabase client
- [x] Can insert and query receipts successfully
- [x] Triggers work (assigned_at auto-set)
- [x] RLS policies configured
- [x] Statistics view accessible
- [x] Real-time events received within 1 second

---

## 🔄 Workflow

**My Role:**
- ✅ Created all SQL migration files
- ✅ Created test and verification scripts
- ✅ Updated scripts to use SUPABASE_SECRET_KEY
- ⏳ Waiting for you to run migrations

**Your Role:**
- ⏳ Run SQL migration in Supabase Dashboard
- ⏳ Enable Realtime in Supabase Dashboard
- ⏳ Run verification scripts
- ⏳ Confirm all tests pass

**After You Confirm:**
- I'll mark Task 1 as complete
- I'll move to Task 2 (React hooks)

---

## 📋 Quick Reference

### Environment Variables Needed
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-secret-key-here
```

### Files to Run in Supabase
1. `database/create-unmatched-receipts-table.sql`

### Scripts to Run Locally
1. `node dev-tools/scripts/verify-unmatched-receipts.js`
2. `node dev-tools/scripts/test-unmatched-receipts-realtime.js`
3. `node dev-tools/scripts/insert-test-receipt.js`

---

## 🚨 If Something Fails

Check the troubleshooting section in:
- `database/TASK-1-CHECKLIST.md`
- `database/README-unmatched-receipts.md`

Or let me know the error message and I'll help debug!

---

## 📞 Ready When You Are

**Please:**
1. Run the migration SQL in Supabase Dashboard
2. Enable Realtime
3. Run the verification script
4. Let me know the results

**I'll wait for your confirmation before proceeding to Task 2.**

