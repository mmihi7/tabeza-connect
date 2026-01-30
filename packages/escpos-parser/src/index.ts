/**
 * TABEZA ESC/POS Parser
 * Pure parsing logic extracted from virtual-printer for serverless compatibility
 * 
 * This package contains only pure functions with no OS dependencies,
 * making it suitable for both cloud (Vercel) and agent (Windows) systems.
 */

// Core parsing components
export { FormatDetector } from './core/format-detector';
export { ReceiptParser } from './core/receipt-parser';

// Types and interfaces
export type {
  PrintFormat,
  FormatDetectionResult,
  ParsingResult,
  ParsingError,
  ParsingOptions
} from './types';

// Utility functions
export {
  detectPrintFormat,
  parseReceiptData,
  validateParsingResult,
  createParsingOptions,
  assessParsingQuality,
  sanitizePrintData,
  extractTextPreview,
  compareParsingResults,
  createTestPrintData,
  estimateParsingDifficulty
} from './utils';

// Constants and enums
export {
  SUPPORTED_FORMATS,
  DEFAULT_PARSING_OPTIONS,
  PARSING_CONFIDENCE_THRESHOLDS
} from './constants';

// Version information
export const VERSION = '1.0.0';
export const PACKAGE_NAME = '@tabeza/escpos-parser';
export const DESCRIPTION = 'Pure ESC/POS parsing logic - serverless compatible';