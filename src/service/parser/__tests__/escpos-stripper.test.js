/**
 * Unit tests for ESC/POS Stripper
 */

const ESCPOSStripper = require('../escpos-stripper');

describe('ESCPOSStripper', () => {
  describe('isPrintable()', () => {
    it('should return true for printable ASCII characters (0x20-0x7E)', () => {
      expect(ESCPOSStripper.isPrintable(0x20)).toBe(true); // space
      expect(ESCPOSStripper.isPrintable(0x41)).toBe(true); // 'A'
      expect(ESCPOSStripper.isPrintable(0x7E)).toBe(true); // '~'
    });

    it('should return false for non-printable characters', () => {
      expect(ESCPOSStripper.isPrintable(0x00)).toBe(false); // null
      expect(ESCPOSStripper.isPrintable(0x1F)).toBe(false); // below range
      expect(ESCPOSStripper.isPrintable(0x7F)).toBe(false); // DEL
      expect(ESCPOSStripper.isPrintable(0x1B)).toBe(false); // ESC
      expect(ESCPOSStripper.isPrintable(0x1D)).toBe(false); // GS
    });
  });

  describe('isNewline()', () => {
    it('should return true for LF (0x0A)', () => {
      expect(ESCPOSStripper.isNewline(0x0A)).toBe(true);
    });

    it('should return true for CR (0x0D)', () => {
      expect(ESCPOSStripper.isNewline(0x0D)).toBe(true);
    });

    it('should return false for other characters', () => {
      expect(ESCPOSStripper.isNewline(0x00)).toBe(false);
      expect(ESCPOSStripper.isNewline(0x20)).toBe(false);
      expect(ESCPOSStripper.isNewline(0x41)).toBe(false);
    });
  });

  describe('strip() - printable ASCII preservation', () => {
    it('should preserve all printable ASCII characters', () => {
      const input = Buffer.from('Hello World 123!@#');
      const result = ESCPOSStripper.strip(input);
      expect(result).toBe('Hello World 123!@#');
    });

    it('should preserve spaces', () => {
      const input = Buffer.from('   spaces   ');
      const result = ESCPOSStripper.strip(input);
      expect(result).toBe('   spaces   ');
    });

    it('should preserve special characters', () => {
      const input = Buffer.from('$100.00 + 20% = $120.00');
      const result = ESCPOSStripper.strip(input);
      expect(result).toBe('$100.00 + 20% = $120.00');
    });
  });

  describe('strip() - newline preservation', () => {
    it('should preserve LF characters', () => {
      const input = Buffer.from('Line 1\nLine 2\nLine 3');
      const result = ESCPOSStripper.strip(input);
      expect(result).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should preserve CR characters', () => {
      const input = Buffer.from('Line 1\rLine 2\rLine 3');
      const result = ESCPOSStripper.strip(input);
      expect(result).toBe('Line 1\rLine 2\rLine 3');
    });

    it('should preserve CRLF sequences', () => {
      const input = Buffer.from('Line 1\r\nLine 2\r\nLine 3');
      const result = ESCPOSStripper.strip(input);
      expect(result).toBe('Line 1\r\nLine 2\r\nLine 3');
    });
  });

  describe('strip() - ESC/GS sequence removal', () => {
    it('should remove ESC @ (initialize printer)', () => {
      const input = Buffer.from([0x1B, 0x40, 0x48, 0x69]); // ESC @ H i
      const result = ESCPOSStripper.strip(input);
      expect(result).toBe('Hi');
    });

    it('should remove ESC E (bold on/off)', () => {
      const input = Buffer.from([0x1B, 0x45, 0x01, 0x42, 0x6F, 0x6C, 0x64]); // ESC E 1 Bold
      const result = ESCPOSStripper.strip(input);
      expect(result).toBe('Bold');
    });

    it('should remove ESC a (alignment)', () => {
      const input = Buffer.from([0x1B, 0x61, 0x01, 0x54, 0x65, 0x78, 0x74]); // ESC a 1 Text
      const result = ESCPOSStripper.strip(input);
      expect(result).toBe('Text');
    });

    it('should remove ESC d (feed lines)', () => {
      const input = Buffer.from([0x1B, 0x64, 0x03, 0x54, 0x65, 0x78, 0x74]); // ESC d 3 Text
      const result = ESCPOSStripper.strip(input);
      expect(result).toBe('Text');
    });

    it('should remove GS ! (character size)', () => {
      const input = Buffer.from([0x1D, 0x21, 0x11, 0x42, 0x49, 0x47]); // GS ! 17 BIG
      const result = ESCPOSStripper.strip(input);
      expect(result).toBe('BIG');
    });

    it('should remove GS V (cut paper)', () => {
      const input = Buffer.from([0x1D, 0x56, 0x00, 0x45, 0x6E, 0x64]); // GS V 0 End
      const result = ESCPOSStripper.strip(input);
      expect(result).toBe('End');
    });

    it('should handle multiple ESC/GS sequences in one buffer', () => {
      const input = Buffer.from([
        0x1B, 0x40,           // ESC @ (init)
        0x1B, 0x45, 0x01,     // ESC E 1 (bold on)
        0x48, 0x65, 0x6C, 0x6C, 0x6F, // Hello
        0x1B, 0x45, 0x00,     // ESC E 0 (bold off)
        0x20,                 // space
        0x1D, 0x21, 0x11,     // GS ! 17 (double size)
        0x57, 0x6F, 0x72, 0x6C, 0x64  // World
      ]);
      const result = ESCPOSStripper.strip(input);
      expect(result).toBe('Hello World');
    });
  });

  describe('strip() - empty input handling', () => {
    it('should return empty string for empty buffer', () => {
      const input = Buffer.from([]);
      const result = ESCPOSStripper.strip(input);
      expect(result).toBe('');
    });

    it('should return empty string for buffer with only control codes', () => {
      const input = Buffer.from([0x1B, 0x40, 0x1D, 0x21, 0x11, 0x00, 0x01, 0x02]);
      const result = ESCPOSStripper.strip(input);
      expect(result).toBe('');
    });

    it('should throw TypeError for non-Buffer input', () => {
      expect(() => ESCPOSStripper.strip('not a buffer')).toThrow(TypeError);
      expect(() => ESCPOSStripper.strip(null)).toThrow(TypeError);
      expect(() => ESCPOSStripper.strip(undefined)).toThrow(TypeError);
    });
  });

  describe('strip() - realistic receipt data', () => {
    it('should strip a realistic receipt with mixed content', () => {
      const input = Buffer.from([
        0x1B, 0x40,                    // ESC @ (init)
        0x1B, 0x61, 0x01,              // ESC a 1 (center align)
        0x42, 0x41, 0x52, 0x20, 0x4E, 0x41, 0x4D, 0x45, 0x0A, // BAR NAME\n
        0x1B, 0x61, 0x00,              // ESC a 0 (left align)
        0x2D, 0x2D, 0x2D, 0x2D, 0x2D, 0x0A, // -----\n
        0x54, 0x75, 0x73, 0x6B, 0x65, 0x72, 0x20, 0x20, 0x32, 0x20, 0x20, 0x35, 0x30, 0x30, 0x0A, // Tusker  2  500\n
        0x1D, 0x21, 0x11,              // GS ! 17 (double size)
        0x54, 0x4F, 0x54, 0x41, 0x4C, 0x20, 0x31, 0x30, 0x30, 0x30, 0x0A, // TOTAL 1000\n
        0x1D, 0x56, 0x00               // GS V 0 (cut)
      ]);
      
      const result = ESCPOSStripper.strip(input);
      expect(result).toContain('BAR NAME');
      expect(result).toContain('-----');
      expect(result).toContain('Tusker  2  500');
      expect(result).toContain('TOTAL 1000');
      expect(result).not.toContain('\x1B');
      expect(result).not.toContain('\x1D');
    });
  });

  describe('strip() - performance', () => {
    it('should process typical receipt (< 10KB) in under 5ms', () => {
      // Create a realistic 8KB receipt with mixed content
      const lines = [];
      for (let i = 0; i < 200; i++) {
        lines.push(Buffer.from([
          0x1B, 0x45, 0x01,  // ESC E 1
          ...Buffer.from(`Item ${i}  1  ${100 + i}\n`),
          0x1B, 0x45, 0x00   // ESC E 0
        ]));
      }
      const input = Buffer.concat(lines);
      
      const start = process.hrtime.bigint();
      const result = ESCPOSStripper.strip(input);
      const end = process.hrtime.bigint();
      
      const durationMs = Number(end - start) / 1_000_000;
      
      expect(result).toContain('Item 0');
      expect(result).toContain('Item 199');
      expect(durationMs).toBeLessThan(5);
    });
  });
});
