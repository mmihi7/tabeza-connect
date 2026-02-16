import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

/**
 * POST /api/test-receipt-parser
 * Test receipt parsing with custom prompt
 * 
 * This is a system-level testing endpoint
 * No authentication required - for development/testing only
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { receiptText, config } = body;

    if (!receiptText) {
      return NextResponse.json(
        { error: 'Receipt text is required' },
        { status: 400 }
      );
    }

    if (!config || !config.systemPrompt) {
      return NextResponse.json(
        { error: 'Configuration is required' },
        { status: 400 }
      );
    }

    // Check for DeepSeek API key
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'DEEPSEEK_API_KEY not configured' },
        { status: 500 }
      );
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
            content: config.systemPrompt
          },
          {
            role: 'user',
            content: receiptText
          }
        ],
        temperature: config.temperature || 0.1,
        max_tokens: config.maxTokens || 2000
      }, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return NextResponse.json(
          { error: 'DeepSeek returned empty response' },
          { status: 500 }
        );
      }

      const data = JSON.parse(content);

      if (!data || typeof data !== 'object') {
        return NextResponse.json(
          { error: 'Invalid response from DeepSeek' },
          { status: 500 }
        );
      }

      // Map response to standard format
      const result = {
        items: Array.isArray(data.items) 
          ? data.items.map((item: any) => ({
              name: typeof item?.name === 'string' ? item.name : 'Unknown Item',
              price: typeof item?.price === 'number' ? item.price : 0,
            }))
          : [],
        total: typeof data.total === 'number' ? data.total : 0,
        receiptNumber: typeof data.receiptNumber === 'string' ? data.receiptNumber : undefined,
        tokensUsed: response.usage?.total_tokens || 0,
      };

      return NextResponse.json(result);
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'DeepSeek API timeout (10s)' },
          { status: 408 }
        );
      }

      if (error.status) {
        return NextResponse.json(
          { error: `DeepSeek API error (${error.status}): ${error.message}` },
          { status: error.status }
        );
      }

      throw error;
    }
  } catch (error: any) {
    console.error('Test receipt parser error:', error);
    return NextResponse.json(
      { error: error.message || 'Test failed' },
      { status: 500 }
    );
  }
}
