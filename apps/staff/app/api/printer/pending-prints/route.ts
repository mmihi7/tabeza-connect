/**
 * GET /api/printer/pending-prints
 * 
 * Returns print jobs that need to be sent to physical printer.
 * Called by Printer Service every 5 seconds (polling).
 * 
 * Query params:
 * - barId: The venue's bar ID
 * - driverId: The printer service's unique driver ID
 * 
 * Returns print jobs with status 'pending_print'
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('barId');
    const driverId = searchParams.get('driverId');

    if (!barId || !driverId) {
      return NextResponse.json(
        { success: false, error: 'barId and driverId are required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch print jobs that need to be printed
    const { data: printJobs, error } = await supabase
      .from('print_jobs')
      .select('id, raw_data, parsed_data, received_at')
      .eq('bar_id', barId)
      .eq('status', 'pending_print')
      .order('received_at', { ascending: true })
      .limit(10); // Max 10 at a time

    if (error) {
      console.error('Error fetching pending prints:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch pending prints' },
        { status: 500 }
      );
    }

    // Format for printer service
    const prints = (printJobs || []).map(job => ({
      id: job.id,
      rawData: job.raw_data, // Base64 encoded ESC/POS data
      timestamp: job.received_at,
      metadata: job.parsed_data,
    }));

    return NextResponse.json({
      success: true,
      prints,
      count: prints.length,
    });
  } catch (error) {
    console.error('Unhandled error in pending-prints endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
