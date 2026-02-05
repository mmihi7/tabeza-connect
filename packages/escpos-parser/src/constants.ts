/**
 * Constants for ESC/POS parsing
 * Configuration values and thresholds
 */

import type { PrintFormat, ParsingOptions } from './types';

/**
 * Supported print formats
 */
export const SUPPORTED_FORMATS: readonly PrintFormat[] = [
  'ESC_POS',
  'PLAIN_TEXT',
  'PDF',
  'IMAGE'
] as const;

/**
 * Default parsing options
 */
export const DEFAULT_PARSING_OPTIONS: Required<Omit<ParsingOptions, 'merchantId' | 'customPatterns'>> = {
  strictMode: false,
  minConfidence: 0.6,
  maxProcessingTime: 5000,        // 5 seconds
  enableHeuristics: true,
  fallbackToPlainText: true,
  preserveRawData: false
};

/**
 * Confidence thresholds for different parsing quality levels
 */
export const PARSING_CONFIDENCE_THRESHOLDS = {
  EXCELLENT: 0.9,
  GOOD: 0.7,
  ACCEPTABLE: 0.5,
  POOR: 0.3,
  FAILED: 0.1
} as const;

/**
 * ESC/POS command patterns for format detection
 */
export const ESCPOS_PATTERNS = {
  // Common ESC/POS commands
  INITIALIZE: /\x1B@/,
  CUT_PAPER: /\x1Dm|\x1DVA/,
  LINE_FEED: /\x0A/,
  FORM_FEED: /\x0C/,
  CARRIAGE_RETURN: /\x0D/,
  
  // Text formatting
  BOLD_ON: /\x1BE\x01/,
  BOLD_OFF: /\x1BE\x00/,
  UNDERLINE_ON: /\x1B-\x01/,
  UNDERLINE_OFF: /\x1B-\x00/,
  
  // Alignment
  ALIGN_LEFT: /\x1Ba\x00/,
  ALIGN_CENTER: /\x1Ba\x01/,
  ALIGN_RIGHT: /\x1Ba\x02/,
  
  // Character size
  DOUBLE_HEIGHT: /\x1B!\x10/,
  DOUBLE_WIDTH: /\x1B!\x20/,
  NORMAL_SIZE: /\x1B!\x00/
} as const;

/**
 * Common receipt patterns for content detection
 */
export const RECEIPT_PATTERNS = {
  // Merchant information
  MERCHANT_NAME: /^([A-Z\s&]+)$/m,
  PHONE_NUMBER: /(?:tel|phone|ph)[\s:]*([+]?[\d\s\-()]+)/i,
  EMAIL: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
  ADDRESS: /(?:address|addr)[\s:]*(.+)/i,
  
  // KRA/Tax information
  KRA_PIN: /(?:kra|pin)[\s:]*([P]\d{9}[A-Z])/i,
  VAT_NUMBER: /(?:vat|tax)[\s#:]*(\d+)/i,
  
  // Transaction information
  RECEIPT_NUMBER: /(?:receipt|rcpt|ref)[\s#:]*([A-Z0-9]+)/i,
  DATE_TIME: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}[\s]+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)/i,
  
  // Items and pricing
  ITEM_LINE: /^(.+?)\s+(\d+(?:\.\d{2})?)\s*$/m,
  QUANTITY_PRICE: /(\d+)\s*x\s*(\d+(?:\.\d{2})?)/,
  
  // Totals
  SUBTOTAL: /(?:subtotal|sub[\s\-]?total)[\s:]*([0-9,]+\.?\d{0,2})/i,
  TAX: /(?:tax|vat)[\s:]*([0-9,]+\.?\d{0,2})/i,
  TOTAL: /(?:total|amount)[\s:]*([0-9,]+\.?\d{0,2})/i,
  
  // Payment information
  CASH: /(?:cash|paid)[\s:]*([0-9,]+\.?\d{0,2})/i,
  CHANGE: /(?:change|balance)[\s:]*([0-9,]+\.?\d{0,2})/i,
  MPESA: /(?:mpesa|m-pesa)[\s:]*([A-Z0-9]+)/i,
  
  // Common separators
  SEPARATOR_LINE: /^[\-=_\*]{3,}$/m,
  THANK_YOU: /(?:thank\s*you|thanks|asante)/i
} as const;

/**
 * Format detection indicators
 */
export const FORMAT_INDICATORS = {
  ESC_POS: {
    required: ['hasControlChars', 'hasPrintCommands'],
    optional: ['hasFormatting', 'hasCutCommand'],
    minConfidence: 0.8
  },
  PLAIN_TEXT: {
    required: ['hasReadableText'],
    optional: ['hasReceiptStructure', 'hasNumbers'],
    minConfidence: 0.6
  },
  PDF: {
    required: ['pdfHeader'],
    optional: ['hasMetadata'],
    minConfidence: 0.9
  },
  IMAGE: {
    required: ['imageHeader'],
    optional: ['hasImageMetadata'],
    minConfidence: 0.9
  }
} as const;

/**
 * Error codes for parsing failures
 */
export const PARSING_ERROR_CODES = {
  INVALID_FORMAT: 'INVALID_FORMAT',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  PARSING_TIMEOUT: 'PARSING_TIMEOUT',
  MERCHANT_NOT_FOUND: 'MERCHANT_NOT_FOUND',
  NO_ITEMS_FOUND: 'NO_ITEMS_FOUND',
  NO_TOTALS_FOUND: 'NO_TOTALS_FOUND',
  INVALID_CURRENCY: 'INVALID_CURRENCY',
  CONFIDENCE_TOO_LOW: 'CONFIDENCE_TOO_LOW',
  PATTERN_MATCH_FAILED: 'PATTERN_MATCH_FAILED',
  HEURISTIC_FAILED: 'HEURISTIC_FAILED'
} as const;

/**
 * Default currency for parsing (extensible)
 */
export const DEFAULT_CURRENCY = 'KES';

/**
 * Maximum processing limits
 */
export const PROCESSING_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024,    // 10MB
  MAX_LINES: 10000,                   // Maximum lines to process
  MAX_ITEMS: 1000,                    // Maximum items per receipt
  MAX_PROCESSING_TIME: 30000,         // 30 seconds absolute maximum
  MIN_PROCESSING_TIME: 10             // 10ms minimum for timing accuracy
} as const;

/**
 * Regex flags for consistent pattern matching
 */
export const REGEX_FLAGS = {
  CASE_INSENSITIVE: 'i',
  MULTILINE: 'm',
  GLOBAL: 'g',
  UNICODE: 'u',
  STICKY: 'y'
} as const;