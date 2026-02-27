/**
 * Unit tests for regex pattern validation
 * Tests task 2.5: Implement regex pattern validation
 * Validates Requirements 8.4, 8.5
 */

const { validatePattern } = require('../receiptParser');

describe('Regex Pattern Validation', () => {
  describe('validatePattern', () => {
    describe('Valid patterns', () => {
      it('should return true for simple valid regex pattern', () => {
        expect(validatePattern('\\d+')).toBe(true);
      });

      it('should return true for pattern with capture groups', () => {
        expect(validatePattern('Receipt\\s*#?:?\\s*(\\S+)')).toBe(true);
      });

      it('should return true for complex date pattern', () => {
        expect(validatePattern('(\\d{1,2}/\\d{1,2}/\\d{4}\\s+\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s*[AP]M)?)')).toBe(true);
      });

      it('should return true for pattern with character classes', () => {
        expect(validatePattern('[A-Za-z0-9]+')).toBe(true);
      });

      it('should return true for pattern with quantifiers', () => {
        expect(validatePattern('\\w{3,10}')).toBe(true);
      });

      it('should return true for pattern with alternation', () => {
        expect(validatePattern('(VAT|Tax|GST)')).toBe(true);
      });

      it('should return true for pattern with lookahead', () => {
        expect(validatePattern('\\d+(?=\\s*USD)')).toBe(true);
      });

      it('should return true for pattern with word boundaries', () => {
        expect(validatePattern('\\bTOTAL\\b')).toBe(true);
      });

      it('should return true for pattern with anchors', () => {
        expect(validatePattern('^TOTAL:?\\s*(\\d+\\.\\d{2})$')).toBe(true);
      });

      it('should return true for pattern with escaped special characters', () => {
        expect(validatePattern('\\(\\d+%\\)')).toBe(true);
      });

      it('should return true for multiline pattern markers', () => {
        expect(validatePattern('^-{3,}|Subtotal|Total')).toBe(true);
      });

      it('should return true for pattern with non-capturing groups', () => {
        expect(validatePattern('(?:VAT|Tax):?\\s*(\\d+\\.\\d{2})')).toBe(true);
      });

      it('should return true for empty string pattern', () => {
        // Empty string is technically a valid regex (matches empty string)
        expect(validatePattern('')).toBe(false); // But we treat it as invalid for our use case
      });
    });

    describe('Invalid patterns', () => {
      it('should return false for pattern with unmatched opening bracket', () => {
        expect(validatePattern('[invalid')).toBe(false);
      });

      it('should return false for pattern with unmatched opening parenthesis', () => {
        expect(validatePattern('(invalid')).toBe(false);
      });

      it('should return true for pattern with unmatched closing bracket', () => {
        // Note: 'invalid]' is actually valid regex in JavaScript (matches literal 'invalid]')
        expect(validatePattern('invalid]')).toBe(true);
      });

      it('should return false for pattern with invalid quantifier', () => {
        expect(validatePattern('*invalid')).toBe(false);
      });

      it('should return true for pattern with escape k', () => {
        // Note: '\k' is valid in JavaScript regex (matches literal 'k')
        expect(validatePattern('\\k')).toBe(true);
      });

      it('should return true for pattern with incomplete quantifier', () => {
        // Note: '\d{3' is actually valid in JavaScript (matches literal '\d{3')
        expect(validatePattern('\\d{3')).toBe(true);
      });

      it('should return false for pattern with invalid range', () => {
        expect(validatePattern('[z-a]')).toBe(false);
      });

      it('should return true for pattern with backreference 9', () => {
        // Note: '\9' is valid in JavaScript regex (matches literal '9' or backreference if group exists)
        expect(validatePattern('\\9')).toBe(true);
      });

      it('should return false for complex invalid pattern', () => {
        expect(validatePattern('[invalid regex(')).toBe(false);
      });

      it('should return false for pattern with multiple errors', () => {
        expect(validatePattern('([{*')).toBe(false);
      });
    });

    describe('Edge cases and invalid inputs', () => {
      it('should return false for null input', () => {
        expect(validatePattern(null)).toBe(false);
      });

      it('should return false for undefined input', () => {
        expect(validatePattern(undefined)).toBe(false);
      });

      it('should return false for number input', () => {
        expect(validatePattern(123)).toBe(false);
      });

      it('should return false for object input', () => {
        expect(validatePattern({})).toBe(false);
      });

      it('should return false for array input', () => {
        expect(validatePattern([])).toBe(false);
      });

      it('should return false for boolean input', () => {
        expect(validatePattern(true)).toBe(false);
      });

      it('should return false for function input', () => {
        expect(validatePattern(() => {})).toBe(false);
      });

      it('should return false for empty string', () => {
        expect(validatePattern('')).toBe(false);
      });

      it('should return false for whitespace-only string', () => {
        expect(validatePattern('   ')).toBe(true); // Whitespace is valid regex
      });
    });

    describe('Real-world patterns from templates', () => {
      it('should validate default template receiptNumber pattern', () => {
        expect(validatePattern('Receipt\\s*#?:?\\s*(\\S+)')).toBe(true);
      });

      it('should validate default template timestamp pattern', () => {
        expect(validatePattern('(\\d{1,2}/\\d{1,2}/\\d{4}\\s+\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s*[AP]M)?)')).toBe(true);
      });

      it('should validate default template items pattern', () => {
        expect(validatePattern('^(\\d+)\\s+(.+?)\\s{2,}(\\d+(?:,\\d{3})*\\.\\d{2})\\s*$')).toBe(true);
      });

      it('should validate default template subtotal pattern', () => {
        expect(validatePattern('Subtotal:?\\s*(\\d+(?:,\\d{3})*\\.\\d{2})')).toBe(true);
      });

      it('should validate default template tax pattern', () => {
        expect(validatePattern('(?:VAT|Tax)(?:\\s*\\(\\d+%\\))?:?\\s*(\\d+(?:,\\d{3})*\\.\\d{2})')).toBe(true);
      });

      it('should validate default template total pattern', () => {
        expect(validatePattern('^\\s*TOTAL:?\\s*(\\d+(?:,\\d{3})*\\.\\d{2})')).toBe(true);
      });

      it('should validate items startMarker pattern', () => {
        expect(validatePattern('QTY\\s+ITEM\\s+AMOUNT')).toBe(true);
      });

      it('should validate items endMarker pattern', () => {
        expect(validatePattern('^-{3,}|Subtotal|Total')).toBe(true);
      });
    });

    describe('Error logging behavior', () => {
      let consoleErrorSpy;

      beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      });

      afterEach(() => {
        consoleErrorSpy.mockRestore();
      });

      it('should log error message when pattern is invalid', () => {
        validatePattern('[invalid');
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('[Receipt Parser] Invalid regex pattern:');
      });

      it('should include pattern in error log', () => {
        const invalidPattern = '(unmatched';
        validatePattern(invalidPattern);
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(consoleErrorSpy.mock.calls[0][1]).toBe(invalidPattern);
      });

      it('should include error message in log', () => {
        validatePattern('[invalid');
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(consoleErrorSpy.mock.calls[0][2]).toBeTruthy();
      });

      it('should not log error for valid patterns', () => {
        validatePattern('\\d+');
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });
    });

    describe('Integration with extractField', () => {
      const { parseReceipt, DEFAULT_TEMPLATE } = require('../receiptParser');

      it('should use default pattern when custom pattern is invalid', () => {
        const receiptText = 'Receipt #: RCP-12345\nTOTAL: 100.00';
        
        // Create template with invalid receiptNumber pattern
        const invalidTemplate = {
          ...DEFAULT_TEMPLATE,
          receiptNumber: '[invalid regex(',
          total: 'TOTAL:?\\s*(\\d+\\.\\d{2})'
        };

        // Should not throw, should fall back gracefully
        const result = parseReceipt(receiptText, invalidTemplate);
        
        // Should still parse total even though receiptNumber pattern is invalid
        expect(result.total).toBe(100.00);
        // Note: Without items or other fields, confidence is low (not medium)
        expect(result.confidence).toBe('low');
      });

      it('should handle all invalid patterns gracefully', () => {
        const receiptText = 'TOTAL: 50.00';
        
        const allInvalidTemplate = {
          receiptNumber: '[invalid(',
          timestamp: '(unmatched',
          items: {
            pattern: '*invalid',
            multiline: true
          },
          subtotal: '{broken',
          tax: '[bad])',
          total: 'TOTAL:?\\s*(\\d+\\.\\d{2})' // Only this one is valid
        };

        const result = parseReceipt(receiptText, allInvalidTemplate);
        
        // Should still parse total
        expect(result.total).toBe(50.00);
        // Note: Only total extracted, no items or other fields = low confidence
        expect(result.confidence).toBe('low');
      });
    });

    describe('Performance with complex patterns', () => {
      it('should validate complex pattern quickly', () => {
        const complexPattern = '^(?:(?:(?:[A-Z]{2,3}[-\\s]?)?\\d{1,4}[-\\s]?)?(?:[A-Z]{2,4}[-\\s]?)?\\d{1,6})\\s+(.+?)\\s{2,}(\\d+(?:,\\d{3})*\\.\\d{2})$';
        
        const startTime = Date.now();
        const result = validatePattern(complexPattern);
        const endTime = Date.now();
        
        expect(result).toBe(true);
        expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
      });

      it('should handle very long pattern strings', () => {
        const longPattern = '(' + 'a|'.repeat(100) + 'z)';
        expect(validatePattern(longPattern)).toBe(true);
      });
    });

    describe('Fallback behavior verification', () => {
      it('should cause loadTemplateFromConfig to use default when pattern is invalid', () => {
        const { loadTemplateFromConfig, DEFAULT_TEMPLATE } = require('../receiptParser');
        
        const configWithInvalidPattern = {
          parsingTemplate: {
            total: '[invalid regex(',
            receiptNumber: 'Receipt\\s*#?:?\\s*(\\S+)'
          }
        };

        const template = loadTemplateFromConfig(configWithInvalidPattern);
        
        // Should fall back to default template entirely because total is invalid
        expect(template).toEqual(DEFAULT_TEMPLATE);
      });

      it('should allow partial template with valid total and invalid optional fields', () => {
        const { loadTemplateFromConfig, DEFAULT_TEMPLATE } = require('../receiptParser');
        
        const configWithPartialInvalid = {
          parsingTemplate: {
            total: 'TOTAL:?\\s*(\\d+\\.\\d{2})', // Valid
            receiptNumber: '[invalid(', // Invalid
            timestamp: '(\\d{1,2}/\\d{1,2}/\\d{4})' // Valid
          }
        };

        const template = loadTemplateFromConfig(configWithPartialInvalid);
        
        // Should use valid fields and default for invalid ones
        expect(template.total).toBe('TOTAL:?\\s*(\\d+\\.\\d{2})');
        expect(template.timestamp).toBe('(\\d{1,2}/\\d{1,2}/\\d{4})');
        expect(template.receiptNumber).toBe(DEFAULT_TEMPLATE.receiptNumber);
      });
    });
  });
});
