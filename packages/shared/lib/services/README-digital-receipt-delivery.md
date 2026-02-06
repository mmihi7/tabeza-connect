# Digital Receipt Delivery Service

The Digital Receipt Delivery Service handles the conversion of POS print data to digital receipts and their delivery to customer tabs in the Tabeza system.

## Overview

This service is a critical component of the Tabeza Basic workflow, enabling staff to send digital receipts to customers instead of printing physical receipts. It provides:

- **Print Data Conversion**: Transforms POS receipt data into Tabeza digital receipt format
- **Multi-Customer Delivery**: Sends receipts to multiple customers simultaneously
- **Retry Mechanism**: Automatically retries failed deliveries with configurable backoff
- **Delivery Tracking**: Maintains history of all delivery attempts
- **Statistics**: Provides delivery success rates and performance metrics

## Core Concepts

### Print Data Receipt

The raw receipt data from a POS system:

```typescript
interface PrintDataReceipt {
  items: ReceiptItem[];
  total: number;
  subtotal?: number;
  tax?: number;
  customerInfo?: {
    tableNumber?: number;
    phone?: string;
    name?: string;
  };
  metadata?: {
    posSystemId?: string;
    transactionId?: string;
    timestamp: Date;
  };
  rawReceipt?: string;
}
```

### Digital Receipt

The converted format stored in Tabeza:

```typescript
interface DigitalReceipt {
  id: string;
  barId: string;
  tabId: string;
  orderId: string;
  items: ReceiptItem[];
  total: number;
  deliveryStatus: 'pending' | 'delivered' | 'failed';
  deliveredAt?: Date;
  failureReason?: string;
  retryCount: number;
  createdAt: Date;
}
```

## Usage

### Basic Setup

```typescript
import { createDigitalReceiptDeliveryService } from '@tabeza/shared/lib/services/digital-receipt-delivery';

const deliveryService = createDigitalReceiptDeliveryService(
  'https://your-project.supabase.co',
  'your-supabase-key'
);
```

### Custom Retry Configuration

```typescript
const customRetryConfig = {
  maxRetries: 5,
  retryIntervals: [1000, 2000, 5000, 10000, 30000],
  exponentialBackoff: true
};

const deliveryService = createDigitalReceiptDeliveryService(
  supabaseUrl,
  supabaseKey,
  customRetryConfig
);
```

### Converting Print Data

```typescript
const printData: PrintDataReceipt = {
  items: [
    { name: 'Burger', quantity: 2, unit_price: 10.00, total_price: 20.00 },
    { name: 'Fries', quantity: 1, unit_price: 5.00, total_price: 5.00 }
  ],
  total: 25.00,
  customerInfo: { tableNumber: 5 }
};

const digitalReceipt = deliveryService.convertPrintDataToDigitalReceipt(
  printData,
  'bar-123',
  'tab-456'
);
```

### Delivering to Single Customer

```typescript
const result = await deliveryService.deliverToCustomer(
  printData,
  'tab-456',
  5,
  'Customer A',
  'bar-123'
);

if (result.success) {
  console.log('✅ Receipt delivered:', result.orderId);
} else {
  console.error('❌ Delivery failed:', result.error);
}
```

### Delivering to Multiple Customers

```typescript
const customers = [
  { tabId: 'tab-1', tabNumber: 1, customerIdentifier: 'Customer 1' },
  { tabId: 'tab-2', tabNumber: 2, customerIdentifier: 'Customer 2' },
  { tabId: 'tab-3', tabNumber: 3, customerIdentifier: 'Customer 3' }
];

const results = await deliveryService.deliverToMultipleCustomers(
  printData,
  customers,
  'bar-123'
);

const successful = results.filter(r => r.success);
const failed = results.filter(r => !r.success);

console.log(`✅ ${successful.length} delivered, ❌ ${failed.length} failed`);
```

### Retrying Failed Deliveries

```typescript
const retryResult = await deliveryService.retryFailedDelivery(
  printData,
  'tab-456',
  5,
  'Customer A',
  'bar-123',
  0 // Previous attempt count
);
```

## Delivery History

### Tracking Deliveries

The service automatically tracks all delivery attempts:

```typescript
// Get history for a specific receipt
const history = deliveryService.getDeliveryHistory('receipt-123');

// Get all history for a bar
const allHistory = deliveryService.getAllDeliveryHistory('bar-123');

// Clear history (for testing)
deliveryService.clearDeliveryHistory();
```

### Delivery Statistics

```typescript
const stats = deliveryService.getDeliveryStats('bar-123');

console.log('Total deliveries:', stats.totalDeliveries);
console.log('Success rate:', stats.successRate + '%');
console.log('Average attempts:', stats.averageAttempts);
```

## Retry Mechanism

### How Retries Work

1. **Initial Attempt**: Service attempts delivery
2. **Failure Detection**: If delivery fails, retry is scheduled
3. **Retry Delay**: Waits according to retry configuration
4. **Retry Attempt**: Attempts delivery again
5. **Max Retries**: Stops after configured maximum attempts

### Retry Configuration

```typescript
interface RetryConfig {
  maxRetries: number;           // Maximum retry attempts
  retryIntervals: number[];     // Delay between retries (ms)
  exponentialBackoff: boolean;  // Use exponential backoff
}
```

### Exponential Backoff

When enabled, retry delays increase exponentially:

