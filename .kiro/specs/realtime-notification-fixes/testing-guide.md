# Real-Time Notification Testing Guide

## Overview

This guide provides step-by-step instructions for testing the real-time notification fixes across different browsers and devices.

## Prerequisites

### Development Environment
1. Start the development servers:
   ```bash
   pnpm dev
   ```
   - Staff app: http://localhost:3003
   - Customer app: http://localhost:3002

2. Ensure Supabase is running and configured
3. Have test bar and test data ready

### Test Devices
- **iOS Device**: iPhone or iPad with Safari 15+
- **Android Device**: Phone or tablet with Chrome 100+
- **Desktop**: Computer with Chrome, Firefox, Safari, and Edge

## Test 1: Staff App Audio Unlock (Mobile)

### iOS Safari Testing

1. **Open Staff App**
   - Navigate to http://localhost:3003 on iOS Safari
   - Or use production URL if testing deployed version

2. **Verify Unlock Prompt**
   - Prompt should appear automatically on page load
   - Check prompt displays correctly:
     - Orange icon with speaker
     - "Enable Notifications" title
     - Clear description
     - "Enable Notifications" button
     - "Maybe Later" button (if implemented)

3. **Test Unlock Flow**
   - Tap "Enable Notifications" button
   - Observe console logs (use Safari Web Inspector):
     - Should see "🔓 User clicked unlock button"
     - Should see "✅ Audio unlocked successfully"
   - Prompt should dismiss
   - Confirmation should appear briefly

4. **Verify Audio Playback**
   - Create a test order from customer app
   - Staff app should play bell sound
   - Check console for:
     - "🔊 Attempting to play bell sound..."
     - "✅ bell sound played successfully"

5. **Test Session Persistence**
   - Refresh the page
   - Unlock prompt should NOT appear again (session persists)
   - Audio should still work

### Android Chrome Testing

1. **Open Staff App**
   - Navigate to http://localhost:3003 on Android Chrome

2. **Test Unlock Flow**
   - Follow same steps as iOS Safari
   - Verify unlock prompt appears
   - Test unlock button
   - Verify audio playback

3. **Test Vibration Fallback**
   - If audio fails, device should vibrate
   - Pattern: 200ms, 100ms, 200ms

## Test 2: Customer App Real-Time Updates

### Setup
1. **Open Customer App**
   - Navigate to http://localhost:3002
   - Scan QR code or enter bar slug
   - Open a new tab

2. **Open Staff App**
   - Navigate to http://localhost:3003
   - Log in as staff member
   - Navigate to tabs view

### Test Staff Order Confirmation

1. **Place Order from Customer App**
   - Add items to cart
   - Submit order
   - Order should appear as "Pending"

2. **Confirm Order from Staff App**
   - Find the pending order
   - Click "Confirm" button
   - Order status changes to "Confirmed"

3. **Verify Customer App Updates**
   - **WITHOUT REFRESHING** the customer app
   - Order should move from "Pending" to "Confirmed" section
   - Check console logs:
     - "📝 Real-time UPDATE event received"
     - "📝 updateOrderInList called"
     - "✅ Order updated in list"

4. **Verify No Duplicates**
   - Check that order appears only once
   - Verify order is in correct section

### Test New Staff Order

1. **Create Order from Staff App**
   - In staff app, create new order for the customer's tab
   - Add items and submit

2. **Verify Customer App Updates**
   - **WITHOUT REFRESHING** the customer app
   - New order should appear instantly
   - Check console logs:
     - "📝 Real-time INSERT event received"
     - "➕ addOrderToList called"
     - "✅ Order added to list"

3. **Verify Order Display**
   - Order shows correct items
   - Order shows correct total
   - Order shows correct status

### Test Multiple Rapid Updates

1. **Trigger Multiple Updates**
   - From staff app, confirm 3-5 pending orders rapidly
   - Or create 3-5 new orders in quick succession

2. **Verify Customer App Handles All Updates**
   - All updates should appear in customer app
   - No updates should be lost
   - No duplicate orders
   - Orders in correct chronological order

3. **Check Console Logs**
   - Should see multiple update events
   - Should see "✅ Order updated in list" for each
   - No errors

## Test 3: Integration Test Page

### Access Test Page
1. Open `dev-tools/tests/integration/realtime-notification-integration.test.html`
2. Can open directly in browser or serve via local server

### Run Tests

