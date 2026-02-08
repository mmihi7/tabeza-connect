# Print Only - Final Architecture

## The Complete Picture

### Staff Never Start Services!

The Tabeza Printer Service is a **Windows desktop application** that:
- ✅ Installs once (like Chrome or Spotify)
- ✅ Runs automatically as Windows service
- ✅ Starts with computer
- ✅ Runs in background (no UI)
- ✅ Staff never interact with it

### How It Actually Works

```
┌──────────────────────────────────────────────────────────┐
│           Venue Computer (Windows)                       │
│                                                           │
│  ┌──────────┐                    ┌──────────────────┐   │
│  │   POS    │───────────────────▶│ Physical Printer │   │
│  └──────────┘                    └──────────────────┘   │
│       │                                    ▲             │
│       │ (intercepts)                       │ (prints)    │
│       ▼                                    │             │
│  ┌────────────────────────────────────────────────────┐ │
│  │   Tabeza Printer Service (Background)             │ │
│  │   • Captures prints FROM POS                      │ │
│  │   • Polls cloud every 5 seconds                   │ │
│  │   • Downloads pending prints                      │ │
│  │   • Saves to output folder                        │ │
│  │   • Auto-starts with Windows                      │ │
│  └────────────────────────────────────────────────────┘ │
│       │                                    ▲             │
└───────┼────────────────────────────────────┼─────────────┘
        │                                    │
        │ HTTPS (upload)                     │ HTTPS (poll)
        ▼                                    │
   ┌────────────────────────────────────────────────────┐
   │         Tabeza Cloud (Internet)                    │
   │                                                     │
   │  📊 Staff Dashboard (Browser)                      │
   │     - Staff clicks "Print Only"                    │
   │     - Sets status to 'pending_print'               │
   │                                                     │
   │  🔄 API Endpoints                                  │
   │     - GET /api/printer/pending-prints              │
   │     - POST /api/printer/acknowledge-print          │
   │                                                     │
   │  💾 Database (print_jobs table)                    │
   │     - status: 'received' | 'pending_print' |       │
   │               'processed' | 'error'                │
   └────────────────────────────────────────────────────┘
```

## The Complete Flow

### Step-by-Step: Print Only Button

1. **Staff clicks "Print Only"** (in browser)
   ```
   Staff Dashboard → CaptainsOrders component → Modal → Print Only button
   ```

2. **API updates database**
   ```
   POST /api/receipts/[id]/print
   ↓
   UPDATE print_jobs 
   SET status = 'pending_print', 
       pending_print_at = NOW()
   WHERE id = [receiptId]
   ```

3. **Printer Service polls cloud** (every 5 seconds)
   ```
   Printer Service (running in background)
   ↓
   GET /api/printer/pending-prints?barId=xxx&driverId=yyy
   ↓
   Cloud returns: [{id, rawData, timestamp}]
   ```

4. **Printer Service downloads and saves**
   ```
   Decode base64 rawData
   ↓
   Save to: C:\Users\[User]\TabezaPrints\output\print-[timestamp].prn
   ```

5. **Physical printer prints**
   ```
   Printer monitors output folder
   ↓
   Detects new file
   ↓
   Prints receipt
   ```

6. **Printer Service acknowledges**
   ```
   POST /api/printer/acknowledge-print
   Body: {printId, driverId}
   ↓
   UPDATE print_jobs 
   SET status = 'processed', 
       processed_at = NOW()
   WHERE id = [printId]
   ```

7. **Receipt disappears from dashboard**
   ```
   Real-time subscription updates UI
   ↓
   Receipt removed from CaptainsOrders
   ```

## Why Polling Instead of Push?

### The Firewall Problem

Most venues have routers/firewalls that block incoming connections:

```
❌ DOESN'T WORK: Cloud → Venue
   Cloud tries to connect to venue computer
   Router blocks incoming connection
   
✅ WORKS: Venue → Cloud
   Venue computer initiates connection
   Router allows outbound connection
   Polling pattern works!
```

### Polling Details

- **Frequency**: Every 5 seconds
- **Endpoint**: `GET /api/printer/pending-prints`
- **Timeout**: 5 seconds max
- **Retry**: Automatic (next poll cycle)
- **Efficient**: Only returns data if prints pending

## Installation (One-Time Setup)

### For Venue Owner

1. **Download installer** from https://tabeza.co.ke/downloads
2. **Run installer** (double-click .exe)
3. **Service installs automatically**
4. **Done!** Service runs forever in background

### What Gets Installed

```
C:\Program Files\Tabeza\
├── tabeza-printer-service.exe
├── config.json
└── logs\
    └── service.log

C:\Users\[User]\TabezaPrints\
├── (incoming prints from POS)
├── output\
│   └── (outgoing prints to physical printer)
├── processed\
│   └── (archived prints)
└── errors\
    └── (failed prints)
```

### Windows Service

```
Service Name: TabezaPrinterService
Display Name: Tabeza Printer Service
Startup Type: Automatic
Status: Running
```

## Staff Experience

### What Staff See

