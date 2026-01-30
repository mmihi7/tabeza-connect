/**
 * TABEZA Virtual Printer Interface
 * Main entry point for the virtual printer package
 */

// Core Engine
export { VirtualPrinterEngine, createDefaultConfig } from './core/virtual-printer-engine';
export type { VirtualPrinterConfig, ProcessingStats } from './core/virtual-printer-engine';

// Core Components
export { FormatDetector } from './core/format-detector';
export { ReceiptParser } from './core/receipt-parser';
export { PrintCaptureLayer, createPrintCapture, detectPlatform, getRecommendedCaptureMethod } from './core/print-capture';
export { DualOutputManager } from './core/dual-output-manager';
export { SyncQueue, DEFAULT_SYNC_CONFIG } from './core/sync-queue';
export { SecurityManager, DEFAULT_SECURITY_CONFIG } from './core/security-manager';
export { attachComplianceHints, createDefaultHints, getComplianceMetadata, hasComplianceHints } from './core/compliance-hook';

// Types
export type {
  // Receipt Types
  CanonicalReceipt,
  Merchant,
  Transaction,
  ReceiptItem,
  ReceiptTotals,
  ReceiptFooter,
  PrintFormat,
  FormatDetectionResult,
  RawPrintJob,
  ParsingResult,
  EtimsStatus,
  EtimsSubmission,
  PrinterRegistration,
  ReceiptDelivery
} from './types/receipt';

export type {
  // Print Capture Types
  PrintCaptureConfig,
  CapturedPrintJob
} from './core/print-capture';

export type {
  // Dual Output Types
  DualOutputConfig,
  ProcessedOutput
} from './core/dual-output-manager';

export type {
  // Sync Queue Types
  QueuedItem,
  SyncConfig,
  SyncStats
} from './core/sync-queue';

export type {
  // Security Types
  SecurityConfig,
  ReceiptSignature,
  SecurityAudit
} from './core/security-manager';

export type {
  // Compliance Hook Types
  ComplianceHint,
  ComplianceMetadata
} from './core/compliance-hook';

// Schemas for validation
export {
  CanonicalReceiptSchema,
  MerchantSchema,
  TransactionSchema,
  ReceiptItemSchema,
  ReceiptTotalsSchema,
  ReceiptFooterSchema
} from './types/receipt';

// Utility functions
export { createVirtualPrinter, createTestReceipt } from './utils/factory';
export { validateReceipt, sanitizeReceiptData } from './utils/validation';
export { formatReceiptForDisplay, generateReceiptHTML, generateReceiptPDF } from './utils/formatting';

// Constants
export const VIRTUAL_PRINTER_VERSION = '1.0.0';
export const SUPPORTED_FORMATS = ['ESC_POS', 'PLAIN_TEXT', 'PDF', 'IMAGE'] as const;
export const SUPPORTED_PLATFORMS = ['windows', 'linux', 'macos'] as const;
export const SUPPORTED_DELIVERY_METHODS = ['sms', 'email', 'whatsapp', 'qr_code'] as const;