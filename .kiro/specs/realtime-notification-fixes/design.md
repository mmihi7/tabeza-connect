# Design Document: Real-Time Notification Fixes

## Overview

This design addresses two critical issues in the Tabeza real-time notification system:

1. **Mobile Staff Bell Notification**: Audio notifications fail on mobile browsers due to autoplay restrictions
2. **Customer Real-Time Updates**: UI doesn't update automatically when staff actions occur

The root causes are:
- Mobile browsers require user interaction before playing audio (autoplay policy)
- Customer app receives real-time events but doesn't update React state to trigger re-renders

The solution involves:
- Implementing an audio unlock flow with user gesture detection
- Fixing state management in the customer app's real-time subscription handlers
- Adding graceful degradation with vibration fallback
- Ensuring proper React state updates trigger UI re-renders

## Architecture

### Current Real-Time Architecture

Both apps use the same foundation:
- **Supabase Real-Time**: PostgreSQL change data capture (CDC) via WebSocket
- **useRealtimeSubscription Hook**: Shared hook from `@tabeza/shared` package
- **Event-Driven Updates**: Database changes trigger client-side callbacks

**Staff App Flow:**
```
Customer places order → Database INSERT → Real-time event → Staff app callback → Bell sound + UI update
```

**Customer App Flow (Current - Broken):**
```
Staff confirms order → Database UPDATE → Real-time event → Customer app callback → ❌ No UI update
```

**Customer App Flow (Fixed):**
```
Staff confirms order → Database UPDATE → Real-time event → Customer app callback → State update → UI re-render
```

### Audio Unlock Architecture

Mobile browsers implement autoplay policies that block audio without user interaction. The solution:

```
App Load → Detect mobile → Show unlock prompt → User taps → Play silent audio → Audio context unlocked → Bell sounds work
```

**Key Components:**
1. **Audio Context Manager**: Manages Web Audio API context state
2. **Unlock UI Component**: Prompts user for interaction
3. **Capability Detection**: Detects browser audio support
4. **Fallback System**: Vibration when audio fails

### State Management Fix

The customer app's real-time subscription receives events but doesn't update state properly:

**Current (Broken):**
```typescript
// Event received but state not updated
const handleUpdate = (payload) => {
  console.log('Order updated:', payload);
  // ❌ No state setter called
};
```

**Fixed:**
```typescript
// Event received and state updated
const handleUpdate = (payload) => {
  console.log('Order updated:', payload);
  setOrders(prev => updateOrderInList(prev, payload.new));
  // ✅ State setter triggers re-render
};
```

## Components and Interfaces

### 1. Audio Unlock Manager

**Location:** `packages/shared/audio-unlock.ts`

**Interface:**
```typescript
interface AudioUnlockManager {
  // Check if audio is unlocked
  isUnlocked(): boolean;
  
  // Attempt to unlock audio (requires user gesture)
  unlock(): Promise<boolean>;
  
  // Check if unlock is needed
  needsUnlock(): boolean;
  
  // Get current audio context state
  getState(): 'suspended' | 'running' | 'closed';
}

// Factory function
export function createAudioUnlockManager(): AudioUnlockManager;
```

**Responsibilities:**
- Manage Web Audio API AudioContext
- Detect browser autoplay policy
- Unlock audio on user gesture
- Track unlock state

### 2. Unlock Prompt Component

**Location:** `apps/staff/components/AudioUnlockPrompt.tsx`

**Interface:**
```typescript
interface AudioUnlockPromptProps {
  onUnlock: () => Promise<void>;
  onDismiss?: () => void;
}

export function AudioUnlockPrompt({ onUnlock, onDismiss }: AudioUnlockPromptProps): JSX.Element;
```

**Responsibilities:**
- Display unlock prompt on mobile
- Handle user interaction
- Show unlock status feedback
- Dismiss after successful unlock

### 3. Enhanced Real-Time Subscription Hook

**Location:** `packages/shared/hooks/useRealtimeSubscription.ts`

**Current Interface:**
```typescript
interface RealtimeSubscriptionOptions {
  table: string;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
}
```

**Enhanced Interface:**
```typescript
interface RealtimeSubscriptionOptions {
  table: string;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  onInsert?: (payload: RealtimePayload) => void;
  onUpdate?: (payload: RealtimePayload) => void;
  onDelete?: (payload: RealtimePayload) => void;
  // New: Enable debug logging
  debug?: boolean;
}

interface RealtimePayload<T = any> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T | null;
  table: string;
  schema: string;
  commit_timestamp: string;
}
```

**Responsibilities:**
- Subscribe to database changes
- Route events to appropriate callbacks
- Handle subscription lifecycle
- Provide debug logging

### 4. Notification Manager

**Location:** `packages/shared/notification-manager.ts`

