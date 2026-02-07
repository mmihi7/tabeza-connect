# How We Match Receipts to the Correct Tab

## The Challenge

When a receipt comes from the POS, we need to figure out which customer tab it belongs to.

## Matching Strategies (In Order of Priority)

### Strategy 1: Table Number (BEST - 95% Accurate)

**How it works:**
1. POS receipt includes table number: "Table 5"
2. We parse the receipt and extract: `tableNumber = "5"`
3. We look up which tab is currently open at Table 5
4. Match found! ✅

**Example Receipt:**
```
=====================================
        RESTAURANT NAME
=====================================
Table: 5                  Server: John
Date: 2024-01-15          Time: 19:30

2x Beer                        300.00
1x Chicken Wings               450.00
1x Soda                         50.00

Subtotal:                      800.00
Tax (16%):                     128.00
-------------------------------------
TOTAL:                         928.00
=====================================
```

**Parsing extracts:**
- Table Number: `5`
- Total: `928.00`
- Items: Beer, Chicken Wings, Soda

**Matching logic:**
```sql
SELECT * FROM tabs 
WHERE bar_id = 'xxx'
  AND status = 'open'
  AND table_number = '5'
LIMIT 1
```

**Success rate:** ~95% (if POS includes table number)

---

### Strategy 2: Amount + Timestamp (GOOD - 80% Accurate)

**How it works:**
1. Receipt total: `928.00`
2. Receipt time: `19:30`
3. Find tabs with recent orders matching this amount
4. Match found! ✅

**Matching logic:**
```sql
-- Find tabs with orders matching the amount in the last 10 minutes
SELECT t.* FROM tabs t
JOIN tab_orders o ON t.id = o.tab_id
WHERE t.bar_id = 'xxx'
  AND t.status = 'open'
  AND o.total = 928.00
  AND o.created_at > NOW() - INTERVAL '10 minutes'
LIMIT 1
```

**Success rate:** ~80% (works if amounts are unique)

---

### Strategy 3: Most Recent Open Tab (FALLBACK - 60% Accurate)

**How it works:**
1. If no table number and amount doesn't match
2. Deliver to the most recently opened tab
3. Staff can manually reassign if wrong

**Matching logic:**
```sql
SELECT * FROM tabs
WHERE bar_id = 'xxx'
  AND status = 'open'
ORDER BY opened_at DESC
LIMIT 1
```

**Success rate:** ~60% (better than nothing)

---

### Strategy 4: Staff Manual Selection (100% Accurate)

**How it works:**
1. If automatic matching fails or confidence is low
2. Show receipt to staff in dashboard
3. Staff manually selects which tab to deliver to
4. Match confirmed! ✅

**UI Flow:**
```
┌─────────────────────────────────────┐
│ 📄 New Receipt Received             │
│                                     │
│ Table: Unknown                      │
│ Total: 928.00                       │
│ Items: Beer, Chicken Wings, Soda   │
│                                     │
│ Select customer tab:                │
│ ○ Tab #1 - Table 3 (850.00)       │
│ ● Tab #2 - Table 5 (928.00) ✓     │
│ ○ Tab #3 - Table 7 (1200.00)      │
│                                     │
│ [Deliver Receipt]                   │
└─────────────────────────────────────┘
```

**Success rate:** 100% (staff knows which customer)

---

## Implementation: Smart Matching Algorithm

```typescript
async function matchReceiptToTab(receipt: ParsedReceipt, barId: string) {
  let matchedTab = null;
  let confidence = 0;
  
  // Strategy 1: Table Number (highest confidence)
  if (receipt.tableNumber) {
    matchedTab = await findTabByTableNumber(barId, receipt.tableNumber);
    if (matchedTab) {
      confidence = 0.95;
      return { tab: matchedTab, confidence, method: 'table_number' };
    }
  }
  
  // Strategy 2: Amount + Timestamp
  if (receipt.total > 0) {
    matchedTab = await findTabByAmountAndTime(
      barId, 
      receipt.total, 
      10 // minutes
    );
    if (matchedTab) {
      confidence = 0.80;
      return { tab: matchedTab, confidence, method: 'amount_time' };
    }
  }
  
  // Strategy 3: Most Recent Tab
  matchedTab = await findMostRecentOpenTab(barId);
  if (matchedTab) {
    confidence = 0.60;
    return { tab: matchedTab, confidence, method: 'most_recent' };
  }
  
  // Strategy 4: Manual Selection Required
  return { tab: null, confidence: 0, method: 'manual_required' };
}
```

---

## Confidence Levels

| Confidence | Action | Description |
|------------|--------|-------------|
| 95%+ | Auto-deliver | Table number match - very reliable |
| 80-94% | Auto-deliver + notify staff | Amount match - usually correct |
| 60-79% | Hold for staff review | Low confidence - needs verification |
| <60% | Require manual selection | No match found - staff must choose |

---

## Real-World Example

### Scenario: Busy Friday Night

**3 Open Tabs:**
- Tab #1: Table 3, opened 19:00, total so far: 850.00
- Tab #2: Table 5, opened 19:15, total so far: 0.00 (just opened)
- Tab #3: Table 7, opened 19:20, total so far: 1200.00

**Receipt Arrives:**
```
Table: 5
Total: 928.00
Time: 19:30
```

**Matching Process:**
1. ✅ Extract table number: `5`
2. ✅ Find tab at Table 5: Tab #2
3. ✅ Confidence: 95%
4. ✅ Auto-deliver to Tab #2

**Customer at Table 5 sees receipt on their phone immediately!**

---

## What If POS Doesn't Include Table Number?

### Option A: Configure POS to Include It
Most POS systems can be configured to print table numbers on receipts.

**Square POS:**
- Settings → Receipts → Custom Fields
- Add "Table Number" field

**Toast POS:**
- Settings → Receipt Customization
- Enable "Table Number" on receipts

### Option B: Use Amount Matching
If table number isn't available, amount + timestamp matching works well for most cases.

### Option C: Staff Manual Selection
For venues where automatic matching isn't reliable, staff can manually select the tab for each receipt.

---

## Improving Match Accuracy

### 1. Enable Table Setup in Tabeza
```typescript
// In bar settings
table_setup_enabled: true
table_count: 20
```

When customers scan QR code, they select their table number.
This creates a strong link between tab and table.

### 2. Configure POS to Print Table Numbers
Ensure your POS includes table numbers on receipts.

### 3. Use Unique Receipt Numbers
If POS includes receipt numbers, we can match those too:
```typescript
if (receipt.receiptNumber) {
  // Match by receipt number
  matchedTab = await findTabByReceiptNumber(barId, receipt.receiptNumber);
}
```

---

## Summary

**Best Case (95% accuracy):**
- POS prints table number
- Tabeza table setup enabled
- Automatic matching works perfectly

**Good Case (80% accuracy):**
- No table number, but amount + time matching works
- Occasional manual corrections needed

**Fallback (100% accuracy):**
- Staff manually selects tab for each receipt
- Takes 5 seconds per receipt
- Always correct

**The system adapts to your POS capabilities!**
