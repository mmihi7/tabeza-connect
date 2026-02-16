import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * GET /api/settings/receipt-parser
 * Load current receipt parser configuration
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's bar
    const { data: userBar } = await supabase
      .from('user_bars')
      .select('bar_id')
      .eq('user_id', user.id)
      .single();

    if (!userBar) {
      return NextResponse.json({ error: 'No bar found' }, { status: 404 });
    }

    // Get parser config from database
    const { data: config } = await supabase
      .from('receipt_parser_config')
      .select('*')
      .eq('bar_id', userBar.bar_id)
      .single();

    if (!config) {
      // Return default config
      return NextResponse.json({
        config: {
          systemPrompt: getDefaultPrompt(),
          temperature: 0.1,
          maxTokens: 2000,
        },
      });
    }

    return NextResponse.json({
      config: {
        systemPrompt: config.system_prompt,
        temperature: config.temperature,
        maxTokens: config.max_tokens,
      },
    });
  } catch (error: any) {
    console.error('Failed to load parser config:', error);
    return NextResponse.json(
      { error: 'Failed to load configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/receipt-parser
 * Save receipt parser configuration
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's bar
    const { data: userBar } = await supabase
      .from('user_bars')
      .select('bar_id')
      .eq('user_id', user.id)
      .single();

    if (!userBar) {
      return NextResponse.json({ error: 'No bar found' }, { status: 404 });
    }

    const body = await request.json();
    const { config } = body;

    if (!config || !config.systemPrompt) {
      return NextResponse.json(
        { error: 'Invalid configuration' },
        { status: 400 }
      );
    }

    // Upsert config
    const { error: upsertError } = await supabase
      .from('receipt_parser_config')
      .upsert({
        bar_id: userBar.bar_id,
        system_prompt: config.systemPrompt,
        temperature: config.temperature || 0.1,
        max_tokens: config.maxTokens || 2000,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'bar_id',
      });

    if (upsertError) {
      throw upsertError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to save parser config:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

function getDefaultPrompt(): string {
  return `You are a receipt parser. Extract structured data from receipts and return valid JSON.

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
}
