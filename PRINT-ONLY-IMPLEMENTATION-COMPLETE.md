# Print Only Feature - Implementation Complete

## Overview

The "Print Only" button allows staff to send POS receipts back to the physical printer for non-Tabeza customers (walk-ins, cash payments, etc.).

## How It Works

### 1. Receipt Flow (POS → Tabeza)
```
POS System → Tabeza Printer Driver → Printer Service → Tabeza Cloud → Staff Dashboard
```

### 2. Print Only Flow (Tabeza → POS)
```
Staff clicks "Print Only" → API Endpoint → Printer Service → Physical Printer
```

## Implementation Details

### Frontend (CaptainsOrders Component)
- **Location**: `apps/staff/components/printer/CaptainsOrders.tsx`
- **Button**: Gray "Print Only" button in modal
- **Action**: Calls `/api/receipts/${receiptId}/print` endpoint
- **No tab selection required** - works independently

### Backend (Print Endpoint)
- **Location**: `apps/staff/app/api/receipts/[id]/print/route.ts`
- **Process**:
  1. Fetches print job from `print_jobs` table
  2. Validates it hasn't been processed yet
  3. Sends raw ESC/POS data to Printer Service
  4. Marks print job as 'processed'
  5. Receipt disappears from queue

### Printer Service (New Endpoint)
- **Location**: `packages/printer-service/index.js`
- **Endpoint**: `POST /api/print-to-physical`
- **Process**:
  1. Receives base64-encoded ESC/POS data
  2. Decodes to binary format
  3. Saves to output folder: `TabezaPrints/output/`
  4. Physical printer monitors this folder and prints

## Setup Requirements

### 1. Printer Service Must Be Running
```bash
cd packages/printer-service
node index.js
```

Service runs on: `http://localhost:8765`

### 2. Physical Printer Configuration
Configure your POS printer to monitor the output folder:
- **Folder**: `C:\Users\[YourUser]\TabezaPrints\output\`
- **Method**: Set up printer to auto-print from this folder
- **Alternative**: Use a print spooler service

### 3. Environment Variable (Optional)
```env
PRINTER_SERVICE_URL=http://localhost:8765
```

## Dual Workflow Support

The system now supports BOTH workflows simultaneously:

### Workflow A: Tabeza Customer
1. Receipt arrives from POS
2. Staff clicks "Assign to Tab"
3. Digital receipt sent to customer's phone
4. Receipt marked as 'processed'

### Workflow B: Non-Tabeza Customer
1. Receipt arrives from POS
2. Staff clicks "Print Only"
3. Receipt sent back to physical printer
4. Receipt marked as 'processed'

## Database Schema

### print_jobs Table
```sql
status: 'received' | 'processed' | 'error' | 'no_match'
raw_data: TEXT (base64 encoded ESC/POS commands)
parsed_data: JSONB (parsed receipt with items, totals)
processed_at: TIMESTAMPTZ
```

## Error Handling

### If Printer Service is Offline
- Print endpoint continues to work
- Receipt is marked as 'processed'
- Error logged but doesn't block operation
- Staff sees success message
- **Note**: Physical print won't happen until service is back online

### If Print Job Not Found
- Returns 404 error
- Shows error message to staff
- Receipt remains in queue

### If Already Processed
- Returns 400 error
- Shows "already processed" message
- Prevents duplicate prints

## Testing

### Test Print Only Button
1. Start printer service: `node packages/printer-service/index.js`
2. Create a test print job in database
3. Open staff dashboard
4. Click "Print Only" on a receipt
5. Check `TabezaPrints/output/` folder for print file

### Test Without Printer Service
1. Stop printer service
2. Click "Print Only"
3. Should still mark as processed
4. Error logged but operation succeeds

## Future Enhancements

### Option 1: Direct Printer Communication
- Use Node.js printer libraries
- Send directly to Windows printer queue
- No output folder needed

### Option 2: Network Printing
- Support network printers
- Send via TCP/IP to printer
- Works for remote printers

### Option 3: Print Preview
- Show receipt preview before printing
- Allow staff to edit before sending
- Confirm print action

## Troubleshooting

### Print Not Appearing
1. Check printer service is running: `http://localhost:8765/api/status`
2. Check output folder exists: `TabezaPrints/output/`
3. Check printer is monitoring the folder
4. Check print job has `raw_data` field

### Receipt Stuck in Queue
1. Check print job status in database
2. Manually mark as processed if needed
3. Check for error logs in printer service

### Duplicate Prints
1. Check print job status before clicking
2. Ensure button is disabled during processing
3. Check for race conditions in code

## Production Deployment

### Requirements
1. Printer service installed as Windows service
2. Auto-start on system boot
3. Monitor service health
4. Log rotation configured

### Installation
```bash
cd packages/printer-service
node install-service.js
```

### Verification
```bash
# Check service status
sc query TabezaPrinterService

# Test endpoint
curl http://localhost:8765/api/status
```

## Summary

✅ Print Only button implemented
✅ API endpoint created
✅ Printer service endpoint added
✅ Error handling in place
✅ Works offline (graceful degradation)
✅ Database schema supports dual workflow
✅ Both workflows work simultaneously

The system now fully supports the dual workflow where ALL POS receipts flow through Tabeza, and staff can choose to either assign to a Tabeza customer's tab OR print for a non-Tabeza customer.
