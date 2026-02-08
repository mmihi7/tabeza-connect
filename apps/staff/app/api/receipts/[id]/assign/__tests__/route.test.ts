/**
 * Unit Tests for Receipt Assignment API Endpoint
 * 
 * Task 4: Assignment Flow Implementation
 * Tests Requirements: 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3, 7.4
 */

import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
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
  }))
}));

describe('POST /api/receipts/[id]/assign', () => {
  const mockReceiptId = 'receipt-123';
  const mockTabId = 'tab-456';
  const mockBarId = 'bar-789';

  const mockReceipt = {
    id: mockReceiptId,
    bar_id: mockBarId,
    status: 'pending',
    receipt_data: {
      venueName: "Joe's Bar",
      timestamp: '2024-01-15T14:30:00.000Z',
      items: [
        { name: 'Beer', quantity: 2, unitPrice: 300, total: 600 },
        { name: 'Fries', quantity: 1, unitPrice: 200, total: 200 }
      ],
      subtotal: 800,
      tax: 128,
      total: 928
    }
  };

  const mockTab = {
    id: mockTabId,
    tab_number: 42,
    bar_id: mockBarId,
    status: 'open',
    owner_identifier: 'customer-123'
  };

  const mockOrder = {
    id: 'order-999',
    tab_id: mockTabId,
    items: mockReceipt.receipt_data.items,
    total: mockReceipt.receipt_data.total,
    status: 'confirmed'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Validation', () => {
    it('should return 400 if tabId is missing', async () => {
      const request = new NextRequest('http://localhost/api/receipts/receipt-123/assign', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(request, { params: { id: mockReceiptId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required field: tabId');
    });

    it('should return 400 if receiptId is missing', async () => {
      const request = new NextRequest('http://localhost/api/receipts//assign', {
        method: 'POST',
        body: JSON.stringify({ tabId: mockTabId })
      });

      const response = await POST(request, { params: { id: '' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing receipt ID');
    });
  });

  describe('Receipt Validation', () => {
    it('should return 404 if receipt not found', async () => {
      const { createClient } = require('@supabase/supabase-js');
      const mockSupabase = createClient();
      
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' }
      });

      const request = new NextRequest('http://localhost/api/receipts/receipt-123/assign', {
        method: 'POST',
        body: JSON.stringify({ tabId: mockTabId })
      });

      const response = await POST(request, { params: { id: mockReceiptId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Receipt not found');
    });

    it('should return 400 if receipt already assigned', async () => {
      const { createClient } = require('@supabase/supabase-js');
      const mockSupabase = createClient();
      
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: { ...mockReceipt, status: 'assigned' },
        error: null
      });

      const request = new NextRequest('http://localhost/api/receipts/receipt-123/assign', {
        method: 'POST',
        body: JSON.stringify({ tabId: mockTabId })
      });

      const response = await POST(request, { params: { id: mockReceiptId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('already been assigned');
    });

    it('should return 400 if receipt data is incomplete', async () => {
      const { createClient } = require('@supabase/supabase-js');
      const mockSupabase = createClient();
      
      // Mock receipt fetch
      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: { ...mockReceipt, receipt_data: { items: [] } },
          error: null
        })
        // Mock tab fetch
        .mockResolvedValueOnce({
          data: mockTab,
          error: null
        });

      const request = new NextRequest('http://localhost/api/receipts/receipt-123/assign', {
        method: 'POST',
        body: JSON.stringify({ tabId: mockTabId })
      });

      const response = await POST(request, { params: { id: mockReceiptId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('incomplete or invalid');
    });
  });

  describe('Tab Validation', () => {
    it('should return 404 if tab not found', async () => {
      const { createClient } = require('@supabase/supabase-js');
      const mockSupabase = createClient();
      
      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: mockReceipt,
          error: null
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Not found' }
        });

      const request = new NextRequest('http://localhost/api/receipts/receipt-123/assign', {
        method: 'POST',
        body: JSON.stringify({ tabId: mockTabId })
      });

      const response = await POST(request, { params: { id: mockReceiptId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Tab not found');
    });

    it('should return 400 if tab is not open', async () => {
      const { createClient } = require('@supabase/supabase-js');
      const mockSupabase = createClient();
      
      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: mockReceipt,
          error: null
        })
        .mockResolvedValueOnce({
          data: { ...mockTab, status: 'closed' },
          error: null
        });

      const request = new NextRequest('http://localhost/api/receipts/receipt-123/assign', {
        method: 'POST',
        body: JSON.stringify({ tabId: mockTabId })
      });

      const response = await POST(request, { params: { id: mockReceiptId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Tab is not open');
    });

    it('should return 400 if venue mismatch', async () => {
      const { createClient } = require('@supabase/supabase-js');
      const mockSupabase = createClient();
      
      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: mockReceipt,
          error: null
        })
        .mockResolvedValueOnce({
          data: { ...mockTab, bar_id: 'different-bar' },
          error: null
        });

      const request = new NextRequest('http://localhost/api/receipts/receipt-123/assign', {
        method: 'POST',
        body: JSON.stringify({ tabId: mockTabId })
      });

      const response = await POST(request, { params: { id: mockReceiptId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('different venues');
    });
  });

  describe('Successful Assignment', () => {
    it('should create order and update receipt status', async () => {
      const { createClient } = require('@supabase/supabase-js');
      const mockSupabase = createClient();
      
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockOrder,
            error: null
          })
        })
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          error: null
        })
      });

      mockSupabase.from = jest.fn((table) => {
        if (table === 'unmatched_receipts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockReceipt,
                  error: null
                })
              })
            }),
            update: mockUpdate
          };
        }
        if (table === 'tabs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockTab,
                  error: null
                })
              })
            })
          };
        }
        if (table === 'tab_orders') {
          return {
            insert: mockInsert
          };
        }
        return {};
      });

      const request = new NextRequest('http://localhost/api/receipts/receipt-123/assign', {
        method: 'POST',
        body: JSON.stringify({ tabId: mockTabId })
      });

      const response = await POST(request, { params: { id: mockReceiptId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Tab #42');
      expect(data.orderId).toBe(mockOrder.id);
      expect(data.receiptId).toBe(mockReceiptId);
      expect(data.tabNumber).toBe(42);

      // Verify order was created
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tab_id: mockTabId,
          items: mockReceipt.receipt_data.items,
          total: mockReceipt.receipt_data.total,
          status: 'confirmed',
          initiated_by: 'staff'
        })
      );

      // Verify receipt was updated
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'assigned',
          assigned_to_tab_id: mockTabId
        })
      );
    });

    it('should handle order creation failure', async () => {
      const { createClient } = require('@supabase/supabase-js');
      const mockSupabase = createClient();
      
      mockSupabase.from = jest.fn((table) => {
        if (table === 'unmatched_receipts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockReceipt,
                  error: null
                })
              })
            })
          };
        }
        if (table === 'tabs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockTab,
                  error: null
                })
              })
            })
          };
        }
        if (table === 'tab_orders') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Insert failed' }
                })
              })
            })
          };
        }
        return {};
      });

      const request = new NextRequest('http://localhost/api/receipts/receipt-123/assign', {
        method: 'POST',
        body: JSON.stringify({ tabId: mockTabId })
      });

      const response = await POST(request, { params: { id: mockReceiptId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Failed to create order');
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      const { createClient } = require('@supabase/supabase-js');
      const mockSupabase = createClient();
      
      mockSupabase.from = jest.fn(() => {
        throw new Error('Unexpected database error');
      });

      const request = new NextRequest('http://localhost/api/receipts/receipt-123/assign', {
        method: 'POST',
        body: JSON.stringify({ tabId: mockTabId })
      });

      const response = await POST(request, { params: { id: mockReceiptId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
    });
  });
});
