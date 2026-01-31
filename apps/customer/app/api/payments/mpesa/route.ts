/**
 * Simplified M-Pesa Payment Initiation API
 * Replaces over-engineered implementation with simple, maintainable solution
 * Requirements: 1.1, 2.1, 2.2, 2.3, 5.1, 5.3, 5.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';
import { 
  validateKenyanPhoneNumber,
  sendSTKPush,
  STKPushError,
  loadMpesaConfigFromBar, 
  MpesaConfigurationError,
  type BarMpesaData 
} from '@tabeza/shared';
import { 
  validatePaymentRequest, 
  checkPendingMpesaPayments,
  type PaymentValidationRequest 
} from '@tabeza/shared/lib/services/payment-validation';
import { 
  logMpesaPaymentEvent,
  logMpesaStateTransition,
  type MpesaAuditLogData 
} from '@tabeza/shared/lib/services/mpesa-audit-logger';

interface MpesaPaymentRequest {
  tabId: string;
  phoneNumber: string;
  amount: number;
}

/** Append one NDJSON line to MPESA_AUDIT_LOG_FILE when set (so __test__ and full flow both write to file). */
async function appendAuditLogToFileIfEnabled(
  _action: string,
  auditLogEntry: Record<string, unknown>
): Promise<void> {
  const logPath = process.env.MPESA_AUDIT_LOG_FILE;
  if (!logPath || typeof logPath !== 'string' || logPath.trim() === '') return;
  try {
    const { appendFile, mkdir } = await import('fs/promises');
    const { dirname, resolve } = await import('path');
    const line = JSON.stringify({ ...auditLogEntry, _written_at: new Date().toISOString() }) + '\n';
    const dir = dirname(logPath);
    await mkdir(dir, { recursive: true }).catch(() => {});
    await appendFile(logPath, line);
    const absolutePath = resolve(logPath);
    console.log('M-Pesa audit log written to file:', absolutePath);
  } catch (err) {
    console.error('M-Pesa audit file write failed:', logPath, err);
  }
}

interface MpesaPaymentResponse {
  success: boolean;
  checkoutRequestId?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<MpesaPaymentResponse>> {
  const startTime = Date.now();
  
  try {
    // Parse and validate request body
    let requestBody: MpesaPaymentRequest;
    try {
      requestBody = await request.json();
    } catch (error) {
      console.error('Invalid JSON in request body:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { tabId, phoneNumber, amount } = requestBody;

    // Validate required fields
    const missingFields: string[] = [];
    if (!tabId) missingFields.push('tabId');
    if (!phoneNumber) missingFields.push('phoneNumber');
    if (amount === undefined || amount === null) missingFields.push('amount');

    if (missingFields.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Missing required fields: ${missingFields.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Validate field types
    if (typeof tabId !== 'string' || tabId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'tabId must be a non-empty string' },
        { status: 400 }
      );
    }

    if (typeof phoneNumber !== 'string' || phoneNumber.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'phoneNumber must be a non-empty string' },
        { status: 400 }
      );
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'amount must be a positive number' },
        { status: 400 }
      );
    }

    if (amount > 999999) {
      return NextResponse.json(
        { success: false, error: 'amount cannot exceed 999,999 KES' },
        { status: 400 }
      );
    }

