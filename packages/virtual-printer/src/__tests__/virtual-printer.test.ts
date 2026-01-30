/**
 * Basic tests for TABEZA Virtual Printer Interface
 */

import { 
  createVirtualPrinter, 
  createTestReceipt, 
  createTestPrintData,
  validateReceipt,
  formatReceiptForDisplay,
  FormatDetector,
  ReceiptParser,
  SecurityManager,
  DEFAULT_SECURITY_CONFIG
} from '../index';

describe('TABEZA Virtual Printer Interface', () => {
  const merchantId = 'test-merchant-001';
  const secretKey = 'test-secret-key-32-characters-long';

  describe('Factory Functions', () => {
    test('should create virtual printer instance', () => {
      const printer = createVirtualPrinter(merchantId, {
        secretKey,
        forwardToPhysicalPrinter: false,
        generateQRCode: true
      });

      expect(printer).toBeDefined();
      expect(printer.getConfig().merchantId).toBe(merchantId);
    });

    test('should create test receipt', () => {
      const receipt = createTestReceipt(merchantId, {
        merchantName: 'Test Restaurant',
        paymentMethod: 'MPESA',
        includeKraPin: true
      });

      expect(receipt.merchant.id).toBe(merchantId);
      expect(receipt.merchant.name).toBe('Test Restaurant');
      expect(receipt.transaction.payment_method).toBe('MPESA');
      expect(receipt.merchant.kra_pin).toBeDefined();
      expect(receipt.items.length).toBeGreaterThan(0);
      expect(receipt.totals.total).toBeGreaterThan(0);
    });

    test('should create test print data', () => {
      const plainTextData = createTestPrintData('PLAIN_TEXT');
      const escPosData = createTestPrintData('ESC_POS');

      expect(Buffer.isBuffer(plainTextData)).toBe(true);
      expect(Buffer.isBuffer(escPosData)).toBe(true);
      expect(plainTextData.length).toBeGreaterThan(0);
      expect(escPosData.length).toBeGreaterThan(0);
    });
  });

  describe('Format Detection', () => {
    test('should detect plain text format', () => {
      const detector = new FormatDetector();
      const testData = createTestPrintData('PLAIN_TEXT');
      
      const result = detector.detect(testData);
      
      expect(result.format).toBe('PLAIN_TEXT');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should detect ESC/POS format', () => {
      const detector = new FormatDetector();
      const testData = createTestPrintData('ESC_POS');
      
      const result = detector.detect(testData);
      
      expect(result.format).toBe('ESC_POS');
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Receipt Parsing', () => {
    test('should parse plain text receipt', async () => {
      const parser = new ReceiptParser();
      const testData = createTestPrintData('PLAIN_TEXT');
      
      const result = await parser.parse(testData, merchantId);
      
      expect(result.status).toBe('parsed');
      expect(result.receipt).toBeDefined();
      expect(result.receipt!.merchant.id).toBe(merchantId);
      expect(result.receipt!.items.length).toBeGreaterThan(0);
      expect(result.receipt!.totals.total).toBeGreaterThan(0);
    });

    test('should handle parsing failures gracefully', async () => {
      const parser = new ReceiptParser();
      const invalidData = Buffer.from('invalid data', 'utf8');
      
      const result = await parser.parse(invalidData, merchantId);
      
      expect(['failed', 'partial']).toContain(result.status);
    });
  });

  describe('Security Manager', () => {
    test('should sign and verify receipts', () => {
      const security = new SecurityManager({
        ...DEFAULT_SECURITY_CONFIG,
        secretKey
      });
      
      const receipt = createTestReceipt(merchantId);
      const signature = security.signReceipt(receipt);
      
      expect(signature.hash).toBeDefined();
      expect(signature.signature).toBeDefined();
      expect(signature.timestamp).toBeDefined();
      
      const audit = security.verifyReceipt(receipt, signature);
      expect(audit.isValid).toBe(true);
      expect(audit.checks.hashIntegrity).toBe(true);
      expect(audit.checks.signatureValid).toBe(true);
    });

    test('should detect tampering', () => {
      const security = new SecurityManager({
        ...DEFAULT_SECURITY_CONFIG,
        secretKey
      });
      
      const receipt = createTestReceipt(merchantId);
      const tamperingCheck = security.detectTampering(receipt);
      
      expect(tamperingCheck.suspicious).toBe(false);
      expect(tamperingCheck.riskLevel).toBe('low');
    });
  });

  describe('Validation', () => {
    test('should validate correct receipt', () => {
      const receipt = createTestReceipt(merchantId);
      const validation = validateReceipt(receipt);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    test('should detect validation errors', () => {
      const invalidReceipt = {
        ...createTestReceipt(merchantId),
        totals: {
          subtotal: 100,
          tax: 16,
          discount: 0,
          service_charge: 0,
          total: 200 // Incorrect total
        }
      };
      
      const validation = validateReceipt(invalidReceipt);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Formatting', () => {
    test('should format receipt for display', () => {
      const receipt = createTestReceipt(merchantId);
      const formatted = formatReceiptForDisplay(receipt);
      
      expect(formatted).toContain(receipt.merchant.name);
      expect(formatted).toContain(receipt.transaction.receipt_no);
      expect(formatted).toContain('TOTAL:');
      expect(formatted).toContain(receipt.totals.total.toFixed(2));
    });
  });

  describe('Integration Test', () => {
    test('should process receipt end-to-end', async () => {
      const printer = createVirtualPrinter(merchantId, {
        secretKey,
        forwardToPhysicalPrinter: false,
        generateQRCode: true
      });

      const testData = createTestPrintData('PLAIN_TEXT');
      
      const result = await printer.processReceiptManually(
        testData,
        merchantId
      );
      
      expect(result.receipt).toBeDefined();
      expect(result.signature).toBeDefined();
      expect(result.qrCode).toBeDefined();
      expect(result.receipt.signature).toBeDefined();
      expect(result.qrCode.url).toContain(result.receipt.receipt_id);
      
      // Check compliance hints are attached
      expect(result.receipt._compliance).toBeDefined();
      expect(result.receipt._compliance.hints).toBeDefined();
    });
  });
});