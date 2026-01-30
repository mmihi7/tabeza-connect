/**
 * TABEZA Receipt Schema Validation Tests
 * Comprehensive tests for schema validation, business rules, and data consistency
 */

import {
  createReceiptSession,
  createReceiptEvent,
  createSessionTotals,
  createCompleteSession,
  validateReceiptSession,
  validateReceiptEvent,
  validateCompleteSession,
  validateBusinessRules,
  type ReceiptSession,
  type ReceiptEvent,
  type CompleteReceiptSession,
  type LineItem,
  type ValidationResult
} from '../index';

describe('Schema Validation Tests', () => {

  // ============================================================================
  // SCHEMA STRUCTURE VALIDATION
  // ============================================================================

  describe('Schema Structure Validation', () => {
    it('should validate required session fields', () => {
      const validSession = createReceiptSession({
        merchantId: 'merchant-001',
        merchantName: 'Test Restaurant',
        printerId: 'printer-001'
      });

      const validation = validateReceiptSession(validSession);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing required session fields', () => {
      const invalidSession = {
        ...createReceiptSession({
          merchantId: 'merchant-001',
          merchantName: 'Test Restaurant',
          printerId: 'printer-001'
        }),
        tabeza_receipt_id: ''
      } as any;

      const validation = validateReceiptSession(invalidSession);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.code === 'MISSING_RECEIPT_ID')).toBe(true);
    });

    it('should validate event structure', () => {
      const validEvent = createReceiptEvent({
        sessionId: 'session-001',
        type: 'SALE',
        sequence: 1,
        items: [{ name: 'Coffee', qty: 1, unit_price: 150, total_price: 150 }],
        rawHash: 'hash-123',
        parsedConfidence: 0.95
      });

      const validation = validateReceiptEvent(validEvent);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing event fields', () => {
      const invalidEvent = {
        ...createReceiptEvent({
          sessionId: 'session-001',
          type: 'SALE',
          sequence: 1,
          items: [{ name: 'Coffee', qty: 1, unit_price: 150, total_price: 150 }],
          rawHash: 'hash-123',
          parsedConfidence: 0.95
        }),
        event_id: ''
      } as any;

      const validation = validateReceiptEvent(invalidEvent);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.code === 'MISSING_EVENT_ID')).toBe(true);
    });
  });

  // ============================================================================
  // DATA TYPE VALIDATION
  // ============================================================================

  describe('Data Type Validation', () => {
    it('should validate confidence score range', () => {
      const invalidEvent = {
        ...createReceiptEvent({
          sessionId: 'session-001',
          type: 'SALE',
          sequence: 1,
          items: [{ name: 'Coffee', qty: 1, unit_price: 150, total_price: 150 }],
          rawHash: 'hash-123',
          parsedConfidence: 0.95
        }),
        parsed_confidence: 1.5 // Invalid confidence > 1.0
      } as any;

      const validation = validateReceiptEvent(invalidEvent);
      expect(validation.errors.some(e => e.code === 'INVALID_CONFIDENCE')).toBe(true);
    });

    it('should validate timestamp formats', () => {
      const session = {
        ...createReceiptSession({
          merchantId: 'merchant-001',
          merchantName: 'Test Restaurant',
          printerId: 'printer-001'
        }),
        opened_at: 'invalid-timestamp'
      } as any;

      const validation = validateReceiptSession(session);
      // The actual error code is INVALID_TIMESTAMP, not INVALID_TIMESTAMP_FORMAT
      expect(validation.errors.some(e => e.code === 'INVALID_TIMESTAMP')).toBe(true);
    });

    it('should validate sequence numbers', () => {
      const invalidEvent = {
        ...createReceiptEvent({
          sessionId: 'session-001',
          type: 'SALE',
          sequence: 1,
          items: [{ name: 'Coffee', qty: 1, unit_price: 150, total_price: 150 }],
          rawHash: 'hash-123',
          parsedConfidence: 0.95
        }),
        sequence: -1 // Invalid negative sequence
      } as any;

      const validation = validateReceiptEvent(invalidEvent);
      expect(validation.errors.some(e => e.code === 'INVALID_SEQUENCE')).toBe(true);
    });
  });

  // ============================================================================
  // BUSINESS RULE VALIDATION
  // ============================================================================

  describe('Business Rule Validation', () => {
    it('should validate line item calculations', () => {
      const items: LineItem[] = [
        {
          name: 'Test Item',
          qty: 2,
          unit_price: 100,
          total_price: 150 // Incorrect calculation (should be 200)
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

      const validation = validateReceiptEvent(event);
      expect(validation.errors.some(e => e.code === 'INVALID_LINE_ITEM')).toBe(true);
    });

    it('should validate payment amounts', () => {
      const event = {
        ...createReceiptEvent({
          sessionId: 'session-001',
          type: 'SALE',
          sequence: 1,
          items: [{ name: 'Item', qty: 1, unit_price: 100, total_price: 100 }],
          rawHash: 'hash-123',
          parsedConfidence: 0.95
        }),
        payment: {
          method: 'CASH' as const,
          amount: -100, // Invalid negative amount
          currency: 'KES',
          status: 'COMPLETED' as const
        }
      } as any;

      const validation = validateReceiptEvent(event);
      expect(validation.errors.some(e => e.code === 'INVALID_PAYMENT_AMOUNT')).toBe(true);
    });

    it('should validate sequence gaps', () => {
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
          items: [{ name: 'Item 1', qty: 1, unit_price: 100, total_price: 100 }],
          rawHash: 'hash-1',
          parsedConfidence: 0.95
        }),
        createReceiptEvent({
          sessionId: session.tabeza_receipt_id,
          type: 'SALE',
          sequence: 3, // Gap in sequence (missing 2)
          items: [{ name: 'Item 2', qty: 1, unit_price: 200, total_price: 200 }],
          rawHash: 'hash-2',
          parsedConfidence: 0.95
        })
      ];

      const totals = createSessionTotals(events);
      const completeSession = createCompleteSession(session, events, totals);
      const validation = validateCompleteSession(completeSession);

      expect(validation.errors.some(e => e.code === 'SEQUENCE_GAP')).toBe(true);
    });
  });

  // ============================================================================
  // CROSS-FIELD VALIDATION
  // ============================================================================

  describe('Cross-Field Validation', () => {
    it('should validate closed sessions have totals', () => {
      const session = {
        ...createReceiptSession({
          merchantId: 'merchant-001',
          merchantName: 'Test Restaurant',
          printerId: 'printer-001'
        }),
        status: 'CLOSED' as const,
        closed_at: new Date().toISOString()
      };

      const events: ReceiptEvent[] = [
        createReceiptEvent({
          sessionId: session.tabeza_receipt_id,
          type: 'SALE',
          sequence: 1,
          items: [{ name: 'Item', qty: 1, unit_price: 100, total_price: 100 }],
          rawHash: 'hash-1',
          parsedConfidence: 0.95
        })
      ];

      // Create complete session without totals
      const completeSession = {
        session,
        events,
        totals: undefined
      } as any;

      const validation = validateCompleteSession(completeSession);
      expect(validation.errors.some(e => e.code === 'MISSING_SESSION_TOTALS')).toBe(true);
    });

    it('should validate session totals consistency', () => {
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
        })
      ];

      // Create incorrect totals
      const incorrectTotals = {
        ...createSessionTotals(events),
        total: 999 // Incorrect total
      };

      const completeSession = createCompleteSession(session, events, incorrectTotals);
      const validation = validateCompleteSession(completeSession);

      expect(validation.errors.some(e => e.code === 'INVALID_SESSION_TOTALS')).toBe(true);
    });
  });

  // ============================================================================
  // COMPLIANCE VALIDATION
  // ============================================================================

  describe('Compliance Validation', () => {
    it('should validate KRA PIN format', () => {
      const session = createReceiptSession({
        merchantId: 'merchant-001',
        merchantName: 'Test Restaurant',
        printerId: 'printer-001',
        kraPin: 'INVALID-PIN-FORMAT'
      });

      const validation = validateReceiptSession(session);
      expect(validation.warnings.some(w => w.code === 'INVALID_KRA_PIN_FORMAT')).toBe(true);
    });

    it('should validate large transaction requirements', () => {
      const session = createReceiptSession({
        merchantId: 'merchant-001',
        merchantName: 'Test Restaurant',
        printerId: 'printer-001'
      });

      const event = createReceiptEvent({
        sessionId: session.tabeza_receipt_id,
        type: 'SALE',
        sequence: 1,
        items: [{ name: 'Expensive Item', qty: 1, unit_price: 15000, total_price: 15000 }], // Large amount
        rawHash: 'hash-1',
        parsedConfidence: 0.95
        // No payment reference
      });

      const totals = createSessionTotals([event]);
      const completeSession = createCompleteSession(session, [event], totals);
      const validation = validateBusinessRules(completeSession);

      expect(validation.warnings.some(w => w.code === 'LARGE_TRANSACTION_NO_REFERENCE')).toBe(true);
    });

    it('should validate refunds do not exceed sales', () => {
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
  });

  // ============================================================================
  // CONFIDENCE SCORE VALIDATION
  // ============================================================================

  describe('Confidence Score Validation', () => {
    it('should warn about low parsing confidence', () => {
      const event = createReceiptEvent({
        sessionId: 'session-001',
        type: 'SALE',
        sequence: 1,
        items: [{ name: 'Item', qty: 1, unit_price: 100, total_price: 100 }],
        rawHash: 'hash-123',
        parsedConfidence: 0.3 // Low confidence
      });

      const validation = validateReceiptEvent(event);
      expect(validation.warnings.some(w => w.code === 'LOW_CONFIDENCE')).toBe(true);
    });

    it('should validate confidence score range', () => {
      const invalidEvent = {
        ...createReceiptEvent({
          sessionId: 'session-001',
          type: 'SALE',
          sequence: 1,
          items: [{ name: 'Item', qty: 1, unit_price: 100, total_price: 100 }],
          rawHash: 'hash-123',
          parsedConfidence: 0.95
        }),
        parsed_confidence: 1.5 // Invalid confidence > 1.0
      } as any;

      const validation = validateReceiptEvent(invalidEvent);
      expect(validation.errors.some(e => e.code === 'INVALID_CONFIDENCE')).toBe(true);
    });
  });

  // ============================================================================
  // VALIDATION RESULT STRUCTURE
  // ============================================================================

  describe('Validation Result Structure', () => {
    it('should return consistent validation result structure', () => {
      const session = createReceiptSession({
        merchantId: 'merchant-001',
        merchantName: 'Test Restaurant',
        printerId: 'printer-001'
      });

      const validation = validateReceiptSession(session);

      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('score');
      expect(validation).toHaveProperty('errors');
      expect(validation).toHaveProperty('warnings');
      
      expect(typeof validation.valid).toBe('boolean');
      expect(typeof validation.score).toBe('number');
      expect(Array.isArray(validation.errors)).toBe(true);
      expect(Array.isArray(validation.warnings)).toBe(true);
      
      expect(validation.score).toBeGreaterThanOrEqual(0);
      expect(validation.score).toBeLessThanOrEqual(100);
    });

    it('should include error codes and messages', () => {
      const invalidSession = {
        ...createReceiptSession({
          merchantId: 'merchant-001',
          merchantName: 'Test Restaurant',
          printerId: 'printer-001'
        }),
        tabeza_receipt_id: ''
      } as any;

      const validation = validateReceiptSession(invalidSession);

      if (validation.errors.length > 0) {
        const error = validation.errors[0];
        expect(error).toHaveProperty('code');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('field');
        
        expect(typeof error.code).toBe('string');
        expect(typeof error.message).toBe('string');
        expect(error.code.length).toBeGreaterThan(0);
        expect(error.message.length).toBeGreaterThan(0);
      }
    });

    it('should include warning codes and suggestions', () => {
      const session = createReceiptSession({
        merchantId: 'merchant-001',
        merchantName: 'Test Restaurant',
        printerId: 'printer-001',
        kraPin: 'INVALID-FORMAT'
      });

      const validation = validateReceiptSession(session);

      if (validation.warnings.length > 0) {
        const warning = validation.warnings[0];
        expect(warning).toHaveProperty('code');
        expect(warning).toHaveProperty('message');
        expect(warning).toHaveProperty('suggestion');
        
        expect(typeof warning.code).toBe('string');
        expect(typeof warning.message).toBe('string');
        expect(typeof warning.suggestion).toBe('string');
      }
    });
  });

  // ============================================================================
  // EDGE CASE VALIDATION
  // ============================================================================

  describe('Edge Case Validation', () => {
    it('should handle empty item arrays for VOID events', () => {
      const event = createReceiptEvent({
        sessionId: 'session-001',
        type: 'VOID',
        sequence: 1,
        items: [], // Empty items array
        rawHash: 'hash-123',
        parsedConfidence: 1.0
      });

      const validation = validateReceiptEvent(event);
      // VOID events can have empty items
      expect(validation.valid).toBe(true);
    });

    it('should handle zero-value transactions', () => {
      const items: LineItem[] = [
        {
          name: 'Free Sample',
          qty: 1,
          unit_price: 0,
          total_price: 0
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

      const validation = validateReceiptEvent(event);
      expect(validation.valid).toBe(true);
    });

    it('should handle special characters in merchant names', () => {
      const session = createReceiptSession({
        merchantId: 'merchant-001',
        merchantName: 'Test Restaurant & Bar (Nairobi) - "The Best"',
        printerId: 'printer-001'
      });

      const validation = validateReceiptSession(session);
      expect(validation.valid).toBe(true);
    });

    it('should validate missing printer ID', () => {
      const invalidSession = {
        ...createReceiptSession({
          merchantId: 'merchant-001',
          merchantName: 'Test Restaurant',
          printerId: 'printer-001'
        }),
        device: {
          ...createReceiptSession({
            merchantId: 'merchant-001',
            merchantName: 'Test Restaurant',
            printerId: 'printer-001'
          }).device,
          printer_id: ''
        }
      } as any;

      const validation = validateReceiptSession(invalidSession);
      expect(validation.errors.some(e => e.code === 'MISSING_PRINTER_ID')).toBe(true);
    });

    it('should warn about M-Pesa payments without reference', () => {
      const event = {
        ...createReceiptEvent({
          sessionId: 'session-001',
          type: 'SALE',
          sequence: 1,
          items: [{ name: 'Item', qty: 1, unit_price: 100, total_price: 100 }],
          rawHash: 'hash-123',
          parsedConfidence: 0.95
        }),
        payment: {
          method: 'MPESA' as const,
          amount: 100,
          currency: 'KES',
          status: 'COMPLETED' as const
          // No reference
        }
      } as any;

      const validation = validateReceiptEvent(event);
      expect(validation.warnings.some(w => w.code === 'MISSING_MPESA_REFERENCE')).toBe(true);
    });
  });
});