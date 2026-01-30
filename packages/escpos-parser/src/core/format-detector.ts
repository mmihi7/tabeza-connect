/**
 * Format Detection Engine
 * Pure format detection logic extracted from virtual-printer
 * No OS dependencies - serverless compatible
 */

import type { PrintFormat, FormatDetectionResult } from '../types';
import { ESCPOS_PATTERNS, RECEIPT_PATTERNS, FORMAT_INDICATORS } from '../constants';

export class FormatDetector {
  /**
   * Main detection method - analyzes raw print data and returns format with confidence
   */
  detect(rawData: Buffer | string): FormatDetectionResult {
    const data = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData, 'utf8');
    
    // Run all detection methods and pick the highest confidence
    const results = [
      this.detectESCPOS(data),
      this.detectPDF(data),
      this.detectImage(data),
      this.detectPlainText(data)
    ];

    // Sort by confidence and return the best match
    const bestMatch = results.sort((a, b) => b.confidence - a.confidence)[0];
    
    return bestMatch.confidence > 0.5 ? bestMatch : {
      format: 'UNKNOWN',
      confidence: 0,
      indicators: ['no_clear_format_detected'],
      metadata: { 
        attempted_formats: results.map(r => ({ format: r.format, confidence: r.confidence }))
      }
    };
  }

  /**
   * ESC/POS Detection
   * Looks for ESC/POS control codes and patterns
   */
  private detectESCPOS(data: Buffer): FormatDetectionResult {
    let confidence = 0;
    const indicators: string[] = [];
    const metadata: Record<string, any> = {};

    // Check for ESC/POS control codes
    const escCodes = [
      0x1B, // ESC
      0x1D, // GS (Group Separator)
      0x1C, // FS (File Separator)
      0x0A, // LF (Line Feed)
      0x0D  // CR (Carriage Return)
    ];

    let controlCodeCount = 0;
    const sampleSize = Math.min(data.length, 1000);
    
    for (let i = 0; i < sampleSize; i++) {
      if (escCodes.includes(data[i])) {
        controlCodeCount++;
      }
    }

    // ESC/POS typically has many control codes
    const controlCodeRatio = controlCodeCount / sampleSize;
    if (controlCodeRatio > 0.05) { // More than 5% control codes
      confidence += 0.6;
      indicators.push('high_control_code_density');
      metadata.hasControlChars = true;
    } else if (controlCodeRatio > 0.02) { // More than 2% control codes
      confidence += 0.3;
      indicators.push('moderate_control_code_density');
      metadata.hasControlChars = true;
    }

    // Look for specific ESC/POS command sequences
    const escPosPatterns = [
      { pattern: Buffer.from([0x1B, 0x40]), name: 'initialize_printer' },
      { pattern: Buffer.from([0x1B, 0x61]), name: 'select_justification' },
      { pattern: Buffer.from([0x1D, 0x56]), name: 'cut_paper' },
      { pattern: Buffer.from([0x1B, 0x45]), name: 'bold_toggle' },
      { pattern: Buffer.from([0x1B, 0x64]), name: 'print_and_feed' },
      { pattern: Buffer.from([0x1B, 0x21]), name: 'character_size' }
    ];

    let patternMatches = 0;
    const foundPatterns: string[] = [];
    
    for (const { pattern, name } of escPosPatterns) {
      if (this.bufferIncludes(data, pattern)) {
        patternMatches++;
        foundPatterns.push(name);
      }
    }

    if (patternMatches > 0) {
      confidence += (patternMatches / escPosPatterns.length) * 0.4;
      indicators.push('escpos_commands_detected');
      metadata.hasPrintCommands = true;
      metadata.foundCommands = foundPatterns;
    }

    // Check for binary data patterns typical of ESC/POS
    const binaryRatio = this.calculateBinaryRatio(data);
    if (binaryRatio > 0.1) {
      confidence += 0.2;
      indicators.push('binary_data_present');
    }

    metadata.controlCodeCount = controlCodeCount;
    metadata.controlCodeRatio = controlCodeRatio;
    metadata.patternMatches = patternMatches;
    metadata.binaryRatio = binaryRatio;

    return {
      format: 'ESC_POS',
      confidence: Math.min(confidence, 1.0),
      indicators,
      metadata
    };
  }

  /**
   * PDF Detection
   * Checks for PDF magic bytes and structure
   */
  private detectPDF(data: Buffer): FormatDetectionResult {
    const indicators: string[] = [];
    const metadata: Record<string, any> = {};
    
    // PDF files start with %PDF-
    const pdfHeader = Buffer.from('%PDF-');
    if (data.length >= 8 && data.subarray(0, 5).equals(pdfHeader)) {
      const version = data.subarray(5, 8).toString();
      indicators.push('pdf_header_found');
      metadata.version = version;
      metadata.hasMetadata = true;
      
      return {
        format: 'PDF',
        confidence: 0.95,
        indicators,
        metadata
      };
    }

    return {
      format: 'PDF',
      confidence: 0,
      indicators: ['no_pdf_header'],
      metadata
    };
  }

  /**
   * Image Detection
   * Checks for common image formats (PNG, JPEG, BMP)
   */
  private detectImage(data: Buffer): FormatDetectionResult {
    const indicators: string[] = [];
    const metadata: Record<string, any> = {};

    if (data.length < 8) {
      return {
        format: 'IMAGE',
        confidence: 0,
        indicators: ['insufficient_data'],
        metadata
      };
    }

    // PNG signature
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    if (data.subarray(0, 8).equals(pngSignature)) {
      indicators.push('png_signature_found');
      metadata.type = 'PNG';
      metadata.hasImageMetadata = true;
      
      return {
        format: 'IMAGE',
        confidence: 0.98,
        indicators,
        metadata
      };
    }

    // JPEG signature
    if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
      indicators.push('jpeg_signature_found');
      metadata.type = 'JPEG';
      metadata.hasImageMetadata = true;
      
      return {
        format: 'IMAGE',
        confidence: 0.98,
        indicators,
        metadata
      };
    }

    // BMP signature
    if (data[0] === 0x42 && data[1] === 0x4D) {
      indicators.push('bmp_signature_found');
      metadata.type = 'BMP';
      metadata.hasImageMetadata = true;
      
      return {
        format: 'IMAGE',
        confidence: 0.95,
        indicators,
        metadata
      };
    }

    return {
      format: 'IMAGE',
      confidence: 0,
      indicators: ['no_image_signature'],
      metadata
    };
  }

  /**
   * Plain Text Detection
   * Analyzes text patterns and receipt-like content
   */
  private detectPlainText(data: Buffer): FormatDetectionResult {
    let confidence = 0;
    const indicators: string[] = [];
    const metadata: Record<string, any> = {};

    try {
      const text = data.toString('utf8');
      metadata.length = text.length;
      metadata.estimatedLines = text.split('\n').length;

      // Check if it's mostly printable ASCII
      const printableChars = text.match(/[\x20-\x7E\n\r\t]/g);
      const printableRatio = printableChars ? printableChars.length / text.length : 0;
      
      if (printableRatio > 0.9) {
        confidence += 0.5;
        indicators.push('high_printable_ratio');
        metadata.hasReadableText = true;
      } else if (printableRatio > 0.7) {
        confidence += 0.3;
        indicators.push('moderate_printable_ratio');
        metadata.hasReadableText = true;
      }

      // Detect line endings
      if (text.includes('\r\n')) {
        metadata.lineEndings = 'CRLF';
      } else if (text.includes('\n')) {
        metadata.lineEndings = 'LF';
      } else if (text.includes('\r')) {
        metadata.lineEndings = 'CR';
      }

      // Look for receipt-like patterns
      const receiptPatterns = [
        { pattern: RECEIPT_PATTERNS.TOTAL, name: 'total_found' },
        { pattern: RECEIPT_PATTERNS.SUBTOTAL, name: 'subtotal_found' },
        { pattern: RECEIPT_PATTERNS.TAX, name: 'tax_found' },
        { pattern: RECEIPT_PATTERNS.RECEIPT_NUMBER, name: 'receipt_number_found' },
        { pattern: RECEIPT_PATTERNS.DATE_TIME, name: 'datetime_found' },
        { pattern: RECEIPT_PATTERNS.MERCHANT_NAME, name: 'merchant_name_found' },
        { pattern: RECEIPT_PATTERNS.ITEM_LINE, name: 'item_line_found' },
        { pattern: RECEIPT_PATTERNS.MPESA, name: 'mpesa_found' }
      ];

      let patternMatches = 0;
      const foundPatterns: string[] = [];
      
      for (const { pattern, name } of receiptPatterns) {
        if (pattern.test(text)) {
          patternMatches++;
          foundPatterns.push(name);
        }
      }

      if (patternMatches > 0) {
        confidence += (patternMatches / receiptPatterns.length) * 0.5;
        indicators.push('receipt_patterns_detected');
        metadata.hasReceiptStructure = true;
        metadata.foundPatterns = foundPatterns;
      }

      // Check for numbers (prices, quantities)
      const numberMatches = text.match(/\d+\.?\d*/g);
      if (numberMatches && numberMatches.length > 3) {
        confidence += 0.1;
        indicators.push('numeric_data_present');
        metadata.hasNumbers = true;
        metadata.numberCount = numberMatches.length;
      }

      // Check for currency indicators
      const currencyPattern = /\$|KES|USD|EUR|GBP|Ksh/i;
      if (currencyPattern.test(text)) {
        confidence += 0.1;
        indicators.push('currency_detected');
        metadata.hasCurrency = true;
      }

      metadata.printableRatio = printableRatio;
      metadata.receiptPatterns = patternMatches;

      return {
        format: 'PLAIN_TEXT',
        confidence: Math.min(confidence, 1.0),
        indicators,
        metadata
      };

    } catch (error) {
      return {
        format: 'PLAIN_TEXT',
        confidence: 0,
        indicators: ['text_decode_failed'],
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Get format-specific parsing hints
   */
  getParsingHints(format: PrintFormat, metadata?: Record<string, any>): Record<string, any> {
    switch (format) {
      case 'ESC_POS':
        return {
          encoding: 'cp437', // Common ESC/POS encoding
          lineEnding: '\n',
          cutCommand: Buffer.from([0x1D, 0x56, 0x00]),
          boldOn: Buffer.from([0x1B, 0x45, 0x01]),
          boldOff: Buffer.from([0x1B, 0x45, 0x00]),
          hasControlChars: true,
          binaryData: true
        };
      
      case 'PLAIN_TEXT':
        return {
          encoding: 'utf8',
          lineEnding: metadata?.lineEndings || '\n',
          currencySymbols: ['$', 'KES', 'USD', 'EUR', 'GBP', 'Ksh'],
          textBased: true,
          humanReadable: true
        };
      
      case 'PDF':
        return {
          extractMethod: 'text_layer',
          fallbackOcr: true,
          requiresSpecialHandling: true
        };
      
      case 'IMAGE':
        return {
          ocrRequired: true,
          preprocessing: ['deskew', 'denoise', 'contrast'],
          requiresSpecialHandling: true
        };
      
      default:
        return {};
    }
  }

  /**
   * Analyze content characteristics for debugging
   */
  analyzeContent(data: Buffer | string): {
    size: number;
    binaryRatio: number;
    controlCharRatio: number;
    printableRatio: number;
    hasNullBytes: boolean;
    encoding: string;
  } {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    
    let binaryCount = 0;
    let controlCount = 0;
    let printableCount = 0;
    let nullCount = 0;

    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      
      if (byte === 0) {
        nullCount++;
      } else if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
        controlCount++;
      } else if (byte >= 32 && byte <= 126) {
        printableCount++;
      } else {
        binaryCount++;
      }
    }

    const total = buffer.length;
    
    return {
      size: total,
      binaryRatio: binaryCount / total,
      controlCharRatio: controlCount / total,
      printableRatio: printableCount / total,
      hasNullBytes: nullCount > 0,
      encoding: this.guessEncoding(buffer)
    };
  }

  /**
   * Helper method to check if buffer contains a pattern
   */
  private bufferIncludes(buffer: Buffer, pattern: Buffer): boolean {
    for (let i = 0; i <= buffer.length - pattern.length; i++) {
      if (buffer.subarray(i, i + pattern.length).equals(pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate ratio of binary (non-printable) data
   */
  private calculateBinaryRatio(data: Buffer): number {
    let binaryCount = 0;
    
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      // Consider bytes outside printable ASCII range as binary
      if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
        binaryCount++;
      } else if (byte > 126) {
        binaryCount++;
      }
    }
    
    return binaryCount / data.length;
  }

  /**
   * Guess text encoding based on byte patterns
   */
  private guessEncoding(data: Buffer): string {
    // Simple heuristic - can be expanded
    const hasHighBytes = data.some(byte => byte > 127);
    
    if (!hasHighBytes) {
      return 'ascii';
    }
    
    // Try to decode as UTF-8
    try {
      const text = data.toString('utf8');
      // Check for replacement characters which indicate invalid UTF-8
      if (!text.includes('\uFFFD')) {
        return 'utf8';
      }
    } catch {
      // Fall through to other encodings
    }
    
    // ESC/POS printers often use CP437
    return 'cp437';
  }
}