**Interface:**
```typescript
interface NotificationManager {
  // Play audio notification
  playSound(soundType: 'bell' | 'alert'): Promise<boolean>;
  
  // Vibrate device
  vibrate(pattern?: number[]): boolean;
  
  // Show visual notification
  showVisual(message: string): void;
  
  // Notify with fallback chain
  notify(options: NotificationOptions): Promise<void>;
}

interface NotificationOptions {
  sound?: 'bell' | 'alert';
  vibrate?: boolean;
  visual?: string;
  priority?: 'high' | 'normal' | 'low';
}

export function createNotificationManager(
  audioManager: AudioUnlockManager
): NotificationManager;
```

**Responsibilities:**
- Coordinate notification methods
- Implement fallback chain (audio → vibration → visual)
- Track notification success/failure
- Log notification attempts

### 5. Customer App Order State Manager

**Location:** `apps/customer/app/menu/page.tsx` (inline)

**Interface:**
```typescript
interface OrderStateManager {
  orders: TabOrder[];
  setOrders: React.Dispatch<React.SetStateAction<TabOrder[]>>;
  
  // Handle real-time updates
  handleOrderInsert: (payload: RealtimePayload<TabOrder>) => void;
  handleOrderUpdate: (payload: RealtimePayload<TabOrder>) => void;
  handleOrderDelete: (payload: RealtimePayload<TabOrder>) => void;
}

// Helper functions
function updateOrderInList(orders: TabOrder[], updatedOrder: TabOrder): TabOrder[];
function addOrderToList(orders: TabOrder[], newOrder: TabOrder): TabOrder[];
function removeOrderFromList(orders: TabOrder[], orderId: string): TabOrder[];
```

**Responsibilities:**
- Manage orders state array
- Update state on real-time events
- Maintain order list consistency
- Trigger React re-renders

## Data Models

### Audio Context State

```typescript
type AudioContextState = 'suspended' | 'running' | 'closed';

interface AudioUnlockState {
  isUnlocked: boolean;
  contextState: AudioContextState;
  lastUnlockAttempt: Date | null;
  unlockMethod: 'user-gesture' | 'auto' | null;
}
```

### Notification Attempt Log

```typescript
interface NotificationAttempt {
  timestamp: Date;
  type: 'audio' | 'vibration' | 'visual';
  success: boolean;
  error?: string;
  fallbackUsed?: 'audio' | 'vibration' | 'visual';
}
```

### Real-Time Event Payload

```typescript
interface RealtimePayload<T = any> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T | null;
  table: string;
  schema: string;
  commit_timestamp: string;
}

interface TabOrder {
  id: string;
  tab_id: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
  updated_at: string;
  order_number: number;
}
```

### Browser Capability Detection

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

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Audio Unlock Mechanism

*For any* user gesture event, calling unlock() on the audio manager should transition the audio context from 'suspended' to 'running' state, and subsequent unlock() calls should be idempotent (no state change or errors).

**Validates: Requirements 1.2, 6.2**

### Property 2: Audio Playback After Unlock

*For any* unlocked audio context, attempting to play a notification sound should succeed without errors.

**Validates: Requirements 1.3**

### Property 3: Notification Fallback Chain

*For any* notification attempt, if audio playback fails, the system should attempt vibration, and if vibration is not supported, the system should use visual notification, ensuring at least one notification method is attempted.

**Validates: Requirements 1.4, 4.1, 4.2**

### Property 4: Real-Time State Synchronization

*For any* real-time subscription event (INSERT, UPDATE, DELETE), the system should update React state using proper state setters, trigger a component re-render, and the resulting UI should reflect the database state from the event payload.

**Validates: Requirements 2.1, 2.2, 2.3, 5.1, 5.2**

### Property 5: Concurrent Update Handling

*For any* sequence of multiple real-time updates arriving in quick succession, all updates should be processed in order, the final state should be consistent with all updates applied, and no updates should be lost.

**Validates: Requirements 2.5, 5.5**

### Property 6: Subscription Cleanup

*For any* component using real-time subscriptions, unmounting the component should properly unsubscribe from all channels and not leave dangling subscriptions or memory leaks.

**Validates: Requirements 5.4**

### Property 7: Callback Referential Stability

*For any* real-time subscription callback function, the function reference should remain stable across re-renders (via useCallback) to prevent subscription loops and unnecessary re-subscriptions.

**Validates: Requirements 5.3**

### Property 8: Browser Capability Adaptation

*For any* browser capability profile (audio supported/unsupported, vibration supported/unsupported), the system should detect capabilities and select appropriate notification methods that are supported.

**Validates: Requirements 3.5**

### Property 9: Error Resilience

*For any* notification method failure or permission denial, the application should continue functioning without crashes, fall back to alternative notification methods, and maintain core functionality.

**Validates: Requirements 4.3, 4.5**

