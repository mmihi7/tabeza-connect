# Printer Heartbeat Audit - Response & Action Plan

**Date:** February 11, 2026  
**Auditor:** Claude (Second Opinion)  
**Grade Received:** C+  
**Status:** Action plan created

---

## Executive Summary

The audit identified **3 critical issues** and **4 architectural concerns** that must be addressed before production deployment. This document outlines the response and action plan.

---

## CRITICAL ISSUES (P0 - Must Fix Before Production)

### 1. Security Flaw: Missing Authentication 🚨

**Audit Finding:** "The heartbeat endpoint has no authentication. Anyone can send POST requests and inject fake heartbeat data."

**Status:** ✅ CONFIRMED - Critical security vulnerability

**Current State:**
```typescript
// apps/staff/app/api/printer/heartbeat/route.ts
export async function POST(request: NextRequest) {
  const { barId, driverId, version } = await request.json();
  
  // Only validates barId exists - NO authentication!
  const { data: bar } = await supabase
    .from('bars')
    .select('id')
    .eq('id', barId)
    .single();
    
  // Upserts heartbeat - anyone can spoof this
  await supabase.from('printer_drivers').upsert({...});
}
```

**Impact:**
- Attackers can spoof printer status
- Malicious actors can pollute database
- No way to verify heartbeat legitimacy
- Venues could see fake "online" status

**Solution - Add Shared Secret Authentication:**

```typescript
// 1. Add to printer service config
const config = {
  barId: '...',
  apiUrl: '...',
  driverId: '...',
  apiSecret: process.env.TABEZA_API_SECRET || generateSecret(), // New
};

// 2. Send secret in heartbeat
const payload = {
  barId: config.barId,
  driverId: config.driverId,
  version: '1.0.0',
  apiSecret: config.apiSecret, // New
};

// 3. Validate in API endpoint
export async function POST(request: NextRequest) {
  const { barId, driverId, apiSecret } = await request.json();
  
  // Verify secret matches what's stored for this bar
  const { data: bar } = await supabase
    .from('bars')
    .select('id, printer_api_secret')
    .eq('id', barId)
    .single();
    
  if (!bar || bar.printer_api_secret !== apiSecret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  // Continue with heartbeat processing...
}
```

**Action Items:**
- [ ] Add `printer_api_secret` column to `bars` table
- [ ] Generate secret during printer configuration
- [ ] Update printer service to send secret
- [ ] Update API endpoint to validate secret
- [ ] Add rate limiting (max 3 heartbeats/minute per driver)

---

### 2. Environment Detection Missing

**Audit Finding:** "The proposed solution breaks local development. Manually editing config.json between environments is fragile."

**Status:** ✅ CONFIRMED - Will cause developer friction

**Current Problem:**
- Config has one `apiUrl` field
- Must be `http://localhost:3003` for dev
- Must be `https://staff.tabeza.co.ke` for production
- Manually switching breaks workflow

**Solution - Auto-Detection:**

```javascript
// packages/printer-service/index.js

// Detect environment automatically
function detectEnvironment() {
  // Check if running in production (has real barId)
  const hasRealBarId = config.barId && 
    config.barId !== 'test-bar-id' && 
    config.barId.length === 36; // UUID length
  
  // Check if local dev server is running
  const localDevRunning = await checkLocalServer('http://localhost:3003');
  
  if (localDevRunning) {
    return 'http://localhost:3003';
  } else if (hasRealBarId) {
    return 'https://staff.tabeza.co.ke';
  } else {
    return 'http://localhost:3003'; // Default to dev
  }
}

async function checkLocalServer(url) {
  try {
    const response = await fetch(`${url}/api/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(1000) // 1 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Use detected URL
const detectedApiUrl = await detectEnvironment();
config.apiUrl = process.env.TABEZA_API_URL || detectedApiUrl;

