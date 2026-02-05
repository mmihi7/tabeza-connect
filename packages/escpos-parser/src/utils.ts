/**
 * Utility functions for ESC/POS parsing
 * Pure functions with no OS dependencies
 */

import type { 
  PrintFormat, 
  FormatDetectionResult, 
  ParsingResult, 
  ParsingOptions, 
  RawPrintData 
} from './types';
import { FormatDetector } from './core/format-detector';
import { ReceiptParser } from './core/receipt-parser';
import { DEFAULT_PARSING_OPTIONS, PARSING_CONFIDENCE_THRESHOLDS } from './constants';

/**
 * Detect print format of raw data
 */
export function detectPrintFormat(data: Buffer | string): FormatDetectionResult {
  const detector = new FormatDetector();
  return detector.detect(data);
}

/**
 * Parse receipt data with default options
 */
export async function parseReceiptData(
  data: Buffer | string | RawPrintData,
  merchantId: string,
  options?: Partial<ParsingOptions>
): Promise<ParsingResult> {
  const parser = new ReceiptParser();
  const fullOptions = createParsingOptions(merchantId, options);
  return parser.parse(data, fullOptions);
}

/**
 * Create parsing options with defaults
 */
export function createParsingOptions(
  merchantId: string,
  overrides?: Partial<ParsingOptions>
): ParsingOptions {
  return {
    merchantId,
    ...DEFAULT_PARSING_OPTIONS,
    ...overrides
  };
}

/**
 * Validate parsing result quality
 */
export function validateParsingResult(result: ParsingResult): boolean {
  if (result.status === 'failed') {
    return false;
  }
  
  if (result.confidence < PARSING_CONFIDENCE_THRESHOLDS.ACCEPTABLE) {
    return false;
  }
  
  if (!result.receipt) {
    return false;
  }
  
  // Check for critical data
  const hasItems = result.receipt.events.some(event => 
    event.items && event.items.length > 0
  );
  
  const hasTotal = result.receipt.totals && result.receipt.totals.total > 0;
  
  return Boolean(hasItems && hasTotal);
}

/**
 * Get parsing quality assessment
 */
export function assessParsingQuality(result: ParsingResult): {
  level: 'excellent' | 'good' | 'acceptable' | 'poor' | 'failed';
  score: number;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  if (result.status === 'failed') {
    return {
      level: 'failed',
      score: 0,
      issues: result.errors?.map(e => e.message) || ['Parsing failed'],
      recommendations: ['Check input data format', 'Try different parsing options']
    };
  }
  
  let level: 'excellent' | 'good' | 'acceptable' | 'poor' | 'failed';
  
  if (result.confidence >= PARSING_CONFIDENCE_THRESHOLDS.EXCELLENT) {
    level = 'excellent';
  } else if (result.confidence >= PARSING_CONFIDENCE_THRESHOLDS.GOOD) {
    level = 'good';
  } else if (result.confidence >= PARSING_CONFIDENCE_THRESHOLDS.ACCEPTABLE) {
    level = 'acceptable';
  } else {
    level = 'poor';
  }
  
  // Check for common issues
  if (result.metadata.itemsFound === 0) {
    issues.push('No items found in receipt');
    recommendations.push('Check if receipt contains item listings');
  }
  
  if (!result.metadata.totalsFound) {
    issues.push('No totals found in receipt');
    recommendations.push('Verify receipt contains total amounts');
  }
  
  if (!result.metadata.merchantInfoFound) {
    issues.push('Merchant information not found');
    recommendations.push('Check if receipt header contains merchant details');
  }
  
  if (result.warnings && result.warnings.length > 0) {
    issues.push(`${result.warnings.length} parsing warnings`);
  }
  
  return {
    level,
    score: result.confidence,
    issues,
    recommendations
  };
}

/**
 * Sanitize and normalize raw print data
 */
export function sanitizePrintData(data: Buffer | string): Buffer {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  
  // Remove null bytes that might cause issues
  const cleaned = Buffer.alloc(buffer.length);
  let writeIndex = 0;
  
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    
    // Skip null bytes and other problematic control characters
    if (byte !== 0x00 && byte !== 0xFF) {
      cleaned[writeIndex++] = byte;
    }
  }
  
  return cleaned.subarray(0, writeIndex);
}

/**
 * Extract text preview from raw data for debugging
 */
