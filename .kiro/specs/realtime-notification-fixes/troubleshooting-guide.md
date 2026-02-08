# Troubleshooting Guide

## Overview

This guide helps diagnose and resolve common issues with the real-time notification system.

## Quick Diagnostic Checklist

Before diving into specific issues, run through this quick checklist:

- [ ] Check browser console for errors
- [ ] Verify browser is supported (see compatibility matrix)
- [ ] Check network connection is active
- [ ] Verify Supabase connection is working
- [ ] Check audio permissions in browser settings
- [ ] Verify device is not in silent mode (for vibration)
- [ ] Check if service worker is active
- [ ] Verify real-time subscription is connected

## Common Issues

### 1. Audio Not Playing on Mobile

#### Symptoms
- Bell sound doesn't play when order arrives
- No audio after tapping unlock button
- Console shows "Audio unlocked" but no sound

#### Possible Causes
1. Audio not properly unlocked
2. Device in silent mode
3. Browser permissions denied
4. AudioContext in wrong state

#### Diagnostic Steps

**Step 1: Check Audio Unlock Status**
```typescript
console.log('Audio unlocked:', audioManager.isUnlocked());
console.log('Audio state:', audioManager.getState());
```

Expected output:
```
Audio unlocked: true
Audio state: running
```

**Step 2: Check Browser Capabilities**
```typescript
const capabilities = detectBrowserCapabilities();
console.log('Audio supported:', capabilities.audioSupported);
console.log('Browser:', capabilities.browser);
console.log('Platform:', capabilities.platform);
```

**Step 3: Test Audio Playback Directly**
```typescript
if (audioManager.isUnlocked()) {
  await notificationManager.playSound('bell');
}
```

#### Solutions

**Solution 1: Re-unlock Audio**
```typescript
// Force unlock
await audioManager.unlock();
```

**Solution 2: Check Device Settings**
- Ensure device is not in silent mode
- Check volume is turned up
- Verify browser has audio permissions

**Solution 3: Reload Page**
- Sometimes a page reload fixes AudioContext issues
- Audio unlock state will need to be re-established

**Solution 4: Use Fallback**
```typescript
// If audio fails, use vibration
await notificationManager.notify({
  sound: 'bell',
  vibrate: true,
  visual: 'New order received!'
});
```

### 2. Unlock Prompt Not Appearing

#### Symptoms
- Audio unlock prompt doesn't show on mobile
- No way to enable audio notifications
- App loads but no prompt

#### Possible Causes
1. Audio already unlocked
2. Mobile detection failed
3. Prompt was dismissed and not shown again
4. Component not rendered

#### Diagnostic Steps

**Step 1: Check Mobile Detection**
```typescript
const capabilities = detectBrowserCapabilities();
console.log('Is mobile:', capabilities.isMobile);
console.log('Needs unlock:', audioManager.needsUnlock());
```

**Step 2: Check Unlock State**
```typescript
console.log('Audio unlocked:', audioManager.isUnlocked());
console.log('Audio state:', audioManager.getState());
```

**Step 3: Check Component Rendering**
```typescript
// In your component
console.log('Show unlock prompt:', showUnlockPrompt);
```

#### Solutions

**Solution 1: Force Show Prompt**
```typescript
// Manually show prompt
setShowUnlockPrompt(true);
```

**Solution 2: Clear Session Storage**
```typescript
// Clear any stored unlock state
sessionStorage.removeItem('audioUnlocked');
// Reload page
window.location.reload();
```

**Solution 3: Check Component Logic**
```typescript
useEffect(() => {
  const manager = createAudioUnlockManager();
  console.log('Needs unlock:', manager.needsUnlock());
  
  if (manager.needsUnlock()) {
    setShowUnlockPrompt(true);
  }
}, []);
```

### 3. Customer App Not Updating

#### Symptoms
- Order status doesn't change without refresh
- New orders don't appear
- Staff actions not reflected in customer app

#### Possible Causes
1. Real-time subscription not active
2. State not updating correctly
3. WebSocket disconnected
4. RLS policies blocking updates

#### Diagnostic Steps

