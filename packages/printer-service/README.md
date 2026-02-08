# Tabeza Printer Service

Local Node.js service that runs on venue computers to intercept POS print jobs and relay them to Tabeza cloud.

## Overview

This service acts as a virtual printer driver, capturing receipt data from POS systems and sending it to the Tabeza cloud platform where it can be matched to customer tabs and delivered digitally.

## Features

- Runs as a Windows service (background process)
- Captures print jobs from POS systems
- Sends receipt data to Tabeza cloud API
- Automatic reconnection and retry logic
- Configuration via web interface or config file
- Health monitoring and status reporting

## Installation

### Prerequisites

- Node.js 18+ installed
- Windows operating system (for service installation)
- Administrator privileges

### Quick Install

1. Download the Tabeza Printer Service package from https://tabeza.co.ke/downloads
2. Extract to a permanent location (e.g., `C:\Program Files\Tabeza`)
3. Open Command Prompt as Administrator
4. Navigate to the service directory:
   ```bash
   cd "C:\Program Files\Tabeza\printer-service"
   ```
5. Install dependencies:
   ```bash
   npm install
   ```
6. Run the installer:
   ```bash
   npm run install-service
   ```
7. Follow the prompts to enter your Bar ID and API URL

### Manual Installation (Development/Testing)

If you prefer to run the service manually without installing as a Windows service:

```bash
npm install
npm start
```

The service will run in the foreground. Press Ctrl+C to stop.

## Configuration

### During Installation

The installer will prompt you for:
- **Bar ID**: Your Tabeza bar identifier (found in your Tabeza dashboard)
- **API URL**: The Tabeza cloud API endpoint (press Enter for default production URL)

### After Installation

Configuration is stored in `config.json` in the service directory. You can edit this file manually or use the configuration endpoint:

```bash
curl -X POST http://localhost:8765/api/configure ^
  -H "Content-Type: application/json" ^
  -d "{\"barId\": \"your-bar-id\", \"apiUrl\": \"https://your-api.com\"}"
```

### Environment Variables

You can also configure via environment variables:
- `TABEZA_BAR_ID` - Your bar identifier
- `TABEZA_API_URL` - Tabeza cloud API URL

## POS System Configuration

Configure your POS system to send print jobs to:

```
http://localhost:8765/api/print-job
```

### Configuration Steps by POS Type

#### Generic Network Printer Setup
1. Add a new network printer in your POS
2. Set printer type to "Network/HTTP Printer"
3. Set URL to `http://localhost:8765/api/print-job`
4. Set method to POST
5. Save and test

#### Webhook-Based POS Systems
1. Go to POS webhook settings
2. Add new webhook for "Receipt Printed" event
3. Set URL to `http://localhost:8765/api/print-job`
4. Set content type to `application/json` or `application/octet-stream`
5. Save and test

### Supported Data Formats

The service accepts:
- ESC/POS thermal printer commands (binary)
- Plain text receipts
- JSON formatted receipt data

## API Endpoints

### GET /api/status

Check if the service is running and get configuration info.

**Example:**
```bash
curl http://localhost:8765/api/status
```

**Response:**
```json
{
  "status": "running",
  "version": "1.0.0",
  "printerName": "Tabeza Receipt Printer",
  "timestamp": "2024-01-15T10:30:00Z",
  "barId": "bar-123",
  "driverId": "driver-hostname-1234567890"
}
```

### POST /api/test-print

Send a test print job to verify the service is working.

**Example:**
```bash
curl -X POST http://localhost:8765/api/test-print ^
  -H "Content-Type: application/json" ^
  -d "{\"barId\": \"bar-123\", \"testMessage\": \"Test print\"}"
```

**Response:**
```json
{
  "success": true,
  "jobId": "test-1234567890",
  "message": "Test print sent successfully"
}
```

### POST /api/configure

Update service configuration.

**Example:**
```bash
curl -X POST http://localhost:8765/api/configure ^
  -H "Content-Type: application/json" ^
  -d "{\"barId\": \"bar-123\", \"apiUrl\": \"https://your-api.com\"}"
```

**Response:**
```json
{
  "success": true,
  "config": {
    "barId": "bar-123",
    "apiUrl": "https://your-api.com",
    "driverId": "driver-hostname-1234567890"
  }
}
```

