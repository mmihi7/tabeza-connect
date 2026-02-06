/**
 * Digital Receipt Delivery Service Tests
 * Tests print data conversion, delivery, retry logic, and history tracking
 */

import {
  DigitalReceiptDeliveryService,
  createDigitalReceiptDeliveryService,
  type PrintDataReceipt,
  type RetryConfig
} from '../digital-receipt-delivery';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({
          data: { id: 'order-123' },
          error: null
        }))
      }))
    }))
  }))
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

describe('DigitalReceiptDeliveryService', () => {
  let service: DigitalReceiptDeliveryService;
  const supabaseUrl = 'https://test.supabase.co';
  const supabaseKey = 'test-key';

  const samplePrintData: PrintDataReceipt = {
    items: [
      { name: 'Burger', quantity: 2, unit_price: 10.00, total_price: 20.00 },
      { name: 'Fries', quantity: 1, unit_price: 5.00, total_price: 5.00 }
    ],
    total: 25.00,
    subtotal: 25.00,
    tax: 0,
    customerInfo: {
      tableNumber: 5
    }
  };

  beforeEach(() => {
    service = createDigitalReceiptDeliveryService(supabaseUrl, supabaseKey);
    service.clearDeliveryHistory();
    jest.clearAllMocks();
  });

  describe('convertPrintDataToDigitalReceipt', () => {
    it('should convert print data to digital receipt format', () => {
      const result = service.convertPrintDataToDigitalReceipt(
        samplePrintData,
        'bar-123',
        'tab-456'
      );

      expect(result.barId).toBe('bar-123');
      expect(result.tabId).toBe('tab-456');
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(25.00);
      expect(result.deliveryStatus).toBe('pending');
      expect(result.retryCount).toBe(0);
    });

    it('should handle items without quantity', () => {
      const printData: PrintDataReceipt = {
        items: [
          { name: 'Item', quantity: 0, unit_price: 10.00, total_price: 10.00 }
        ],
        total: 10.00
      };

      const result = service.convertPrintDataToDigitalReceipt(
        printData,
        'bar-123',
        'tab-456'
      );

      expect(result.items[0].quantity).toBe(1); // Default to 1
    });

    it('should preserve item notes', () => {
      const printData: PrintDataReceipt = {
        items: [
          { 
            name: 'Burger', 
            quantity: 1, 
            unit_price: 10.00, 
            total_price: 10.00,
            notes: 'No onions'
          }
        ],
        total: 10.00
      };

      const result = service.convertPrintDataToDigitalReceipt(
        printData,
        'bar-123',
        'tab-456'
      );

      expect(result.items[0].notes).toBe('No onions');
    });
  });

  describe('deliverToCustomer', () => {
    it('should successfully deliver digital receipt to customer', async () => {
      const result = await service.deliverToCustomer(
        samplePrintData,
        'tab-456',
        5,
        'Customer A',
        'bar-123'
      );

      expect(result.success).toBe(true);
      expect(result.tabId).toBe('tab-456');
      expect(result.tabNumber).toBe(5);
      expect(result.customerIdentifier).toBe('Customer A');
      expect(result.orderId).toBe('order-123');
      expect(result.deliveredAt).toBeInstanceOf(Date);
    });

    it('should handle delivery failure', async () => {
      // Mock Supabase error
      const errorMock = {
        from: jest.fn(() => ({
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: null,
                error: { message: 'Database error' }
              }))
            }))
          }))
        }))
      };

      (mockSupabase.from as jest.Mock).mockImplementationOnce(errorMock.from);

      const result = await service.deliverToCustomer(
        samplePrintData,
        'tab-456',
        5,
        'Customer A',
        'bar-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });

    it('should log delivery attempt', async () => {
      await service.deliverToCustomer(
        samplePrintData,
        'tab-456',
        5,
        'Customer A',
        'bar-123'
      );

      const history = service.getAllDeliveryHistory('bar-123');
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].tabId).toBe('tab-456');
      expect(history[0].finalStatus).toBe('success');
    });
  });

  describe('deliverToMultipleCustomers', () => {
    it('should deliver to multiple customers', async () => {
      const customers = [
        { tabId: 'tab-1', tabNumber: 1, customerIdentifier: 'Customer 1' },
        { tabId: 'tab-2', tabNumber: 2, customerIdentifier: 'Customer 2' },
        { tabId: 'tab-3', tabNumber: 3, customerIdentifier: 'Customer 3' }
      ];

      const results = await service.deliverToMultipleCustomers(
        samplePrintData,
        customers,
        'bar-123'
      );

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle partial failures', async () => {
      // Mock one failure
      let callCount = 0;
      const mixedMock = {
        from: jest.fn(() => ({
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => {
                callCount++;
                if (callCount === 2) {
                  return Promise.resolve({
                    data: null,
                    error: { message: 'Failed' }
                  });
                }
                return Promise.resolve({
                  data: { id: `order-${callCount}` },
                  error: null
                });
              })
            }))
          }))
        }))
      };

      (mockSupabase.from as jest.Mock).mockImplementation(mixedMock.from);

      const customers = [
        { tabId: 'tab-1', tabNumber: 1, customerIdentifier: 'Customer 1' },
        { tabId: 'tab-2', tabNumber: 2, customerIdentifier: 'Customer 2' },
        { tabId: 'tab-3', tabNumber: 3, customerIdentifier: 'Customer 3' }
      ];

      const results = await service.deliverToMultipleCustomers(
        samplePrintData,
        customers,
        'bar-123'
      );

      expect(results).toHaveLength(3);
      expect(results.filter(r => r.success)).toHaveLength(2);
      expect(results.filter(r => !r.success)).toHaveLength(1);
    });
  });

  describe('retryFailedDelivery', () => {
    it('should retry failed delivery', async () => {
      const customRetryConfig: RetryConfig = {
        maxRetries: 2,
        retryIntervals: [100, 200],
        exponentialBackoff: false
      };

      const serviceWithRetry = createDigitalReceiptDeliveryService(
        supabaseUrl,
        supabaseKey,
        customRetryConfig
      );

      // Mock first failure, then success
      let attemptCount = 0;
      const retryMock = {
        from: jest.fn(() => ({
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => {
                attemptCount++;
                if (attemptCount === 1) {
                  return Promise.resolve({
                    data: null,
                    error: { message: 'Temporary failure' }
                  });
                }
                return Promise.resolve({
                  data: { id: 'order-retry' },
                  error: null
                });
              })
            }))
          }))
        }))
      };

      (mockSupabase.from as jest.Mock).mockImplementation(retryMock.from);

      const result = await serviceWithRetry.retryFailedDelivery(
        samplePrintData,
        'tab-456',
        5,
        'Customer A',
        'bar-123',
        0
      );

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(2);
    });

    it('should stop after max retries', async () => {
      const customRetryConfig: RetryConfig = {
        maxRetries: 2,
        retryIntervals: [10, 20],
        exponentialBackoff: false
      };

      const serviceWithRetry = createDigitalReceiptDeliveryService(
        supabaseUrl,
        supabaseKey,
        customRetryConfig
      );

      // Mock all failures
      const failMock = {
        from: jest.fn(() => ({
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: null,
                error: { message: 'Persistent failure' }
              }))
            }))
          }))
        }))
      };

      (mockSupabase.from as jest.Mock).mockImplementation(failMock.from);

      const result = await serviceWithRetry.retryFailedDelivery(
        samplePrintData,
        'tab-456',
        5,
        'Customer A',
        'bar-123',
        0
      );

      expect(result.success).toBe(false);
    });
  });

  describe('delivery history', () => {
    it('should track delivery history', async () => {
      await service.deliverToCustomer(
        samplePrintData,
        'tab-456',
        5,
        'Customer A',
        'bar-123'
      );

      const history = service.getAllDeliveryHistory('bar-123');
      expect(history).toHaveLength(1);
      expect(history[0].tabId).toBe('tab-456');
      expect(history[0].attempts).toHaveLength(1);
    });

    it('should filter history by bar ID', async () => {
      await service.deliverToCustomer(
        samplePrintData,
        'tab-1',
        1,
        'Customer 1',
        'bar-123'
      );

      await service.deliverToCustomer(
        samplePrintData,
        'tab-2',
        2,
        'Customer 2',
        'bar-456'
      );

      const bar123History = service.getAllDeliveryHistory('bar-123');
      const bar456History = service.getAllDeliveryHistory('bar-456');

      expect(bar123History).toHaveLength(1);
      expect(bar456History).toHaveLength(1);
    });

    it('should clear delivery history', async () => {
      await service.deliverToCustomer(
        samplePrintData,
        'tab-456',
        5,
        'Customer A',
        'bar-123'
      );

      service.clearDeliveryHistory();
      const history = service.getAllDeliveryHistory('bar-123');
      expect(history).toHaveLength(0);
    });
  });

  describe('delivery statistics', () => {
    it('should calculate delivery statistics', async () => {
      // Create a fresh service instance for this test
      const testService = createDigitalReceiptDeliveryService(supabaseUrl, supabaseKey);
      
      // Successful delivery
      await testService.deliverToCustomer(
        samplePrintData,
        'tab-stats-1',
        1,
        'Customer 1',
        'bar-stats'
      );

      // Failed delivery - mock the error
      const failMock = {
        from: jest.fn(() => ({
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: null,
                error: { message: 'Failed' }
              }))
            }))
          }))
        }))
      };

      (mockSupabase.from as jest.Mock).mockImplementationOnce(failMock.from);

      await testService.deliverToCustomer(
        samplePrintData,
        'tab-stats-2',
        2,
        'Customer 2',
        'bar-stats'
      );

      const stats = testService.getDeliveryStats('bar-stats');
      expect(stats.totalDeliveries).toBe(2);
      // Note: Both deliveries are tracked, success/failure determined by finalStatus
      expect(stats.totalDeliveries).toBeGreaterThan(0);
    });

    it('should handle empty history', () => {
      const stats = service.getDeliveryStats('bar-123');
      expect(stats.totalDeliveries).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.averageAttempts).toBe(0);
    });
  });
});
