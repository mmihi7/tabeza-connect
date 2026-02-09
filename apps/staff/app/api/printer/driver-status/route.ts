/**
 * Driver Status API
 * 
 * Checks if Tabeza printer drivers are installed and running
 * Acts as a proxy to the local driver service
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Try to connect to the local driver service
    // The Tabeza printer driver service runs on localhost:8765
    const response = await fetch('http://localhost:8765/api/status', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      
      return NextResponse.json({
        installed: true,
        status: 'running',
        version: data.version || '1.0.0',
        printerName: data.printerName || 'Tabeza Receipt Printer',
        lastSeen: data.timestamp || new Date().toISOString(),
        message: 'Tabeza printer drivers are installed and running',
      });
    }

    return NextResponse.json({
      installed: false,
      status: 'error',
      error: `Driver service returned status ${response.status}`,
      message: 'Driver service is not responding correctly',
    }, { status: 503 });

  } catch (error) {
    // Driver service not reachable
    return NextResponse.json({
      installed: false,
      status: 'not_found',
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Tabeza printer drivers are not installed or not running',
      downloadUrl: 'https://github.com/billoapp/tabeza-printer-service/releases/latest/download/tabeza-printer-service.exe',
    }, { status: 404 });
  }
}

/**
 * POST /api/printer/driver-status
 * 
 * Test printer connectivity
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { barId } = body;

    if (!barId) {
      return NextResponse.json(
        { error: 'Missing barId' },
        { status: 400 }
      );
    }

    // Send test print job to driver service
    const response = await fetch('http://localhost:8765/api/test-print', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        barId,
        testMessage: 'Tabeza Printer Test',
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      
      return NextResponse.json({
        success: true,
        message: 'Test print sent successfully',
        jobId: data.jobId,
      });
    }

    // Get error details from printer service
    let errorDetails = 'Test print failed';
    try {
      const errorData = await response.json();
      errorDetails = errorData.error || errorData.message || errorDetails;
    } catch {
      errorDetails = `HTTP ${response.status}: ${response.statusText}`;
    }

    console.error('Test print failed:', errorDetails);

    return NextResponse.json({
      success: false,
      error: errorDetails,
    }, { status: 500 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Test print failed';
    console.error('Test print error:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}
