# Receipt Parsing Template Configuration

## Overview

TabezaConnect supports custom receipt parsing templates to accommodate different POS receipt formats. Templates are configured in `config.json` and use regex patterns to extract structured data from receipt text.

## Quick Start

### 1. Add Template to config.json

Edit your `config.json` file and add a `parsingTemplate` section:

```json
{
  "barId": "your-bar-id",
  "apiUrl": "https://tabz-kikao.vercel.app",
  "driverId": "driver-xxx",
  "watchFolder": "C:\\Users\\YourUsername\\TabezaPrints",
  "parsingTemplate": {
    "receiptNumber": "Receipt\\s*#?:?\\s*(\\S+)",
    "timestamp": "(\\d{1,2}/\\d{1,2}/\\d{4}\\s+\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s*[AP]M)?)",
    "items": {
      "pattern": "^(\\d+)\\s+(.+?)\\s{2,}(\\d+(?:,\\d{3})*\\.\\d{2})\\s*$",
      "multiline": true,
      "startMarker": "QTY\\s+ITEM\\s+AMOUNT",
      "endMarker": "^-{3,}|Subtotal|Total"
    },
    "subtotal": "Subtotal:?\\s*(\\d+(?:,\\d{3})*\\.\\d{2})",
    "tax": "(?:VAT|Tax)(?:\\s*\\(\\d+%\\))?:?\\s*(\\d+(?:,\\d{3})*\\.\\d{2})",
    "total": "^\\s*TOTAL:?\\s*(\\d+(?:,\\d{3})*\\.\\d{2})"
  }
}
```

### 2. Test Your Template

Run the test script to verify your template works:

```bash
node test-template-loading.js
```

### 3. Restart TabezaConnect

After updating the template, restart the service to apply changes.

## Template Structure

### Required Fields

- **total**: Pattern to extract the total amount (REQUIRED)

### Optional Fields

- **receiptNumber**: Pattern to extract receipt/order number
- **timestamp**: Pattern to extract date and time
- **subtotal**: Pattern to extract subtotal amount
- **tax**: Pattern to extract tax/VAT amount
- **items**: Configuration for extracting line items (see below)

### Items Configuration

The `items` field is an object with the following properties:

```json
{
  "pattern": "regex pattern with 3 capture groups",
  "multiline": true,
  "startMarker": "regex to detect items section start",
  "endMarker": "regex to detect items section end"
}
```

**Pattern Capture Groups:**
1. Quantity (number)
2. Item name (string)
3. Price (number with optional commas)

## Example Templates

### Default Template (Tusker Lager Format)

```json
{
  "receiptNumber": "Receipt\\s*#?:?\\s*(\\S+)",
  "timestamp": "(\\d{1,2}/\\d{1,2}/\\d{4}\\s+\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s*[AP]M)?)",
  "items": {
    "pattern": "^(\\d+)\\s+(.+?)\\s{2,}(\\d+(?:,\\d{3})*\\.\\d{2})\\s*$",
    "multiline": true,
    "startMarker": "QTY\\s+ITEM\\s+AMOUNT",
    "endMarker": "^-{3,}|Subtotal|Total"
  },
  "subtotal": "Subtotal:?\\s*(\\d+(?:,\\d{3})*\\.\\d{2})",
  "tax": "(?:VAT|Tax)(?:\\s*\\(\\d+%\\))?:?\\s*(\\d+(?:,\\d{3})*\\.\\d{2})",
  "total": "^\\s*TOTAL:?\\s*(\\d+(?:,\\d{3})*\\.\\d{2})"
}
```

**Matches receipts like:**
```
Receipt #: RCP-2024-001234
Date: 12/15/2024 8:45:30 PM

QTY  ITEM                           AMOUNT
----------------------------------------
2    Tusker Lager 500ml         500.00
1    Nyama Choma Platter      1,200.00
----------------------------------------
Subtotal:                       2,210.00
VAT (16%):                        353.60
TOTAL:                          2,563.60
```

### Captain Orders Format

```json
{
  "receiptNumber": "Order\\s*#:?\\s*(\\d+)",
  "timestamp": "(\\d{4}-\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2})",
  "items": {
    "pattern": "^(.+?)\\s+x(\\d+)\\s+@\\s+(\\d+\\.\\d{2})$",
    "multiline": true,
    "startMarker": "ITEMS:",
    "endMarker": "^={3,}"
  },
  "subtotal": "Subtotal:\\s*(\\d+\\.\\d{2})",
  "tax": "VAT\\s*\\(16%\\):\\s*(\\d+\\.\\d{2})",
  "total": "Total:\\s*(\\d+\\.\\d{2})"
}
```

**Matches receipts like:**
```
Order #: 12345
Date: 2024-12-15 20:45:30

ITEMS:
Tusker Lager 500ml x2 @ 250.00
Nyama Choma Platter x1 @ 1200.00
=====================================
Subtotal: 2210.00
VAT (16%): 353.60
Total: 2563.60
```

### Minimal Template (Total Only)

```json
{
  "total": "Amount\\s*Due:\\s*(\\d+\\.\\d{2})"
}
```

Use this when you only need to extract the total amount.

