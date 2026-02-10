# DeepSeek AI Receipt Parser - Setup Guide

## ✅ What's Been Done

1. **Environment files updated** - Added `DEEPSEEK_API_KEY` to `.env.example` and `.env.local`
2. **Receipt parser migrated** - Uses DeepSeek API directly via OpenAI SDK
3. **OpenAI SDK integration** - Standard OpenAI-compatible client with DeepSeek endpoint
4. **Timeout handling** - 10-second timeout with automatic regex fallback

## 🔑 How to Add Your API Key

### Step 1: Open `.env.local`
```bash
# Open in your editor
code Tabz/.env.local
```

### Step 2: Replace the placeholder
Find this line:
```bash
DEEPSEEK_API_KEY=your-deepseek-api-key-here
```

Replace `your-deepseek-api-key-here` with your actual DeepSeek API key.

### Step 3: Save the file
That's it! The receipt parser will automatically use DeepSeek.

## 🧪 Test the Integration

Run the test script to verify it works:

```bash
cd packages/shared
pnpm test receiptParser.test.ts
```

Or test with a sample receipt:

```bash
node dev-tools/scripts/test-deepseek-parsing.js
```

## 💰 Cost Breakdown

**Your free tier:**
- 5 million tokens FREE on signup
- No credit card required
- Covers ~7,000 receipts

**After free tier:**
- Input: $0.27 per 1M tokens
- Output: $1.10 per 1M tokens
- **95% cheaper than GPT-4!**

**Example costs for 1000 receipts/day:**
- Daily: ~$0.35
- Monthly: ~$10.50
- First month: **FREE** (uses your 5M token allowance)

## 🎯 Why DeepSeek?

✅ **5M free tokens** - No credit card needed  
✅ **95% cheaper** - $0.27/1M vs GPT-4's $2.50/1M  
✅ **90% caching savings** - Repeated prompts cost 90% less  
✅ **OpenAI SDK compatible** - Uses standard OpenAI client library  
✅ **JSON mode** - Forces valid JSON output (no parsing errors)  
✅ **10-second timeout** - Fast fallback to regex if API is slow  

## 🔄 Fallback Behavior

If DeepSeek is unavailable or the API key is missing:
- ✅ Automatically falls back to regex parsing
- ✅ No errors or crashes
- ✅ Still extracts basic receipt data
- ✅ 10-second timeout ensures fast fallback

The system uses the OpenAI SDK with DeepSeek's endpoint (`https://api.deepseek.com/v1`) and the `deepseek-chat` model.

## 🔧 Technical Implementation

The receipt parser uses the OpenAI SDK configured for DeepSeek:

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1'
});

const response = await client.chat.completions.create({
  model: 'deepseek-chat',
  response_format: { type: 'json_object' },
  messages: [/* ... */],
  temperature: 0.1,
  max_tokens: 2000
});
```

This approach makes it easy to switch to other OpenAI-compatible providers if needed.

## 📊 Monitoring Usage

Check your token usage at: https://platform.deepseek.com/usage

The parser logs token usage in console:
```
✅ AI parsed receipt (DeepSeek): { itemCount: 5, total: 1250, tokensUsed: 342 }
```

## 🚀 Next Steps

1. **Add your API key** to `.env.local`
2. **Test with real receipts** using the test script
3. **Monitor usage** in the first week
4. **Optimize prompts** if needed to reduce token usage

## 🆘 Troubleshooting

**"DEEPSEEK_API_KEY not set"**
- Check `.env.local` has the key
- Restart your dev server after adding the key

**"DeepSeek API error: 401"**
- Your API key is invalid
- Get a new key from https://platform.deepseek.com

**"No response from DeepSeek"**
- Check your internet connection
- Verify the API is not rate-limited
- Parser will automatically use regex fallback

## 📚 Resources

- DeepSeek Platform: https://platform.deepseek.com
- API Docs: https://api-docs.deepseek.com
- Discord Support: https://discord.gg/Tc7c45Zzu5
