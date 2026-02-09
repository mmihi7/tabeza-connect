/**
 * Printer Relay API
 * 
 * Receives print data from the Tabeza printer service and creates unmatched receipts
 * These appear in Captain's Orders for staff to assign to tabs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const supabase = createServiceRoleClient();
  try {
    const body = await request.json();
    const { driverId, barId, timestamp, rawData, printerName, documentName, metadata } = body;

    // Validate required fields
    if (!barId || !rawData) {
      return NextResponse.json(
        { error: 'Missing required fields: barId and rawData are required' },
        { status: 400 }
      );
    }

    console.log('📥 Received print job from printer service:', {
      driverId,
      barId,
      documentName,
      dataSize: rawData.length,
      metadata,
    });

    // Decode the raw data to extract text preview
    let textPreview = '';
    try {
      const decodedData = Buffer.from(rawData, 'base64').toString('utf-8');
      // Extract first 500 characters as preview
      textPreview = decodedData.substring(0, 500);
    } catch (error) {
      console.warn('Could not decode print data for preview:', error);
      textPreview = 'Binary data - preview not available';
    }

    // Create receipt data object matching the expected schema
    const receiptData = {
      driverId: driverId || 'unknown',
      rawData,
      textPreview,
      printerName: printerName || 'Unknown Printer',
      documentName: documentName || 'Receipt',
      timestamp: timestamp || new Date().toISOString(),
      metadata: metadata || {},
    };

    // Create unmatched receipt in database
    const { data: receipt, error: insertError } = await supabase
      .from('unmatched_receipts')
      .insert({
        bar_id: barId,
        receipt_data: receiptData,
        status: 'pending',
      })
      .select()
      .single() as any; // Type assertion needed since table types aren't generated yet

    if (insertError) {
      console.error('Failed to create unmatched receipt:', insertError);
      throw insertError;
    }

    console.log('✅ Created unmatched receipt:', receipt?.id);

    return NextResponse.json({
      success: true,
      jobId: receipt?.id,
      message: 'Print job received and queued for assignment',
    });

  } catch (error) {
    console.error('Error processing print relay:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process print job',
    }, { status: 500 });
  }
}
