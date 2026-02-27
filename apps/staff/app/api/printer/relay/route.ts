/**
 * Printer Relay API
 * 
 * Receives print data from the Tabeza printer service and creates unmatched receipts
 * These appear in Captain's Orders for staff to assign to tabs
 * 
 * CORE TRUTH: Manual service always exists. Digital authority is singular.
 * Tabeza adapts to the venue — never the reverse.
 * 
 * FOUNDATIONAL RULE: Never reject a receipt. Always accept, always store.
 * The POS is the source of truth. Tabeza is a convenience layer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';
import { parseReceipt } from '@tabeza/shared/services/receiptParser';

/**
 * Structured error response format
 */
interface ErrorResponse {
  success: false;
  error: string;
  category: 'validation' | 'decoding' | 'parsing' | 'database' | 'configuration';
  operation: string;
  details?: Record<string, any>;
}

/**
 * Parsed receipt data structure
 */
interface ParsedReceipt {
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  subtotal?: number;
  tax?: number;
  receiptNumber?: string;
  timestamp?: string;
  rawText: string;
  confidence?: 'high' | 'medium' | 'low';
  error?: string;
}

/**
 * Print job payload from TabezaConnect service
 * Requirements: 5.1, 5.2 - Accept parsedData as optional, make rawData optional
 */
interface PrintJobPayload {
  driverId?: string;
  barId: string;
  timestamp?: string;
  parsedData?: ParsedReceipt;  // NEW: Optional parsed data from local parsing
  rawData?: string;  // MODIFIED: Now optional (was required)
  printerName?: string;
  documentName?: string;
  metadata?: {
    confidence?: 'high' | 'medium' | 'low';
    parsingMethod?: 'local' | 'cloud';
    [key: string]: any;
  };
}

/**
 * Validate base64 string format
 */
function isValidBase64(str: string): boolean {
  if (!str || typeof str !== 'string') {
    return false;
  }
  // Base64 regex pattern
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  return base64Regex.test(str);
}

/**
 * Sanitize payload for logging (remove sensitive data)
 */
function sanitizePayload(payload: any): Record<string, any> {
  return {
    barId: payload.barId || 'missing',
    driverId: payload.driverId || 'missing',
    rawDataLength: payload.rawData?.length || 0,
    rawDataSample: payload.rawData ? payload.rawData.substring(0, 100) : 'not_provided',
    printerName: payload.printerName || 'missing',
    documentName: payload.documentName || 'missing',
    hasParsedData: !!payload.parsedData,
    hasRawData: !!payload.rawData,
    hasMetadata: !!payload.metadata,
  };
}

