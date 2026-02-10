/**
 * AI-Powered Receipt Parser
 * 
 * Uses DeepSeek API directly to parse receipt text into structured data
 * Falls back to regex parsing if DeepSeek is unavailable
 * 
 * Setup: Add DEEPSEEK_API_KEY to .env
 * Get your API key from https://platform.deepseek.com
 * 
 * Why DeepSeek?
 * - Direct API integration (no EC2 required)
 * - Cost-effective AI parsing
 * - 10-second timeout enforcement
 * - Structured JSON output
 * - Automatic fallback to regex
 */

import OpenAI from 'openai';

interface ParsedReceipt {
  items: Array<{ name: string; price: number }>;
  total: number;
  receiptNumber?: string;
  rawText: string;
}

/**
 * System prompt for DeepSeek receipt parsing
 */
const SYSTEM_PROMPT = `You are a receipt parser. Extract structured data from receipts and return valid JSON.

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

Example output:
{
  "items": [
    {"name": "Tusker Lager 500ml", "price": 250.00},
    {"name": "Nyama Choma", "price": 800.00}
  ],
  "total": 1050.00,
  "receiptNumber": "RCP-123456"
}`;

/**
 * Parse receipt using DeepSeek API
 */
async function parseWithDeepSeek(receiptText: string, barId: string, documentName?: string): Promise<ParsedReceipt | null> {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    
    if (!apiKey) {
      console.log('ℹ️  DEEPSEEK_API_KEY not set, using regex parser');
      return null;
    }
    
    // Initialize OpenAI client with DeepSeek endpoint
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com/v1'
    });
    
    // Create abort controller for 10-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await client.chat.completions.create({
        model: 'deepseek-chat',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: receiptText
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      }, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.warn('DeepSeek returned empty response, falling back to regex');
        return null;
      }

      const data = JSON.parse(content);
      
      if (!data || typeof data !== 'object') {
        console.warn('Invalid response from DeepSeek, falling back to regex');
        return null;
      }
      
      // Map DeepSeek response to our format
      const mapped = mapDeepSeekToParsedReceipt(data, receiptText);
      
      console.log('✅ AI parsed receipt (DeepSeek):', {
        itemCount: mapped.items?.length || 0,
        total: mapped.total,
        tokensUsed: response.usage?.total_tokens || 0,
        barId,
        documentName,
      });

      return mapped;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.warn('DeepSeek API timeout (10s), falling back to regex');
      } else if (error.status) {
        console.warn(`DeepSeek API error (${error.status}):`, error.message, 'falling back to regex');
      } else {
        console.warn('DeepSeek parsing failed, falling back to regex:', error.message);
      }
      return null;
    }
  } catch (error: any) {
    console.warn('DeepSeek parsing setup failed, falling back to regex:', error.message);
    return null;
  }
}

/**
 * Map DeepSeek response to our ParsedReceipt format with null guards
 */
function mapDeepSeekToParsedReceipt(deepseekResponse: any, rawText: string): ParsedReceipt {
  // Handle null/undefined response
  if (!deepseekResponse) {
    throw new Error('DeepSeek response is null or undefined');
  }
  
  // Extract items with null guard
  const items = Array.isArray(deepseekResponse.items) 
    ? deepseekResponse.items.map((item: any) => ({
        name: typeof item?.name === 'string' ? item.name : 'Unknown Item',
        price: typeof item?.price === 'number' ? item.price : 0,
      }))
    : [];
  
  // Extract total with null guard
  const total = typeof deepseekResponse.total === 'number' ? deepseekResponse.total : 0;
  
  // Extract receipt number with null guard
  const receiptNumber = typeof deepseekResponse.receiptNumber === 'string' 
    ? deepseekResponse.receiptNumber 
    : undefined;
  
  return {
    items,
    total,
    receiptNumber,
    rawText,
  };
}

/**
 * Fallback regex-based parser
 */
function parseWithRegex(receiptText: string): ParsedReceipt {
  const lines = receiptText.split('\n');
  const items: Array<{ name: string; price: number }> = [];
  let total = 0;
  let receiptNumber = '';
  let inItemsSection = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Extract receipt number
    if (trimmed.match(/receipt\s*#?:?\s*(\S+)/i)) {
      const match = trimmed.match(/receipt\s*#?:?\s*(\S+)/i);
      if (match) receiptNumber = match[1];
    }
    
    // Detect items section
    if (trimmed.match(/qty|quantity|item/i) && trimmed.match(/amount|price|total/i)) {
      inItemsSection = true;
      continue;
    }
    
    // End of items section
    if (inItemsSection && (trimmed.startsWith('---') || trimmed.match(/subtotal|tax|total/i))) {
      inItemsSection = false;
    }
    
    // Parse item lines - try multiple patterns
    if (inItemsSection && trimmed.length > 5) {
      // Pattern 1: "2    Tusker Lager 500ml       500.00"
      let match = trimmed.match(/^(\d+)\s+(.+?)\s+([\d,]+\.?\d+)$/);
      
      if (match) {
        const qty = parseInt(match[1]);
        const name = match[2].trim();
        const price = parseFloat(match[3].replace(/,/g, ''));
        
        items.push({
          name: `${qty}x ${name}`,
          price,
        });
        continue;
      }
      
      // Pattern 2: "Item Name    $10.00" or "Item Name    10.00"
      match = trimmed.match(/^(.+?)\s+\$?([\d,]+\.?\d+)$/);
      if (match && !match[1].match(/subtotal|tax|total|payment/i)) {
        items.push({
          name: match[1].trim(),
          price: parseFloat(match[2].replace(/,/g, '')),
        });
      }
    }
    
    // Extract total - look for "TOTAL:" or "Total:" anywhere
    if (trimmed.match(/total\s*:?\s*([\d,]+\.?\d+)/i)) {
      const match = trimmed.match(/total\s*:?\s*([\d,]+\.?\d+)/i);
      if (match) {
        total = parseFloat(match[1].replace(/,/g, ''));
      }
    }
  }
  
  return {
    items,
    total,
    receiptNumber,
    rawText: receiptText,
  };
}

/**
 * Main parsing function - tries DeepSeek first, falls back to regex
 */
export async function parseReceipt(receiptText: string, barId: string, documentName?: string): Promise<ParsedReceipt> {
  // Try DeepSeek parsing first
  const deepseekResult = await parseWithDeepSeek(receiptText, barId, documentName);
  if (deepseekResult && deepseekResult.total > 0) {
    return deepseekResult;
  }
  
  // Fall back to regex parsing
  console.log('📋 Using regex fallback parser');
  return parseWithRegex(receiptText);
}
