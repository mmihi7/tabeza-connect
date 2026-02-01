/**
 * Enhanced M-Pesa Callback Handler with Robust Parsing and Validation
 * Implements task 4.1 and 4.2: Enhanced callback handling (critical path)
 * Requirements: 3.2, 3.3, 3.4, 5.4, 5.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  logMpesaPaymentEvent,
  logMpesaStateTransition,
  type MpesaAuditLogData 
} from '@tabeza/shared/lib/services/mpesa-audit-logger';

interface MpesaCallbackMetadataItem {
  Name: string;
  Value: string | number;
}

interface MpesaCallbackMetadata {
  Item: MpesaCallbackMetadataItem[];
}

interface MpesaSTKCallback {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: MpesaCallbackMetadata;
}

interface MpesaCallback {
  Body: {
    stkCallback: MpesaSTKCallback;
  };
}

interface CallbackValidationResult {
  isValid: boolean;
  errors: string[];
  paymentId?: string;
  tabId?: string;
  amount?: number;
}

interface CallbackProcessingResult {
  success: boolean;
  paymentId?: string;
  tabId?: string;
  status: 'success' | 'failed';
  mpesaReceiptNumber?: string;
  amount?: number;
  error?: string;
}

/**
 * Task 4.1: Implement robust callback parsing and validation
 * Parse CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata
 * Find tab_payments by checkout_request_id
 * Handle not found cases gracefully (log + return 200)
 * Requirements: 3.2, 3.3
 */
