# Real-Time Architecture Analysis

## Summary

**Yes, both apps use the same Supabase real-time architecture**, but there are implementation differences that cause the asymmetric behavior you're experiencing.

## What Works (Staff App)

✅ **New tabs appear without refresh** - Staff app main page (`apps/staff/app/page.tsx`) subscribes to bar-level events
✅ **New orders appear without refresh** - Staff app subscribes to `tab_orders` INSERT events
✅ **Bell notification plays** - Desktop staff app triggers sound on new customer orders

## What Doesn't Work

❌ **Mobile staff app bell notification** - Sound may not play on mobile browsers
❌ **Customer app doesn't show staff order confirmations** - Customer app IS listening but may have a bug
❌ **Customer app doesn't show new staff orders** - Customer app IS listening but may have a bug

## Architecture Comparison

### Staff App (apps/staff/app/page.tsx)

**Subscription Scope**: Bar-level (all tabs for the bar)
```typescript
// Staff app subscribes to ALL orders for the bar
const customerOrderSubscription = supabase
  .channel(`customer-order-updates-${bar.id}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'tab_orders'
  }, (payload) => {
    if (payload.new?.initiated_by === 'customer') {
      playAlertSound(...); // Triggers bell
      setShowAlert(true);
    }
    loadTabs();
  })
```

**Why it works**:
- Subscribes to bar-level events (not tab-specific)
- Catches ALL new orders for ANY tab in the bar
- Immediately triggers sound and visual alert
- Refreshes tab list automatically

### Customer App (apps/customer/app/menu/page.tsx)

**Subscription Scope**: Tab-specific (only this customer's tab)
```typescript
// Customer app subscribes ONLY to their specific tab
const realtimeConfigs = [{
  channelName: `tab-${tab?.id}`,
  table: 'tab_orders',
  filter: tab?.id ? `tab_id=eq.${tab.id}` : undefined,
  event: '*' as const,
  handler: async (payload) => {
    // Checks for staff acceptance
    const isStaffAcceptance = (
      payload.new?.status === 'confirmed' && 
      payload.old?.status === 'pending' && 
      payload.new?.initiated_by === 'customer'
    );
    
    if (isStaffAcceptance && !processedOrders.has(payload.new.id)) {
      buzz([200, 100, 200]);
      playAcceptanceSound();
      setAcceptanceModal({ show: true, ... });
    }
    
    // Refresh orders
    const { data: ordersData } = await supabase
      .from('tab_orders')
      .select('*')
      .eq('tab_id', tab?.id || '')
      .order('created_at', { ascending: false });
    
    if (!error && ordersData) {
      setOrders(ordersData);
    }
  }
}]
```

**Why it should work but might not**:
- IS listening for UPDATE events on tab_orders (`event: '*'`)
- IS checking for staff acceptance (status change from pending → confirmed)
- IS refreshing orders data after detecting changes
- **BUT**: May have timing issues or the event might not be firing

## Root Causes

### Issue 1: Mobile Staff App Bell Notification

**Problem**: Bell sound doesn't play on mobile browsers

**Root Cause**: Mobile browsers (especially iOS Safari) have strict autoplay policies:
- Sounds can only play after user interaction
- Background tabs cannot play sounds
- PWA may have additional restrictions

**Solution**: The staff app already has the sound code, but mobile browsers block it. Need to:
1. Ensure user has interacted with the page first
2. Use Web Audio API (already implemented)
3. Consider using vibration as primary notification on mobile

### Issue 2: Customer App Not Showing Staff Actions

**Problem**: Customer needs to refresh to see staff order confirmations or new staff orders

**Root Cause**: The customer app IS listening for these events, but there might be:
1. **Event not firing**: The UPDATE event might not be triggering
2. **Filter mismatch**: The subscription filter might be too specific
3. **Handler not executing**: The condition checks might be failing
4. **State not updating**: The orders state might not be updating properly

**Evidence from code**:
- Customer app subscribes to `event: '*'` (all events including UPDATE and INSERT)
- Customer app checks for `isStaffAcceptance` condition
- Customer app refreshes orders data after event
- **BUT**: The refresh might be failing or the event might not be detected

## Recommended Fixes

### Fix 1: Mobile Bell Notification

Add user interaction requirement and fallback to vibration:

```typescript
// In staff app page.tsx
const [userHasInteracted, setUserHasInteracted] = useState(false);

useEffect(() => {
  const handleInteraction = () => setUserHasInteracted(true);
  document.addEventListener('click', handleInteraction, { once: true });
  document.addEventListener('touchstart', handleInteraction, { once: true });
  return () => {
    document.removeEventListener('click', handleInteraction);
    document.removeEventListener('touchstart', handleInteraction);
  };
}, []);

// In alert handler
if (payload.new?.initiated_by === 'customer') {
  if (userHasInteracted) {
    playAlertSound(...);
  }
  // Always vibrate (works on mobile)
  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200, 100, 200]);
  }
  setShowAlert(true);
}
```

### Fix 2: Customer App Real-Time Updates

Debug and fix the customer app subscription:

```typescript
// Add more logging to understand what's happening
handler: async (payload: any) => {
  console.log('🔍 CUSTOMER: Order event received:', {
    eventType: payload.eventType,
    newStatus: payload.new?.status,
    oldStatus: payload.old?.status,
    initiatedBy: payload.new?.initiated_by,
    orderId: payload.new?.id
  });
  
  // Check for NEW staff orders (INSERT event)
  if (payload.eventType === 'INSERT' && payload.new?.initiated_by === 'staff') {
    console.log('📥 CUSTOMER: New staff order detected');
    showToast({
      type: 'info',
      title: 'New Order from Staff',
      message: 'Staff has added items to your tab'
    });
  }
  
  // Check for staff acceptance (UPDATE event)
  if (payload.eventType === 'UPDATE' && 
      payload.new?.status === 'confirmed' && 
      payload.old?.status === 'pending' &&
      payload.new?.initiated_by === 'customer') {
    console.log('✅ CUSTOMER: Staff accepted order');
    buzz([200, 100, 200]);
    playAcceptanceSound();
    setAcceptanceModal({ show: true, ... });
  }
  
  // ALWAYS refresh orders data
  await loadTabData(); // Use full reload instead of partial query
}
```

## Key Differences Summary

| Feature | Staff App | Customer App |
|---------|-----------|--------------|
| **Subscription Scope** | Bar-level (all tabs) | Tab-specific (one tab) |
| **Event Filtering** | Filters by `initiated_by` | Filters by `tab_id` |
| **Sound Notification** | Desktop ✅ Mobile ❌ | Works when implemented |
| **Auto-refresh** | ✅ Works perfectly | ❌ Needs manual refresh |
| **Architecture** | Same (Supabase Realtime) | Same (Supabase Realtime) |

## Conclusion

Both apps use the **same Supabase real-time architecture**, but:
1. **Staff app works better** because it subscribes to bar-level events (broader scope)
2. **Customer app has issues** because the event handlers might not be executing properly
3. **Mobile bell notification** fails due to browser autoplay restrictions, not architecture

The fix requires debugging the customer app's event handlers and adding proper mobile sound support to the staff app.