export async function POST(request: NextRequest) {
  // **3.5 Environment variable validation**
  if (!process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ [Configuration Error] Missing required environment variables:', {
      hasSupabaseSecretKey: !!process.env.SUPABASE_SECRET_KEY,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
    
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Service configuration error: Missing required environment variables',
        category: 'configuration',
        operation: 'environment_validation',
        details: {
          message: 'SUPABASE_SECRET_KEY or NEXT_PUBLIC_SUPABASE_URL not configured',
        },
      },
      { status: 503 }
    );
  }

  const supabase = createServiceRoleClient();
  let body: PrintJobPayload = {} as PrintJobPayload;
  
  try {
    // **3.1 Enhanced error logging - JSON parsing**
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('❌ [JSON Parsing Error]', {
        operation: 'json_parse',
        errorType: jsonError instanceof Error ? jsonError.constructor.name : typeof jsonError,
        errorMessage: jsonError instanceof Error ? jsonError.message : String(jsonError),
        stackTrace: jsonError instanceof Error ? jsonError.stack : undefined,
      });
      
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Invalid JSON payload',
          category: 'validation',
          operation: 'json_parse',
          details: {
            message: jsonError instanceof Error ? jsonError.message : 'Failed to parse JSON',
          },
        },
        { status: 400 }
      );
    }

    const { driverId, barId, timestamp, rawData, printerName, documentName, metadata, parsedData } = body;

    // Validate required fields - barId is required, but either parsedData or rawData must be present
    if (!barId) {
      console.warn('⚠️  [Validation Error] Missing required field: barId', {
        hasBarId: !!barId,
        hasParsedData: !!parsedData,
        hasRawData: !!rawData,
        sanitizedPayload: sanitizePayload(body),
      });
      
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Missing required field: barId is required',
          category: 'validation',
          operation: 'field_validation',
        },
        { status: 400 }
      );
    }

    // Either parsedData or rawData must be present
    if (!parsedData && !rawData) {
      console.warn('⚠️  [Validation Error] Missing data fields:', {
        hasParsedData: !!parsedData,
        hasRawData: !!rawData,
        sanitizedPayload: sanitizePayload(body),
      });
      
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Missing required data: either parsedData or rawData must be provided',
          category: 'validation',
          operation: 'field_validation',
        },
        { status: 400 }
      );
    }

    // **3.2 Base64 decoding validation** - only validate if rawData is present
    if (rawData && !isValidBase64(rawData)) {
      console.error('❌ [Base64 Validation Error]', {
        operation: 'base64_validation',
        rawDataLength: rawData.length,
        rawDataSample: rawData.substring(0, 100),
        barId,
        driverId,
      });
      
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Invalid base64 data format',
          category: 'decoding',
          operation: 'base64_validation',
          details: {
            rawDataLength: rawData.length,
            rawDataSample: rawData.substring(0, 100),
          },
        },
        { status: 400 }
      );
    }

    console.log('📥 Received print job from printer service:', {
      driverId,
      barId,
      documentName,
      dataSize: rawData?.length || 0,
      hasParsedData: !!parsedData,
      hasRawData: !!rawData,
      metadata,
    });

    // **Requirements 5.3, 5.4, 6.2, 6.6: Parsed data priority logic**
    // When parsedData is provided, use it directly without parsing
    // When parsedData is not provided, fall back to parsing rawData
    // Prioritize parsedData over rawData when both present
    let finalParsedData = null;
    let parsingConfidence: 'low' | 'medium' | 'high' = 'low';
    let parsingMethod: 'local' | 'cloud' = 'cloud';
    
    if (parsedData && typeof parsedData === 'object') {
      // **Requirement 5.3: Use parsedData directly without parsing**
      finalParsedData = parsedData;
      parsingMethod = 'local';
      
      // Use confidence from printer service if provided, otherwise calculate it
      if (parsedData.confidence && ['high', 'medium', 'low'].includes(parsedData.confidence)) {
        parsingConfidence = parsedData.confidence;
      } else {
        // Calculate confidence if not provided
        const hasItems = parsedData.items && Array.isArray(parsedData.items) && parsedData.items.length > 0;
        const hasTotal = parsedData.total && typeof parsedData.total === 'number' && parsedData.total > 0;
        
        if (hasItems && hasTotal) {
          parsingConfidence = 'high';
        } else if (hasTotal || hasItems) {
          parsingConfidence = 'medium';
        } else {
          parsingConfidence = 'low';
        }
      }
      
      console.log('✅ Using parsed data from printer service (local parsing):', {
        itemCount: finalParsedData.items?.length || 0,
        total: finalParsedData.total || 0,
        receiptNumber: finalParsedData.receiptNumber,
        confidence: parsingConfidence,
        parsingMethod,
      });
    } else {
      // **Requirement 5.4: Fall back to parsing rawData when parsedData not provided**
      console.log('⚠️  No parsed data from printer service, parsing locally (cloud parsing)');
      parsingMethod = 'cloud';
      
      // **3.1 Enhanced error logging - Base64 decoding**
      let decodedData: string = '';
      
      // Only attempt to decode if rawData is present
      if (rawData) {
        try {
          decodedData = Buffer.from(rawData, 'base64').toString('utf-8');
          console.log('✅ Base64 decoding successful:', {
            operation: 'base64_decode',
            rawDataLength: rawData.length,
            decodedLength: decodedData.length,
          });
        } catch (decodeError) {
          console.error('❌ [Base64 Decoding Error]', {
            operation: 'base64_decode',
            errorType: decodeError instanceof Error ? decodeError.constructor.name : typeof decodeError,
            errorMessage: decodeError instanceof Error ? decodeError.message : String(decodeError),
            stackTrace: decodeError instanceof Error ? decodeError.stack : undefined,
            rawDataLength: rawData.length,
            rawDataSample: rawData.substring(0, 100),
            barId,
            driverId,
          });
          
          // **FOUNDATIONAL RULE: Never reject a receipt**
          // Even if decoding fails, create a print job with low confidence
          finalParsedData = {
            items: [],
            total: 0,
            rawText: 'Failed to decode base64 data',
            error: decodeError instanceof Error ? decodeError.message : 'Decoding failed',
          };
          parsingConfidence = 'low';
          
          console.warn('⚠️  Base64 decoding failed, using fallback parsed data with low confidence');
          
          // Continue to database insert (don't return error)
          decodedData = '';
        }
      } else {
        // No rawData provided and no parsedData - this shouldn't happen due to validation
        console.error('❌ [Data Missing] Neither parsedData nor rawData provided');
        finalParsedData = {
          items: [],
          total: 0,
          rawText: 'No data provided',
          error: 'Neither parsedData nor rawData was provided',
        };
        parsingConfidence = 'low';
      }
      
      // **3.3 Improve receipt parsing error handling**
      if (decodedData && !finalParsedData) {
        try {
          finalParsedData = await parseReceipt(decodedData, barId, documentName);
          
          console.log('📋 Local parsing result:', {
            operation: 'receipt_parse',
            itemCount: finalParsedData.items?.length || 0,
            total: finalParsedData.total || 0,
            receiptNumber: finalParsedData.receiptNumber,
          });
          
        } catch (parseError) {
          console.error('❌ [Receipt Parsing Error]', {
            operation: 'receipt_parse',
            errorType: parseError instanceof Error ? parseError.constructor.name : typeof parseError,
            errorMessage: parseError instanceof Error ? parseError.message : String(parseError),
            stackTrace: parseError instanceof Error ? parseError.stack : undefined,
            barId,
            driverId,
            documentName,
            decodedDataLength: decodedData.length,
            decodedDataSample: decodedData.substring(0, 200),
          });
          
          // Check if it's a DeepSeek API error or regex parsing error
          const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
          if (errorMessage.includes('DeepSeek') || errorMessage.includes('API') || errorMessage.includes('timeout')) {
            console.error('❌ [DeepSeek API Error] Receipt parsing failed due to API issue:', {
              errorMessage,
              willFallbackToRegex: true,
            });
          } else {
            console.error('❌ [Regex Parsing Error] Receipt parsing failed during regex extraction:', {
              errorMessage,
            });
          }
          
          // **FOUNDATIONAL RULE: Never reject a receipt**
          // Even if parsing fails, create a print job with low confidence
          finalParsedData = {
            items: [],
            total: 0,
            rawText: decodedData || 'Failed to parse receipt',
            error: errorMessage,
          };
          parsingConfidence = 'low';
          
          console.warn('⚠️  Receipt parsing failed, using fallback parsed data with low confidence');
        }
      }
    }

    // FOUNDATIONAL RULE: Never reject a receipt. Always accept, always store.
    // The POS is the source of truth. Tabeza is a convenience layer.
    
    // Note: Confidence level is already determined in the priority logic above
    // This ensures we use the confidence from the printer service when available

    // Create receipt data object matching the print_jobs schema
    const printJobData = {
      bar_id: barId,
      driver_id: driverId || 'unknown',
      raw_data: rawData || null, // rawData is now optional
      parsed_data: finalParsedData,
      printer_name: printerName || 'Unknown Printer',
      document_name: documentName || 'Receipt',
      metadata: {
        ...metadata,
        parsing_confidence: parsingConfidence, // high, medium, low
        parsing_method: parsingMethod, // local or cloud - Requirement 6.4
      },
      status: 'no_match', // Always set to 'no_match' so it appears in Captain's Orders
      received_at: timestamp || new Date().toISOString(),
    };

    // **3.4 Enhance database insert error logging**
    console.log('💾 Attempting database insert:', {
      operation: 'database_insert',
      sanitizedData: {
        bar_id: printJobData.bar_id,
        driver_id: printJobData.driver_id,
        status: printJobData.status,
        printer_name: printJobData.printer_name,
        document_name: printJobData.document_name,
        parsing_confidence: printJobData.metadata.parsing_confidence,
        parsing_method: printJobData.metadata.parsing_method, // Requirement 6.4: Log parsing method
        has_parsed_data: !!printJobData.parsed_data,
        has_raw_data: !!printJobData.raw_data,
        raw_data_length: printJobData.raw_data?.length || 0,
      },
    });

    // Create print job in database
    const { data: printJob, error: insertError } = await supabase
      .from('print_jobs')
      .insert(printJobData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ [Database Insert Error]', {
        operation: 'database_insert',
        errorType: 'SupabaseError',
        errorCode: insertError.code,
        errorMessage: insertError.message,
        errorDetails: insertError.details,
        errorHint: insertError.hint,
        sanitizedPrintJobData: {
          bar_id: printJobData.bar_id,
          driver_id: printJobData.driver_id,
          status: printJobData.status,
          printer_name: printJobData.printer_name,
          document_name: printJobData.document_name,
          parsing_confidence: printJobData.metadata.parsing_confidence,
          has_parsed_data: !!printJobData.parsed_data,
          has_raw_data: !!printJobData.raw_data,
          raw_data_length: printJobData.raw_data?.length || 0,
        },
      });
      
      // Check for specific error types
      if (insertError.code === '23503') {
        console.error('❌ [Foreign Key Constraint Violation]', {
          constraint: 'print_jobs_bar_id_fkey',
          bar_id: printJobData.bar_id,
          message: 'The specified bar_id does not exist in the bars table',
          hint: 'Verify that the bar exists in the database before uploading receipts',
        });
      } else if (insertError.code === '23505') {
        console.error('❌ [Unique Constraint Violation]', {
          message: 'Duplicate print job detected',
          details: insertError.details,
        });
      } else if (insertError.code?.startsWith('23')) {
        console.error('❌ [Constraint Violation]', {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
        });
      }
      
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: insertError.message || 'Failed to create print job in database',
          category: 'database',
          operation: 'database_insert',
          details: {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
          },
        },
        { status: 500 }
      );
    }

    console.log('✅ Created print job:', printJob?.id);

    return NextResponse.json({
      success: true,
      jobId: printJob?.id,
      message: 'Print job received and queued for assignment',
    });

  } catch (error) {
    // **3.1 Enhanced error logging - Catch-all error handler**
    console.error('❌ [Unexpected Error] Error processing print relay:', {
      operation: 'print_relay_processing',
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      stackTrace: error instanceof Error ? error.stack : undefined,
      sanitizedPayload: body ? sanitizePayload(body) : 'body_not_parsed',
    });
    
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process print job',
        category: 'database',
        operation: 'print_relay_processing',
        details: {
          errorType: error instanceof Error ? error.constructor.name : typeof error,
        },
      },
      { status: 500 }
    );
  }
}