#### Browser Capabilities
1. Click "Detect Capabilities"
2. Verify all capabilities detected:
   - Audio API
   - Vibration API
   - Notification API
   - Service Worker
   - WebSocket
   - Device Type (Mobile/Desktop)

#### Audio Unlock
1. Click "Test Audio Unlock"
2. Should see success message
3. Check AudioContext state is "running"

#### Audio Playback
1. Click "Test Audio Playback"
2. Should hear bell sound
3. Should see success message

#### Vibration
1. Click "Test Vibration"
2. Device should vibrate (if supported)
3. Should see success/failure message

#### Notification Fallback Chain
1. Click "Test Full Fallback Chain"
2. Should attempt audio → vibration → visual
3. Should see results for each method

#### State Updates
1. Click "Test Single Update"
2. Click "Test Multiple Rapid Updates"
3. Click "Test Concurrent Updates"
4. Verify all tests pass
5. Check no duplicates

#### Run All Tests
1. Click "Run All Integration Tests"
2. Wait for all tests to complete
3. Review results summary
4. Check console log for details

## Test 4: Desktop Browser Testing

### Chrome (Desktop)
1. Open staff app
2. Verify no unlock prompt (or prompt if needed)
3. Test audio playback
4. Verify existing functionality works
5. Check console for errors

### Firefox (Desktop)
1. Repeat Chrome tests
2. Verify Firefox-specific behavior
3. Check console for errors

### Safari (Desktop - macOS)
1. Repeat Chrome tests
2. Verify Safari-specific behavior
3. Check console for errors

### Edge (Desktop)
1. Repeat Chrome tests
2. Verify Edge-specific behavior
3. Check console for errors

## Test 5: Error Handling

### Network Disconnection
1. Open customer app with active tab
2. Open browser DevTools
3. Go to Network tab
4. Set throttling to "Offline"
5. Wait 5 seconds
6. Set throttling back to "Online"
7. Verify real-time subscription reconnects
8. Trigger update from staff app
9. Verify customer app receives update

### Audio Permission Denied
1. Block audio permissions in browser settings
2. Open staff app
3. Verify fallback to vibration/visual
4. Check no errors in console

### Background Tab
1. Open staff app
2. Switch to another tab
3. Trigger notification
4. Switch back to staff app
5. Verify notification was received

## Expected Results

### Success Criteria
- ✅ Audio unlock works on iOS Safari
- ✅ Audio unlock works on Android Chrome
- ✅ Bell sound plays after unlock
- ✅ Vibration fallback works
- ✅ Visual fallback works
- ✅ Customer app updates without refresh
- ✅ Multiple rapid updates handled correctly
- ✅ No duplicate orders
- ✅ No console errors
- ✅ Desktop browsers not regressed

### Common Issues and Solutions

#### Issue: Audio doesn't play on iOS
**Solution:** Ensure user tapped unlock button. iOS requires explicit user gesture.

#### Issue: Unlock prompt doesn't appear
**Solution:** Check if audio is already unlocked. Prompt only shows when needed.

#### Issue: Customer app doesn't update
**Solution:** 
1. Check real-time subscription is active
2. Check console for subscription errors
3. Verify Supabase connection
4. Check RLS policies

#### Issue: Duplicate orders appear
**Solution:**
1. Check order state helpers are used correctly
2. Verify subscription handlers use state updater functions
3. Check for multiple subscriptions

#### Issue: Vibration doesn't work
**Solution:** 
1. Check device supports vibration
2. Check vibration not disabled in settings
3. Verify browser supports Vibration API

## Debugging Tips

### Enable Verbose Logging
All components have comprehensive logging. Check browser console for:
- 🔓 Audio unlock attempts
- 🔊 Audio playback attempts
- 📳 Vibration attempts
- 📝 Real-time events
- ✅ Success messages
- ❌ Error messages

### Use Browser DevTools
- **Console**: View logs and errors
- **Network**: Check WebSocket connections
- **Application**: Check service workers and storage
- **Performance**: Check for memory leaks

### Test in Isolation
If issues occur:
1. Test audio unlock separately
2. Test real-time updates separately
3. Test on integration test page
4. Narrow down the issue

## Reporting Issues

When reporting issues, include:
1. Browser and version
2. Device and OS
3. Steps to reproduce
4. Expected behavior
5. Actual behavior
6. Console logs
7. Screenshots/videos

## Next Steps

After completing all tests:
1. Fill out cross-browser test checklist
2. Document any issues found
3. Create bug reports for failures
4. Update documentation if needed
5. Sign off on testing
