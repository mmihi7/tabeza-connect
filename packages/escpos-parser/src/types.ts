/**
 * Type definitions for ESC/POS parsing
 * Pure types with no OS dependencies
 */

import type { CompleteReceiptSession } from '@tabeza/receipt-schema';

/**
 * Supported print data formats
 */
export type PrintFormat = 
  | 'ESC_POS'      // ESC/POS thermal printer commands
  | 'PLAIN_TEXT'   // Plain text receipts
  | 'PDF'          // PDF documents (metadata only)
  | 'IMAGE'        // Image formats (metadata only)
  | 'UNKNOWN';     // Unrecognized format

/**
 * Format detection result
 */
export interface FormatDetectionResult {
  format: PrintFormat;
  confidence: number;        // 0.0 to 1.0
  indicators: string[];      // What led to this detection
  metadata?: {
    encoding?: string;
    lineEndings?: 'CRLF' | 'LF' | 'CR';
    estimatedLines?: number;
    hasControlChars?: boolean;
    hasPrintCommands?: boolean;
    attempted_formats?: Array<{ format: PrintFormat; confidence: number }>;
    error?: string;
  };
}

/**
 * Parsing result for receipt data
 */
export interface ParsingResult {
  status: 'success' | 'partial' | 'failed';
  receipt?: CompleteReceiptSession;
  confidence: number;        // Overall parsing confidence 0.0 to 1.0
  errors?: ParsingError[];
  warnings?: string[];
  metadata: {
    format: PrintFormat;
    processingTime: number;   // milliseconds
    linesProcessed: number;
    itemsFound: number;
    totalsFound: boolean;
    merchantInfoFound: boolean;
  };
}

/**
 * Parsing error information
 */
export interface ParsingError {
  code: string;
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

/**
 * Options for parsing configuration
 */
export interface ParsingOptions {
  merchantId: string;
  strictMode?: boolean;           // Fail on any parsing errors
  minConfidence?: number;         // Minimum confidence threshold (0.0-1.0)
  maxProcessingTime?: number;     // Maximum processing time in ms
  enableHeuristics?: boolean;     // Use heuristic parsing for ambiguous data
  fallbackToPlainText?: boolean;  // Fall back to plain text parsing
  preserveRawData?: boolean;      // Include raw data in result
  customPatterns?: RegExp[];      // Additional regex patterns to try
}

/**
 * Raw print job data (input to parser)
 */
export interface RawPrintData {
  data: Buffer | string;
  source?: string;              // Source printer or system
  timestamp?: string;           // When data was captured
  jobId?: string;              // Print job identifier
  metadata?: Record<string, any>;
}

/**
 * Parsing context for stateful parsing
 */
export interface ParsingContext {
  merchantId: string;
  currentLine: number;
  totalLines: number;
  format: PrintFormat;
  confidence: number;
  errors: ParsingError[];
  warnings: string[];
  extractedData: {
    merchantInfo?: any;
    items?: any[];
    totals?: any;
    payments?: any[];
    timestamps?: string[];
  };
}

/**
 * Pattern matching result
 */
export interface PatternMatch {
  pattern: string;
  match: RegExpMatchArray;
  confidence: number;
  extractedData: any;
  line: number;
}

/**
 * Heuristic analysis result
 */
export interface HeuristicResult {
  type: 'merchant' | 'item' | 'total' | 'payment' | 'timestamp' | 'other';
  confidence: number;
  data: any;
  reasoning: string[];
}