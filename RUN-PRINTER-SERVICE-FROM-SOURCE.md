# Run Printer Service from Source (For Development)

## The Problem

You're running the compiled `.exe` version of the printer service, which can't save configuration files. For local development, you need to run it from source code.

## Solution

### Step 1: Stop the Current Printer Service

If the exe is running, close it (Ctrl+C in its terminal or close the window).

### Step 2: Run from Source

Open a **new terminal** and run:

```bash
cd packages/printer-service
npm start
```

This will start the printer service from source code, which CAN save configuration.

### Step 3: Configure It

Now in your **PowerShell** terminal, run:

```powershell
Invoke-WebRequest -Uri "http://localhost:8765/api/configure" -Method POST -ContentType "application/json" -Body '{"barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31", "apiUrl": "http://localhost:3003"}'
```

This should work now!

### Step 4: Verify

Check the status:

```powershell
Invoke-WebRequest -Uri "http://localhost:8765/api/status" | Select-Object -ExpandProperty Content
```

You should see:
```json
{
  "barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
  "apiUrl": "http://localhost:3003",
  ...
}
```

### Step 5: Test Print

Now go to your staff dashboard and click "Test Print" - it should work!

## Why This Happens

- **Compiled exe**: Can't write files (config.json) because they weren't included at compile time
- **Source code**: Can write files normally

For **production** (on actual venue computers), the exe is fine because configuration is done once during setup. For **development**, always run from source.

## Keep It Running

Leave the printer service running in its terminal while you develop. It needs to be running for test prints to work.
