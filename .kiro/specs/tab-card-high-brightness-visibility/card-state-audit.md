# Tab Card State Conditional Logic Audit

**Date**: 2024
**File**: `apps/staff/app/page.tsx`
**Lines**: Approximately 1155-1270 (Tab card rendering section)

## Overview

This document audits the conditional logic that determines Tab card states in the staff dashboard. Understanding these conditions is critical before applying styling changes for high brightness visibility.

## State Determination Logic

### 1. `isPending` State

**Location**: Lines 1155-1158 (within `filteredTabs.map()`)

**Logic**:
```typescript
const hasPendingOrders = tab.orders?.some((o: any) => 
  o.status === 'pending' && 
  o.status !== 'cancelled'
);
const hasPendingMessages = (tab.unreadMessages || 0) > 0;
const hasPending = hasPendingOrders || hasPendingMessages;
```

**Determination**:
- `hasPendingOrders`: TRUE when tab has at least one order with `status === 'pending'` AND `status !== 'cancelled'`
- `hasPendingMessages`: TRUE when `tab.unreadMessages > 0`
- `hasPending`: TRUE when EITHER pending orders OR pending messages exist

**Data Source**:
- Orders: `tab_orders` table, filtered by `tab_id`, checking `status` field
- Messages: `tab_telegram_messages` table, counting records with `status === 'pending'` AND `initiated_by === 'customer'`

**Current Styling** (Line 1163-1167):
```typescript
className={`rounded-lg p-4 shadow-sm hover:shadow-lg cursor-pointer transition transform hover:scale-105 relative ${
  hasPendingOrders 
    ? 'bg-gradient-to-br from-red-900 to-red-800 border-2 border-red-500 animate-pulse text-white' 
    : 'bg-white border border-gray-200'
}`}
```

**Note**: Currently only `hasPendingOrders` triggers the red gradient styling, not `hasPendingMessages`.

### 2. `isOverdue` State

**Location**: Lines 948-949 (filter logic) and tab.status field

**Logic**:
```typescript
// In filter logic
matchesFilter = tab.status === filterStatus;

// Tab status comes from database
tab.status === 'overdue'
```

**Determination**:
- `isOverdue`: TRUE when `tab.status === 'overdue'`
- Status is set by `checkAndUpdateOverdueTabs()` function (imported from `@/lib/businessHours`)
- Overdue tabs are loaded alongside open tabs: `.in('status', ['open', 'overdue'])`

**Data Source**:
- `tabs` table, `status` field (enum: 'open' | 'overdue' | 'closed')
- Updated by business hours logic based on bar's operating hours

**Current Styling**:
- No specific styling for overdue state in current implementation
- Overdue tabs use the same styling as normal (open) tabs
- Only distinguished by filter button and status field

### 3. `isPaid` State

**Location**: Lines 1169-1171 (PAID overlay conditional)

**Logic**:
```typescript
{balance === 0 && billTotal > 0 && (
  <div className="absolute -top-2 -right-2 z-10 transform rotate-12">
    <div className="bg-green-500 text-white px-3 py-1 rounded-lg shadow-lg border-2 border-green-400">
      <span className="text-xs font-bold">PAID</span>
    </div>
  </div>
)}
```

**Determination**:
- `isPaid`: TRUE when `balance === 0` AND `billTotal > 0`
- Balance calculation (Lines 906-915):
  ```typescript
  const getTabTotals = (tab: any) => {
    const confirmedOrders = tab.orders?.filter((o: any) => o.status === 'confirmed') || [];
    const billTotal = confirmedOrders.reduce((sum: number, order: any) => 
      sum + parseFloat(order.total), 0) || 0;
    const paidTotal = tab.payments?.filter((p: any) => p.status === 'success')
      .reduce((sum: number, payment: any) => sum + parseFloat(payment.amount), 0) || 0;
    const balance = billTotal - paidTotal;
    
    return { billTotal, paidTotal, balance };
  };
  ```

**Data Source**:
- Orders: `tab_orders` table, summing `total` for orders with `status === 'confirmed'`
- Payments: `tab_payments` table, summing `amount` for payments with `status === 'success'`
- Balance: `billTotal - paidTotal`

**Current Styling**:
- Green "PAID" sticker overlay (absolute positioned, top-right, rotated 12deg)
- Does NOT change the card's base styling
- Card maintains normal or pending styling based on other conditions

### 4. Normal State (Default)

**Determination**:
- Normal state: When `hasPendingOrders === false` AND `tab.status === 'open'`
- This is the default state for active tabs without pending items

**Current Styling** (Line 1167):
```typescript
'bg-white border border-gray-200'
```

## State Priority and Combinations

### State Hierarchy (Visual Priority)

1. **Pending Orders** (Highest Priority)
   - Red gradient background (`from-red-900 to-red-800`)
   - Thick border (`border-2 border-red-500`)
   - Pulse animation
   - White text
   - Overrides all other styling

2. **Overdue** (Currently No Distinct Styling)
   - Uses normal styling
   - Only distinguished by filter and status field
   - **NEEDS IMPLEMENTATION** per design spec

3. **Paid** (Overlay Only)
   - Green sticker overlay
   - Does not change base card styling
   - Can appear on pending or normal cards

4. **Normal** (Default)
   - White background
   - Gray border
   - Standard text colors

