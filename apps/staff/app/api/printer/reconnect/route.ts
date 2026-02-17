import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// CORE TRUTH: Manual service always exists. 
// Digital authority is singular. 
// Tabeza adapts to the venue — never the reverse.

// Initialize Supabase client with service role key
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

/**
 * POST /api/printer/reconnect
 * Trigger a manual heartbeat check for troubleshooting
 * 
 * Body:
 * - barId: UUID of the bar to check
 * 
 * Returns:
 * - success: boolean - Whether reconnect check succeeded
 * - status: 'online' | 'offline' | 'not_configured'
 * - message: string - Human-readable status message
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { barId } = body;
    
    if (!barId) {
      console.error('Reconnect: Missing barId parameter');
      return NextResponse.json(
        { 
          success: false,
          error: 'Bar ID is required' 
        },
        { status: 400 }
      );
    }
    
    // Check if driver exists for this bar
    const { data: drivers, error } = await supabase
      .from('printer_drivers')
      .select('*')
      .eq('bar_id', barId)
      .order('last_heartbeat', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Error querying printer drivers:', error);
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to check driver status',
          details: error.message 
        },
        { status: 500 }
      );
    }
    
    // No driver found
    if (!drivers || drivers.length === 0) {
      return NextResponse.json({
        success: false,
        status: 'not_configured',
        message: 'No printer driver found. Please install TabezaConnect from tabeza.co.ke',
      });
    }
    
    // Driver exists - check if it's recently active
    const driver = drivers[0];
    const lastHeartbeat = new Date(driver.last_heartbeat);
    const minutesSinceLastSeen = (Date.now() - lastHeartbeat.getTime()) / (1000 * 60);
    
    if (minutesSinceLastSeen < 2) {
      return NextResponse.json({
        success: true,
        status: 'online',
        message: 'Printer service is online and responding',
      });
    } else if (minutesSinceLastSeen < 5) {
      return NextResponse.json({
        success: false,
        status: 'offline',
        message: 'Printer service is connecting. Please wait a moment and try again.',
      });
    } else {
      return NextResponse.json({
        success: false,
        status: 'offline',
        message: 'Printer service is offline. Please ensure TabezaConnect is running on your computer.',
      });
    }
    
  } catch (error) {
    console.error('Error reconnecting printer:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to reconnect printer',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
