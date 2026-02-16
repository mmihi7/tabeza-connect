/**
 * Printer Services - Main Export File
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This module exports all printer service interfaces, types, and utilities
 * for authority-based printer driver detection, ESC/POS communication,
 * and printer service management.
 */

// Export all types
export * from './printer-service-types';

// Export authority validator
export {
  createAuthorityModeValidator,
  isPrinterDriverRequired,
  isESCPOSActive,
  isPrintQueueActive,
  isPrinterStatusMonitoringActive,
  getPrinterRequirementDescription,
  type AuthorityModeValidator
} from './printer-authority-validator';

// Export printer service manager
export {
  createPrinterServiceManager,
  shouldInitializePrinterService,
  type PrinterServiceManager
} from './printer-service-manager';

// Export printer driver queries
export {
  getActiveDrivers,
  getAllDrivers,
  isDriverActive,
  getTimeSinceHeartbeat,
  getDriverStatus,
  type PrinterDriver,
  type DriverQueryResult
} from './printer-driver-queries';

// Re-export venue configuration types for convenience
export type {
  VenueMode,
  AuthorityMode,
  VenueConfiguration
} from './venue-configuration-validation';
