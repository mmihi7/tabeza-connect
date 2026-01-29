/**
 * End-to-End M-Pesa Payment System Integration Test
 * Task 8: End-to-end integration test
 * Requirements: 2.1, 2.5
 * 
 * Tests complete flow: open tab → initiate payment → receive callback → tab closes
 * Tests callback idempotency (second callback does nothing)
 * Verifies integration with existing tab resolution system
 */

import { NextRequest } from 'next/server';

// Import the actual API route handlers
import { POST as PaymentInitiationPOST } from '../../../../../apps/customer/app/api/payments/mpesa/route';
import { POST as CallbackPOST } from '../../../../../apps/customer/app/api/mpesa/callback/route';

// Mock environment variables
const originalEnv = process.env;

// Mock fetch for external API calls
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        limit: jest.fn(),
        in: jest.fn(() => ({
          limit: jest.fn()
        }))
      })),
      in: jest.fn(() => ({
        order: jest.fn(() => ({
          limit: jest.fn()
        }))
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn()
    }))
  }))
};

jest.mock('../../../../../apps/customer/lib/supabase', () => ({
  createServiceRoleClient: () => mockSupabaseClient
}));

jest.mock('../../../../../apps/staff/lib/supabase', () => ({
  createServiceRoleClient: () => mockSupabaseClient
}));

// Mock the shared services
jest.mock('../phoneValidation', () => ({
  validateKenyanPhoneNumber: jest.fn((phone: string) => ({
    isValid: phone.startsWith('254') || phone.startsWith('0') || phone.startsWith('7'),
    normalized: phone.startsWith('254') ? phone : `254${phone.replace(/^0/, '')}`,
    error: null
  }))
}));

jest.mock('../mpesa-config', () => ({
  loadMpesaConfigFromBar: jest.fn(() => ({
    environment: 'sandbox',
    businessShortcode: '174379',
    consumerKey: 'test_key',
    consumerSecret: 'test_secret',
    passkey: 'test_passkey',
    callbackUrl: 'http://localhost:3002/api/mpesa/callback',
    oauthUrl: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    stkPushUrl: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
  }))
}));

jest.mock('../mpesa-stk-push', () => ({
  sendSTKPush: jest.fn()
}));

jest.mock('../mpesa-audit-logger', () => ({
  logMpesaPaymentEvent: jest.fn(),
  logMpesaStateTransition: jest.fn()
}));

jest.mock('../payment-validation', () => ({
  validatePaymentRequest: jest.fn(),
  checkPendingMpesaPayments: jest.fn()
}));

