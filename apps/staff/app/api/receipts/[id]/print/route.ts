/**
 * POST /api/receipts/:id/print
 * 
 * Sends a receipt back to the default POS printer for non-Tabeza customers 
 * (walk-ins, cash customers, etc.).
 * 
 * This handles the dual workflow where:
 * - Tabeza customers → Receipt assigned to their tab (digital)
 * - Non-Tabeza customers → Receipt prints to default POS printer (physical)
 * 
 * Flow:
 * 1. Validate print job exists and hasn't been processed
 * 2. Send raw ESC/POS data back to default POS printer
 * 3. Mark print job status as 'processed' (no tab assignment)
 * 
 * Requirements: Dual workflow support - ALL POS receipts flow through Tabeza
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: receiptId } = await params;

    // Validate receipt ID
    if (!receiptId) {
      return NextResponse.json(
        { success: false, error: 'Receipt ID is required' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the print job
    const { data: printJob, error: fetchError } = await supabase
      .from('print_jobs')
      .select('*')
      .eq('id', receiptId)
      .single();

    if (fetchError || !printJob) {
      console.error('Error fetching print job:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Print job not found' },
        { status: 404 }
      );
    }

    // Validate print job hasn't been processed yet
    if (printJob.status === 'processed') {
      return NextResponse.json(
        { success: false, error: 'Print job already processed' },
        { status: 400 }
      );
    }

    // Send to physical printer via Tabeza Printer Service
    console.log('📄 Queuing receipt for physical printer:', {
      receiptId,
      total: printJob.parsed_data?.total,
      items: printJob.parsed_data?.items?.length
    });

    // Mark print job as pending_print (printer service will poll for it)
    const { error: updateError } = await supabase
      .from('print_jobs')
      .update({
        status: 'pending_print',
        pending_print_at: new Date().toISOString()
      })
      .eq('id', receiptId);

    if (updateError) {
      console.error('Error updating print job status:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to queue print job' },
        { status: 500 }
      );
    }

    console.log('✅ Print job queued - printer service will pick it up within 5 seconds');

    return NextResponse.json({
      success: true,
      message: 'Receipt queued for printing - will print within 5 seconds',
      receiptId
    });
  } catch (error) {
    console.error('Unhandled error in print endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
