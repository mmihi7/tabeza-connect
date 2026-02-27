/**
 * Unit tests for template loading from config.json
 * Tests task 2.2: Add template loading from config.json
 */

const { loadTemplateFromConfig, DEFAULT_TEMPLATE, validatePattern } = require('../receiptParser');

describe('Template Loading from Config', () => {
  describe('loadTemplateFromConfig', () => {
    it('should return default template when no config provided', () => {
      const template = loadTemplateFromConfig(null);
      expect(template).toEqual(DEFAULT_TEMPLATE);
    });

    it('should return default template when config is not an object', () => {
      const template = loadTemplateFromConfig('invalid');
      expect(template).toEqual(DEFAULT_TEMPLATE);
    });

    it('should return default template when parsingTemplate is missing', () => {
      const config = {
        barId: 'test-bar',
        apiUrl: 'https://example.com'
      };
      const template = loadTemplateFromConfig(config);
      expect(template).toEqual(DEFAULT_TEMPLATE);
    });

    it('should return default template when parsingTemplate is not an object', () => {
      const config = {
        barId: 'test-bar',
        parsingTemplate: 'invalid'
      };
      const template = loadTemplateFromConfig(config);
      expect(template).toEqual(DEFAULT_TEMPLATE);
    });

    it('should return default template when total field is missing', () => {
      const config = {
        barId: 'test-bar',
        parsingTemplate: {
          receiptNumber: 'Receipt\\s*#?:?\\s*(\\S+)',
          // Missing required 'total' field
        }
      };
      const template = loadTemplateFromConfig(config);
      expect(template).toEqual(DEFAULT_TEMPLATE);
    });

    it('should return default template when total pattern is invalid', () => {
      const config = {
        barId: 'test-bar',
        parsingTemplate: {
          total: '[invalid regex(' // Invalid regex
        }
      };
      const template = loadTemplateFromConfig(config);
      expect(template).toEqual(DEFAULT_TEMPLATE);
    });

    it('should load custom template with valid total pattern', () => {
      const config = {
        barId: 'test-bar',
        parsingTemplate: {
          total: 'TOTAL:?\\s*(\\d+\\.\\d{2})'
        }
      };
      const template = loadTemplateFromConfig(config);
      expect(template.total).toBe('TOTAL:?\\s*(\\d+\\.\\d{2})');
    });

    it('should load custom template with all fields', () => {
      const config = {
        barId: 'test-bar',
        parsingTemplate: {
          receiptNumber: 'Receipt\\s*#?:?\\s*(\\S+)',
          timestamp: '(\\d{1,2}/\\d{1,2}/\\d{4}\\s+\\d{1,2}:\\d{2})',
          items: {
            pattern: '^(\\d+)\\s+(.+?)\\s+(\\d+\\.\\d{2})$',
            multiline: true,
            startMarker: 'QTY\\s+ITEM\\s+AMOUNT',
            endMarker: '^-{3,}|Subtotal|Total'
          },
          subtotal: 'Subtotal:?\\s*(\\d+\\.\\d{2})',
          tax: 'Tax:?\\s*(\\d+\\.\\d{2})',
          total: 'TOTAL:?\\s*(\\d+\\.\\d{2})'
        }
      };
      const template = loadTemplateFromConfig(config);
      expect(template.receiptNumber).toBe('Receipt\\s*#?:?\\s*(\\S+)');
      expect(template.timestamp).toBe('(\\d{1,2}/\\d{1,2}/\\d{4}\\s+\\d{1,2}:\\d{2})');
      expect(template.items.pattern).toBe('^(\\d+)\\s+(.+?)\\s+(\\d+\\.\\d{2})$');
      expect(template.subtotal).toBe('Subtotal:?\\s*(\\d+\\.\\d{2})');
      expect(template.tax).toBe('Tax:?\\s*(\\d+\\.\\d{2})');
      expect(template.total).toBe('TOTAL:?\\s*(\\d+\\.\\d{2})');
    });

    it('should use default items when custom items config is invalid', () => {
      const config = {
        barId: 'test-bar',
        parsingTemplate: {
          total: 'TOTAL:?\\s*(\\d+\\.\\d{2})',
          items: 'invalid' // Should be an object
        }
      };
      const template = loadTemplateFromConfig(config);
      expect(template.items).toEqual(DEFAULT_TEMPLATE.items);
      expect(template.total).toBe('TOTAL:?\\s*(\\d+\\.\\d{2})');
    });

    it('should use default items when items.pattern is missing', () => {
      const config = {
        barId: 'test-bar',
        parsingTemplate: {
          total: 'TOTAL:?\\s*(\\d+\\.\\d{2})',
          items: {
            multiline: true
            // Missing pattern field
          }
        }
      };
      const template = loadTemplateFromConfig(config);
      expect(template.items).toEqual(DEFAULT_TEMPLATE.items);
    });

    it('should use default items when items.pattern is invalid regex', () => {
      const config = {
        barId: 'test-bar',
        parsingTemplate: {
          total: 'TOTAL:?\\s*(\\d+\\.\\d{2})',
          items: {
            pattern: '[invalid regex(',
            multiline: true
          }
        }
      };
      const template = loadTemplateFromConfig(config);
      expect(template.items).toEqual(DEFAULT_TEMPLATE.items);
    });

    it('should use default pattern for invalid optional fields', () => {
      const config = {
        barId: 'test-bar',
        parsingTemplate: {
          total: 'TOTAL:?\\s*(\\d+\\.\\d{2})',
          receiptNumber: '[invalid regex(',
          timestamp: '[another invalid(',
          subtotal: '[invalid(',
          tax: '[invalid('
        }
      };
      const template = loadTemplateFromConfig(config);
      expect(template.total).toBe('TOTAL:?\\s*(\\d+\\.\\d{2})');
      expect(template.receiptNumber).toBe(DEFAULT_TEMPLATE.receiptNumber);
      expect(template.timestamp).toBe(DEFAULT_TEMPLATE.timestamp);
      expect(template.subtotal).toBe(DEFAULT_TEMPLATE.subtotal);
      expect(template.tax).toBe(DEFAULT_TEMPLATE.tax);
    });

    it('should handle partial custom template with some valid and some invalid fields', () => {
      const config = {
        barId: 'test-bar',
        parsingTemplate: {
          total: 'TOTAL:?\\s*(\\d+\\.\\d{2})', // Valid
          receiptNumber: 'RCP-(\\d+)', // Valid
          timestamp: '[invalid(', // Invalid - should use default
          subtotal: 'Sub:?\\s*(\\d+\\.\\d{2})' // Valid
        }
      };
      const template = loadTemplateFromConfig(config);
      expect(template.total).toBe('TOTAL:?\\s*(\\d+\\.\\d{2})');
      expect(template.receiptNumber).toBe('RCP-(\\d+)');
      expect(template.timestamp).toBe(DEFAULT_TEMPLATE.timestamp);
      expect(template.subtotal).toBe('Sub:?\\s*(\\d+\\.\\d{2})');
    });

    it('should handle config with extra unknown fields gracefully', () => {
      const config = {
        barId: 'test-bar',
        parsingTemplate: {
          total: 'TOTAL:?\\s*(\\d+\\.\\d{2})',
          unknownField: 'some value',
          anotherUnknown: 123
        }
      };
      const template = loadTemplateFromConfig(config);
      expect(template.total).toBe('TOTAL:?\\s*(\\d+\\.\\d{2})');
      // Unknown fields should be preserved in the template
      expect(template.unknownField).toBe('some value');
      expect(template.anotherUnknown).toBe(123);
    });

    it('should handle exception during template loading', () => {
      // Create a config that will throw during processing
      const config = {
        get parsingTemplate() {
          throw new Error('Simulated error');
        }
      };
      const template = loadTemplateFromConfig(config);
      expect(template).toEqual(DEFAULT_TEMPLATE);
    });
  });

  describe('Multiple template format support', () => {
    it('should support Captain Orders format template', () => {
      const config = {
        barId: 'test-bar',
        parsingTemplate: {
          receiptNumber: 'Order\\s*#:?\\s*(\\d+)',
          timestamp: '(\\d{4}-\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2})',
          items: {
            pattern: '^(.+?)\\s+x(\\d+)\\s+@\\s+(\\d+\\.\\d{2})$',
            multiline: true,
            startMarker: 'ITEMS:',
            endMarker: '^={3,}'
          },
          subtotal: 'Subtotal:\\s*(\\d+\\.\\d{2})',
          tax: 'VAT\\s*\\(16%\\):\\s*(\\d+\\.\\d{2})',
          total: 'Total:\\s*(\\d+\\.\\d{2})'
        }
      };
      const template = loadTemplateFromConfig(config);
      expect(template.receiptNumber).toBe('Order\\s*#:?\\s*(\\d+)');
      expect(template.items.startMarker).toBe('ITEMS:');
      expect(template.items.endMarker).toBe('^={3,}');
    });

    it('should support minimal template with only total', () => {
      const config = {
        barId: 'test-bar',
        parsingTemplate: {
          total: 'Amount\\s*Due:\\s*(\\d+\\.\\d{2})'
        }
      };
      const template = loadTemplateFromConfig(config);
      expect(template.total).toBe('Amount\\s*Due:\\s*(\\d+\\.\\d{2})');
    });
  });

  describe('Fallback behavior', () => {
    it('should fall back to default template on any error', () => {
      const invalidConfigs = [
        undefined,
        null,
        '',
        123,
        [],
        { parsingTemplate: null },
        { parsingTemplate: [] },
        { parsingTemplate: { total: null } },
        { parsingTemplate: { total: '' } }
      ];

      invalidConfigs.forEach(config => {
        const template = loadTemplateFromConfig(config);
        expect(template).toEqual(DEFAULT_TEMPLATE);
      });
    });
  });
});