```typescript
// With exponentialBackoff: true
// Attempt 1: 1000ms
// Attempt 2: 2000ms (1000 * 2^1)
// Attempt 3: 4000ms (1000 * 2^2)
// Attempt 4: 8000ms (1000 * 2^3)
```

## Error Handling

### Common Errors

1. **Database Connection Failure**
   - Cause: Supabase connection issues
   - Solution: Check network connectivity and credentials

2. **Tab Not Found**
   - Cause: Tab ID doesn't exist or is closed
   - Solution: Verify tab is open before delivery

3. **Order Creation Failure**
   - Cause: Database constraints or permissions
   - Solution: Check RLS policies and table permissions

### Error Recovery

```typescript
const result = await deliveryService.deliverToCustomer(
  printData,
  tabId,
  tabNumber,
  customerIdentifier,
  barId
);

if (!result.success) {
  // Log error
  console.error('Delivery failed:', result.error);
  
  // Attempt retry
  const retryResult = await deliveryService.retryFailedDelivery(
    printData,
    tabId,
    tabNumber,
    customerIdentifier,
    barId
  );
  
  if (!retryResult.success) {
    // Fallback to physical receipt
    console.log('Falling back to physical receipt');
  }
}
```

## Integration with Virtual Printer

### Complete Workflow

```typescript
// 1. Virtual printer intercepts POS print job
virtualPrinter.on('waiterActionRequired', async (data) => {
  const { receiptData } = data;
  
  // 2. Staff chooses digital receipt
  // 3. Staff selects customers
  const selectedCustomers = [...];
  
  // 4. Deliver digital receipts
  const results = await deliveryService.deliverToMultipleCustomers(
    receiptData,
    selectedCustomers,
    barId
  );
  
  // 5. Show confirmation
  showDeliveryConfirmation(results);
});
```

## Authority Mode Compliance

**CRITICAL**: Digital receipt delivery is ONLY active for POS authority modes.

```typescript
// CORE TRUTH: Manual service always exists. Digital authority is singular.
// Tabeza adapts to the venue — never the reverse.

// ✅ Correct - Only for POS authority
if (authorityMode === 'pos') {
  const deliveryService = createDigitalReceiptDeliveryService(...);
}

// ❌ Wrong - Should not be used for Tabeza authority
if (authorityMode === 'tabeza') {
  // Digital receipt delivery not needed - Tabeza creates orders directly
}
```

## Performance Considerations

### Batch Delivery

For multiple customers, use `deliverToMultipleCustomers` instead of individual calls:

```typescript
// ✅ Good - Single batch operation
const results = await deliveryService.deliverToMultipleCustomers(
  printData,
  customers,
  barId
);

// ❌ Bad - Multiple sequential operations
for (const customer of customers) {
  await deliveryService.deliverToCustomer(...);
}
```

### Memory Management

Clear delivery history periodically in long-running processes:

```typescript
// Clear history after processing
deliveryService.clearDeliveryHistory();

// Or keep only recent history
const recentHistory = deliveryService
  .getAllDeliveryHistory(barId)
  .filter(h => h.createdAt > oneDayAgo);
```

## Testing

### Unit Tests

```bash
cd packages/shared
npm test lib/services/__tests__/digital-receipt-delivery.test.ts
```

### Integration Tests

```typescript
import { createDigitalReceiptDeliveryService } from '@tabeza/shared/lib/services/digital-receipt-delivery';

describe('Digital Receipt Delivery Integration', () => {
  it('should deliver receipt to customer', async () => {
    const service = createDigitalReceiptDeliveryService(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!
    );

    const result = await service.deliverToCustomer(
      printData,
      tabId,
      tabNumber,
      customerIdentifier,
      barId
    );

    expect(result.success).toBe(true);
  });
});
```

## Monitoring

### Delivery Metrics

```typescript
// Get real-time statistics
const stats = deliveryService.getDeliveryStats(barId);

// Log metrics
console.log('📊 Delivery Metrics:', {
  total: stats.totalDeliveries,
  success: stats.successfulDeliveries,
  failed: stats.failedDeliveries,
  rate: `${stats.successRate.toFixed(2)}%`,
  avgAttempts: stats.averageAttempts.toFixed(2)
});
```

### Audit Logging

All deliveries are automatically logged to the `audit_logs` table:

```sql
SELECT * FROM audit_logs
WHERE action = 'digital_receipt_delivery'
AND bar_id = 'bar-123'
ORDER BY created_at DESC;
```

## Troubleshooting

### Deliveries Not Working

1. Check Supabase connection
2. Verify tab exists and is open
3. Check RLS policies on `tab_orders` table
4. Review error messages in delivery results

### High Failure Rate

1. Check customer connection status
2. Verify network stability
3. Review retry configuration
4. Check database performance

### Slow Deliveries

1. Use batch delivery for multiple customers
2. Reduce retry intervals
3. Check database query performance
4. Monitor network latency

## Related Documentation

- [Virtual Printer Package](../../../../packages/virtual-printer/README.md)
- [POS Integration Guide](../../../../packages/virtual-printer/docs/POS-INTEGRATION-GUIDE.md)
- [Printer Driver Implementation Spec](../../../../.kiro/specs/printer-driver-implementation/)
- [Virtual Printer UI Components](../../../../apps/staff/components/printer/README.md)
