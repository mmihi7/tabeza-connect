# 🚀 Run Tabeza Connect - Final Steps

## ✅ Installation Complete

`pnpm install` finished successfully. Electron is ready but needs approval.

## 🎯 Run These Commands in Order

### Step 1: Kill Existing Printer Service (if running)

```powershell
# PowerShell one-liner to kill any process on port 8765
$pid = (Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue).OwningProcess; if ($pid) { Stop-Process -Id $pid -Force; Write-Host "Killed process $pid" } else { Write-Host "Port 8765 is free" }
```

### Step 2: Approve Electron Build

```powershell
pnpm approve-builds
```

When prompted:
1. Press `SPACE` to select `electron`
2. Press `ENTER` to confirm
3. Type `y` and press `ENTER` to approve

### Step 3: Run Tabeza Connect

```powershell
pnpm --filter @tabeza/connect start:electron
```

## 🎯 What Will Happen

1. **Setup window appears** (green theme with "Tabeza Connect" title)
2. **Enter Bar ID** (e.g., `test-venue-123`)
3. **Click "Save & Start Service"**
4. **Window closes**
5. **Green tray icon appears** in system tray (bottom-right)

## 📍 Finding the Tray Icon

Look in the **system tray** (bottom-right corner). The icon might be hidden - click the **^ arrow** to see all icons.

Right-click the icon to see:
- Bar ID
- Connection status
- Configuration
- Restart service
- Exit

## 🔍 Verify It's Working

### Check if service is running:
```powershell
netstat -ano | findstr :8765
```

Should show:
```
TCP    0.0.0.0:8765    0.0.0.0:0    LISTENING    [PID]
```

### Open configuration page:
```
http://localhost:8765/configure.html
```

## 🐛 If Setup Window Doesn't Appear

Delete config and try again:
```powershell
del %APPDATA%\Tabeza\config.json
pnpm --filter @tabeza/connect start:electron
```

## ⚡ Quick All-in-One Command

```powershell
# Kill existing service, approve builds, and run Tabeza Connect
$pid = (Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue).OwningProcess; if ($pid) { Stop-Process -Id $pid -Force }; pnpm approve-builds; pnpm --filter @tabeza/connect start:electron
```

## ✅ Success Checklist

- [ ] Killed existing printer service (if any)
- [ ] Approved electron build
- [ ] Ran Tabeza Connect
- [ ] Setup window appeared
- [ ] Entered Bar ID
- [ ] Clicked "Save & Start Service"
- [ ] Tray icon appeared
- [ ] Right-click menu works
- [ ] Port 8765 is listening

## 🎉 You're Done!

Once the tray icon appears, Tabeza Connect is running and ready to receive receipts from your POS system.

---

**Ready?** Run the commands above in order!
