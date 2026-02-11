# Tabeza Connect Troubleshooting Guide

## Problem: Service Won't Start (Port 8765 Already in Use)

### Symptoms
- Electron app starts but no tray icon appears
- Error: `EADDRINUSE: address already in use :::8765`
- Service exits immediately after starting
- `localhost:8765` shows connection refused

### Root Cause
Port 8765 is already in use by another process (usually a previous instance that didn't shut down cleanly).

### Solution 1: Kill Port 8765 (Quick Fix)

**Using the batch script:**
```cmd
cd C:\Projects\Tabz\packages\printer-service
kill-port-8765.bat
```

**Manual method:**
```cmd
# Find process using port 8765
netstat -ano | findstr :8765

# Kill the process (replace PID with actual process ID)
taskkill /F /PID <PID>
```

### Solution 2: Restart Computer
If the above doesn't work, restart your computer to clear all port bindings.

### Solution 3: Check for Multiple Instances
Make sure you don't have multiple instances of Tabeza Connect running:

1. Open Task Manager (Ctrl+Shift+Esc)
2. Look for "Tabeza Connect" or "electron.exe" processes
3. End all instances
4. Try starting again

## Problem: Tray Icon Not Appearing

### Cause
The service crashed before the tray icon could be created.

### Solution
1. Check if port 8765 is free (see above)
2. Look for error messages in the console
3. Verify config file exists: `%APPDATA%\Tabeza\config.json`

## Problem: Configuration Not Saved

### Symptoms
- Setup window appears every time you start
- Bar ID not persisted

### Solution
Check if config directory is writable:
```cmd
# Check if directory exists
dir %APPDATA%\Tabeza

# If not, create it
mkdir %APPDATA%\Tabeza
```

## Problem: Service Starts But Can't Connect to Tabeza

### Symptoms
- Service runs on port 8765
- Test prints fail with connection errors

### Solution
1. Check your internet connection
2. Verify Bar ID is correct
3. Check API URL in config:
   - Production: `https://staff.tabeza.co.ke`
   - Local dev: `http://localhost:3003`

## Testing Steps

### 1. Test if service runs standalone
```cmd
cd C:\Projects\Tabz\packages\printer-service
pnpm start
```

If this works, the issue is with Electron integration.

### 2. Test if port is free
```cmd
netstat -ano | findstr :8765
```

Should return nothing if port is free.

### 3. Check config file
```cmd
type %APPDATA%\Tabeza\config.json
```

Should show your Bar ID and settings.

### 4. Test Electron app with logging
```cmd
cd C:\Projects\Tabz
pnpm --filter @tabeza/connect start:electron
```

Watch for error messages in the console.

## Common Error Messages

### "Configuration error: Failed to load image"
**Cause:** Icon file not found or wrong format
**Solution:** Verify `assets/icon.ico` exists

### "Service not configured - Bar ID missing"
**Cause:** Config file missing or invalid
**Solution:** Run setup again or manually create config

### "listen EADDRINUSE"
**Cause:** Port 8765 already in use
**Solution:** Run `kill-port-8765.bat`

## Getting Help

If none of these solutions work:

1. Collect logs:
   - Console output from Electron app
   - Config file: `%APPDATA%\Tabeza\config.json`
   - Port status: `netstat -ano | findstr :8765`

2. Check system requirements:
   - Windows 10/11
   - Node.js 18+
   - Administrator privileges (for auto-start)

3. Try clean reinstall:
   ```cmd
   # Remove config
   rmdir /s /q %APPDATA%\Tabeza
   
   # Reinstall dependencies
   cd C:\Projects\Tabz
   pnpm install
   
   # Start fresh
   pnpm --filter @tabeza/connect start:electron
   ```
