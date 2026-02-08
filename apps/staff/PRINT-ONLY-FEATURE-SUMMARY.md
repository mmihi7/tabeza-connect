# Print Only Feature - Implementation Summary

## Overview
Added "Print Only" functionality to the Receipt Assignment Modal to support **dual workflow**: both Tabeza customers (with tabs) and non-Tabeza customers (walk-ins, cash payments).

## Problem Solved

**Before**: All POS receipts were intercepted by Tabeza, but there was no way to handle receipts for customers who don't have a Tabeza tab. These receipts would get stuck in the "unmatched" queue forever.

**After**: Staff can now choose between two actions:
1. **Assign to Tab** - For Tabeza customers (digital receipt)
2. **Print Only** - For non-Tabeza customers (physical receipt)

## System Design

### Dual Workflow Support

```
POS prints → Tabeza intercepts → Modal appears
                                    ↓
                          Staff chooses action:
                          
    ┌─────────────────────┴─────────────────────┐
    │                                            │
    ▼                                            ▼
[Assign to Tab]                          [Print Only]
    │                                            │
    ▼                                            ▼
Digital receipt                          Physical receipt
to customer                              to printer
    │                                            │
    ▼                                            ▼
Status: 'assigned'                       Status: 'printed'
```

### Use Cases

#### Use Case 1: Tabeza Customer
- Customer has an open tab in the system
- Waiter selects the tab from the list
- Clicks "Assign to Tab"
- Customer receives digital receipt on their phone
- Receipt marked as `assigned`

#### Use Case 2: Non-Tabeza Customer
- Walk-in customer paying cash
- No tab exists in the system
- Waiter clicks "Print Only"
- Receipt prints physically
- Customer gets paper receipt
- Receipt marked as `printed`

## Implementation Details

### 1. Database Schema Update

**File**: `database/add-printed-status-to-receipts.sql`

Added new status value to `unmatched_receipts` table:
```sql
status IN ('pending', 'assigned', 'printed', 'expired')
```

- `pending` - Awaiting action
- `assigned` - Linked to a Tabeza tab
- `printed` - Physically printed for non-Tabeza customer
- `expired` - Older than 1 hour (not used with new approach)

### 2. Print API Endpoint

**File**: `apps/staff/app/api/receipts/[id]/print/route.ts`

```typescript
POST /api/receipts/:id/print
```

**Flow**:
1. Validates print job exists and hasn't been processed
2. Sends raw ESC/POS data to Printer Service at `http://localhost:8765/api/print-to-physical`
3. Printer Service saves to output folder: `TabezaPrints/output/`
4. Physical printer monitors folder and prints
5. Marks print job status as 'processed'
6. Returns success confirmation

**Graceful Degradation**: If printer service is offline, receipt is still marked as processed and error is logged. This prevents the system from blocking when printer service is down.

### 3. Modal UI Updates

**File**: `apps/staff/components/ReceiptAssignmentModal.tsx`

**Changes**:
- Added `onPrint` callback prop
- Added `handlePrint()` function
- Added "Print Only" button in footer
- Updated button states to handle both workflows
- Updated success overlay to show appropriate message

**New Button Layout**:
```
[Cancel]  [Print Only]  [Assign to Tab]
```

**Button States**:
- **Print Only**: Always enabled (unless printing/assigning in progress)
- **Assign to Tab**: Only enabled when a tab is selected
- **Cancel**: Always enabled (unless action in progress)

### 4. Visual Design

**Print Only Button**:
- Gray background (`bg-gray-600`)
- Receipt icon
- Tooltip: "Print receipt for non-Tabeza customer (walk-in, cash payment)"
- Shows "Printing..." with spinner when active

**Assign to Tab Button**:
- Blue background (`bg-blue-600`)
- No icon
- Disabled when no tab selected
- Shows "Sending..." with spinner when active

## User Experience

### Scenario 1: Mixed Customer Types (Busy Bar)

**3:00 PM** - Tabeza customer orders
- Receipt prints → Modal appears
- Waiter selects Tab #15
- Clicks "Assign to Tab"
- Customer gets digital receipt

**3:05 PM** - Walk-in customer orders
- Receipt prints → Modal appears
- Waiter clicks "Print Only" (no tab selection needed)
- Receipt prints physically
- Customer gets paper receipt

