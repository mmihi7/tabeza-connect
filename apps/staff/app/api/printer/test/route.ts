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
 * POST /api/printer/test
 * Send a test print to the printer service
 * 
 * Body:
 * - barId: UUID of the bar
 * 
 * Returns:
 * - success: boolean - Whether test print was sent successfully
 * - message: string - Human-readable status message
 * - error: string (optional) - Error details if failed
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { barId } = body;
    
    if (!barId) {
      console.error('Test print: Missing barId parameter');
      return NextResponse.json(
        { 
          success: false,
          error: 'Bar ID is required' 
        },
        { status: 400 }
      );
    }
    
    // Check if printer driver is online
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const { data: drivers, error } = await supabase
      .from('printer_drivers')
      .select('*')
      .eq('bar_id', barId)
      .gte('last_heartbeat', twoMinutesAgo)
      .order('last_heartbeat', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Error querying printer drivers:', error);
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to check printer status',
          details: error.message 
        },
        { status: 500 }
      );
    }
    
    // No active driver found
    if (!drivers || drivers.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active printer driver found. Please ensure TabezaConnect is running.',
      });
    }
    
    const driver = drivers[0];
    
    // Send test print to the printer service
    // The printer service runs on localhost:8765 on the venue's computer
    try {
      const testPrintResponse = await fetch('http://localhost:8765/print/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barId,
          driverId: driver.driver_id,
          testMessage: 'Tabeza Test Print - ' + new Date().toLocaleString(),
        }),
      });
      
      if (!testPrintResponse.ok) {
        throw new Error(`Printer service returned ${testPrintResponse.status}`);
      }
      
      const result = await testPrintResponse.json();
      
      return NextResponse.json({
        success: true,
        message: 'Test print sent successfully',
      });
      
    } catch (printError) {
      console.error('Error sending test print to printer service:', printError);
      
      // Check if it's a connection error
      const errorMessage = printError instanceof Error ? printError.message : 'Unknown error';
      
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
        return NextResponse.json({
          success: false,
          error: 'Cannot connect to printer service. Please ensure TabezaConnect is running on your computer.',
        });
      }
      
      return NextResponse.json({
        success: false,
        error: `Failed to send test print: ${errorMessage}`,
      });
    }
    
  } catch (error) {
    console.error('Error testing printer:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to test printer',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
