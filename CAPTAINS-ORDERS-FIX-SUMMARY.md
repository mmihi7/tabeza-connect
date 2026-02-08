# Captain's Orders Display Fix - Summary

## ✅ Changes Applied

### 1. Enhanced Item Extraction Logic
**File:** `apps/staff/components/printer/CaptainsOrders.tsx`

**What was fixed:**
- Items showing "Table No:" instead of actual order items
- Parser incorrectly extracting receipt header fields as items

**How it works now:**
1. **First attempt:** Use parsed items from `parsed_data.items` but filter out invalid entries:
   - Filters out: "Table No", "Captain", "Date", "Time"
   - Keeps only actual food/drink items
   
2. **Fallback:** If no valid parsed items, extract from `rawText`:
   - Finds the "QTY   ITEM" section
   - Extracts lines with format: "2     Tusker Lager 500ml"
   - Parses quantity and item name
   
3. **Display format:**
   - Shows up to 2 items: "2x Tusker Lager, 1x Vodka"
   - If more items: "2x Tusker Lager, 1x Vodka, +3 more"
   - Fallback: "Order from POS" if no items found

**Display structure:**
```
┌─────────────────────────────────────┐
│ 2x Tusker Lager, 1x Vodka, +2 more │ ← Items (heading)
│ Total: KES 1,250.00                 │ ← Total amount
│ 8:45 PM                             │ ← Time received
│                    [Assign Tab] →   │ ← Action button
└─────────────────────────────────────┘
```

**Debug logging added:**
```typescript
console.log('Order data:', order);
console.log('Parsed items:', order.parsed_data?.items);
console.log('Raw text preview:', order.parsed_data?.rawText?.substring(0, 200));
```

### 2. Customer Nickname Display
**Files:** `apps/staff/components/printer/CaptainsOrders.tsx`, `apps/staff/app/api/printer/assign-receipt/route.ts`

**What was added:**
- Modal now shows customer nicknames instead of just tab numbers
- Falls back to "Tab #X" if no nickname is set

**Display format:**
```
┌─────────────────────────────────────┐
│ ○ Mih                               │ ← Customer nickname (if set)
│   Tab #38 • Opened 3:48 PM          │ ← Tab number + time
├─────────────────────────────────────┤
│ ○ Tab #27                           │ ← No nickname, shows tab number
│   Tab #27 • Opened 10:33 AM         │ ← Tab number + time
└─────────────────────────────────────┘
```

**How it works:**
- Fetches `notes` field from tabs table
- Parses JSON to extract `display_name` and `has_nickname`
- Shows nickname if `has_nickname` is true
- Otherwise shows "Tab #X"

### 2. Tab Number Display - EXPLAINED ✅
**Status:** Not a bug - working as designed

**What you saw:** All tabs showing "Tab 38" in the modal

**Root cause:** You only have **ONE open tab** (Tab 38). All other tabs are **overdue** (23 tabs) or **closed** (1 tab).

**Why this is correct:**
- Captain's Orders modal only shows tabs with `status = 'open'`
- Overdue tabs can't receive new orders (they have unpaid balances)
- Closed tabs are finished
- Your database has 25 tabs total, but only 1 is open

**Your Popos bar status:**
- ✅ Tab 38 (Mih) - **OPEN** ← Only this one shows in modal
- ❌ Tabs 1, 4-6, 13, 17-22, 26-37 - **OVERDUE** ← Don't show (can't receive orders)
- ❌ Tab 14 - **CLOSED** ← Don't show (finished)

**To test with multiple tabs:**
1. Close overdue tabs OR move some back to 'open' status
2. Or have customers create new tabs by scanning QR codes
3. Then you'll see multiple tabs in the modal

**SQL to move tabs back to open (for testing):**
```sql
UPDATE tabs
SET status = 'open',
    moved_to_overdue_at = NULL,
    overdue_reason = NULL
WHERE bar_id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31'
  AND tab_number IN (27, 29, 30)
  AND status = 'overdue';
```

## 🧪 Testing Tools Created

### 1. Browser Test Page
**File:** `dev-tools/debug/test-captains-orders-ui.html`