1. **Open browser** → http://localhost:3003
2. **See receipts** in CaptainsOrders
3. **Click receipt** → Modal opens
4. **Two buttons**:
   - **Assign to Tab** (blue) - For Tabeza customers
   - **Print Only** (gray) - For non-Tabeza customers
5. **Click Print Only**
6. **Success message**: "Receipt queued for printing - will print within 5 seconds"
7. **Receipt disappears** from queue
8. **Physical receipt prints** (within 5 seconds)

### What Staff DON'T See

- ❌ No service to start
- ❌ No configuration needed
- ❌ No technical setup
- ❌ No command line
- ❌ No manual processes

It just works!

## Database Schema

### print_jobs Table

```sql
CREATE TABLE print_jobs (
  id UUID PRIMARY KEY,
  bar_id UUID NOT NULL,
  driver_id TEXT NOT NULL,
  raw_data TEXT NOT NULL,              -- Base64 ESC/POS data
  parsed_data JSONB,                   -- Parsed receipt
  status TEXT NOT NULL,                -- See below
  received_at TIMESTAMPTZ NOT NULL,
  pending_print_at TIMESTAMPTZ,        -- When Print Only clicked
  processed_at TIMESTAMPTZ,            -- When printed/assigned
  matched_tab_id UUID                  -- If assigned to tab
);

-- Status values:
-- 'received'       - From POS, waiting for staff action
-- 'pending_print'  - Staff clicked Print Only, waiting for printer service
-- 'processed'      - Printed or assigned to tab
-- 'error'          - Failed
```

## API Endpoints

### 1. Print Endpoint (Staff Dashboard)
```typescript
POST /api/receipts/[id]/print

// Sets status to 'pending_print'
// Printer service will poll for it
```

### 2. Pending Prints (Printer Service Polls)
```typescript
GET /api/printer/pending-prints?barId=xxx&driverId=yyy

// Returns print jobs with status 'pending_print'
// Called every 5 seconds by printer service
```

### 3. Acknowledge Print (Printer Service)
```typescript
POST /api/printer/acknowledge-print
Body: {printId, driverId}

// Marks print job as 'processed'
// Called after print saved to output folder
```

## Monitoring

### Check Service Status

**Option 1: Windows Services**
```
1. Press Win+R
2. Type: services.msc
3. Find: "Tabeza Printer Service"
4. Should show: Running
```

**Option 2: HTTP Endpoint**
```bash
curl http://localhost:8765/api/status
```

**Option 3: Staff Dashboard**
```
Settings → Printer Setup → Service Status
Should show: ✅ Connected
```

## Troubleshooting

### Print Not Happening

**Check 1: Service Running?**
```
services.msc → Tabeza Printer Service → Status: Running
```

**Check 2: Polling Working?**
```
Check logs: C:\Program Files\Tabeza\logs\service.log
Should see: "🔄 Polling cloud for print jobs..."
```

**Check 3: Print Job Status?**
```sql
SELECT id, status, pending_print_at 
FROM print_jobs 
WHERE status = 'pending_print';
```

**Check 4: Output Folder?**
```
Check: C:\Users\[User]\TabezaPrints\output\
Should have .prn files
```

### Receipt Stuck in Queue

**Symptom**: Receipt doesn't disappear after clicking Print Only

**Fix**:
```sql
-- Manually mark as processed
UPDATE print_jobs 
SET status = 'processed', 
    processed_at = NOW()
WHERE id = '[receipt-id]';
```

## Security

### Authentication
- Printer Service uses unique `driverId`
- Cloud validates `barId` + `driverId` pair
- No passwords needed (local trust model)

### Network
- All communication over HTTPS
- Printer Service initiates all connections (outbound only)
- No inbound ports needed (firewall-friendly)

### Data
- Print data encrypted in transit (HTTPS)
- Stored temporarily in cloud (24 hours)
- Deleted after processing

## Performance

### Latency
- **Polling interval**: 5 seconds
- **Average print time**: 5-10 seconds
- **Acceptable for non-Tabeza customers** (walk-ins expect to wait)

### Optimization
- Printer Service caches last poll time
- Only polls if service is configured
- Batches multiple prints (up to 10 at once)

## Future Enhancements

### Phase 1: Current (Polling) ✅
- Service polls every 5 seconds
- Works behind firewalls
- 5-10 second latency

### Phase 2: WebSocket (Real-time)
- Service maintains WebSocket connection
- Cloud pushes prints instantly
- <1 second latency
- More efficient

### Phase 3: Direct Printing
- Service sends directly to Windows printer queue
- No output folder needed
- Instant printing

## Summary

The Print Only feature is now **fully implemented** with a **production-ready architecture**:

✅ **Staff never start services** - Runs automatically
✅ **Firewall-friendly** - Polling pattern works everywhere
✅ **Simple UX** - Just click Print Only button
✅ **Reliable** - Automatic retries, error handling
✅ **Scalable** - Handles multiple venues, multiple printers
✅ **Secure** - HTTPS, authentication, data encryption

The system supports the **dual workflow** where ALL POS receipts flow through Tabeza, and staff can seamlessly handle both Tabeza customers (digital receipts) and non-Tabeza customers (physical receipts) from the same interface!