**Step 1: Check Subscription Status**
```typescript
useRealtimeSubscription({
  table: 'tab_orders',
  filter: `tab_id=eq.${tabId}`,
  onUpdate: (payload) => {
    console.log('📝 UPDATE event received:', payload);
  },
  onInsert: (payload) => {
    console.log('➕ INSERT event received:', payload);
  },
  debug: true
});
```

**Step 2: Check WebSocket Connection**
```typescript
// Check Supabase client
const { data, error } = await supabase
  .from('tab_orders')
  .select('*')
  .eq('tab_id', tabId);

console.log('Orders from DB:', data);
console.log('Error:', error);
```

**Step 3: Check State Updates**
```typescript
const handleOrderUpdate = useCallback((payload) => {
  console.log('📝 Handling update:', payload.new);
  
  setOrders(prev => {
    console.log('Previous orders:', prev.length);
    const updated = updateOrderInList(prev, payload.new);
    console.log('Updated orders:', updated.length);
    return updated;
  });
}, []);
```

#### Solutions

**Solution 1: Verify Subscription Setup**
```typescript
// Ensure subscription is set up correctly
useRealtimeSubscription({
  table: 'tab_orders',
  filter: `tab_id=eq.${tabId}`,
  event: '*', // Listen to all events
  onUpdate: handleOrderUpdate,
  onInsert: handleOrderInsert,
  onDelete: handleOrderDelete
});
```

**Solution 2: Use State Updater Functions**
```typescript
// Always use functional form of setState
setOrders(prev => updateOrderInList(prev, updatedOrder));

// NOT this:
// setOrders(updateOrderInList(orders, updatedOrder));
```

**Solution 3: Check RLS Policies**
```sql
-- Verify customer can read orders
SELECT * FROM tab_orders 
WHERE tab_id = 'your-tab-id';

-- Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename = 'tab_orders';
```

**Solution 4: Reconnect Subscription**
```typescript
// Force reconnection
useEffect(() => {
  // Cleanup and reconnect
  return () => {
    // Subscription cleanup happens automatically
  };
}, [tabId]);
```

### 4. Duplicate Orders Appearing

#### Symptoms
- Same order appears multiple times
- Order count increases incorrectly
- Duplicate IDs in order list

#### Possible Causes
1. Multiple subscriptions active
2. State update logic incorrect
3. Race conditions
4. Not using order state helpers

#### Diagnostic Steps

**Step 1: Check for Duplicates**
```typescript
import { validateNoDuplicates } from '@/lib/order-state-helpers';

useEffect(() => {
  const isValid = validateNoDuplicates(orders);
  console.log('No duplicates:', isValid);
  
  if (!isValid) {
    const ids = orders.map(o => o.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    console.error('Duplicate IDs:', duplicates);
  }
}, [orders]);
```

**Step 2: Check Subscription Count**
```typescript
// Add to subscription setup
useEffect(() => {
  console.log('Setting up subscription for tab:', tabId);
  
  return () => {
    console.log('Cleaning up subscription for tab:', tabId);
  };
}, [tabId]);
```

**Step 3: Check State Update Logic**
```typescript
const handleOrderUpdate = useCallback((payload) => {
  console.log('Update for order:', payload.new.id);
  
  setOrders(prev => {
    const exists = prev.some(o => o.id === payload.new.id);
    console.log('Order exists:', exists);
    
    return updateOrderInList(prev, payload.new);
  });
}, []);
```

#### Solutions

**Solution 1: Use Order State Helpers**
```typescript
import { updateOrderInList, addOrderToList } from '@/lib/order-state-helpers';

// These helpers prevent duplicates automatically
setOrders(prev => updateOrderInList(prev, updatedOrder));
setOrders(prev => addOrderToList(prev, newOrder));
```

**Solution 2: Remove Duplicates**
```typescript
// Remove duplicates from existing orders
const uniqueOrders = Array.from(
  new Map(orders.map(o => [o.id, o])).values()
);
setOrders(uniqueOrders);
```