console.log(`🔍 Environment detected: ${config.apiUrl}`);
```

**Action Items:**
- [ ] Implement environment auto-detection
- [ ] Add `TABEZA_API_URL` environment variable override
- [ ] Test in both dev and production
- [ ] Update documentation

---

### 3. Parser Advisory Compliance

**Audit Finding:** "Does 'offline' status block functionality? This could violate the Parser Advisory."

**Status:** ✅ VERIFIED - Compliant (offline is informational only)

**Investigation Results:**
```typescript
// Offline status is ONLY used for UI display
{printerServiceStatus === 'offline' ? (
  <div className="bg-amber-50 border border-amber-300">
    <AlertCircle className="text-amber-600" />
    <p>Printer service is offline</p>
  </div>
) : (
  <div className="bg-green-50 border border-green-300">
    <CheckCircle className="text-green-600" />
    <p>Printer service is online</p>
  </div>
)}
```

**Confirmation:** 
- ✅ Offline status does NOT block print jobs
- ✅ Offline status does NOT reject receipts
- ✅ Offline status is purely informational
- ✅ Complies with Parser Advisory: "Never block, delay, or reject print jobs"

**No action needed** - System is compliant.

---

## ARCHITECTURAL CONCERNS (P1 - Should Fix Soon)

### 4. No Offline Fallback Strategy

**Audit Finding:** "What happens when venue's internet goes down?"

**Current Behavior:**
- Heartbeats fail silently
- Printer shows as "offline" after 2 minutes
- No queuing or retry mechanism

**Recommended Solution:**
```javascript
// Queue failed heartbeats
const heartbeatQueue = [];

async function sendHeartbeat() {
  try {
    await sendToCloud(payload);
    
    // Send any queued heartbeats
    while (heartbeatQueue.length > 0) {
      const queued = heartbeatQueue.shift();
      await sendToCloud(queued);
    }
  } catch (error) {
    // Queue for later
    heartbeatQueue.push({
      ...payload,
      queuedAt: new Date().toISOString()
    });
    
    // Limit queue size
    if (heartbeatQueue.length > 10) {
      heartbeatQueue.shift(); // Remove oldest
    }
  }
}
```

**Action Items:**
- [ ] Implement heartbeat queuing
- [ ] Add queue size limit (10 max)
- [ ] Send queued heartbeats when connection restores
- [ ] Log queue status

---

### 5. Heartbeat Timeout Too Aggressive

**Audit Finding:** "UI timeout is 2 minutes. That's only 4 missed heartbeats. Too sensitive?"

**Current Settings:**
- Heartbeat interval: 30 seconds
- Offline threshold: 2 minutes (120 seconds)
- Missed heartbeats before offline: 4

**Analysis:**
- Network blips could cause false "offline" status
- Transient issues would trigger unnecessary alerts
- 4 missed heartbeats is too sensitive

**Recommended Change:**
```sql
-- Current: 2 minutes
WHERE last_heartbeat > NOW() - INTERVAL '2 minutes'

-- Recommended: 5 minutes (10 missed heartbeats)
WHERE last_heartbeat > NOW() - INTERVAL '5 minutes'
```

**Action Items:**
- [ ] Change offline threshold to 5 minutes
- [ ] Update API endpoint query
- [ ] Update UI documentation
- [ ] Test with simulated network issues

---

### 6. Database Migration Not Verified in Production

**Audit Finding:** "Document assumes migration 059 is deployed but doesn't confirm table exists."

**Action Items:**
- [ ] Run verification query in production:
```sql
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'printer_drivers'
ORDER BY ordinal_position;
```
- [ ] Verify RLS policies exist
- [ ] Test insert/update permissions
- [ ] Document verification results

---

### 7. API Endpoint Deployment Status Unknown

**Audit Finding:** "Document assumes /api/printer/heartbeat exists in production. Was this verified?"

**Action Items:**
- [ ] Check Vercel deployment logs
- [ ] Test endpoint directly:
```bash
curl -X POST https://staff.tabeza.co.ke/api/printer/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"barId":"test","driverId":"test","version":"1.0.0"}'
```
- [ ] Verify response format
- [ ] Document deployment status

---

## REVISED SOLUTION (Based on Audit)

### Immediate Fix (For Current User)

**DO NOT just change config.json** - This breaks local dev.

Instead:

1. **Stop printer service**
2. **Set environment variable:**
   ```bash
   set TABEZA_API_URL=https://staff.tabeza.co.ke
   node index.js
   ```
3. **Verify heartbeats reach production**

This allows easy switching back to dev:
```bash
# For dev
set TABEZA_API_URL=http://localhost:3003
node index.js

