/**
 * Printer Relay API
 *
 * Receives print data from TabezaConnect and stores it in print_jobs table.
 * Records appear in Captain's Orders for staff to assign to customer tabs.
 *
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 *
 * FOUNDATIONAL RULE: Never reject a receipt. Always accept, always store.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';

interface PrintJobPayload {
  driverId?: string;
  barId: string;
  timestamp?: string;
  parsedData?: {
    items: Array<{ name: string; quantity?: number; price?: number }>;
    total: number;
    receiptNumber?: string;
    rawText?: string;
    confidence?: 'high' | 'medium' | 'low';
  };
  rawData?: string; // base64 encoded ESC/POS bytes (optional)
  printerName?: string;
  documentName?: string;
  metadata?: Record<string, any>;
}

function isValidBase64(str: string): boolean {
  return /^[A-Za-z0-9+/]*={0,2}$/.test(str);
}

export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json(
      { success: false, error: 'Service configuration error' },
      { status: 503 }
    );
  }

  const supabase = createServiceRoleClient();
  let body: PrintJobPayload = {} as PrintJobPayload;

  try {
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const { driverId, barId, timestamp, rawData, printerName, documentName, metadata, parsedData } = body;

    if (!barId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: barId' },
        { status: 400 }
      );
    }

    if (!parsedData && !rawData) {
      return NextResponse.json(
        { success: false, error: 'Either parsedData or rawData must be provided' },
        { status: 400 }
      );
    }

    if (rawData && !isValidBase64(rawData)) {
      return NextResponse.json(
        { success: false, error: 'Invalid base64 data format' },
        { status: 400 }
      );
    }

    // Determine final parsed data and confidence
    let finalParsedData: any = null;
    let parsingConfidence: 'low' | 'medium' | 'high' = 'low';
    let parsingMethod: 'local' | 'cloud' = 'cloud';

    if (parsedData && typeof parsedData === 'object') {
      finalParsedData = parsedData;
      parsingMethod = 'local';

      if (parsedData.confidence && ['high', 'medium', 'low'].includes(parsedData.confidence)) {
        parsingConfidence = parsedData.confidence;
      } else {
        const hasItems = Array.isArray(parsedData.items) && parsedData.items.length > 0;
        const hasTotal = typeof parsedData.total === 'number' && parsedData.total > 0;
        parsingConfidence = hasItems && hasTotal ? 'high' : hasTotal || hasItems ? 'medium' : 'low';
      }

      console.log('✅ Using parsed data from printer service:', {
        itemCount: finalParsedData.items?.length || 0,
        total: finalParsedData.total || 0,
        confidence: parsingConfidence,
      });
    } else if (rawData) {
      // Decode base64 and store raw text
      try {
        const rawText = Buffer.from(rawData, 'base64').toString('utf-8');
        finalParsedData = { items: [], total: 0, rawText };
      } catch {
        finalParsedData = { items: [], total: 0, rawText: 'Failed to decode' };
      }
    }

    // FOUNDATIONAL RULE: Always store, never reject
    const printJobData = {
      bar_id: barId,
      driver_id: driverId || 'unknown',
      raw_data: rawData || null,
      parsed_data: finalParsedData,
      printer_name: printerName || 'Unknown Printer',
      document_name: documentName || 'Receipt',
      metadata: {
        ...metadata,
        parsing_confidence: parsingConfidence,
        parsing_method: parsingMethod,
      },
      status: 'no_match', // Appears in Captain's Orders
      received_at: timestamp || new Date().toISOString(),
    };

    const { data: printJob, error: insertError } = await supabase
      .from('print_jobs')
      .insert(printJobData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ [Database Insert Error]', insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    console.log('✅ Print job created:', printJob?.id);

    return NextResponse.json({
      success: true,
      jobId: printJob?.id,
      message: 'Print job received and queued for assignment',
    });

  } catch (error) {
    console.error('❌ [Relay Error]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to process print job' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
