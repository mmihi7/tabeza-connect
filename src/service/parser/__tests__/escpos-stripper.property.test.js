/**
 * Property-based tests for ESC/POS Stripper
 * 
 * Tests correctness properties using fast-check
 */

const fc = require('fast-check');
const ESCPOSStripper = require('../escpos-stripper');

describe('ESCPOSStripper - Property-Based Tests', () => {
  describe('Property 3: ESC/POS Character Preservation', () => {
    /**
     * For any raw print data containing printable ASCII characters (0x20-0x7E)
     * and newline characters (0x0A, 0x0D), the ESC/POS Stripper should preserve
     * all these characters in the output plain text.
     */
    it('should preserve all printable ASCII and newline characters', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              fc.integer({ min: 0x20, max: 0x7E }), // printable ASCII
              fc.constantFrom(0x0A, 0x0D)            // newlines
            ),
            { minLength: 0, maxLength: 1000 }
          ),
          (bytes) => {
            const input = Buffer.from(bytes);
            const result = ESCPOSStripper.strip(input);
            const resultBuffer = Buffer.from(result, 'utf8');

            // All input bytes should appear in output
            for (const byte of bytes) {
              expect(resultBuffer.includes(byte)).toBe(true);
            }

            // Output should contain exactly the input bytes (in order)
            expect(resultBuffer.length).toBe(bytes.length);
            for (let i = 0; i < bytes.length; i++) {
              expect(resultBuffer[i]).toBe(bytes[i]);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve printable ASCII in presence of control codes', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0x20, max: 0x7E }), { minLength: 1, maxLength: 100 }),
          fc.array(fc.integer({ min: 0x00, max: 0x1F }), { minLength: 0, maxLength: 50 }),
          (printableBytes, controlBytes) => {
            // Interleave printable and control bytes
            const mixed = [];
            let pi = 0, ci = 0;
            while (pi < printableBytes.length || ci < controlBytes.length) {
              if (pi < printableBytes.length) {
                mixed.push(printableBytes[pi++]);
              }
              if (ci < controlBytes.length) {
                mixed.push(controlBytes[ci++]);
              }
            }

            const input = Buffer.from(mixed);
            const result = ESCPOSStripper.strip(input);
            const resultBuffer = Buffer.from(result, 'utf8');

            // All printable bytes should be preserved
            for (const byte of printableBytes) {
              expect(resultBuffer.includes(byte)).toBe(true);
            }

            // Result should contain only printable bytes
            expect(resultBuffer.length).toBe(printableBytes.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: ESC/POS Control Code Removal', () => {
    /**
     * For any raw print data containing ESC sequences (0x1B + command bytes)
     * or GS sequences (0x1D + command bytes), the ESC/POS Stripper should
     * remove all these control sequences from the output.
     */
    it('should remove all ESC sequences', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              text: fc.string({ minLength: 0, maxLength: 20 }),
              escCommand: fc.constantFrom(0x40, 0x45, 0x61, 0x64), // @, E, a, d
              escParam: fc.integer({ min: 0x00, max: 0xFF })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (segments) => {
            // Build buffer with text and ESC sequences
            const parts = [];
            for (const seg of segments) {
              // Add ESC sequence
              if (seg.escCommand === 0x40) {
                parts.push(Buffer.from([0x1B, seg.escCommand])); // 2 bytes
              } else {
                parts.push(Buffer.from([0x1B, seg.escCommand, seg.escParam])); // 3 bytes
              }
              // Add text
              parts.push(Buffer.from(seg.text));
            }
            const input = Buffer.concat(parts);
            const result = ESCPOSStripper.strip(input);

            // Result should not contain ESC byte
            expect(result).not.toContain('\x1B');
            
            // Result should contain all text
            const expectedText = segments.map(s => s.text).join('');
            expect(result).toBe(expectedText);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove all GS sequences', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              text: fc.string({ minLength: 0, maxLength: 20 }),
              gsCommand: fc.constantFrom(0x21, 0x56), // !, V
              gsParam: fc.integer({ min: 0x00, max: 0xFF })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (segments) => {
            // Build buffer with text and GS sequences
            const parts = [];
            for (const seg of segments) {
              // Add GS sequence (3 bytes)
              parts.push(Buffer.from([0x1D, seg.gsCommand, seg.gsParam]));
              // Add text
              parts.push(Buffer.from(seg.text));
            }
            const input = Buffer.concat(parts);
            const result = ESCPOSStripper.strip(input);

            // Result should not contain GS byte
            expect(result).not.toContain('\x1D');
            
            // Result should contain all text
            const expectedText = segments.map(s => s.text).join('');
            expect(result).toBe(expectedText);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove mixed ESC and GS sequences', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              text: fc.string({ minLength: 0, maxLength: 20 }),
              controlType: fc.constantFrom('esc', 'gs', 'none'),
              command: fc.integer({ min: 0x00, max: 0xFF }),
              param: fc.integer({ min: 0x00, max: 0xFF })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (segments) => {
            const parts = [];
            const expectedTexts = [];

            for (const seg of segments) {
              // Add control sequence
              if (seg.controlType === 'esc') {
                parts.push(Buffer.from([0x1B, seg.command, seg.param]));
              } else if (seg.controlType === 'gs') {
                parts.push(Buffer.from([0x1D, seg.command, seg.param]));
              }
              
              // Add text
              parts.push(Buffer.from(seg.text));
              expectedTexts.push(seg.text);
            }

            const input = Buffer.concat(parts);
            const result = ESCPOSStripper.strip(input);

            // Result should not contain control bytes
            expect(result).not.toContain('\x1B');
            expect(result).not.toContain('\x1D');
            
            // Result should contain all text
            const expectedText = expectedTexts.join('');
            expect(result).toBe(expectedText);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle buffers with only control codes', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              fc.tuple(fc.constant(0x1B), fc.integer({ min: 0x00, max: 0xFF })),
              fc.tuple(fc.constant(0x1D), fc.integer({ min: 0x00, max: 0xFF }))
            ),
            { minLength: 1, maxLength: 50 }
          ),
          (controlPairs) => {
            const bytes = controlPairs.flatMap(([ctrl, cmd]) => [ctrl, cmd]);
            const input = Buffer.from(bytes);
            const result = ESCPOSStripper.strip(input);

            // Result should be empty (all control codes removed)
            expect(result).toBe('');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Idempotence', () => {
    /**
     * Stripping an already-stripped buffer should produce the same result
     */
    it('should be idempotent for already-stripped text', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 200 }),
          (text) => {
            const input = Buffer.from(text);
            const result1 = ESCPOSStripper.strip(input);
            const result2 = ESCPOSStripper.strip(Buffer.from(result1));

            expect(result2).toBe(result1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Output is valid UTF-8', () => {
    /**
     * The output should always be valid UTF-8 text
     */
    it('should produce valid UTF-8 output', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 0, maxLength: 500 }),
          (bytes) => {
            const input = Buffer.from(bytes);
            const result = ESCPOSStripper.strip(input);

            // Should not throw when converting to Buffer
            expect(() => Buffer.from(result, 'utf8')).not.toThrow();
            
            // Round-trip should work
            const roundTrip = Buffer.from(result, 'utf8').toString('utf8');
            expect(roundTrip).toBe(result);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