async function validateAndParseCallback(
  callbackData: MpesaCallback,
  supabase: any
): Promise<CallbackValidationResult> {
  const errors: string[] = [];
  
  try {
    // Validate callback structure
    if (!callbackData.Body?.stkCallback) {
      errors.push('Invalid callback structure - missing stkCallback');
      return { isValid: false, errors };
    }

    const { stkCallback } = callbackData.Body;
    const { CheckoutRequestID, ResultCode, ResultDesc, MerchantRequestID } = stkCallback;

    // Validate required fields - Requirements 3.2
    if (!CheckoutRequestID || typeof CheckoutRequestID !== 'string') {
      errors.push('Missing or invalid CheckoutRequestID');
    }

    if (ResultCode === undefined || ResultCode === null || typeof ResultCode !== 'number') {
      errors.push('Missing or invalid ResultCode');
    }

    if (!ResultDesc || typeof ResultDesc !== 'string') {
      errors.push('Missing or invalid ResultDesc');
    }

    if (!MerchantRequestID || typeof MerchantRequestID !== 'string') {
      errors.push('Missing or invalid MerchantRequestID');
    }

    // If basic validation failed, return early
    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Find tab_payments by checkout_request_id - Requirements 3.3
    const { data: payment, error: findError } = await supabase
      .from('tab_payments')
      .select('id, tab_id, amount, status')
      .eq('checkout_request_id', CheckoutRequestID)
      .eq('method', 'mpesa')
      .single();

    if (findError || !payment) {
      // Handle not found cases gracefully (log + return 200) - Requirements 3.3
      console.log('Payment not found for CheckoutRequestID (graceful handling):', {
        checkoutRequestId: CheckoutRequestID,
        merchantRequestId: MerchantRequestID,
        resultCode: ResultCode,
        resultDesc: ResultDesc,
        error: findError?.message || 'Payment not found'
      });
      
      // This is not an error - return valid but indicate payment not found
      return { 
        isValid: true, 
        errors: ['Payment not found - graceful handling'],
        paymentId: undefined,
        tabId: undefined
      };
    }

    // Validate payment is in correct state for callback processing
    if (!['initiated', 'stk_sent'].includes(payment.status)) {
      errors.push(`Payment in invalid state for callback: ${payment.status}`);
      return { isValid: false, errors };
    }

    // Validate CallbackMetadata for successful payments
    if (ResultCode === 0 && !stkCallback.CallbackMetadata?.Item) {
      errors.push('Missing CallbackMetadata for successful payment');
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      paymentId: payment.id,
      tabId: payment.tab_id,
      amount: payment.amount
    };

  } catch (error) {
    errors.push(`Callback validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { isValid: false, errors };
  }
}

/**
 * Task 4.2: Implement callback processing logic
 * Task 5: Inline verification rules (no separate service)
 * For ResultCode === 0: extract receipt + amount, update payment to 'success', resolve tab
 * For other ResultCodes: update payment to 'failed'
 * Ensure callback idempotency through database constraints
 * Inline verification: verify amount matches and payment is in 'stk_sent' status
 * Requirements: 3.4, 5.1, 5.2, 5.4, 5.5
 */
async function processValidCallback(
  callbackData: MpesaCallback,
  validationResult: CallbackValidationResult,
  supabase: any
): Promise<CallbackProcessingResult> {
  const { stkCallback } = callbackData.Body;
  const { CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;
  
  try {
    // Determine payment status based on ResultCode - Requirements 3.4
    const paymentStatus = ResultCode === 0 ? 'success' : 'failed';
    
    let mpesaReceiptNumber: string | undefined;
    let transactionAmount: number | undefined;
    let phoneNumber: string | undefined;
    let transactionDate: string | undefined;

    // For successful payments, extract receipt and amount - Requirements 5.4
    if (ResultCode === 0 && stkCallback.CallbackMetadata?.Item) {
      const metadata = stkCallback.CallbackMetadata.Item;
      
      // Extract M-Pesa receipt number
      const receiptItem = metadata.find(item => item.Name === 'MpesaReceiptNumber');
      mpesaReceiptNumber = receiptItem?.Value?.toString();
      
      // Extract transaction amount for verification
      const amountItem = metadata.find(item => item.Name === 'Amount');
      transactionAmount = amountItem?.Value ? Number(amountItem.Value) : undefined;
      
      // Extract additional metadata
      const phoneItem = metadata.find(item => item.Name === 'PhoneNumber');
      phoneNumber = phoneItem?.Value?.toString();
      
      const dateItem = metadata.find(item => item.Name === 'TransactionDate');
      transactionDate = dateItem?.Value?.toString();

      // Validate required fields for successful payments
      if (!mpesaReceiptNumber) {
        console.error('Missing M-Pesa receipt number for successful payment:', {
          checkoutRequestId: CheckoutRequestID,
          paymentId: validationResult.paymentId
        });
        return {
          success: false,
          status: 'failed',
          error: 'Missing M-Pesa receipt number for successful payment'
        };
      }
    }

    // Task 6: Log payment verification start
    if (ResultCode === 0) {
      await logMpesaPaymentEvent('payment_verified', {
        tab_id: validationResult.tabId,
        tab_payment_id: validationResult.paymentId,
        checkout_request_id: CheckoutRequestID,
        amount: validationResult.amount,
        mpesa_receipt_number: mpesaReceiptNumber,
        transaction_amount: transactionAmount,
        phone_number: phoneNumber
      });
    }

    // Task 5: Inline verification rules (no separate service)
    // Requirements: 5.1, 5.2
    if (ResultCode === 0) {
      // Get current payment record to verify status and amount
      const { data: currentPayment, error: fetchError } = await supabase
        .from('tab_payments')
        .select('id, amount, status, checkout_request_id')
        .eq('id', validationResult.paymentId)
        .single();

      if (fetchError || !currentPayment) {
        console.error('Failed to fetch payment for verification:', {
          paymentId: validationResult.paymentId,
          checkoutRequestId: CheckoutRequestID,
          error: fetchError?.message || 'Payment not found'
        });
        return {
          success: false,
          status: 'failed',
          error: 'Failed to fetch payment for verification'
        };
      }

      // Verify payment is still in 'stk_sent' status - Requirements 5.2
      if (currentPayment.status !== 'stk_sent') {
        console.error('Payment verification failed - invalid status:', {
          paymentId: validationResult.paymentId,
          checkoutRequestId: CheckoutRequestID,
          expectedStatus: 'stk_sent',
          actualStatus: currentPayment.status,
          verificationFailed: true
        });

        // Mark payment as failed due to verification failure
        const { error: failError } = await supabase
          .from('tab_payments')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
            metadata: {
              ...callbackData,
              processed_at: new Date().toISOString(),
              verification_error: 'Payment not in stk_sent status',
              expected_status: 'stk_sent',
              actual_status: currentPayment.status,
              verification_failed: true
            }
          })
          .eq('id', validationResult.paymentId);

        if (failError) {
          console.error('Failed to mark payment as failed after verification error:', {
            paymentId: validationResult.paymentId,
            error: failError.message
          });
        }

        return {
          success: true, // Return success to prevent M-Pesa retries
          paymentId: validationResult.paymentId,
          tabId: validationResult.tabId,
          status: 'failed',
          amount: validationResult.amount
        };
      }

      // Verify amount matches tab_payments.amount - Requirements 5.1
      if (transactionAmount && Math.abs(transactionAmount - Number(currentPayment.amount)) > 0.01) {
        console.error('Payment verification failed - amount mismatch:', {
          paymentId: validationResult.paymentId,
          checkoutRequestId: CheckoutRequestID,
          expectedAmount: Number(currentPayment.amount),
          actualAmount: transactionAmount,
          difference: Math.abs(transactionAmount - Number(currentPayment.amount)),
          verificationFailed: true
        });

        // Mark payment as failed due to amount mismatch
        const { error: failError } = await supabase
          .from('tab_payments')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
            metadata: {
              ...callbackData,
              processed_at: new Date().toISOString(),
              verification_error: 'Amount mismatch',
              expected_amount: Number(currentPayment.amount),
              actual_amount: transactionAmount,
              verification_failed: true
            }
          })
          .eq('id', validationResult.paymentId);

        if (failError) {
          console.error('Failed to mark payment as failed after amount verification error:', {
            paymentId: validationResult.paymentId,
            error: failError.message
          });
        }

        return {
          success: true, // Return success to prevent M-Pesa retries
          paymentId: validationResult.paymentId,
          tabId: validationResult.tabId,
          status: 'failed',
          amount: validationResult.amount
        };
      }

      console.log('Payment verification passed:', {
        paymentId: validationResult.paymentId,
        checkoutRequestId: CheckoutRequestID,
        statusVerified: currentPayment.status === 'stk_sent',
        amountVerified: !transactionAmount || Math.abs(transactionAmount - Number(currentPayment.amount)) <= 0.01,
        expectedAmount: Number(currentPayment.amount),
        actualAmount: transactionAmount
      });
    }

    // Prepare update data with complete callback information
    const updateData: any = {
      status: paymentStatus,
      updated_at: new Date().toISOString(),
      metadata: {
        ...callbackData,
        processed_at: new Date().toISOString(),
        mpesa_receipt_number: mpesaReceiptNumber,
        phone_number: phoneNumber,
        transaction_date: transactionDate,
        transaction_amount: transactionAmount
      }
    };

    // Add M-Pesa receipt to both dedicated field and reference field for successful payments
    if (paymentStatus === 'success' && mpesaReceiptNumber) {
      updateData.mpesa_receipt = mpesaReceiptNumber;
      updateData.reference = mpesaReceiptNumber; // Store in reference field for UI display
    }

    // Update payment record - Requirements 5.5
    // Database constraints ensure callback idempotency
    const { error: updateError } = await supabase
      .from('tab_payments')
      .update(updateData)
      .eq('id', validationResult.paymentId)
      .eq('checkout_request_id', CheckoutRequestID); // Additional safety check

    if (updateError) {
      // Check if this is a constraint violation (idempotency)
      if (updateError.code === '23505') { // Unique constraint violation
        console.log('Callback idempotency: Payment already processed:', {
          checkoutRequestId: CheckoutRequestID,
          paymentId: validationResult.paymentId,
          error: updateError.message
        });
        
        // Return success for idempotent callbacks
        return {
          success: true,
          paymentId: validationResult.paymentId,
          tabId: validationResult.tabId,
          status: paymentStatus,
          mpesaReceiptNumber,
          amount: validationResult.amount
        };
      }

      console.error('Failed to update payment record:', {
        paymentId: validationResult.paymentId,
        checkoutRequestId: CheckoutRequestID,
        error: updateError
      });
      
      return {
        success: false,
        status: 'failed',
        error: `Failed to update payment record: ${updateError.message}`
      };
    }

    // Task 6: Log state transition to final status
    await logMpesaStateTransition({
      tab_id: validationResult.tabId,
      tab_payment_id: validationResult.paymentId,
      checkout_request_id: CheckoutRequestID,
      amount: validationResult.amount,
      phone_number: phoneNumber,
      mpesa_receipt_number: mpesaReceiptNumber,
      previous_status: 'stk_sent',
      new_status: paymentStatus,
      transition_reason: paymentStatus === 'success' ? 'Payment successful' : `Payment failed: ${ResultDesc}`
    });

    // Task 6: Log payment completion event
    const completionAction = paymentStatus === 'success' ? 'payment_completed' : 'payment_failed';
    await logMpesaPaymentEvent(completionAction, {
      tab_id: validationResult.tabId,
      tab_payment_id: validationResult.paymentId,
      checkout_request_id: CheckoutRequestID,
      amount: validationResult.amount,
      phone_number: phoneNumber,
      mpesa_receipt_number: mpesaReceiptNumber,
      transaction_amount: transactionAmount,
      result_code: ResultCode,
      result_description: ResultDesc
    });

    console.log('Payment callback processed successfully:', {
      paymentId: validationResult.paymentId,
      tabId: validationResult.tabId,
      checkoutRequestId: CheckoutRequestID,
      status: paymentStatus,
      amount: validationResult.amount,
      mpesaReceiptNumber,
      resultCode: ResultCode,
      resultDesc: ResultDesc
    });

    return {
      success: true,
      paymentId: validationResult.paymentId,
      tabId: validationResult.tabId,
      status: paymentStatus,
      mpesaReceiptNumber,
      amount: validationResult.amount
    };

  } catch (error) {
    console.error('Error processing callback:', {
      checkoutRequestId: CheckoutRequestID,
      paymentId: validationResult.paymentId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return {
      success: false,
      status: 'failed',
      error: `Callback processing error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Handle successful payment processing including tab resolution
 * Requirements: 5.4, 5.5 - Tab resolution after successful payment
 */
async function handleSuccessfulPayment(
  supabase: any,
  processingResult: CallbackProcessingResult
): Promise<void> {
  try {
    // Check if tab needs to be resolved (closed) after successful payment
    const { data: tabData, error: tabError } = await supabase
      .from('tabs')
      .select('id, status, bar_id')
      .eq('id', processingResult.tabId)
      .single();

    if (tabError || !tabData) {
      console.error('Failed to get tab data for resolution:', {
        tabId: processingResult.tabId,
        paymentId: processingResult.paymentId,
        error: tabError
      });
      return;
    }

    // Only process overdue tabs for auto-closure
    if (tabData.status === 'overdue') {
      // Calculate current tab balance
      const { data: balanceData, error: balanceError } = await supabase
        .from('tab_balances')
        .select('balance')
        .eq('tab_id', processingResult.tabId)
        .single();

      if (balanceError) {
        console.error('Failed to get tab balance for resolution:', {
          tabId: processingResult.tabId,
          paymentId: processingResult.paymentId,
          error: balanceError
        });
        return;
      }

      // Auto-close tab if balance is zero or negative
      if (balanceData && balanceData.balance <= 0) {
        const { error: closeError } = await supabase
          .from('tabs')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
            closed_by: 'system'
          })
          .eq('id', processingResult.tabId);

        if (closeError) {
          console.error('Failed to auto-close overdue tab:', {
            tabId: processingResult.tabId,
            paymentId: processingResult.paymentId,
            error: closeError
          });
        } else {
          console.log('Auto-closed overdue tab after successful payment:', {
            tabId: processingResult.tabId,
            paymentId: processingResult.paymentId,
            balance: balanceData.balance,
            mpesaReceiptNumber: processingResult.mpesaReceiptNumber
          });
        }
      }
    }

  } catch (error) {
    console.error('Error handling successful payment:', {
      tabId: processingResult.tabId,
      paymentId: processingResult.paymentId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  let callbackData: MpesaCallback;
  
  try {
    // Parse callback data
    try {
      callbackData = await request.json();
    } catch (error) {
      console.error('Invalid JSON in M-Pesa callback:', error);
      return NextResponse.json({
        ResultCode: 1,
        ResultDesc: 'Invalid JSON format'
      }, { status: 400 });
    }

    console.log('M-Pesa callback received:', {
      timestamp: new Date().toISOString(),
      checkoutRequestId: callbackData.Body?.stkCallback?.CheckoutRequestID,
      resultCode: callbackData.Body?.stkCallback?.ResultCode,
      resultDesc: callbackData.Body?.stkCallback?.ResultDesc
    });

    // Task 6: Log callback received event with raw callback JSON
    const checkoutRequestId = callbackData.Body?.stkCallback?.CheckoutRequestID;
    if (checkoutRequestId) {
      await logMpesaPaymentEvent('payment_callback_received', {
        checkout_request_id: checkoutRequestId,
        callback_data: callbackData, // Raw callback JSON will be redacted by audit logger
        response_time_ms: Date.now() - startTime
      });
    }

    // Create database client using secret key for server-side operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    );

    // Task 4.1: Validate and parse callback with robust error handling
    const validationResult = await validateAndParseCallback(callbackData, supabase);
    
    if (!validationResult.isValid) {
      console.error('Callback validation failed:', {
        errors: validationResult.errors,
        checkoutRequestId: callbackData.Body?.stkCallback?.CheckoutRequestID
      });
      
      // Return success to prevent M-Pesa retries for invalid callbacks
      return NextResponse.json({
        ResultCode: 0,
        ResultDesc: 'Callback received but validation failed'
      });
    }

    // Handle graceful case where payment was not found
    if (validationResult.errors.includes('Payment not found - graceful handling')) {
      // Log and return success (Requirements 3.3)
      return NextResponse.json({
        ResultCode: 0,
        ResultDesc: 'Callback received but payment not found'
      });
    }

    // Task 4.2: Process valid callback with idempotency protection
    const processingResult = await processValidCallback(callbackData, validationResult, supabase);
    
    // Task 6: Log callback processing completion
    await logMpesaPaymentEvent('payment_callback_processed', {
      tab_id: validationResult.tabId,
      tab_payment_id: validationResult.paymentId,
      checkout_request_id: checkoutRequestId,
      callback_data: callbackData,
      processing_result: processingResult.success ? 'success' : 'failed',
      processing_error: processingResult.error,
      response_time_ms: Date.now() - startTime
    });
    
    if (!processingResult.success) {
      console.error('Callback processing failed:', {
        error: processingResult.error,
        checkoutRequestId: callbackData.Body?.stkCallback?.CheckoutRequestID,
        paymentId: validationResult.paymentId
      });
      
      // Return success to prevent M-Pesa retries for processing errors
      return NextResponse.json({
        ResultCode: 0,
        ResultDesc: 'Callback received but processing failed'
      });
    }

    // Handle successful payment processing - resolve tab if needed
    if (processingResult.status === 'success' && processingResult.tabId) {
      await handleSuccessfulPayment(supabase, processingResult);
    }

    const processingTime = Date.now() - startTime;
    
    console.log('M-Pesa callback processed successfully:', {
      paymentId: processingResult.paymentId,
      tabId: processingResult.tabId,
      checkoutRequestId: callbackData.Body?.stkCallback?.CheckoutRequestID,
      status: processingResult.status,
      amount: processingResult.amount,
      mpesaReceiptNumber: processingResult.mpesaReceiptNumber,
      processingTime: `${processingTime}ms`
    });

    // Return success response to M-Pesa
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Callback processed successfully'
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error('M-Pesa callback processing error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: `${processingTime}ms`
    });

    // Return success to prevent M-Pesa from retrying on our internal errors
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Callback received but processing failed'
    });
  }
}

/**
 * Handle GET requests for health checks or debugging
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    message: 'M-Pesa callback endpoint is active',
    timestamp: new Date().toISOString(),
    environment: process.env.MPESA_ENVIRONMENT || 'sandbox'
  });
}