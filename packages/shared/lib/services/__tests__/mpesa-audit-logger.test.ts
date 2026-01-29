/**
 * Unit tests for M-Pesa Audit Logger
 * Tests task 6: Essential logging and observability
 * Requirements: 6.4, 7.1, 7.2
 */

import { MpesaAuditLogger, logMpesaPaymentEvent, logMpesaStateTransition } from '../mpesa-audit-logger';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
};

// Mock createClient
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

describe('MpesaAuditLogger', () => {
  let logger: MpesaAuditLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'test-secret-key';
    
    // Reset insert mock to return success
    mockSupabase.insert.mockResolvedValue({ error: null });
    
    logger = new MpesaAuditLogger();
  });

  describe('logPaymentEvent', () => {
    it('should log payment initiation event', async () => {
      const testData = {
        tab_id: 'tab-123',
        tab_payment_id: 'payment-456',
        bar_id: 'bar-789',
        amount: 100,
        phone_number: '254712345678',
        environment: 'sandbox' as const
      };

      await logger.logPaymentEvent('payment_initiated', testData);

      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'payment_initiated',
          bar_id: 'bar-789',
          tab_id: 'tab-123',
          staff_id: null,
          details: expect.objectContaining({
            tab_payment_id: 'payment-456',
            amount: 100,
            phone_number: '254*******78', // Should be masked
            environment: 'sandbox'
          })
        })
      );
    });

    it('should redact sensitive STK Push payload data', async () => {
      const testData = {
        tab_id: 'tab-123',
        tab_payment_id: 'payment-456',
        stk_request_payload: {
          BusinessShortCode: '174379',
          Password: 'sensitive-password',
          Amount: 100,
          PhoneNumber: '254712345678',
          CallBackURL: 'https://example.com/callback'
        }
      };

      await logger.logPaymentEvent('payment_stk_sent', testData);

      const insertCall = mockSupabase.insert.mock.calls[0][0];
      const stkPayload = insertCall.details.stk_request_payload;

      expect(stkPayload.Password).toBe('[REDACTED]');
      expect(stkPayload.PhoneNumber).toBe('254*******78'); // Masked
      expect(stkPayload.BusinessShortCode).toBe('174379'); // Not redacted
      expect(stkPayload.Amount).toBe(100); // Not redacted
    });

    it('should redact callback data phone numbers', async () => {
      const testData = {
        tab_id: 'tab-123',
        callback_data: {
          Body: {
            stkCallback: {
              CallbackMetadata: {
                Item: [
                  { Name: 'Amount', Value: 100 },
                  { Name: 'PhoneNumber', Value: '254712345678' },
                  { Name: 'MpesaReceiptNumber', Value: 'ABC123' }
                ]
              }
            }
          }
        }
      };

      await logger.logPaymentEvent('payment_callback_received', testData);

      const insertCall = mockSupabase.insert.mock.calls[0][0];
      const callbackData = insertCall.details.callback_data;
      const phoneItem = callbackData.Body.stkCallback.CallbackMetadata.Item.find(
        (item: any) => item.Name === 'PhoneNumber'
      );

      expect(phoneItem.Value).toBe('254*******78'); // Should be masked
    });

    it('should handle database errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSupabase.insert.mockResolvedValue({ error: { message: 'Database error' } });

      const testData = {
        tab_id: 'tab-123',
        tab_payment_id: 'payment-456'
      };

      // Should not throw
      await expect(logger.logPaymentEvent('payment_initiated', testData)).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to create M-Pesa audit log:',
        expect.objectContaining({
          action: 'payment_initiated',
          error: 'Database error'
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('logStateTransition', () => {
    it('should log payment state transitions', async () => {
      const testData = {
        tab_id: 'tab-123',
        tab_payment_id: 'payment-456',
        checkout_request_id: 'checkout-789',
        previous_status: 'initiated',
        new_status: 'stk_sent',
        transition_reason: 'STK Push successful'
      };

      await logger.logStateTransition(testData);

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'payment_state_transition',
          details: expect.objectContaining({
            previous_status: 'initiated',
            new_status: 'stk_sent',
            transition_reason: 'STK Push successful'
          })
        })
      );
    });
  });

  describe('phone number masking', () => {
    it('should mask phone numbers correctly', async () => {
      const testCases = [
        { input: '254712345678', expected: '254*******78' }, // 12 digits: 3 + 7 + 2
        { input: '0712345678', expected: '071*****78' }, // 10 digits: 3 + 5 + 2
        { input: '12345', expected: '[MASKED]' }, // Too short
        { input: '', expected: '[MASKED]' } // Empty
      ];

      for (const testCase of testCases) {
        const testData = {
          phone_number: testCase.input
        };

        await logger.logPaymentEvent('payment_initiated', testData);

        const insertCall = mockSupabase.insert.mock.calls[mockSupabase.insert.mock.calls.length - 1][0];
        
        if (testCase.input === '' || testCase.input.length < 6) {
          expect(insertCall.details.phone_number).toBe(testCase.expected);
        } else {
          expect(insertCall.details.phone_number).toBe(testCase.expected);
        }
      }
    });
  });
});

describe('Convenience functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'test-secret-key';
    mockSupabase.insert.mockResolvedValue({ error: null });
  });

  it('should use singleton logger instance', async () => {
    const testData = {
      tab_id: 'tab-123',
      tab_payment_id: 'payment-456'
    };

    await logMpesaPaymentEvent('payment_initiated', testData);
    await logMpesaPaymentEvent('payment_completed', testData);

    // Should have been called twice with the same logger instance
    expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    expect(mockSupabase.insert).toHaveBeenCalledTimes(2);
  });

  it('should log state transitions using convenience function', async () => {
    const testData = {
      tab_id: 'tab-123',
      tab_payment_id: 'payment-456',
      previous_status: 'stk_sent',
      new_status: 'success',
      transition_reason: 'Payment successful'
    };

    await logMpesaStateTransition(testData);

    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'payment_state_transition',
        details: expect.objectContaining({
          previous_status: 'stk_sent',
          new_status: 'success',
          transition_reason: 'Payment successful'
        })
      })
    );
  });
});