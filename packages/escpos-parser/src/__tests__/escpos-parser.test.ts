/**
 * Tests for ESC/POS Parser
 * Pure logic tests with no OS dependencies
 */

import { 
  FormatDetector, 
  ReceiptParser,
  detectPrintFormat,
  parseReceiptData,
  createTestPrintData,
  validateParsingResult,
  createParsingOptions
} from '../index';

describe('ESC/POS Parser', () => {
  describe('FormatDetector', () => {
    let detector: FormatDetector;

    beforeEach(() => {
      detector = new FormatDetector();
    });

    it('should detect plain text format', () => {
      const testData = Buffer.from('Test Restaurant\nTotal: 150.00\nThank you!', 'utf8');
      const result = detector.detect(testData);
      
      expect(result.format).toBe('PLAIN_TEXT');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.indicators).toContain('receipt_patterns_detected');
    });

    it('should detect ESC/POS format', () => {
      const escPosData = Buffer.from([
        0x1B, 0x40, // ESC @ (Initialize)
        ...Buffer.from('Test Restaurant\n', 'utf8'),
        0x1B, 0x45, 0x01, // ESC E 1 (Bold on)
        ...Buffer.from('Total: 150.00\n', 'utf8'),
        0x1D, 0x56, 0x00 // GS V 0 (Cut paper)
      ]);
      
      const result = detector.detect(escPosData);
      
      expect(result.format).toBe('ESC_POS');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.indicators).toContain('escpos_commands_detected');
    });

    it('should detect PDF format', () => {
      const pdfData = Buffer.from('%PDF-1.4\nSome PDF content', 'utf8');
      const result = detector.detect(pdfData);
      
      expect(result.format).toBe('PDF');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.indicators).toContain('pdf_header_found');
    });

    it('should detect PNG image format', () => {
      const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const result = detector.detect(pngSignature);
      
      expect(result.format).toBe('IMAGE');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.metadata?.type).toBe('PNG');
    });

    it('should return UNKNOWN for unrecognizable data', () => {
      const randomData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
      const result = detector.detect(randomData);
      
      expect(result.format).toBe('UNKNOWN');
      expect(result.confidence).toBe(0);
    });
  });

  describe('ReceiptParser', () => {
    let parser: ReceiptParser;

    beforeEach(() => {
      parser = new ReceiptParser();
    });

    it('should parse plain text receipt successfully', async () => {
      const receiptText = `
        Test Restaurant
        KRA PIN: P123456789A
        Date: 2024-01-15
        Receipt #: RCP001
        ================================
        Coffee                2 x 75 = 150
        Sandwich              1 x 300 = 300
        ================================
        Subtotal: 450
        Tax: 72
        Total: 522
        ================================
        Thank you!
      `.trim();

      const options = createParsingOptions('test-merchant-123');
      const result = await parser.parse(receiptText, options);

      expect(result.status).toBe('success');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.receipt).toBeDefined();
      
      if (result.receipt) {
        expect(result.receipt.session.merchant.name).toBe('Test Restaurant');
        expect(result.receipt.session.merchant.kra_pin).toBe('P123456789A');
        expect(result.receipt.events).toHaveLength(1);
        expect(result.receipt.events[0].items).toHaveLength(2);
        expect(result.receipt.totals?.total).toBe(522);
      }
    });

    it('should handle ESC/POS data', async () => {
      const escPosData = createTestPrintData('ESC_POS', {
        merchantName: 'ESC/POS Restaurant',
        items: [{ name: 'Tea', price: 100, qty: 1 }],
        total: 100
      });

      const options = createParsingOptions('test-merchant-456');
      const result = await parser.parse(escPosData, options);

      expect(result.status).toMatch(/success|partial/);
      expect(result.receipt).toBeDefined();
      
      if (result.receipt) {
        expect(result.receipt.session.merchant.name).toBe('ESC/POS Restaurant');
        expect(result.receipt.events[0].items).toHaveLength(1);
      }
    });

    it('should handle parsing errors gracefully', async () => {
      const invalidData = Buffer.from([0x00, 0x01, 0x02]);
      const options = createParsingOptions('test-merchant-789');
      
      const result = await parser.parse(invalidData, options);

      expect(result.status).toBe('failed');
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should respect parsing options', async () => {
      const receiptText = 'Minimal receipt\nTotal: 50';
      
      const strictOptions = createParsingOptions('test-merchant', {
        strictMode: true,
        minConfidence: 0.9
      });
      
      const lenientOptions = createParsingOptions('test-merchant', {
        strictMode: false,
        minConfidence: 0.3
      });

      const strictResult = await parser.parse(receiptText, strictOptions);
      const lenientResult = await parser.parse(receiptText, lenientOptions);

      // Strict mode should be more likely to fail on minimal data
      expect(strictResult.confidence).toBeLessThanOrEqual(lenientResult.confidence);
    });
  });

  describe('Utility Functions', () => {
    it('should detect format correctly', () => {
      const plainText = 'Restaurant\nTotal: 100';
      const result = detectPrintFormat(plainText);
      
      expect(result.format).toBe('PLAIN_TEXT');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should parse receipt data with convenience function', async () => {
      const receiptData = createTestPrintData('PLAIN_TEXT');
      const result = await parseReceiptData(receiptData, 'test-merchant');
      
      expect(result.status).toMatch(/success|partial/);
      expect(result.receipt).toBeDefined();
    });

    it('should validate parsing results', async () => {
      const goodReceipt = createTestPrintData('PLAIN_TEXT', {
        items: [{ name: 'Item', price: 100 }],
        total: 100
      });
      
      const goodResult = await parseReceiptData(goodReceipt, 'test-merchant');
      const isValid = validateParsingResult(goodResult);
      
      expect(isValid).toBe(true);
    });

    it('should create test data for different formats', () => {
      const plainTextData = createTestPrintData('PLAIN_TEXT');
      const escPosData = createTestPrintData('ESC_POS');
      
      expect(Buffer.isBuffer(plainTextData)).toBe(true);
      expect(Buffer.isBuffer(escPosData)).toBe(true);
      expect(plainTextData.length).toBeGreaterThan(0);
      expect(escPosData.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty data', async () => {
      const emptyData = Buffer.alloc(0);
      const result = await parseReceiptData(emptyData, 'test-merchant');
      
      expect(result.status).toBe('failed');
      expect(result.errors).toBeDefined();
    });

    it('should handle malformed data', async () => {
      const malformedData = Buffer.from('Not a receipt at all');
      const result = await parseReceiptData(malformedData, 'test-merchant');
      
      // Should either fail or have low confidence
      expect(result.confidence < 0.5 || result.status === 'failed').toBe(true);
    });

    it('should timeout on processing limits', async () => {
      const largeData = Buffer.alloc(1000000, 'x'); // 1MB of 'x'
      
      const options = createParsingOptions('test-merchant', {
        maxProcessingTime: 100 // 100ms limit
      });
      
      const result = await parseReceiptData(largeData, options);
      
      // Should either complete quickly or timeout
      expect(result.metadata.processingTime).toBeLessThan(1000);
    });
  });

  describe('Integration Tests', () => {
    it('should handle real-world receipt patterns', async () => {
      const realWorldReceipt = `
        JAVA HOUSE
        Westgate Mall, Nairobi
        KRA PIN: P051234567M
        
        Date: 15/01/2024 14:30
        Receipt: JH001234
        Cashier: Mary
        
        ================================
        Americano Large         1  350.00
        Chicken Sandwich        1  650.00
        Bottled Water          1   80.00
        ================================
        
        Subtotal:            1,080.00
        VAT (16%):             172.80
        ================================
        TOTAL:               1,252.80
        ================================
        
        Payment: M-PESA
        Ref: QA12B3C4D5
        
        Thank you for visiting!
        Visit us again soon.
      `.trim();

      const result = await parseReceiptData(realWorldReceipt, 'java-house-westgate');

      expect(result.status).toMatch(/success|partial/);
      expect(result.confidence).toBeGreaterThan(0.6);
      
      if (result.receipt) {
        expect(result.receipt.session.merchant.name).toBe('JAVA HOUSE');
        expect(result.receipt.session.merchant.kra_pin).toBe('P051234567M');
        expect(result.receipt.events[0].items).toHaveLength(3);
        expect(result.receipt.totals?.total).toBeCloseTo(1252.80, 2);
        expect(result.receipt.events[0].payment?.method).toBe('MPESA');
      }
    });

    it('should maintain consistency across multiple parses', async () => {
      const testData = createTestPrintData('PLAIN_TEXT');
      
      const results = await Promise.all([
        parseReceiptData(testData, 'test-merchant'),
        parseReceiptData(testData, 'test-merchant'),
        parseReceiptData(testData, 'test-merchant')
      ]);

      // All results should be similar
      for (let i = 1; i < results.length; i++) {
        expect(results[i].status).toBe(results[0].status);
        expect(Math.abs(results[i].confidence - results[0].confidence)).toBeLessThan(0.1);
      }
    });
  });
});