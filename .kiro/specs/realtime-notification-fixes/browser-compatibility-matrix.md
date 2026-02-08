# Browser Compatibility Matrix

## Overview

This document provides detailed browser compatibility information for the real-time notification system.

## Feature Support Matrix

### Mobile Browsers

| Feature | iOS Safari 15+ | iOS Safari 16+ | Android Chrome 100+ | Android Chrome 110+ |
|---------|---------------|----------------|---------------------|---------------------|
| **Audio API** | ✅ Supported | ✅ Supported | ✅ Supported | ✅ Supported |
| **Audio Unlock Required** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Vibration API** | ✅ Supported | ✅ Supported | ✅ Supported | ✅ Supported |
| **Web Audio API** | ✅ Supported | ✅ Supported | ✅ Supported | ✅ Supported |
| **WebSocket** | ✅ Supported | ✅ Supported | ✅ Supported | ✅ Supported |
| **Service Worker** | ✅ Supported | ✅ Supported | ✅ Supported | ✅ Supported |
| **PWA Mode** | ✅ Supported | ✅ Supported | ✅ Supported | ✅ Supported |
| **Autoplay Policy** | 🔒 Strict | 🔒 Strict | 🔒 Moderate | 🔒 Moderate |

### Desktop Browsers

| Feature | Chrome 100+ | Firefox 100+ | Safari 15+ | Edge 100+ |
|---------|------------|--------------|------------|-----------|
| **Audio API** | ✅ Supported | ✅ Supported | ✅ Supported | ✅ Supported |
| **Audio Unlock Required** | ⚠️ Sometimes | ⚠️ Sometimes | ⚠️ Sometimes | ⚠️ Sometimes |
| **Vibration API** | ❌ Not Supported | ❌ Not Supported | ❌ Not Supported | ❌ Not Supported |
| **Web Audio API** | ✅ Supported | ✅ Supported | ✅ Supported | ✅ Supported |
| **WebSocket** | ✅ Supported | ✅ Supported | ✅ Supported | ✅ Supported |
| **Service Worker** | ✅ Supported | ✅ Supported | ✅ Supported | ✅ Supported |
| **PWA Mode** | ✅ Supported | ✅ Supported | ✅ Supported | ✅ Supported |
| **Autoplay Policy** | 🔓 Relaxed | 🔓 Relaxed | 🔒 Moderate | 🔓 Relaxed |

## Autoplay Policy Details

### iOS Safari
- **Policy**: Strictest autoplay restrictions
- **Requirement**: Explicit user gesture required
- **Behavior**: 
  - AudioContext starts in "suspended" state
  - Must call `resume()` in response to user interaction
  - Silent audio trick required for full unlock
- **Workaround**: Audio unlock prompt with user tap

### Android Chrome
- **Policy**: Moderate autoplay restrictions
- **Requirement**: User interaction with site required
- **Behavior**:
  - AudioContext may start in "suspended" state
  - Can resume after any user interaction
  - More lenient than iOS Safari
- **Workaround**: Audio unlock prompt on first load

### Desktop Chrome
- **Policy**: Relaxed autoplay restrictions
- **Requirement**: User interaction with site (any page)
- **Behavior**:
  - AudioContext usually starts in "running" state after first interaction
  - Autoplay allowed after user has interacted with site
- **Workaround**: Rarely needed, but prompt shown if required

### Desktop Firefox
- **Policy**: Relaxed autoplay restrictions
- **Requirement**: User interaction with site
- **Behavior**:
  - Similar to Chrome
  - Autoplay allowed after user interaction
- **Workaround**: Rarely needed

### Desktop Safari
- **Policy**: Moderate autoplay restrictions
- **Requirement**: User interaction with site
- **Behavior**:
  - More strict than Chrome/Firefox
  - Similar to iOS Safari but less restrictive
- **Workaround**: Audio unlock prompt if needed

### Desktop Edge
- **Policy**: Relaxed autoplay restrictions
- **Requirement**: User interaction with site
- **Behavior**:
  - Based on Chromium, similar to Chrome
  - Autoplay allowed after user interaction
