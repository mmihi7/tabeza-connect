# 🔴 REALTIME TEST - Do This Now!

## The Issue

You ran the tests in the wrong order:
1. ✅ Listener started and subscribed successfully
2. ⏱️ Listener waited 30 seconds and closed
3. ❌ You inserted the receipt AFTER the listener closed

The insert worked! The receipt was created. But the listener wasn't running anymore.

---

## ✅ Correct Test Procedure

### Step 1: Open TWO Terminal Windows

You need BOTH terminals open at the same time.

### Step 2: Terminal 1 - Start Listener FIRST
```bash
node dev-tools/scripts/test-unmatched-receipts-realtime.js
```

**Wait for this message:**
```
✅ Successfully subscribed to unmatched_receipts events

💡 To test, run in another terminal:
   node dev-tools/scripts/insert-test-receipt.js
```

### Step 3: Terminal 2 - Insert Receipt (WHILE Terminal 1 is still running)

**IMMEDIATELY** (within 30 seconds), in the OTHER terminal, run:
```bash
node dev-tools/scripts/insert-test-receipt.js
```

### Step 4: Check Terminal 1

You should see this **within 1 second**:
```
✅ Event 1 received at 2026-02-07T19:XX:XX.XXXZ
📦 Payload: { ... }
📄 Receipt Details:
   ID: da6dea20-d437-48a4-8a6e-60d4d3d0e494
   Bar ID: 6c4a27d3-b6ce-4bc0-b7fb-725116ea7936
   Status: pending
   ...
```

---

## 🎯 Key Points

1. **Terminal 1 must be RUNNING** when you insert the receipt
2. **You have 30 seconds** to insert the receipt after starting the listener
3. **The listener will automatically close** after 30 seconds
4. **If you see the event, Realtime is working!** ✅

---

## 🚀 Quick Commands

**Terminal 1:**
```bash
node dev-tools/scripts/test-unmatched-receipts-realtime.js
```

**Terminal 2 (run IMMEDIATELY after Terminal 1 subscribes):**
```bash
node dev-tools/scripts/insert-test-receipt.js
```

---

## ✅ Success Criteria

If Terminal 1 shows "✅ Event 1 received" within 1 second of running the insert command, **Task 1 is COMPLETE!**
