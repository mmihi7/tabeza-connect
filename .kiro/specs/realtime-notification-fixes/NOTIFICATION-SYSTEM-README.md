# Real-Time Notification System

## Overview

The Tabeza real-time notification system provides audio, vibration, and visual notifications for staff and customers. It handles browser autoplay restrictions, implements graceful fallbacks, and ensures real-time UI updates across all devices.

## Features

### Staff App Notifications
- **Audio Alerts**: Bell sound for new customer orders
- **Audio Unlock**: User-friendly prompt to enable audio on mobile browsers
- **Vibration Fallback**: Device vibration when audio is blocked
- **Visual Fallback**: On-screen notifications when audio and vibration fail
- **Session Persistence**: Audio unlock state persists for the session

### Customer App Real-Time Updates
- **Instant Updates**: Order status changes appear without manual refresh
- **Staff Actions**: See staff order confirmations immediately
- **New Orders**: Staff-created orders appear instantly
- **Concurrent Updates**: Handles multiple rapid updates correctly
- **No Duplicates**: Prevents duplicate orders in the UI

## Architecture

### Components

#### 1. Audio Unlock Manager (`packages/shared/lib/audio-unlock.ts`)
Manages Web Audio API context and handles browser autoplay policies.

```typescript
import { createAudioUnlockManager } from '@tabeza/shared';

const audioManager = createAudioUnlockManager();

// Check if audio needs unlock
if (audioManager.needsUnlock()) {
  // Show unlock prompt
}

// Unlock audio (requires user gesture)
await audioManager.unlock();

// Check if unlocked
if (audioManager.isUnlocked()) {
  // Play sounds
}
```

#### 2. Notification Manager (`packages/shared/lib/notification-manager.ts`)
Coordinates notification methods with fallback chain: Audio → Vibration → Visual.

```typescript
import { createNotificationManager } from '@tabeza/shared';

const notificationManager = createNotificationManager(audioManager);

// Play notification with fallback
await notificationManager.notify({
  sound: 'bell',
  vibrate: true,
  visual: 'New order received!',
  priority: 'high'
});
```

#### 3. Browser Capabilities (`packages/shared/lib/browser-capabilities.ts`)
Detects browser capabilities and adapts notification strategy.

```typescript
import { detectBrowserCapabilities } from '@tabeza/shared';

const capabilities = detectBrowserCapabilities();

console.log(capabilities);
// {
//   audioSupported: true,
//   vibrationSupported: true,
//   notificationSupported: true,
//   autoplayPolicy: 'user-gesture-required',
//   isMobile: true,
//   browser: 'Safari',
//   platform: 'iOS'
// }
```

#### 4. Audio Unlock Prompt (`apps/staff/components/AudioUnlockPrompt.tsx`)
Mobile-friendly UI component for unlocking audio.

```typescript
import { AudioUnlockPrompt } from '@/components/AudioUnlockPrompt';

<AudioUnlockPrompt
  onUnlock={(audioManager) => {
    // Audio unlocked, save manager instance
    setAudioManager(audioManager);
  }}
  onDismiss={() => {
    // User dismissed prompt
  }}
/>
```

#### 5. Order State Helpers (`apps/customer/lib/order-state-helpers.ts`)
Immutable state update functions for managing order lists.

```typescript
import { updateOrderInList, addOrderToList, removeOrderFromList } from '@/lib/order-state-helpers';

// Update existing order
setOrders(prev => updateOrderInList(prev, updatedOrder));

// Add new order
setOrders(prev => addOrderToList(prev, newOrder));

// Remove order
setOrders(prev => removeOrderFromList(prev, orderId));
```

## Usage

### Staff App: Enable Audio Notifications

1. **Show Unlock Prompt on Mobile**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { AudioUnlockPrompt } from '@/components/AudioUnlockPrompt';
import { createAudioUnlockManager, createNotificationManager } from '@tabeza/shared';

export default function StaffPage() {
  const [audioManager, setAudioManager] = useState(null);
  const [notificationManager, setNotificationManager] = useState(null);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);

  useEffect(() => {
    const manager = createAudioUnlockManager();
    setAudioManager(manager);

    // Show prompt if audio needs unlock
    if (manager.needsUnlock()) {
      setShowUnlockPrompt(true);
    }
  }, []);

  const handleUnlock = (unlockedManager) => {
    setAudioManager(unlockedManager);
    setNotificationManager(createNotificationManager(unlockedManager));
    setShowUnlockPrompt(false);
  };

  return (
    <>
      {showUnlockPrompt && (
        <AudioUnlockPrompt
          onUnlock={handleUnlock}
          onDismiss={() => setShowUnlockPrompt(false)}
        />
      )}
      {/* Rest of your app */}
    </>
  );
}
```

2. **Play Notification When Order Arrives**

```typescript
// When new order arrives
useEffect(() => {
  if (notificationManager && newOrder) {
    notificationManager.notify({
      sound: 'bell',
      vibrate: true,
      visual: `New order #${newOrder.order_number}`,
      priority: 'high'
    });
  }
}, [newOrder, notificationManager]);
```

### Customer App: Real-Time Order Updates

1. **Setup Real-Time Subscription**

```typescript
'use client';

