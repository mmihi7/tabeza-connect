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
    
    // Query for all drivers for this bar (not just recent ones)
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
          error: 'Failed to check driver status',
          details: error.message 
        },
        { status: 500 }
      );
    }
    
    // No driver found at all
    if (!drivers || drivers.length === 0) {
      return NextResponse.json({
        connected: false,
        status: 'not_configured',
        message: 'No printer drivers registered for this venue',
      });
    }
    
    // Driver exists - calculate status based on last heartbeat
    const driver = drivers[0];
    const lastSeenMinutes = Math.floor(
      (Date.now() - new Date(driver.last_heartbeat).getTime()) / 60000
    );
    
    // Determine status based on last heartbeat time
    // < 2 minutes: online
    // 2-5 minutes: offline (connecting)
    // > 5 minutes: offline
    if (lastSeenMinutes < 2) {
      return NextResponse.json({
        connected: true,
        status: 'online',
        driver: {
          id: driver.driver_id,
          version: driver.version,
          lastSeen: driver.last_heartbeat,
          firstSeen: driver.first_seen,
          lastSeenMinutes,
          metadata: driver.metadata,
        },
        message: `Printer connected (last seen ${lastSeenMinutes}m ago)`,
      });
    } else {
      // Offline - but driver exists
      return NextResponse.json({
        connected: false,
        status: 'offline',
        driver: {
          id: driver.driver_id,
          version: driver.version,
          lastSeen: driver.last_heartbeat,
          firstSeen: driver.first_seen,
          lastSeenMinutes,
          metadata: driver.metadata,
        },
        message: `Printer offline (last seen ${lastSeenMinutes}m ago)`,
      });
    }
    
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
