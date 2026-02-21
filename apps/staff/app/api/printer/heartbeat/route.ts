import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// CORE TRUTH: Manual service always exists. 
// Digital authority is singular. 
// Tabeza adapts to the venue — never the reverse.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Parse heartbeat payload from TabezaConnect
    const payload = await request.json();
    
    const {
      barId,
      driverId,
      version,
      status = 'online',
      metadata = {},
    } = payload;

    // Validate required fields
    if (!barId || !driverId) {
      return NextResponse.json(
        { error: 'Missing required fields: barId, driverId' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Upsert printer driver status
    const { data, error } = await supabase
      .from('printer_drivers')
      .upsert(
        {
          bar_id: barId,
          driver_id: driverId,
          version: version || 'unknown',
          status: status,
          last_heartbeat: new Date().toISOString(),
          metadata: metadata,
          // first_seen will be set automatically on insert
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'driver_id',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to update printer driver status:', error);
      return NextResponse.json(
        { error: 'Failed to update status', details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ Heartbeat received from driver ${driverId} for bar ${barId}`);

    return NextResponse.json({
      success: true,
      message: 'Heartbeat received',
      driver: data,
    });

  } catch (error: any) {
    console.error('❌ Heartbeat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
