# Tabeza Printer System - Complete Architecture Documentation

## System Overview

The Tabeza printer system enables POS receipt integration through a Windows-based printer service that monitors a folder for print jobs, relays them to the cloud, and uses AI to parse receipt data.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         POS SYSTEM                              │
│  (Prints receipts via Windows Print Dialog or Print-to-File)   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WINDOWS PRINT SYSTEM                         │
│  • Generic Text Printer Driver                                  │
│  • Port: FILE                                                   │
│  • Output: C:\Users\mwene\TabezaPrints                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PRINTER SERVICE (Local)                       │
│  • Node.js service on port 8765                                 │
│  • Watches: C:\Users\mwene\TabezaPrints                        │
│  • Detects new files within 2 seconds                          │
│  • Sends heartbeats every 30 seconds                           │
│  • Relays receipts to cloud                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUD API (Vercel)                           │
│  • Endpoint: /api/printer/relay                                 │
│  • Stores raw receipt in database                              │
│  • Triggers AI parsing (async)                                 │
│  • Endpoint: /api/printer/heartbeat                            │
│  • Tracks printer driver status                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DEEPSEEK AI PARSER                            │
│  • Parses receipt text to structured JSON                      │
│  • Extracts: items, prices, total, receipt number             │
│  • Uses configurable system prompt                             │
│  • 10-second timeout                                           │
│  • Falls back to regex if AI fails                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                            │
│  • printer_drivers: Heartbeat tracking                         │
│  • printer_relay_receipts: Raw receipt storage                 │
│  • unmatched_receipts: Parsed receipts awaiting assignment     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAFF APP (Web)                              │
│  • Captain's Orders: View unmatched receipts                   │
│  • Assign receipts to customer tabs                            │
│  • Printer status indicator                                    │
│  • Prompt manager for AI configuration                         │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. POS System Integration

**Purpose:** Generate receipts that the printer service can capture

**Options:**
- **Print to File** (Recommended): POS configured with Generic Text printer, port FILE
- **Microsoft Print to PDF**: Manual save to watch folder
- **Network Printer**: Printer with "Print to Folder" feature
- **Virtual Printer**: Software like PDFCreator with auto-save

**Output Location:** `C:\Users\mwene\TabezaPrints`

**Related Files:**
- `CONNECT-ACTUAL-POS-GUIDE.md` - POS configuration guide

---

### 2. Printer Service (Local Windows Service)

**Purpose:** Monitor folder, detect receipts, relay to cloud

**Technology:** Node.js Express server

**Port:** 8765

**Key Features:**
- File watcher (chokidar) with 2-second stabilization
- Heartbeat every 30 seconds
- Automatic retry with exponential backoff
- File archiving (processed/errors folders)
- Configuration via environment variables or config.json

**Configuration:**
- Bar ID: `438c80c1-fe11-4ac5-8a48-2fc45104ba31`
- API URL: `https://tabz-kikao.vercel.app`
- Watch Folder: `C:\Users\mwene\TabezaPrints`

**Related Files:**
- `packages/printer-service/index.js` - Main service code
- `START-PRINTER-SERVICE-WORKING.bat` - Launch script
- `packages/printer-service/public/configure.html` - Web configuration UI
- `packages/printer-service/public/prompt-manager.html` - Prompt management UI

---

### 3. Cloud API Endpoints

**Purpose:** Receive receipts, trigger parsing, track printer status

**Platform:** Vercel (Next.js API routes)

**Endpoints:**

#### `/api/printer/relay` (POST)
- Receives raw receipt data from printer service
- Stores in `printer_relay_receipts` table
- Triggers async AI parsing
- Returns success/failure

**Related Files:**
- `apps/staff/app/api/printer/relay/route.ts`

#### `/api/printer/heartbeat` (POST)
- Receives heartbeat from printer service
- Updates `printer_drivers` table
- Tracks online/offline status
- Returns acknowledgment

**Related Files:**
- `apps/staff/app/api/printer/heartbeat/route.ts`

#### `/api/printer/driver-status` (GET)
- Returns printer driver status for a bar
- Used by staff app to show connection status

**Related Files:**
- `apps/staff/app/api/printer/driver-status/route.ts`

#### `/api/printer/assign-receipt` (GET/POST)
- GET: Fetch unmatched receipts and open tabs
- POST: Assign receipt to a tab
- Creates tab_orders from receipt data

**Related Files:**
- `apps/staff/app/api/printer/assign-receipt/route.ts` (not shown but exists)

#### `/api/test-receipt-parser` (POST)
- Test endpoint for prompt manager
- Calls DeepSeek API with custom prompt
- Returns parsed results
- No authentication (system tool)

**Related Files:**
- `apps/staff/app/api/test-receipt-parser/route.ts`

---

### 4. Receipt Parser (AI + Regex)

**Purpose:** Convert raw receipt text to structured JSON

**Strategy:** AI-first with regex fallback

