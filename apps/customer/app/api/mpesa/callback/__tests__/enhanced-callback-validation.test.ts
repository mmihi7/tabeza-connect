/**
 * Tests for Enhanced M-Pesa Callback Validation and Processing
 * Task 4.1 and 4.2: Enhanced callback handling (critical path)
 * Task 5: Inline verification rules (no separate service)
 * Requirements: 3.2, 3.3, 3.4, 5.1, 5.2, 5.4, 5.5
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock the Supabase client with proper chaining and typing
const mockSingle = jest.fn();
const mockEq = jest.fn(() => ({ single: mockSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));

const mockUpdateEq = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }));

const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: mockSelect,
    update: mockUpdate
  }))
};

// Mock createClient
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabaseClient
}));

describe('Enhanced M-Pesa Callback Validation and Processing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    
    // Set up environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'test-secret-key';
  });

  describe('Task 4.1: Robust callback parsing and validation', () => {
    it('should validate callback structure and required fields', async () => {
      const invalidCallback = {
        Body: {
          // Missing stkCallback
        }
      };

      const request = new NextRequest('http://localhost:3000/api/mpesa/callback', {
        method: 'POST',
        body: JSON.stringify(invalidCallback),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ResultCode).toBe(0);
      expect(result.ResultDesc).toBe('Callback received but validation failed');
    });

    it('should handle missing CheckoutRequestID gracefully', async () => {
      const callbackWithoutCheckoutId = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant-123',
            // Missing CheckoutRequestID
            ResultCode: 0,
            ResultDesc: 'Success'
          }
        }
      };

      const request = new NextRequest('http://localhost:3000/api/mpesa/callback', {
        method: 'POST',
        body: JSON.stringify(callbackWithoutCheckoutId),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ResultCode).toBe(0);
      expect(result.ResultDesc).toBe('Callback received but validation failed');
    });

    it('should handle payment not found gracefully (Requirements 3.3)', async () => {
      // Mock payment not found
      mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Payment not found' }
      });

      const validCallback = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant-123',
            CheckoutRequestID: 'checkout-456',
            ResultCode: 0,
            ResultDesc: 'Success'
          }
        }
      };

      const request = new NextRequest('http://localhost:3000/api/mpesa/callback', {
        method: 'POST',
        body: JSON.stringify(validCallback),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ResultCode).toBe(0);
      expect(result.ResultDesc).toBe('Callback received but payment not found');
      
      // Verify graceful logging
      expect(console.log).toHaveBeenCalledWith(
        'Payment not found for CheckoutRequestID (graceful handling):',
        expect.objectContaining({
          checkoutRequestId: 'checkout-456'
        })
      );
    });
  });

  describe('Task 4.2: Callback processing logic', () => {
    it('should process successful payment (ResultCode === 0)', async () => {
      // Mock successful payment lookup
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            id: 'payment-123',
            tab_id: 'tab-456',
            amount: 1000,
            status: 'stk_sent'
          },
          error: null
        })
        // Mock verification lookup
        .mockResolvedValueOnce({
          data: {
            id: 'payment-123',
            amount: 1000,
            status: 'stk_sent',
            checkout_request_id: 'checkout-456'
          },
          error: null
        });

      // Mock successful payment update
      mockSupabaseClient.from().update().eq.mockResolvedValueOnce({
        error: null
      });

      // Mock tab lookup for resolution
      mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
        data: {
          id: 'tab-456',
          status: 'open',
          bar_id: 'bar-789'
        },
        error: null
      });

      const successfulCallback = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant-123',
            CheckoutRequestID: 'checkout-456',
            ResultCode: 0,
            ResultDesc: 'The service request is processed successfully.',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 1000 },
                { Name: 'MpesaReceiptNumber', Value: 'ABC123DEF' },
                { Name: 'TransactionDate', Value: 20231201120000 },
                { Name: 'PhoneNumber', Value: 254712345678 }
              ]
            }
          }
        }
      };

      const request = new NextRequest('http://localhost:3000/api/mpesa/callback', {
        method: 'POST',
        body: JSON.stringify(successfulCallback),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ResultCode).toBe(0);
      expect(result.ResultDesc).toBe('Callback processed successfully');

      // Verify payment was updated with success status
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          mpesa_receipt: 'ABC123DEF'
        })
      );
    });

    it('should process failed payment (ResultCode !== 0)', async () => {
      // Mock payment lookup
      mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
        data: {
          id: 'payment-123',
          tab_id: 'tab-456',
          amount: 1000,
          status: 'stk_sent'
        },
        error: null
      });

      // Mock payment update
      mockSupabaseClient.from().update().eq.mockResolvedValueOnce({
        error: null
      });

      const failedCallback = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant-123',
            CheckoutRequestID: 'checkout-456',
            ResultCode: 1,
            ResultDesc: 'Insufficient funds'
          }
        }
      };

      const request = new NextRequest('http://localhost:3000/api/mpesa/callback', {
        method: 'POST',
        body: JSON.stringify(failedCallback),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ResultCode).toBe(0);
      expect(result.ResultDesc).toBe('Callback processed successfully');

      // Verify payment was updated with failed status
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed'
        })
      );
    });

    it('should handle callback idempotency through database constraints', async () => {
      // Mock payment lookup
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            id: 'payment-123',
            tab_id: 'tab-456',
            amount: 1000,
            status: 'stk_sent'
          },
          error: null
        })
        // Mock verification lookup
        .mockResolvedValueOnce({
          data: {
            id: 'payment-123',
            amount: 1000,
            status: 'stk_sent',
            checkout_request_id: 'checkout-456'
          },
          error: null
        });

      // Mock unique constraint violation (idempotency)
      mockSupabaseClient.from().update().eq.mockResolvedValueOnce({
        error: { code: '23505', message: 'Unique constraint violation' }
      });

      const duplicateCallback = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant-123',
            CheckoutRequestID: 'checkout-456',
            ResultCode: 0,
            ResultDesc: 'Success',
            CallbackMetadata: {
              Item: [
                { Name: 'MpesaReceiptNumber', Value: 'ABC123DEF' }
              ]
            }
          }
        }
      };

      const request = new NextRequest('http://localhost:3000/api/mpesa/callback', {
        method: 'POST',
        body: JSON.stringify(duplicateCallback),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ResultCode).toBe(0);
      expect(result.ResultDesc).toBe('Callback processed successfully');

      // Verify idempotency was logged
      expect(console.log).toHaveBeenCalledWith(
        'Callback idempotency: Payment already processed:',
        expect.objectContaining({
          checkoutRequestId: 'checkout-456',
          paymentId: 'payment-123'
        })
      );
    });
  });

  describe('Task 5: Inline verification rules', () => {
    it('should fail payment when status is not stk_sent (Requirements 5.2)', async () => {
      // Mock payment lookup
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            id: 'payment-123',
            tab_id: 'tab-456',
            amount: 1000,
            status: 'stk_sent'
          },
          error: null
        })
        // Mock verification lookup - payment already processed
        .mockResolvedValueOnce({
          data: {
            id: 'payment-123',
            amount: 1000,
            status: 'success', // Already processed
            checkout_request_id: 'checkout-456'
          },
          error: null
        });

      // Mock payment update to failed
      mockSupabaseClient.from().update().eq.mockResolvedValueOnce({
        error: null
      });

      const successfulCallback = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant-123',
            CheckoutRequestID: 'checkout-456',
            ResultCode: 0,
            ResultDesc: 'Success',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 1000 },
                { Name: 'MpesaReceiptNumber', Value: 'ABC123DEF' }
              ]
            }
          }
        }
      };

      const request = new NextRequest('http://localhost:3000/api/mpesa/callback', {
        method: 'POST',
        body: JSON.stringify(successfulCallback),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ResultCode).toBe(0);
      expect(result.ResultDesc).toBe('Callback processed successfully');

      // Verify payment was marked as failed due to status verification
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          metadata: expect.objectContaining({
            verification_error: 'Payment not in stk_sent status',
            verification_failed: true
          })
        })
      );

      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        'Payment verification failed - invalid status:',
        expect.objectContaining({
          expectedStatus: 'stk_sent',
          actualStatus: 'success',
          verificationFailed: true
        })
      );
    });

    it('should fail payment when amount does not match (Requirements 5.1)', async () => {
      // Mock payment lookup
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            id: 'payment-123',
            tab_id: 'tab-456',
            amount: 1000,
            status: 'stk_sent'
          },
          error: null
        })
        // Mock verification lookup
        .mockResolvedValueOnce({
          data: {
            id: 'payment-123',
            amount: 1000, // Expected amount
            status: 'stk_sent',
            checkout_request_id: 'checkout-456'
          },
          error: null
        });

      // Mock payment update to failed
      mockSupabaseClient.from().update().eq.mockResolvedValueOnce({
        error: null
      });

      const mismatchCallback = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant-123',
            CheckoutRequestID: 'checkout-456',
            ResultCode: 0,
            ResultDesc: 'Success',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 500 }, // Different amount
                { Name: 'MpesaReceiptNumber', Value: 'ABC123DEF' }
              ]
            }
          }
        }
      };

      const request = new NextRequest('http://localhost:3000/api/mpesa/callback', {
        method: 'POST',
        body: JSON.stringify(mismatchCallback),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ResultCode).toBe(0);
      expect(result.ResultDesc).toBe('Callback processed successfully');

      // Verify payment was marked as failed due to amount mismatch
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          metadata: expect.objectContaining({
            verification_error: 'Amount mismatch',
            expected_amount: 1000,
            actual_amount: 500,
            verification_failed: true
          })
        })
      );

      // Verify error was logged
      expect(console.error).toHaveBeenCalledWith(
        'Payment verification failed - amount mismatch:',
        expect.objectContaining({
          expectedAmount: 1000,
          actualAmount: 500,
          verificationFailed: true
        })
      );
    });

    it('should pass verification when amount and status are correct', async () => {
      // Mock payment lookup
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            id: 'payment-123',
            tab_id: 'tab-456',
            amount: 1000,
            status: 'stk_sent'
          },
          error: null
        })
        // Mock verification lookup
        .mockResolvedValueOnce({
          data: {
            id: 'payment-123',
            amount: 1000,
            status: 'stk_sent',
            checkout_request_id: 'checkout-456'
          },
          error: null
        });

      // Mock successful payment update
      mockSupabaseClient.from().update().eq.mockResolvedValueOnce({
        error: null
      });

      // Mock tab lookup for resolution
      mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
        data: {
          id: 'tab-456',
          status: 'open',
          bar_id: 'bar-789'
        },
        error: null
      });

      const validCallback = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant-123',
            CheckoutRequestID: 'checkout-456',
            ResultCode: 0,
            ResultDesc: 'Success',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 1000 }, // Matching amount
                { Name: 'MpesaReceiptNumber', Value: 'ABC123DEF' }
              ]
            }
          }
        }
      };

      const request = new NextRequest('http://localhost:3000/api/mpesa/callback', {
        method: 'POST',
        body: JSON.stringify(validCallback),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ResultCode).toBe(0);
      expect(result.ResultDesc).toBe('Callback processed successfully');

      // Verify payment was updated with success status
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          mpesa_receipt: 'ABC123DEF'
        })
      );

      // Verify verification passed log
      expect(console.log).toHaveBeenCalledWith(
        'Payment verification passed:',
        expect.objectContaining({
          statusVerified: true,
          amountVerified: true,
          expectedAmount: 1000,
          actualAmount: 1000
        })
      );
    });
  });
});