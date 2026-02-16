# TabezaService is Installed as a Windows Service

## Problem Discovered
TabezaService.exe is running as a **Windows Service**, not a regular process. This is why:
- It survives computer restarts
- It automatically starts on boot
- It can't be killed without admin privileges
- Port 8765 is always occupied

## Evidence
```
Session Name: Services
Status: Unknown
User Name: N/A
```

This means TabezaService.exe was installed as a Windows service (probably named "TabezaConnect").

## Solution: Stop the Windows Service

### Step 1: Stop the Service (Requires Admin)

Right-click Command Prompt and select "Run as administrator", then:

```cmd
sc stop TabezaConnect
```

Or use the script:
```cmd
Right-click: c:\Projects\Tabz\dev-tools\scripts\stop-tabeza-service.bat
Select: "Run as administrator"
```

### Step 2: Verify Service is Stopped

```cmd
sc query TabezaConnect
```

Should show: `STATE: STOPPED`

### Step 3: Verify Port is Free

```cmd
netstat -ano | findstr :8765
```

Should return nothing (port is free).

### Step 4: Run TabezaService.exe Manually

```cmd
cd c:\Projects\TabezaConnect
.\TabezaService.exe
```

## Alternative: Disable Auto-Start

If you want to prevent the service from starting automatically on boot:

```cmd
sc config TabezaConnect start= disabled
```

Then stop it:
```cmd
sc stop TabezaConnect
```

## Alternative: Uninstall the Service Completely

If you want to remove the Windows service entirely:

```cmd
sc stop TabezaConnect
sc delete TabezaConnect
```

Then you can run TabezaService.exe manually whenever needed.

## Why This Happened

TabezaService.exe was likely installed as a Windows service using:
- `node-windows` package
- `sc create` command
- NSSM (Non-Sucking Service Manager)
- Or another service installer

This is actually a GOOD thing for production (service runs automatically), but for development it's easier to run manually.

## Recommended Approach for Development

1. Stop the Windows service: `sc stop TabezaConnect`
2. Disable auto-start: `sc config TabezaConnect start= disabled`
3. Run manually when needed: `cd c:\Projects\TabezaConnect && .\TabezaService.exe`

## Recommended Approach for Production

Keep the Windows service installed and running automatically. Just make sure:
- Config.json has the correct barId
- Service has network access to https://staff.tabeza.co.ke
- Heartbeat is working (check logs)

## Next Steps

1. Run `stop-tabeza-service.bat` as administrator
2. Verify port 8765 is free
3. Run TabezaService.exe manually
4. Wait 30 seconds for heartbeat
5. Run diagnostic: `node dev-tools\scripts\diagnose-printer-visibility.js`
6. Should see driver in database
