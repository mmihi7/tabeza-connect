# Receipt Parser Caching System

## Current Problem

When printing from Notepad, the receipt text is clean but:
- DeepSeek AI returns `"items": []` (fails to extract items)
- Regex fallback also fails to extract items
- Only the total is extracted

## Your Smart Architecture

### Phase 1: AI Learning (First Receipt)
1. User prints first receipt from Notepad
2. Receipt sent to DeepSeek AI
3. AI analyzes format and extracts:
   - Items with prices
   - Total
   - Receipt structure
4. **Generate regex patterns** from AI's understanding
5. **Cache patterns** in database per bar_id

### Phase 2: Fast Parsing (Subsequent Receipts)
1. User prints another receipt
2. Check cache for this bar's patterns
3. Apply cached regex patterns
4. Parse instantly (no AI call needed)
5. If parsing fails → Fall back to AI

### Phase 3: Format Detection
1. If cached patterns fail
2. Detect it's a new format
3. Send to AI again
4. Update cache with new patterns

## Implementation Plan

### Database Schema

```sql
CREATE TABLE receipt_parsing_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bar_id UUID NOT NULL REFERENCES bars(id),
  format_name TEXT NOT NULL, -- e.g., "notepad-print", "pos-system-1"
  regex_patterns JSONB NOT NULL, -- Cached regex patterns
  sample_receipt TEXT, -- Example receipt for this format
  success_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(bar_id, format_name)
);
```

### Regex Pattern Structure

```json
{
  "itemPattern": "^(\\d+)\\s+(.+?)\\s+([\\d,]+\\.?\\d*)$",
  "totalPattern": "TOTAL:\\s*([\\d,]+\\.?\\d+)",
  "receiptNumberPattern": "Receipt #:\\s*(\\S+)",
  "itemsSectionStart": "QTY\\s+ITEM\\s+AMOUNT",
  "itemsSectionEnd": "---",
  "confidence": 0.95
}
```

### Parser Flow

```typescript
async function parseReceipt(text: string, barId: string) {
  // 1. Try cached patterns first
  const cached = await getCachedPatterns(barId);
  if (cached) {
    const result = parseWithCachedPatterns(text, cached);
    if (result.items.length > 0) {
      await updateCacheStats(cached.id); // Track success
      return result;
    }
  }
  
  // 2. Fall back to AI
  const aiResult = await parseWithDeepSeek(text, barId);
  if (aiResult.items.length > 0) {
    // 3. Generate and cache patterns from AI result
    const patterns = generatePatternsFromAI(text, aiResult);
    await cachePatterns(barId, patterns, text);
    return aiResult;
  }
  
  // 4. Last resort: generic regex
  return parseWithRegex(text);
}
```

## Benefits

1. **Fast**: Cached regex is instant (no AI latency)
2. **Cost-effective**: Only use AI once per format
3. **Reliable**: AI learns the exact format
4. **Adaptive**: Handles multiple receipt formats per bar
5. **Fallback**: Always has AI as backup

## Next Steps

1. Create database migration for `receipt_parsing_cache` table
2. Implement pattern generation from AI results
3. Implement cached pattern matching
4. Add format detection logic
5. Test with Notepad-printed receipts

## Why This Solves Your Problem

**Current**: Notepad print → AI fails → Regex fails → No items extracted

**With Caching**: 
- First time: Notepad print → AI learns → Cache patterns → Items extracted
- Next time: Notepad print → Use cache → Items extracted instantly

The AI will learn that your Notepad format has items like:
```
2    Tusker Lager 500ml       500.00
```

And generate a regex pattern that matches this exact format.