**AI Provider:** DeepSeek (via OpenAI SDK)
- Model: `deepseek-chat`
- Response format: JSON object
- Temperature: 0.1 (configurable)
- Max tokens: 2000 (configurable)
- Timeout: 10 seconds

**Fallback:** Regex patterns for common formats

**Output Format:**
```json
{
  "items": [
    {"name": "2x Tusker Lager 500ml", "price": 500.00}
  ],
  "total": 1300.00,
  "receiptNumber": "RCP-123456"
}
```

**Related Files:**
- `packages/shared/services/receiptParser.ts` - Parser implementation
- `apps/staff/.env.local` - DeepSeek API key configuration

---

### 5. Database Schema

**Purpose:** Store receipts, track printer status, manage assignments

#### `printer_drivers`
```sql
- id: UUID
- bar_id: UUID (FK to bars)
- driver_id: TEXT (unique identifier)
- status: TEXT (online/offline)
- last_heartbeat_at: TIMESTAMP
- version: TEXT
- metadata: JSONB
```

#### `printer_relay_receipts`
```sql
- id: UUID
- bar_id: UUID (FK to bars)
- driver_id: TEXT
- raw_data: TEXT (base64 encoded)
- document_name: TEXT
- parsed_data: JSONB
- status: TEXT (pending/processed/failed)
- created_at: TIMESTAMP
```

#### `unmatched_receipts`
```sql
- id: UUID
- bar_id: UUID (FK to bars)
- receipt_number: TEXT
- items: JSONB
- total: NUMERIC
- raw_text: TEXT
- matched: BOOLEAN
- created_at: TIMESTAMP
```

**Related Files:**
- `database/add-printer-relay-tables.sql` - Table creation
- `database/create-unmatched-receipts-table.sql` - Unmatched receipts table
- `supabase/migrations/059_create_printer_drivers_table.sql` - Printer drivers table

---

### 6. Staff App UI Components

**Purpose:** Display receipts, manage assignments, configure system

#### Captain's Orders Component
- Shows unmatched receipts
- Displays items and totals
- Allows assignment to tabs
- Real-time updates via Supabase subscriptions

**Related Files:**
- `apps/staff/components/printer/CaptainsOrders.tsx`

#### Printer Status Indicator
- Shows online/offline status
- Displays last heartbeat time
- Green (online) / Red (offline) indicator

**Related Files:**
- `apps/staff/components/PrinterStatusIndicator.tsx`

#### Prompt Manager (System Tool)
- Edit DeepSeek system prompts
- Test prompts with sample receipts
- Adjust AI parameters
- Save configurations

**Related Files:**
- `packages/printer-service/public/prompt-manager.html`
- `PROMPT-MANAGER-GUIDE.md`

---

## Data Flow

### Receipt Processing Flow

1. **POS prints receipt** → File created in `C:\Users\mwene\TabezaPrints`
2. **Printer service detects file** → Reads content within 2 seconds
3. **Service sends to cloud** → POST to `/api/printer/relay`
4. **Cloud stores raw receipt** → `printer_relay_receipts` table
5. **Cloud triggers AI parsing** → DeepSeek API call (async)
6. **AI returns structured data** → Items, total, receipt number
7. **Cloud stores parsed data** → `unmatched_receipts` table
8. **Staff app displays receipt** → Captain's Orders component
9. **Staff assigns to tab** → Creates `tab_orders` record
10. **Receipt marked as matched** → Removed from unmatched list

### Heartbeat Flow

1. **Printer service sends heartbeat** → Every 30 seconds
2. **Cloud receives heartbeat** → POST to `/api/printer/heartbeat`
3. **Cloud updates status** → `printer_drivers` table
4. **Staff app checks status** → GET `/api/printer/driver-status`
5. **UI shows indicator** → Green (online) or Red (offline)

---

## File Inventory

### Core Service Files
1. `packages/printer-service/index.js` - Main printer service
2. `START-PRINTER-SERVICE-WORKING.bat` - Service launcher
3. `packages/printer-service/config.json` - Configuration (auto-generated)

### API Endpoints
4. `apps/staff/app/api/printer/relay/route.ts` - Receipt relay endpoint
5. `apps/staff/app/api/printer/heartbeat/route.ts` - Heartbeat endpoint
6. `apps/staff/app/api/printer/driver-status/route.ts` - Status check endpoint
7. `apps/staff/app/api/test-receipt-parser/route.ts` - Test parser endpoint

### UI Components
8. `apps/staff/components/printer/CaptainsOrders.tsx` - Receipt assignment UI
9. `apps/staff/components/PrinterStatusIndicator.tsx` - Status indicator
10. `packages/printer-service/public/prompt-manager.html` - Prompt manager UI
11. `packages/printer-service/public/configure.html` - Service configuration UI

### Parser & Logic
12. `packages/shared/services/receiptParser.ts` - AI + regex parser

### Database
13. `database/add-printer-relay-tables.sql` - Relay tables schema
14. `database/create-unmatched-receipts-table.sql` - Unmatched receipts schema
15. `supabase/migrations/059_create_printer_drivers_table.sql` - Drivers table

