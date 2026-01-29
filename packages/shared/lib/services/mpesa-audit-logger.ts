/**
 * M-Pesa Audit Logging Service
 * Implements task 6: Essential logging and observability
 * Requirements: 6.4, 7.1, 7.2
 */

import { createClient } from '@supabase/supabase-js';

export interface MpesaAuditLogData {
  // Core identifiers
  tab_id?: string;
  tab_payment_id?: string;
  checkout_request_id?: string;
  bar_id?: string;
  
  // Payment details
  amount?: number;
  phone_number?: string;
  environment?: 'sandbox' | 'production';
  
  // STK Push data (redacted)
  stk_request_payload?: any;
  stk_response?: any;
  
  // Callback data
  callback_data?: any;
  
  // Error information
  error_message?: string;
  error_code?: string;
  
  // Timing information
  response_time_ms?: number;
  
  // Additional context
  [key: string]: any;
}

export type MpesaAuditAction = 
  | 'payment_initiated'
  | 'payment_stk_sent'
  | 'payment_callback_received'
  | 'payment_callback_processed'
  | 'payment_verified'
  | 'payment_completed'
  | 'payment_failed'
  | 'payment_flagged_for_review'
  | 'payment_state_transition';

export class MpesaAuditLogger {
  private supabase: any;

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    // Use provided credentials or environment variables
    const url = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = supabaseKey || process.env.SUPABASE_SECRET_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase URL and key are required for audit logging');
    }
    
    this.supabase = createClient(url, key);
  }

  /**
   * Log M-Pesa payment event to audit_logs table
   * Requirements: 7.1, 7.2 - Log all payment events with complete details
   */
  async logPaymentEvent(
    action: MpesaAuditAction,
    data: MpesaAuditLogData,
    additionalContext?: Record<string, any>
  ): Promise<void> {
    try {
      // Redact sensitive information from STK request payload
      const redactedData = this.redactSensitiveData(data);
      
      // Prepare audit log entry
      const auditLogEntry = {
        action,
        bar_id: data.bar_id || null,
        tab_id: data.tab_id || null,
        staff_id: null, // M-Pesa payments are customer-initiated
        details: {
          // Core payment identifiers
          tab_payment_id: data.tab_payment_id,
          checkout_request_id: data.checkout_request_id,
          
          // Payment details
          amount: data.amount,
          phone_number: data.phone_number !== undefined ? this.maskPhoneNumber(data.phone_number) : undefined,
          environment: data.environment,
          
          // Request/response data (redacted)
          stk_request_payload: redactedData.stk_request_payload,
          stk_response: redactedData.stk_response,
          callback_data: redactedData.callback_data,
          
          // Error information
          error_message: data.error_message,
          error_code: data.error_code,
          
          // Performance metrics
          response_time_ms: data.response_time_ms,
          
          // Additional context
          ...additionalContext,
          
          // Audit metadata
          logged_at: new Date().toISOString(),
          log_version: '1.0'
        },
        created_at: new Date().toISOString()
      };

      // Insert audit log
      const { error } = await this.supabase
        .from('audit_logs')
        .insert(auditLogEntry);

      if (error) {
        console.error('Failed to create M-Pesa audit log:', {
          action,
          error: error.message,
          data: redactedData
        });
      }

    } catch (error) {
      console.error('Error creating M-Pesa audit log:', {
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: data.tab_payment_id || data.checkout_request_id || 'unknown'
      });
    }
  }

  /**
   * Log payment state transition with before/after states
   * Requirements: 6.4 - Log all payment state transitions
   */
  async logStateTransition(
    data: MpesaAuditLogData & {
      previous_status: string;
      new_status: string;
      transition_reason?: string;
    }
  ): Promise<void> {
    await this.logPaymentEvent('payment_state_transition', data, {
      previous_status: data.previous_status,
      new_status: data.new_status,
      transition_reason: data.transition_reason || 'Normal flow'
    });
  }

  /**
   * Log STK Push request with redacted payload
   * Requirements: 6.4 - Log STK request payload (redacted), STK response
   */
  async logSTKPushRequest(
    data: MpesaAuditLogData & {
      stk_request_payload: any;
      stk_response?: any;
    }
  ): Promise<void> {
    await this.logPaymentEvent('payment_stk_sent', data);
  }

  /**
   * Log callback received and processed
   * Requirements: 6.4 - Log raw callback JSON
   */
  async logCallbackReceived(
    data: MpesaAuditLogData & {
      callback_data: any;
    }
  ): Promise<void> {
    await this.logPaymentEvent('payment_callback_received', data);
  }

  /**
   * Log callback processing completion
   */
  async logCallbackProcessed(
    data: MpesaAuditLogData & {
      processing_result: 'success' | 'failed';
      processing_error?: string;
    }
  ): Promise<void> {
    await this.logPaymentEvent('payment_callback_processed', data, {
      processing_result: data.processing_result,
      processing_error: data.processing_error
    });
  }

  /**
   * Redact sensitive information from audit data
   * Removes or masks sensitive fields while preserving audit value
   */
  private redactSensitiveData(data: MpesaAuditLogData): MpesaAuditLogData {
    const redacted = { ...data };

    // Redact STK request payload - remove sensitive auth and credential info
    if (redacted.stk_request_payload) {
      redacted.stk_request_payload = {
        ...redacted.stk_request_payload,
        // Remove sensitive fields
        Password: '[REDACTED]',
        // Keep non-sensitive fields for debugging
        BusinessShortCode: redacted.stk_request_payload.BusinessShortCode,
        TransactionType: redacted.stk_request_payload.TransactionType,
        Amount: redacted.stk_request_payload.Amount,
        PartyA: redacted.stk_request_payload.PartyA ? this.maskPhoneNumber(redacted.stk_request_payload.PartyA) : undefined,
        PartyB: redacted.stk_request_payload.PartyB,
        PhoneNumber: redacted.stk_request_payload.PhoneNumber ? this.maskPhoneNumber(redacted.stk_request_payload.PhoneNumber) : undefined,
        CallBackURL: redacted.stk_request_payload.CallBackURL,
        AccountReference: redacted.stk_request_payload.AccountReference,
        TransactionDesc: redacted.stk_request_payload.TransactionDesc,
        Timestamp: redacted.stk_request_payload.Timestamp
      };
    }

    // Redact callback data - mask phone numbers but keep other data
    if (redacted.callback_data?.Body?.stkCallback?.CallbackMetadata?.Item) {
      const items = redacted.callback_data.Body.stkCallback.CallbackMetadata.Item;
      redacted.callback_data.Body.stkCallback.CallbackMetadata.Item = items.map((item: any) => {
        if (item.Name === 'PhoneNumber' && item.Value) {
          return { ...item, Value: this.maskPhoneNumber(item.Value.toString()) };
        }
        return item;
      });
    }

    return redacted;
  }

  /**
   * Mask phone number for logging (show first 3 and last 2 digits)
   * Example: 254712345678 -> 254*****78
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber || phoneNumber.length < 6) {
      return '[MASKED]';
    }
    
    const start = phoneNumber.substring(0, 3);
    const end = phoneNumber.substring(phoneNumber.length - 2);
    const middle = '*'.repeat(Math.max(0, phoneNumber.length - 5));
    
    return `${start}${middle}${end}`;
  }
}

/**
 * Create a singleton audit logger instance
 */
let auditLoggerInstance: MpesaAuditLogger | null = null;

export function getMpesaAuditLogger(): MpesaAuditLogger {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new MpesaAuditLogger();
  }
  return auditLoggerInstance;
}

/**
 * Convenience function for logging payment events
 */
export async function logMpesaPaymentEvent(
  action: MpesaAuditAction,
  data: MpesaAuditLogData,
  additionalContext?: Record<string, any>
): Promise<void> {
  const logger = getMpesaAuditLogger();
  await logger.logPaymentEvent(action, data, additionalContext);
}

/**
 * Convenience function for logging state transitions
 */
export async function logMpesaStateTransition(
  data: MpesaAuditLogData & {
    previous_status: string;
    new_status: string;
    transition_reason?: string;
  }
): Promise<void> {
  const logger = getMpesaAuditLogger();
  await logger.logStateTransition(data);
}