# Configure Printer Service - Quick Fix

## The Issue
The printer service is trying to send to production (`https://staff.tabeza.co.ke`) but you need it to send to your local dev server (`http://localhost:3003`).

## Quick Solution (Copy & Paste)

Run this PowerShell command (replace the Bar ID with yours):

```powershell
Invoke-WebRequest -Uri "http://localhost:8765/api/configure" -Method POST -ContentType "application/json" -Body '{"barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31", "apiUrl": "http://localhost:3003"}'
```

**Your Bar ID**: `438c80c1-fe11-4ac5-8a48-2fc45104ba31`

## What This Does

This tells the printer service:
- Send print data to `http://localhost:3003` (your local dev server)
- Use your Bar ID: `438c80c1-fe11-4ac5-8a48-2fc45104ba31`

## After Running This

1. You should see a success response
2. Try the "Test Print" button again
3. It should work now!

## If You Get an Error

The printer service might need to be restarted. Check the terminal where it's running and look for any error messages.

## Verify Configuration

To check if it worked, visit:
```
http://localhost:8765/api/status
```

You should see:
```json
{
  "status": "running",
  "barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
  "apiUrl": "http://localhost:3003",
  ...
}
```
