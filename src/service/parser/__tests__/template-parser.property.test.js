const fc = require('fast-check');
const fs = require('fs');
const TemplateParser = require('../template-parser');

// Mock fs module
jest.mock('fs');

describe('TemplateParser - Property-Based Tests', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(validTemplate));
  });

  /**
   * Property 5: Template Pattern Application
   * 
   * For any receipt text and valid template, the Template Parser should apply
   * all regex patterns (item_line, total_line, receipt_number) and extract
   * the matched data into the corresponding fields.
   */
  describe('Property 5: Template Pattern Application', () => {
    it('should apply all patterns and extract matched data', () => {
      fc.assert(
        fc.property(
          fc.record({
            receiptNumber: fc.string({ minLength: 1, maxLength: 20 }).filter(s => !/\s/.test(s)),
            items: fc.array(
              fc.record({
                name: fc.string({ minLength: 1, maxLength: 30 }).filter(s => !s.includes('\n')),
                qty: fc.integer({ min: 1, max: 99 }),
                price: fc.float({ min: 0.01, max: 9999.99, noNaN: true })
              }),
              { minLength: 1, maxLength: 10 }
            )
          }),
          (data) => {
            // Generate receipt text that matches template patterns
            const total = data.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
            const itemLines = data.items.map(item => 
              `${item.name.padEnd(25)} ${String(item.qty).padStart(2)} ${item.price.toFixed(2).padStart(10)}`
            ).join('\n');

            const receiptText = `
Receipt #: ${data.receiptNumber}
================================
${itemLines}
================================
TOTAL ${total.toFixed(2).padStart(20)}
`.trim();

            const result = TemplateParser.parse(receiptText, mockTemplatePath);

            // All patterns should be applied
            expect(result.receiptNumber).toBeDefined();
            expect(result.items).toBeDefined();
            expect(result.total).toBeDefined();

            // Extracted data should match input
            expect(result.receiptNumber).toBe(data.receiptNumber);
            expect(result.items.length).toBe(data.items.length);
            expect(result.total).toBeCloseTo(total, 2);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000); // Tag: Feature: management-ui-and-missing-features, Property 5: Template Pattern Application
  });

  /**
   * Property 6: Confidence Score Calculation
   * 
   * For any parsing result, the Template Parser should calculate confidence
   * as the ratio of successful pattern matches to total patterns, producing
   * a value between 0.0 and 1.0.
   */
  describe('Property 6: Confidence Score Calculation', () => {
    it('should calculate confidence as ratio of matched to total patterns', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasReceiptNumber: fc.boolean(),
            hasItems: fc.boolean(),
            hasTotal: fc.boolean()
          }),
          (flags) => {
            // Build receipt text based on flags
            let receiptText = '';
            
            if (flags.hasReceiptNumber) {
              receiptText += 'Receipt #: RCP-123\n';
            }
            
            if (flags.hasItems) {
              receiptText += 'Test Item             1    100.00\n';
            }
            
            if (flags.hasTotal) {
              receiptText += 'TOTAL                    100.00\n';
            }

            const result = TemplateParser.parse(receiptText, mockTemplatePath);

            // Confidence should be between 0 and 1
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);

            // Calculate expected confidence
            const matchedPatterns = [
              flags.hasReceiptNumber,
              flags.hasItems,
              flags.hasTotal
            ].filter(Boolean).length;
            const totalPatterns = 3;
            const expectedConfidence = matchedPatterns / totalPatterns;

            expect(result.confidence).toBeCloseTo(expectedConfidence, 2);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000); // Tag: Feature: management-ui-and-missing-features, Property 6: Confidence Score Calculation
  });

  /**
   * Property 7: Receipt Total Validation
   * 
   * For any parsed receipt with items and total, the sum of (item.qty * item.price)
   * for all items should equal the total within 0.01 tolerance, otherwise the
   * receipt should be rejected.
   */
  describe('Property 7: Receipt Total Validation', () => {
    it('should validate total matches sum of items within tolerance', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('\n')),
              qty: fc.integer({ min: 1, max: 10 }),
              price: fc.float({ min: 0.01, max: 999.99, noNaN: true })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.float({ min: -10, max: 10, noNaN: true }), // Total offset
          (items, offset) => {
            const correctTotal = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
            const receiptTotal = correctTotal + offset;

            const itemLines = items.map(item =>
              `${item.name.padEnd(25)} ${String(item.qty).padStart(2)} ${item.price.toFixed(2).padStart(10)}`
            ).join('\n');

            const receiptText = `
Receipt #: RCP-001
${itemLines}
TOTAL ${receiptTotal.toFixed(2).padStart(20)}
`.trim();

            const result = TemplateParser.parse(receiptText, mockTemplatePath);

            // If offset is within tolerance, should be valid
            if (Math.abs(offset) <= 0.01) {
              expect(result.parsed).toBe(true);
            } else {
              // If offset exceeds tolerance, should be invalid
              expect(result.parsed).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 30000); // Tag: Feature: management-ui-and-missing-features, Property 7: Receipt Total Validation
  });

  /**
   * Property 8: Extracted Item Validation
   * 
   * For any parsed receipt, all extracted items should have a non-empty name
   * string, a positive integer quantity, and a positive number price.
   */
  describe('Property 8: Extracted Item Validation', () => {
    it('should validate all extracted items have valid fields', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.oneof(
                fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('\n')),
                fc.constant('') // Empty name
              ),
              qty: fc.oneof(
                fc.integer({ min: 1, max: 10 }), // Valid qty
                fc.integer({ min: -5, max: 0 })  // Invalid qty
              ),
              price: fc.oneof(
                fc.float({ min: 0.01, max: 999.99, noNaN: true }), // Valid price
                fc.float({ min: -100, max: 0, noNaN: true })       // Invalid price
              )
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (items) => {
            const total = items.reduce((sum, item) => {
              const itemTotal = Math.max(0, item.qty) * Math.max(0, item.price);
              return sum + itemTotal;
            }, 0);

            const itemLines = items.map(item =>
              `${(item.name || 'X').padEnd(25)} ${String(Math.abs(item.qty)).padStart(2)} ${Math.abs(item.price).toFixed(2).padStart(10)}`
            ).join('\n');

            const receiptText = `
Receipt #: RCP-001
${itemLines}
TOTAL ${total.toFixed(2).padStart(20)}
`.trim();

            const result = TemplateParser.parse(receiptText, mockTemplatePath);

            if (result.parsed && result.items.length > 0) {
              // All extracted items must have valid fields
              for (const item of result.items) {
                expect(item.name).toBeTruthy();
                expect(item.name.trim()).not.toBe('');
                expect(Number.isInteger(item.qty)).toBe(true);
                expect(item.qty).toBeGreaterThan(0);
                expect(typeof item.price).toBe('number');
                expect(item.price).toBeGreaterThan(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 30000); // Tag: Feature: management-ui-and-missing-features, Property 8: Extracted Item Validation
  });

  /**
   * Additional property: Parse time should always be < 5ms for typical receipts
   */
  describe('Performance Property: Parse Time < 5ms', () => {
    it('should complete parsing in < 5ms for receipts up to 50 items', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 5, maxLength: 30 }).filter(s => !s.includes('\n')),
              qty: fc.integer({ min: 1, max: 99 }),
              price: fc.float({ min: 0.01, max: 9999.99, noNaN: true })
            }),
            { minLength: 1, maxLength: 50 }
          ),
          (items) => {
            const total = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
            const itemLines = items.map(item =>
              `${item.name.padEnd(30)} ${String(item.qty).padStart(2)} ${item.price.toFixed(2).padStart(10)}`
            ).join('\n');

            const receiptText = `
Receipt #: RCP-PERF-TEST
================================
${itemLines}
================================
TOTAL ${total.toFixed(2).padStart(20)}
`.trim();

            const result = TemplateParser.parse(receiptText, mockTemplatePath);

            expect(result.parseTimeMs).toBeLessThan(5);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });
});
