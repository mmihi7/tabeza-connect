# Tabeza Virtual Printer

The Tabeza Virtual Printer allows POS systems to send orders directly to customer tabs instead of printing paper receipts. This creates a seamless integration where existing POS systems can work with Tabeza without modification.

## How It Works

1. **Print Interception**: The virtual printer intercepts print jobs from your POS system
2. **Receipt Parsing**: Extracts order information from the receipt data
3. **Customer Matching**: Finds or creates a customer tab based on table number or phone
4. **Order Creation**: Creates a confirmed order in the Tabeza system
5. **Customer Notification**: Notifies the customer through the Tabeza app

## Quick Start

### Installation

```bash
npm install @tabeza/virtual-printer
```

### Basic Setup

```typescript
import { createVirtualPrinter } from '@tabeza/virtual-printer';

const virtualPrinter = createVirtualPrinter(
  'your-merchant-id',
  'your-bar-id',
  'https://your-project.supabase.co',
  'your-supabase-key'
);

// Start capturing print jobs
await virtualPrinter.start();

// Process a receipt (this would normally be automatic)
await virtualPrinter.processPrintJob(receiptData);
```

## Configuration

### Required Configuration

- **merchantId**: Your unique merchant identifier
- **barId**: The Tabeza bar ID where orders should be sent
- **supabaseUrl**: Your Supabase project URL
- **supabaseKey**: Your Supabase service role key

### Optional Configuration

```typescript
const virtualPrinter = createVirtualPrinter(
  merchantId,
  barId,
  supabaseUrl,
  supabaseKey,
  {
    forwardToPhysicalPrinter: false, // Don't print to paper
    generateQRCode: false,           // Orders go directly to app
    printerFilters: ['*']            // Capture all print jobs
  }
);
```

## POS System Integration

### Windows (Print Spooler)

1. Install the virtual printer driver
2. Set your POS system to print to "Tabeza Virtual Printer"
3. Configure the printer port to send data to the virtual printer service

### Linux (CUPS)

1. Add the virtual printer to CUPS
2. Configure your POS system to use the virtual printer
3. Set up the print filter to process receipt data

### Network Printing

For network-based POS systems:

1. Set up a network print server
2. Configure the virtual printer as a network printer
3. Point your POS system to the virtual printer's IP/port

## Receipt Format Support

The virtual printer supports common receipt formats:

- **Plain Text**: Standard text-based receipts
- **ESC/POS**: Thermal printer commands
- **Custom Formats**: Configurable parsing rules

### Sample Receipt Format

```
RESTAURANT NAME
123 Main Street

Table: 5
Phone: 555-0123

2x Burger Deluxe        18.00
1x Fries                 4.50
2x Soft Drink            6.00

Subtotal:               28.50
Tax:                     2.28
Total:                  30.78
```

## Customer Matching

The virtual printer matches customers using:

1. **Table Number**: Looks for existing tabs with matching table numbers
2. **Phone Number**: Matches by customer phone number
3. **Auto-Create**: Creates new tabs for unmatched customers

## Events

Listen for events to monitor the integration:

```typescript
virtualPrinter.on('orderCreated', (data) => {
  console.log('Order created:', data.orderId);
});

virtualPrinter.on('customerNotified', (data) => {
  console.log('Customer notified:', data.message);
});

virtualPrinter.on('error', (error) => {
  console.error('Processing error:', error);
});
```

## Monitoring

Get processing statistics:

```typescript
const stats = virtualPrinter.getStats();
console.log('Processed:', stats.totalJobsProcessed);
console.log('Success rate:', stats.successfulParsing / stats.totalJobsProcessed);
```

## Troubleshooting

### Common Issues

1. **Receipt not parsing**: Check the receipt format and adjust parsing rules
2. **Customer not found**: Ensure table numbers or phone numbers are included
3. **Orders not appearing**: Verify bar ID and Supabase configuration

### Debug Mode

Enable debug logging:

```typescript
virtualPrinter.on('debug', (message) => {
  console.log('Debug:', message);
});
```

## Examples

See the `examples/` directory for complete integration examples:

- `pos-integration.ts`: Basic POS system integration
- `custom-parser.ts`: Custom receipt parsing rules
- `monitoring.ts`: Advanced monitoring and alerting

## Support

For integration support:
- Check the examples directory
- Review the troubleshooting guide
- Contact Tabeza support for custom POS integrations