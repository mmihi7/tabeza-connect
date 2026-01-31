/**
 * TABEZA Virtual Printer Package
 * Main entry point for the virtual printer system
 */

// Core engine
export { VirtualPrinterEngine, createDefaultConfig } from './core/virtual-printer-engine';
export type { VirtualPrinterConfig, ProcessingStats } from './core/virtual-printer-engine';

// Types
export type {
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

// Factory utilities
export {
  createVirtualPrinter,
  generateSecretKey,
  createTestReceipt,
  createTestPrintData,
  createDevelopmentConfig
} from './utils/factory';

// Core components (for advanced usage)
export { PrintCapture } from './core/print-capture';
export { DualOutputManager } from './core/dual-output-manager';
export { SyncQueue } from './core/sync-queue';
export { SecurityManager } from './core/security-manager';
export { FormatDetector } from './core/format-detector';
export { ReceiptParser } from './core/receipt-parser';

// Configuration types
export type { PrintCaptureConfig } from './core/print-capture';
export type { DualOutputConfig } from './core/dual-output-manager';
export type { SyncConfig } from './core/sync-queue';
export type { SecurityConfig } from './core/security-manager';