**Solution 3: Ensure Single Subscription**
```typescript
// Use dependency array to prevent multiple subscriptions
useRealtimeSubscription({
  table: 'tab_orders',
  filter: `tab_id=eq.${tabId}`,
  onUpdate: handleOrderUpdate,
  onInsert: handleOrderInsert
}); // No dependency array - subscription persists

// If you need to recreate subscription:
useEffect(() => {
  // Subscription setup
}, [tabId]); // Only recreate when tabId changes
```

### 5. Vibration Not Working

#### Symptoms
- Device doesn't vibrate when audio fails
- No vibration on notification
- Vibration API not supported

#### Possible Causes
1. Device doesn't support vibration
2. Vibration disabled in settings
3. Battery saver mode active
4. Browser doesn't support Vibration API

#### Diagnostic Steps

**Step 1: Check Vibration Support**
```typescript
const capabilities = detectBrowserCapabilities();
console.log('Vibration supported:', capabilities.vibrationSupported);
console.log('Is mobile:', capabilities.isMobile);
```

**Step 2: Test Vibration Directly**
```typescript
if ('vibrate' in navigator) {
  const success = navigator.vibrate([200, 100, 200]);
  console.log('Vibration triggered:', success);
} else {
  console.log('Vibration API not supported');
}
```

#### Solutions

**Solution 1: Check Device Settings**
- Ensure vibration is enabled in device settings
- Disable battery saver mode
- Check if device is in silent mode (may affect vibration on iOS)

**Solution 2: Use Visual Fallback**
```typescript
await notificationManager.notify({
  sound: 'bell',
  vibrate: true,
  visual: 'New order received!',
  priority: 'high'
});
// Will automatically fall back to visual if vibration fails
```

**Solution 3: Test on Different Device**
- Some devices don't support vibration
- Desktop browsers never support vibration
- Try on a different mobile device

### 6. WebSocket Disconnection

#### Symptoms
- Real-time updates stop working
- "Subscription error" in console
- Updates resume after page refresh

#### Possible Causes
1. Network connection lost
2. WebSocket timeout
3. Server disconnection
4. Tab backgrounded (mobile)

#### Diagnostic Steps

**Step 1: Check Network Connection**
```typescript
console.log('Online:', navigator.onLine);

window.addEventListener('online', () => {
  console.log('Network reconnected');
});

window.addEventListener('offline', () => {
  console.log('Network disconnected');
});
```

**Step 2: Check Subscription Error**
```typescript
useRealtimeSubscription({
  table: 'tab_orders',
  filter: `tab_id=eq.${tabId}`,
  onUpdate: handleOrderUpdate,
  onError: (error) => {
    console.error('Subscription error:', error);
  }
});
```

#### Solutions

**Solution 1: Automatic Reconnection**
```typescript
// Supabase handles reconnection automatically
// Just ensure subscription is set up correctly
useRealtimeSubscription({
  table: 'tab_orders',
  filter: `tab_id=eq.${tabId}`,
  onUpdate: handleOrderUpdate
});
```

**Solution 2: Manual Reconnection**
```typescript
const [reconnecting, setReconnecting] = useState(false);

const handleReconnect = async () => {
  setReconnecting(true);
  
  // Refetch data
  await refetchOrders();
  
  // Subscription will reconnect automatically
  setReconnecting(false);
};

// Show reconnection UI
{reconnecting && <div>Reconnecting...</div>}
```

**Solution 3: Network Change Handler**
```typescript
useEffect(() => {
  const handleOnline = () => {
    console.log('Network reconnected, refetching data');
    refetchOrders();
  };

  window.addEventListener('online', handleOnline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
  };
}, []);
```

### 7. Performance Issues

#### Symptoms
- App becomes slow after many updates
- Memory usage increases over time
- UI freezes on updates

#### Possible Causes
1. Memory leaks
2. Too many subscriptions
3. Inefficient state updates
4. Not cleaning up subscriptions

#### Diagnostic Steps

**Step 1: Check Memory Usage**
- Open Chrome DevTools
- Go to Performance tab
- Record a session
- Check memory usage over time

**Step 2: Check Subscription Cleanup**
```typescript
useEffect(() => {
  console.log('Subscription created');
  
  return () => {
    console.log('Subscription cleaned up');
  };
}, []);
```

