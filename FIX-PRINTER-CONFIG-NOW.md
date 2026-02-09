# Fix Printer Configuration - 404 Error

## The Problem

The test print is working, but the printer service is configured to send to:
```
http://192.168.1.98:3003
```

This is your network IP, but Vercel deployment doesn't exist there. It should be:
```
http://localhost:3003
```

## Quick Fix

Run this PowerShell command:

```powershell
Invoke-WebRequest -Uri "http://localhost:8765/api/configure" -Method POST -ContentType "application/json" -Body '{"barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31", "apiUrl": "http://localhost:3003"}'
```

## Then Test Again

Click "Test Print" button again - it should work now!

## What Happened

The printer service was configured with your network IP (`192.168.1.98`) instead of `localhost`. When it tries to send the test print to that IP on port 3003, Vercel returns a 404 because there's no deployment there.

Using `localhost:3003` will correctly reach your local dev server.