### POST /api/print-job

Receive print job from POS system (via print spooler hook)

**Request:** Raw print data (binary or text)

**Response:**
```json
{
  "success": true,
  "jobId": "job-1234567890"
}
```

## Testing

### Automated Test

Run the test script to verify everything is working:

```bash
npm test
```

This will:
1. Check if the service is running
2. Send a test print job
3. Verify the job was received by Tabeza cloud

### Manual Test

1. Open your browser to http://localhost:8765/api/status
2. You should see service status information
3. Check your Tabeza dashboard for the test receipt

## Service Management

### Start Service
```bash
net start "Tabeza Printer Service"
```

### Stop Service
```bash
net stop "Tabeza Printer Service"
```

### Restart Service
```bash
net stop "Tabeza Printer Service" && net start "Tabeza Printer Service"
```

### Check Service Status
```bash
sc query "Tabeza Printer Service"
```

## Troubleshooting

### Service won't start

**Symptoms:** Service fails to start or immediately stops

**Solutions:**
1. Check if port 8765 is already in use:
   ```bash
   netstat -ano | findstr :8765
   ```
2. Verify Node.js is installed:
   ```bash
   node --version
   ```
3. Check Windows Event Viewer:
   - Open Event Viewer
   - Go to Windows Logs > Application
   - Look for errors from "Tabeza Printer Service"
4. Try running manually to see errors:
   ```bash
   cd "C:\Program Files\Tabeza\printer-service"
   npm start
   ```

### Print jobs not being captured

**Symptoms:** POS prints but nothing appears in Tabeza

**Solutions:**
1. Verify POS is configured to send to `http://localhost:8765/api/print-job`
2. Check service is running:
   ```bash
   curl http://localhost:8765/api/status
   ```
3. Test with the test endpoint:
   ```bash
   npm test
   ```
4. Check firewall settings:
   - Open Windows Defender Firewall
   - Allow Node.js through firewall
   - Allow port 8765 inbound connections
5. Check service logs in installation directory

### Can't connect to Tabeza cloud

**Symptoms:** Service runs but receipts don't appear in dashboard

**Solutions:**
1. Check your internet connection
2. Verify the API URL in config.json:
   ```bash
   type config.json
   ```
3. Verify your Bar ID is correct (check Tabeza dashboard)
4. Test cloud connectivity:
   ```bash
   curl https://your-tabeza-url.vercel.app/api/printer/relay
   ```
5. Check for proxy/firewall blocking outbound HTTPS

### Port 8765 already in use

**Symptoms:** Error "EADDRINUSE" when starting

**Solutions:**
1. Find what's using the port:
   ```bash
   netstat -ano | findstr :8765
   ```
2. Kill the process (replace PID with actual process ID):
   ```bash
   taskkill /PID <PID> /F
   ```
3. Or change the port in index.js (line 11):
   ```javascript
   const PORT = 8766; // Change to different port
   ```

## Logs and Debugging

### Service Logs

When running as a service, logs are written to:
```
C:\ProgramData\Tabeza\printer-service\logs\
```

### Manual Logging

When running manually, logs appear in the console. To save to file:
```bash
npm start > service.log 2>&1
```

### Enable Debug Mode

Set environment variable for verbose logging:
```bash
set DEBUG=tabeza:*
npm start
```

## Uninstalling

### Remove Windows Service

```bash
npm run uninstall-service
```

### Delete Files

After uninstalling the service, delete the installation directory:
```bash
rmdir /s "C:\Program Files\Tabeza\printer-service"
```

## Security Notes

- The service runs on localhost only (not accessible from network)
- No sensitive data is stored locally
- All communication with Tabeza cloud uses HTTPS
- Bar ID is the only authentication credential needed

## Performance

- Handles up to 100 print jobs per minute
- Average processing time: <100ms per receipt
- Memory usage: ~50MB
- CPU usage: <1% idle, <5% under load

## Support

- **Documentation:** https://docs.tabeza.co.ke
- **Email:** support@tabeza.co.ke
- **Website:** https://tabeza.co.ke

## License

MIT License - See LICENSE file for details

## Version History

### 1.0.0 (Current)
- Initial release
- Windows service support
- Basic receipt parsing
- Cloud relay functionality
- Configuration management
- Health monitoring
