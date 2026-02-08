/**
 * Integration Tests for Receipt Assignment Flow
 * 
 * Task 4: Assignment Flow Implementation
 * Tests end-to-end flow: receipt event → modal → assignment → customer
 * 
 * Requirements: 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3, 7.4, 9.1, 9.2, 9.3, 9.4
 */

import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock Supabase with realistic behavior
const mockDatabase = {
  receipts: new Map(),
  tabs: new Map(),
  orders: new Map()
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      if (table === 'unmatched_receipts') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn((field: string, value: string) => ({
              single: jest.fn(async () => {
                const receipt = mockDatabase.receipts.get(value);
                return receipt 
                  ? { data: receipt, error: null }
                  : { data: null, error: { message: 'Not found' } };
              })
            }))
          })),
          update: jest.fn((data: any) => ({
            eq: jest.fn((field: string, value: string) => {
              const receipt = mockDatabase.receipts.get(value);
              if (receipt) {
                mockDatabase.receipts.set(value, { ...receipt, ...data });
              }
              return Promise.resolve({ error: null });
            })
          }))
        };
      }
      
      if (table === 'tabs') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn((field: string, value: string) => ({
              single: jest.fn(async () => {
                const tab = mockDatabase.tabs.get(value);
                return tab
                  ? { data: tab, error: null }
                  : { data: null, error: { message: 'Not found' } };
              })
            }))
          }))
        };
      }
      
      if (table === 'tab_orders') {
        return {
          insert: jest.fn((data: any) => ({
            select: jest.fn(() => ({
              single: jest.fn(async () => {
                const orderId = `order-${Date.now()}`;
                const order = { id: orderId, ...data };
                mockDatabase.orders.set(orderId, order);
                return { data: order, error: null };
              })
            }))
          }))
        };
      }
      
      return {};
    })
  }))
}));

