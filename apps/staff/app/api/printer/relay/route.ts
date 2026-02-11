/**
 * Printer Relay API
 * 
 * Receives print data from the Tabeza printer service and creates unmatched receipts
 * These appear in Captain's Orders for staff to assign to tabs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';
import { parseReceipt } from '@tabeza/shared/services/receiptParser';

export async function POST(request: NextRequest) {
  const supabase = createServiceRoleClient();
  try {
    const body = await request.json();
    const { driverId, barId, timestamp, rawData, printerName, documentName, metadata, parsedData } = body;

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
      hasParsedData: !!parsedData,
      metadata,
    });

    // Use parsedData from printer service if available, otherwise parse locally
    let finalParsedData = null;
    
    if (parsedData && typeof parsedData === 'object') {
      // Use parsed data from printer service
      finalParsedData = parsedData;
      console.log('✅ Using parsed data from printer service:', {
        itemCount: finalParsedData.items?.length || 0,
        total: finalParsedData.total || 0,
        receiptNumber: finalParsedData.receiptNumber,
      });
    } else {
      // Fallback: parse locally (this should not happen with proper printer service setup)
      console.log('⚠️  No parsed data from printer service, parsing locally');
      try {
        const decodedData = Buffer.from(rawData, 'base64').toString('utf-8');
        finalParsedData = await parseReceipt(decodedData, barId, documentName);
        
        console.log('📋 Local parsing result:', {
          itemCount: finalParsedData.items.length,
          total: finalParsedData.total,
          receiptNumber: finalParsedData.receiptNumber,
        });
        
      } catch (error) {
        console.warn('Could not parse receipt data locally:', error);
        finalParsedData = {
          items: [],
          total: 0,
          rawText: 'Failed to parse receipt',
        };
      }
    }

    // Create receipt data object matching the print_jobs schema
    const printJobData = {
      bar_id: barId,
      driver_id: driverId || 'unknown',
      raw_data: rawData,
      parsed_data: finalParsedData,
      printer_name: printerName || 'Unknown Printer',
      document_name: documentName || 'Receipt',
      metadata: metadata || {},
      status: 'no_match', // Always set to 'no_match' so it appears in Captain's Orders
      received_at: timestamp || new Date().toISOString(),
    };

    // Create print job in database
    const { data: printJob, error: insertError } = await supabase
      .from('print_jobs')
      .insert(printJobData)
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create print job:', insertError);
      throw insertError;
    }

    console.log('✅ Created print job:', printJob?.id);

    return NextResponse.json({
      success: true,
      jobId: printJob?.id,
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
