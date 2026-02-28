# Pending Order Card Location Documentation

## Task 2.1 Results

### File Location
**File**: `apps/staff/app/page.tsx`

### Conditional Logic Location
**Lines**: 1167-1182

### Key Variables
- **`hasPendingOrders`** (Line 1167-1170): Boolean that checks if tab has pending orders
  ```typescript
  const hasPendingOrders = tab.orders?.some((o: any) => 
    o.status === 'pending' && 
    o.status !== 'cancelled'
  );
  ```

- **`hasPendingMessages`** (Line 1171): Boolean for unread messages
  ```typescript
  const hasPendingMessages = (tab.unreadMessages || 0) > 0;
  ```

- **`hasPending`** (Line 1172): Combined boolean
  ```typescript
  const hasPending = hasPendingOrders || hasPendingMessages;
  ```

### Critical Styling Code (Lines 1178-1182)
```typescript
className={`rounded-lg p-4 hover:shadow-xl cursor-pointer transition-all duration-200 transform hover:scale-[1.02] relative ${
  hasPendingOrders 
    ? 'bg-gradient-to-br from-red-900 to-red-800 border-2 border-red-500 animate-pulse text-white shadow-sm' 
    : 'bg-gradient-to-br from-white to-orange-50 border-2 border-orange-500 shadow-md'
}`}
```

### Current Pending Card Styles (Dark Theme)
When `hasPendingOrders === true`:
- **Background**: `bg-gradient-to-br from-red-900 to-red-800` (dark red gradient)
- **Border**: `border-2 border-red-500` (red border)
- **Animation**: `animate-pulse` (pulsing effect)
- **Text**: `text-white` (white text)
- **Shadow**: `shadow-sm` (small shadow)

### Current Normal Card Styles (Light Theme)
When `hasPendingOrders === false`:
- **Background**: `bg-gradient-to-br from-white to-orange-50` (light gradient)
- **Border**: `border-2 border-orange-500` (orange border)
- **Shadow**: `shadow-md` (medium shadow)

### Text Color Dependencies
The `hasPendingOrders` variable also affects text colors throughout the card:
- **Line 1195**: Tab name color
  ```typescript
  className={`text-lg font-bold truncate ${hasPendingOrders ? 'text-white' : 'text-gray-800'}`}
  ```
- **Line 1197**: Table number color
  ```typescript
  className={`text-sm font-medium ${hasPendingOrders ? 'text-yellow-300' : 'text-orange-600'}`}
  ```
- **Line 1217**: Timestamp color
  ```typescript
  className={`text-xs ${hasPendingOrders ? 'text-gray-300' : 'text-gray-500'}`}
  ```

## Next Steps (Task 2.2)
Replace the dark red gradient (`from-red-900 to-red-800`) with a light amber gradient (`from-amber-50 to-amber-100`) while maintaining:
1. The `hasPendingOrders` conditional logic
2. The `animate-pulse` animation
3. The border styling (may need to adjust to `border-amber-400` or similar)
4. Text color adjustments for readability on light background

## Design Rationale
The current dark red theme makes pending cards hard to see in high brightness outdoor conditions. The new light amber theme will provide better visibility while maintaining the urgent/attention-grabbing nature of pending orders.
