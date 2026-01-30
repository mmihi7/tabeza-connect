/**
 * TABEZA Receipt Schema Tests
 * Comprehensive test suite for session-based receipt schema
 */

import {
  createReceiptSession,
  createReceiptEvent,
  createSessionTotals,
  createCompleteSession,
  createTestSession,
  validateReceiptSession,
  validateReceiptEvent,
  validateCompleteSession,
  validateBusinessRules,
  isValidForProcessing,
  calculateHealthScore,
  getSessionSummary,
  LineItem,
  ReceiptSession,
  ReceiptEvent,
  CompleteReceiptSession
} from '../index';

describe('TABEZA Receipt Schema', () => {
  
  // ============================================================================
  // SESSION CREATION TESTS
  // ============================================================================
  
  describe('Session Creation', () => {
    it('should create a valid receipt session', () => {
      const session = createReceiptSession({
        merchantId: 'merchant-001',
        merchantName: 'Test Restaurant',
        printerId: 'printer-001',
        tableNumber: '5',
        kraPin: 'P051234567A'
      });

      expect(session.tabeza_receipt_id).toMatch(/^tbz_/);
      expect(session.session_reference).toHaveLength(8);
      expect(session.merchant.name).toBe('Test Restaurant');
      expect(session.merchant.kra_pin).toBe('P051234567A');
      expect(session.device.printer_id).toBe('printer-001');
      expect(session.table_number).toBe('5');
      expect(session.status).toBe('OPEN');
      expect(session.currency).toBe('KES');
    });

    it('should create session without optional fields', () => {
      const session = createReceiptSession({
        merchantId: 'merchant-002',
        merchantName: 'Simple Cafe',
        printerId: 'printer-002'
      });

      expect(session.merchant.name).toBe('Simple Cafe');
      expect(session.table_number).toBeUndefined();
      expect(session.merchant.kra_pin).toBeUndefined();
    });
  });

  // ============================================================================
  // EVENT CREATION TESTS
  // ============================================================================
  
  describe('Event Creation', () => {
    it('should create a valid receipt event', () => {
      const items: LineItem[] = [
        {
          name: 'Coffee',
          qty: 2,
          unit_price: 150,
          total_price: 300
        },
        {
          name: 'Sandwich',
          qty: 1,
          unit_price: 250,
          total_price: 250
        }
      ];

      const event = createReceiptEvent({
        sessionId: 'session-001',
        type: 'SALE',
        sequence: 1,
        items,
        rawHash: 'hash-123',
        parsedConfidence: 0.95
      });

      expect(event.event_id).toMatch(/^evt_/);
      expect(event.session_id).toBe('session-001');
      expect(event.type).toBe('SALE');
      expect(event.sequence).toBe(1);
      expect(event.items).toHaveLength(2);
      expect(event.totals.subtotal).toBe(550);
      expect(event.totals.total).toBe(550);
      expect(event.parsed_confidence).toBe(0.95);
    });

    it('should calculate event totals correctly', () => {
      const items: LineItem[] = [
        {
          name: 'Item with tax',
          qty: 1,
          unit_price: 100,
          total_price: 100,
          tax_amount: 16,
          discount_amount: 10
        }
      ];

      const event = createReceiptEvent({
        sessionId: 'session-001',
        type: 'SALE',
        sequence: 1,
        items,
        rawHash: 'hash-123',
        parsedConfidence: 0.95
      });

      expect(event.totals.subtotal).toBe(100);
      expect(event.totals.tax).toBe(16);
      expect(event.totals.discount).toBe(10);
      expect(event.totals.total).toBe(106); // 100 + 16 - 10
    });
  });

  // ============================================================================
  // SESSION TOTALS TESTS
  // ============================================================================
  
  describe('Session Totals', () => {
    it('should calculate session totals from events', () => {
      const events: ReceiptEvent[] = [
        createReceiptEvent({
          sessionId: 'session-001',
          type: 'SALE',
          sequence: 1,
          items: [{ name: 'Item 1', qty: 1, unit_price: 100, total_price: 100 }],
          rawHash: 'hash-1',
          parsedConfidence: 0.95
        }),
        createReceiptEvent({
          sessionId: 'session-001',
          type: 'SALE',
          sequence: 2,
          items: [{ name: 'Item 2', qty: 1, unit_price: 200, total_price: 200 }],
          rawHash: 'hash-2',
          parsedConfidence: 0.95
        })
      ];

      const totals = createSessionTotals(events);

      expect(totals.subtotal).toBe(300);
      expect(totals.total).toBe(300);
      expect(totals.total_events).toBe(2);
      expect(totals.sale_events).toBe(2);
      expect(totals.refund_events).toBe(0);
    });

    it('should handle refunds correctly', () => {
      const events: ReceiptEvent[] = [
        createReceiptEvent({
          sessionId: 'session-001',
          type: 'SALE',
          sequence: 1,
          items: [{ name: 'Item 1', qty: 1, unit_price: 100, total_price: 100 }],
          rawHash: 'hash-1',
          parsedConfidence: 0.95
        }),
        createReceiptEvent({
          sessionId: 'session-001',
          type: 'REFUND',
          sequence: 2,
          items: [{ name: 'Item 1', qty: 1, unit_price: 100, total_price: 100 }],
          rawHash: 'hash-2',
          parsedConfidence: 0.95
        })
      ];

      const totals = createSessionTotals(events);

      expect(totals.total).toBe(0); // 100 - 100
      expect(totals.sale_events).toBe(1);
      expect(totals.refund_events).toBe(1);
    });
  });

  // ============================================================================
  // VALIDATION TESTS
  // ============================================================================
  
  describe('Session Validation', () => {
    it('should validate a correct session', () => {
      const session = createReceiptSession({
        merchantId: 'merchant-001',
        merchantName: 'Test Restaurant',
        printerId: 'printer-001'
      });

      const validation = validateReceiptSession(session);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.score).toBeGreaterThan(90);
    });

    it('should detect missing required fields', () => {
      const invalidSession = {
        ...createReceiptSession({
          merchantId: 'merchant-001',
          merchantName: 'Test Restaurant',
          printerId: 'printer-001'
        }),
        tabeza_receipt_id: '' // Invalid
      } as ReceiptSession;

      const validation = validateReceiptSession(invalidSession);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.code === 'MISSING_RECEIPT_ID')).toBe(true);
    });

    it('should warn about invalid KRA PIN format', () => {
      const session = createReceiptSession({
        merchantId: 'merchant-001',
        merchantName: 'Test Restaurant',
        printerId: 'printer-001',
        kraPin: 'INVALID-PIN'
      });

      const validation = validateReceiptSession(session);

      expect(validation.warnings.some(w => w.code === 'INVALID_KRA_PIN_FORMAT')).toBe(true);
    });
  });

  describe('Event Validation', () => {
    it('should validate a correct event', () => {
      const event = createReceiptEvent({
        sessionId: 'session-001',
        type: 'SALE',
        sequence: 1,
        items: [{ name: 'Coffee', qty: 1, unit_price: 150, total_price: 150 }],
        rawHash: 'hash-123',
        parsedConfidence: 0.95
      });

      const validation = validateReceiptEvent(event);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.score).toBeGreaterThan(90);
    });

    it('should detect low parsing confidence', () => {
      const event = createReceiptEvent({
        sessionId: 'session-001',
        type: 'SALE',
        sequence: 1,
        items: [{ name: 'Coffee', qty: 1, unit_price: 150, total_price: 150 }],
        rawHash: 'hash-123',
        parsedConfidence: 0.3 // Low confidence
      });

      const validation = validateReceiptEvent(event);

      expect(validation.warnings.some(w => w.code === 'LOW_CONFIDENCE')).toBe(true);
    });
  });

  // ============================================================================
  // BUSINESS RULES TESTS
  // ============================================================================
  
  describe('Business Rules Validation', () => {
    it('should detect refunds exceeding sales', () => {
      const session = createReceiptSession({
        merchantId: 'merchant-001',
        merchantName: 'Test Restaurant',
        printerId: 'printer-001'
      });

      const events: ReceiptEvent[] = [
        createReceiptEvent({
          sessionId: session.tabeza_receipt_id,
          type: 'SALE',
          sequence: 1,
          items: [{ name: 'Item', qty: 1, unit_price: 100, total_price: 100 }],
          rawHash: 'hash-1',
          parsedConfidence: 0.95
        }),
        createReceiptEvent({
          sessionId: session.tabeza_receipt_id,
          type: 'REFUND',
          sequence: 2,
          items: [{ name: 'Item', qty: 1, unit_price: 200, total_price: 200 }], // Refund more than sale
          rawHash: 'hash-2',
          parsedConfidence: 0.95
        })
      ];

      const totals = createSessionTotals(events);
      const completeSession = createCompleteSession(session, events, totals);
      const validation = validateBusinessRules(completeSession);

      expect(validation.errors.some(e => e.code === 'REFUND_EXCEEDS_SALES')).toBe(true);
    });

    it('should warn about large transactions without payment references', () => {
      const session = createReceiptSession({
        merchantId: 'merchant-001',
        merchantName: 'Test Restaurant',
        printerId: 'printer-001'
      });

      const events: ReceiptEvent[] = [
        createReceiptEvent({
          sessionId: session.tabeza_receipt_id,
          type: 'SALE',
          sequence: 1,
          items: [{ name: 'Expensive Item', qty: 1, unit_price: 15000, total_price: 15000 }], // Large amount
          rawHash: 'hash-1',
          parsedConfidence: 0.95
          // No payment reference
        })
      ];

      const totals = createSessionTotals(events);
      const completeSession = createCompleteSession(session, events, totals);
      const validation = validateBusinessRules(completeSession);

      expect(validation.warnings.some(w => w.code === 'LARGE_TRANSACTION_NO_REFERENCE')).toBe(true);
    });
  });

  // ============================================================================
  // UTILITY FUNCTION TESTS
  // ============================================================================
  
  describe('Utility Functions', () => {
    it('should create test session correctly', () => {
      const testSession = createTestSession('Test Cafe');

      expect(testSession.session.merchant.name).toBe('Test Cafe');
      expect(testSession.events).toHaveLength(1);
      expect(testSession.totals).toBeDefined();
      expect(testSession.session.status).toBe('CLOSED');
    });

    it('should check if session is valid for processing', () => {
      const validSession = createTestSession('Valid Restaurant');
      const isValid = isValidForProcessing(validSession);

      expect(isValid).toBe(true);
    });

    it('should calculate health score', () => {
      const session = createTestSession('Health Test Restaurant');
      const health = calculateHealthScore(session);

      expect(health.score).toBeGreaterThan(0);
      expect(health.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(health.issues)).toBe(true);
      expect(Array.isArray(health.recommendations)).toBe(true);
    });

    it('should get session summary', () => {
      const session = createTestSession('Summary Test Restaurant');
      const summary = getSessionSummary(session);

      expect(summary.merchant).toBe('Summary Test Restaurant');
      expect(summary.status).toBe('CLOSED');
      expect(summary.events).toBe(1);
      expect(summary.currency).toBe('KES');
      expect(summary.total).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================
  
  describe('Integration Tests', () => {
    it('should handle complete restaurant workflow', () => {
      // 1. Create session
      const session = createReceiptSession({
        merchantId: 'restaurant-001',
        merchantName: 'Mama Njeri Restaurant',
        printerId: 'epson-tm-t20',
        tableNumber: '7',
        kraPin: 'P051234567A',
        location: 'Nairobi, Kenya'
      });

      // 2. Add multiple orders
      const order1 = createReceiptEvent({
        sessionId: session.tabeza_receipt_id,
        type: 'SALE',
        sequence: 1,
        items: [
          { name: 'Ugali', qty: 2, unit_price: 50, total_price: 100 },
          { name: 'Sukuma Wiki', qty: 1, unit_price: 80, total_price: 80 }
        ],
        rawHash: 'order1-hash',
        parsedConfidence: 0.98
      });

      const order2 = createReceiptEvent({
        sessionId: session.tabeza_receipt_id,
        type: 'SALE',
        sequence: 2,
        items: [
          { name: 'Nyama Choma', qty: 1, unit_price: 400, total_price: 400 }
        ],
        payment: {
          method: 'MPESA',
          amount: 580,
          currency: 'KES',
          reference: 'QH7RTXM2',
          status: 'COMPLETED'
        },
        rawHash: 'order2-hash',
        parsedConfidence: 0.95
      });

      // 3. Calculate totals and close session
      const events = [order1, order2];
      const totals = createSessionTotals(events);
      const closedSession = { ...session, status: 'CLOSED' as const, closed_at: new Date().toISOString() };
      const completeSession = createCompleteSession(closedSession, events, totals);

      // 4. Validate complete workflow
      const validation = validateCompleteSession(completeSession);
      const businessValidation = validateBusinessRules(completeSession);
      const health = calculateHealthScore(completeSession);

      expect(validation.valid).toBe(true);
      expect(businessValidation.valid).toBe(true);
      expect(health.score).toBeGreaterThan(80);
      expect(totals.total).toBe(580);
      expect(totals.paid).toBe(580);
      expect(totals.balance).toBe(0);
    });

    it('should handle bar tab workflow with partial payments', () => {
      // Bar scenario: multiple orders, partial payments, final settlement
      const session = createReceiptSession({
        merchantId: 'bar-001',
        merchantName: 'Tabeza Sports Bar',
        printerId: 'star-tsp100',
        tableNumber: '12',
        customerIdentifier: 'device-abc123'
      });

      const events: ReceiptEvent[] = [
        // First round of drinks
        createReceiptEvent({
          sessionId: session.tabeza_receipt_id,
          type: 'SALE',
          sequence: 1,
          items: [
            { name: 'Tusker', qty: 3, unit_price: 200, total_price: 600 },
            { name: 'Nyama Choma', qty: 1, unit_price: 500, total_price: 500 }
          ],
          rawHash: 'round1-hash',
          parsedConfidence: 0.92
        }),
        
        // Second round
        createReceiptEvent({
          sessionId: session.tabeza_receipt_id,
          type: 'SALE',
          sequence: 2,
          items: [
            { name: 'Tusker', qty: 2, unit_price: 200, total_price: 400 }
          ],
          rawHash: 'round2-hash',
          parsedConfidence: 0.94
        }),

        // Partial payment
        createReceiptEvent({
          sessionId: session.tabeza_receipt_id,
          type: 'PARTIAL_BILL',
          sequence: 3,
          items: [],
          payment: {
            method: 'MPESA',
            amount: 800,
            currency: 'KES',
            reference: 'QJ8KRTXM',
            status: 'COMPLETED'
          },
          rawHash: 'payment1-hash',
          parsedConfidence: 1.0
        }),

        // Final settlement
        createReceiptEvent({
          sessionId: session.tabeza_receipt_id,
          type: 'PARTIAL_BILL',
          sequence: 4,
          items: [],
          payment: {
            method: 'CASH',
            amount: 700,
            currency: 'KES',
            status: 'COMPLETED'
          },
          rawHash: 'payment2-hash',
          parsedConfidence: 1.0
        })
      ];

      const totals = createSessionTotals(events);
      const closedSession = { ...session, status: 'CLOSED' as const, closed_at: new Date().toISOString() };
      const completeSession = createCompleteSession(closedSession, events, totals);

      expect(totals.total).toBe(1500); // 600 + 500 + 400
      expect(totals.paid).toBe(1500);  // 800 + 700
      expect(totals.balance).toBe(0);
      expect(totals.total_events).toBe(4);
      expect(totals.sale_events).toBe(2);

      const validation = validateCompleteSession(completeSession);
      expect(validation.valid).toBe(true);
    });
  });
});