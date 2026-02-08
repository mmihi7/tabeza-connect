# Tabeza Printer Service - Deployment Guide

Complete guide for deploying the Tabeza Printer Service to customer venues.

## Pre-Deployment Checklist

### Cloud Infrastructure

- [ ] Database migrations applied (see `database/APPLY-MIGRATIONS-GUIDE.md`)
- [ ] API endpoints deployed and accessible:
  - [ ] `/api/printer/relay` - Receives print jobs from service
  - [ ] `/api/printer/driver-status` - Checks service health
- [ ] Environment variables configured:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - [ ] `SUPABASE_SECRET_KEY`

### Service Package

- [ ] Package created: `npm run create-package` in `packages/printer-service`
- [ ] Package tested on clean Windows machine
- [ ] Package uploaded to https://tabeza.co.ke/downloads
- [ ] Download link added to documentation

## Deployment Steps

### 1. Prepare Customer Environment

**Requirements:**
- Windows 10 or later
- Node.js 18+ installed
- Administrator access
- Internet connection
- POS system with network printing capability

**Pre-Installation:**
1. Verify Node.js installation:
   ```cmd
   node --version
   ```
   Should show v18.0.0 or higher

2. Check port 8765 is available:
   ```cmd
   netstat -ano | findstr :8765
   ```
   Should return nothing (port is free)

3. Get customer's Bar ID from Tabeza dashboard

### 2. Install Service

**Download and Extract:**
1. Download `tabeza-printer-service-v1.0.0.zip` from https://tabeza.co.ke/downloads
2. Extract to `C:\Program Files\Tabeza\printer-service`
3. Open Command Prompt as Administrator

**Install Dependencies:**
```cmd
cd "C:\Program Files\Tabeza\printer-service"
npm install
```

**Install as Windows Service:**
```cmd
npm run install-service
```

When prompted:
- **Bar ID**: Enter the customer's bar ID (e.g., `bar-abc123`)
- **API URL**: Press Enter for default, or enter custom URL

**Verify Installation:**
```cmd
sc query "Tabeza Printer Service"
```

Should show `STATE: RUNNING`

### 3. Test Service

**Check Service Status:**
```cmd
curl http://localhost:8765/api/status
```

Expected response:
```json
{
  "status": "running",
  "version": "1.0.0",
  "printerName": "Tabeza Receipt Printer",
  "barId": "bar-abc123",
  "driverId": "driver-..."
}
```

**Send Test Print:**
```cmd
npm test
```

Or manually:
```cmd
curl -X POST http://localhost:8765/api/test-print ^
  -H "Content-Type: application/json" ^
  -d "{\"barId\":\"bar-abc123\",\"testMessage\":\"Test Receipt\"}"
```

**Verify in Dashboard:**
1. Log into Tabeza staff dashboard
2. Go to Print Jobs section
3. Verify test receipt appears

### 4. Configure POS System

The configuration varies by POS system. Here are common scenarios:

#### Scenario A: Network Printer Support

If POS supports network/HTTP printers:

1. Open POS printer settings
2. Add new printer:
   - **Name**: Tabeza Receipt Printer
   - **Type**: Network/HTTP Printer
   - **URL**: `http://localhost:8765/api/print-job`
   - **Method**: POST
   - **Format**: Raw/Binary
3. Save and test print

#### Scenario B: Webhook Support

If POS supports webhooks:

1. Open POS webhook settings
2. Add new webhook:
   - **Event**: Receipt Printed / Order Completed
   - **URL**: `http://localhost:8765/api/print-job`
   - **Method**: POST
   - **Content-Type**: application/octet-stream
3. Save and test

#### Scenario C: Print Spooler Redirect

If POS only supports standard Windows printers:

1. Install a virtual printer driver (e.g., Microsoft Print to PDF)
2. Configure it to save to a watched folder
3. Create a script to monitor the folder and POST files to service
4. Set up as scheduled task

**Example PowerShell script:**
```powershell
# watch-print-folder.ps1
$folder = "C:\PrintJobs"
$url = "http://localhost:8765/api/print-job"

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $folder
$watcher.Filter = "*.prn"
$watcher.EnableRaisingEvents = $true

$action = {
    $path = $Event.SourceEventArgs.FullPath
    $content = [System.IO.File]::ReadAllBytes($path)
    Invoke-RestMethod -Uri $url -Method Post -Body $content -ContentType "application/octet-stream"
    Remove-Item $path
}

Register-ObjectEvent $watcher "Created" -Action $action
while ($true) { Start-Sleep -Seconds 1 }
```

### 5. Test End-to-End

**Complete Flow Test:**

1. Create a test customer tab in Tabeza
2. Print a receipt from POS
3. Verify receipt appears in service logs:
   ```cmd
   type "C:\Program Files\Tabeza\printer-service\service.log"
   ```
4. Check Tabeza dashboard for print job
5. Verify digital receipt delivered to customer tab

**Expected Flow:**
```
POS → Print → Service (localhost:8765) → Cloud API → Customer Tab
```

### 6. Configure Firewall

**Windows Defender Firewall:**

1. Open Windows Defender Firewall
2. Click "Allow an app through firewall"
3. Click "Change settings" (requires admin)
4. Find "Node.js" in the list
5. Check both "Private" and "Public"
6. Click OK

**Or via Command Line:**
```cmd
netsh advfirewall firewall add rule name="Tabeza Printer Service" dir=in action=allow protocol=TCP localport=8765
```

### 7. Monitor and Verify

**Check Service Health:**
```cmd
sc query "Tabeza Printer Service"
```

