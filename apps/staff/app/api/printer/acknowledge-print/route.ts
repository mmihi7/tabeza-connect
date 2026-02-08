/**
 * POST /api/printer/acknowledge-print
 * 
 * Acknowledges that a print job was successfully printed.
 * Called by Printer Service after saving print to output folder.
 * 
 * Body:
 * - printId: The print job ID
 * - driverId: The printer service's unique driver ID
 * 
 * Marks print job as 'processed'
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { printId, driverId } = body;

    if (!printId || !driverId) {
      return NextResponse.json(
        { success: false, error: 'printId and driverId are required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Mark print job as processed
    const { error } = await supabase
      .from('print_jobs')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', printId);

    if (error) {
      console.error('Error acknowledging print:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to acknowledge print' },
        { status: 500 }
      );
    }

    console.log(`✅ Print job ${printId} acknowledged by driver ${driverId}`);

    return NextResponse.json({
      success: true,
      message: 'Print acknowledged',
      printId,
    });
  } catch (error) {
    console.error('Unhandled error in acknowledge-print endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
