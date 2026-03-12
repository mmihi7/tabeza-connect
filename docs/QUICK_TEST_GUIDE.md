# Quick Test Guide - TabezaConnect Integration

## 🚀 Quick Start (5 minutes)

### 1. Verify Apps Are Running
```cmd
netstat -ano | findstr :3002
netstat -ano | findstr :3003
```
✅ Should show processes on both ports

### 2. Test Heartbeat API
```cmd
cd c:\Projects\Tabz
test-heartbeat.bat
```
✅ Should return: `{"success":true,"message":"Heartbeat received"}`

### 3. Check Staff Dashboard
1. Open browser: `http://localhost:3003`
2. Login with your test account
3. Look for printer status section
4. Should show "Connected" with green indicator

### 4. Verify Database
```bash
docker exec tabeza-psql-cli psql -c "SELECT driver_id, status, version, last_heartbeat FROM printer_drivers WHERE bar_id = '438c80c1-fe11-4ac5-8a48-2fc45104ba31';"
```
✅ Should show TEST-DRIVER-001 with status 'online'

---

## 🔧 If Something's Wrong

### Apps Not Running?
```cmd
cd c:\Projects\Tabz
taskkill /IM node.exe /F
pnpm dev
```

### Docker Not Running?
```cmd
docker ps
# If empty, start Docker Desktop
```

### Test Failed?
Check the logs:
- Staff app console (terminal where `pnpm dev` is running)
- Docker logs: `docker logs tabeza-db`

---

## 📊 What You Should See

### In Terminal (pnpm dev):
```
apps/staff dev: ▲ Next.js 15.5.9
apps/staff dev: - Local:        http://localhost:3003
apps/customer dev: ▲ Next.js 15.5.9
apps/customer dev: - Local:        http://localhost:3002
```

### In Browser (http://localhost:3003):
- Orange header with bar name
- Stats cards showing tabs, orders, revenue
- **Printer Status section** (if venue is Basic or Venue+POS)
- List of active tabs

### In Database:
```
 driver_id        | status | version | last_heartbeat
------------------+--------+---------+-------------------------
 TEST-DRIVER-001  | online | 1.3.0   | 2026-02-19 10:30:45+00
```

---

## 🎯 Success = All Green

- ✅ Apps running on ports 3002 and 3003
- ✅ Heartbeat API returns success
- ✅ Database has printer entry
- ✅ Staff dashboard shows "Connected"

---

## 📞 Quick Commands Reference

```cmd
# Check ports
netstat -ano | findstr :3002
netstat -ano | findstr :3003

# Kill node processes
taskkill /IM node.exe /F

# Start apps
cd c:\Projects\Tabz
pnpm dev

# Test heartbeat
cd c:\Projects\Tabz
test-heartbeat.bat

# Check database
docker exec tabeza-psql-cli psql -c "SELECT * FROM printer_drivers;"

# Check Docker
docker ps

# View logs
docker logs tabeza-db
```

---

**Test Bar ID**: `438c80c1-fe11-4ac5-8a48-2fc45104ba31`  
**Staff App**: http://localhost:3003  
**Customer App**: http://localhost:3002  
**Supabase**: http://localhost:8000