export function extractTextPreview(data: Buffer | string, maxLength: number = 200): string {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  
  let preview = '';
  let charCount = 0;
  
  for (let i = 0; i < buffer.length && charCount < maxLength; i++) {
    const byte = buffer[i];
    
    if (byte >= 0x20 && byte <= 0x7E) {
      // Printable ASCII
      preview += String.fromCharCode(byte);
      charCount++;
    } else if (byte === 0x0A) {
      // Line feed
      preview += '\\n';
      charCount += 2;
    } else if (byte === 0x0D) {
      // Carriage return
      preview += '\\r';
      charCount += 2;
    } else if (byte === 0x09) {
      // Tab
      preview += '\\t';
      charCount += 2;
    } else {
      // Other control characters
      preview += `\\x${byte.toString(16).padStart(2, '0')}`;
      charCount += 4;
    }
  }
  
  if (buffer.length > maxLength) {
    preview += '...';
  }
  
  return preview;
}

/**
 * Compare two parsing results for similarity
 */
export function compareParsingResults(
  result1: ParsingResult, 
  result2: ParsingResult
): {
  similarity: number;
  differences: string[];
} {
  const differences: string[] = [];
  let similarity = 1.0;
  
  if (!result1.receipt || !result2.receipt) {
    return {
      similarity: 0,
      differences: ['One or both results have no receipt data']
    };
  }
  
  // Compare merchant names
  const merchant1 = result1.receipt.session.merchant.name;
  const merchant2 = result2.receipt.session.merchant.name;
  
  if (merchant1 !== merchant2) {
    differences.push(`Merchant name differs: "${merchant1}" vs "${merchant2}"`);
    similarity -= 0.2;
  }
  
  // Compare item counts
  const items1 = result1.receipt.events.reduce((sum, e) => sum + (e.items?.length || 0), 0);
  const items2 = result2.receipt.events.reduce((sum, e) => sum + (e.items?.length || 0), 0);
  
  if (items1 !== items2) {
    differences.push(`Item count differs: ${items1} vs ${items2}`);
    similarity -= 0.3;
  }
  
  // Compare totals
  const total1 = result1.receipt.totals?.total || 0;
  const total2 = result2.receipt.totals?.total || 0;
  
  if (Math.abs(total1 - total2) > 0.01) {
    differences.push(`Total amount differs: ${total1} vs ${total2}`);
    similarity -= 0.3;
  }
  
  // Compare confidence scores
  const confidenceDiff = Math.abs(result1.confidence - result2.confidence);
  if (confidenceDiff > 0.1) {
    differences.push(`Confidence differs significantly: ${result1.confidence} vs ${result2.confidence}`);
    similarity -= 0.1;
  }
  
  return {
    similarity: Math.max(0, similarity),
    differences
  };
}

/**
 * Create test print data for development and testing
 */
export function createTestPrintData(format: PrintFormat, options?: {
  merchantName?: string;
  items?: Array<{ name: string; price: number; qty?: number }>;
  total?: number;
  includeKraPin?: boolean;
}): Buffer {
  const opts = {
    merchantName: 'Test Restaurant',
    items: [
      { name: 'Coffee', price: 150, qty: 2 },
      { name: 'Sandwich', price: 300, qty: 1 }
    ],
    total: 600,
    includeKraPin: false,
    ...options
  };
  
  switch (format) {
    case 'PLAIN_TEXT':
      return createPlainTextReceipt(opts);
    case 'ESC_POS':
      return createEscPosReceipt(opts);
    default:
      throw new Error(`Test data generation not supported for format: ${format}`);
  }
}

/**
 * Create plain text test receipt
 */
function createPlainTextReceipt(options: any): Buffer {
  const lines = [
    options.merchantName,
    '================================',
    options.includeKraPin ? 'KRA PIN: P123456789A' : '',
    `Date: ${new Date().toLocaleDateString()}`,
    `Time: ${new Date().toLocaleTimeString()}`,
    'Receipt #: RCP001',
    '================================',
    ''
  ].filter(Boolean);
  
  // Add items
  options.items.forEach((item: any) => {
    const qty = item.qty || 1;
    const total = item.price * qty;
    lines.push(`${item.name.padEnd(20)} ${qty} x ${item.price} = ${total}`);
  });
  
  lines.push('');
  lines.push('================================');
  lines.push(`TOTAL: KES ${options.total}`);
  lines.push('================================');
  lines.push('Thank you for your business!');
  
  return Buffer.from(lines.join('\n'), 'utf8');
}

/**
 * Create ESC/POS test receipt with control codes
 */