### Property 10: Unlock UI State Transitions

*For any* successful audio unlock, the unlock prompt should be hidden, confirmation feedback should be shown, and the unlock state should persist for the duration of the session.

**Validates: Requirements 6.3, 6.4**

### Property 11: Comprehensive Logging

*For any* audio playback attempt, real-time subscription event, state update, or error, the system should create a log entry with relevant details including timestamp, event type, success/failure status, and contextual information (browser, device).

**Validates: Requirements 1.5, 7.1, 7.2, 7.3, 7.5**

## Error Handling

### Audio Unlock Errors

**Error Types:**
1. `AudioContextCreationError`: Failed to create Web Audio API context
2. `AutoplayBlockedError`: Browser blocked audio playback
3. `NoUserGestureError`: Unlock attempted without user interaction

**Handling Strategy:**
```typescript
try {
  await audioManager.unlock();
} catch (error) {
  if (error instanceof AutoplayBlockedError) {
    // Fall back to vibration
    notificationManager.vibrate([200, 100, 200]);
  } else if (error instanceof NoUserGestureError) {
    // Show prompt again
    showUnlockPrompt();
  } else {
    // Log and continue with visual-only notifications
    console.error('Audio unlock failed:', error);
    useVisualNotificationsOnly();
  }
}
```

### Real-Time Subscription Errors

**Error Types:**
1. `SubscriptionConnectionError`: WebSocket connection failed
2. `SubscriptionTimeoutError`: No response from server
3. `InvalidPayloadError`: Received malformed event data

**Handling Strategy:**
```typescript
useRealtimeSubscription({
  table: 'tab_orders',
  filter: `tab_id=eq.${tabId}`,
  onUpdate: (payload) => {
    try {
      validatePayload(payload);
      setOrders(prev => updateOrderInList(prev, payload.new));
    } catch (error) {
      console.error('Failed to process update:', error);
      // Fetch fresh data as fallback
      refetchOrders();
    }
  },
  onError: (error) => {
    if (error instanceof SubscriptionConnectionError) {
      // Retry with exponential backoff
      retrySubscription();
    } else {
      // Fall back to polling
      startPolling();
    }
  }
});
```

### State Update Errors

**Error Types:**
1. `StateUpdateError`: Failed to update React state
2. `RaceConditionError`: Conflicting simultaneous updates
3. `StaleDataError`: Update based on outdated state

**Handling Strategy:**
```typescript
function handleOrderUpdate(payload: RealtimePayload<TabOrder>) {
  try {
    setOrders(prev => {
      // Validate update is newer than current state
      const existing = prev.find(o => o.id === payload.new.id);
      if (existing && existing.updated_at > payload.new.updated_at) {
        console.warn('Ignoring stale update');
        return prev;
      }
      return updateOrderInList(prev, payload.new);
    });
  } catch (error) {
    console.error('State update failed:', error);
    // Refetch to ensure consistency
    refetchOrders();
  }
}
```

## Testing Strategy

### Unit Tests

**Audio Unlock Manager:**
- Test unlock() succeeds with user gesture simulation
- Test unlock() fails without user gesture
- Test isUnlocked() returns correct state
- Test multiple unlock() calls are idempotent

**Notification Manager:**
- Test fallback chain (audio → vibration → visual)
- Test each notification method independently
- Test error handling for unsupported methods
- Test notification logging

**Order State Helpers:**
- Test updateOrderInList() updates correct order
- Test addOrderToList() maintains chronological order
- Test removeOrderFromList() removes correct order
- Test duplicate prevention

### Property-Based Tests

**Property 1: Audio Unlock Idempotence**
- Generate random sequences of unlock() calls
- Verify state remains consistent
- Verify no errors thrown

**Property 2: Notification Fallback Chain**
- Generate random notification failures
- Verify fallback chain always completes
- Verify at least one method succeeds or all fail gracefully

**Property 3: Real-Time State Consistency**
- Generate random order update sequences
- Apply updates to local state
- Verify final state matches expected database state

**Property 4: Order List Invariant**
- Generate random order operations (insert, update, delete)
- Apply operations to order list
- Verify no duplicates and correct ordering

**Property 5: Subscription Cleanup**
- Generate random mount/unmount sequences
- Verify all subscriptions cleaned up
- Verify no memory leaks

**Property 6: Cross-Browser Audio Behavior**
- Test across browser capability profiles
- Verify consistent behavior within each profile
- Verify graceful degradation

**Property 7: State Update Triggers Re-Render**
- Generate random state updates
- Verify component re-renders
- Verify UI reflects new state

**Property 8: Graceful Degradation**
- Generate random failure scenarios
- Verify application continues functioning
- Verify user feedback provided

### Integration Tests

