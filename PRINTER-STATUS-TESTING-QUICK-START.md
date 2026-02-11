# PrinterStatusIndicator Testing - Quick Start

## 🚀 Quick Test (5 minutes)

### Option 1: Manual Testing (Recommended)
```bash
# Open the HTML test page in your browser
open dev-tools/tests/printer-status-indicator-test.html
```

**What to do:**
1. Enter your bar ID in the input field
2. Follow the test scenarios on the page
3. Check off items in the checklist as you complete them
4. Use the API testing tools to verify endpoints

### Option 2: Automated Testing
```bash
# Run the automated test script
node dev-tools/scripts/test-printer-status-component.js <your-bar-id>

# Example
node dev-tools/scripts/test-printer-status-component.js 123e4567-e89b-12d3-a456-426614174000
```

## 📋 Essential Tests

### Test 1: Connected State ✅
1. Start Tabeza Connect printer service
2. Open staff app settings
3. **Verify:** Green "Connected" status with driver details

### Test 2: Disconnected State ❌
1. Stop Tabeza Connect printer service
2. Wait 2 minutes
3. **Verify:** Red "Disconnected" status with download button

### Test 3: Real-time Updates 🔄
1. Start with printer service stopped
2. Start printer service (don't refresh page)
3. **Verify:** Status changes automatically to "Connected"

### Test 4: Test Print 🖨️
1. Ensure printer is connected
2. Click "Test Print" button
3. **Verify:** Success message and physical print (if available)

## 🎯 Pass Criteria

Component passes if:
- ✅ Shows "Connected" when printer service is running
- ✅ Shows "Disconnected" when printer service is stopped
- ✅ Updates automatically without page refresh
- ✅ "Last seen" time updates correctly
- ✅ Test print works when connected
- ✅ No console errors

## 🔧 Troubleshooting

### Status stuck on "Checking..."
- Check browser console for errors
- Verify bar ID is correct
- Ensure API endpoint is accessible

### Real-time updates not working
- Check Supabase realtime is enabled
- Verify RLS policies
- Polling should work as backup (60s)

### Test print fails
- Verify printer service is running on localhost:8765
- Check printer service logs
- Ensure printer is configured

## 📚 Full Documentation

For detailed testing procedures, see:
- **Testing Guide:** `dev-tools/docs/printer-status-indicator-testing-guide.md`
- **HTML Test Page:** `dev-tools/tests/printer-status-indicator-test.html`
- **Test Script:** `dev-tools/scripts/test-printer-status-component.js`

## 🎉 Done?

After testing:
1. Mark task 4.2 as complete in `.kiro/specs/printer-driver-heartbeat-system/tasks.md`
2. Document any issues found
3. Proceed to next task (5.1)