**3:10 PM** - Another Tabeza customer
- Receipt prints → Modal appears
- Waiter selects Tab #22
- Clicks "Assign to Tab"
- Customer gets digital receipt

### Scenario 2: All Non-Tabeza Customers

For venues that use Tabeza primarily for receipt interception but not tab management:
- Every receipt can be handled with "Print Only"
- No need to create tabs
- System still provides value (receipt parsing, logging, analytics)

## Benefits

### 1. Flexibility
- ✅ Supports mixed customer types
- ✅ Works for venues with partial Tabeza adoption
- ✅ No receipts get stuck in queue

### 2. Simplicity
- ✅ Clear two-button choice
- ✅ No complex configuration needed
- ✅ Intuitive workflow

### 3. Future-Proof
- ✅ Can add features to "Print Only" path (QR codes, branding)
- ✅ Can track non-Tabeza transactions
- ✅ Can generate analytics on customer mix

## Next Steps

### Phase 1: Current Implementation ✅
- [x] Database schema update
- [x] Print API endpoint
- [x] Modal UI with Print Only button
- [x] Status tracking

### Phase 2: Printer Integration ✅ COMPLETE
- [x] Send raw ESC/POS data to Tabeza Printer Service
- [x] Printer service endpoint to receive print jobs
- [x] Save to output folder for physical printer
- [x] Handle printer service offline gracefully
- [x] Mark receipt as processed

### Phase 3: Enhancements (Future)
- [ ] Add Tabeza QR code to printed receipts
- [ ] Add "Download our app" message
- [ ] Track print vs assign ratio for analytics
- [ ] Add receipt customization options
- [ ] Direct printer communication (bypass output folder)

## Testing

### Manual Testing Checklist
- [ ] Test "Print Only" with no tab selected
- [ ] Test "Assign to Tab" with tab selected
- [ ] Test button states (enabled/disabled)
- [ ] Test success messages for both workflows
- [ ] Test error handling for both workflows
- [ ] Test offline mode for both workflows
- [ ] Verify receipt status updates correctly
- [ ] Verify unmatched receipts list filters correctly

### Integration Testing
- [ ] Test with real POS system
- [ ] Test printer service integration (when implemented)
- [ ] Test with multiple concurrent receipts
- [ ] Test venue switching

## Files Created/Modified

### Created
1. `apps/staff/app/api/receipts/[id]/print/route.ts` - Print endpoint with printer service integration
2. `database/add-printed-status-to-receipts.sql` - Schema migration
3. `apps/staff/PRINT-ONLY-FEATURE-SUMMARY.md` - This document
4. `PRINT-ONLY-IMPLEMENTATION-COMPLETE.md` - Complete implementation guide
5. `packages/printer-service/index.js` - Added `/api/print-to-physical` endpoint

### Modified
1. `apps/staff/components/ReceiptAssignmentModal.tsx` - Added Print Only button
2. `apps/staff/components/printer/CaptainsOrders.tsx` - Added Print Only button

## Configuration

### Printer Service Setup

1. **Start Printer Service**:
   ```bash
   cd packages/printer-service
   node index.js
   ```

2. **Configure Physical Printer**:
   - Set printer to monitor: `C:\Users\[YourUser]\TabezaPrints\output\`
   - Or use print spooler service

3. **Environment Variable** (optional):
   ```env
   PRINTER_SERVICE_URL=http://localhost:8765
   ```

### Production Deployment

Install printer service as Windows service:
```bash
cd packages/printer-service
node install-service.js
```

## Deployment

1. Apply database migration:
   ```sql
   -- Run: database/add-printed-status-to-receipts.sql
   ```

2. Deploy updated Staff PWA

3. No changes needed to Printer Service (yet)

## Success Metrics

Track these metrics to measure adoption:
- **Print vs Assign Ratio**: How many receipts are printed vs assigned
- **Unmatched Receipt Count**: Should drop to near zero
- **Average Time to Action**: How quickly staff handle receipts
- **Customer Mix**: Percentage of Tabeza vs non-Tabeza customers

## Conclusion

The "Print Only" feature completes the dual workflow system, making Tabeza usable for venues with mixed customer types. Staff can now handle both Tabeza customers (digital receipts) and non-Tabeza customers (physical receipts) seamlessly from the same interface.

This is a **critical production feature** - without it, the system only works for 100% Tabeza adoption, which is unrealistic for most venues.
