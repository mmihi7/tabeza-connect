/**
 * Configure Printer Service API
 * 
 * Automatically configures the local printer service with the user's Bar ID
 * Called from Settings page when user clicks "Configure Printer Service" button
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { barId } = body;

    if (!barId) {
      return NextResponse.json(
        { error: 'Bar ID is required' },
        { status: 400 }
      );
    }

    // ✅ FIX #2: Detect environment dynamically
    const host = request.headers.get('host') || 'localhost:3003';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') 
      ? 'http' 
      : 'https';
    const apiUrl = `${protocol}://${host}`;

    console.log(`🔧 Configuring printer service with API URL: ${apiUrl}`);

    // Call the local printer service configuration endpoint
    const response = await fetch('http://localhost:8765/api/configure', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        barId: barId,
        apiUrl: apiUrl  // ✅ FIXED: Dynamic URL
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Printer service configuration failed: ${errorText}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Printer service configured successfully',
      config: data.config
    });

  } catch (error) {
    console.error('Error configuring printer service:', error);
    
    // Check if it's a connection error
    if (error instanceof Error && error.message.includes('fetch failed')) {
      return NextResponse.json({
        success: false,
        error: 'Cannot connect to printer service. Make sure it is running on this computer.',
        hint: 'Download and run the printer service first, then try again.'
      }, { status: 503 });
    }
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to configure printer service',
    }, { status: 500 });
  }
}