### Testing & Utilities
16. `test-print-job.js` - Generate test receipts
17. `TEST-PRINTER-NOW.bat` - Quick test launcher
18. `dev-tools/scripts/verify-print-job-flow.js` - Verify end-to-end flow
19. `dev-tools/scripts/check-latest-receipt.js` - Check latest receipt in DB
20. `dev-tools/scripts/check-unmatched-receipts.js` - Check unmatched receipts

### Documentation
21. `CONNECT-ACTUAL-POS-GUIDE.md` - POS configuration guide
22. `PRINTER-TEST-GUIDE.md` - Testing guide
23. `PRINTER-TEST-SUCCESS.md` - Test results
24. `PROMPT-MANAGER-GUIDE.md` - Prompt manager usage
25. `PROMPT-MANAGER-COMPLETE.md` - Prompt manager implementation
26. `QUICK-START-PROMPT-MANAGER.md` - Quick start guide
27. `RECEIPT-PARSER-CACHING-PLAN.md` - Future caching architecture
28. `VERCEL-AUTH-FIXED-SUCCESS.md` - Vercel auth fix documentation
29. `VERCEL-BYPASS-SETUP-GUIDE.md` - Bypass token setup

### Configuration
30. `apps/staff/.env.local` - Environment variables (DeepSeek API key)
31. `.env.local` - Root environment variables

---

## Environment Variables

### Required (apps/staff/.env.local)
```env
DEEPSEEK_API_KEY=your_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_key
SUPABASE_SECRET_KEY=your_secret
```

### Optional (Printer Service)
```env
TABEZA_BAR_ID=438c80c1-fe11-4ac5-8a48-2fc45104ba31
TABEZA_API_URL=https://tabz-kikao.vercel.app
VERCEL_AUTOMATION_BYPASS_SECRET=your_bypass_token
```

---

## Production Deployment Checklist

### Printer Service Setup
- [ ] Install Node.js on Windows PC
- [ ] Clone repository
- [ ] Run `pnpm install`
- [ ] Configure Bar ID and API URL
- [ ] Test with `START-PRINTER-SERVICE-WORKING.bat`
- [ ] Verify heartbeats in database
- [ ] Set up auto-start on Windows boot

### POS Configuration
- [ ] Configure POS to print to file
- [ ] Set output folder: `C:\Users\mwene\TabezaPrints`
- [ ] Use Generic Text printer driver
- [ ] Test print from POS
- [ ] Verify receipt appears in staff app

### Cloud Configuration
- [ ] Deploy API endpoints to Vercel
- [ ] Configure DeepSeek API key
- [ ] Verify database tables exist
- [ ] Test heartbeat endpoint
- [ ] Test relay endpoint
- [ ] Disable Vercel Authentication (or configure bypass)

### AI Parser Configuration
- [ ] Open prompt manager
- [ ] Test with real POS receipts
- [ ] Tune system prompt if needed
- [ ] Save working configuration
- [ ] Monitor parsing success rate

### Staff Training
- [ ] Train staff on Captain's Orders
- [ ] Explain receipt assignment process
- [ ] Show printer status indicator
- [ ] Provide troubleshooting guide

---

## Troubleshooting

### Printer Service Not Starting
- Check Node.js is installed
- Verify port 8765 is available
- Check Bar ID is configured
- Review terminal output for errors

### Receipts Not Appearing
- Verify printer service is running
- Check files are being created in watch folder
- Verify internet connection
- Check Vercel deployment status
- Review cloud logs

### AI Parsing Failures
- Check DeepSeek API key is valid
- Verify API key has credits
- Test with prompt manager
- Check receipt format is readable
- Review parsing logs

### Heartbeat Failures
- Check internet connection
- Verify API URL is correct
- Check Vercel Authentication is disabled
- Review heartbeat logs in terminal

---

## Future Enhancements

### Phase 1: Prompt Management (COMPLETE ✅)
- Visual prompt editor
- Test with sample receipts
- Save configurations

### Phase 2: Caching System (PLANNED)
- AI learns format → Generate regex
- Cache patterns per bar
- Fast parsing without AI calls
- Automatic pattern updates

### Phase 3: Multi-Format Support (PLANNED)
- Detect multiple receipt formats
- Auto-switch between patterns
- Per-POS configuration
- Format analytics

### Phase 4: Advanced Features (PLANNED)
- Receipt validation rules
- Duplicate detection
- Auto-assignment based on table numbers
- Receipt search and history

---

## Support & Maintenance

### Monitoring
- Check printer driver status daily
- Monitor parsing success rate
- Review error logs weekly
- Track API costs (DeepSeek)

### Updates
- Update printer service when new features added
- Redeploy cloud API when endpoints change
- Update AI prompts as formats evolve
- Backup database regularly

### Contact
- Technical issues: Check logs first
- Parsing problems: Use prompt manager
- POS integration: Review POS guide
- Database issues: Check Supabase dashboard

---

**Last Updated:** 2026-02-12  
**Version:** 1.0  
**Status:** Production Ready ✅
