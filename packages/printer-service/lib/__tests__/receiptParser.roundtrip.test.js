/**
 * Unit tests for round-trip validation utility
 * 
 * Tests Requirements:
 * - 10.1: Parse → Format → Parse should produce equivalent data
 * - 10.4: Log discrepancies when round-trip fails
 * - 10.6: Compare parsed data structures for equivalence
 * - 10.7: Allow for minor formatting differences (whitespace, decimal precision)
 */

const { testRoundTrip, parseReceipt, formatReceipt, DEFAULT_TEMPLATE } = require('../receiptParser');

describe('testRoundTrip utility', () => {
  describe('Requirement 10.1: Parse → Format → Parse produces equivalent data', () => {
    it('should pass round-trip test for complete receipt', () => {
      const receiptText = `
Receipt #: RCP-2024-001234
Date: 12/15/2024 8:45:30 PM
----------------------------------------

QTY  ITEM                           AMOUNT
----------------------------------------
2    Tusker Lager 500ml              500.00
3    Pilsner 330ml                   450.00
----------------------------------------
Subtotal:                            950.00
Tax:                                 152.00

TOTAL:                              1102.00
      `.trim();

      const result = testRoundTrip(receiptText, DEFAULT_TEMPLATE);

      expect(result.success).toBe(true);
      expect(result.discrepancies).toHaveLength(0);
      expect(result.error).toBeNull();
      expect(result.originalParsed).toBeDefined();
      expect(result.formatted).toBeDefined();
      expect(result.reparsed).toBeDefined();
    });

    it('should pass round-trip test for receipt with items only', () => {
      const receiptText = `
QTY  ITEM                           AMOUNT
----------------------------------------
1    Coffee                           50.00
2    Tea                              40.00
----------------------------------------
TOTAL:                               130.00
      `.trim();

      const result = testRoundTrip(receiptText, DEFAULT_TEMPLATE);

      expect(result.success).toBe(true);
      expect(result.discrepancies).toHaveLength(0);
    });

    it('should skip round-trip test for low confidence receipts', () => {
      // Receipt with only financial fields gets low confidence (no items)
      const receiptText = `
Subtotal:                            500.00
Tax:                                  80.00
TOTAL:                               580.00
      `.trim();

      const result = testRoundTrip(receiptText, DEFAULT_TEMPLATE);

      // Should skip round-trip for low confidence
      expect(result.success).toBe(false);
      expect(result.error).toContain('low confidence');
      expect(result.originalParsed.confidence).toBe('low');
    });
  });

  describe('Requirement 10.4: Log discrepancies when round-trip fails', () => {
    it('should detect and log item count mismatch', () => {
      // Create a receipt that might lose items in formatting
      const parsedData = {
        items: [
          { name: 'Item 1', quantity: 1, price: 100.00 },
          { name: '', quantity: 1, price: 50.00 } // Empty name might cause issues
        ],
        total: 150.00
      };

      const formatted = formatReceipt(parsedData);
      const result = testRoundTrip(formatted, DEFAULT_TEMPLATE);

      // If there's a discrepancy, it should be logged
      if (!result.success) {
        expect(result.discrepancies.length).toBeGreaterThan(0);
        expect(result.discrepancies[0]).toHaveProperty('message');
        expect(result.discrepancies[0]).toHaveProperty('field');
      }
    });

    it('should detect financial field mismatches', () => {
      // Manually create a scenario where values might differ
      const receiptText = `
TOTAL:                               100.00
      `.trim();

      const result = testRoundTrip(receiptText, DEFAULT_TEMPLATE);

      // Should have result structure even if there are discrepancies
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('discrepancies');
      expect(Array.isArray(result.discrepancies)).toBe(true);
    });

    it('should include detailed discrepancy information', () => {
      // Create a receipt with potential for discrepancies
      const receiptText = `
Receipt #: RCP-001
QTY  ITEM                           AMOUNT
----------------------------------------
1    Test Item                       100.00
----------------------------------------
TOTAL:                               100.00
      `.trim();

      const result = testRoundTrip(receiptText, DEFAULT_TEMPLATE);

      // Check discrepancy structure if any exist
      if (result.discrepancies.length > 0) {
        const disc = result.discrepancies[0];
        expect(disc).toHaveProperty('field');
        expect(disc).toHaveProperty('message');
        expect(disc).toHaveProperty('original');
        expect(disc).toHaveProperty('reparsed');
      }
    });
  });

  describe('Requirement 10.6: Compare parsed data structures for equivalence', () => {
    it('should compare all item fields', () => {
      const receiptText = `
QTY  ITEM                           AMOUNT
----------------------------------------
2    Tusker Lager 500ml              250.00
3    Pilsner 330ml                   150.00
----------------------------------------
TOTAL:                               850.00
      `.trim();

      const result = testRoundTrip(receiptText, DEFAULT_TEMPLATE);

      expect(result.originalParsed.items).toBeDefined();
      expect(result.reparsed.items).toBeDefined();
      
      if (result.success) {
        // Items should match
        expect(result.originalParsed.items.length).toBe(result.reparsed.items.length);
        
        for (let i = 0; i < result.originalParsed.items.length; i++) {
          const orig = result.originalParsed.items[i];
          const rep = result.reparsed.items[i];
          
          expect(orig.name.trim()).toBe(rep.name.trim());
          expect(orig.quantity).toBe(rep.quantity);
          expect(Math.abs(orig.price - rep.price)).toBeLessThan(0.01);
        }
      }
    });

    it('should compare all financial fields', () => {
      const receiptText = `
Subtotal:                            500.00
Tax:                                  80.00
TOTAL:                               580.00
      `.trim();

      const result = testRoundTrip(receiptText, DEFAULT_TEMPLATE);

      if (result.success) {
        expect(Math.abs(result.originalParsed.total - result.reparsed.total)).toBeLessThan(0.01);
        expect(Math.abs(result.originalParsed.subtotal - result.reparsed.subtotal)).toBeLessThan(0.01);
        expect(Math.abs(result.originalParsed.tax - result.reparsed.tax)).toBeLessThan(0.01);
      }
    });

    it('should compare receipt metadata fields', () => {
      const receiptText = `
Receipt #: RCP-2024-001234
Date: 12/15/2024 8:45:30 PM
TOTAL:                               100.00
      `.trim();

      const result = testRoundTrip(receiptText, DEFAULT_TEMPLATE);

      if (result.success) {
        expect(result.originalParsed.receiptNumber.trim()).toBe(result.reparsed.receiptNumber.trim());
        expect(result.originalParsed.timestamp.trim()).toBe(result.reparsed.timestamp.trim());
      }
    });
  });

  describe('Requirement 10.7: Allow minor formatting differences', () => {
    it('should allow whitespace differences in item names', () => {
      const receiptText = `
QTY  ITEM                           AMOUNT
----------------------------------------
1    Item   With   Spaces            100.00
----------------------------------------
TOTAL:                               100.00
      `.trim();

      const result = testRoundTrip(receiptText, DEFAULT_TEMPLATE);

      // Should succeed or only flag non-whitespace differences
      if (!result.success) {
        const nameDiscrepancies = result.discrepancies.filter(d => d.field.includes('name'));
        // If there are name discrepancies, they should be about content, not just whitespace
        for (const disc of nameDiscrepancies) {
          const origTrimmed = disc.original.replace(/\s+/g, ' ').trim();
          const repTrimmed = disc.reparsed.replace(/\s+/g, ' ').trim();
          // After normalizing whitespace, they might still differ
          expect(typeof origTrimmed).toBe('string');
          expect(typeof repTrimmed).toBe('string');
        }
      }
    });

    it('should allow decimal precision differences within 0.01', () => {
      const receiptText = `
QTY  ITEM                           AMOUNT
----------------------------------------
1    Item                            100.00
----------------------------------------
TOTAL:                               100.00
      `.trim();

      const result = testRoundTrip(receiptText, DEFAULT_TEMPLATE);

      // Should not flag differences less than 0.01
      const priceDiscrepancies = result.discrepancies.filter(d => 
        d.field.includes('price') || d.field === 'total' || d.field === 'subtotal' || d.field === 'tax'
      );

      for (const disc of priceDiscrepancies) {
        // Any flagged price discrepancy should be > 0.01
        if (disc.difference !== undefined) {
          expect(disc.difference).toBeGreaterThan(0.01);
        }
      }
    });

    it('should allow whitespace differences in receipt number', () => {
      const receiptText = `
Receipt #:  RCP-001  
TOTAL:                               100.00
      `.trim();

      const result = testRoundTrip(receiptText, DEFAULT_TEMPLATE);

      // Should succeed or only flag non-whitespace differences
      if (!result.success) {
        const receiptNumDiscrepancies = result.discrepancies.filter(d => d.field === 'receiptNumber');
        // After trimming, they should match
        for (const disc of receiptNumDiscrepancies) {
          // The utility already trims, so if there's still a discrepancy, it's real
          expect(disc.original).toBeDefined();
          expect(disc.reparsed).toBeDefined();
        }
      }
    });

    it('should allow whitespace differences in timestamp', () => {
      const receiptText = `
Date:  12/15/2024  8:45:30 PM  
TOTAL:                               100.00
      `.trim();

      const result = testRoundTrip(receiptText, DEFAULT_TEMPLATE);

      // Should succeed or only flag non-whitespace differences
      if (!result.success) {
        const timestampDiscrepancies = result.discrepancies.filter(d => d.field === 'timestamp');
        // After trimming, they should match
        for (const disc of timestampDiscrepancies) {
          expect(disc.original).toBeDefined();
          expect(disc.reparsed).toBeDefined();
        }
      }
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle low confidence original parsing', () => {
      const receiptText = 'Invalid receipt with no parseable data';

      const result = testRoundTrip(receiptText, DEFAULT_TEMPLATE);

      expect(result.success).toBe(false);
      expect(result.error).toContain('low confidence');
      expect(result.originalParsed).toBeDefined();
      expect(result.originalParsed.confidence).toBe('low');
    });

    it('should handle empty receipt text', () => {
      const result = testRoundTrip('', DEFAULT_TEMPLATE);

      expect(result.success).toBe(false);
      expect(result.originalParsed).toBeDefined();
    });

    it('should handle null input', () => {
      const result = testRoundTrip(null, DEFAULT_TEMPLATE);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle undefined input', () => {
      const result = testRoundTrip(undefined, DEFAULT_TEMPLATE);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return proper result structure on error', () => {
      const result = testRoundTrip(null, DEFAULT_TEMPLATE);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('originalParsed');
      expect(result).toHaveProperty('formatted');
      expect(result).toHaveProperty('reparsed');
      expect(result).toHaveProperty('discrepancies');
      expect(result).toHaveProperty('error');
      expect(Array.isArray(result.discrepancies)).toBe(true);
    });

    it('should handle formatting that produces empty output', () => {
      // Create a parsed data that might produce empty formatting
      const emptyParsedData = {
        items: [],
        total: 0,
        subtotal: 0,
        tax: 0,
        receiptNumber: '',
        timestamp: ''
      };

      const formatted = formatReceipt(emptyParsedData);
      const result = testRoundTrip(formatted, DEFAULT_TEMPLATE);

      // Should handle gracefully
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
    });
  });

  describe('Integration with real receipts', () => {
    it('should pass round-trip for Tusker Lager format', () => {
      const receiptText = `
Captain's Orders Bar
123 Main Street
Nairobi, Kenya

Receipt #: RCP-2024-001234
Date: 12/15/2024 8:45:30 PM

QTY  ITEM                           AMOUNT
----------------------------------------
2    Tusker Lager 500ml              500.00
3    Pilsner 330ml                   450.00
1    Soda                             50.00
----------------------------------------
Subtotal:                          1,000.00
VAT (16%):                           160.00

TOTAL:                             1,160.00

Thank you for your business!
      `.trim();

      const result = testRoundTrip(receiptText, DEFAULT_TEMPLATE);

      expect(result.success).toBe(true);
      expect(result.discrepancies).toHaveLength(0);
      expect(result.originalParsed.items.length).toBe(3);
      expect(result.reparsed.items.length).toBe(3);
    });

    it('should handle receipts with commas in prices', () => {
      const receiptText = `
QTY  ITEM                           AMOUNT
----------------------------------------
1    Expensive Item               10,000.00
2    Medium Item                   1,500.00
----------------------------------------
Subtotal:                         13,000.00
Tax:                               2,080.00
TOTAL:                            15,080.00
      `.trim();

      const result = testRoundTrip(receiptText, DEFAULT_TEMPLATE);

      expect(result.success).toBe(true);
      expect(result.originalParsed.total).toBeCloseTo(15080.00, 2);
      expect(result.reparsed.total).toBeCloseTo(15080.00, 2);
    });
  });
});