    // Requirement 2.4: Validate phone number format
    const phoneValidation = validateKenyanPhoneNumber(phoneNumber);
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        { 
          success: false, 
          error: phoneValidation.error || 'Invalid phone number format' 
        },
        { status: 400 }
      );
    }

    const normalizedPhoneNumber = phoneValidation.normalized!;

    // TabId __test__: run STK push only (no tab/bar DB, no tab_payments). Uses mock config so no real Safaricom call unless you use a real tab.
    if (tabId.trim() === '__test__') {
      // Live endpoints for __test__ so you can use m-tip (or other) production credentials
      const mpesaConfig = {
        environment: 'production' as const,
        businessShortcode: process.env.MPESA_SHORTCODE || process.env.MPESA_SHORT_CODE || '174379',
        consumerKey: process.env.MPESA_CONSUMER_KEY || 'mock_key',
        consumerSecret: process.env.MPESA_CONSUMER_SECRET || 'mock_secret',
        passkey: process.env.MPESA_PASSKEY || 'mock_passkey',
        callbackUrl: process.env.MPESA_CALLBACK_URL || 'http://localhost:3002/api/mpesa/callback',
        oauthUrl: process.env.MPESA_OAUTH_URL || 'https://api.safaricom.co.ke/oauth/v1/generate',
        stkPushUrl: process.env.MPESA_STK_PUSH_URL || 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
        stkQueryUrl: process.env.MPESA_STK_QUERY_URL || 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'
      };
      const stkRequest = {
        phoneNumber: normalizedPhoneNumber,
        amount: Math.round(amount),
        accountReference: 'TEST',
        transactionDesc: 'Tab Payment'
      };
      console.log('🧪 STK push only (tabId=__test__): calling sendSTKPush with', process.env.MPESA_MOCK_MODE === 'true' ? 'mock mode' : 'live (production) endpoints');
      try {
        const stkResponse = await sendSTKPush(stkRequest, mpesaConfig);
        await appendAuditLogToFileIfEnabled('payment_stk_sent', {
          action: 'payment_stk_sent',
          tab_id: '__test__',
          bar_id: null,
          staff_id: null,
          details: {
            checkout_request_id: stkResponse.CheckoutRequestID,
            amount,
            phone_number: normalizedPhoneNumber,
            environment: 'production',
            stk_request_payload: stkRequest,
            stk_response: stkResponse,
            mock_mode: process.env.MPESA_MOCK_MODE === 'true',
            logged_at: new Date().toISOString(),
            log_version: '1.0'
          },
          created_at: new Date().toISOString()
        });
        return NextResponse.json({
          success: true,
          checkoutRequestId: stkResponse.CheckoutRequestID,
          fromTest: true  // No payment row; "Simulate callback" would 404
        });
      } catch (stkError) {
        console.error('STK push failed (__test__):', stkError);
        const message = stkError instanceof Error ? stkError.message : 'STK Push failed';
        const body: { success: false; error: string; errorDetail?: string; safaricomResponse?: unknown } = {
          success: false,
          error: message
        };
        if (stkError instanceof STKPushError) {
          if (stkError.responseDescription) body.errorDetail = stkError.responseDescription;
          if (stkError.originalError) body.safaricomResponse = stkError.originalError;
        }
        return NextResponse.json(body, { status: 502 });
      }
    }

    // Requirement 2.1: Enhanced payment validation logic
    const validationRequest: PaymentValidationRequest = {
      tabId,
      amount,
      phoneNumber: normalizedPhoneNumber
    };

    const validationResult = await validatePaymentRequest(validationRequest);
    if (!validationResult.isValid) {
      return NextResponse.json(
        { success: false, error: validationResult.error },
        { status: 400 }
      );
    }

    const tab = validationResult.tab!;

    // Requirement 1.4: Check for existing pending M-Pesa payments
    const hasPendingPayments = await checkPendingMpesaPayments(tabId);
    if (hasPendingPayments) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'A payment is already in progress for this tab. Please wait for it to complete.' 
        },
        { status: 409 }
      );
    }

    // Get bar M-Pesa configuration
    const supabase = createServiceRoleClient();
    const { data: barData, error: barError } = await supabase
      .from('bars')
      .select(`
        id,
        mpesa_enabled,
        mpesa_environment,
        mpesa_business_shortcode,
        mpesa_consumer_key_encrypted,
        mpesa_consumer_secret_encrypted,
        mpesa_passkey_encrypted,
        mpesa_callback_url
      `)
      .eq('id', tab.bar_id)
      .single();

    if (barError || !barData) {
      console.error('Failed to get bar M-Pesa configuration:', { barId: tab.bar_id, error: barError });
      return NextResponse.json(
        { success: false, error: 'Payment configuration not found' },
        { status: 404 }
      );
    }

    // Load M-Pesa configuration for this bar
    const barMpesaData = barData as BarMpesaData;
    let mpesaConfig;
    
    // Check if mock mode is enabled BEFORE trying to load real config
    if (process.env.MPESA_MOCK_MODE === 'true') {
      console.log('🧪 M-Pesa Mock Mode: Skipping real configuration loading');
      // Create a mock config to satisfy the interface
      mpesaConfig = {
        environment: 'sandbox' as const,
        businessShortcode: 'mock_shortcode',
        consumerKey: 'mock_key',
        consumerSecret: 'mock_secret',
        passkey: 'mock_passkey',
        callbackUrl: 'http://localhost:3002/api/mpesa/callback',
        oauthUrl: 'mock_oauth_url',
        stkPushUrl: 'mock_stk_url',
        stkQueryUrl: 'mock_stk_query_url'
      };
    } else {
      // Only load real config if not in mock mode
      try {
        mpesaConfig = loadMpesaConfigFromBar(barMpesaData);
      } catch (error) {
        console.error('M-Pesa configuration error for bar:', { 
          barId: tab.bar_id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        
        if (error instanceof MpesaConfigurationError) {
          return NextResponse.json(
            { success: false, error: 'M-Pesa payment not available for this location' },
            { status: 503 }
          );
        }
        
        return NextResponse.json(
          { success: false, error: 'Payment service temporarily unavailable' },
          { status: 503 }
        );
      }
    }

    // Requirement 2.2: Create tab_payments record with status='initiated'
    const { data: payment, error: paymentError } = await supabase
      .from('tab_payments')
      .insert({
        tab_id: tabId,
        amount: amount,
        method: 'mpesa',
        status: 'initiated', // Start with 'initiated' status
        metadata: {
          phone_number: normalizedPhoneNumber,
          environment: process.env.MPESA_MOCK_MODE === 'true' ? 'sandbox' : ((barMpesaData.mpesa_environment as 'sandbox' | 'production') || 'sandbox'),
          initiated_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (paymentError || !payment) {
      console.error('Failed to create payment record:', paymentError);
      return NextResponse.json(
        { success: false, error: 'Failed to create payment record' },
        { status: 500 }
      );
    }

    console.log('Payment record created with initiated status:', { paymentId: payment.id, tabId, amount });

    // Task 6: Log payment initiation event
    await logMpesaPaymentEvent('payment_initiated', {
      tab_id: tabId,
      tab_payment_id: payment.id,
      bar_id: tab.bar_id,
      amount: amount,
      phone_number: normalizedPhoneNumber,
      environment: process.env.MPESA_MOCK_MODE === 'true' ? 'sandbox' : ((barMpesaData.mpesa_environment as 'sandbox' | 'production') || 'sandbox'),
      mock_mode: process.env.MPESA_MOCK_MODE === 'true'
    });

    try {
      // Handle mock mode
      if (process.env.MPESA_MOCK_MODE === 'true') {
        console.log('🧪 M-Pesa Mock Mode: Simulating successful payment');
        
        // Generate mock checkout request ID
        const mockCheckoutRequestId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Update payment record with mock checkout request ID and status
        const { error: updateError } = await supabase
          .from('tab_payments')
          .update({ 
            checkout_request_id: mockCheckoutRequestId,
            status: 'stk_sent', // Update to 'stk_sent' status
            metadata: {
              ...payment.metadata,
              stk_sent_at: new Date().toISOString(),
              mock_mode: true
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', payment.id);

        if (updateError) {
          console.error('Failed to update payment with mock checkout request ID:', updateError);
        }

        // Task 6: Log state transition from initiated to stk_sent
        await logMpesaStateTransition({
          tab_id: tabId,
          tab_payment_id: payment.id,
          checkout_request_id: mockCheckoutRequestId,
          bar_id: tab.bar_id,
          amount: amount,
          phone_number: normalizedPhoneNumber,
          environment: 'sandbox',
          previous_status: 'initiated',
          new_status: 'stk_sent',
          transition_reason: 'Mock STK Push successful'
        });

        // Task 6: Log STK Push request (mock)
        await logMpesaPaymentEvent('payment_stk_sent', {
          tab_id: tabId,
          tab_payment_id: payment.id,
          checkout_request_id: mockCheckoutRequestId,
          bar_id: tab.bar_id,
          amount: amount,
          phone_number: normalizedPhoneNumber,
          environment: 'sandbox',
          stk_request_payload: {
            // Mock STK request payload (redacted)
            BusinessShortCode: 'mock_shortcode',
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.round(amount),
            PartyA: normalizedPhoneNumber,
            PartyB: 'mock_shortcode',
            PhoneNumber: normalizedPhoneNumber,
            CallBackURL: 'mock_callback_url',
            AccountReference: `TAB${tabId.slice(-8)}`,
            TransactionDesc: 'Tab Payment',
            mock_mode: true
          },
          stk_response: {
            ResponseCode: '0',
            ResponseDescription: 'Success. Request accepted for processing',
            MerchantRequestID: `mock_merchant_${Date.now()}`,
            CheckoutRequestID: mockCheckoutRequestId,
            mock_mode: true
          },
          response_time_ms: Date.now() - startTime
        });

        // Simulate successful STK push response
        const responseTime = Date.now() - startTime;
        console.log('🧪 Mock M-Pesa payment initiated successfully:', {
          paymentId: payment.id,
          checkoutRequestId: mockCheckoutRequestId,
          responseTime: `${responseTime}ms`,
          mockMode: true
        });

        return NextResponse.json({
          success: true,
          checkoutRequestId: mockCheckoutRequestId,
          mockMode: true // Indicate this is a mock response
        });
      }

      // Requirement 2.1: Send STK Push request to Safaricom
      const stkStartTime = Date.now();
      const stkRequest = {
        phoneNumber: normalizedPhoneNumber,
        amount: Math.round(amount), // Ensure integer amount
        accountReference: `TAB${tabId.slice(-8)}`, // Use last 8 chars of tab ID
        transactionDesc: 'Tab Payment'
      };

      const stkResponse = await sendSTKPush(stkRequest, mpesaConfig);
      const stkResponseTime = Date.now() - stkStartTime;

      // Task 6: Log STK Push request and response (with redacted payload)
      await logMpesaPaymentEvent('payment_stk_sent', {
        tab_id: tabId,
        tab_payment_id: payment.id,
        checkout_request_id: stkResponse.CheckoutRequestID,
        bar_id: tab.bar_id,
        amount: amount,
        phone_number: normalizedPhoneNumber,
        environment: (barMpesaData.mpesa_environment as 'sandbox' | 'production') || 'sandbox',
        stk_request_payload: {
          // STK request payload (sensitive data will be redacted by audit logger)
          BusinessShortCode: mpesaConfig.businessShortcode,
          TransactionType: 'CustomerPayBillOnline',
          Amount: Math.round(amount),
          PartyA: normalizedPhoneNumber,
          PartyB: mpesaConfig.businessShortcode,
          PhoneNumber: normalizedPhoneNumber,
          CallBackURL: mpesaConfig.callbackUrl,
          AccountReference: `TAB${tabId.slice(-8)}`,
          TransactionDesc: 'Tab Payment',
          // Password and Timestamp will be redacted by audit logger
          Password: '[WILL_BE_REDACTED]',
          Timestamp: '[TIMESTAMP]'
        },
        stk_response: stkResponse,
        response_time_ms: stkResponseTime
      });

      // Requirement 2.2: Update payment record with checkout request ID and status
      const { error: updateError } = await supabase
        .from('tab_payments')
        .update({ 
          checkout_request_id: stkResponse.CheckoutRequestID,
          status: 'stk_sent', // Update to 'stk_sent' status
          metadata: {
            ...payment.metadata,
            merchant_request_id: stkResponse.MerchantRequestID,
            stk_sent_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id);

      if (updateError) {
        console.error('Failed to update payment with checkout request ID:', updateError);
        // Don't fail the request since STK Push was successful
      }

      // Task 6: Log state transition from initiated to stk_sent
      await logMpesaStateTransition({
        tab_id: tabId,
        tab_payment_id: payment.id,
        checkout_request_id: stkResponse.CheckoutRequestID,
        bar_id: tab.bar_id,
        amount: amount,
        phone_number: normalizedPhoneNumber,
        environment: (barMpesaData.mpesa_environment as 'sandbox' | 'production') || 'sandbox',
        previous_status: 'initiated',
        new_status: 'stk_sent',
        transition_reason: 'STK Push successful'
      });

      const responseTime = Date.now() - startTime;
      console.log('M-Pesa payment initiated successfully:', {
        paymentId: payment.id,
        checkoutRequestId: stkResponse.CheckoutRequestID,
        responseTime: `${responseTime}ms`
      });

      // Requirement 5.3: Return checkout request ID on success
      return NextResponse.json({
        success: true,
        checkoutRequestId: stkResponse.CheckoutRequestID
      });

    } catch (stkError) {
      console.error('STK Push failed:', stkError);

      // Update payment status to failed
      await supabase
        .from('tab_payments')
        .update({ 
          status: 'failed',
          metadata: { 
            error: stkError instanceof Error ? stkError.message : 'STK Push failed',
            timestamp: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id);

      // Task 6: Log payment failure
      await logMpesaPaymentEvent('payment_failed', {
        tab_id: tabId,
        tab_payment_id: payment.id,
        bar_id: tab.bar_id,
        amount: amount,
        phone_number: normalizedPhoneNumber,
        environment: process.env.MPESA_MOCK_MODE === 'true' ? 'sandbox' : ((barMpesaData.mpesa_environment as 'sandbox' | 'production') || 'sandbox'),
        error_message: stkError instanceof Error ? stkError.message : 'STK Push failed',
        error_code: 'STK_PUSH_FAILED',
        response_time_ms: Date.now() - startTime
      });

      // Task 6: Log state transition from initiated to failed
      await logMpesaStateTransition({
        tab_id: tabId,
        tab_payment_id: payment.id,
        bar_id: tab.bar_id,
        amount: amount,
        phone_number: normalizedPhoneNumber,
        environment: process.env.MPESA_MOCK_MODE === 'true' ? 'sandbox' : ((barMpesaData.mpesa_environment as 'sandbox' | 'production') || 'sandbox'),
        previous_status: 'initiated',
        new_status: 'failed',
        transition_reason: 'STK Push failed',
        error_message: stkError instanceof Error ? stkError.message : 'STK Push failed'
      });

      // Requirement 2.3 & 5.4: Return descriptive error message
      let errorMessage = 'STK Push request failed';
      
      if (stkError instanceof Error) {
        if (stkError.message.includes('invalid or expired credentials')) {
          errorMessage = 'M-Pesa service temporarily unavailable. Please try again later or pay at the bar.';
        } else if (stkError.message.includes('sandbox API is not responding correctly')) {
          errorMessage = 'M-Pesa service temporarily unavailable. Please try again later or pay at the bar.';
        } else if (stkError.message.includes('Invalid phone number')) {
          errorMessage = stkError.message;
        } else if (stkError.message.includes('Authentication failed')) {
          errorMessage = 'M-Pesa service temporarily unavailable. Please try again later or pay at the bar.';
        } else {
          errorMessage = stkError.message;
        }
      }
      
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 }
      );
    }

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('M-Pesa payment initiation error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime: `${responseTime}ms`
    });

    // Requirement 8.1: Ensure response within 5 seconds (log if exceeded)
    if (responseTime > 5000) {
      console.warn(`Payment initiation exceeded 5 second limit: ${responseTime}ms`);
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}