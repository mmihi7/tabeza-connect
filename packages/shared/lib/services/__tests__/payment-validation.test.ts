/**
 * Payment Validation Service Tests
 * Tests the enhanced payment validation logic
 */

import { validatePaymentRequest, getTabBalance, checkPendingMpesaPayments } from '../payment-validation';

// Mock the dependencies
jest.mock('@/lib/supabase', () => ({
  createServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          limit: jest.fn(),
          in: jest.fn(() => ({
            limit: jest.fn()
          }))
        }))
      }))
    }))
  }))
}));

jest.mock('./tab-resolution', () => ({
  resolveTabForPayment: jest.fn()
}));

describe('Payment Validation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validatePaymentRequest', () => {
    it('should validate basic payment request structure', async () => {
      const { resolveTabForPayment } = require('./tab-resolution');
      const { createServiceRoleClient } = require('@/lib/supabase');
      
      // Mock successful tab resolution
      resolveTabForPayment.mockResolvedValue({
        id: 'tab-123',
        bar_id: 'bar-456',
        status: 'open'
      });

      // Mock successful balance query
      const mockSupabase = createServiceRoleClient();
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { balance: 100 },
        error: null
      });

      const request = {
        tabId: 'tab-123',
        amount: 50,
        phoneNumber: '+254712345678'
      };

      const result = await validatePaymentRequest(request);
      
      expect(result.isValid).toBe(true);
      expect(result.tab).toBeDefined();
      expect(result.balance).toBe(100);
    });

    it('should reject payment with zero amount', async () => {
      const request = {
        tabId: 'tab-123',
        amount: 0,
        phoneNumber: '+254712345678'
      };

      const result = await validatePaymentRequest(request);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Payment amount must be greater than zero');
    });

    it('should reject payment with negative amount', async () => {
      const request = {
        tabId: 'tab-123',
        amount: -10,
        phoneNumber: '+254712345678'
      };

      const result = await validatePaymentRequest(request);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Payment amount must be greater than zero');
    });

    it('should reject payment with excessive amount', async () => {
      const request = {
        tabId: 'tab-123',
        amount: 1000000,
        phoneNumber: '+254712345678'
      };

      const result = await validatePaymentRequest(request);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Payment amount cannot exceed KSh 999,999');
    });

    it('should reject payment for closed tab', async () => {
      const { resolveTabForPayment } = require('./tab-resolution');
      
      // Mock tab resolution returning closed tab
      resolveTabForPayment.mockResolvedValue({
        id: 'tab-123',
        bar_id: 'bar-456',
        status: 'closed'
      });

      const request = {
        tabId: 'tab-123',
        amount: 50,
        phoneNumber: '+254712345678'
      };

      const result = await validatePaymentRequest(request);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Tab is not available for payments');
    });

    it('should accept payment for overdue tab', async () => {
      const { resolveTabForPayment } = require('./tab-resolution');
      const { createServiceRoleClient } = require('@/lib/supabase');
      
      // Mock successful tab resolution for overdue tab
      resolveTabForPayment.mockResolvedValue({
        id: 'tab-123',
        bar_id: 'bar-456',
        status: 'overdue'
      });

      // Mock successful balance query
      const mockSupabase = createServiceRoleClient();
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { balance: 100 },
        error: null
      });

      const request = {
        tabId: 'tab-123',
        amount: 50,
        phoneNumber: '+254712345678'
      };

      const result = await validatePaymentRequest(request);
      
      expect(result.isValid).toBe(true);
      expect(result.tab?.status).toBe('overdue');
    });
  });

  describe('checkPendingMpesaPayments', () => {
    it('should detect pending M-Pesa payments', async () => {
      const { createServiceRoleClient } = require('@/lib/supabase');
      const mockSupabase = createServiceRoleClient();
      
      // Mock finding pending payments
      mockSupabase.from().select().eq().eq().in().limit.mockResolvedValue({
        data: [{ id: 'payment-123' }],
        error: null
      });

      const result = await checkPendingMpesaPayments('tab-123');
      
      expect(result).toBe(true);
    });

    it('should return false when no pending payments exist', async () => {
      const { createServiceRoleClient } = require('@/lib/supabase');
      const mockSupabase = createServiceRoleClient();
      
      // Mock no pending payments
      mockSupabase.from().select().eq().eq().in().limit.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await checkPendingMpesaPayments('tab-123');
      
      expect(result).toBe(false);
    });
  });
});