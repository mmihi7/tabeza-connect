# Tabeza Printer Driver System - Complete Implementation Guide

## Overview

The Tabeza printer driver system enables POS systems to send receipts directly to customer tabs through a virtual printer. This document explains the complete architecture and how all pieces work together.

## System Architecture

```
┌─────────────────┐
│   POS System    │
│  (Any Brand)    │
└────────┬────────┘
         │ Prints to "Tabeza Receipt Printer"
         ▼
┌─────────────────────────────────────┐
│  Tabeza Virtual Printer Driver      │
│  (Installed on Windows/Mac)         │
│  - Intercepts print jobs            │
│  - Parses ESC/POS data              │
│  - Runs on localhost:8765           │
└────────┬────────────────────────────┘
         │ HTTP POST
         ▼
┌─────────────────────────────────────┐
│  Tabeza Cloud API                   │
│  /api/printer/relay                 │
│  - Receives receipt data            │
│  - Matches to customer tabs         │
│  - Delivers digital receipts        │
└────────┬────────────────────────────┘
         │ Real-time updates
         ▼
┌─────────────────────────────────────┐
│  Customer Tabeza App                │
│  - Receives digital receipt         │
│  - Shows order details              │
│  - Enables payment                  │
└─────────────────────────────────────┘
```

## Components

### 1. Virtual Printer Driver (Native Application)

**Location**: Needs to be built separately (C++/Swift)
**Runs on**: Customer's computer (Windows/Mac)
**Port**: localhost:8765

**Responsibilities**:
- Installs as system printer "Tabeza Receipt Printer"
- Intercepts print jobs from POS systems
- Parses ESC/POS thermal printer commands
- Extracts receipt data (items, prices, totals)
- Sends to Tabeza cloud via HTTP

**API Endpoints** (Driver Service):
```
GET  /api/status          - Health check
POST /api/test-print      - Test printer connectivity
POST /api/configure       - Update driver settings
```

### 2. Virtual Printer Package (TypeScript)

**Location**: `packages/virtual-printer/`
**Purpose**: Receipt parsing and processing logic

**Key Features**:
- ESC/POS protocol parsing
- Receipt format detection
- Item extraction
- Customer matching
- Tab management

**Usage**:
```typescript
import { createVirtualPrinter } from '@tabeza/virtual-printer';

const printer = createVirtualPrinter(
  'merchant-id',
  'bar-id',
  supabaseUrl,
  supabaseKey
);

await printer.start();
```

### 3. Cloud Relay API

**Location**: `apps/staff/app/api/printer/relay/route.ts`
**Purpose**: Receive and process receipts from drivers

**Endpoints**:
```
POST /api/printer/relay          - Receive print jobs
GET  /api/printer/relay/status   - Service status
```

**Process Flow**:
1. Receive base64-encoded ESC/POS data
2. Parse receipt (items, totals, customer info)
3. Store in `print_jobs` table
4. Match to open customer tab
5. Create digital receipt
6. Notify customer

### 4. Driver Status API

**Location**: `apps/staff/app/api/printer/driver-status/route.ts`
**Purpose**: Check if drivers are installed

**Endpoints**:
```
GET  /api/printer/driver-status       - Check installation
POST /api/printer/driver-status/test  - Test connectivity
```

### 5. Printer Setup UI

**Location**: `apps/staff/app/setup/printer/page.tsx`
**Purpose**: Guide users through driver installation

**Features**:
- Auto-detect installed drivers
- Show installation instructions
- Test printer connectivity
- Verify setup completion

## Database Schema

### New Tables Required

```sql
-- Print jobs from POS systems
CREATE TABLE print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES bars(id),
  driver_id TEXT NOT NULL,
  raw_data TEXT NOT NULL,              -- Base64 ESC/POS data
  parsed_data JSONB,                   -- Parsed receipt
  printer_name TEXT,
  document_name TEXT,
  metadata JSONB,
  status TEXT NOT NULL,                -- received, processed, error, no_match
  received_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  matched_tab_id UUID REFERENCES tabs(id),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Digital receipts delivered to customers
CREATE TABLE digital_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id UUID NOT NULL REFERENCES tabs(id),
  bar_id UUID NOT NULL REFERENCES bars(id),
  print_job_id UUID REFERENCES print_jobs(id),
  receipt_data JSONB NOT NULL,
  receipt_number TEXT,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL,                -- delivered, viewed, paid
  delivered_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_print_jobs_bar_id ON print_jobs(bar_id);
CREATE INDEX idx_print_jobs_status ON print_jobs(status);
CREATE INDEX idx_digital_receipts_tab_id ON digital_receipts(tab_id);
```

## Installation Process