**Staff App Bell Notification Flow:**
1. Load staff app on mobile simulator
2. Verify unlock prompt appears
3. Simulate user tap
4. Verify audio unlocked
5. Trigger new order event
6. Verify bell sound plays

**Customer App Real-Time Update Flow:**
1. Load customer app with active tab
2. Subscribe to tab updates
3. Simulate staff order confirmation (database update)
4. Verify UI updates without refresh
5. Verify order status changes
6. Verify no duplicate orders

**Cross-Browser Compatibility:**
1. Test on iOS Safari (real device)
2. Test on Android Chrome (real device)
3. Test on desktop Chrome
4. Test on desktop Firefox
5. Verify consistent behavior

### Manual Testing Checklist

**Mobile Staff App:**
- [ ] Unlock prompt appears on first load
- [ ] Tapping unlock button enables audio
- [ ] Bell sound plays when order arrives
- [ ] Vibration works when audio blocked
- [ ] Visual notification shows when both fail

**Customer App:**
- [ ] Staff order confirmation appears instantly
- [ ] New staff order appears instantly
- [ ] Multiple rapid updates handled correctly
- [ ] No duplicate orders displayed
- [ ] Works after network reconnection

**Browser Compatibility:**
- [ ] iOS Safari 15+
- [ ] iOS Safari 16+
- [ ] Android Chrome 100+
- [ ] Desktop Chrome
- [ ] Desktop Firefox
- [ ] Desktop Safari

## Implementation Notes

### Audio Unlock Best Practices

1. **Unlock Early**: Request unlock as soon as possible after user interaction
2. **Silent Audio**: Play silent audio to unlock context (common pattern)
3. **Persistent State**: Remember unlock state for session
4. **Clear Feedback**: Show clear UI feedback about unlock status

### React State Update Best Practices

1. **Functional Updates**: Always use functional form of setState for updates based on previous state
2. **Immutability**: Never mutate state directly, always create new objects/arrays
3. **Memoization**: Use useCallback for event handlers to prevent subscription loops
4. **Cleanup**: Always clean up subscriptions in useEffect cleanup function

### Real-Time Subscription Best Practices

1. **Specific Filters**: Use specific filters to reduce unnecessary events
2. **Event Types**: Subscribe to specific event types when possible
3. **Error Handling**: Always handle subscription errors
4. **Reconnection**: Implement reconnection logic for network failures

### Mobile Browser Considerations

1. **iOS Safari**: Strictest autoplay policy, requires user gesture
2. **Android Chrome**: Allows autoplay after user interaction with site
3. **PWA Mode**: May have different autoplay behavior than browser
4. **Background Tabs**: Audio may be blocked in background tabs

## Performance Considerations

### Audio Context Management

- Create AudioContext once and reuse
- Suspend context when not needed to save battery
- Resume context before playing sounds
- Clean up context on app unmount

### Real-Time Subscription Optimization

- Use specific filters to reduce event volume
- Debounce rapid updates if needed
- Batch state updates when possible
- Unsubscribe from unused channels

### State Update Optimization

- Use React.memo for order list components
- Implement shouldComponentUpdate for expensive renders
- Use virtualization for long order lists
- Avoid unnecessary re-renders with useMemo/useCallback

## Security Considerations

### Audio Unlock

- No security implications (client-side only)
- User gesture requirement is browser security feature
- Cannot bypass autoplay policy programmatically

### Real-Time Subscriptions

- Already secured by Supabase RLS policies
- Tab-specific filters prevent cross-tab data leakage
- No additional security changes needed

## Deployment Strategy

### Phase 1: Audio Unlock (Staff App)

1. Deploy audio unlock manager to shared package
2. Deploy unlock prompt component to staff app
3. Deploy notification manager with fallback
4. Test on staging with mobile devices
5. Deploy to production with feature flag

### Phase 2: State Management Fix (Customer App)

1. Update real-time subscription handlers
2. Add state update logic
3. Add debug logging
4. Test on staging with real-time events
5. Deploy to production

### Phase 3: Monitoring and Refinement

1. Monitor notification success rates
2. Collect browser capability data
3. Analyze failure patterns
4. Refine fallback strategies
5. Update documentation

## Rollback Plan

### Audio Unlock Rollback

- Feature flag to disable unlock prompt
- Fall back to vibration-only notifications
- No data migration needed

### State Management Rollback

- Revert to previous subscription handlers
- Users will need to refresh manually (existing behavior)
- No data loss or corruption risk

## Success Metrics

### Staff App

- Bell notification success rate > 90% on mobile
- Vibration fallback usage < 10%
- User complaints about missed orders reduced by 80%

### Customer App

- Real-time update success rate > 95%
- Manual refresh rate reduced by 90%
- User confusion about order status reduced by 80%

### Overall

- Zero crashes related to notification system
- Cross-browser compatibility maintained
- Performance impact < 5% on page load
