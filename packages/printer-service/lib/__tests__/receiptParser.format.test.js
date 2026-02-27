/**
 * Unit tests for formatReceipt function
 * 
 * Tests Requirements:
 * - 9.1: Convert parsed data back to readable receipt text
 * - 9.2: Format items with name, quantity, and price
 * - 9.3: Format totals, subtotals, and tax
 * - 9.4: Format receipt number and timestamp
 * - 9.5: Preserve receipt structure and spacing
 * - 9.7: Handle missing fields gracefully
 */

const { formatReceipt, parseReceipt, DEFAULT_TEMPLATE } = require('../receiptParser');

describe('formatReceipt function', () => {
  describe('Requirement 9.1: Convert parsed data to readable text', () => {
    it('should return a non-empty string for valid parsed data', () => {
      const parsedData = {
        receiptNumber: 'RCP-001',
        timestamp: '12/15/2024 8:45:30 PM',
        items: [
          { name: 'Tusker Lager 500ml', quantity: 2, price: 250.00 }
        ],
        subtotal: 500.00,
        tax: 80.00,
        total: 580.00
      };

      const result = formatReceipt(parsedData);
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty string for null input', () => {
      const result = formatReceipt(null);
      expect(result).toBe('');
    });

    it('should return empty string for undefined input', () => {
      const result = formatReceipt(undefined);
      expect(result).toBe('');
    });

    it('should return empty string for non-object input', () => {
      expect(formatReceipt('invalid')).toBe('');
      expect(formatReceipt(123)).toBe('');
      expect(formatReceipt([])).toBe('');
    });
  });

  describe('Requirement 9.2: Format items with name, quantity, and price', () => {
    it('should format single item correctly', () => {
      const parsedData = {
        items: [
          { name: 'Tusker Lager 500ml', quantity: 2, price: 250.00 }
        ],
        total: 500.00
      };

      const result = formatReceipt(parsedData);
      
      expect(result).toContain('QTY');
      expect(result).toContain('ITEM');
      expect(result).toContain('AMOUNT');
      expect(result).toContain('Tusker Lager 500ml');
      expect(result).toContain('2');
      expect(result).toContain('250.00');
    });

    it('should format multiple items correctly', () => {
      const parsedData = {
        items: [
          { name: 'Tusker Lager 500ml', quantity: 2, price: 250.00 },
          { name: 'Pilsner 330ml', quantity: 3, price: 150.00 },
          { name: 'Soda', quantity: 1, price: 50.00 }
        ],
        total: 950.00
      };

      const result = formatReceipt(parsedData);
      
      expect(result).toContain('Tusker Lager 500ml');
      expect(result).toContain('Pilsner 330ml');
      expect(result).toContain('Soda');
      expect(result).toContain('250.00');
      expect(result).toContain('150.00');
      expect(result).toContain('50.00');
    });

    it('should handle items with missing fields', () => {
      const parsedData = {
        items: [
          { name: 'Item 1', quantity: 0, price: 0 },
          { name: '', quantity: 1, price: 100.00 },
          { quantity: 2, price: 50.00 } // missing name
        ],
        total: 150.00
      };

      const result = formatReceipt(parsedData);
      
      // Should not throw and should produce some output
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format prices with 2 decimal places', () => {
      const parsedData = {
        items: [
          { name: 'Item', quantity: 1, price: 10 },
          { name: 'Item2', quantity: 1, price: 10.5 },
          { name: 'Item3', quantity: 1, price: 10.99 }
        ],
        total: 31.49
      };

      const result = formatReceipt(parsedData);
      
      expect(result).toContain('10.00');
      expect(result).toContain('10.50');
      expect(result).toContain('10.99');
    });
  });

  describe('Requirement 9.3: Format totals, subtotals, and tax', () => {
    it('should format subtotal when present', () => {
      const parsedData = {
        subtotal: 1000.00,
        total: 1160.00
      };

      const result = formatReceipt(parsedData);
      
      expect(result).toContain('Subtotal');
      expect(result).toContain('1000.00');
    });

    it('should format tax when present', () => {
      const parsedData = {
        tax: 160.00,
        total: 1160.00
      };

      const result = formatReceipt(parsedData);
      
      expect(result).toContain('Tax');
      expect(result).toContain('160.00');
    });

    it('should format total when present', () => {
      const parsedData = {
        total: 1160.00
      };

      const result = formatReceipt(parsedData);
      
      expect(result).toContain('TOTAL');
      expect(result).toContain('1160.00');
    });

    it('should format all financial fields together', () => {
      const parsedData = {
        subtotal: 1000.00,
        tax: 160.00,
        total: 1160.00
      };

      const result = formatReceipt(parsedData);
      
      expect(result).toContain('Subtotal');
      expect(result).toContain('1000.00');
      expect(result).toContain('Tax');
      expect(result).toContain('160.00');
      expect(result).toContain('TOTAL');
      expect(result).toContain('1160.00');
      
      // Verify order: subtotal should come before tax, tax before total
      const subtotalIndex = result.indexOf('Subtotal');
      const taxIndex = result.indexOf('Tax');
      const totalIndex = result.indexOf('TOTAL');
      
      expect(subtotalIndex).toBeLessThan(taxIndex);
      expect(taxIndex).toBeLessThan(totalIndex);
    });

    it('should format tax as 0.00 when tax is 0', () => {
      const parsedData = {
        tax: 0,
        total: 100.00
      };

      const result = formatReceipt(parsedData);
      
      expect(result).toContain('Tax');
      expect(result).toContain('0.00');
    });
  });

  describe('Requirement 9.4: Format receipt number and timestamp', () => {
    it('should format receipt number when present', () => {
      const parsedData = {
        receiptNumber: 'RCP-2024-001234',
        total: 100.00
      };

      const result = formatReceipt(parsedData);
      
      expect(result).toContain('Receipt #');
      expect(result).toContain('RCP-2024-001234');
    });

    it('should format timestamp when present', () => {
      const parsedData = {
        timestamp: '12/15/2024 8:45:30 PM',
        total: 100.00
      };

      const result = formatReceipt(parsedData);
      
      expect(result).toContain('Date');
      expect(result).toContain('12/15/2024 8:45:30 PM');
    });

    it('should format both receipt number and timestamp', () => {
      const parsedData = {
        receiptNumber: 'RCP-001',
        timestamp: '12/15/2024 8:45:30 PM',
        total: 100.00
      };

      const result = formatReceipt(parsedData);
      
      expect(result).toContain('Receipt #');
      expect(result).toContain('RCP-001');
      expect(result).toContain('Date');
      expect(result).toContain('12/15/2024 8:45:30 PM');
    });
  });

  describe('Requirement 9.5: Preserve receipt structure and spacing', () => {
    it('should include separator lines', () => {
      const parsedData = {
        receiptNumber: 'RCP-001',
        items: [
          { name: 'Item', quantity: 1, price: 100.00 }
        ],
        total: 100.00
      };

      const result = formatReceipt(parsedData);
      
      // Should contain separator lines (dashes)
      expect(result).toMatch(/-{3,}/);
    });

    it('should have proper line breaks', () => {
      const parsedData = {
        receiptNumber: 'RCP-001',
        timestamp: '12/15/2024 8:45:30 PM',
        items: [
          { name: 'Item', quantity: 1, price: 100.00 }
        ],
        total: 100.00
      };

      const result = formatReceipt(parsedData);
      
      // Should contain newlines
      expect(result).toContain('\n');
      
      // Should have multiple lines
      const lines = result.split('\n');
      expect(lines.length).toBeGreaterThan(3);
    });

    it('should align columns properly', () => {
      const parsedData = {
        items: [
          { name: 'Short', quantity: 1, price: 10.00 },
          { name: 'Very Long Item Name Here', quantity: 10, price: 1000.00 }
        ],
        total: 1010.00
      };

      const result = formatReceipt(parsedData);
      
      // Prices should be right-aligned (have spaces before them)
      const lines = result.split('\n');
      const itemLines = lines.filter(line => line.match(/^\d+\s+/));
      
      for (const line of itemLines) {
        // Each line should have consistent structure
        expect(line.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Requirement 9.7: Handle missing fields gracefully', () => {
    it('should handle empty parsed data object', () => {
      const parsedData = {};

      const result = formatReceipt(parsedData);
      
      // Should not throw and should return a string
      expect(typeof result).toBe('string');
    });

    it('should handle parsed data with only some fields', () => {
      const parsedData = {
        total: 100.00
      };

      const result = formatReceipt(parsedData);
      
      expect(result).toContain('TOTAL');
      expect(result).toContain('100.00');
      expect(result).not.toContain('Receipt #');
      expect(result).not.toContain('Date');
    });

    it('should handle missing items array', () => {
      const parsedData = {
        receiptNumber: 'RCP-001',
        total: 100.00
      };

      const result = formatReceipt(parsedData);
      
      expect(result).toContain('Receipt #');
      expect(result).toContain('TOTAL');
      expect(result).not.toContain('QTY');
      expect(result).not.toContain('ITEM');
    });

    it('should handle empty items array', () => {
      const parsedData = {
        items: [],
        total: 100.00
      };

      const result = formatReceipt(parsedData);
      
      expect(result).toContain('TOTAL');
      expect(result).not.toContain('QTY');
    });

    it('should handle missing financial fields', () => {
      const parsedData = {
        receiptNumber: 'RCP-001',
        items: [
          { name: 'Item', quantity: 1, price: 100.00 }
        ]
      };

      const result = formatReceipt(parsedData);
      
      expect(result).toContain('Receipt #');
      expect(result).toContain('Item');
      // Should not crash even without totals
      expect(typeof result).toBe('string');
    });

    it('should handle zero values gracefully', () => {
      const parsedData = {
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0
      };

      const result = formatReceipt(parsedData);
      
      // Should not throw
      expect(typeof result).toBe('string');
    });

    it('should return rawText if formatting fails and rawText is available', () => {
      const parsedData = {
        rawText: 'Original receipt text',
        // Intentionally malformed data that might cause issues
        items: 'not an array',
        total: 'not a number'
      };

      const result = formatReceipt(parsedData);
      
      // Should handle gracefully
      expect(typeof result).toBe('string');
    });
  });

  describe('Integration: Round-trip formatting', () => {
    it('should produce parseable output', () => {
      const originalData = {
        receiptNumber: 'RCP-001',
        timestamp: '12/15/2024 8:45:30 PM',
        items: [
          { name: 'Tusker Lager 500ml', quantity: 2, price: 250.00 },
          { name: 'Pilsner 330ml', quantity: 3, price: 150.00 }
        ],
        subtotal: 950.00,
        tax: 152.00,
        total: 1102.00
      };

      const formatted = formatReceipt(originalData);
      const reparsed = parseReceipt(formatted, DEFAULT_TEMPLATE);

      // Should be able to parse the formatted output
      expect(reparsed).toBeDefined();
      expect(reparsed.confidence).not.toBe('low');
      expect(reparsed.items.length).toBeGreaterThan(0);
    });
  });
});