**Step 3: Check State Update Frequency**
```typescript
const updateCount = useRef(0);

const handleOrderUpdate = useCallback((payload) => {
  updateCount.current++;
  console.log('Update count:', updateCount.current);
  
  setOrders(prev => updateOrderInList(prev, payload.new));
}, []);
```

#### Solutions

**Solution 1: Ensure Cleanup**
```typescript
useEffect(() => {
  // Subscription setup
  const subscription = useRealtimeSubscription({
    table: 'tab_orders',
    filter: `tab_id=eq.${tabId}`,
    onUpdate: handleOrderUpdate
  });
  
  return () => {
    // Cleanup happens automatically
  };
}, [tabId, handleOrderUpdate]);
```

**Solution 2: Use Stable Callbacks**
```typescript
// Use useCallback to prevent recreation
const handleOrderUpdate = useCallback((payload) => {
  setOrders(prev => updateOrderInList(prev, payload.new));
}, []); // Empty deps - callback never changes
```

**Solution 3: Optimize State Updates**
```typescript
// Use immutable updates
setOrders(prev => updateOrderInList(prev, updatedOrder));

// NOT this (mutates state):
// orders.push(newOrder);
// setOrders(orders);
```

## Debugging Tools

### Browser Console

**Enable Verbose Logging**
```typescript
// All components have comprehensive logging
// Check console for:
// 🔓 Audio unlock attempts
// 🔊 Audio playback attempts
// 📳 Vibration attempts
// 📝 Real-time events
// ✅ Success messages
// ❌ Error messages
```

### Integration Test Page

Open `dev-tools/tests/integration/realtime-notification-integration.test.html` to:
- Test browser capabilities
- Test audio unlock
- Test notifications
- Test state updates
- View detailed logs

### React DevTools

- Install React DevTools extension
- Check component state
- View props and hooks
- Profile performance

### Network Tab

- Check WebSocket connection
- View real-time messages
- Check for disconnections
- Monitor bandwidth usage

## Getting Help

If you're still experiencing issues:

1. **Collect Information**
   - Browser and version
   - Device and OS
   - Steps to reproduce
   - Console logs
   - Screenshots/videos

2. **Check Documentation**
   - README
   - Browser compatibility matrix
   - Testing guide

3. **Test on Integration Page**
   - Run all tests
   - Document failures
   - Compare with expected results

4. **Contact Support**
   - Provide collected information
   - Include test results
   - Describe expected vs actual behavior

## Preventive Measures

### Best Practices

1. **Always Use State Helpers**
   ```typescript
   import { updateOrderInList, addOrderToList } from '@/lib/order-state-helpers';
   ```

2. **Use Stable Callbacks**
   ```typescript
   const handleUpdate = useCallback((payload) => {
     // Handler logic
   }, []); // Empty deps
   ```

3. **Clean Up Subscriptions**
   ```typescript
   useEffect(() => {
     // Setup
     return () => {
       // Cleanup
     };
   }, []);
   ```

4. **Handle Errors Gracefully**
   ```typescript
   try {
     await audioManager.unlock();
   } catch (error) {
     console.error('Unlock failed:', error);
     // Fall back to vibration/visual
   }
   ```

5. **Test on Real Devices**
   - Always test on real iOS and Android devices
   - Don't rely solely on emulators
   - Test in different network conditions

## Common Error Messages

### "Audio not unlocked - user interaction required"
**Meaning**: AudioContext is in suspended state
**Solution**: Show unlock prompt and wait for user tap

### "Vibration not supported in this browser"
**Meaning**: Browser doesn't support Vibration API
**Solution**: Fall back to visual notifications

### "Subscription error: WebSocket disconnected"
**Meaning**: Real-time connection lost
**Solution**: Wait for automatic reconnection or refetch data

### "Duplicate orders detected"
**Meaning**: Same order ID appears multiple times
**Solution**: Use order state helpers to prevent duplicates

### "Failed to play sound: NotAllowedError"
**Meaning**: Browser blocked audio playback
**Solution**: Ensure audio is unlocked before playing

## Last Updated

**Date**: 2026-02-08
**Version**: 1.0.0
