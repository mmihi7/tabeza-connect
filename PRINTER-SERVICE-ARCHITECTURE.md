# Tabeza Printer Service Architecture

## The Big Picture

The Tabeza Printer Service is a **Windows desktop application** that acts as a **bidirectional relay** between the venue's POS system and Tabeza Cloud.

```
┌─────────────────────────────────────────────────────────┐
│              Venue Computer (Windows)                   │
│                                                          │
│  ┌──────────────┐              ┌──────────────────────┐│
│  │  POS System  │──────────────▶│  Physical Printer   ││
│  │  (Notepad)   │  (intercepts) │  (Thermal/Receipt)  ││
│  └──────────────┘               └──────────────────────┘│
│         │                                 ▲             │
│         │                                 │             │
│         ▼                                 │             │
│  ┌──────────────────────────────────────────────────┐  │
│  │     Tabeza Printer Service (Port 8765)          │  │
│  │                                                  │  │
│  │  📤 UPLOAD: Captures prints FROM POS            │  │
│  │  📥 DOWNLOAD: Sends prints TO physical printer  │  │
│  │  🔄 POLLING: Checks cloud every 5 seconds       │  │
│  │  🚀 AUTO-START: Runs as Windows service         │  │
│  └──────────────────────────────────────────────────┘  │
│         │                                 ▲             │
└─────────┼─────────────────────────────────┼─────────────┘
          │                                 │
          │ HTTPS                           │ HTTPS
          │ (upload)                        │ (download)
          ▼                                 │
    ┌─────────────────────────────────────────────────┐
    │         Tabeza Cloud (staff.tabeza.co.ke)       │
    │                                                  │
    │  📊 Staff Dashboard                             │
    │  📱 Customer App                                │
    │  💾 Database (print_jobs table)                 │
    │  🔄 Real-time subscriptions                     │
    └─────────────────────────────────────────────────┘
```

## Why This Architecture?

### Problem: Venues Are Behind Firewalls
- Most venues have routers/firewalls
- Cloud can't directly connect to venue computer
- Need venue computer to **initiate** connection

### Solution: Polling Pattern
- Printer Service **polls** cloud every 5 seconds
- Asks: "Any print jobs for me?"
- If yes, downloads and prints
- If no, waits 5 seconds and asks again

## Two Workflows

### Workflow 1: Capture Prints (POS → Cloud)

```
1. Staff prints from POS (Notepad, etc.)
   ↓
2. Windows printer driver intercepts
   ↓
3. Saves to: C:\Users\[User]\TabezaPrints\
   ↓
4. Printer Service detects new file (chokidar watcher)
   ↓
5. Reads file, encodes to base64
   ↓
6. POSTs to: https://staff.tabeza.co.ke/api/printer/relay
   ↓
7. Cloud saves to print_jobs table
   ↓
8. Staff sees in CaptainsOrders component
```

### Workflow 2: Send Prints Back (Cloud → POS)

```
1. Staff clicks "Print Only" button
   ↓
2. API endpoint: /api/receipts/[id]/print
   ↓
3. Saves print job to pending_prints table
   ↓
4. Printer Service polls cloud (every 5 seconds)
   ↓
5. GET: /api/printer/pending-prints?barId=xxx
   ↓
6. Cloud returns pending print jobs
   ↓
7. Printer Service downloads raw_data
   ↓
8. Saves to: C:\Users\[User]\TabezaPrints\output\
   ↓
9. Physical printer monitors folder and prints
   ↓
10. Printer Service acknowledges: /api/printer/acknowledge-print
```

## Installation & Setup

### One-Time Installation (Venue Owner)

1. **Download Installer**
   - Visit: https://tabeza.co.ke/downloads
   - Download: `tabeza-printer-service-installer.exe`

