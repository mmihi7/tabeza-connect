# POS System Integration Guide

This guide explains how to integrate various POS systems with the Tabeza Virtual Printer.

## Overview

The Tabeza Virtual Printer intercepts print jobs from your POS system and converts them into orders that appear directly in your customers' Tabeza app. This eliminates the need for paper receipts while providing a seamless digital ordering experience.

## Supported POS Systems

### Square POS
1. **Setup**: Configure Square to print receipts to "Tabeza Virtual Printer"
2. **Receipt Format**: Square uses standard text format with clear item separation
3. **Customer Matching**: Include table numbers in receipt notes

### Toast POS
1. **Setup**: Add Tabeza Virtual Printer as a receipt printer
2. **Receipt Format**: Toast provides structured receipt data
3. **Integration**: Use Toast's webhook API for real-time order sync

### Clover POS
1. **Setup**: Install Tabeza app from Clover App Market
2. **Receipt Format**: Clover's structured JSON format
3. **Customer Matching**: Automatic via Clover's customer database

### Shopify POS
1. **Setup**: Configure printer settings in Shopify admin
2. **Receipt Format**: Customizable receipt templates
3. **Integration**: Use Shopify webhooks for order events

### Generic POS Systems
For other POS systems:
1. Set up network printing to Tabeza Virtual Printer
2. Configure receipt format parsing rules
3. Test with sample receipts

## Installation Steps

### 1. Install Virtual Printer Software

```bash
# Download and install Tabeza Virtual Printer
npm install -g @tabeza/virtual-printer-service

# Or run from source
git clone https://github.com/tabeza/virtual-printer
cd virtual-printer
npm install
npm run build
```

### 2. Configure Your Bar

```javascript
const config = {
  merchantId: 'your-merchant-id',
  barId: 'your-tabeza-bar-id',
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseKey: 'your-service-role-key'
};
```

### 3. Set Up Print Capture

#### Windows
1. Install the virtual printer driver
2. Add "Tabeza Virtual Printer" in Windows Printers
3. Configure your POS to print receipts to this printer

#### macOS
1. Add printer via System Preferences
2. Use "Generic PostScript Printer" driver
3. Set printer URI to `tabeza://localhost:8080`

#### Linux
1. Add printer to CUPS:
   ```bash
   sudo lpadmin -p TabezaPrinter -E -v tabeza://localhost:8080
   ```
2. Configure POS system to use this printer

### 4. Configure Receipt Parsing

Create custom parsing rules for your POS format:

```javascript
const customParser = {
  // Identify customer info
  customerPatterns: {
    table: /table\s*:?\s*(\d+)/i,
    phone: /phone\s*:?\s*([\d\s\-\+]+)/i
  },
  
  // Parse line items
  itemPatterns: {
    standard: /^(.+?)\s+(\d+(?:\.\d{2})?)\s*$/,
    withQuantity: /^(\d+)x\s+(.+?)\s+(\d+(?:\.\d{2})?)\s*$/
  },
  
  // Find totals
  totalPatterns: {
    subtotal: /subtotal\s*:?\s*(\d+(?:\.\d{2})?)/i,
    tax: /tax\s*:?\s*(\d+(?:\.\d{2})?)/i,
    total: /total\s*:?\s*(\d+(?:\.\d{2})?)/i
  }
};
```

## Receipt Format Examples

### Standard Format
```
RESTAURANT NAME
123 Main Street

Table: 5
Server: John

2x Burger Deluxe        18.00
1x Fries                 4.50
2x Soft Drink            6.00

Subtotal:               28.50
Tax:                     2.28
Total:                  30.78
```

### Phone Order Format
```
PIZZA PLACE
Phone Order: 555-123-4567

1x Large Pepperoni      15.99
1x Garlic Bread          4.99
2x Soda                  3.98

Total:                  24.96
Ready in 20 minutes
```

### Detailed Format
```
FINE DINING RESTAURANT
Date: 2024-01-15 19:30
Table: 12, Party of 4
Server: Sarah

Appetizers:
1x Calamari             12.00
1x Bruschetta            8.00

Mains:
2x Ribeye Steak         56.00
1x Salmon Fillet        24.00
1x Vegetarian Pasta     18.00

Desserts:
2x Chocolate Cake       16.00

Subtotal:              134.00
Tax (8.5%):             11.39
Service (18%):          24.12
Total:                 169.51
```

## Testing Your Integration

### 1. Test Receipt Processing
```bash
# Test with sample receipt
node test-virtual-printer.js

# Test with your POS format
echo "Your receipt content" | tabeza-printer-test
```

### 2. Verify Order Creation
1. Send test receipt from POS
2. Check Tabeza admin panel for new order
3. Verify customer receives notification

### 3. Monitor Processing
```javascript
virtualPrinter.on('orderCreated', (data) => {
  console.log('Order created:', data);
});

virtualPrinter.on('error', (error) => {
  console.error('Processing error:', error);
});
```

## Troubleshooting

### Common Issues

#### Receipt Not Parsing
- **Problem**: Items not detected in receipt
- **Solution**: Adjust parsing patterns for your POS format
- **Debug**: Enable verbose logging to see parsing attempts

#### Customer Not Found
- **Problem**: Orders create new tabs instead of using existing ones
- **Solution**: Ensure table numbers or phone numbers are included in receipts
- **Debug**: Check customer matching logic

#### Orders Not Appearing
- **Problem**: Orders processed but don't appear in Tabeza
- **Solution**: Verify bar ID and Supabase configuration
- **Debug**: Check database permissions and API responses

### Debug Mode

Enable detailed logging:

```javascript
const virtualPrinter = createVirtualPrinter(config, {
  debug: true,
  logLevel: 'verbose'
});
```

### Log Analysis

Check logs for processing details:
```bash
tail -f /var/log/tabeza-virtual-printer.log
```

## Advanced Configuration

### Custom Receipt Parsers

Create specialized parsers for unique POS formats:

```javascript
class CustomReceiptParser {
  parse(receiptText) {
    // Your custom parsing logic
    return {
      items: [...],
      total: 0,
      customerInfo: {...}
    };
  }
}

virtualPrinter.setCustomParser(new CustomReceiptParser());
```

### Webhook Integration

For POS systems with webhook support:

```javascript
// Receive webhooks instead of print capture
app.post('/pos-webhook', (req, res) => {
  const orderData = req.body;
  virtualPrinter.processOrderData(orderData);
  res.status(200).send('OK');
});
```

### Multi-Location Setup

Configure multiple locations:

```javascript
const locations = [
  { merchantId: 'location1', barId: 'bar1' },
  { merchantId: 'location2', barId: 'bar2' }
];

locations.forEach(location => {
  const printer = createVirtualPrinter(location);
  printer.start();
});
```

## Support

For integration assistance:
- Email: support@tabeza.com
- Documentation: https://docs.tabeza.com/virtual-printer
- Community: https://community.tabeza.com

## Next Steps

1. Complete the basic integration
2. Test with real orders
3. Configure customer notifications
4. Set up monitoring and alerts
5. Train staff on the new workflow