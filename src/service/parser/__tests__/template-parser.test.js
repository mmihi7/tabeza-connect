const fs = require('fs');
const path = require('path');
const TemplateParser = require('../template-parser');

// Mock fs module
jest.mock('fs');

describe('TemplateParser', () => {
  const mockTemplatePath = 'C:\\ProgramData\\Tabeza\\template.json';
  
  const validTemplate = {
    version: '1.2',
    posSystem: 'AccelPOS',
    patterns: {
      item_line: '^(.+?)\\s+(\\d+)\\s+([0-9,]+\\.\\d{2})$',
      total_line: '^TOTAL\\s+([0-9,]+\\.\\d{2})$',
      receipt_number: '^Receipt\\s*#?:\\s*(\\S+)$'
    },
    confidence_threshold: 0.85
  };

  const sampleReceipt = `
Receipt #: RCP-001234
================================
Tusker Lager 500ml    2    500.00
Nyama Choma           1    800.00
================================
TOTAL                    1300.00
`.trim();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parse() with valid template', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(validTemplate));
    });

    it('should parse receipt with all patterns matching', () => {
      const result = TemplateParser.parse(sampleReceipt, mockTemplatePath);

      expect(result.parsed).toBe(true);
      expect(result.confidence).toBe(1.0);
      expect(result.receiptNumber).toBe('RCP-001234');
      expect(result.total).toBe(1300.00);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        name: 'Tusker Lager 500ml',
        qty: 2,
        price: 500.00
      });
      expect(result.items[1]).toEqual({
        name: 'Nyama Choma',
        qty: 1,
        price: 800.00
      });
    });

    it('should include raw text in result', () => {
      const result = TemplateParser.parse(sampleReceipt, mockTemplatePath);

      expect(result.rawText).toBe(sampleReceipt);
    });

    it('should include template version', () => {
      const result = TemplateParser.parse(sampleReceipt, mockTemplatePath);

      expect(result.templateVersion).toBe('1.2');
    });

    it('should complete parsing in < 5ms for typical receipts', () => {
      const result = TemplateParser.parse(sampleReceipt, mockTemplatePath);

      expect(result.parseTimeMs).toBeLessThan(5);
    });

    it('should handle receipts with comma-separated prices', () => {
      const receiptWithCommas = `
Receipt #: RCP-002
Expensive Item        1    1,500.50
TOTAL                    1,500.50
`.trim();

      const result = TemplateParser.parse(receiptWithCommas, mockTemplatePath);

      expect(result.parsed).toBe(true);
      expect(result.items[0].price).toBe(1500.50);
      expect(result.total).toBe(1500.50);
    });
  });

  describe('parse() with missing template', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(false);
    });

    it('should return parsed: false when template does not exist', () => {
      const result = TemplateParser.parse(sampleReceipt, mockTemplatePath);

      expect(result.parsed).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.items).toEqual([]);
      expect(result.total).toBeNull();
      expect(result.receiptNumber).toBeNull();
      expect(result.rawText).toBe(sampleReceipt);
    });

    it('should include parse time even when template missing', () => {
      const result = TemplateParser.parse(sampleReceipt, mockTemplatePath);

      expect(result.parseTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('parse() with malformed template', () => {
    it('should handle invalid JSON gracefully', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{ invalid json }');

      const result = TemplateParser.parse(sampleReceipt, mockTemplatePath);

      expect(result.parsed).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should handle template without patterns field', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0' }));

      const result = TemplateParser.parse(sampleReceipt, mockTemplatePath);

      expect(result.parsed).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should handle file read errors', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = TemplateParser.parse(sampleReceipt, mockTemplatePath);

      expect(result.parsed).toBe(false);
    });
  });

  describe('loadTemplate()', () => {
    it('should load valid template from disk', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(validTemplate));

      const template = TemplateParser.loadTemplate(mockTemplatePath);

      expect(template).toEqual(validTemplate);
      expect(fs.readFileSync).toHaveBeenCalledWith(mockTemplatePath, 'utf8');
    });

    it('should return null when file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const template = TemplateParser.loadTemplate(mockTemplatePath);

      expect(template).toBeNull();
    });

    it('should return null for malformed JSON', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{ invalid }');

      const template = TemplateParser.loadTemplate(mockTemplatePath);

      expect(template).toBeNull();
    });

    it('should return null for template without patterns', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0' }));

      const template = TemplateParser.loadTemplate(mockTemplatePath);

      expect(template).toBeNull();
    });
  });

  describe('calculateConfidence()', () => {
    it('should return 1.0 when all patterns match', () => {
      const confidence = TemplateParser.calculateConfidence(3, 3);
      expect(confidence).toBe(1.0);
    });

    it('should return 0.67 when 2 of 3 patterns match', () => {
      const confidence = TemplateParser.calculateConfidence(2, 3);
      expect(confidence).toBeCloseTo(0.67, 2);
    });

    it('should return 0.0 when no patterns match', () => {
      const confidence = TemplateParser.calculateConfidence(0, 3);
      expect(confidence).toBe(0.0);
    });

    it('should return 0.0 when total patterns is 0', () => {
      const confidence = TemplateParser.calculateConfidence(0, 0);
      expect(confidence).toBe(0.0);
    });
  });

  describe('validate()', () => {
    it('should return true for valid parsed data above threshold', () => {
      const parsed = {
        items: [
          { name: 'Item 1', qty: 2, price: 100.00 },
          { name: 'Item 2', qty: 1, price: 50.00 }
        ],
        total: 250.00,
        confidence: 0.90
      };

      const isValid = TemplateParser.validate(parsed, 0.85);
      expect(isValid).toBe(true);
    });

    it('should return false when confidence below threshold', () => {
      const parsed = {
        items: [{ name: 'Item', qty: 1, price: 100.00 }],
        total: 100.00,
        confidence: 0.80
      };

      const isValid = TemplateParser.validate(parsed, 0.85);
      expect(isValid).toBe(false);
    });

    it('should return false when total does not match sum of items', () => {
      const parsed = {
        items: [
          { name: 'Item 1', qty: 2, price: 100.00 },
          { name: 'Item 2', qty: 1, price: 50.00 }
        ],
        total: 300.00, // Should be 250.00
        confidence: 0.90
      };

      const isValid = TemplateParser.validate(parsed, 0.85);
      expect(isValid).toBe(false);
    });

    it('should accept total within 0.01 tolerance', () => {
      const parsed = {
        items: [{ name: 'Item', qty: 1, price: 100.00 }],
        total: 100.005, // Within tolerance
        confidence: 0.90
      };

      const isValid = TemplateParser.validate(parsed, 0.85);
      expect(isValid).toBe(true);
    });

    it('should return false when item has empty name', () => {
      const parsed = {
        items: [{ name: '', qty: 1, price: 100.00 }],
        total: 100.00,
        confidence: 0.90
      };

      const isValid = TemplateParser.validate(parsed, 0.85);
      expect(isValid).toBe(false);
    });

    it('should return false when item has non-positive quantity', () => {
      const parsed = {
        items: [{ name: 'Item', qty: 0, price: 100.00 }],
        total: 0,
        confidence: 0.90
      };

      const isValid = TemplateParser.validate(parsed, 0.85);
      expect(isValid).toBe(false);
    });

    it('should return false when item has non-integer quantity', () => {
      const parsed = {
        items: [{ name: 'Item', qty: 1.5, price: 100.00 }],
        total: 150.00,
        confidence: 0.90
      };

      const isValid = TemplateParser.validate(parsed, 0.85);
      expect(isValid).toBe(false);
    });

    it('should return false when item has non-positive price', () => {
      const parsed = {
        items: [{ name: 'Item', qty: 1, price: -100.00 }],
        total: -100.00,
        confidence: 0.90
      };

      const isValid = TemplateParser.validate(parsed, 0.85);
      expect(isValid).toBe(false);
    });

    it('should return true when no items but confidence above threshold', () => {
      const parsed = {
        items: [],
        total: null,
        confidence: 0.90
      };

      const isValid = TemplateParser.validate(parsed, 0.85);
      expect(isValid).toBe(true);
    });
  });
});