## Regex Pattern Tips

### Common Patterns

- **Numbers**: `\\d+` (one or more digits)
- **Decimals**: `\\d+\\.\\d{2}` (e.g., 123.45)
- **Numbers with commas**: `\\d+(?:,\\d{3})*\\.\\d{2}` (e.g., 1,234.56)
- **Optional whitespace**: `\\s*` (zero or more spaces)
- **Required whitespace**: `\\s+` (one or more spaces)
- **Any text**: `.+?` (non-greedy match)
- **Start of line**: `^`
- **End of line**: `$`
- **Case insensitive**: Add `i` flag (handled automatically)

### Capture Groups

Use parentheses `()` to capture values:

```regex
Total:\\s*(\\d+\\.\\d{2})
         ^^^^^^^^^^^^^^^
         This part is captured
```

### Escaping Special Characters

Escape these characters with `\\`:
- `.` → `\\.`
- `(` → `\\(`
- `)` → `\\)`
- `[` → `\\[`
- `]` → `\\]`
- `{` → `\\{`
- `}` → `\\}`
- `+` → `\\+`
- `*` → `\\*`
- `?` → `\\?`
- `^` → `\\^`
- `$` → `\\$`
- `|` → `\\|`
- `\\` → `\\\\`

## Validation and Fallback

### Automatic Validation

TabezaConnect validates all regex patterns before use:

- Invalid patterns are logged and replaced with defaults
- The `total` field is required; missing it triggers fallback
- Invalid `items` configuration uses default items pattern
- Invalid optional fields use default patterns

### Fallback Behavior

If template loading fails:
1. Error is logged to console
2. Default template is used automatically
3. Service continues without interruption
4. No receipts are rejected due to template errors

### Testing Your Template

1. **Use the test script:**
   ```bash
   node test-template-loading.js
   ```

2. **Check logs for validation errors:**
   - Look for `[Receipt Parser]` messages
   - Warnings indicate pattern validation failures
   - Errors indicate template loading failures

3. **Verify parsing results:**
   - Check confidence level (high/medium/low)
   - Verify all expected fields are extracted
   - Test with multiple sample receipts

## Troubleshooting

### Template Not Loading

**Problem:** Custom template not being used

**Solutions:**
1. Verify `config.json` syntax is valid JSON
2. Check that `parsingTemplate` is at the root level
3. Ensure `total` field exists and is valid
4. Restart TabezaConnect service

### Low Confidence Parsing

**Problem:** Parsing returns low confidence results

**Solutions:**
1. Check that patterns match your receipt format exactly
2. Test patterns with actual receipt text
3. Verify capture groups are in correct order
4. Check for extra whitespace or formatting differences

### Items Not Extracting

**Problem:** Items array is empty

**Solutions:**
1. Verify `startMarker` matches your receipt header
2. Check `endMarker` matches your receipt separator
3. Ensure `pattern` has 3 capture groups (qty, name, price)
4. Test pattern against individual item lines
5. Check for correct spacing in pattern (e.g., `\\s{2,}` for 2+ spaces)

### Invalid Regex Errors

**Problem:** Console shows "Invalid regex pattern" errors

**Solutions:**
1. Check for unescaped special characters
2. Verify all parentheses are balanced
3. Test regex in an online regex tester first
4. Use double backslashes in JSON: `\\d` not `\d`

## Advanced Configuration

### Multiple Venue Support

Each venue can have its own template in its own `config.json`:

```
C:\Program Files\Tabeza\venue1\config.json  → Template A
C:\Program Files\Tabeza\venue2\config.json  → Template B
```

### Template Versioning

Keep backup templates for easy rollback:

```json
{
  "parsingTemplate": { ... },
  "parsingTemplateBackup": { ... }
}
```

### Dynamic Template Selection

For venues with multiple POS systems, you can:
1. Create multiple template configurations
2. Switch templates by editing `config.json`
3. Restart service to apply changes

## API Integration

### Using Templates in Code

```javascript
const { parseReceipt, loadTemplateFromConfig } = require('./lib/receiptParser');
const fs = require('fs');

// Load config
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// Load template from config
const template = loadTemplateFromConfig(config);

// Parse receipt
const result = parseReceipt(receiptText, template);

console.log('Confidence:', result.confidence);
console.log('Total:', result.total);
console.log('Items:', result.items.length);
```

### Template Object Structure

```javascript
{
  receiptNumber: 'regex string',
  timestamp: 'regex string',
  items: {
    pattern: 'regex string',
    multiline: boolean,
    startMarker: 'regex string',
    endMarker: 'regex string'
  },
  subtotal: 'regex string',
  tax: 'regex string',
  total: 'regex string'  // REQUIRED
}
```

## Support

For help with template configuration:

1. Check the test script output: `node test-template-loading.js`
2. Review console logs for validation errors
3. Test patterns with sample receipts
4. Contact Tabeza support with your receipt format

## Related Documentation

- [Receipt Parser Module](./lib/receiptParser.js)
- [Default Template Summary](./DEFAULT-TEMPLATE-SUMMARY.md)
- [Configuration Setup](./CONFIG-SETUP.md)
