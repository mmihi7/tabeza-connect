# Test Receipts

This directory contains sample receipt files for testing the Receipt Parser's default template.

## Files

### tusker-test-receipt.txt
**Purpose**: Primary test receipt for validating the default parsing template

**Format**: Standard POS receipt with all fields
- Receipt number: RCP-2024-001234
- Timestamp: 12/15/2024 8:45:30 PM
- Items: 5 items with quantity, name, and price
- Subtotal: 2,210.00
- Tax (VAT 16%): 353.60
- Total: 2,563.60

**Expected Parsing Result**: High confidence with all fields extracted

### minimal-receipt.txt
**Purpose**: Test minimal receipt format (no structured headers)

**Format**: Simple receipt with basic information
- Timestamp only
- Items without table structure
- Total only (no subtotal or tax)

**Expected Parsing Result**: Medium or low confidence (partial extraction)

### captain-orders-receipt.txt
**Purpose**: Test alternative POS format

**Format**: Similar structure to tusker-test-receipt but with variations
- Different receipt number format (CO-789456)
- Different items
- Tax without percentage in label

**Expected Parsing Result**: High confidence with all fields extracted

### malformed-receipt.txt
**Purpose**: Test parser resilience with invalid data

**Format**: Receipt with intentional formatting errors
- Invalid price formats (text instead of numbers)
- Missing prices
- Empty total field
- Malformed structure

**Expected Parsing Result**: Low confidence with minimal or no extraction (parser should not throw errors)

### empty-receipt.txt
**Purpose**: Test parser behavior with empty input

**Format**: Empty file (no content)

**Expected Parsing Result**: Low confidence with empty fields (parser should not throw errors)

## Testing

Run the default template validation test:

```bash
node test-default-template.js
```

This will:
1. Load the tusker-test-receipt.txt
2. Parse it using the DEFAULT_TEMPLATE
3. Validate all extracted fields
4. Test the formatReceipt function
5. Report pass/fail results

## Default Template Patterns

The default template supports:

### Receipt Number
- Matches: "Receipt #: RCP-2024-001234", "Receipt: 12345"
- Pattern: `Receipt\s*#?:?\s*(\S+)`

### Timestamp
- Matches: "12/15/2024 8:45:30 PM", "1/5/2024 14:30"
- Pattern: `(\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)`

### Items
- Matches lines like: "2    Tusker Lager 500ml         500.00"
- Pattern: `^(\d+)\s+(.+?)\s{2,}(\d+(?:,\d{3})*\.?\d{2})\s*$`
- Requires: Start marker "QTY  ITEM  AMOUNT"
- Stops at: Separator lines (---) or "Subtotal"/"Total"

### Subtotal
- Matches: "Subtotal: 2,210.00", "Subtotal 2210.00"
- Pattern: `Subtotal:?\s*(\d+(?:,\d{3})*\.?\d{2})`

### Tax
- Matches: "VAT (16%): 353.60", "Tax: 353.60", "VAT: 353.60"
- Pattern: `(?:VAT|Tax)(?:\s*\(\d+%\))?:?\s*(\d+(?:,\d{3})*\.?\d{2})`

### Total
- Matches: "TOTAL: 2,563.60" (case insensitive, at start of line)
- Pattern: `^\s*TOTAL:?\s*(\d+(?:,\d{3})*\.?\d{2})`

## Adding New Test Receipts

When adding new test receipts:

1. Create a `.txt` file in this directory
2. Use realistic POS receipt format
3. Include various field combinations to test edge cases
4. Document the expected parsing result
5. Update this README with the new file

## Notes

- All patterns support comma-separated numbers (e.g., 2,210.00)
- Item extraction requires at least 2 spaces before the price
- The parser implements a never-reject guarantee (always returns valid result)
- Parsing failures result in low confidence data, not errors