### For Venue Owners

1. **Download Driver**
   - Windows: `tabeza-printer-driver-windows.exe`
   - macOS: `tabeza-printer-driver-macos.pkg`

2. **Install Driver**
   - Run installer as Administrator/with sudo
   - Follow installation wizard
   - Restart computer

3. **Verify Installation**
   - Check system printers for "Tabeza Receipt Printer"
   - Open Tabeza staff app
   - Navigate to printer setup
   - System auto-detects installed drivers

4. **Configure POS**
   - Set POS to print receipts to "Tabeza Receipt Printer"
   - Test with sample receipt
   - Verify receipt appears in Tabeza

### For Developers

1. **Build Native Driver** (separate project)
   ```bash
   # Windows (Visual Studio + WDK)
   cd tabeza-printer-driver-windows
   msbuild TabezaPrinterDriver.sln
   
   # macOS (Xcode)
   cd tabeza-printer-driver-macos
   xcodebuild -project TabezaPrinter.xcodeproj
   ```

2. **Run Driver Service**
   ```bash
   # The driver service runs automatically after installation
   # Or manually for development:
   tabeza-printer-service --port 8765 --bar-id YOUR_BAR_ID
   ```

3. **Test Integration**
   ```bash
   # Send test print job
   curl -X POST http://localhost:8765/api/test-print \
     -H "Content-Type: application/json" \
     -d '{"barId":"test-bar","testMessage":"Test Receipt"}'
   ```

## Current Implementation Status

### ✅ Completed
- Virtual printer package with ESC/POS parsing
- Cloud relay API for receiving print jobs
- Driver status detection API
- Printer setup UI with auto-detection
- Receipt parsing and tab matching logic
- Digital receipt storage and delivery

### 🚧 In Progress
- Native driver development (Windows/Mac)
- Driver installer packages
- Code signing certificates
- Driver service daemon

### 📋 TODO
- Build Windows printer driver (C++ with WDK)
- Build macOS printer driver (Swift with CUPS)
- Create installer packages (.exe, .pkg)
- Set up code signing
- Create driver update mechanism
- Add driver configuration UI
- Implement driver logging and diagnostics

## Testing

### Test Receipt Format

```
RESTAURANT NAME
123 Main Street
Tel: 555-0123

Table: 5
Server: John

2x Burger Deluxe        18.00
1x Fries                 4.50
2x Soft Drink            6.00

Subtotal:               28.50
Tax (8%):                2.28
Total:                  30.78

Thank you!
```

### Test Commands

```bash
# Check driver status
curl http://localhost:8765/api/status

# Send test print
curl -X POST http://localhost:8765/api/test-print \
  -H "Content-Type: application/json" \
  -d '{"barId":"bar-123","testMessage":"Test"}'

# Check cloud API
curl https://your-app.vercel.app/api/printer/relay/status
```

## Troubleshooting

### Driver Not Detected
1. Check if driver service is running: `ps aux | grep tabeza`
2. Verify port 8765 is not blocked
3. Check system printers for "Tabeza Receipt Printer"
4. Restart driver service

### Receipts Not Parsing
1. Check print job logs in database
2. Verify ESC/POS format is supported
3. Test with sample receipt
4. Adjust parsing rules if needed

### No Customer Match
1. Ensure table numbers are in receipt
2. Check tab status (must be "open")
3. Verify bar_id matches
4. Check customer matching logic

## Security Considerations

1. **Driver Authentication**
   - Each driver has unique ID
   - API key required for cloud communication
   - TLS encryption for all traffic

2. **Receipt Data**
   - Encrypted in transit
   - Stored with access controls
   - PII handling compliance

3. **Driver Updates**
   - Signed updates only
   - Automatic update checks
   - Rollback capability

## Next Steps

1. **Build Native Drivers**
   - Set up Windows development environment (Visual Studio + WDK)
   - Set up macOS development environment (Xcode)
   - Implement print spooler integration
   - Create installer packages

2. **Deploy Driver Service**
   - Package as Windows service / macOS daemon
   - Create auto-start configuration
   - Implement logging and monitoring

3. **Create Distribution**
   - Host installers on tabeza.co.ke
   - Set up download tracking
   - Create installation documentation

4. **Test with Real POS**
   - Test with Square, Toast, Clover
   - Verify receipt parsing accuracy
   - Measure performance and reliability

## Support

For driver development questions:
- Technical docs: `packages/virtual-printer/docs/`
- ESC/POS spec: `packages/escpos-parser/`
- Example integration: `packages/virtual-printer/examples/`

For installation support:
- User guide: Coming soon at tabeza.co.ke/support
- Video tutorials: Coming soon
- Email: support@tabeza.co.ke
