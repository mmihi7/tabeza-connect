import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Initialize Supabase client with service role key
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

/**
 * GET /api/printer/driver-status
 * Check if a printer driver is registered and active for this bar
 * 
 * Query params:
 * - barId: UUID of the bar to check
 * 
 * Returns:
 * - connected: boolean - Whether an active driver is found
 * - status: 'online' | 'offline' | 'not_configured'
 * - driver: object (if connected) - Driver details
 * - message: string - Human-readable status message
 */
export async function GET(request: NextRequest) {
  try {
    // Get bar_id from query params
    const searchParams = request.nextUrl.searchParams;
    const barId = searchParams.get('barId');
    
    if (!barId) {
      console.error('Driver status check: Missing barId parameter');
      return NextResponse.json(
        { error: 'Bar ID is required' },
        { status: 400 }
      );
    }
    
    // Query for active drivers (heartbeat within last 2 minutes)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const { data: drivers, error } = await supabase
      .from('printer_drivers')
      .select('*')
      .eq('bar_id', barId)
      .gte('last_heartbeat', twoMinutesAgo)
      .order('last_heartbeat', { ascending: false });
    
    if (error) {
      console.error('Error querying printer drivers:', error);
      return NextResponse.json(
        { 
          error: 'Failed to check driver status',
          details: error.message 
        },
        { status: 500 }
      );
    }
    
    // Determine status based on query results
    if (!drivers || drivers.length === 0) {
      return NextResponse.json({
        connected: false,
        status: 'not_configured',
        message: 'No printer drivers registered for this venue',
      });
    }
    
    // Active driver found
    const activeDriver = drivers[0];
    const lastSeenMinutes = Math.floor(
      (Date.now() - new Date(activeDriver.last_heartbeat).getTime()) / 60000
    );
    
    return NextResponse.json({
      connected: true,
      status: 'online',
      driver: {
        id: activeDriver.driver_id,
        version: activeDriver.version,
        lastSeen: activeDriver.last_heartbeat,
        firstSeen: activeDriver.first_seen,
        lastSeenMinutes,
        metadata: activeDriver.metadata,
      },
      message: `Printer connected (last seen ${lastSeenMinutes}m ago)`,
    });
    
  } catch (error) {
    console.error('Error checking driver status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check driver status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/printer/driver-status
 * Test printer connection (placeholder for future implementation)
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: Implement actual printer test
    // This would send a test print job to the printer service
    
    return NextResponse.json({
      status: 'not_implemented',
      message: 'Printer test not yet implemented',
      success: false
    }, { status: 501 });
  } catch (error) {
    console.error('Error testing printer:', error);
    return NextResponse.json(
      { error: 'Failed to test printer' },
      { status: 500 }
    );
  }
}
