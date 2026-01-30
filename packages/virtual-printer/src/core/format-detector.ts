/**
 * Format Detection Engine
 * Automatically detects incoming print data type with confidence scoring
 */

import { PrintFormat, FormatDetectionResult } from '../types/receipt';

export class FormatDetector {
  /**
   * Main detection method - analyzes raw print data and returns format with confidence
   */
  detect(rawData: Buffer | string): FormatDetectionResult {
    const data = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData, 'base64');
    
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
      metadata: { attempted_formats: results.map(r => r.format) }
    };
  }

  /**
   * ESC/POS Detection
   * Looks for ESC/POS control codes and patterns
   */
  private detectESCPOS(data: Buffer): FormatDetectionResult {
    let confidence = 0;
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
    for (let i = 0; i < Math.min(data.length, 1000); i++) {
      if (escCodes.includes(data[i])) {
        controlCodeCount++;
      }
    }

    // ESC/POS typically has many control codes
    if (controlCodeCount > 10) {
      confidence += 0.6;
    } else if (controlCodeCount > 5) {
      confidence += 0.3;
    }

    // Look for specific ESC/POS command sequences
    const escPosPatterns = [
      Buffer.from([0x1B, 0x40]), // ESC @ (Initialize printer)
      Buffer.from([0x1B, 0x61]), // ESC a (Select justification)
      Buffer.from([0x1D, 0x56]), // GS V (Cut paper)
      Buffer.from([0x1B, 0x45]), // ESC E (Bold on/off)
      Buffer.from([0x1B, 0x64]), // ESC d (Print and feed)
    ];

    let patternMatches = 0;
    for (const pattern of escPosPatterns) {
      if (data.includes(pattern)) {
        patternMatches++;
      }
    }

    confidence += (patternMatches / escPosPatterns.length) * 0.4;

    metadata.control_codes = controlCodeCount;
    metadata.pattern_matches = patternMatches;

    return {
      format: 'ESC_POS',
      confidence: Math.min(confidence, 1.0),
      metadata
    };
  }

  /**
   * PDF Detection
   * Checks for PDF magic bytes and structure
   */
  private detectPDF(data: Buffer): FormatDetectionResult {
    const metadata: Record<string, any> = {};
    
    // PDF files start with %PDF-
    const pdfHeader = Buffer.from('%PDF-');
    if (data.subarray(0, 5).equals(pdfHeader)) {
      metadata.version = data.subarray(5, 8).toString();
      return {
        format: 'PDF',
        confidence: 0.95,
        metadata
      };
    }

    return {
      format: 'PDF',
      confidence: 0,
      metadata
    };
  }

  /**
   * Image Detection
   * Checks for common image formats (PNG, JPEG, BMP)
   */
  private detectImage(data: Buffer): FormatDetectionResult {
    const metadata: Record<string, any> = {};

    // PNG signature
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    if (data.subarray(0, 8).equals(pngSignature)) {
      return {
        format: 'IMAGE',
        confidence: 0.98,
        metadata: { type: 'PNG' }
      };
    }

    // JPEG signature
    if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
      return {
        format: 'IMAGE',
        confidence: 0.98,
        metadata: { type: 'JPEG' }
      };
    }

    // BMP signature
    if (data[0] === 0x42 && data[1] === 0x4D) {
      return {
        format: 'IMAGE',
        confidence: 0.95,
        metadata: { type: 'BMP' }
      };
    }

    return {
      format: 'IMAGE',
      confidence: 0,
      metadata
    };
  }

  /**
   * Plain Text Detection
   * Analyzes text patterns and receipt-like content
   */
  private detectPlainText(data: Buffer): FormatDetectionResult {
    let confidence = 0;
    const metadata: Record<string, any> = {};

    try {
      const text = data.toString('utf8');
      metadata.length = text.length;

      // Check if it's mostly printable ASCII
      const printableChars = text.match(/[\x20-\x7E\n\r\t]/g);
      const printableRatio = printableChars ? printableChars.length / text.length : 0;
      
      if (printableRatio > 0.8) {
        confidence += 0.4;
      }

      // Look for receipt-like patterns
      const receiptPatterns = [
        /total[:\s]*\$?\d+\.?\d*/i,
        /subtotal[:\s]*\$?\d+\.?\d*/i,
        /tax[:\s]*\$?\d+\.?\d*/i,
        /receipt[:\s]*#?\d+/i,
        /date[:\s]*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i,
        /time[:\s]*\d{1,2}:\d{2}/i,
        /qty[:\s]*\d+/i,
        /amount[:\s]*\$?\d+\.?\d*/i
      ];

      let patternMatches = 0;
      for (const pattern of receiptPatterns) {
        if (pattern.test(text)) {
          patternMatches++;
        }
      }

      confidence += (patternMatches / receiptPatterns.length) * 0.6;

      metadata.printable_ratio = printableRatio;
      metadata.receipt_patterns = patternMatches;
      metadata.has_currency = /\$|KES|USD|EUR|GBP/.test(text);
      metadata.has_numbers = /\d+\.?\d*/.test(text);

      return {
        format: 'PLAIN_TEXT',
        confidence: Math.min(confidence, 1.0),
        metadata
      };

    } catch (error) {
      return {
        format: 'PLAIN_TEXT',
        confidence: 0,
        metadata: { error: 'Failed to decode as text' }
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
          line_ending: '\n',
          cut_command: Buffer.from([0x1D, 0x56, 0x00]),
          bold_on: Buffer.from([0x1B, 0x45, 0x01]),
          bold_off: Buffer.from([0x1B, 0x45, 0x00])
        };
      
      case 'PLAIN_TEXT':
        return {
          encoding: 'utf8',
          line_ending: metadata?.line_ending || '\n',
          currency_symbols: ['$', 'KES', 'USD', 'EUR', 'GBP']
        };
      
      case 'PDF':
        return {
          extract_method: 'text_layer',
          fallback_ocr: true
        };
      
      case 'IMAGE':
        return {
          ocr_required: true,
          preprocessing: ['deskew', 'denoise', 'contrast']
        };
      
      default:
        return {};
    }
  }
}