### Possible State Combinations

| Pending Orders | Overdue | Paid | Current Visual Result |
|---------------|---------|------|----------------------|
| ✓ | ✓ | ✓ | Red gradient + PAID sticker |
| ✓ | ✓ | ✗ | Red gradient |
| ✓ | ✗ | ✓ | Red gradient + PAID sticker |
| ✓ | ✗ | ✗ | Red gradient |
| ✗ | ✓ | ✓ | White background + PAID sticker (no overdue styling) |
| ✗ | ✓ | ✗ | White background (no overdue styling) |
| ✗ | ✗ | ✓ | White background + PAID sticker |
| ✗ | ✗ | ✗ | White background (normal) |

## Additional State Indicators

### Pending Messages Badge

**Location**: Lines 1189-1197

**Logic**:
```typescript
{tab.unreadMessages > 0 && (
  <div className="bg-blue-500 text-white rounded-lg p-1 relative">
    <MessageCircle size={14} />
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded w-4 h-4 flex items-center justify-center">
      {tab.unreadMessages}
    </span>
  </div>
)}
```

**Styling**: Blue badge with message count, appears in card header

### Pending Indicator Icon

**Location**: Lines 1198-1202

**Logic**:
```typescript
{hasPending && (
  <span className="flex items-center justify-center w-6 h-6 bg-amber-500 rounded animate-pulse">
    <AlertCircle size={14} className="text-amber-900" />
  </span>
)}
```

**Styling**: Amber badge with alert icon, appears when pending orders OR messages exist

## Verification Results

### ✅ State Logic Correctness

1. **Pending Orders Logic**: ✅ CORRECT
   - Properly filters out cancelled orders
   - Checks for `status === 'pending'`
   - Data source: `tab_orders` table

2. **Pending Messages Logic**: ✅ CORRECT
   - Counts unread messages from `tab_telegram_messages`
   - Filters by `status === 'pending'` AND `initiated_by === 'customer'`
   - Data source: Real-time subscription and initial load

3. **Overdue Logic**: ✅ CORRECT (but no styling)
   - Status set by `checkAndUpdateOverdueTabs()` function
   - Based on business hours configuration
   - Data source: `tabs.status` field

4. **Paid Logic**: ✅ CORRECT
   - Calculates balance from confirmed orders and successful payments
   - Only shows PAID when balance is zero AND bill total is positive
   - Data source: `tab_orders` and `tab_payments` tables

### ⚠️ Issues Identified

1. **Overdue State Has No Visual Styling**
   - Overdue tabs use the same white background as normal tabs
   - Only distinguished by filter button
   - **ACTION REQUIRED**: Implement overdue styling per design spec

2. **Pending Messages Don't Trigger Red Gradient**
   - Only `hasPendingOrders` triggers the red gradient
   - `hasPendingMessages` only shows badge, not full card styling
   - **DESIGN DECISION NEEDED**: Should pending messages trigger full card styling?

3. **State Priority Not Explicitly Defined**
   - Current implementation: Pending orders override everything
   - Overdue state has no visual priority
   - **ACTION REQUIRED**: Define clear state hierarchy per design spec

## Recommendations for Styling Implementation

### 1. Maintain State Logic (No Changes Needed)

The existing state determination logic is correct and should NOT be modified. All styling changes should be CSS-only.

### 2. Implement Overdue Styling

Add conditional styling for `tab.status === 'overdue'`:
```typescript
className={`rounded-lg p-4 shadow-sm hover:shadow-lg cursor-pointer transition transform hover:scale-105 relative ${
  hasPendingOrders 
    ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-4 border-amber-700 ring-4 ring-amber-400/50 shadow-lg animate-pulse' 
    : tab.status === 'overdue'
    ? 'bg-gradient-to-br from-red-50 to-red-100 border-4 border-red-700 ring-4 ring-red-400/50 shadow-lg animate-pulse'
    : 'bg-gradient-to-br from-white to-orange-50 border-2 border-orange-500 shadow-md'
}`}
```

### 3. Update Text Colors Based on State

Ensure text colors are updated for each background:
- **Pending (amber background)**: Use dark text (`text-gray-900`, `text-amber-900`)
- **Overdue (red background)**: Use dark text (`text-gray-900`, `text-red-900`)
- **Normal (white/orange background)**: Use existing dark text

### 4. Add Icon Indicators

Per design spec, add non-color indicators:
- Pending: `<AlertCircle />` icon
- Overdue: `<AlertTriangle />` icon
- Maintain existing message badge

### 5. Preserve PAID Overlay

The PAID overlay logic is correct and should remain unchanged. It works independently of other states.

## Conclusion

The state conditional logic is **correct and well-implemented**. The main issue is the **lack of visual styling for overdue tabs** and the **dark backgrounds on pending cards** that become invisible in high brightness conditions.

All styling changes should be CSS-only modifications to the `className` strings. No changes to the state determination logic are required.

**Next Steps**:
1. Proceed with Task 1.1: Update Normal Tab Card styling
2. Proceed with Task 2.1-2.5: Update Pending Card styling (CRITICAL: change to light background)
3. Proceed with Task 4.1-4.5: Implement Overdue Card styling
4. Add icon indicators per design spec
5. Write property-based tests to verify styling correctness
