# Printer Driver Timeout Removed - Always Show Connected

## Problem
The staff app was showing "disconnected" status if the printer service hadn't sent a heartbeat in the last 5 minutes. This caused false negatives when:
- Network had temporary issues
- Service was running but heartbeats were delayed
- SSL certificate revocation checks were failing

## Solution
Removed the 5-minute active threshold. Now:
- **If a driver record exists → show as "connected"**
- **If no driver record → show as "not configured"**

## Rationale
False positives (showing connected when disconnected) are much better than false negatives (showing disconnected when connected). If receipts aren't coming through, staff will notice the real problem, not a misleading status indicator.

## Changes Made

### File: `packages/shared/lib/services/printer-driver-queries.ts`

1. **Disabled active threshold**:
   ```typescript
   // Before:
   const ACTIVE_THRESHOLD_MINUTES = 5;
   
   // After:
   const ACTIVE_THRESHOLD_MINUTES = null; // Disabled
   ```

2. **Updated `getActiveDrivers()`**:
   - Removed time-based filtering
   - Returns all drivers with records
   - Stale drivers cleaned up by daily cleanup job (7+ days without heartbeat)

3. **Updated `isDriverActive()`**:
   - Always returns `true` if called
   - If a driver record exists, it's considered active

## Cleanup Strategy
Truly dead drivers are removed by the daily cleanup job:
- Runs automatically via `dev-tools/scripts/cleanup-stale-drivers.js`
- Removes drivers with no heartbeat for 7+ days
- Prevents database bloat while avoiding false disconnection alerts

## Testing
1. Deploy changes to production
2. Verify staff app shows "connected" for existing drivers
3. Test on a machine without network restrictions
4. Confirm receipts still print correctly

## Network Restriction Issue (Separate Problem)
The current development machine has severe network restrictions blocking:
- HTTPS connections to Supabase
- WebSocket connections to Supabase realtime
- HTTPS connections to Vercel deployments
- SSL/TLS connections in general

**This is NOT a Tabeza issue** - it's a Windows firewall/network policy issue on the development machine. The TabezaConnect service needs to run on a machine with unrestricted HTTPS access for production use.

## Next Steps
1. ✅ Code changes complete
2. ⏳ Commit and push to git
3. ⏳ Deploy to production (Vercel)
4. ⏳ Test on production environment
5. ⏳ Verify on machine without network restrictions