function createEscPosReceipt(options: any): Buffer {
  const parts: Buffer[] = [];
  
  // Initialize printer
  parts.push(Buffer.from([0x1B, 0x40])); // ESC @
  
  // Center alignment
  parts.push(Buffer.from([0x1B, 0x61, 0x01])); // ESC a 1
  
  // Merchant name (bold)
  parts.push(Buffer.from([0x1B, 0x45, 0x01])); // ESC E 1 (bold on)
  parts.push(Buffer.from(options.merchantName, 'utf8'));
  parts.push(Buffer.from([0x1B, 0x45, 0x00])); // ESC E 0 (bold off)
  parts.push(Buffer.from('\n', 'utf8'));
  
  // Left alignment
  parts.push(Buffer.from([0x1B, 0x61, 0x00])); // ESC a 0
  
  // Separator
  parts.push(Buffer.from('================================\n', 'utf8'));
  
  if (options.includeKraPin) {
    parts.push(Buffer.from('KRA PIN: P123456789A\n', 'utf8'));
  }
  
  parts.push(Buffer.from(`Date: ${new Date().toLocaleDateString()}\n`, 'utf8'));
  parts.push(Buffer.from(`Time: ${new Date().toLocaleTimeString()}\n`, 'utf8'));
  parts.push(Buffer.from('Receipt #: RCP001\n', 'utf8'));
  parts.push(Buffer.from('================================\n\n', 'utf8'));
  
  // Items
  options.items.forEach((item: any) => {
    const qty = item.qty || 1;
    const total = item.price * qty;
    const line = `${item.name.padEnd(20)} ${qty} x ${item.price} = ${total}\n`;
    parts.push(Buffer.from(line, 'utf8'));
  });
  
  parts.push(Buffer.from('\n================================\n', 'utf8'));
  
  // Total (bold)
  parts.push(Buffer.from([0x1B, 0x45, 0x01])); // Bold on
  parts.push(Buffer.from(`TOTAL: KES ${options.total}\n`, 'utf8'));
  parts.push(Buffer.from([0x1B, 0x45, 0x00])); // Bold off
  
  parts.push(Buffer.from('================================\n', 'utf8'));
  parts.push(Buffer.from('Thank you for your business!\n', 'utf8'));
  
  // Cut paper
  parts.push(Buffer.from([0x1D, 0x56, 0x00])); // GS V 0
  
  return Buffer.concat(parts);
}

/**
 * Estimate parsing difficulty for given data
 */
export function estimateParsingDifficulty(data: Buffer | string): {
  difficulty: 'easy' | 'medium' | 'hard' | 'very_hard';
  factors: string[];
  estimatedTime: number; // milliseconds
} {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  const factors: string[] = [];
  let difficulty: 'easy' | 'medium' | 'hard' | 'very_hard' = 'easy';
  let estimatedTime = 50; // Base time in ms
  
  // Size factor
  if (buffer.length > 10000) {
    factors.push('large_file_size');
    estimatedTime += 100;
    difficulty = 'medium';
  }
  
  // Binary content factor
  let binaryRatio = 0;
  for (let i = 0; i < Math.min(buffer.length, 1000); i++) {
    if (buffer[i] < 32 && buffer[i] !== 9 && buffer[i] !== 10 && buffer[i] !== 13) {
      binaryRatio++;
    }
  }
  binaryRatio /= Math.min(buffer.length, 1000);
  
  if (binaryRatio > 0.3) {
    factors.push('high_binary_content');
    estimatedTime += 200;
    difficulty = 'hard';
  } else if (binaryRatio > 0.1) {
    factors.push('moderate_binary_content');
    estimatedTime += 100;
    if (difficulty === 'easy') difficulty = 'medium';
  }
  
  // Text analysis
  try {
    const text = buffer.toString('utf8');
    const lines = text.split('\n');
    
    if (lines.length > 200) {
      factors.push('many_lines');
      estimatedTime += 50;
    }
    
    // Check for structured content
    const hasNumbers = /\d+\.?\d*/.test(text);
    const hasCurrency = /\$|KES|USD|EUR|GBP/.test(text);
    const hasItems = /total|subtotal|tax/i.test(text);
    
    if (!hasNumbers || !hasCurrency || !hasItems) {
      factors.push('unstructured_content');
      estimatedTime += 150;
      if (difficulty !== 'hard') difficulty = 'medium';
    }
    
    // Check for encoding issues
    if (text.includes('\uFFFD')) {
      factors.push('encoding_issues');
      estimatedTime += 200;
      difficulty = 'very_hard';
    }
    
  } catch (error) {
    factors.push('text_decode_error');
    estimatedTime += 300;
    difficulty = 'very_hard';
  }
  
  return {
    difficulty,
    factors,
    estimatedTime
  };
}