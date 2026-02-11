# 🔧 Tabeza Connect - Fixed and Ready

## ✅ Issues Fixed

1. **SVG Icon Error** - Changed to use icon.ico (Windows compatible)
2. **Port 8765 in use** - Need to kill existing printer service first

## 🚀 Run These Commands

### Step 1: Kill Existing Printer Service

```powershell
# Find the process using port 8765
netstat -ano | findstr :8765
```

You'll see something like:
```
TCP    0.0.0.0:8765    0.0.0.0:0    LISTENING    12345
```

The last number (12345) is the Process ID (PID).

### Step 2: Kill That Process

```powershell
# Replace 12345 with the actual PID from above
taskkill /PID 12345 /F
```

### Step 3: Run Tabeza Connect

```powershell
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron
```

## 🎯 What Should Happen

1. **Setup window appears** (if first run, or config deleted)
2. **Enter Bar ID** (e.g., `test-venue-123`)
3. **Click "Save & Start Service"**
4. **Tray icon appears** (green icon in system tray)
5. **Right-click tray icon** to see menu

## 🔍 Quick Check

### Is port 8765 free?
```powershell
netstat -ano | findstr :8765
```

Should show nothing if port is free.

### Is Tabeza Connect running?
Look in system tray (bottom-right) for the green icon.

### Check Task Manager
- Press `Ctrl+Shift+Esc`
- Look for "Tabeza Connect" or "electron"

## 🐛 If Setup Window Doesn't Appear

Delete the config and try again:

```powershell
del %APPDATA%\Tabeza\config.json
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron
```

## ✅ Success Checklist

- [ ] Killed existing printer service
- [ ] Port 8765 is free
- [ ] Ran `pnpm --filter @tabeza/connect start:electron`
- [ ] Setup window appeared
- [ ] Entered Bar ID
- [ ] Clicked "Save & Start Service"
- [ ] Tray icon appeared
- [ ] Right-click menu works

## 📋 One-Line Fix

```powershell
# Kill any process on port 8765, then run Tabeza Connect
$pid = (Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue).OwningProcess; if ($pid) { Stop-Process -Id $pid -Force }; cd C:\Projects\Tabz; pnpm --filter @tabeza/connect start:electron
```

## 🎉 After It Works

The tray icon will be in your system tray (bottom-right corner). It might be hidden in the overflow area (click the ^ arrow).

Right-click the icon to:
- See your Bar ID
- Check connection status
- Open configuration
- Restart service
- Exit

---

**Ready?** Kill the existing service and run the command!
