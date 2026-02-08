# Test Print Only Flow

## Quick Test Guide

### Prerequisites
1. Printer service running on `http://localhost:8765`
2. Staff app running on `http://localhost:3003`
3. Test print job in database

### Test Steps

#### 1. Start Printer Service
```bash
cd packages/printer-service
node index.js
```

Expected output:
```
✅ Tabeza Printer Service - Running
Port: 8765
Watch Folder: C:\Users\[YourUser]\TabezaPrints
```

#### 2. Verify Printer Service
```bash
curl http://localhost:8765/api/status
```

Expected response:
```json
{
  "status": "running",
  "version": "1.0.0",
  "printerName": "Tabeza Receipt Printer",
  "configured": true
}
```

#### 3. Create Test Print Job (SQL)
```sql
INSERT INTO print_jobs (
  id,
  bar_id,
  driver_id,
  raw_data,
  parsed_data,
  status,
  received_at
) VALUES (
  gen_random_uuid(),
  'YOUR_BAR_ID',
  'test-driver',
  'VEVTVCBSRUNFSVBUCjF4IFRlc3QgSXRlbSAgICAgICAgIDEwLjAwClRvdGFsOiAgICAgICAgICAgICAgMTAuMDA=', -- Base64 encoded test receipt
  '{"items": [{"name": "Test Item", "quantity": 1, "price": 10.00}], "total": 10.00}',
  'received',
  NOW()
);
```

#### 4. Test Print Only Button

1. Open staff dashboard: `http://localhost:3003`
2. Find the test receipt in CaptainsOrders
3. Click on the receipt card
4. Modal opens with receipt details
5. Click "Print Only" button (gray button)
6. Should see "Printing..." spinner
7. Should see success message
8. Receipt disappears from queue

#### 5. Verify Physical Print

Check output folder:
```
C:\Users\[YourUser]\TabezaPrints\output\
```

Should contain a new file:
```
print-[timestamp].prn
```

#### 6. Verify Database Update

```sql
SELECT id, status, processed_at 
FROM print_jobs 
WHERE id = 'YOUR_PRINT_JOB_ID';
```

Expected:
```
status: 'processed'
processed_at: [timestamp]
```

## Test Scenarios

### Scenario 1: Normal Flow (Printer Service Online)
✅ Print job sent to printer service
✅ File created in output folder
✅ Receipt marked as processed
✅ Receipt removed from queue

### Scenario 2: Printer Service Offline
✅ Error logged but doesn't block
✅ Receipt still marked as processed
✅ Receipt removed from queue
⚠️ Physical print doesn't happen (expected)

### Scenario 3: Already Processed
❌ Returns 400 error
❌ Shows "already processed" message
✅ Prevents duplicate prints

### Scenario 4: Print Job Not Found
❌ Returns 404 error
❌ Shows "not found" message
✅ Receipt remains in queue

## Troubleshooting

### Print Button Shows Error
1. Check browser console for error details
2. Check printer service is running: `http://localhost:8765/api/status`
3. Check print job exists in database
4. Check print job status is 'received' not 'processed'

### No File in Output Folder
1. Check printer service logs
2. Verify output folder path
3. Check file permissions
4. Verify raw_data field is not null

### Receipt Not Disappearing
1. Check database status was updated
2. Refresh the page
3. Check real-time subscription is working
4. Check browser console for errors

## Success Criteria

✅ Print Only button visible in modal
✅ Button works without tab selection
✅ Calls print endpoint successfully
✅ Printer service receives request
✅ File created in output folder
✅ Receipt marked as processed
✅ Receipt removed from queue
✅ Works offline (graceful degradation)

## Next Steps

After successful test:
1. Configure physical printer to monitor output folder
2. Test with real POS system
3. Test with multiple concurrent receipts
4. Deploy to production