**How to use:**
1. Open the file in your browser
2. Enter credentials:
   - Supabase URL (from `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`)
   - Supabase Anon Key (from `.env.local`: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
   - Bar ID (your venue's UUID)
3. Click "Test Data"

**What it shows:**
- All unmatched receipts with extracted items
- All open tabs with their tab numbers
- Raw parsed_data structure for debugging
- Identifies if all tabs have the same number

### 2. Node.js Test Script
**File:** `dev-tools/debug/test-captains-orders-data.js`

**How to use:**
```bash
node dev-tools/debug/test-captains-orders-data.js
```

**What it does:**
- Fetches unmatched receipts from database
- Shows parsed_data structure and rawText
- Lists all open tabs with their tab_numbers
- Helps identify data issues

## 📋 Next Steps for Testing

### Step 1: Test the Item Display Fix
1. Open Staff PWA in browser
2. Navigate to Captain's Orders section
3. Open browser console (F12)
4. Look for debug logs:
   ```
   Order data: { id: "...", parsed_data: {...}, ... }
   Parsed items: [{ name: "Table No:", price: 7 }, ...]
   Raw text preview: "CAPTAIN'S ORDER\nPOPOS LOUNGE..."
   ```
5. Verify items are now displaying correctly (not "Table No:")

### Step 2: Understand the Tab Display
**This explains the "Tab 38" situation**

The modal only shows **open tabs**. Looking at your database:
- You have 25 total tabs
- Only 1 is open (Tab 38)
- 23 are overdue
- 1 is closed

**This is correct behavior** - overdue/closed tabs shouldn't receive new orders.

**To test with multiple tabs:**
- Close old overdue tabs, OR
- Move some overdue tabs back to 'open' status (see SQL in summary above), OR
- Have customers create new tabs

### Step 3: Test the Assignment Flow
1. Make sure you have multiple open tabs (see Step 2)
2. Click "Assign Tab" on a Captain's Order
3. Verify you see all open tabs with their correct numbers
4. Assign a receipt to a tab
5. Verify it appears in that customer's tab

### Step 4: Verify the Fix
1. Refresh the Staff PWA
2. Click "Assign Tab" on a Captain's Order
3. Verify tabs now show different numbers (Tab #1, Tab #2, etc.)

## 🐛 Debugging Checklist

### If items still show "Table No:"
- [ ] Check console logs for `Parsed items:` - what does it contain?
- [ ] Check console logs for `Raw text preview:` - does it have the receipt text?
- [ ] Verify the receipt format matches expected format (see below)
- [ ] Check if `parsed_data.items` is an array
- [ ] Check if `parsed_data.rawText` exists

### If all tabs show same number
- [ ] Run SQL query to check actual tab_number values
- [ ] Check if `generate_tab_number()` function exists in database
- [ ] Check if trigger `set_tab_number` is active
- [ ] Verify tabs are for the same bar_id
- [ ] Check audit_logs for tab creation events

### If no items show at all
- [ ] Check if `parsed_data` exists on the print_job
- [ ] Check if `rawText` exists in parsed_data
- [ ] Verify receipt was parsed correctly by printer service
- [ ] Check print_jobs table status (should be 'no_match')

## 📄 Expected Receipt Format

```
CAPTAIN'S ORDER
POPOS LOUNGE & GRILL
--------------------------------
Table No: 7
Captain: John
Date: 07-Feb-2026
Time: 8:45 PM
--------------------------------
QTY   ITEM
--------------------------------
2     Tusker Lager 500ml
1     Smirnoff Vodka 250ml
1     Nyama Choma (Goat) 1kg
1     Kachumbari
--------------------------------
Special Instructions: Extra ice
--------------------------------
Total: KES 1,250.00
```

**Items section:** Between "QTY   ITEM" and next "---" or "Special Instructions"

## 🔧 Long-term Fix Needed

The root cause is in the receipt parser (printer service/API) that creates `parsed_data` from `raw_data`. It should:
1. Not extract header fields (Table No, Captain, Date, Time) as items
2. Properly parse the QTY/ITEM section
3. Handle different POS receipt formats

**Where to fix:** The parser that processes ESC/POS data and creates the `parsed_data` JSONB field in the `print_jobs` table.

## 📊 Database Schema Reference

### print_jobs table
```sql
CREATE TABLE print_jobs (
  id UUID PRIMARY KEY,
  bar_id UUID NOT NULL,
  raw_data TEXT NOT NULL,           -- Base64 encoded ESC/POS data
  parsed_data JSONB,                 -- Parsed receipt data
  status TEXT DEFAULT 'received',    -- received, processed, error, no_match
  received_at TIMESTAMPTZ DEFAULT NOW(),
  matched_tab_id UUID
);
```

### parsed_data structure
```json
{
  "items": [
    { "name": "Tusker Lager 500ml", "price": 200.00 },
    { "name": "Vodka 250ml", "price": 350.00 }
  ],
  "total": 1250.00,
  "rawText": "CAPTAIN'S ORDER\nPOPOS LOUNGE...",
  "receiptNumber": "R-12345"
}
```

### tabs table
```sql
CREATE TABLE tabs (
  id UUID PRIMARY KEY,
  bar_id UUID NOT NULL,
  tab_number INTEGER NOT NULL,      -- Auto-generated, unique per bar
  status TEXT DEFAULT 'open',
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bar_id, tab_number)
);
```

## ✅ Success Criteria

- [ ] Captain's Orders show actual items (e.g., "2x Tusker Lager, 1x Vodka")
- [ ] No "Table No:" appearing as items
- [ ] Total amount displays correctly
- [ ] Time displays correctly
- [ ] Tab selection modal shows different tab numbers (Tab #1, Tab #2, etc.)
- [ ] Assigning orders to tabs works correctly
- [ ] Console logs help debug any remaining issues

## 📞 Support

If issues persist:
1. Share console logs from browser (F12 → Console tab)
2. Share results from browser test page
3. Share SQL query results for tab_number investigation
4. Share screenshot of Captain's Orders section
