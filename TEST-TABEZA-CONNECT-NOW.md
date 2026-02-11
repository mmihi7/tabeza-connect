# ✅ Test Tabeza Connect - Step by Step

## 🎯 Goal
Verify that Tabeza Connect works end-to-end.

## 📋 Pre-Test Checklist

- [ ] You're in PowerShell or Command Prompt
- [ ] You're ready to approve electron build (one time)
- [ ] You have a test Bar ID ready (or will use `test-venue-123`)

## 🚀 Step 1: Run the Application

### Open PowerShell and run:
```powershell
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron
```

### Expected Output:
```
? Choose which packages to build
  ○ electron
```

### Your Actions:
1. Press `SPACE` (you'll see ● electron)
2. Press `ENTER`
3. Type `y`
4. Press `ENTER`

### Wait for:
- Electron to download and build (~30 seconds)
- Setup window to appear

## ✅ Step 2: Setup Window Appears

### What You Should See:
- [ ] Green-themed window
- [ ] "Tabeza Connect" title
- [ ] "Bridge your POS to the cloud" tagline
- [ ] Bar ID input field
- [ ] "Save & Start Service" button
- [ ] Instructions about finding Bar ID

### If Window Doesn't Appear:
```powershell
# Delete any existing config
del %APPDATA%\Tabeza\config.json

# Try again
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron
```

## ✅ Step 3: Enter Bar ID

### Test Bar ID:
```
test-venue-123
```

Or use a real Bar ID from: Staff Dashboard → Settings → Venue Configuration

### Your Actions:
1. Click in the Bar ID field
2. Type: `test-venue-123`
3. Click "Save & Start Service"

### Expected:
- [ ] Button changes to "Configuring..."
- [ ] Loading spinner appears
- [ ] Window closes after ~2 seconds

## ✅ Step 4: Verify Tray Icon

### Look in System Tray (bottom-right):
- [ ] Green icon appears (may be in hidden icons)
- [ ] Hover shows "Tabeza Connect - POS Bridge Service"

### Right-Click the Icon:
- [ ] Menu appears
- [ ] Shows "Tabeza Connect" header
- [ ] Shows "Bar: test-venue-123"
- [ ] Shows "● Connected"
- [ ] Has menu options (Configuration, Dashboard, Restart, etc.)

## ✅ Step 5: Verify Service is Running

### Open PowerShell:
```powershell
netstat -ano | findstr :8765
```

### Expected Output:
```
TCP    0.0.0.0:8765    0.0.0.0:0    LISTENING    [PID]
```

### If Nothing Shows:
- Service didn't start
- Check tray icon menu
- Click "Restart Service"

## ✅ Step 6: Check Configuration

### Open File Explorer:
```
%APPDATA%\Tabeza
```

### Expected Files:
- [ ] `config.json` exists
- [ ] Contains your Bar ID

### Open config.json:
```json
{
  "barId": "test-venue-123",
  "apiUrl": "https://staff.tabeza.co.ke",
  "driverId": "driver-...",
  "watchFolder": "C:\\Users\\...\\TabezaPrints",
  "installedAt": "2026-02-11T...",
  "autoStart": true
}
```

## ✅ Step 7: Check Auto-Start

### Open File Explorer:
```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
```

### Expected:
- [ ] "Tabeza Connect.lnk" shortcut exists

### Test Auto-Start (Optional):
1. Right-click tray icon → Exit
2. Double-click the startup shortcut
3. Tray icon should reappear (no setup window)

## ✅ Step 8: Test Configuration Page

### Open Browser:
```
http://localhost:8765/configure.html
```

### Expected:
- [ ] Configuration page loads
- [ ] Shows current Bar ID
- [ ] Shows service status
- [ ] Has test connection button

## 🎉 Success Criteria

### All of these should be ✅:
- [ ] Setup window appeared with green theme
- [ ] Bar ID was accepted
- [ ] Window closed after saving
- [ ] Green tray icon appeared
- [ ] Right-click menu works
- [ ] Service is listening on port 8765
- [ ] Config file was created
- [ ] Startup shortcut was created
- [ ] Configuration page loads

## 🐛 Troubleshooting

### Setup window won't appear
```powershell
del %APPDATA%\Tabeza\config.json
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron
```

### Tray icon doesn't appear
- Check Task Manager for "Tabeza Connect" process
- Check if port 8765 is in use by another app
- Try restarting the service from tray menu

### "npm error" messages
- Don't use `npm` commands
- Always use `pnpm` from root directory
- See `TABEZA-CONNECT-NPM-ERROR-FIX.md`

### Service won't start
```powershell
# Check if port is available
netstat -ano | findstr :8765

# If in use, find and kill the process
taskkill /PID [PID] /F
```

## 📦 Next: Build Installer

After testing succeeds:

```powershell
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect build:electron
```

Installer will be in: `packages\printer-service\dist\Tabeza Connect Setup.exe`

## 📚 Documentation

- **Complete Guide:** `TABEZA-CONNECT-COMPLETE-GUIDE.md`
- **Quick Start:** `QUICK-START-TABEZA-CONNECT.md`
- **Status:** `TABEZA-CONNECT-STATUS.md`
- **README:** `README-TABEZA-CONNECT.md`

## ✅ Test Complete!

If all steps passed, Tabeza Connect is working correctly!

You can now:
1. Build the installer
2. Test with real POS receipts
3. Deploy to production venues

---

**Ready to test?** Run the first command and follow the steps!

```powershell
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron
```
