/**
 * Unit Tests for Receipt Parser Test Mode
 * 
 * Tests the test mode functionality that accepts sample receipt text
 * and provides detailed parsing analysis and statistics.
 * 
 * Requirements: 8.1, 8.2, 8.6
 */

const { testMode, DEFAULT_TEMPLATE } = require('../receiptParser');

describe('Receipt Parser Test Mode', () => {
  // Sample receipt with all fields
  const fullReceipt = `
Captain's Orders Bar
Receipt #: RCP-2024-001234
Date: 12/15/2024 8:45:30 PM

QTY  ITEM                           AMOUNT
----------------------------------------
2    Tusker Lager 500ml         500.00
1    Guinness Stout 500ml       300.00
3    Chicken Wings              450.00
----------------------------------------
Subtotal:                     1,250.00
VAT (16%):                      200.00

TOTAL:                        1,450.00
  `.trim();

  // Sample receipt with partial fields
  const partialReceipt = `
Some Bar
----------------------------------------
2    Beer                       400.00
1    Soda                       100.00
----------------------------------------
TOTAL:                          500.00
  `.trim();

  // Sample receipt with minimal fields
  const minimalReceipt = `
TOTAL:                          100.00
  `.trim();

  // Malformed receipt
  const malformedReceipt = `
This is not a valid receipt
Just some random text
No structured data here
  `.trim();

  describe('Single Receipt Testing', () => {
    it('should test a single receipt and return detailed results', () => {
      const results = testMode(fullReceipt, DEFAULT_TEMPLATE, { verbose: false });

      expect(results).toBeDefined();
      expect(results.totalReceipts).toBe(1);
      expect(results.parsedReceipts).toHaveLength(1);
      expect(results.statistics).toBeDefined();
      expect(results.templateUsed).toBe('default');
    });

    it('should include field extraction details', () => {
      const results = testMode(fullReceipt, DEFAULT_TEMPLATE, { verbose: false });
      const receipt = results.parsedReceipts[0];

      expect(receipt.fieldsExtracted).toBeDefined();
      expect(receipt.fieldsExtracted.receiptNumber).toBe(true);
      expect(receipt.fieldsExtracted.timestamp).toBe(true);
      expect(receipt.fieldsExtracted.items).toBeGreaterThan(0);
      expect(receipt.fieldsExtracted.subtotal).toBe(true);
      expect(receipt.fieldsExtracted.tax).toBe(true);
      expect(receipt.fieldsExtracted.total).toBe(true);
    });

    it('should include parsed data', () => {
      const results = testMode(fullReceipt, DEFAULT_TEMPLATE, { verbose: false });
      const receipt = results.parsedReceipts[0];

      expect(receipt.parsedData).toBeDefined();
      expect(receipt.parsedData.receiptNumber).toBe('RCP-2024-001234');
      expect(receipt.parsedData.timestamp).toContain('12/15/2024');
      expect(receipt.parsedData.items).toHaveLength(3);
      expect(receipt.parsedData.total).toBe(1450.00);
    });

    it('should assign correct confidence level', () => {
      const results = testMode(fullReceipt, DEFAULT_TEMPLATE, { verbose: false });
      const receipt = results.parsedReceipts[0];

      expect(receipt.confidence).toBe('high');
    });

    it('should handle partial receipts with appropriate confidence', () => {
      const results = testMode(partialReceipt, DEFAULT_TEMPLATE, { verbose: false });
      const receipt = results.parsedReceipts[0];

      // Partial receipt has items and total but no other fields
      // This should be medium confidence if items are extracted, low otherwise
      expect(['medium', 'low']).toContain(receipt.confidence);
      expect(receipt.fieldsExtracted.total).toBe(true);
    });

    it('should handle minimal receipts with low confidence', () => {
      const results = testMode(minimalReceipt, DEFAULT_TEMPLATE, { verbose: false });
      const receipt = results.parsedReceipts[0];

      expect(receipt.confidence).toBe('low');
      expect(receipt.fieldsExtracted.total).toBe(true);
    });

    it('should handle malformed receipts gracefully', () => {
      const results = testMode(malformedReceipt, DEFAULT_TEMPLATE, { verbose: false });
      const receipt = results.parsedReceipts[0];

      expect(receipt.confidence).toBe('low');
      expect(receipt.fieldsExtracted.items).toBe(0);
    });
  });

  describe('Multiple Receipts Testing', () => {
    it('should test multiple receipts and return aggregated results', () => {
      const receipts = [fullReceipt, partialReceipt, minimalReceipt];
      const results = testMode(receipts, DEFAULT_TEMPLATE, { verbose: false });

      expect(results.totalReceipts).toBe(3);
      expect(results.parsedReceipts).toHaveLength(3);
    });

    it('should calculate correct statistics for multiple receipts', () => {
      const receipts = [fullReceipt, partialReceipt, minimalReceipt, malformedReceipt];
      const results = testMode(receipts, DEFAULT_TEMPLATE, { verbose: false });

      // fullReceipt should be high, others depend on parsing success
      expect(results.statistics.high).toBeGreaterThanOrEqual(1);
      expect(results.statistics.high + results.statistics.medium + results.statistics.low).toBe(4);
    });

    it('should calculate confidence distribution percentages', () => {
      const receipts = [fullReceipt, partialReceipt, minimalReceipt, malformedReceipt];
      const results = testMode(receipts, DEFAULT_TEMPLATE, { verbose: false });

      expect(results.statistics.confidenceDistribution).toBeDefined();
      expect(results.statistics.confidenceDistribution.high).toBeDefined();
      expect(results.statistics.confidenceDistribution.medium).toBeDefined();
      expect(results.statistics.confidenceDistribution.low).toBeDefined();
      
      // Verify percentages add up to 100%
      const high = parseFloat(results.statistics.confidenceDistribution.high);
      const medium = parseFloat(results.statistics.confidenceDistribution.medium);
      const low = parseFloat(results.statistics.confidenceDistribution.low);
      expect(high + medium + low).toBeCloseTo(100, 0);
    });

    it('should calculate success rate correctly', () => {
      const receipts = [fullReceipt, partialReceipt, minimalReceipt, malformedReceipt];
      const results = testMode(receipts, DEFAULT_TEMPLATE, { verbose: false });

      // Success rate = (high + medium) / total * 100
      const successRate = parseFloat(results.statistics.successRate);
      expect(successRate).toBeGreaterThanOrEqual(0);
      expect(successRate).toBeLessThanOrEqual(100);
      
      // Verify calculation
      const expectedRate = ((results.statistics.high + results.statistics.medium) / 4) * 100;
      expect(successRate).toBeCloseTo(expectedRate, 0);
    });
  });

  describe('Options Handling', () => {
    it('should respect verbose option', () => {
      // Capture console output
      const originalLog = console.log;
      let logOutput = '';
      console.log = (...args) => {
        logOutput += args.join(' ') + '\n';
      };

      testMode(fullReceipt, DEFAULT_TEMPLATE, { verbose: true });

      console.log = originalLog;

      // Verbose mode should produce output
      expect(logOutput.length).toBeGreaterThan(0);
      expect(logOutput).toContain('Parsing Results');
    });

    it('should respect showRawText option', () => {
      const results = testMode(fullReceipt, DEFAULT_TEMPLATE, { 
        verbose: false, 
        showRawText: true 
      });
      const receipt = results.parsedReceipts[0];

      expect(receipt.rawText).toBeDefined();
      expect(receipt.rawText).toContain('Captain\'s Orders Bar');
    });

    it('should not include raw text by default', () => {
      const results = testMode(fullReceipt, DEFAULT_TEMPLATE, { verbose: false });
      const receipt = results.parsedReceipts[0];

      expect(receipt.rawText).toBeUndefined();
    });
  });

  describe('Template Usage', () => {
    it('should indicate default template when none provided', () => {
      const results = testMode(fullReceipt, null, { verbose: false });

      expect(results.templateUsed).toBe('default');
    });

    it('should indicate custom template when provided', () => {
      const customTemplate = {
        ...DEFAULT_TEMPLATE,
        receiptNumber: 'Custom\\s*#:\\s*(\\S+)'
      };
      const results = testMode(fullReceipt, customTemplate, { verbose: false });

      expect(results.templateUsed).toBe('custom');
    });
  });

  describe('Error Handling', () => {
    it('should handle null input gracefully', () => {
      const results = testMode(null, DEFAULT_TEMPLATE, { verbose: false });

      expect(results.totalReceipts).toBe(1);
      expect(results.parsedReceipts[0].confidence).toBe('low');
    });

    it('should handle undefined input gracefully', () => {
      const results = testMode(undefined, DEFAULT_TEMPLATE, { verbose: false });

      expect(results.totalReceipts).toBe(1);
      expect(results.parsedReceipts[0].confidence).toBe('low');
    });

    it('should handle empty string input', () => {
      const results = testMode('', DEFAULT_TEMPLATE, { verbose: false });

      expect(results.totalReceipts).toBe(1);
      expect(results.parsedReceipts[0].confidence).toBe('low');
    });

    it('should handle empty array input', () => {
      const results = testMode([], DEFAULT_TEMPLATE, { verbose: false });

      expect(results.totalReceipts).toBe(0);
      expect(results.parsedReceipts).toHaveLength(0);
    });

    it('should include error field when parsing fails', () => {
      const results = testMode(null, DEFAULT_TEMPLATE, { verbose: false });
      const receipt = results.parsedReceipts[0];

      expect(receipt.error).toBeDefined();
    });
  });

  describe('Index Tracking', () => {
    it('should track receipt index correctly', () => {
      const receipts = [fullReceipt, partialReceipt, minimalReceipt];
      const results = testMode(receipts, DEFAULT_TEMPLATE, { verbose: false });

      expect(results.parsedReceipts[0].index).toBe(1);
      expect(results.parsedReceipts[1].index).toBe(2);
      expect(results.parsedReceipts[2].index).toBe(3);
    });
  });

  describe('Field Extraction Flags', () => {
    it('should correctly flag extracted fields', () => {
      const results = testMode(fullReceipt, DEFAULT_TEMPLATE, { verbose: false });
      const receipt = results.parsedReceipts[0];

      expect(receipt.fieldsExtracted.receiptNumber).toBe(true);
      expect(receipt.fieldsExtracted.timestamp).toBe(true);
      expect(receipt.fieldsExtracted.items).toBe(3);
      expect(receipt.fieldsExtracted.subtotal).toBe(true);
      expect(receipt.fieldsExtracted.tax).toBe(true);
      expect(receipt.fieldsExtracted.total).toBe(true);
    });

    it('should correctly flag missing fields', () => {
      const results = testMode(minimalReceipt, DEFAULT_TEMPLATE, { verbose: false });
      const receipt = results.parsedReceipts[0];

      expect(receipt.fieldsExtracted.receiptNumber).toBe(false);
      expect(receipt.fieldsExtracted.timestamp).toBe(false);
      expect(receipt.fieldsExtracted.items).toBe(0);
      expect(receipt.fieldsExtracted.subtotal).toBe(false);
      // Tax defaults to 0 when not found, which counts as extracted
      expect(typeof receipt.fieldsExtracted.tax).toBe('boolean');
      expect(receipt.fieldsExtracted.total).toBe(true);
    });
  });

  describe('Requirements Validation', () => {
    it('should accept sample receipt text for testing (Req 8.1)', () => {
      const results = testMode(fullReceipt, DEFAULT_TEMPLATE, { verbose: false });
      
      expect(results).toBeDefined();
      expect(results.parsedReceipts).toHaveLength(1);
    });

    it('should log parsing results with field extraction details (Req 8.2)', () => {
      const results = testMode(fullReceipt, DEFAULT_TEMPLATE, { verbose: false });
      const receipt = results.parsedReceipts[0];

      // Verify detailed field extraction information is available
      expect(receipt.fieldsExtracted).toBeDefined();
      expect(receipt.parsedData).toBeDefined();
      expect(receipt.confidence).toBeDefined();
    });

    it('should provide parsing statistics (Req 8.6)', () => {
      const receipts = [fullReceipt, partialReceipt, minimalReceipt];
      const results = testMode(receipts, DEFAULT_TEMPLATE, { verbose: false });

      // Verify statistics are provided
      expect(results.statistics).toBeDefined();
      expect(results.statistics.high).toBeDefined();
      expect(results.statistics.medium).toBeDefined();
      expect(results.statistics.low).toBeDefined();
      expect(results.statistics.successRate).toBeDefined();
      expect(results.statistics.confidenceDistribution).toBeDefined();
    });
  });
});
