/**
 * Property-Based Tests for ESC/POS Textifier Module
 * 
 * Feature: redmon-receipt-capture
 * Property 4: ESC/POS Textification Correctness
 * 
 * These tests verify universal properties that should hold for all inputs
 * using randomized testing with fast-check library.
 * 
 * Run with: npm test -- textifier.property.test.js
 * 
 * Requirements:
 * - npm install --save-dev fast-check
 * - Minimum 100 iterations per property test
 */

const fc = require('fast-check');
const { textify, DEFAULT_OPTIONS } = require('../textifier');

describe('Textifier Property-Based Tests', () => {
  describe('Property 4.1: Idempotency', () => {
    /**
     * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
     * 
     * For plain text input (no ESC/POS codes), applying textify twice
     * should produce the same result as applying it once.
     * 
     * textify(textify(x)) === textify(x) for plain text x
     */
    test('Feature: redmon-receipt-capture, Property 4.1: Idempotency', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 1000 }),
          (plainText) => {
            // Convert string to buffer
            const buffer = Buffer.from(plainText, 'utf8');
            
            // Apply textify once
            const firstPass = textify(buffer);
            
            // Apply textify to the result
            const secondPass = textify(Buffer.from(firstPass, 'utf8'));
            
            // Should be idempotent for plain text
            expect(secondPass).toBe(firstPass);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4.2: Length Preservation', () => {
    /**
     * **Validates: Requirements 3.2, 3.3**
     * 
     * The output length should be less than or equal to the input length
     * (after decoding), since we only replace or collapse characters.
     * 
     * length(textify(x)) <= length(decode(x))
     */
    test('Feature: redmon-receipt-capture, Property 4.2: Length Preservation', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 10240 }),
          (bytes) => {
            const buffer = Buffer.from(bytes);
            const result = textify(buffer);
            
            // Decode input to get character count
            const decoded = buffer.toString('windows-1252');
            
            // Output should not be longer than input (may be shorter due to space collapsing)
            expect(result.length).toBeLessThanOrEqual(decoded.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4.3: Character Preservation', () => {
    /**
     * **Validates: Requirements 3.4**
     * 
     * Preserved characters (\r, \n, \t) should remain in the output
     * at the same positions (relative to other preserved characters).
     */
    test('Feature: redmon-receipt-capture, Property 4.3: Character Preservation', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              fc.constant('\r'),
              fc.constant('\n'),
              fc.constant('\t'),
              fc.char().filter(c => c >= ' ' && c <= '~') // Printable ASCII
            ),
            { minLength: 1, maxLength: 500 }
          ),
          (chars) => {
            const input = chars.join('');
            const buffer = Buffer.from(input, 'ascii');
            const result = textify(buffer);
            
            // Count preserved characters in input
            const inputLineBreaks = (input.match(/\r/g) || []).length;
            const inputNewlines = (input.match(/\n/g) || []).length;
            const inputTabs = (input.match(/\t/g) || []).length;
            
            // Count preserved characters in output
            const outputLineBreaks = (result.match(/\r/g) || []).length;
            const outputNewlines = (result.match(/\n/g) || []).length;
            const outputTabs = (result.match(/\t/g) || []).length;
            
            // All preserved characters should remain
            expect(outputLineBreaks).toBe(inputLineBreaks);
            expect(outputNewlines).toBe(inputNewlines);
            expect(outputTabs).toBe(inputTabs);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4.4: No Control Codes in Output', () => {
    /**
     * **Validates: Requirements 3.2**
     * 
     * The output should not contain ESC/POS control codes or other
     * non-printable characters (except \r, \n, \t).
     */
    test('Feature: redmon-receipt-capture, Property 4.4: No Control Codes', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 10240 }),
          (bytes) => {
            const buffer = Buffer.from(bytes);
            const result = textify(buffer);
            
            // Check each character in the result
            for (let i = 0; i < result.length; i++) {
              const char = result[i];
              const code = char.charCodeAt(0);
              
              // Should be printable ASCII, extended ASCII, or preserved chars
              const isPrintable = (code >= 32 && code <= 126) || (code >= 160 && code <= 255);
              const isPreserved = char === '\r' || char === '\n' || char === '\t';
              
              expect(isPrintable || isPreserved).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4.5: Space Collapsing', () => {
    /**
     * **Validates: Requirements 3.3**
     * 
     * When collapseSpaces is enabled (default), the output should not
     * contain multiple consecutive spaces.
     */
    test('Feature: redmon-receipt-capture, Property 4.5: Space Collapsing', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 10240 }),
          (bytes) => {
            const buffer = Buffer.from(bytes);
            const result = textify(buffer); // collapseSpaces is true by default
            
            // Should not contain multiple consecutive spaces
            expect(result).not.toMatch(/  +/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4.6: Performance', () => {
    /**
     * **Validates: Requirement 3.6**
     * 
     * Textification should complete within 10ms for buffers up to 10KB.
     */
    test('Feature: redmon-receipt-capture, Property 4.6: Performance', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 10240 }), // Up to 10KB
          (bytes) => {
            const buffer = Buffer.from(bytes);
            
            const startTime = process.hrtime.bigint();
            textify(buffer);
            const endTime = process.hrtime.bigint();
            
            const timeMs = Number(endTime - startTime) / 1_000_000;
            
            // Should complete in < 10ms
            expect(timeMs).toBeLessThan(10);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4.7: Empty Input Handling', () => {
    /**
     * **Validates: Requirements 3.1, 3.2**
     * 
     * Empty input should always produce empty output.
     */
    test('Feature: redmon-receipt-capture, Property 4.7: Empty Input', () => {
      const emptyBuffer = Buffer.from([]);
      const result = textify(emptyBuffer);
      expect(result).toBe('');
    });
  });

  describe('Property 4.8: Encoding Consistency', () => {
    /**
     * **Validates: Requirement 3.1**
     * 
     * For valid Windows-1252 text, decoding and textifying should
     * preserve the text content (modulo space collapsing).
     */
    test('Feature: redmon-receipt-capture, Property 4.8: Encoding Consistency', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 })
            .filter(s => s.split('').every(c => {
              const code = c.charCodeAt(0);
              return (code >= 32 && code <= 126) || (code >= 160 && code <= 255);
            })),
          (text) => {
            // Create buffer with Windows-1252 encoding
            const buffer = Buffer.from(text, 'windows-1252');
            const result = textify(buffer);
            
            // Result should contain the same characters (possibly with collapsed spaces)
            const normalizedInput = text.replace(/  +/g, ' ');
            expect(result).toBe(normalizedInput);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4.9: Non-Printable Replacement', () => {
    /**
     * **Validates: Requirement 3.2**
     * 
     * All non-printable characters (except \r, \n, \t) should be
     * replaced with spaces.
     */
    test('Feature: redmon-receipt-capture, Property 4.9: Non-Printable Replacement', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.integer({ min: 0, max: 31 }).filter(n => n !== 9 && n !== 10 && n !== 13),
            { minLength: 1, maxLength: 100 }
          ),
          (controlCodes) => {
            const buffer = Buffer.from(controlCodes);
            const result = textify(buffer);
            
            // All control codes should be replaced with spaces (then collapsed)
            // Result should be a single space or empty (if all collapsed)
            expect(result).toMatch(/^ *$/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4.10: Deterministic Output', () => {
    /**
     * **Validates: Requirements 3.1, 3.2, 3.3**
     * 
     * Given the same input and options, textify should always produce
     * the same output (deterministic behavior).
     */
    test('Feature: redmon-receipt-capture, Property 4.10: Deterministic Output', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 10240 }),
          (bytes) => {
            const buffer = Buffer.from(bytes);
            
            // Run textify multiple times
            const result1 = textify(buffer);
            const result2 = textify(buffer);
            const result3 = textify(buffer);
            
            // All results should be identical
            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4.11: Options Respect', () => {
    /**
     * **Validates: Requirements 3.3**
     * 
     * When collapseSpaces is disabled, multiple spaces should be preserved.
     */
    test('Feature: redmon-receipt-capture, Property 4.11: Options Respect', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 })
            .map(s => s + '    ' + s), // Add multiple spaces in the middle
          (text) => {
            const buffer = Buffer.from(text, 'ascii');
            
            // With collapseSpaces: true (default)
            const collapsed = textify(buffer);
            
            // With collapseSpaces: false
            const notCollapsed = textify(buffer, { collapseSpaces: false });
            
            // Not collapsed version should have more or equal length
            expect(notCollapsed.length).toBeGreaterThanOrEqual(collapsed.length);
            
            // Collapsed version should not have multiple spaces
            expect(collapsed).not.toMatch(/  +/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4.12: Buffer Type Validation', () => {
    /**
     * **Validates: Input validation**
     * 
     * textify should throw TypeError for non-Buffer inputs.
     */
    test('Feature: redmon-receipt-capture, Property 4.12: Buffer Type Validation', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.constant(null),
            fc.constant(undefined),
            fc.object()
          ),
          (invalidInput) => {
            expect(() => textify(invalidInput)).toThrow(TypeError);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
