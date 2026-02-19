/**
 * POS Receipt Ingestion API
 * 
 * Accepts raw receipt data from TabezaConnect Capture Service and saves to database.
 * This endpoint is designed for high-throughput, low-latency ingestion.
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 * 
 * Requirements:
 * - 7.1: Provide POST /api/receipts/ingest endpoint
 * - 7.2: Save receipt to raw_pos_receipts table immediately
 * - 7.3: Return success response within 100ms
 * - 7.5: Never parse receipts inline during ingestion (async only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Initialize Supabase client with service role key for server-side operations
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

/**
 * Ingestion Request Interface
 */
interface IngestRequest {
  barId: string;
  deviceId: string;
  timestamp: string;
  escposBytes?: string; // base64 encoded ESC/POS data (optional)
  text: string;
  metadata?: {
    jobId?: string;
    source?: 'spool-monitor' | 'manual';
    fileSize?: number;
    printerName?: string;
  };
}

/**
 * Ingestion Response Interface
 */
interface IngestResponse {
  success: boolean;
  receiptId?: string;
  queuedForParsing?: boolean;
  error?: string;
}

/**
 * POST /api/receipts/ingest
 * 
 * Accepts raw receipt data from TabezaConnect and saves to database.
 * Returns immediately without parsing (parsing happens asynchronously).
 * 
 * @param req - Next.js request with receipt data
 * @returns Success response with receipt ID
 */
export async function POST(req: NextRequest): Promise<NextResponse<IngestResponse>> {
  const startTime = Date.now();

  try {
    // Parse request body
    const body: IngestRequest = await req.json();

    // Validate required fields (Requirement 7.1)
    if (!body.barId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: barId',
        },
        { status: 400 }
      );
    }

    if (!body.text) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: text',
        },
        { status: 400 }
      );
    }

    if (!body.deviceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: deviceId',
        },
        { status: 400 }
      );
    }

    if (!body.timestamp) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: timestamp',
        },
        { status: 400 }
      );
    }

    // Verify bar exists
    const { data: bar, error: barError } = await supabase
      .from('bars')
      .select('id')
      .eq('id', body.barId)
      .single();

    if (barError || !bar) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid barId: bar not found',
        },
        { status: 400 }
      );
    }

    // Save to raw_pos_receipts table (Requirement 7.2)
    // This is immutable storage - never modified after insert
    const { data: receipt, error: insertError } = await supabase
      .from('raw_pos_receipts')
      .insert({
        bar_id: body.barId,
        device_id: body.deviceId,
        timestamp: body.timestamp,
        escpos_bytes: body.escposBytes || null,
        text: body.text,
        metadata: body.metadata || {},
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to insert raw receipt:', insertError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to save receipt',
        },
        { status: 500 }
      );
    }

    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Log performance (should be < 100ms per Requirement 7.3)
    if (responseTime > 100) {
      console.warn(`Ingestion took ${responseTime}ms (target: <100ms)`);
    }

    // Return success immediately (Requirement 7.3)
    // Parsing will happen asynchronously via database trigger (Requirement 7.5)
    return NextResponse.json(
      {
        success: true,
        receiptId: receipt.id,
        queuedForParsing: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Ingestion error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