2. **Run Installer**
   - Double-click installer
   - Follows Windows installer wizard
   - Installs to: `C:\Program Files\Tabeza\`

3. **Service Auto-Starts**
   - Installs as Windows service
   - Starts automatically
   - Runs in background (no window)

4. **Configure Bar ID**
   - Open staff dashboard: http://localhost:3003/settings
   - Copy Bar ID
   - Service auto-configures on first print

### No Manual Starting Required!

Once installed:
- ✅ Starts with Windows
- ✅ Runs in background
- ✅ No UI needed
- ✅ Just works

## How Staff Use It

### Staff Don't Interact With Service Directly

Staff only interact with the **web dashboard**:

1. **Open staff dashboard** (browser)
2. **See receipts** in CaptainsOrders
3. **Click "Print Only"** or "Assign to Tab"
4. **Done!**

The service handles everything in the background.

## Technical Details

### Printer Service Components

1. **File Watcher** (chokidar)
   - Monitors: `TabezaPrints/` folder
   - Detects new print files
   - Uploads to cloud

2. **Cloud Poller** (setInterval)
   - Polls every 5 seconds
   - Downloads pending prints
   - Saves to output folder

3. **HTTP Server** (Express)
   - Port: 8765
   - Endpoints:
     - `GET /api/status` - Health check
     - `POST /api/configure` - Set bar ID
     - `POST /api/print-to-physical` - Direct print (local only)
     - `POST /api/test-print` - Test printing

4. **Windows Service** (node-windows)
   - Auto-start on boot
   - Runs as system service
   - Logs to Windows Event Log

### Cloud API Endpoints (Need to Create)

1. **POST /api/printer/relay**
   - Receives prints from venue
   - Saves to `print_jobs` table
   - Status: 'received'

2. **GET /api/printer/pending-prints**
   - Query params: `barId`, `driverId`
   - Returns print jobs with status: 'pending_print'
   - Used by polling

3. **POST /api/printer/acknowledge-print**
   - Marks print job as 'printed'
   - Removes from pending queue

### Database Schema

```sql
-- print_jobs table
status: 
  - 'received' (from POS, waiting for staff action)
  - 'pending_print' (staff clicked Print Only, waiting for printer service)
  - 'processed' (printed or assigned)
  - 'error' (failed)

-- New field needed:
pending_print_at: TIMESTAMPTZ (when staff clicked Print Only)
```

## Security

### Authentication
- Printer Service uses `driverId` (unique per installation)
- Cloud validates `barId` + `driverId` combination
- No passwords needed (local network trust)

### Network
- All communication over HTTPS
- Printer Service initiates all connections (outbound only)
- No inbound ports needed (firewall-friendly)

### Data
- Print data encrypted in transit (HTTPS)
- Stored temporarily in cloud
- Deleted after 24 hours

## Monitoring & Debugging

### Check Service Status

**Windows Services**:
```
1. Press Win+R
2. Type: services.msc
3. Find: "Tabeza Printer Service"
4. Status should be: "Running"
```

**HTTP Endpoint**:
```bash
curl http://localhost:8765/api/status
```

Expected response:
```json
{
  "status": "running",
  "version": "1.0.0",
  "barId": "xxx-xxx-xxx",
  "driverId": "driver-COMPUTERNAME-123456",
  "configured": true
}
```

### Logs

**Windows Event Log**:
```
1. Press Win+R
2. Type: eventvwr.msc
3. Navigate to: Application
4. Filter by: Tabeza Printer Service
```

**File Logs** (if enabled):
```
C:\Program Files\Tabeza\logs\service.log
```

### Troubleshooting

**Prints not appearing in cloud**:
1. Check service is running
2. Check internet connection
3. Check Bar ID is configured
4. Check watch folder has files

**Print Only not working**:
1. Check service is running
2. Check polling is active (logs)
3. Check output folder exists
4. Check physical printer is monitoring folder

## Future Enhancements

### Phase 1: Current (Polling)
- ✅ Service polls cloud every 5 seconds
- ✅ Works behind firewalls
- ⚠️ 5-second delay

### Phase 2: WebSocket (Real-time)
- 🔄 Service maintains WebSocket connection
- 🔄 Cloud pushes prints instantly
- 🔄 No polling delay
- 🔄 More efficient

### Phase 3: Direct Printing
- 🔄 Service sends directly to Windows printer queue
- 🔄 No output folder needed
- 🔄 Faster printing

## Summary

The Tabeza Printer Service is a **background Windows service** that:

1. **Installs once** (like any Windows app)
2. **Runs automatically** (starts with computer)
3. **Works silently** (no UI needed)
4. **Captures prints** (POS → Cloud)
5. **Sends prints back** (Cloud → POS)
6. **Polls cloud** (every 5 seconds)
7. **Firewall-friendly** (outbound only)

Staff never interact with it directly - they just use the web dashboard, and the service handles everything in the background!
