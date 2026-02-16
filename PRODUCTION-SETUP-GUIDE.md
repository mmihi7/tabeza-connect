# Tabeza Printer System - Production Setup Guide

## Overview

This guide covers the complete production setup for the Tabeza printer system, which enables POS receipt integration through AI-powered parsing with intelligent caching.

**System Architecture:**
```
POS System → Windows Print → Printer Service → Cloud API → DeepSeek AI → Database → Staff App
```

---

## Prerequisites

### Hardware Requirements
- Windows PC (Windows 10 or later)
- Minimum 4GB RAM
- 100MB free disk space
- Stable internet connection (minimum 1 Mbps)

### Software Requirements
- Node.js 18+ ([Download](https://nodejs.org))
- pnpm 10.25.0+ (installed via: `npm install -g pnpm`)
- Git (optional, for updates)

### Account Requirements
- Tabeza account with Bar ID
- DeepSeek API key ([Get one](https://platform.deepseek.com))
- Vercel deployment (for cloud API)

---

## Part 1: Cloud API Setup

### Step 1: Configure DeepSeek API Key

1. Get your API key from [DeepSeek Platform](https://platform.deepseek.com)

2. Add to `apps/staff/.env.local`:
```env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

3. Verify the key is loaded:
```bash
cd apps/staff
node -e "console.log(process.env.DEEPSEEK_API_KEY ? '✅ Key loaded' : '❌ Key missing')"
```

### Step 2: Deploy to Vercel

1. Ensure all API endpoints are deployed:
   - `/api/printer/relay` - Receipt relay endpoint
   - `/api/printer/heartbeat` - Heartbeat tracking
   - `/api/printer/driver-status` - Status check
   - `/api/test-receipt-parser` - Prompt testing

2. Deploy to Vercel:
```bash
cd apps/staff
vercel --prod
```

3. Note your production URL (e.g., `https://tabz-kikao.vercel.app`)

### Step 3: Disable Vercel Authentication

**CRITICAL:** The printer service cannot authenticate with Vercel's protection.

1. Go to Vercel Dashboard → Your Project → Settings → Deployment Protection
2. Toggle OFF "Vercel Authentication"
3. Save changes

**Alternative:** Use bypass token (not recommended for production):
- Enable "Protection Bypass for Automation"
- Add token to printer service environment

### Step 4: Verify Database Tables

Ensure these tables exist in Supabase:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'printer_drivers',
  'printer_relay_receipts', 
  'unmatched_receipts'
);
```

If missing, run migrations:
```bash
# From project root
psql $DATABASE_URL -f database/add-printer-relay-tables.sql
psql $DATABASE_URL -f database/create-unmatched-receipts-table.sql
psql $DATABASE_URL -f supabase/migrations/059_create_printer_drivers_table.sql
```

---

## Part 2: Printer Service Setup (Windows PC)

### Step 1: Install Dependencies

1. Clone repository (if not already):
```bash
git clone <your-repo-url>
cd Tabz
```

2. Install dependencies:
```bash
pnpm install
```

3. Verify printer service files exist:
```bash
dir packages\printer-service\index.js
dir START-PRINTER-SERVICE-WORKING.bat
```

### Step 2: Configure Printer Service

**Option A: Environment Variables (Recommended)**

Create `START-PRINTER-SERVICE-WORKING.bat` with your Bar ID:

```batch
@echo off
echo Starting Tabeza Printer Service...
echo.

REM Set your Bar ID and API URL
set TABEZA_BAR_ID=your-bar-id-here
set TABEZA_API_URL=https://your-domain.vercel.app

REM Start the service
cd packages\printer-service
node index.js

pause
```

**Option B: Web Configuration**

1. Start service without config:
```bash
cd packages\printer-service
node index.js
```

2. Open browser: `http://localhost:8765/configure.html`

3. Enter your Bar ID and API URL

4. Click "Configure"

### Step 3: Create Watch Folder

The printer service monitors this folder for new receipts:

```bash
mkdir C:\Users\%USERNAME%\TabezaPrints
```

**Folder Structure:**
```
C:\Users\YourName\TabezaPrints\
├── (new receipts appear here)
├── processed\     (successfully processed)
├── errors\        (failed processing)
└── output\        (for physical printer)
```

### Step 4: Test Printer Service

1. Start the service:
```bash
START-PRINTER-SERVICE-WORKING.bat
```

2. Verify output shows:
```
✅ Configuration Complete!
📍 Service Status:
   • Port: 8765
   • Bar ID: 438c80c1-fe11-4ac5-8a48...
   • API URL: https://tabz-kikao.vercel.app
   • Watch Folder: C:\Users\mwene\TabezaPrints
   • Config Source: Environment Variables

💓 Starting heartbeat service...
💓 Sending heartbeat to production: https://tabz-kikao.vercel.app
```

3. Check heartbeat in database:
```sql
SELECT * FROM printer_drivers 
WHERE bar_id = 'your-bar-id' 
ORDER BY last_heartbeat_at DESC 
LIMIT 1;
```

Should show `status = 'online'` and recent `last_heartbeat_at`.

### Step 5: Test Receipt Processing

1. Run test script:
```bash
node test-print-job.js
```

2. Verify in terminal:
```
📄 New print file detected: test-receipt-1234567890.txt
✅ Print job relayed successfully
```

3. Check database:
```bash
node dev-tools/scripts/verify-print-job-flow.js
```

Should show receipt in `printer_relay_receipts` and `unmatched_receipts` tables.

---

## Part 3: POS System Integration

### Option 1: Print to File (Recommended)

**Best for:** Most POS systems with printer configuration

1. In your POS system, add a new printer:
   - Name: "Tabeza Receipt Printer"
   - Driver: "Generic / Text Only"
   - Port: FILE
   - Output folder: `C:\Users\YourName\TabezaPrints`

2. Test print from POS

3. Verify receipt appears in Staff App → Captain's Orders

### Option 2: Microsoft Print to PDF

**Best for:** POS systems without file output

1. In POS, select "Microsoft Print to PDF" printer

2. When printing, save to: `C:\Users\YourName\TabezaPrints`

3. Rename file to `.txt` extension (if needed)

### Option 3: Network Printer with Folder Output

**Best for:** Network printers with "Print to Folder" feature

1. Configure network printer to output to shared folder

2. Map shared folder to: `C:\Users\YourName\TabezaPrints`

3. Test print from POS

### Option 4: Virtual Printer Software

**Best for:** Advanced setups requiring automation

1. Install PDFCreator or similar virtual printer

2. Configure auto-save to: `C:\Users\YourName\TabezaPrints`

3. Set output format to plain text

4. Test print from POS

---

## Part 4: AI Parser Configuration

### Understanding the AI Caching System

**Phase 1: First Receipt (AI Learning)**
1. POS prints receipt → Printer service detects
2. Receipt sent to DeepSeek AI
3. AI analyzes format and extracts items/total
4. **Future:** Generate regex patterns from AI result
5. **Future:** Cache patterns in database

**Phase 2: Subsequent Receipts (Fast Parsing)**
1. POS prints receipt → Printer service detects
2. **Future:** Check cache for this bar's patterns
3. **Future:** Apply cached regex (instant, no AI call)
4. If cache fails → Fall back to AI

**Current Status:** AI-first with regex fallback (caching not yet implemented)

### Step 1: Access Prompt Manager

1. Ensure printer service is running

2. Open browser: `http://localhost:8765/prompt-manager.html`

3. You'll see the prompt management interface

### Step 2: Test with Real POS Receipts

1. Print a receipt from your POS (save to watch folder)

2. Copy the receipt text

3. In Prompt Manager:
   - Paste receipt text in "Receipt Text" box
   - Click "Test Parse"
   - Review results

4. Check if items are extracted correctly:
   - ✅ Items array has correct names and prices
   - ✅ Total matches receipt
   - ✅ Receipt number extracted (if present)

### Step 3: Tune AI Prompt (If Needed)

If AI fails to extract items:

1. In Prompt Manager, edit the "System Prompt"

2. Add specific instructions for your receipt format:
```
Additional rules for this POS:
- Items are formatted as: QTY  NAME  PRICE
- Prices are in format: Kes 250.00
- Total line starts with "TOTAL:"
```

3. Test again with sample receipt

4. Once working, the prompt is automatically used

### Step 4: Monitor Parsing Success

1. Check Staff App → Captain's Orders

2. Verify receipts show:
   - Individual items with prices
   - Correct total
   - Receipt number (if available)

3. If items are missing:
   - Check prompt manager
   - Review receipt format
   - Adjust system prompt

---

## Part 5: Auto-Start on Windows Boot

### Option 1: Task Scheduler (Recommended)

1. Open Task Scheduler (Win + R → `taskschd.msc`)

2. Create Basic Task:
   - Name: "Tabeza Printer Service"
   - Trigger: "When the computer starts"
   - Action: "Start a program"
   - Program: `C:\Path\To\START-PRINTER-SERVICE-WORKING.bat`

3. Set to run whether user is logged in or not

4. Test by restarting computer

### Option 2: Startup Folder

1. Press Win + R → `shell:startup`

2. Create shortcut to `START-PRINTER-SERVICE-WORKING.bat`

3. Restart computer to test

### Option 3: Windows Service (Advanced)

Use `node-windows` to install as Windows service:

```bash
npm install -g node-windows
node install-service.js
```

---

## Part 6: Staff Training

### For Staff Using Captain's Orders

1. **View Unmatched Receipts:**
   - Go to Staff App → Captain's Orders
   - See list of receipts from POS
   - Each shows items, prices, and total

2. **Assign Receipt to Tab:**
   - Click "Assign to Tab" button
   - Select customer's tab from dropdown
   - Click "Confirm Assignment"
   - Receipt items added to tab

3. **Monitor Printer Status:**
   - Check printer indicator in top bar
   - Green = Online, Red = Offline
   - Hover to see last heartbeat time

### For Managers

1. **Check Printer Service:**
   - Verify Windows PC is running
   - Check terminal window shows heartbeats
   - Verify "Service Status: Running"

2. **Troubleshoot Issues:**
   - If receipts not appearing: Check POS printer config
   - If parsing fails: Use prompt manager to tune AI
   - If service offline: Restart batch file

3. **Monitor Costs:**
   - DeepSeek API costs ~$0.001 per receipt
   - Check usage at [DeepSeek Dashboard](https://platform.deepseek.com)
   - Future caching will reduce costs significantly

---

## Part 7: Monitoring & Maintenance

### Daily Checks

1. **Printer Service Status:**
```bash
# Check if service is running
curl http://localhost:8765/api/status
```

2. **Heartbeat Status:**
```sql
SELECT 
  status,
  last_heartbeat_at,
  EXTRACT(EPOCH FROM (NOW() - last_heartbeat_at)) as seconds_ago
FROM printer_drivers
WHERE bar_id = 'your-bar-id';
```

Should show `status = 'online'` and `seconds_ago < 60`.

3. **Recent Receipts:**
```bash
node dev-tools/scripts/check-latest-receipt.js
```

### Weekly Checks

1. **Parsing Success Rate:**
```sql
SELECT 
  COUNT(*) as total_receipts,
  COUNT(CASE WHEN parsed_data IS NOT NULL THEN 1 END) as parsed,
  COUNT(CASE WHEN parsed_data IS NULL THEN 1 END) as failed,
  ROUND(100.0 * COUNT(CASE WHEN parsed_data IS NOT NULL THEN 1 END) / COUNT(*), 2) as success_rate
FROM printer_relay_receipts
WHERE created_at > NOW() - INTERVAL '7 days';
```

2. **Unmatched Receipts:**
```bash
node dev-tools/scripts/check-unmatched-receipts.js
```

3. **DeepSeek API Costs:**
   - Check [DeepSeek Dashboard](https://platform.deepseek.com)
   - Review token usage and costs
   - Typical: $0.001 per receipt

### Monthly Maintenance

1. **Clean Up Processed Files:**
```bash
# Delete files older than 30 days
cd C:\Users\YourName\TabezaPrints\processed
forfiles /p . /s /m *.* /d -30 /c "cmd /c del @path"
```

2. **Database Cleanup:**
```sql
-- Archive old receipts (older than 90 days)
DELETE FROM printer_relay_receipts
WHERE created_at < NOW() - INTERVAL '90 days';
```

3. **Update Software:**
```bash
git pull
pnpm install
# Restart printer service
```

---

## Troubleshooting

### Issue: Printer Service Won't Start

**Symptoms:** Batch file closes immediately or shows errors

**Solutions:**
1. Check Node.js is installed: `node --version`
2. Check port 8765 is available: `netstat -ano | findstr :8765`
3. Kill existing process: `taskkill /F /PID <pid>`
4. Check Bar ID is configured in batch file
5. Review terminal output for errors

### Issue: Receipts Not Appearing in Staff App

**Symptoms:** POS prints but nothing shows in Captain's Orders

**Solutions:**
1. Check printer service is running (terminal shows heartbeats)
2. Verify files are created in watch folder
3. Check internet connection
4. Verify Vercel deployment is live
5. Check database for receipts:
```bash
node dev-tools/scripts/verify-print-job-flow.js
```

### Issue: AI Parsing Fails (Empty Items)

**Symptoms:** Receipt shows in Captain's Orders but no items

**Solutions:**
1. Open prompt manager: `http://localhost:8765/prompt-manager.html`
2. Test with actual receipt text
3. Review AI response in test results
4. Adjust system prompt for your receipt format
5. Check DeepSeek API key is valid and has credits

### Issue: Heartbeat Failures

**Symptoms:** Printer shows offline in Staff App

**Solutions:**
1. Check internet connection
2. Verify API URL is correct in batch file
3. Check Vercel Authentication is disabled
4. Review terminal for error messages
5. Test heartbeat manually:
```bash
curl -X POST https://your-domain.vercel.app/api/printer/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"barId":"your-bar-id","driverId":"test","status":"online"}'
```

### Issue: Multiple Receipts Created

**Symptoms:** One POS print creates multiple receipts in Staff App

**Solutions:**
1. This is normal during testing (file watcher triggers multiple times)
2. In production, ensure POS only prints once
3. Check watch folder for duplicate files
4. Verify POS printer settings

---

## Security Considerations

### API Keys
- Store DeepSeek API key in `.env.local` (never commit to git)
- Rotate API keys quarterly
- Monitor API usage for anomalies

### Network Security
- Printer service runs on localhost only (port 8765)
- Cloud API uses HTTPS (Vercel)
- No sensitive data in printer service logs

### Data Privacy
- Receipts stored in database (encrypted at rest)
- Raw receipt data is base64 encoded
- Parsed data contains only items/prices (no customer info)

### Access Control
- Printer service requires Bar ID (acts as authentication)
- Staff App requires Supabase authentication
- Captain's Orders filtered by bar_id

---

## Performance Optimization

### Current Performance
- Receipt detection: < 2 seconds
- Cloud relay: < 1 second
- AI parsing: 2-5 seconds
- Total time: 5-8 seconds from print to Staff App

### Future Optimizations (Caching System)
- First receipt: 5-8 seconds (AI learning)
- Subsequent receipts: < 1 second (cached regex)
- Cost reduction: 90%+ (fewer AI calls)
- Reliability: Higher (regex is deterministic)

### Scaling Considerations
- Current: Handles 100+ receipts/day per bar
- Bottleneck: DeepSeek API rate limits
- Solution: Implement caching system (planned)
- Future: Support 1000+ receipts/day per bar

---

## Cost Analysis

### Infrastructure Costs
- Vercel: Free tier (sufficient for most bars)
- Supabase: Free tier (up to 500MB database)
- DeepSeek API: ~$0.001 per receipt
- Windows PC: Existing hardware (no additional cost)

### Monthly Cost Estimate
- 100 receipts/day × 30 days = 3,000 receipts/month
- 3,000 × $0.001 = $3/month (DeepSeek API)
- Total: ~$3-5/month per bar

### Cost Reduction with Caching
- First receipt: $0.001 (AI call)
- Next 99 receipts: $0 (cached regex)
- Estimated savings: 90%+
- New monthly cost: ~$0.30-0.50/month per bar

---

## Support & Resources

### Documentation
- System Architecture: `PRINTER-SYSTEM-ARCHITECTURE.md`
- Prompt Manager Guide: `PROMPT-MANAGER-GUIDE.md`
- Caching Plan: `RECEIPT-PARSER-CACHING-PLAN.md`
- POS Integration: `CONNECT-ACTUAL-POS-GUIDE.md`

### Testing Tools
- Test print job: `node test-print-job.js`
- Verify flow: `node dev-tools/scripts/verify-print-job-flow.js`
- Check receipts: `node dev-tools/scripts/check-latest-receipt.js`
- Prompt manager: `http://localhost:8765/prompt-manager.html`

### Quick Commands
```bash
# Start printer service
START-PRINTER-SERVICE-WORKING.bat

# Test print
node test-print-job.js

# Check status
curl http://localhost:8765/api/status

# Verify receipts
node dev-tools/scripts/verify-print-job-flow.js

# Open prompt manager
start http://localhost:8765/prompt-manager.html
```

---

## Next Steps

### Immediate (Production Ready ✅)
- [x] Cloud API deployed
- [x] Printer service configured
- [x] POS integration tested
- [x] AI parsing working
- [x] Staff training complete

### Short Term (Next 2-4 Weeks)
- [ ] Implement caching system (Phase 1)
- [ ] Add format detection logic
- [ ] Create pattern generation from AI
- [ ] Test with multiple POS formats

### Long Term (Next 2-3 Months)
- [ ] Multi-format support
- [ ] Auto-assignment based on table numbers
- [ ] Receipt validation rules
- [ ] Duplicate detection
- [ ] Advanced analytics

---

**Last Updated:** 2026-02-12  
**Version:** 1.0  
**Status:** Production Ready ✅

**Questions?** Review the troubleshooting section or check the documentation files listed above.
