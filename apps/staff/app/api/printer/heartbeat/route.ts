/**
 * Printer Heartbeat API
 * 
 * Receives heartbeat signals from Tabeza Connect printer service
 * Updates printer driver status and last_heartbeat timestamp
 */

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
 * POST /api/printer/heartbeat
 * Receive heartbeat from printer service
 * 
 * Body:
 * - barId: UUID of the bar
 * - driverId: Unique identifier for the printer driver instance
 * - version: Version of the printer service
 * - status: (optional) Current status ('online', 'offline', 'error')
 * - metadata: (optional) Additional metadata (hostname, platform, etc.)
 * 
 * Returns:
 * - success: boolean
 * - message: string
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { barId, driverId, version, status, metadata } = body;
    
    // 2.2.1 Validate required fields
    if (!barId || !driverId || !version) {
      console.error('Heartbeat validation failed:', {
        hasBarId: !!barId,
        hasDriverId: !!driverId,
        hasVersion: !!version,
      });
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required fields: barId, driverId, and version are required' 
        },
        { status: 400 }
      );
    }
    
    console.log('💓 Heartbeat received:', {
      barId,
      driverId,
      version,
      status: status || 'online',
    });
    
    // 2.2.2 Verify bar_id exists in database
    const { data: bar, error: barError } = await supabase
      .from('bars')
      .select('id, name')
      .eq('id', barId)
      .single();
    
    if (barError || !bar) {
      console.error('Invalid bar ID in heartbeat:', {
        barId,
        error: barError?.message,
      });
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid bar ID - bar not found' 
        },
        { status: 400 }
      );
    }
    
    console.log('✅ Bar verified:', bar.name);
    
    // 2.2.3 & 2.2.4 Upsert driver record and update last_heartbeat timestamp
    const now = new Date().toISOString();
    
    const { data: driver, error: upsertError } = await supabase
      .from('printer_drivers')
      .upsert({
        bar_id: barId,
        driver_id: driverId,
        version,
        status: status || 'online',
        last_heartbeat: now,
        metadata: metadata || {},
        updated_at: now,
      }, {
        onConflict: 'driver_id',
      })
      .select()
      .single();
    
    if (upsertError) {
      console.error('Error upserting printer driver:', {
        error: upsertError.message,
        code: upsertError.code,
        details: upsertError.details,
      });
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to update heartbeat',
          details: upsertError.message 
        },
        { status: 500 }
      );
    }
    
    console.log('✅ Driver heartbeat updated:', {
      driverId: driver.driver_id,
      version: driver.version,
      lastHeartbeat: driver.last_heartbeat,
    });
    
    // 2.2.5 Return success response
    return NextResponse.json({
      success: true,
      message: 'Heartbeat received',
      driver: {
        id: driver.driver_id,
        version: driver.version,
        status: driver.status,
        lastHeartbeat: driver.last_heartbeat,
      },
    });
    
  } catch (error) {
    // 2.2.6 Error handling and logging
    console.error('Error processing heartbeat:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to process heartbeat',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
