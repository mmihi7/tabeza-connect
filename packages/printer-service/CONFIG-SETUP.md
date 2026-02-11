# Printer Service Configuration

## Important: config.json is Machine-Specific

The `config.json` file is **NOT** included in the repository because it contains machine-specific and venue-specific settings. Each installation creates its own config file.

## Configuration Methods

### Method 1: Auto-Configure (Recommended)

1. Start the printer service:
   ```bash
   cd packages/printer-service
   node index.js
   ```

2. Go to your staff app settings page
3. Click "Auto-Configure Printer Service"
4. The config will be created automatically

### Method 2: Manual Configuration via API

```bash
curl -X POST http://localhost:8765/api/configure \
  -H "Content-Type: application/json" \
  -d '{
    "barId": "YOUR_BAR_ID_HERE",
    "apiUrl": "https://tabz-kikao.vercel.app"
  }'
```

### Method 3: Manual File Creation

Copy `config.example.json` to `config.json` and edit:

```json
{
  "barId": "YOUR_BAR_ID_HERE",
  "apiUrl": "https://tabz-kikao.vercel.app",
  "driverId": "driver-GENERATED-AUTOMATICALLY",
  "watchFolder": "C:\\Users\\YourUsername\\TabezaPrints"
}
```

## Configuration Fields

| Field | Description | Example |
|-------|-------------|---------|
| `barId` | UUID of the venue from database | `438c80c1-fe11-4ac5-8a48-2fc45104ba31` |
| `apiUrl` | Production API endpoint | `https://tabz-kikao.vercel.app` |
| `driverId` | Auto-generated unique driver ID | `driver-MIHI-PC-1770655896151` |
| `watchFolder` | Folder to monitor for print jobs | `C:\Users\mwene\TabezaPrints` |

## Environment Variables (Optional)

You can override config values with environment variables:

```bash
# For production
set TABEZA_API_URL=https://tabz-kikao.vercel.app
set TABEZA_BAR_ID=438c80c1-fe11-4ac5-8a48-2fc45104ba31
node index.js

# For local development
set TABEZA_API_URL=http://localhost:3003
set TABEZA_BAR_ID=438c80c1-fe11-4ac5-8a48-2fc45104ba31
node index.js
```

## Why config.json is Gitignored

Each venue computer needs its own configuration:
- Different `barId` for each venue
- Different `watchFolder` paths per machine
- Different `driverId` per installation
- Different `apiUrl` for dev vs production

**Never commit config.json to the repository!**

## Verification

After configuration, verify it's working:

```bash
# Check service status
curl http://localhost:8765/api/status

# Should return:
{
  "status": "running",
  "configured": true,
  "barId": "438c80c1-fe11-4ac5-8a48-2fc45104ba31",
  "driverId": "driver-MIHI-PC-1770655896151",
  ...
}
```

## Troubleshooting

### Config not loading
- Check that `config.json` exists in `packages/printer-service/`
- Verify JSON syntax is valid
- Restart the printer service

### Wrong API URL
- For production: `https://tabz-kikao.vercel.app`
- For local dev: `http://localhost:3003`
- Use environment variable to override: `TABEZA_API_URL`

### Heartbeat failures
- Verify `barId` exists in database
- Check `apiUrl` is correct
- Ensure network connectivity
- See `HEARTBEAT-DOMAIN-FIX.md` for details
