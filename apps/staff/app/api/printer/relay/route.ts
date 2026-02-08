/**
 * Printer Relay API
 * 
 * Receives ESC/POS receipt data from virtual printer drivers
 * Parses, stores, and delivers receipts to customers
 * 
 * CORE TRUTH: This is the bridge between POS systems and Tabeza
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

interface PrintJobPayload {
  driverId: string;           // Unique driver installation ID
  barId: string;              // Venue ID
  timestamp: string;          // When print job was captured
  rawData: string;            // Base64 encoded ESC/POS data
  printerName: string;        // System printer name
  documentName?: string;      // Document name from print job
  metadata?: {
    posSystem?: string;       // Detected POS system
    jobId?: string;           // Driver-side job ID
    pageCount?: number;       // Number of pages
  };
}

interface ParsedReceipt {
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  tax?: number;
  total: number;
  receiptNumber?: string;
  timestamp?: string;
  paymentMethod?: string;
  rawText: string;
}

/**
 * OPTIONS /api/printer/relay
 * 
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * POST /api/printer/relay
 * 
 * Receives print jobs from virtual printer drivers
 */
export async function POST(request: NextRequest) {
  try {
    const payload: PrintJobPayload = await request.json();

    // Validate payload
    if (!payload.driverId || !payload.barId || !payload.rawData) {
      return NextResponse.json(
        { error: 'Missing required fields: driverId, barId, rawData' },
        { status: 400 }
      );
    }

    // Verify bar exists and has POS authority
    const { data: bar, error: barError } = await supabase
      .from('bars')
      .select('id, name, authority_mode, printer_required')
      .eq('id', payload.barId)
      .single();

    if (barError || !bar) {
      return NextResponse.json(
        { error: 'Invalid bar ID' },
        { status: 404 }
      );
    }

    if (bar.authority_mode !== 'pos') {
      return NextResponse.json(
        { error: 'Bar is not configured for POS authority' },
        { status: 403 }
      );
    }

    // Decode ESC/POS data
    const escposData = Buffer.from(payload.rawData, 'base64');

    // Parse receipt (basic implementation - will be enhanced)
    const parsedReceipt = await parseESCPOSReceipt(escposData);

    // Store raw print job
    const { data: printJob, error: printJobError } = await supabase
      .from('print_jobs')
      .insert({
        bar_id: payload.barId,
        driver_id: payload.driverId,
        raw_data: payload.rawData,
        parsed_data: parsedReceipt,
        printer_name: payload.printerName,
        document_name: payload.documentName,
        metadata: payload.metadata,
        status: 'received',
        received_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (printJobError) {
      console.error('Failed to store print job:', printJobError);
      return NextResponse.json(
        { error: 'Failed to store print job' },
        { status: 500 }
      );
    }

    // Process receipt asynchronously
    // This will match receipt to tab and deliver to customer
    processReceiptAsync(printJob.id, payload.barId, parsedReceipt);

    return NextResponse.json({
      success: true,
      jobId: printJob.id,
      message: 'Print job received and queued for processing',
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Printer relay error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

/**
 * Parse ESC/POS receipt data
 * 
 * This is a basic implementation that extracts text from ESC/POS commands
 * Will be enhanced with AI parser in future
 */
async function parseESCPOSReceipt(data: Buffer): Promise<ParsedReceipt> {
  // Convert ESC/POS to text (basic implementation)
  // Remove ESC/POS control codes and extract printable text
  let text = '';
  
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    
    // Skip ESC sequences
    if (byte === 0x1B) { // ESC
      i++; // Skip next byte (command)
      continue;
    }
    
    // Skip other control codes
    if (byte < 0x20 && byte !== 0x0A && byte !== 0x0D) {
      continue;
    }
    
    // Add printable characters
    if (byte >= 0x20 && byte <= 0x7E) {
      text += String.fromCharCode(byte);
    } else if (byte === 0x0A) {
      text += '\n';
    }
  }

  // Basic parsing - extract items and totals
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  const items: ParsedReceipt['items'] = [];
  let subtotal = 0;
  let total = 0;
  let receiptNumber: string | undefined;

  // Simple pattern matching (will be enhanced with AI)
  for (const line of lines) {
    // Look for receipt number
    if (line.match(/receipt|invoice|#/i)) {
      const match = line.match(/\d{4,}/);
      if (match) receiptNumber = match[0];
    }

    // Look for item lines (name + price)
    const itemMatch = line.match(/^(.+?)\s+(\d+\.?\d*)\s*$/);
    if (itemMatch) {
      const [, name, priceStr] = itemMatch;
      const price = parseFloat(priceStr);
      items.push({
        name: name.trim(),
        quantity: 1,
        price,
        total: price,
      });
    }

    // Look for total
    if (line.match(/total/i)) {
      const match = line.match(/(\d+\.?\d*)/);
      if (match) total = parseFloat(match[1]);
    }
  }

  subtotal = items.reduce((sum, item) => sum + item.total, 0);
  if (total === 0) total = subtotal;

  return {
    items,
    subtotal,
    total,
    receiptNumber,
    rawText: text,
  };
}

/**
 * Process receipt asynchronously
 * 
 * Stores receipt as unmatched - staff will manually select tab
 * CORE TRUTH: We can't assume anything about POS receipts
 * Staff knows which customer ordered what - let them decide
 */
async function processReceiptAsync(
  printJobId: string,
  barId: string,
  receipt: ParsedReceipt
) {
  try {
    // Store as unmatched - waiting for staff to select tab
    await supabase
      .from('print_jobs')
      .update({ 
        status: 'no_match',
        processed_at: new Date().toISOString(),
      })
      .eq('id', printJobId);

    console.log(`Receipt stored as unmatched - waiting for staff selection`);

  } catch (error) {
    console.error('Receipt processing error:', error);
    await supabase
      .from('print_jobs')
      .update({ 
        status: 'error',
        processed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', printJobId);
  }
}

/**
 * GET /api/printer/relay/status
 * 
 * Check relay service status
 */
export async function GET() {
  return NextResponse.json({
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  });
}
