/**
 * GET /api/receipts/unmatched
 * 
 * Fetches ALL unmatched receipts for a specific venue (no time limit).
 * Used by the UnmatchedReceipts component to display receipts that were
 * dismissed or missed and need manual assignment.
 * 
 * IMPORTANT: Does NOT auto-filter by time - shows all pending receipts
 * regardless of age. Staff must manually assign or cancel each receipt.
 * 
 * Query Parameters:
 * - venueId: UUID of the venue (required)
 * 
 * Returns:
 * - receipts: Array of unmatched receipt objects
 * 
 * Requirements: 8.1, 8.2, 8.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get('venueId');

    // Validate required parameters
    if (!venueId) {
      return NextResponse.json(
        { error: 'venueId is required' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch ALL unmatched receipts (no time filter - show everything pending)
    const { data: receipts, error } = await supabase
      .from('unmatched_receipts')
      .select('*')
      .eq('bar_id', venueId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching unmatched receipts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch unmatched receipts' },
        { status: 500 }
      );
    }

    return NextResponse.json({ receipts: receipts || [] });
  } catch (error) {
    console.error('Unhandled error in unmatched receipts endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