- **Workaround**: Rarely needed

## Vibration API Support

### Mobile Devices
- **iOS**: ✅ Supported (iPhone 6s and later)
- **Android**: ✅ Supported (most devices)
- **Pattern Support**: ✅ Both platforms support vibration patterns
- **Limitations**: 
  - May be disabled in device settings
  - May not work in silent mode (iOS)
  - Battery saver mode may disable vibration

### Desktop Devices
- **All Browsers**: ❌ Not Supported
- **Reason**: Desktop computers don't have vibration hardware
- **Fallback**: Visual notifications used instead

## WebSocket Support

### All Browsers
- **Support**: ✅ Universal support
- **Protocol**: WSS (WebSocket Secure)
- **Reconnection**: Automatic with exponential backoff
- **Limitations**:
  - May disconnect on network change
  - May disconnect when tab is backgrounded (mobile)
  - Reconnection may take a few seconds

## Service Worker Support

### All Modern Browsers
- **Support**: ✅ Universal support
- **Features**:
  - Offline caching
  - Background sync
  - Push notifications (not used in this feature)
- **Limitations**:
  - Must be served over HTTPS
  - May be cleared by browser

## PWA Mode Differences

### iOS Safari PWA
- **Installation**: Add to Home Screen
- **Differences from Browser**:
  - Runs in standalone mode
  - No browser UI
  - May have different autoplay behavior
  - Better performance
- **Audio**: Same unlock requirement as browser

### Android Chrome PWA
- **Installation**: Install app prompt
- **Differences from Browser**:
  - Runs in standalone mode
  - No browser UI
  - May have different autoplay behavior
  - Better performance
- **Audio**: Same unlock requirement as browser

### Desktop PWA
- **Installation**: Install button in address bar
- **Differences from Browser**:
  - Runs in app window
  - No browser UI
  - Same autoplay behavior as browser
- **Audio**: Same unlock requirement as browser

## Real-Time Subscription Compatibility

### All Browsers
- **Support**: ✅ Universal support via Supabase
- **Protocol**: WebSocket (WSS)
- **Features**:
  - Real-time database updates
  - Automatic reconnection
  - Event filtering
- **Performance**:
  - Low latency (< 100ms typical)
  - Efficient bandwidth usage
  - Scales to many concurrent connections

## Known Issues and Workarounds

### Issue 1: Audio Doesn't Play on iOS Safari
**Symptoms**: Bell sound doesn't play even after unlock

**Cause**: iOS Safari requires explicit user gesture for each audio playback

**Workaround**: 
- Ensure unlock prompt is tapped
- Play silent audio during unlock
- Keep AudioContext in "running" state

**Code**:
```typescript
// Play silent audio to fully unlock
const buffer = audioContext.createBuffer(1, 1, 22050);
const source = audioContext.createBufferSource();
source.buffer = buffer;
source.connect(audioContext.destination);
source.start(0);
```

### Issue 2: Vibration Doesn't Work on Some Android Devices
**Symptoms**: Device doesn't vibrate when audio fails

**Cause**: Vibration disabled in settings or battery saver mode

**Workaround**:
- Check vibration support before attempting
- Fall back to visual notification
- Inform user to check settings

**Code**:
```typescript
if ('vibrate' in navigator) {
  const success = navigator.vibrate([200, 100, 200]);
  if (!success) {
    // Fall back to visual
    showVisualNotification();
  }
}
```

### Issue 3: WebSocket Disconnects on Network Change
**Symptoms**: Real-time updates stop after network change

**Cause**: WebSocket connection lost during network transition

**Workaround**:
- Automatic reconnection with exponential backoff
- Refetch data after reconnection
- Show connection status to user

**Code**:
```typescript
useRealtimeSubscription({
  table: 'tab_orders',
  filter: `tab_id=eq.${tabId}`,
  onUpdate: handleUpdate,
  onError: (error) => {
    console.error('Subscription error:', error);
    // Refetch data
    refetchOrders();
  }
});
```

