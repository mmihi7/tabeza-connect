# Cross-Browser Integration Test Checklist

## Test Environment Setup

### Required Devices
- [ ] iOS device (iPhone/iPad) with Safari 15+
- [ ] Android device with Chrome 100+
- [ ] Desktop with Chrome
- [ ] Desktop with Firefox
- [ ] Desktop with Safari (macOS)
- [ ] Desktop with Edge

### Test URLs
- Staff App: `http://localhost:3003` (development)
- Customer App: `http://localhost:3002` (development)
- Integration Test Page: `dev-tools/tests/integration/realtime-notification-integration.test.html`

## Test 1: iOS Safari (Real Device)

### Audio Unlock System
- [ ] Open staff app on iOS Safari
- [ ] Verify unlock prompt appears automatically
- [ ] Tap "Enable Notifications" button
- [ ] Verify audio context state changes to "running"
- [ ] Verify prompt dismisses after successful unlock
- [ ] Verify unlock state persists for session

### Audio Playback
- [ ] Trigger new order notification
- [ ] Verify bell sound plays
- [ ] Check volume is audible
- [ ] Verify sound plays without errors

### Vibration Fallback
- [ ] Disable audio (if possible)
- [ ] Trigger notification
- [ ] Verify device vibrates
- [ ] Check vibration pattern (200ms, 100ms, 200ms)

### Visual Fallback
- [ ] Disable both audio and vibration
- [ ] Trigger notification
- [ ] Verify visual notification appears
- [ ] Check notification is visible and readable

### Browser Capabilities
- [ ] Open integration test page
- [ ] Run "Detect Capabilities" test
- [ ] Verify all capabilities detected correctly
- [ ] Check mobile device detection is accurate

## Test 2: Android Chrome (Real Device)

### Audio Unlock System
- [ ] Open staff app on Android Chrome
- [ ] Verify unlock prompt appears
- [ ] Tap "Enable Notifications" button
- [ ] Verify audio unlocks successfully
- [ ] Check unlock state persists

### Audio Playback
- [ ] Trigger new order notification
- [ ] Verify bell sound plays
- [ ] Check sound quality
- [ ] Verify no errors in console

### Vibration Fallback
- [ ] Test vibration notification
- [ ] Verify vibration works
- [ ] Check vibration pattern

### Visual Fallback
- [ ] Test visual notification
- [ ] Verify notification displays correctly

### Browser Capabilities
- [ ] Run capability detection
- [ ] Verify Android Chrome capabilities
- [ ] Check mobile detection

## Test 3: Desktop Browsers

### Chrome (Desktop)
- [ ] Open staff app
- [ ] Verify no unlock prompt on desktop (or prompt appears if needed)
- [ ] Test audio playback
- [ ] Verify existing functionality not regressed
- [ ] Check console for errors

### Firefox (Desktop)
- [ ] Open staff app
- [ ] Test audio unlock (if needed)
- [ ] Test audio playback
- [ ] Verify no regressions
- [ ] Check console for errors

### Safari (Desktop - macOS)
- [ ] Open staff app
- [ ] Test audio unlock
- [ ] Test audio playback
- [ ] Verify no regressions
- [ ] Check console for errors

### Edge (Desktop)
- [ ] Open staff app
- [ ] Test audio unlock
- [ ] Test audio playback
- [ ] Verify no regressions
- [ ] Check console for errors

## Test 4: Customer App Real-Time Updates

### Staff Order Confirmation
- [ ] Open customer app with active tab
- [ ] Place a pending order from customer app
- [ ] Switch to staff app
- [ ] Confirm the order
- [ ] Switch back to customer app
- [ ] **Verify order status updates to "confirmed" WITHOUT manual refresh**
- [ ] Check order appears in correct section
- [ ] Verify no duplicate orders

### New Staff Order
- [ ] Open customer app with active tab
- [ ] Switch to staff app
- [ ] Create new order on behalf of customer
- [ ] Switch back to customer app
- [ ] **Verify new order appears instantly WITHOUT manual refresh**
- [ ] Check order displays correctly
- [ ] Verify no duplicate orders

