# TabezaConnect Integration - Testing Summary

## Current Status: ✅ READY FOR TESTING

All components are in place. Apps are running. Ready to test the full integration flow.

---

## What's Been Implemented

### 1. Backend API Endpoints ✅
- **Heartbeat API**: `POST /api/printer/heartbeat` - Receives driver status updates
- **Receipt Ingest API**: `POST /api/receipts/ingest` - Receives raw receipt data

### 2. Database Schema ✅
- `printer_drivers` table - Tracks connected drivers
- `raw_pos_receipts` table - Stores raw receipt data
- `pos_receipts` table - Stores parsed receipts
- `pos_receipt_items` table - Stores line items

### 3. Frontend UI ✅
- `PrinterStatus.tsx` component created
- Integrated into staff dashboard (line 1177-1186 of `apps/staff/app/page.tsx`)
- Shows for Basic mode and Venue+POS mode only
- Real-time updates via Supabase subscriptions

### 4. Local Development Environment ✅
- Docker Compose running Supabase at `http://localhost:8000`
- Staff app running at `http://localhost:3003`
- Customer app running at `http://localhost:3002`
- Test bar ID: `438c80c1-fe11-4ac5-8a48-2fc45104ba31`

---

## Testing Checklist

### Phase 1: Manual API Testing

#### Test 1: Heartbeat API
```cmd
cd c:\Projects\Tabz
test-heartbeat.bat
```

**Expected Result**:
- HTTP 200 response
- `{"success": true, "message": "Heartbeat received"}`
- New row in `printer_drivers` table

**Verify in Database**:
```bash
docker exec tabeza-psql-cli psql -c "SELECT * FROM printer_drivers WHERE bar_id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';"
```

#### Test 2: Staff Dashboard UI
1. Navigate to `http://localhost:3003`
2. Login with test account
3. Look for printer status section
4. Should show "No Printer Connected" initially
5. After running test-heartbeat.bat, should show "Connected" with green indicator

### Phase 2: TabezaConnect Integration

#### Configure TabezaConnect for Local Testing
Edit `C:\Program Files\TabezaConnect\config.json`:
```json
{
  "apiUrl": "http://localhost:3003",
  "barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
  "driverId": "TABEZA-CONNECT-LOCAL-TEST"
}
```

#### Restart TabezaConnect Service
```cmd
# Stop service
net stop "Tabeza POS Connect"

# Start service
net start "Tabeza POS Connect"
```

#### Verify Heartbeats
1. Wait 30 seconds
2. Check logs: `C:\ProgramData\Tabeza\logs\service.log`
3. Should see: "💓 Sending heartbeat..."
4. Check database for updates
5. Check staff dashboard for "Connected" status

### Phase 3: Receipt Capture Testing

#### Print Test Receipt
1. Print a test receipt from your POS system
2. Wait 5-10 seconds for capture and upload
3. Check local queue: `C:\ProgramData\Tabeza\queue\pending\`
4. Check database:
```bash
docker exec tabeza-psql-cli psql -c "SELECT * FROM raw_pos_receipts WHERE bar_id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31' ORDER BY captured_at DESC LIMIT 1;"
```

**Expected Result**:
- Receipt file appears in local queue
- Receipt uploaded to database
- `raw_content` field contains receipt data

---

## Troubleshooting

### Issue: Apps won't start (ports occupied)
```cmd
# Kill all node processes
taskkill /IM node.exe /F

# Restart apps
cd c:\Projects\Tabz
pnpm dev
```

### Issue: Heartbeat test fails
**Check 1**: Is staff app running?
```cmd
netstat -ano | findstr :3003
```

**Check 2**: Is Supabase running?
```cmd
docker ps
```

**Check 3**: Check environment variables
```cmd
type .env.local
```

### Issue: PrinterStatus not showing in dashboard
**Reason**: Component only shows for specific venue modes

**Check venue configuration**:
```bash
docker exec tabeza-psql-cli psql -c "SELECT id, name, venue_mode, authority_mode FROM bars WHERE id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';"
```

**Required for PrinterStatus to show**:
- `venue_mode = 'basic'` OR
- `venue_mode = 'venue'` AND `authority_mode = 'pos'`

---

## Success Criteria

### ✅ Phase 1 Complete When:
- [ ] Heartbeat API returns 200 OK
- [ ] `printer_drivers` table has test entry
- [ ] Staff dashboard shows "Connected" status

### ✅ Phase 2 Complete When:
- [ ] TabezaConnect service running
- [ ] Heartbeats sent every 30 seconds
- [ ] Database updates in real-time
- [ ] Staff dashboard shows live status

### ✅ Phase 3 Complete When:
- [ ] Test receipt captured from POS
- [ ] Receipt uploaded to database
- [ ] Receipt appears in `raw_pos_receipts` table
- [ ] No errors in TabezaConnect logs

---

## Next Steps After Testing

### If All Tests Pass:
1. Document any issues encountered
2. Update TabezaConnect config for production
3. Deploy staff app updates to production
4. Test with real POS system
5. Monitor for 24 hours

### If Tests Fail:
1. Document exact error messages
2. Check all logs (TabezaConnect, staff app, Supabase)
3. Verify network connectivity
4. Check firewall settings
5. Review configuration files

---

## Files to Review

### Backend
- `Tabz/apps/staff/app/api/printer/heartbeat/route.ts`
- `Tabz/apps/staff/app/api/receipts/ingest/route.ts`

### Frontend
- `Tabz/apps/staff/components/PrinterStatus.tsx`
- `Tabz/apps/staff/app/page.tsx` (lines 1177-1186)

### Configuration
- `Tabz/.env.local` (local Supabase config)
- `Tabz/docker-compose.yml` (Supabase services)
- `TabezaConnect/config.json` (driver config)

### Documentation
- `Tabz/TABEZACONNECT_INTEGRATION_STATUS.md`
- `Tabz/SUPABASE_LOCAL_SETUP.md`

---

**Last Updated**: February 19, 2026  
**Status**: Ready for testing  
**Environment**: Local development (Docker + localhost)
