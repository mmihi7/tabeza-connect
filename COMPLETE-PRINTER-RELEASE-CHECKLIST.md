# Complete Printer Service Release - Checklist

## Pre-Release Status
- [x] Printer service code written
- [x] Build system configured
- [x] GitHub repository created
- [x] Code pushed to GitHub
- [ ] Executable built
- [ ] GitHub release created
- [ ] Download URLs updated
- [ ] Database migration applied

## Step-by-Step Completion

### Step 1: Build and Release (5 minutes)

**Action**: Open a NEW Command Prompt window and run:

```cmd
cd C:\Projects\Tabz\packages\printer-service
complete-release.bat
```

**Expected Output**:
```
Step 1: Killing any running instances...
Step 2: Cleaning old build...
Step 3: Building executable...
✅ Build successful!
Step 4: Creating GitHub release...
✅ GitHub release created!
Step 5: Updating download URLs in app...
✅ Download URLs updated!
```

**Checklist**:
- [ ] Script completed without errors
- [ ] File exists: `packages/printer-service/dist/tabeza-printer-service.exe`
- [ ] GitHub release visible at: https://github.com/billoapp/tabeza-printer-service/releases
- [ ] Download URLs updated in app files

**If Script Fails**: See troubleshooting in `packages/printer-service/RELEASE-NOW.md`

---

### Step 2: Commit Changes (2 minutes)

**Action**: Commit the URL updates to git:

```cmd
cd C:\Projects\Tabz
git status
git add .
git commit -m "Update printer service download URLs to GitHub releases"
git push
```

**Checklist**:
- [ ] Changes committed
- [ ] Changes pushed to GitHub
- [ ] No merge conflicts

---

### Step 3: Apply Database Migration (3 minutes)

**Action**: Apply the printer relay tables migration:

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor
4. Click "New Query"
5. Copy contents of `database/add-printer-relay-tables.sql`
6. Paste and click "Run"

**Checklist**:
- [ ] Migration ran successfully
- [ ] Tables created: `printer_relay_jobs`, `printer_relay_logs`
- [ ] No SQL errors

---

### Step 4: Test Everything (5 minutes)

#### Test 1: Download Link

```cmd
cd C:\Projects\Tabz
pnpm dev:staff
```

1. Open browser: http://localhost:3003
2. Go to printer setup page
3. Click "Download Printer Service"
4. Verify download starts from GitHub

**Checklist**:
- [ ] Download button works
- [ ] File downloads successfully
- [ ] File size is reasonable (>10MB)

#### Test 2: Service Runs

1. Navigate to Downloads folder
2. Double-click `tabeza-printer-service.exe`
3. Open browser: http://localhost:8765/api/status

**Expected Response**:
```json
{
  "status": "running",
  "version": "1.0.0",
  "port": 8765
}
```

**Checklist**:
- [ ] Service starts without errors
- [ ] Status endpoint responds
- [ ] Port 8765 is accessible

#### Test 3: Cloud Relay Endpoint

Open browser or use curl:
```
http://localhost:3003/api/printer/relay
```

**Checklist**:
- [ ] Endpoint exists (not 404)
- [ ] Returns proper error for missing data (expected)

---

## Completion Verification

### All Systems Go ✅

Check all these are true:

- [ ] GitHub release exists with .exe file
- [ ] Download URLs updated in app
- [ ] Changes committed and pushed
- [ ] Database migration applied
- [ ] Download works from app
- [ ] Service runs on Windows
- [ ] Cloud relay endpoint exists

### Documentation Complete ✅

- [ ] `PRINTER-SERVICE-RELEASE-SUMMARY.md` created
- [ ] `packages/printer-service/RELEASE-NOW.md` created
- [ ] `packages/printer-service/README.md` exists
- [ ] Database migration documented

---

## What's Next?

### For Users (Venue Owners)
1. Download printer service from staff app
2. Run as Administrator
3. Configure with Bar ID
4. Point POS to http://localhost:8765/api/print-job

### For Development
1. Monitor GitHub issues for bug reports
2. Add printer auto-discovery
3. Implement receipt parsing for different POS systems
4. Add automatic updates

---

## Rollback Plan (If Needed)

If something goes wrong:

1. **Delete GitHub release**:
   ```cmd
   gh release delete v1.0.0 --yes
   ```

2. **Revert URL changes**:
   ```cmd
   git revert HEAD
   git push
   ```

3. **Remove database tables**:
   ```sql
   DROP TABLE IF EXISTS printer_relay_logs;
   DROP TABLE IF EXISTS printer_relay_jobs;
   ```

---

## Success Criteria

Release is successful when:
- ✅ Users can download the service from the app
- ✅ Service runs on Windows without errors
- ✅ POS systems can send print jobs to the service
- ✅ Digital receipts appear in customer app
- ✅ No critical bugs reported in first 24 hours

---

## Contact & Support

- **GitHub Issues**: https://github.com/billoapp/tabeza-printer-service/issues
- **Documentation**: `packages/printer-service/README.md`
- **Troubleshooting**: `packages/printer-service/RELEASE-NOW.md`