### Multiple Rapid Updates
- [ ] Open customer app
- [ ] Trigger multiple rapid order updates (3-5 orders in quick succession)
- [ ] Verify all updates appear in customer app
- [ ] Check no updates are lost
- [ ] Verify no duplicate orders
- [ ] Check orders are in correct chronological order

### Concurrent Updates
- [ ] Open customer app on two devices
- [ ] Trigger updates from both devices simultaneously
- [ ] Verify both devices receive all updates
- [ ] Check no race conditions
- [ ] Verify data consistency

## Test 5: Integration Test Page

### Run on Each Browser
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Desktop Chrome
- [ ] Desktop Firefox
- [ ] Desktop Safari
- [ ] Desktop Edge

### Tests to Run
- [ ] Browser Capabilities Detection
- [ ] Audio Unlock
- [ ] Audio Playback
- [ ] Vibration Notification
- [ ] Visual Notification
- [ ] Notification Fallback Chain
- [ ] Single State Update
- [ ] Multiple Rapid Updates
- [ ] Concurrent Updates
- [ ] Run All Tests

### Expected Results
- [ ] All tests pass on supported browsers
- [ ] Graceful degradation on unsupported features
- [ ] No console errors
- [ ] Clear feedback for each test

## Test 6: Error Handling and Edge Cases

### Network Disconnection
- [ ] Open customer app
- [ ] Disconnect network
- [ ] Reconnect network
- [ ] Verify real-time subscription reconnects
- [ ] Check updates resume correctly

### Background Tab
- [ ] Open staff app
- [ ] Switch to another tab
- [ ] Trigger notification
- [ ] Switch back to staff app
- [ ] Verify notification was received

### Page Refresh
- [ ] Open customer app with orders
- [ ] Refresh page
- [ ] Verify orders load correctly
- [ ] Check real-time subscription reconnects

### Audio Permission Denied
- [ ] Block audio permissions in browser
- [ ] Open staff app
- [ ] Verify fallback to vibration/visual
- [ ] Check no errors thrown

## Test 7: Performance and Stability

### Memory Leaks
- [ ] Open customer app
- [ ] Trigger 50+ order updates
- [ ] Check memory usage in DevTools
- [ ] Verify no memory leaks
- [ ] Check subscriptions are cleaned up

### Long Session
- [ ] Keep staff app open for 30+ minutes
- [ ] Trigger periodic notifications
- [ ] Verify audio continues to work
- [ ] Check no degradation over time

### Rapid Interactions
- [ ] Rapidly tap unlock button multiple times
- [ ] Verify no errors
- [ ] Check idempotent behavior

## Test Results Summary

### iOS Safari
- Audio Unlock: ⬜ Pass / ⬜ Fail
- Audio Playback: ⬜ Pass / ⬜ Fail
- Vibration: ⬜ Pass / ⬜ Fail
- Visual: ⬜ Pass / ⬜ Fail
- Overall: ⬜ Pass / ⬜ Fail

### Android Chrome
- Audio Unlock: ⬜ Pass / ⬜ Fail
- Audio Playback: ⬜ Pass / ⬜ Fail
- Vibration: ⬜ Pass / ⬜ Fail
- Visual: ⬜ Pass / ⬜ Fail
- Overall: ⬜ Pass / ⬜ Fail

### Desktop Browsers
- Chrome: ⬜ Pass / ⬜ Fail
- Firefox: ⬜ Pass / ⬜ Fail
- Safari: ⬜ Pass / ⬜ Fail
- Edge: ⬜ Pass / ⬜ Fail

### Customer App Real-Time
- Staff Confirmations: ⬜ Pass / ⬜ Fail
- New Staff Orders: ⬜ Pass / ⬜ Fail
- Multiple Updates: ⬜ Pass / ⬜ Fail
- Concurrent Updates: ⬜ Pass / ⬜ Fail

## Notes and Issues

### Issues Found
1. 
2. 
3. 

### Browser-Specific Quirks
1. 
2. 
3. 

### Recommendations
1. 
2. 
3. 

## Sign-Off

- [ ] All critical tests passed
- [ ] All issues documented
- [ ] Ready for deployment

**Tester Name:** _______________
**Date:** _______________
**Signature:** _______________
