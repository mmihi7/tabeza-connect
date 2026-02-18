/**
 * Unit tests for ESC/POS Byte Extraction and Conversion
 * 
 * Tests Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

const ESCPOSProcessor = require('../escposProcessor');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

describe('ESCPOSProcessor', () => {
  let processor;
  let testDir;
  
  beforeEach(async () => {
    processor = new ESCPOSProcessor();
    
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `tabeza-test-escpos-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });
  
  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('ESC/POS Detection', () => {
    it('should detect ESC/POS commands in buffer', () => {
      // ESC @ (Initialize printer)
      const buffer = Buffer.from([0x1B, 0x40, 0x48, 0x65, 0x6C, 0x6C, 0x6F]); // ESC @ Hello
      
      const isESCPOS = processor.detectESCPOS(buffer);
      
      expect(isESCPOS).toBe(true);
    });
    
    it('should detect GS commands in buffer', () => {
      // GS V (Cut paper)
      const buffer = Buffer.from([0x1D, 0x56, 0x00]); // GS V 0
      
      const isESCPOS = processor.detectESCPOS(buffer);
      
      expect(isESCPOS).toBe(true);
    });
    
    it('should return false for plain text without ESC/POS', () => {
      const buffer = Buffer.from('Hello World\nThis is plain text');
      
      const isESCPOS = processor.detectESCPOS(buffer);
      
      expect(isESCPOS).toBe(false);
    });
    
    it('should detect ESC/POS in mixed content', () => {
      // Text with ESC commands in the middle
      const buffer = Buffer.concat([
        Buffer.from('Receipt\n'),
        Buffer.from([0x1B, 0x21, 0x08]), // ESC ! (Select print mode)
        Buffer.from('TOTAL: $10.00'),
      ]);
      
      const isESCPOS = processor.detectESCPOS(buffer);
      
      expect(isESCPOS).toBe(true);
    });
  });
  
  describe('Text Conversion', () => {
    it('should convert plain text correctly', () => {
      const buffer = Buffer.from('Hello World\nLine 2\nLine 3');
      
      const text = processor.convertToText(buffer);
      
      expect(text).toBe('Hello World\nLine 2\nLine 3');
    });
    
    it('should preserve line breaks (LF)', () => {
      const buffer = Buffer.from([
        0x48, 0x65, 0x6C, 0x6C, 0x6F, // Hello
        0x0A, // LF
        0x57, 0x6F, 0x72, 0x6C, 0x64, // World
      ]);
      
      const text = processor.convertToText(buffer);
      
      expect(text).toBe('Hello\nWorld');
    });
    
    it('should remove carriage returns (CR)', () => {
      const buffer = Buffer.from([
        0x48, 0x65, 0x6C, 0x6C, 0x6F, // Hello
        0x0D, 0x0A, // CR LF
        0x57, 0x6F, 0x72, 0x6C, 0x64, // World
      ]);
      
      const text = processor.convertToText(buffer);
      
      expect(text).toBe('Hello\nWorld');
    });
    
    it('should convert tabs to spaces', () => {
      const buffer = Buffer.from([
        0x49, 0x74, 0x65, 0x6D, // Item
        0x09, // HT (tab)
        0x24, 0x31, 0x30, // $10
      ]);
      
      const text = processor.convertToText(buffer);
      
      expect(text).toBe('Item    $10');
    });
    
    it('should remove ESC/POS control sequences', () => {
      const buffer = Buffer.concat([
        Buffer.from([0x1B, 0x40]), // ESC @ (Initialize)
        Buffer.from('Receipt\n'),
        Buffer.from([0x1B, 0x21, 0x08]), // ESC ! (Bold)
        Buffer.from('TOTAL'),
        Buffer.from([0x1B, 0x21, 0x00]), // ESC ! (Normal)
        Buffer.from(': $10.00'),
      ]);
      
      const text = processor.convertToText(buffer);
      
      expect(text).toBe('Receipt\nTOTAL: $10.00');
    });
    
    it('should remove GS control sequences', () => {
      const buffer = Buffer.concat([
        Buffer.from('Receipt\n'),
        Buffer.from('TOTAL: $10.00\n'),
        Buffer.from([0x1D, 0x56, 0x00]), // GS V (Cut paper)
      ]);
      
      const text = processor.convertToText(buffer);
      
      expect(text).toBe('Receipt\nTOTAL: $10.00');
    });
    
    it('should preserve spacing from ESC/POS formatting', () => {
      const buffer = Buffer.from('Item 1          $5.00\nItem 2         $10.00\nTOTAL          $15.00');
      
      const text = processor.convertToText(buffer);
      
      expect(text).toBe('Item 1          $5.00\nItem 2         $10.00\nTOTAL          $15.00');
    });
    
    it('should handle form feed as line break', () => {
      const buffer = Buffer.from([
        0x48, 0x65, 0x6C, 0x6C, 0x6F, // Hello
        0x0C, // FF (form feed)
        0x57, 0x6F, 0x72, 0x6C, 0x64, // World
      ]);
      
      const text = processor.convertToText(buffer);
      
      expect(text).toBe('Hello\nWorld');
    });
    
    it('should remove non-printable control characters', () => {
      const buffer = Buffer.from([
        0x48, 0x65, 0x6C, 0x6C, 0x6F, // Hello
        0x00, 0x01, 0x02, // Control characters
        0x20, // Space
        0x57, 0x6F, 0x72, 0x6C, 0x64, // World
      ]);
      
      const text = processor.convertToText(buffer);
      
      expect(text).toBe('Hello World');
    });
    
    it('should trim trailing whitespace from lines', () => {
      const buffer = Buffer.from('Line 1     \nLine 2   \nLine 3');
      
      const text = processor.convertToText(buffer);
      
      expect(text).toBe('Line 1\nLine 2\nLine 3');
    });
  });
  
  describe('File Processing', () => {
    it('should process ESC/POS file and return all data', async () => {
      const testFile = path.join(testDir, 'test.SPL');
      
      // Create test file with ESC/POS content
      const content = Buffer.concat([
        Buffer.from([0x1B, 0x40]), // ESC @ (Initialize)
        Buffer.from('Receipt\n'),
        Buffer.from('Item 1    $5.00\n'),
        Buffer.from('TOTAL     $5.00\n'),
        Buffer.from([0x1D, 0x56, 0x00]), // GS V (Cut)
      ]);
      
      await fs.writeFile(testFile, content);
      
      const result = await processor.processFile(testFile);
      
      expect(result.isESCPOS).toBe(true);
      expect(result.escposBytes).toBeTruthy();
      expect(result.text).toBe('Receipt\nItem 1    $5.00\nTOTAL     $5.00');
      expect(result.metadata.fileSize).toBe(content.length);
      expect(result.metadata.isESCPOS).toBe(true);
      expect(result.metadata.hasControlChars).toBe(true);
      expect(result.metadata.lineCount).toBe(3);
    });
    
    it('should process plain text file', async () => {
      const testFile = path.join(testDir, 'test.txt');
      
      const content = 'Receipt\nItem 1    $5.00\nTOTAL     $5.00';
      await fs.writeFile(testFile, content);
      
      const result = await processor.processFile(testFile);
      
      expect(result.isESCPOS).toBe(false);
      expect(result.escposBytes).toBeNull();
      expect(result.text).toBe(content);
      expect(result.metadata.isESCPOS).toBe(false);
      expect(result.metadata.hasControlChars).toBe(false);
    });
    
    it('should store ESC/POS bytes as base64', async () => {
      const testFile = path.join(testDir, 'test.SPL');
      
      const content = Buffer.from([0x1B, 0x40, 0x48, 0x65, 0x6C, 0x6C, 0x6F]); // ESC @ Hello
      await fs.writeFile(testFile, content);
      
      const result = await processor.processFile(testFile);
      
      expect(result.escposBytes).toBeTruthy();
      
      // Verify base64 encoding
      const decoded = Buffer.from(result.escposBytes, 'base64');
      expect(decoded).toEqual(content);
    });
    
    it('should handle empty files', async () => {
      const testFile = path.join(testDir, 'empty.SPL');
      await fs.writeFile(testFile, '');
      
      const result = await processor.processFile(testFile);
      
      expect(result.isESCPOS).toBe(false);
      expect(result.text).toBe('');
      expect(result.metadata.fileSize).toBe(0);
    });
    
    it('should throw error for non-existent file', async () => {
      const testFile = path.join(testDir, 'nonexistent.SPL');
      
      await expect(processor.processFile(testFile)).rejects.toThrow();
    });
  });
  
  describe('Mixed Content Handling', () => {
    it('should handle ESC/POS with text content', async () => {
      const testFile = path.join(testDir, 'mixed.SPL');
      
      // Realistic receipt with ESC/POS commands
      const content = Buffer.concat([
        Buffer.from([0x1B, 0x40]), // Initialize
        Buffer.from([0x1B, 0x61, 0x01]), // Center align
        Buffer.from('BAR NAME\n'),
        Buffer.from([0x1B, 0x61, 0x00]), // Left align
        Buffer.from('------------------------\n'),
        Buffer.from('Beer x2         500.00\n'),
        Buffer.from('Chips           150.00\n'),
        Buffer.from('------------------------\n'),
        Buffer.from([0x1B, 0x21, 0x08]), // Bold
        Buffer.from('TOTAL           650.00\n'),
        Buffer.from([0x1B, 0x21, 0x00]), // Normal
        Buffer.from([0x1D, 0x56, 0x00]), // Cut
      ]);
      
      await fs.writeFile(testFile, content);
      
      const result = await processor.processFile(testFile);
      
      expect(result.isESCPOS).toBe(true);
      expect(result.text).toContain('BAR NAME');
      expect(result.text).toContain('Beer x2         500.00');
      expect(result.text).toContain('TOTAL           650.00');
      expect(result.text).not.toContain('\x1B'); // No ESC characters in text
    });
  });
  
  describe('Statistics', () => {
    it('should track processing statistics', async () => {
      const testFile1 = path.join(testDir, 'test1.SPL');
      const testFile2 = path.join(testDir, 'test2.txt');
      
      // ESC/POS file
      await fs.writeFile(testFile1, Buffer.from([0x1B, 0x40, 0x48, 0x69]));
      
      // Plain text file
      await fs.writeFile(testFile2, 'Hello');
      
      await processor.processFile(testFile1);
      await processor.processFile(testFile2);
      
      const stats = processor.getStats();
      
      expect(stats.filesProcessed).toBe(2);
      expect(stats.escposDetected).toBe(1);
      expect(stats.textOnly).toBe(1);
      expect(stats.conversionErrors).toBe(0);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle binary data gracefully', async () => {
      const testFile = path.join(testDir, 'binary.SPL');
      
      // Random binary data
      const content = Buffer.from([
        0xFF, 0xFE, 0xFD, 0xFC,
        0x48, 0x65, 0x6C, 0x6C, 0x6F, // Hello
        0x00, 0x01, 0x02, 0x03,
      ]);
      
      await fs.writeFile(testFile, content);
      
      const result = await processor.processFile(testFile);
      
      // Should extract only printable characters
      expect(result.text).toBe('Hello');
    });
    
    it('should handle very long lines', async () => {
      const testFile = path.join(testDir, 'long.SPL');
      
      // Create a very long line (1000 characters)
      const longLine = 'A'.repeat(1000);
      await fs.writeFile(testFile, longLine);
      
      const result = await processor.processFile(testFile);
      
      expect(result.text).toBe(longLine);
      expect(result.text.length).toBe(1000);
    });
    
    it('should handle files with only control characters', async () => {
      const testFile = path.join(testDir, 'control.SPL');
      
      // Only ESC/POS commands, no text
      const content = Buffer.from([
        0x1B, 0x40, // Initialize
        0x1B, 0x61, 0x01, // Center
        0x1D, 0x56, 0x00, // Cut
      ]);
      
      await fs.writeFile(testFile, content);
      
      const result = await processor.processFile(testFile);
      
      expect(result.isESCPOS).toBe(true);
      expect(result.text).toBe('');
    });
    
    it('should handle Unicode characters in printable range', async () => {
      const testFile = path.join(testDir, 'unicode.SPL');
      
      // ASCII printable characters only (ESC/POS typically uses ASCII)
      const content = 'Receipt\nTOTAL: $10.00';
      await fs.writeFile(testFile, content);
      
      const result = await processor.processFile(testFile);
      
      expect(result.text).toBe(content);
    });
  });
  
  describe('Real-World Receipt Formats', () => {
    it('should handle typical thermal receipt format', async () => {
      const testFile = path.join(testDir, 'receipt.SPL');
      
      const content = Buffer.concat([
        Buffer.from([0x1B, 0x40]), // Initialize
        Buffer.from('        BAR NAME\n'),
        Buffer.from('    123 Main Street\n'),
        Buffer.from('------------------------\n'),
        Buffer.from('Beer x2         500.00\n'),
        Buffer.from('Chips           150.00\n'),
        Buffer.from('Wings           300.00\n'),
        Buffer.from('------------------------\n'),
        Buffer.from('Subtotal        950.00\n'),
        Buffer.from('Tax (16%)       152.00\n'),
        Buffer.from('------------------------\n'),
        Buffer.from([0x1B, 0x21, 0x08]), // Bold
        Buffer.from('TOTAL         1,102.00\n'),
        Buffer.from([0x1B, 0x21, 0x00]), // Normal
        Buffer.from('\n'),
        Buffer.from('Thank you!\n'),
        Buffer.from([0x1D, 0x56, 0x00]), // Cut
      ]);
      
      await fs.writeFile(testFile, content);
      
      const result = await processor.processFile(testFile);
      
      expect(result.isESCPOS).toBe(true);
      expect(result.text).toContain('BAR NAME');
      expect(result.text).toContain('Beer x2         500.00');
      expect(result.text).toContain('TOTAL         1,102.00');
      expect(result.text).toContain('Thank you!');
      
      // Verify line count
      const lines = result.text.split('\n');
      expect(lines.length).toBeGreaterThan(10);
    });
  });
});