**View Logs:**
```cmd
type "C:\ProgramData\Tabeza\printer-service\logs\service.log"
```

**Monitor Print Jobs:**
```sql
-- In Supabase SQL Editor
SELECT * FROM print_jobs 
WHERE bar_id = 'bar-abc123' 
ORDER BY received_at DESC 
LIMIT 10;
```

## Post-Deployment

### Customer Training

Train venue staff on:

1. **What the service does**: Captures POS receipts and sends to customers
2. **How to check if it's running**: Visit http://localhost:8765/api/status
3. **What to do if it stops**: Restart service or call support
4. **How to view print jobs**: Check Tabeza dashboard

### Documentation for Customer

Provide customer with:

1. Service status URL: http://localhost:8765/api/status
2. Support contact: support@tabeza.co.ke
3. Troubleshooting guide (see README.md)
4. Service restart instructions

### Monitoring Setup

Set up monitoring for:

1. **Service Health**: Poll `/api/status` every 5 minutes
2. **Print Job Success Rate**: Monitor `print_jobs` table
3. **Error Rates**: Track failed jobs in `print_jobs` where `status = 'error'`
4. **Last Activity**: Alert if no jobs received in 24 hours

**Example Monitoring Query:**
```sql
-- Check service health by bar
SELECT 
  bar_id,
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE status = 'processed') as successful,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  MAX(received_at) as last_job_at
FROM print_jobs
WHERE bar_id = 'bar-abc123'
  AND received_at > NOW() - INTERVAL '24 hours'
GROUP BY bar_id;
```

## Troubleshooting Deployment Issues

### Service Won't Install

**Error:** "Access denied" or "Permission error"

**Solution:**
- Run Command Prompt as Administrator
- Disable antivirus temporarily
- Check Windows Event Viewer for details

### Service Starts Then Stops

**Error:** Service shows "STOPPED" immediately after starting

**Solution:**
1. Check port 8765 is available
2. Verify Node.js is in system PATH
3. Check service logs for errors
4. Try running manually: `npm start`

### POS Can't Connect

**Error:** POS shows "Connection refused" or "Timeout"

**Solution:**
1. Verify service is running: `curl http://localhost:8765/api/status`
2. Check firewall settings
3. Verify POS is configured with correct URL
4. Test with curl from POS computer

### Receipts Not Appearing in Dashboard

**Error:** Service receives jobs but nothing in Tabeza

**Solution:**
1. Check internet connection
2. Verify Bar ID is correct
3. Check API URL in config.json
4. Test cloud connectivity: `curl https://your-api.com/api/printer/relay`
5. Check Supabase logs for errors

## Rollback Procedure

If deployment fails and you need to rollback:

1. **Uninstall Service:**
   ```cmd
   npm run uninstall-service
   ```

2. **Remove Files:**
   ```cmd
   rmdir /s "C:\Program Files\Tabeza\printer-service"
   ```

3. **Reconfigure POS:**
   - Remove Tabeza printer from POS
   - Restore original printer configuration

4. **Clean Database:**
   ```sql
   -- Remove test data
   DELETE FROM print_jobs WHERE bar_id = 'bar-abc123';
   DELETE FROM digital_receipts WHERE bar_id = 'bar-abc123';
   ```

## Support Escalation

If issues persist:

1. Collect diagnostic information:
   - Service logs
   - Windows Event Viewer logs
   - POS configuration screenshots
   - Network configuration

2. Contact support:
   - Email: support@tabeza.co.ke
   - Include: Bar ID, error messages, logs
   - Describe: What was attempted, what failed

3. Remote support:
   - Prepare TeamViewer or similar
   - Have admin credentials ready
   - Schedule support session

## Success Criteria

Deployment is successful when:

- [ ] Service is running as Windows service
- [ ] Service responds to status checks
- [ ] Test print job reaches Tabeza cloud
- [ ] POS can send print jobs to service
- [ ] Digital receipts appear in customer tabs
- [ ] Staff can view print jobs in dashboard
- [ ] Service survives computer restart
- [ ] Monitoring is configured and working

## Maintenance

### Regular Checks

**Weekly:**
- Check service is running
- Review error logs
- Verify print job success rate

**Monthly:**
- Update service if new version available
- Review performance metrics
- Check disk space for logs

### Updates

To update the service:

1. Download new version
2. Stop service: `net stop "Tabeza Printer Service"`
3. Backup config.json
4. Replace files
5. Restore config.json
6. Start service: `net start "Tabeza Printer Service"`
7. Test with test print

## Appendix

### A. Service Configuration File

Location: `C:\Program Files\Tabeza\printer-service\config.json`

```json
{
  "barId": "bar-abc123",
  "apiUrl": "https://your-app.vercel.app",
  "driverId": "driver-hostname-1234567890"
}
```

### B. Windows Service Details

- **Service Name**: Tabeza Printer Service
- **Display Name**: Tabeza Printer Service
- **Description**: Captures POS print jobs and sends to Tabeza cloud
- **Startup Type**: Automatic
- **Log On As**: Local System

### C. Network Requirements

- **Outbound HTTPS**: Required for cloud API
- **Inbound Port 8765**: Required for POS connection
- **DNS**: Must resolve your API domain
- **Firewall**: Allow Node.js through Windows Firewall

### D. Performance Benchmarks

- **Startup Time**: <5 seconds
- **Memory Usage**: ~50MB
- **CPU Usage**: <1% idle, <5% active
- **Network**: <1KB per receipt
- **Processing Time**: <100ms per receipt
