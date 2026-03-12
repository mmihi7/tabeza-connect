/**
 * Unit tests for ESC/POS Textifier Module
 * 
 * Tests verify:
 * - Windows-1252 decoding
 * - Preservation of line breaks and tabs
 * - Non-printable character replacement
 * - Space collapsing
 * - Edge cases and error handling
 */

const { textify, textifyWithTiming, DEFAULT_OPTIONS } = require('../textifier');

describe('Textifier Module', () => {
  describe('textify()', () => {
    test('should decode simple ASCII text', () => {
      const input = Buffer.from('Hello World', 'ascii');
      const result = textify(input);
      expect(result).toBe('Hello World');
    });

    test('should preserve line breaks (\\r, \\n)', () => {
      const input = Buffer.from('Line 1\r\nLine 2\nLine 3\r', 'ascii');
      const result = textify(input);
      expect(result).toBe('Line 1\r\nLine 2\nLine 3\r');
    });

    test('should preserve tabs (\\t)', () => {
      const input = Buffer.from('Item\tQty\tPrice', 'ascii');
      const result = textify(input);
      expect(result).toBe('Item\tQty\tPrice');
    });

    test('should replace non-printable characters with spaces', () => {
      // ESC (0x1B), BEL (0x07), NULL (0x00)
      const input = Buffer.from([0x1B, 0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x07, 0x00]);
      const result = textify(input);
      expect(result).toBe(' Hello  ');
    });

    test('should collapse multiple consecutive spaces', () => {
      const input = Buffer.from('Hello    World', 'ascii');
      const result = textify(input);
      expect(result).toBe('Hello World');
    });

    test('should not collapse spaces when collapseSpaces is false', () => {
      const input = Buffer.from('Hello    World', 'ascii');
      const result = textify(input, { collapseSpaces: false });
      expect(result).toBe('Hello    World');
    });

    test('should handle Windows-1252 extended characters', () => {
      // Windows-1252 specific characters (e.g., € = 0x80, ™ = 0x99)
      const input = Buffer.from([0x80, 0x20, 0x99], 'binary');
      const result = textify(input);
      // Should decode as Windows-1252 characters
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle empty buffer', () => {
      const input = Buffer.from([]);
      const result = textify(input);
      expect(result).toBe('');
    });

    test('should throw TypeError for non-Buffer input', () => {
      expect(() => textify('not a buffer')).toThrow(TypeError);
      expect(() => textify(null)).toThrow(TypeError);
      expect(() => textify(undefined)).toThrow(TypeError);
      expect(() => textify(123)).toThrow(TypeError);
    });

    test('should handle custom encoding option', () => {
      const input = Buffer.from('Hello', 'utf8');
      const result = textify(input, { encoding: 'utf8' });
      expect(result).toBe('Hello');
    });

    test('should handle custom preserveChars option', () => {
      // Only preserve \n, not \r or \t
      const input = Buffer.from('Line1\r\nLine2\tTab', 'ascii');
      const result = textify(input, { preserveChars: ['\n'] });
      expect(result).toBe('Line1 \nLine2 Tab');
    });

    test('should handle typical receipt format', () => {
      const receiptText = 'RECEIPT #123\r\n' +
                         'Item 1       2    500.00\r\n' +
                         'Item 2       1    300.00\r\n' +
                         'TOTAL           800.00\r\n';
      const input = Buffer.from(receiptText, 'ascii');
      const result = textify(input);
      expect(result).toContain('RECEIPT #123');
      expect(result).toContain('TOTAL');
      expect(result).toContain('800.00');
    });

    test('should handle ESC/POS control sequences', () => {
      // ESC @ (initialize printer), ESC E (bold on), ESC F (bold off)
      const input = Buffer.from([
        0x1B, 0x40,           // ESC @
        0x48, 0x65, 0x6C, 0x6C, 0x6F,  // "Hello"
        0x1B, 0x45, 0x01,     // ESC E (bold on)
        0x20, 0x57, 0x6F, 0x72, 0x6C, 0x64,  // " World"
        0x1B, 0x45, 0x00      // ESC E (bold off)
      ]);
      const result = textify(input);
      // Control codes should be replaced with spaces, text preserved
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });

    test('should handle large buffer efficiently', () => {
      // Create a 10KB buffer (typical receipt size)
      const largeText = 'Item Name       Qty    Price\r\n'.repeat(200);
      const input = Buffer.from(largeText, 'ascii');
      
      const startTime = process.hrtime.bigint();
      const result = textify(input);
      const endTime = process.hrtime.bigint();
      
      const timeMs = Number(endTime - startTime) / 1_000_000;
      
      expect(result.length).toBeGreaterThan(0);
      expect(timeMs).toBeLessThan(10); // Should complete in < 10ms
    });

    test('should handle mixed printable and non-printable characters', () => {
      const input = Buffer.from([
        0x48, 0x65, 0x6C, 0x6C, 0x6F,  // "Hello"
        0x00, 0x01, 0x02,              // Non-printable
        0x20,                          // Space
        0x57, 0x6F, 0x72, 0x6C, 0x64   // "World"
      ]);
      const result = textify(input);
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });
  });

  describe('textifyWithTiming()', () => {
    test('should return text and timing information', () => {
      const input = Buffer.from('Hello World', 'ascii');
      const { text, timeMs } = textifyWithTiming(input);
      
      expect(text).toBe('Hello World');
      expect(typeof timeMs).toBe('number');
      expect(timeMs).toBeGreaterThanOrEqual(0);
    });

    test('should complete within performance target', () => {
      // Create a typical receipt (2KB)
      const receiptText = 'Item Name       Qty    Price\r\n'.repeat(50);
      const input = Buffer.from(receiptText, 'ascii');
      
      const { text, timeMs } = textifyWithTiming(input);
      
      expect(text.length).toBeGreaterThan(0);
      expect(timeMs).toBeLessThan(10); // Performance target: < 10ms
    });

    test('should handle empty buffer with timing', () => {
      const input = Buffer.from([]);
      const { text, timeMs } = textifyWithTiming(input);
      
      expect(text).toBe('');
      expect(timeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('DEFAULT_OPTIONS', () => {
    test('should have correct default values', () => {
      expect(DEFAULT_OPTIONS.encoding).toBe('windows-1252');
      expect(DEFAULT_OPTIONS.preserveChars).toEqual(['\r', '\n', '\t']);
      expect(DEFAULT_OPTIONS.collapseSpaces).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle buffer with only non-printable characters', () => {
      const input = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
      const result = textify(input);
      expect(result).toBe(' '); // All replaced with spaces, then collapsed
    });

    test('should handle buffer with only spaces', () => {
      const input = Buffer.from('     ', 'ascii');
      const result = textify(input);
      expect(result).toBe(' '); // Collapsed to single space
    });

    test('should handle buffer with only line breaks', () => {
      const input = Buffer.from('\r\n\r\n\r\n', 'ascii');
      const result = textify(input);
      expect(result).toBe('\r\n\r\n\r\n'); // Preserved
    });

    test('should handle very small buffer (1 byte)', () => {
      const input = Buffer.from([0x41]); // 'A'
      const result = textify(input);
      expect(result).toBe('A');
    });

    test('should handle buffer with null bytes', () => {
      const input = Buffer.from([0x48, 0x00, 0x69]); // 'H', NULL, 'i'
      const result = textify(input);
      expect(result).toBe('H i');
    });

    test('should preserve spaces between words', () => {
      const input = Buffer.from('Word1 Word2  Word3   Word4', 'ascii');
      const result = textify(input);
      expect(result).toBe('Word1 Word2 Word3 Word4');
    });

    test('should handle mixed line endings', () => {
      const input = Buffer.from('Line1\rLine2\nLine3\r\nLine4', 'ascii');
      const result = textify(input);
      expect(result).toBe('Line1\rLine2\nLine3\r\nLine4');
    });
  });

  describe('Real-World Receipt Examples', () => {
    test('should handle typical POS receipt format', () => {
      const receipt = Buffer.from(
        '================================\r\n' +
        '        BAR NAME HERE           \r\n' +
        '================================\r\n' +
        'Receipt #: RCP-001234           \r\n' +
        'Date: 02/03/2026                \r\n' +
        'Time: 10:00                     \r\n' +
        '--------------------------------\r\n' +
        'Tusker Lager 500ml  2    500.00\r\n' +
        'Nyama Choma         1    800.00\r\n' +
        '--------------------------------\r\n' +
        'TOTAL                   1300.00\r\n' +
        '================================\r\n',
        'ascii'
      );
      
      const result = textify(receipt);
      
      expect(result).toContain('BAR NAME HERE');
      expect(result).toContain('RCP-001234');
      expect(result).toContain('Tusker Lager 500ml');
      expect(result).toContain('TOTAL');
      expect(result).toContain('1300.00');
    });

    test('should handle receipt with ESC/POS formatting codes', () => {
      // Simulated receipt with ESC/POS codes for bold, underline, etc.
      const receipt = Buffer.from([
        0x1B, 0x40,                    // ESC @ (initialize)
        0x1B, 0x61, 0x01,              // ESC a 1 (center align)
        ...Buffer.from('BAR NAME\r\n'),
        0x1B, 0x61, 0x00,              // ESC a 0 (left align)
        ...Buffer.from('Item 1       500.00\r\n'),
        ...Buffer.from('TOTAL        500.00\r\n')
      ]);
      
      const result = textify(receipt);
      
      expect(result).toContain('BAR NAME');
      expect(result).toContain('Item 1');
      expect(result).toContain('TOTAL');
    });
  });
});