# For production  
set TABEZA_API_URL=https://staff.tabeza.co.ke
node index.js
```

### Proper Fix (Code Changes)

**Priority Order:**

1. **P0 - Security** (Must fix before production)
   - Add authentication to heartbeat endpoint
   - Implement shared secret validation
   - Add rate limiting

2. **P0 - Environment Detection** (Must fix before production)
   - Auto-detect dev vs production
   - Support `TABEZA_API_URL` override
   - Test in both environments

3. **P1 - Resilience** (Should fix soon)
   - Implement heartbeat queuing
   - Increase offline threshold to 5 minutes
   - Add offline fallback strategy

4. **P1 - Verification** (Should fix soon)
   - Verify database migration in production
   - Verify API endpoints deployed
   - Document deployment status

---

## TESTING PLAN

### After Security Fix
1. Test heartbeat with valid secret → Should succeed
2. Test heartbeat with invalid secret → Should fail with 401
3. Test heartbeat with no secret → Should fail with 401
4. Test rate limiting → Should block after 3/minute

### After Environment Detection
1. Start printer service with local dev running → Should use localhost
2. Start printer service with no local dev → Should use production
3. Set `TABEZA_API_URL` override → Should use override
4. Test switching between environments → Should work seamlessly

### After Resilience Improvements
1. Disconnect internet → Heartbeats should queue
2. Reconnect internet → Queued heartbeats should send
3. Simulate network blip → Should not show offline immediately
4. Wait 5 minutes → Should show offline

---

## ROLLBACK PLAN

If any fix causes issues:

1. **Revert code changes:**
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. **Revert database changes:**
   ```sql
   -- Remove printer_api_secret column if added
   ALTER TABLE bars DROP COLUMN IF EXISTS printer_api_secret;
   ```

3. **Revert printer service:**
   ```bash
   # Use previous version
   git checkout <previous-commit>
   node index.js
   ```

---

## AUDIT RECOMMENDATIONS - RESPONSE

### ✅ Accepted Recommendations

1. **Add authentication** - Critical, will implement
2. **Implement environment auto-detection** - Prevents dev/prod conflicts
3. **Build local configuration page** - Best long-term solution
4. **Increase offline threshold** - More resilient
5. **Add offline fallback** - Better user experience

### ⚠️ Partially Accepted

6. **WebSocket connection** - Over-engineered for now, defer to v2

### ❌ Not Implementing (Yet)

7. **Manual configuration instructions** - Will use environment detection instead

---

## FINAL GRADE RESPONSE

**Audit Grade:** C+  
**Our Response:** Accepted with action plan

**What We're Fixing:**
- ✅ Security authentication (P0)
- ✅ Environment detection (P0)
- ✅ Offline resilience (P1)
- ✅ Timeout adjustment (P1)
- ✅ Deployment verification (P1)

**Timeline:**
- P0 fixes: Before production deployment (this week)
- P1 fixes: Within 2 weeks of production
- Documentation: Ongoing

---

## NEXT STEPS

1. **Immediate (Today):**
   - Use environment variable workaround for current user
   - Verify database migration in production
   - Verify API endpoints deployed

2. **This Week (P0):**
   - Implement authentication
   - Implement environment auto-detection
   - Test in both environments

3. **Next 2 Weeks (P1):**
   - Implement offline queuing
   - Adjust timeout threshold
   - Build local configuration page

4. **Ongoing:**
   - Monitor heartbeat success rate
   - Collect user feedback
   - Iterate on improvements

---

**Status:** Action plan created, ready for implementation  
**Next Review:** After P0 fixes completed