### Issue 4: Duplicate Orders After Reconnection
**Symptoms**: Same order appears multiple times after reconnection

**Cause**: Multiple subscription instances or race conditions

**Workaround**:
- Use order state helpers with duplicate prevention
- Clean up subscriptions on unmount
- Use stable callback references

**Code**:
```typescript
import { validateNoDuplicates } from '@/lib/order-state-helpers';

useEffect(() => {
  if (!validateNoDuplicates(orders)) {
    // Remove duplicates
    const uniqueOrders = Array.from(
      new Map(orders.map(o => [o.id, o])).values()
    );
    setOrders(uniqueOrders);
  }
}, [orders]);
```

## Testing Recommendations

### Mobile Testing
1. **iOS Safari**: Test on real iPhone (iOS 15+)
2. **Android Chrome**: Test on real Android device (Chrome 100+)
3. **PWA Mode**: Test installed PWA on both platforms
4. **Network**: Test with WiFi, cellular, and offline

### Desktop Testing
1. **Chrome**: Test on Windows, macOS, Linux
2. **Firefox**: Test on Windows, macOS, Linux
3. **Safari**: Test on macOS
4. **Edge**: Test on Windows
5. **PWA Mode**: Test installed PWA on all platforms

### Cross-Browser Testing Tools
- **BrowserStack**: Test on real devices remotely
- **Sauce Labs**: Automated cross-browser testing
- **LambdaTest**: Live interactive testing
- **Manual Testing**: Always test on real devices for audio/vibration

## Browser Version Requirements

### Minimum Versions
- **iOS Safari**: 15.0+
- **Android Chrome**: 100+
- **Desktop Chrome**: 100+
- **Desktop Firefox**: 100+
- **Desktop Safari**: 15.0+
- **Desktop Edge**: 100+

### Recommended Versions
- **iOS Safari**: 16.0+ (better PWA support)
- **Android Chrome**: 110+ (improved autoplay)
- **Desktop Chrome**: Latest
- **Desktop Firefox**: Latest
- **Desktop Safari**: Latest
- **Desktop Edge**: Latest

## Future Compatibility

### Upcoming Features
- **Web Audio API v2**: Better audio control
- **Vibration API v2**: More vibration patterns
- **WebSocket v2**: Better reconnection
- **Service Worker v2**: Better offline support

### Deprecations
- **webkitAudioContext**: Use AudioContext instead (already handled)
- **vendor prefixes**: Remove when no longer needed

## Support Matrix Summary

| Browser | Audio | Vibration | Real-Time | Overall |
|---------|-------|-----------|-----------|---------|
| iOS Safari 15+ | ✅ | ✅ | ✅ | ✅ Fully Supported |
| iOS Safari 16+ | ✅ | ✅ | ✅ | ✅ Fully Supported |
| Android Chrome 100+ | ✅ | ✅ | ✅ | ✅ Fully Supported |
| Android Chrome 110+ | ✅ | ✅ | ✅ | ✅ Fully Supported |
| Desktop Chrome | ✅ | ❌ | ✅ | ✅ Supported (no vibration) |
| Desktop Firefox | ✅ | ❌ | ✅ | ✅ Supported (no vibration) |
| Desktop Safari | ✅ | ❌ | ✅ | ✅ Supported (no vibration) |
| Desktop Edge | ✅ | ❌ | ✅ | ✅ Supported (no vibration) |

## Legend

- ✅ **Fully Supported**: Feature works as expected
- ⚠️ **Partially Supported**: Feature works with limitations
- ❌ **Not Supported**: Feature not available
- 🔒 **Strict**: Requires explicit user gesture
- 🔓 **Relaxed**: Allows autoplay after interaction

## Last Updated

**Date**: 2026-02-08
**Version**: 1.0.0
**Tested Browsers**: iOS Safari 15-16, Android Chrome 100-110, Desktop Chrome 100+, Firefox 100+, Safari 15+, Edge 100+
