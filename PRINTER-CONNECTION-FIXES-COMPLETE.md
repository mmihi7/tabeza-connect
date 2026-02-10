# ✅ Printer Connection Fixes - Complete

**Date:** February 9, 2026  
**Status:** All fixes applied successfully

---

## 🎯 What Was Fixed

Three critical issues were identified and fixed in the printer system:

### ✅ Fix #1: Printer Service Default URL
**File:** `packages/printer-service/index.js` (line 24)

**Problem:** Service defaulted to production URL even when running locally

**Solution:** Changed default from `https://staff.tabeza.co.ke` to `http://localhost:3003`

```javascript
// BEFORE
apiUrl: process.env.TABEZA_API_URL || 'https://staff.tabeza.co.ke',

// AFTER
apiUrl: process.env.TABEZA_API_URL || 'http://localhost:3003',
```

---

### ✅ Fix #2: Dynamic Environment Detection
**File:** `apps/staff/app/api/printer/configure-service/route.ts`

**Problem:** Configure API hardcoded production URL regardless of environment

**Solution:** Dynamically detect environment from request headers

```typescript
// Detect environment from request
const host = request.headers.get('host') || 'localhost:3003';
const protocol = host.includes('localhost') || host.includes('127.0.0.1') 
  ? 'http' 
  : 'https';
const apiUrl = `${protocol}://${host}`;
```

---

### ✅ Fix #3: Configuration Validation
**File:** `packages/printer-service/index.js` (test-print endpoint)

**Problem:** Test print endpoint didn't validate service was configured

**Solution:** Added validation checks before allowing test prints

```javascript
// Validate service is configured
if (!config.barId) {
  return res.status(400).json({
    success: false,
    error: 'Service not configured. Please configure the service first.',
    hint: 'Go to Settings and click "Auto-Configure Printer Service"',
  });
}

if (!config.apiUrl) {
  return res.status(400).json({
    success: false,
    error: 'API URL not configured. Please configure the service first.',
  });
}
```

---

## 🚀 How to Test

### Step 1: Clean Start
```bash
# Stop printer service if running (Ctrl+C)
# Stop staff app if running (Ctrl+C)

# No need to delete config.json - it doesn't exist yet
```

### Step 2: Start Printer Service
```bash
cd packages/printer-service
node index.js
```

**Expected output:**
```
🚀 Tabeza Printer Service v1.0.0
📍 Service Status:
   • Port: 8765
   • Bar ID: ⚠️  NOT CONFIGURED
   • API URL: http://localhost:3003 🏠 (LOCAL)
   • Driver ID: driver-YOUR-COMPUTER-1234567890
   • Watch Folder: C:\Users\YourName\TabezaPrints
👀 Watching folder: C:\Users\YourName\TabezaPrints
✅ Service ready at http://localhost:8765
```

### Step 3: Start Staff App Locally
```bash
cd apps/staff
pnpm dev
```

**Expected output:**
```
▲ Next.js 15.x.x
- Local:        http://localhost:3003
- Ready in X.Xs
```

### Step 4: Open Settings Page
Open browser to: `http://localhost:3003/settings`

**Expected:**
- ✅ Printer Service: Connected
- Status indicator should be green

### Step 5: Auto-Configure
Click "Auto-Configure Printer Service" button

**Expected in printer service terminal:**
```
🔧 Configuration request received:
   Bar ID: your-bar-id-here
   API URL: http://localhost:3003
💾 Config saved to: C:\...\packages\printer-service\config.json
✅ Configuration saved successfully
```

**Expected in browser:**
- Success message appears
- Printer status remains green

### Step 6: Test Print
Click "Test Print" button

**Expected in printer service terminal:**
```
📄 Test print for bar: your-bar-id to http://localhost:3003
📤 Sending to cloud: http://localhost:3003/api/printer/relay
   Bar ID: your-bar-id
   Document: Test Receipt
✅ Cloud response: Job ID test-1234567890
```

**Expected in browser:**
- Success message: "Test print sent successfully"
- No errors

**Expected in database:**
- New unmatched receipt created
- Should appear in Captain's Orders

---

## 🔍 Verification Checklist

After completing the test steps above, verify:

- [ ] Printer service shows "API URL: http://localhost:3003 🏠 (LOCAL)"
- [ ] NOT showing "https://staff.tabeza.co.ke ☁️ (PRODUCTION)"
- [ ] Auto-configure succeeds without errors
- [ ] config.json file created with correct values
- [ ] Test print succeeds without 404 errors
- [ ] Unmatched receipt appears in Captain's Orders
- [ ] No "deployment not found" errors

---

## 📁 Files Modified

1. **packages/printer-service/index.js**
   - Line 24: Changed default apiUrl to localhost
   - Lines 56-79: Added configuration validation to test-print endpoint

2. **apps/staff/app/api/printer/configure-service/route.ts**
   - Lines 22-28: Added dynamic environment detection

---

## 🎓 Understanding the Fix

### Before (Broken Flow)
```
Browser (localhost:3003)
    ↓ Test Print
Staff App API (localhost:3003)
    ↓ POST localhost:8765/api/test-print
Printer Service (localhost:8765)
    ↓ config.apiUrl = "https://staff.tabeza.co.ke" ❌
    ↓ POST https://staff.tabeza.co.ke/api/printer/relay
Production Vercel
    ↓ 404 - Deployment not found ❌
ERROR
```

### After (Fixed Flow)
```
Browser (localhost:3003)
    ↓ Test Print
Staff App API (localhost:3003)
    ↓ POST localhost:8765/api/test-print
Printer Service (localhost:8765)
    ↓ config.apiUrl = "http://localhost:3003" ✅
    ↓ POST http://localhost:3003/api/printer/relay
Staff App API (localhost:3003)
    ↓ Create unmatched receipt in Supabase
SUCCESS ✅
```

---

## 🐛 Troubleshooting

### If printer service shows "NOT CONFIGURED"
- This is normal on first start
- Click "Auto-Configure" in Settings to fix

### If test print fails with "Service not configured"
- The validation is working correctly
- Click "Auto-Configure" first, then try test print again

### If still getting 404 errors
1. Check printer service terminal - what URL is it sending to?
2. Check config.json - should have `"apiUrl": "http://localhost:3003"`
3. Make sure staff app is running on localhost:3003, not production

### If "Cannot connect to printer service"
1. Make sure printer service is running: `node index.js`
2. Check it's on port 8765: `curl http://localhost:8765/api/status`
3. Make sure you're testing from localhost:3003, not production

---

## 🎯 Key Takeaways

1. **Local testing requires local URLs** - Can't mix localhost and production
2. **Environment detection is critical** - Same code runs in different environments
3. **Configuration validation prevents errors** - Better to fail early with clear message
4. **config.json doesn't exist until first configure** - No need to delete it initially

---

## ✅ Success Criteria

The fixes are working correctly when:

1. Printer service defaults to localhost URL
2. Auto-configure detects environment correctly
3. Test print validates configuration before sending
4. All requests stay within localhost (no production calls)
5. Unmatched receipts appear in Captain's Orders

All three fixes have been applied and are ready for testing!
