# Receipt Parser Prompt Manager Guide

## What Is This?

A system-level tool to configure and test DeepSeek AI prompts for receipt parsing. This is a **global configuration** that affects all receipt parsing across the system.

## Why You Need This

When printing receipts from Notepad (or any source), the format might not parse correctly. This tool lets you:

1. **Customize the AI prompt** to understand your specific receipt format
2. **Test prompts** with real receipts before deploying
3. **Tune AI parameters** (temperature, tokens) for better results
4. **See parsing results** in real-time

## Quick Start

### Step 1: Start the Printer Service

```cmd
START-PRINTER-SERVICE-WORKING.bat
```

Make sure it's running and showing your Bar ID.

### Step 2: Open the Prompt Manager

```cmd
OPEN-PROMPT-MANAGER.bat
```

This opens the prompt manager at: `http://localhost:8765/prompt-manager.html`

### Step 3: Test Your Receipt Format

1. Copy a receipt from Notepad (or your POS)
2. Paste it into the "Test with Sample Receipt" box
3. Click "Test Prompt"
4. See if items are extracted correctly

### Step 4: Adjust the Prompt

If items aren't extracted:

1. Edit the "System Prompt" to be more specific
2. Add examples of your exact format
3. Test again
4. Repeat until it works

### Step 5: Save Configuration

Click "Save Configuration" - this downloads a `prompt-config.json` file.

## Understanding the Interface

### Left Side: Configuration

**System Prompt**
- Instructions for the AI
- Be specific about your receipt format
- Include examples of expected output

**Temperature** (0.0 - 1.0)
- Lower (0.1) = Consistent, predictable
- Higher (0.8) = Creative, varied
- Recommended: 0.1 for receipts

**Max Tokens**
- Maximum response length
- Higher = more cost
- Recommended: 2000

### Right Side: Testing

**Sample Receipt**
- Paste your actual receipt here
- Use real receipts from your POS/Notepad

**Test Results**
- Shows extracted items
- Shows total amount
- Shows parse time
- Shows tokens used

## Example: Fixing Notepad Print Format

### Problem

Your Notepad receipt looks like:
```
2    Tusker Lager 500ml       500.00
1    Nyama Choma (Half Kg)    800.00
```

But AI returns `"items": []` (no items extracted).

### Solution

Update the system prompt to be more specific:

```
You are a receipt parser. Extract structured data from receipts and return valid JSON.

Extract:
- items: Array of {name: string, price: number}
- total: number (total amount)
- receiptNumber: string (if present)

Rules:
- Return ONLY valid JSON
- Use exact field names
- Convert all prices to numbers
- Handle missing data gracefully
- Ignore non-item lines (headers, footers, etc.)

IMPORTANT: For item lines in this format:
"QTY    ITEM_NAME                AMOUNT"
Example: "2    Tusker Lager 500ml       500.00"

Extract:
- Quantity from first column
- Item name from middle (may have multiple spaces)
- TOTAL price from last column (this is qty × unit price)

Format item name as: "QTYx ITEM_NAME"
Example: "2x Tusker Lager 500ml"

Example output:
{
  "items": [
    {"name": "2x Tusker Lager 500ml", "price": 500.00},
    {"name": "1x Nyama Choma (Half Kg)", "price": 800.00}
  ],
  "total": 1300.00,
  "receiptNumber": "RCP-123456"
}
```

### Test It

1. Paste your Notepad receipt
2. Click "Test Prompt"
3. Verify items are extracted correctly
4. Save configuration

## Advanced Tips

### Tip 1: Be Specific About Spacing

If your receipts have specific spacing patterns, mention them:

```
Items are formatted with:
- 1-2 digits for quantity
- 4+ spaces
- Item name (variable length)
- 2+ spaces
- Price with 2 decimals
```

### Tip 2: Handle Edge Cases

Tell the AI what to ignore:

```
Ignore lines containing:
- "Subtotal"
- "VAT"
- "Payment Method"
- "Thank you"
- Lines with only dashes or equals signs
```

### Tip 3: Specify Number Formats

If your receipts use commas or different formats:

```
Prices may be formatted as:
- "1,234.56" (with comma thousands separator)
- "1234.56" (no separator)
- "Kes 1234.56" (with currency prefix)

Always extract as a number without currency symbols.
```

### Tip 4: Test Multiple Receipts

Test with different receipt types:
- Short receipts (1-2 items)
- Long receipts (10+ items)
- Receipts with special characters
- Receipts with discounts/taxes

## Troubleshooting

### Issue: "DEEPSEEK_API_KEY not configured"

**Solution:** Add DeepSeek API key to your environment:

1. Get API key from https://platform.deepseek.com
2. Add to `apps/staff/.env.local`:
   ```
   DEEPSEEK_API_KEY=your_key_here
   ```
3. Restart the staff app

### Issue: "Test failed - timeout"

**Solution:** 
- Reduce max tokens (try 1500)
- Simplify the prompt
- Check internet connection

### Issue: Items extracted but prices wrong

**Solution:**
- Check if AI is extracting unit price vs total price
- Specify in prompt: "Extract the TOTAL price for the line (qty × unit price)"
- Add example showing the difference

### Issue: Some items missing

**Solution:**
- Check if item names have special characters
- Look for patterns in missing items
- Add specific instructions for those patterns

## Production Deployment

Once you have a working prompt:

1. **Save the configuration** (downloads `prompt-config.json`)
2. **Copy to printer service**:
   ```cmd
   copy prompt-config.json packages\printer-service\prompt-config.json
   ```
3. **Update the parser** to load this config
4. **Test with real POS receipts**
5. **Monitor parsing success rate**

## Future: Caching System

The plan is to implement automatic caching:

1. **First receipt** → AI learns format → Cache regex patterns
2. **Subsequent receipts** → Use cached patterns → Fast parsing
3. **New format** → AI learns again → Update cache

This prompt manager helps you tune the AI for that first learning step.

## System Architecture

```
Notepad Print → Watch Folder → Printer Service → Cloud API
                                                      ↓
                                                 DeepSeek AI
                                                 (uses your prompt)
                                                      ↓
                                                 Parse Receipt
                                                      ↓
                                                 Store in DB
                                                      ↓
                                                 Staff App
```

Your custom prompt affects the "DeepSeek AI" step.

## Best Practices

1. **Start with default prompt** - Only customize if needed
2. **Test with real receipts** - Don't use fake data
3. **Be specific** - More detail = better results
4. **Keep temperature low** - 0.1 for consistency
5. **Save your work** - Download config after testing
6. **Document changes** - Note what you changed and why

## Support

If you're stuck:

1. Check the test results for clues
2. Try the default prompt first
3. Test with a simple receipt (2-3 items)
4. Gradually add complexity
5. Check DeepSeek API logs in Vercel

---

**Remember:** This is a system-level tool. Changes affect ALL receipt parsing. Test thoroughly before deploying to production!
