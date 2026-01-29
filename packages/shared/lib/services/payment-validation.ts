/**
 * Payment Validation Service
 * Implements comprehensive validation logic for M-Pesa payment initiation
 * Requirements: 1.2, 5.1
 */

import { createServiceRoleClient } from '@/lib/supabase';
import { resolveTabForPayment, type Tab } from './tab-resolution';

export interface PaymentValidationResult {
  isValid: boolean;
  error?: string;
  tab?: Tab;
  balance?: number;
}

export interface PaymentValidationRequest {
  tabId: string;
  amount: number;
  phoneNumber: string;
}

/**
 * Comprehensive payment validation logic
 * Validates tab exists, is open, and amount is valid
 */
export async function validatePaymentRequest(
  request: PaymentValidationRequest
): Promise<PaymentValidationResult> {
  const { tabId, amount, phoneNumber } = request;

  try {
    // Requirement 1.2: Validate tab exists and is open
    let tab: Tab;
    try {
      tab = await resolveTabForPayment(tabId);
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Tab not found'
      };
    }

    // Validate tab status (allow both open and overdue tabs for payments)
    if (tab.status !== 'open' && tab.status !== 'overdue') {
      return {
        isValid: false,
        error: 'Tab is not available for payments'
      };
    }

    // Requirement 5.1: Validate amount > 0
    if (amount <= 0) {
      return {
        isValid: false,
        error: 'Payment amount must be greater than zero'
      };
    }

    // Validate amount is reasonable (not too large)
    if (amount > 999999) {
      return {
        isValid: false,
        error: 'Payment amount cannot exceed KSh 999,999'
      };
    }

    // Get current tab balance for reference
    const balance = await getTabBalance(tabId);

    // Validate phone number is provided
    if (!phoneNumber || phoneNumber.trim().length === 0) {
      return {
        isValid: false,
        error: 'Phone number is required'
      };
    }

    return {
      isValid: true,
      tab,
      balance
    };

  } catch (error) {
    console.error('Payment validation error:', error);
    return {
      isValid: false,
      error: 'Payment validation failed'
    };
  }
}

/**
 * Get current tab balance using the database view
 */
export async function getTabBalance(tabId: string): Promise<number> {
  const supabase = createServiceRoleClient();

  // Use the tab_balances view for consistent balance calculation
  const { data: balanceData, error } = await supabase
    .from('tab_balances')
    .select('balance')
    .eq('tab_id', tabId)
    .single();

  if (error) {
    console.error('Error getting tab balance:', error);
    throw new Error('Failed to get tab balance');
  }

  return balanceData?.balance || 0;
}

/**
 * Check if tab has any pending M-Pesa payments
 * Requirement 1.4: Only one pending M-Pesa payment per tab
 */
export async function checkPendingMpesaPayments(tabId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();

  const { data: pendingPayments, error } = await supabase
    .from('tab_payments')
    .select('id')
    .eq('tab_id', tabId)
    .eq('method', 'mpesa')
    .in('status', ['initiated', 'stk_sent'])
    .limit(1);

  if (error) {
    console.error('Error checking pending payments:', error);
    throw new Error('Failed to check pending payments');
  }

  return (pendingPayments?.length || 0) > 0;
}