describe('Receipt Assignment Integration Tests', () => {
  const mockBarId = 'bar-789';
  
  beforeEach(() => {
    // Reset mock database
    mockDatabase.receipts.clear();
    mockDatabase.tabs.clear();
    mockDatabase.orders.clear();
    
    // Setup test data
    mockDatabase.receipts.set('receipt-1', {
      id: 'receipt-1',
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
    });
    
    mockDatabase.tabs.set('tab-1', {
      id: 'tab-1',
      tab_number: 42,
      bar_id: mockBarId,
      status: 'open',
      owner_identifier: 'customer-123'
    });
  });

  describe('Happy Path: Complete Assignment Flow', () => {
    it('should successfully assign receipt to tab and create order', async () => {
      const request = new NextRequest('http://localhost/api/receipts/receipt-1/assign', {
        method: 'POST',
        body: JSON.stringify({ tabId: 'tab-1' })
      });

      const response = await POST(request, { params: { id: 'receipt-1' } });
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Tab #42');
      expect(data.orderId).toBeTruthy();
      expect(data.receiptId).toBe('receipt-1');
      expect(data.tabNumber).toBe(42);

      // Verify receipt was updated
      const updatedReceipt = mockDatabase.receipts.get('receipt-1');
      expect(updatedReceipt?.status).toBe('assigned');
      expect(updatedReceipt?.assigned_to_tab_id).toBe('tab-1');
      expect(updatedReceipt?.assigned_at).toBeTruthy();

      // Verify order was created
      const orders = Array.from(mockDatabase.orders.values());
      expect(orders).toHaveLength(1);
      expect(orders[0].tab_id).toBe('tab-1');
      expect(orders[0].total).toBe(928);
      expect(orders[0].status).toBe('confirmed');
      expect(orders[0].initiated_by).toBe('staff');
    });
  });

  describe('Error Recovery: Retry After Failure', () => {
    it('should allow retry after initial failure', async () => {
      // First attempt - tab is closed
      mockDatabase.tabs.set('tab-1', {
        ...mockDatabase.tabs.get('tab-1')!,
        status: 'closed'
      });

      const request1 = new NextRequest('http://localhost/api/receipts/receipt-1/assign', {
        method: 'POST',
        body: JSON.stringify({ tabId: 'tab-1' })
      });

      const response1 = await POST(request1, { params: { id: 'receipt-1' } });
      const data1 = await response1.json();

      expect(response1.status).toBe(400);
      expect(data1.success).toBe(false);
      expect(data1.error).toContain('not open');

      // Second attempt - tab is now open
      mockDatabase.tabs.set('tab-1', {
        ...mockDatabase.tabs.get('tab-1')!,
        status: 'open'
      });

      const request2 = new NextRequest('http://localhost/api/receipts/receipt-1/assign', {
        method: 'POST',
        body: JSON.stringify({ tabId: 'tab-1' })
      });

      const response2 = await POST(request2, { params: { id: 'receipt-1' } });
      const data2 = await response2.json();

      expect(response2.status).toBe(200);
      expect(data2.success).toBe(true);
    });
  });

  describe('Concurrent Assignments', () => {
    it('should prevent double assignment of same receipt', async () => {
      // Setup second tab
      mockDatabase.tabs.set('tab-2', {
        id: 'tab-2',
        tab_number: 43,
        bar_id: mockBarId,
        status: 'open',
        owner_identifier: 'customer-456'
      });

      // First assignment
      const request1 = new NextRequest('http://localhost/api/receipts/receipt-1/assign', {
        method: 'POST',
        body: JSON.stringify({ tabId: 'tab-1' })
      });

      const response1 = await POST(request1, { params: { id: 'receipt-1' } });
      const data1 = await response1.json();

      expect(response1.status).toBe(200);
      expect(data1.success).toBe(true);

      // Second assignment attempt (should fail)
      const request2 = new NextRequest('http://localhost/api/receipts/receipt-1/assign', {
        method: 'POST',
        body: JSON.stringify({ tabId: 'tab-2' })
      });

      const response2 = await POST(request2, { params: { id: 'receipt-1' } });
      const data2 = await response2.json();

      expect(response2.status).toBe(400);
      expect(data2.success).toBe(false);
      expect(data2.error).toContain('already been assigned');

      // Verify only one order was created
      const orders = Array.from(mockDatabase.orders.values());
      expect(orders).toHaveLength(1);
      expect(orders[0].tab_id).toBe('tab-1');
    });
  });

  describe('Venue Isolation', () => {
    it('should prevent cross-venue assignment', async () => {
      // Setup tab from different venue
      mockDatabase.tabs.set('tab-other', {
        id: 'tab-other',
        tab_number: 99,
        bar_id: 'different-bar',
        status: 'open',
        owner_identifier: 'customer-999'
      });

      const request = new NextRequest('http://localhost/api/receipts/receipt-1/assign', {
        method: 'POST',
        body: JSON.stringify({ tabId: 'tab-other' })
      });

      const response = await POST(request, { params: { id: 'receipt-1' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('different venues');

      // Verify no order was created
      const orders = Array.from(mockDatabase.orders.values());
      expect(orders).toHaveLength(0);

      // Verify receipt status unchanged
      const receipt = mockDatabase.receipts.get('receipt-1');
      expect(receipt?.status).toBe('pending');
    });
  });

  describe('Data Integrity', () => {
    it('should preserve receipt data in created order', async () => {
      const request = new NextRequest('http://localhost/api/receipts/receipt-1/assign', {
        method: 'POST',
        body: JSON.stringify({ tabId: 'tab-1' })
      });

      const response = await POST(request, { params: { id: 'receipt-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);

      // Verify order contains all receipt items
      const orders = Array.from(mockDatabase.orders.values());
      const order = orders[0];
      
      expect(order.items).toHaveLength(2);
      expect(order.items[0]).toEqual({
        name: 'Beer',
        quantity: 2,
        unitPrice: 300,
        total: 600
      });
      expect(order.items[1]).toEqual({
        name: 'Fries',
        quantity: 1,
        unitPrice: 200,
        total: 200
      });
      expect(order.total).toBe(928);
    });

    it('should handle incomplete receipt data gracefully', async () => {
      // Setup receipt with missing items
      mockDatabase.receipts.set('receipt-incomplete', {
        id: 'receipt-incomplete',
        bar_id: mockBarId,
        status: 'pending',
        receipt_data: {
          venueName: "Joe's Bar",
          timestamp: '2024-01-15T14:30:00.000Z',
          items: [],
          subtotal: 0,
          tax: 0,
          total: 0
        }
      });

      const request = new NextRequest('http://localhost/api/receipts/receipt-incomplete/assign', {
        method: 'POST',
        body: JSON.stringify({ tabId: 'tab-1' })
      });

      const response = await POST(request, { params: { id: 'receipt-incomplete' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('incomplete or invalid');
    });
  });

  describe('Performance', () => {
    it('should complete assignment within 3 seconds', async () => {
      const startTime = Date.now();

      const request = new NextRequest('http://localhost/api/receipts/receipt-1/assign', {
        method: 'POST',
        body: JSON.stringify({ tabId: 'tab-1' })
      });

      const response = await POST(request, { params: { id: 'receipt-1' } });
      const data = await response.json();

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(duration).toBeLessThan(3000); // Requirement 13.4
    });
  });
});
