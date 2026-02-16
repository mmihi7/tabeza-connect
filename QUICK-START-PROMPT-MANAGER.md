# Quick Start: Fix Notepad Receipt Parsing

## The Problem

You print a receipt from Notepad, but the AI doesn't extract the items correctly.

## The Solution (5 Minutes)

### 1. Start Services

```cmd
# Terminal 1: Start printer service
START-PRINTER-SERVICE-WORKING.bat

# Terminal 2: Start staff app
cd apps/staff
pnpm dev
```

### 2. Open Prompt Manager

```cmd
OPEN-PROMPT-MANAGER.bat
```

Or go to: `http://localhost:8765/prompt-manager.html`

### 3. Test Your Receipt

1. **Copy your Notepad receipt** (the one that's not parsing)
2. **Paste into "Test with Sample Receipt"** box
3. **Click "Test Prompt"**
4. **Look at results:**
   - ✅ Items extracted? Great! You're done.
   - ❌ No items? Continue to step 4.

### 4. Fix the Prompt

Edit the "System Prompt" to be more specific. Add this section:

```
IMPORTANT: For item lines in this format:
"QTY    ITEM_NAME                AMOUNT"
Example: "2    Tusker Lager 500ml       500.00"

Rules for parsing:
- First number is quantity
- Middle section is item name (may have multiple spaces)
- Last number is TOTAL price (qty × unit price)
- Format output as: "QTYx ITEM_NAME"

Example:
Input: "2    Tusker Lager 500ml       500.00"
Output: {"name": "2x Tusker Lager 500ml", "price": 500.00}
```

### 5. Test Again

Click "Test Prompt" again. Items should now be extracted!

### 6. Save

Click "Save Configuration" - this downloads `prompt-config.json`.

## Done! 🎉

Your receipts should now parse correctly. The AI has learned your format.

## What Just Happened?

1. You showed the AI your exact receipt format
2. You gave it specific instructions on how to parse it
3. The AI now understands your Notepad print format
4. Future receipts will parse correctly

## Next Steps

### For Production:

1. Test with more receipts from Notepad
2. Make sure all formats work
3. Save the working configuration
4. Deploy to production

### For Your Actual POS:

Once Notepad parsing works, configure your POS to:
- Print to file (not through Windows Print Dialog)
- Save to: `C:\Users\mwene\TabezaPrints`
- Format: Plain text (.txt)

See: `CONNECT-ACTUAL-POS-GUIDE.md`

## Troubleshooting

**"DEEPSEEK_API_KEY not configured"**
- Add API key to `apps/staff/.env.local`
- Get key from: https://platform.deepseek.com

**"Test failed - timeout"**
- Check internet connection
- Reduce max tokens to 1500
- Simplify the prompt

**Items still not extracted**
- Make prompt even more specific
- Add more examples
- Check receipt has clear structure
- Try lower temperature (0.1)

## Tips

- Start with the default prompt
- Only customize if needed
- Be very specific about your format
- Test with multiple receipts
- Save your working configuration

---

**Time to complete:** 5 minutes
**Difficulty:** Easy
**Result:** Working receipt parsing from Notepad