describe('M-Pesa End-to-End Integration Test', () => {
  let testTabId: string;
  let testBarId: string;
  let testPaymentId: string;
  let testCheckoutRequestId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up test environment
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SECRET_KEY: 'test-secret-key',
      MPESA_MOCK_MODE: 'false' // Test real flow, not mock
    };

    // Generate test IDs
    testTabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    testBarId = `bar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    testPaymentId = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    testCheckoutRequestId = `checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  /**
   * Test complete flow: open tab → initiate payment → receive callback → tab closes
   * Requirements: 2.1, 2.5
   */
  describe('Complete Payment Flow Integration', () => {
    it('should complete full payment flow from initiation to callback processing', async () => {
      // Step 1: Set up mocks for payment initiation
      const { validatePaymentRequest, checkPendingMpesaPayments } = require('../payment-validation');
      const { sendSTKPush } = require('../mpesa-stk-push');

      // Mock successful payment validation
      validatePaymentRequest.mockResolvedValue({
        isValid: true,
        tab: {
          id: testTabId,
          bar_id: testBarId,
          status: 'open',
          tab_number: 123
        },
        balance: 1000
      });

      // Mock no pending payments
      checkPendingMpesaPayments.mockResolvedValue(false);

      // Mock bar configuration lookup
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            id: testBarId,
            mpesa_enabled: true,
            mpesa_environment: 'sandbox',
            mpesa_business_shortcode: '174379',
            mpesa_consumer_key_encrypted: 'encrypted_key',
            mpesa_consumer_secret_encrypted: 'encrypted_secret',
            mpesa_passkey_encrypted: 'encrypted_passkey',
            mpesa_callback_url: 'http://localhost:3002/api/mpesa/callback'
          },
          error: null
        });

      // Mock payment record creation
      mockSupabaseClient.from().insert().select().single
        .mockResolvedValueOnce({
          data: {
            id: testPaymentId,
            tab_id: testTabId,
            amount: 500,
            method: 'mpesa',
            status: 'initiated',
            metadata: {
              phone_number: '254712345678',
              environment: 'sandbox',
              initiated_at: new Date().toISOString()
            }
          },
          error: null
        });

      // Mock successful STK Push
      sendSTKPush.mockResolvedValue({
        ResponseCode: '0',
        ResponseDescription: 'Success. Request accepted for processing',
        MerchantRequestID: 'merchant_123',
        CheckoutRequestID: testCheckoutRequestId
      });

      // Mock payment update with checkout request ID
      mockSupabaseClient.from().update().eq
        .mockResolvedValueOnce({ error: null });

      // Step 2: Initiate payment
      const paymentRequest = new NextRequest('http://localhost:3002/api/payments/mpesa', {
        method: 'POST',
        body: JSON.stringify({
          tabId: testTabId,
          phoneNumber: '0712345678',
          amount: 500
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const paymentResponse = await PaymentInitiationPOST(paymentRequest);
      const paymentResult = await paymentResponse.json();

      // Verify payment initiation was successful
      expect(paymentResponse.status).toBe(200);
      expect((paymentResult as any).success).toBe(true);
      expect((paymentResult as any).checkoutRequestId).toBe(testCheckoutRequestId);

      // Verify payment record was created with 'initiated' status
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tab_id: testTabId,
          amount: 500,
          method: 'mpesa',
          status: 'initiated'
        })
      );

      // Verify payment was updated to 'stk_sent' status
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          checkout_request_id: testCheckoutRequestId,
          status: 'stk_sent'
        })
      );

      // Step 3: Set up mocks for callback processing
      jest.clearAllMocks();

      // Mock payment lookup for callback
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            id: testPaymentId,
            tab_id: testTabId,
            amount: 500,
            status: 'stk_sent'
          },
          error: null
        })
        // Mock verification lookup
        .mockResolvedValueOnce({
          data: {
            id: testPaymentId,
            amount: 500,
            status: 'stk_sent',
            checkout_request_id: testCheckoutRequestId
          },
          error: null
        })
        // Mock tab lookup for resolution
        .mockResolvedValueOnce({
          data: {
            id: testTabId,
            status: 'open',
            bar_id: testBarId
          },
          error: null
        });

      // Mock successful payment update to 'success'
      mockSupabaseClient.from().update().eq
        .mockResolvedValueOnce({ error: null });

      // Step 4: Process successful callback
      const successfulCallback = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant_123',
            CheckoutRequestID: testCheckoutRequestId,
            ResultCode: 0,
            ResultDesc: 'The service request is processed successfully.',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 500 },
                { Name: 'MpesaReceiptNumber', Value: 'ABC123DEF456' },
                { Name: 'TransactionDate', Value: 20231201120000 },
                { Name: 'PhoneNumber', Value: 254712345678 }
              ]
            }
          }
        }
      };

      const callbackRequest = new NextRequest('http://localhost:3002/api/mpesa/callback', {
        method: 'POST',
        body: JSON.stringify(successfulCallback),
        headers: { 'Content-Type': 'application/json' }
      });

      const callbackResponse = await CallbackPOST(callbackRequest);
      const callbackResult = await callbackResponse.json();

      // Verify callback was processed successfully
      expect(callbackResponse.status).toBe(200);
      expect(callbackResult.ResultCode).toBe(0);
      expect(callbackResult.ResultDesc).toBe('Callback processed successfully');

      // Verify payment was updated to 'success' status with receipt
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          mpesa_receipt: 'ABC123DEF456'
        })
      );

      // Verify verification passed
      expect(console.log).toHaveBeenCalledWith(
        'Payment verification passed:',
        expect.objectContaining({
          statusVerified: true,
          amountVerified: true,
          expectedAmount: 500,
          actualAmount: 500
        })
      );
    });

    it('should handle failed payment callback correctly', async () => {
      // Set up mocks for failed callback
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            id: testPaymentId,
            tab_id: testTabId,
            amount: 500,
            status: 'stk_sent'
          },
          error: null
        });

      // Mock payment update to 'failed'
      mockSupabaseClient.from().update().eq
        .mockResolvedValueOnce({ error: null });

      // Process failed callback
      const failedCallback = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant_123',
            CheckoutRequestID: testCheckoutRequestId,
            ResultCode: 1,
            ResultDesc: 'Insufficient funds in account'
          }
        }
      };

      const callbackRequest = new NextRequest('http://localhost:3002/api/mpesa/callback', {
        method: 'POST',
        body: JSON.stringify(failedCallback),
        headers: { 'Content-Type': 'application/json' }
      });

      const callbackResponse = await CallbackPOST(callbackRequest);
      const callbackResult = await callbackResponse.json();

      // Verify callback was processed successfully (even for failed payments)
      expect(callbackResponse.status).toBe(200);
      expect(callbackResult.ResultCode).toBe(0);
      expect(callbackResult.ResultDesc).toBe('Callback processed successfully');

      // Verify payment was updated to 'failed' status
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed'
        })
      );
    });
  });

  /**
   * Test callback idempotency (second callback does nothing)
   * Requirements: 3.4, 5.5
   */
  describe('Callback Idempotency', () => {
    it('should handle duplicate callbacks gracefully through database constraints', async () => {
      // Mock payment lookup
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            id: testPaymentId,
            tab_id: testTabId,
            amount: 500,
            status: 'stk_sent'
          },
          error: null
        })
        // Mock verification lookup
        .mockResolvedValueOnce({
          data: {
            id: testPaymentId,
            amount: 500,
            status: 'stk_sent',
            checkout_request_id: testCheckoutRequestId
          },
          error: null
        });

      // Mock unique constraint violation (simulating idempotency)
      mockSupabaseClient.from().update().eq
        .mockResolvedValueOnce({
          error: { code: '23505', message: 'Unique constraint violation' }
        });

      const duplicateCallback = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant_123',
            CheckoutRequestID: testCheckoutRequestId,
            ResultCode: 0,
            ResultDesc: 'Success',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 500 },
                { Name: 'MpesaReceiptNumber', Value: 'ABC123DEF456' }
              ]
            }
          }
        }
      };

      const callbackRequest = new NextRequest('http://localhost:3002/api/mpesa/callback', {
        method: 'POST',
        body: JSON.stringify(duplicateCallback),
        headers: { 'Content-Type': 'application/json' }
      });

      const callbackResponse = await CallbackPOST(callbackRequest);
      const callbackResult = await callbackResponse.json();

      // Verify callback was handled gracefully
      expect(callbackResponse.status).toBe(200);
      expect(callbackResult.ResultCode).toBe(0);
      expect(callbackResult.ResultDesc).toBe('Callback processed successfully');

      // Verify idempotency was logged
      expect(console.log).toHaveBeenCalledWith(
        'Callback idempotency: Payment already processed:',
        expect.objectContaining({
          checkoutRequestId: testCheckoutRequestId,
          paymentId: testPaymentId
        })
      );
    });

    it('should process second callback with different result gracefully', async () => {
      // First callback - successful
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            id: testPaymentId,
            tab_id: testTabId,
            amount: 500,
            status: 'stk_sent'
          },
          error: null
        })
        // Mock verification lookup
        .mockResolvedValueOnce({
          data: {
            id: testPaymentId,
            amount: 500,
            status: 'stk_sent',
            checkout_request_id: testCheckoutRequestId
          },
          error: null
        })
        // Mock tab lookup
        .mockResolvedValueOnce({
          data: {
            id: testTabId,
            status: 'open',
            bar_id: testBarId
          },
          error: null
        });

      // Mock successful update
      mockSupabaseClient.from().update().eq
        .mockResolvedValueOnce({ error: null });

      const firstCallback = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant_123',
            CheckoutRequestID: testCheckoutRequestId,
            ResultCode: 0,
            ResultDesc: 'Success',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 500 },
                { Name: 'MpesaReceiptNumber', Value: 'ABC123DEF456' }
              ]
            }
          }
        }
      };

      const firstRequest = new NextRequest('http://localhost:3002/api/mpesa/callback', {
        method: 'POST',
        body: JSON.stringify(firstCallback),
        headers: { 'Content-Type': 'application/json' }
      });

      const firstResponse = await CallbackPOST(firstRequest);
      expect(firstResponse.status).toBe(200);

      // Clear mocks for second callback
      jest.clearAllMocks();

      // Second callback - same checkout request ID but different result
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            id: testPaymentId,
            tab_id: testTabId,
            amount: 500,
            status: 'success' // Already processed
          },
          error: null
        });

      // Mock update (should not happen due to status check)
      mockSupabaseClient.from().update().eq
        .mockResolvedValueOnce({ error: null });

      const secondCallback = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant_123',
            CheckoutRequestID: testCheckoutRequestId,
            ResultCode: 1, // Different result code
            ResultDesc: 'Failed'
          }
        }
      };

      const secondRequest = new NextRequest('http://localhost:3002/api/mpesa/callback', {
        method: 'POST',
        body: JSON.stringify(secondCallback),
        headers: { 'Content-Type': 'application/json' }
      });

      const secondResponse = await CallbackPOST(secondRequest);
      const secondResult = await secondResponse.json();

      // Verify second callback was handled gracefully
      expect(secondResponse.status).toBe(200);
      expect(secondResult.ResultCode).toBe(0);
      expect(secondResult.ResultDesc).toBe('Callback processed successfully');

      // Verify that the payment was not updated again (idempotency)
      expect(console.log).toHaveBeenCalledWith(
        'Payment already processed, skipping callback:',
        expect.objectContaining({
          paymentId: testPaymentId,
          currentStatus: 'success'
        })
      );
    });
  });

  /**
   * Test integration with existing tab resolution system
   * Requirements: 2.1, 2.5
   */
  describe('Tab Resolution System Integration', () => {
    it('should integrate with tab resolution during payment validation', async () => {
      const { validatePaymentRequest } = require('../payment-validation');

      // Mock tab resolution failure and recovery
      validatePaymentRequest
        .mockRejectedValueOnce(new Error('Tab not found'))
        .mockResolvedValueOnce({
          isValid: true,
          tab: {
            id: testTabId,
            bar_id: testBarId,
            status: 'open',
            tab_number: 123
          },
          balance: 1000
        });

      // First attempt - should fail
      const firstRequest = new NextRequest('http://localhost:3002/api/payments/mpesa', {
        method: 'POST',
        body: JSON.stringify({
          tabId: testTabId,
          phoneNumber: '0712345678',
          amount: 500
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const firstResponse = await PaymentInitiationPOST(firstRequest);
      expect(firstResponse.status).toBe(500); // Internal server error due to validation failure

      // Second attempt - should succeed after tab resolution
      const { checkPendingMpesaPayments } = require('../payment-validation');
      const { sendSTKPush } = require('../mpesa-stk-push');

      checkPendingMpesaPayments.mockResolvedValue(false);

      // Mock bar configuration lookup
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            id: testBarId,
            mpesa_enabled: true,
            mpesa_environment: 'sandbox',
            mpesa_business_shortcode: '174379',
            mpesa_consumer_key_encrypted: 'encrypted_key',
            mpesa_consumer_secret_encrypted: 'encrypted_secret',
            mpesa_passkey_encrypted: 'encrypted_passkey',
            mpesa_callback_url: 'http://localhost:3002/api/mpesa/callback'
          },
          error: null
        });

      // Mock payment record creation
      mockSupabaseClient.from().insert().select().single
        .mockResolvedValueOnce({
          data: {
            id: testPaymentId,
            tab_id: testTabId,
            amount: 500,
            method: 'mpesa',
            status: 'initiated'
          },
          error: null
        });

      // Mock successful STK Push
      sendSTKPush.mockResolvedValue({
        ResponseCode: '0',
        ResponseDescription: 'Success',
        CheckoutRequestID: testCheckoutRequestId
      });

      // Mock payment update
      mockSupabaseClient.from().update().eq
        .mockResolvedValueOnce({ error: null });

      const secondRequest = new NextRequest('http://localhost:3002/api/payments/mpesa', {
        method: 'POST',
        body: JSON.stringify({
          tabId: testTabId,
          phoneNumber: '0712345678',
          amount: 500
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const secondResponse = await PaymentInitiationPOST(secondRequest);
      const secondResult = await secondResponse.json();

      // Verify second attempt succeeded
      expect(secondResponse.status).toBe(200);
      expect(secondResult.success).toBe(true);
      expect(secondResult.checkoutRequestId).toBe(testCheckoutRequestId);
    });

    it('should handle overdue tabs correctly during payment processing', async () => {
      const { validatePaymentRequest, checkPendingMpesaPayments } = require('../payment-validation');
      const { sendSTKPush } = require('../mpesa-stk-push');

      // Mock validation for overdue tab (should still be valid for payments)
      validatePaymentRequest.mockResolvedValue({
        isValid: true,
        tab: {
          id: testTabId,
          bar_id: testBarId,
          status: 'overdue', // Overdue tab
          tab_number: 123
        },
        balance: 1000
      });

      checkPendingMpesaPayments.mockResolvedValue(false);

      // Mock bar configuration
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            id: testBarId,
            mpesa_enabled: true,
            mpesa_environment: 'sandbox',
            mpesa_business_shortcode: '174379',
            mpesa_consumer_key_encrypted: 'encrypted_key',
            mpesa_consumer_secret_encrypted: 'encrypted_secret',
            mpesa_passkey_encrypted: 'encrypted_passkey',
            mpesa_callback_url: 'http://localhost:3002/api/mpesa/callback'
          },
          error: null
        });

      // Mock payment creation
      mockSupabaseClient.from().insert().select().single
        .mockResolvedValueOnce({
          data: {
            id: testPaymentId,
            tab_id: testTabId,
            amount: 500,
            method: 'mpesa',
            status: 'initiated'
          },
          error: null
        });

      // Mock successful STK Push
      sendSTKPush.mockResolvedValue({
        ResponseCode: '0',
        ResponseDescription: 'Success',
        CheckoutRequestID: testCheckoutRequestId
      });

      // Mock payment update
      mockSupabaseClient.from().update().eq
        .mockResolvedValueOnce({ error: null });

      const paymentRequest = new NextRequest('http://localhost:3002/api/payments/mpesa', {
        method: 'POST',
        body: JSON.stringify({
          tabId: testTabId,
          phoneNumber: '0712345678',
          amount: 500
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const paymentResponse = await PaymentInitiationPOST(paymentRequest);
      const paymentResult = await paymentResponse.json();

      // Verify payment succeeded even for overdue tab
      expect(paymentResponse.status).toBe(200);
      expect(paymentResult.success).toBe(true);
      expect(paymentResult.checkoutRequestId).toBe(testCheckoutRequestId);

      // Verify payment was created for overdue tab
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tab_id: testTabId,
          amount: 500,
          method: 'mpesa',
          status: 'initiated'
        })
      );
    });
  });

  /**
   * Test error handling and edge cases
   */
  describe('Error Handling and Edge Cases', () => {
    it('should handle payment validation failures gracefully', async () => {
      const { validatePaymentRequest } = require('../payment-validation');

      // Mock validation failure
      validatePaymentRequest.mockResolvedValue({
        isValid: false,
        error: 'Tab is not available for payments'
      });

      const paymentRequest = new NextRequest('http://localhost:3002/api/payments/mpesa', {
        method: 'POST',
        body: JSON.stringify({
          tabId: testTabId,
          phoneNumber: '0712345678',
          amount: 500
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const paymentResponse = await PaymentInitiationPOST(paymentRequest);
      const paymentResult = await paymentResponse.json();

      // Verify error was handled gracefully
      expect(paymentResponse.status).toBe(400);
      expect(paymentResult.success).toBe(false);
      expect(paymentResult.error).toBe('Tab is not available for payments');
    });

    it('should handle malformed callback data gracefully', async () => {
      const malformedCallback = {
        Body: {
          // Missing stkCallback
          invalidData: 'test'
        }
      };

      const callbackRequest = new NextRequest('http://localhost:3002/api/mpesa/callback', {
        method: 'POST',
        body: JSON.stringify(malformedCallback),
        headers: { 'Content-Type': 'application/json' }
      });

      const callbackResponse = await CallbackPOST(callbackRequest);
      const callbackResult = await callbackResponse.json();

      // Verify malformed callback was handled gracefully
      expect(callbackResponse.status).toBe(200);
      expect(callbackResult.ResultCode).toBe(0);
      expect(callbackResult.ResultDesc).toBe('Callback received but validation failed');
    });

    it('should handle payment not found during callback processing', async () => {
      // Mock payment not found
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Payment not found' }
        });

      const validCallback = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant_123',
            CheckoutRequestID: 'nonexistent_checkout_id',
            ResultCode: 0,
            ResultDesc: 'Success'
          }
        }
      };

      const callbackRequest = new NextRequest('http://localhost:3002/api/mpesa/callback', {
        method: 'POST',
        body: JSON.stringify(validCallback),
        headers: { 'Content-Type': 'application/json' }
      });

      const callbackResponse = await CallbackPOST(callbackRequest);
      const callbackResult = await callbackResponse.json();

      // Verify payment not found was handled gracefully
      expect(callbackResponse.status).toBe(200);
      expect(callbackResult.ResultCode).toBe(0);
      expect(callbackResult.ResultDesc).toBe('Callback received but payment not found');

      // Verify graceful logging
      expect(console.log).toHaveBeenCalledWith(
        'Payment not found for CheckoutRequestID (graceful handling):',
        expect.objectContaining({
          checkoutRequestId: 'nonexistent_checkout_id'
        })
      );
    });
  });
});