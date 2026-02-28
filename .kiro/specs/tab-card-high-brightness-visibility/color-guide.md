# Tab Card Color Guide

## Updated Colors (More Distinct)

### 🔴 Overdue Tabs (DARK RED)
**Background**: `bg-red-600` (darker red)  
**Border**: `border-red-700` (very dark red)  
**Balance Section**: `bg-red-700` (even darker)  
**Text**: White  
**Icon**: AlertTriangle (white)  
**Animation**: None (static)

**When**: Tab status is 'overdue' (past business hours)

---

### 🟡 Pending Orders (AMBER/ORANGE)
**Background**: `bg-amber-400` (amber, not yellow)  
**Border**: `border-amber-500` (darker amber)  
**Balance Section**: `bg-amber-500` (darker amber)  
**Text**: Dark gray (gray-900)  
**Icon**: AlertCircle (dark gray)  
**Animation**: Pulse

**When**: Tab has pending orders (not cancelled)

---

### ⚪ Normal/Open Tabs (WHITE)
**Background**: `bg-white`  
**Border**: `border-gray-200` (light gray)  
**Balance Section**: `bg-orange-50` (very light orange)  
**Text**: Dark gray (gray-800)  
**Icon**: None  
**Animation**: None

**When**: Tab is open with no pending orders

---

## Color Comparison

| State | Main Color | Shade | Hex Approximation |
|-------|-----------|-------|-------------------|
| **Overdue** | Red | 600 | #DC2626 (Dark Red) |
| **Pending** | Amber | 400 | #FBBF24 (Amber/Orange) |
| **Normal** | White | - | #FFFFFF (White) |

## Visual Differences

1. **Overdue** = Dark red (like a stop sign)
2. **Pending** = Amber/orange (like a warning sign)  
3. **Normal** = Clean white

## Debug Info

Check browser console for logs like:
```
Tab 123: { status: 'overdue', isOverdue: true, hasPendingOrders: false }
Tab 456: { status: 'open', isOverdue: false, hasPendingOrders: true }
```

This will show which condition each tab is matching.

## Possible Issues

If pending and overdue look the same:
1. **Check tab.status** - Overdue tabs must have `status: 'overdue'` in database
2. **Check business hours** - Tabs only become overdue after business hours
3. **Check browser cache** - Hard refresh (Ctrl+Shift+R) to clear cache
4. **Check console logs** - Look for the debug output showing tab states