import { useState, useCallback } from 'react';
import { useRealtimeSubscription } from '@tabeza/shared';
import { updateOrderInList, addOrderToList } from '@/lib/order-state-helpers';

export default function MenuPage() {
  const [orders, setOrders] = useState([]);

  // Handle order updates
  const handleOrderUpdate = useCallback((payload) => {
    console.log('📝 Order updated:', payload.new);
    setOrders(prev => updateOrderInList(prev, payload.new));
  }, []);

  // Handle new orders
  const handleOrderInsert = useCallback((payload) => {
    console.log('➕ New order:', payload.new);
    setOrders(prev => addOrderToList(prev, payload.new));
  }, []);

  // Subscribe to real-time updates
  useRealtimeSubscription({
    table: 'tab_orders',
    filter: `tab_id=eq.${tabId}`,
    onUpdate: handleOrderUpdate,
    onInsert: handleOrderInsert,
    debug: true
  });

  return (
    <div>
      {orders.map(order => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
```

## Browser Compatibility

### Supported Browsers

| Browser | Audio | Vibration | Visual | Notes |
|---------|-------|-----------|--------|-------|
| iOS Safari 15+ | ✅ | ✅ | ✅ | Requires user gesture |
| Android Chrome 100+ | ✅ | ✅ | ✅ | Requires user gesture |
| Desktop Chrome | ✅ | ❌ | ✅ | No vibration on desktop |
| Desktop Firefox | ✅ | ❌ | ✅ | No vibration on desktop |
| Desktop Safari | ✅ | ❌ | ✅ | No vibration on desktop |
| Desktop Edge | ✅ | ❌ | ✅ | No vibration on desktop |

### Autoplay Policies

- **iOS Safari**: Strictest policy, requires explicit user gesture
- **Android Chrome**: Allows autoplay after user interaction with site
- **Desktop Browsers**: Generally allow autoplay after user interaction
- **PWA Mode**: May have different autoplay behavior than browser

## Troubleshooting

### Audio Not Playing on Mobile

**Problem**: Bell sound doesn't play on iOS Safari or Android Chrome.

**Solution**:
1. Ensure user tapped the unlock button
2. Check console for "✅ Audio unlocked successfully"
3. Verify AudioContext state is "running"
4. Check browser permissions for audio

**Code to Debug**:
```typescript
console.log('Audio unlocked:', audioManager.isUnlocked());
console.log('Audio state:', audioManager.getState());
```

### Unlock Prompt Not Appearing

**Problem**: Audio unlock prompt doesn't show on mobile.

**Solution**:
1. Check if audio is already unlocked
2. Verify mobile device detection
3. Check if prompt was dismissed

**Code to Debug**:
```typescript
const capabilities = detectBrowserCapabilities();
console.log('Is mobile:', capabilities.isMobile);
console.log('Needs unlock:', audioManager.needsUnlock());
```

### Customer App Not Updating

**Problem**: Order status doesn't update without manual refresh.

**Solution**:
1. Check real-time subscription is active
2. Verify Supabase connection
3. Check RLS policies allow updates
4. Ensure state updater functions are used

**Code to Debug**:
```typescript
// Check subscription status
useRealtimeSubscription({
  table: 'tab_orders',
  filter: `tab_id=eq.${tabId}`,
  onUpdate: (payload) => {
    console.log('📝 Update received:', payload);
    setOrders(prev => {
      console.log('Previous orders:', prev.length);
      const updated = updateOrderInList(prev, payload.new);
      console.log('Updated orders:', updated.length);
      return updated;
    });
  },
  debug: true
});
```

### Duplicate Orders Appearing

**Problem**: Same order appears multiple times in the list.

**Solution**:
1. Use order state helpers (updateOrderInList, addOrderToList)
2. Check for multiple subscriptions
3. Verify order IDs are unique

**Code to Debug**:
```typescript
import { validateNoDuplicates } from '@/lib/order-state-helpers';

useEffect(() => {
  const isValid = validateNoDuplicates(orders);
  if (!isValid) {
    console.error('Duplicate orders detected!');
  }
}, [orders]);
```

### Vibration Not Working

**Problem**: Device doesn't vibrate when audio fails.

**Solution**:
1. Check device supports vibration
2. Verify vibration not disabled in settings
3. Check browser supports Vibration API

**Code to Debug**:
```typescript
const capabilities = detectBrowserCapabilities();
console.log('Vibration supported:', capabilities.vibrationSupported);

// Test vibration directly
if ('vibrate' in navigator) {
  navigator.vibrate([200, 100, 200]);
}
```

## Testing

### Integration Test Page

Open `dev-tools/tests/integration/realtime-notification-integration.test.html` in your browser to run comprehensive integration tests.

**Tests Include**:
- Browser capability detection
- Audio unlock flow
- Audio playback
- Vibration
- Visual notifications
- Notification fallback chain
- State update handling
- Concurrent updates

### Manual Testing

Follow the testing guide at `.kiro/specs/realtime-notification-fixes/testing-guide.md` for step-by-step manual testing instructions.

**Key Tests**:
1. Audio unlock on iOS Safari
2. Audio unlock on Android Chrome
3. Bell sound playback
4. Vibration fallback
5. Customer app real-time updates
6. Multiple rapid updates
7. Error handling

## Performance

### Memory Management

- AudioContext is created once and reused
- Subscriptions are cleaned up on unmount
- State updates use immutable patterns
- No memory leaks in long sessions

### Network Efficiency

- WebSocket connection for real-time updates
- Specific filters reduce event volume
- Automatic reconnection on network loss
- Exponential backoff for retries

### Battery Optimization

- AudioContext suspended when not needed
- Vibration patterns optimized for battery
- Visual notifications don't drain battery

## Security

### Audio Unlock

- No security implications (client-side only)
- User gesture requirement is browser security feature
- Cannot bypass autoplay policy programmatically

### Real-Time Subscriptions

- Secured by Supabase RLS policies
- Tab-specific filters prevent cross-tab data leakage
- No additional security changes needed

## Deployment

### Staging Deployment

1. Deploy to staging environment
2. Test on real devices (iOS Safari, Android Chrome)
3. Verify audio unlock works
4. Verify real-time updates work
5. Check console for errors

### Production Deployment

1. Complete staging testing
2. Deploy to production
3. Monitor notification success rates
4. Monitor error logs
5. Collect user feedback

### Monitoring

**Key Metrics**:
- Audio unlock success rate
- Notification delivery success rate
- Vibration fallback usage
- Visual fallback usage
- Real-time update latency
- Subscription reconnection rate

**Logging**:
All components include comprehensive logging:
- 🔓 Audio unlock attempts
- 🔊 Audio playback attempts
- 📳 Vibration attempts
- 📝 Real-time events
- ✅ Success messages
- ❌ Error messages

## API Reference

### Audio Unlock Manager

```typescript
interface AudioUnlockManager {
  isUnlocked(): boolean;
  unlock(): Promise<boolean>;
  needsUnlock(): boolean;
  getState(): 'suspended' | 'running' | 'closed';
  getAudioContext(): AudioContext | null;
}
```

### Notification Manager

```typescript
interface NotificationManager {
  playSound(soundType: 'bell' | 'alert'): Promise<boolean>;
  vibrate(pattern?: number[]): boolean;
  showVisual(message: string): void;
  notify(options: NotificationOptions): Promise<void>;
  getAttempts(): NotificationAttempt[];
  getCapabilities(): BrowserCapabilities;
}

interface NotificationOptions {
  sound?: 'bell' | 'alert';
  vibrate?: boolean;
  visual?: string;
  priority?: 'high' | 'normal' | 'low';
}
```

### Browser Capabilities

```typescript
interface BrowserCapabilities {
  audioSupported: boolean;
  vibrationSupported: boolean;
  notificationSupported: boolean;
  autoplayPolicy: 'allowed' | 'user-gesture-required' | 'blocked';
  isMobile: boolean;
  browser: string;
  platform: string;
}
```

### Order State Helpers

```typescript
function updateOrderInList(orders: TabOrder[], updatedOrder: TabOrder): TabOrder[];
function addOrderToList(orders: TabOrder[], newOrder: TabOrder): TabOrder[];
function removeOrderFromList(orders: TabOrder[], orderId: string): TabOrder[];
function validateNoDuplicates(orders: TabOrder[]): boolean;
function validateChronologicalOrder(orders: TabOrder[]): boolean;
```

## Contributing

### Adding New Notification Types

1. Add sound type to NotificationManager
2. Implement sound generation in playSound()
3. Update NotificationOptions interface
4. Add tests

### Adding New Fallback Methods

1. Detect capability in BrowserCapabilities
2. Implement method in NotificationManager
3. Add to fallback chain in notify()
4. Update documentation

## Support

For issues or questions:
1. Check troubleshooting guide above
2. Review console logs for errors
3. Test on integration test page
4. Check browser compatibility matrix
5. Contact development team

## License

Internal use only - Tabeza project
