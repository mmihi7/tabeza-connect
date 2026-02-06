/**
 * Printer Service Types and Interfaces
 * 
 * CORE TRUTH: Manual service always exists. 
 * Digital authority is singular. 
 * Tabeza adapts to the venue — never the reverse.
 * 
 * This module defines the core types and interfaces for printer driver detection,
 * ESC/POS protocol communication, and authority-based printer service management.
 */

import { VenueMode, AuthorityMode, VenueConfiguration } from './venue-configuration-validation';

// ============================================================================
// Platform Detection Types
// ============================================================================

export type OperatingSystem = 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'unknown';

export interface Platform {
  os: OperatingSystem;
  browser: string;
  version: string;
  supportsDrivers: boolean;
}

// ============================================================================
// Driver Detection Types
// ============================================================================

export interface DriverDetectionResult {
  platform: Platform;
  driversRequired: boolean;
  driversDetected: boolean;
  installationGuidance?: InstallationGuidance;
  manualVerificationRequired: boolean;
}

export interface InstallationGuidance {
  downloadUrl: string;
  instructions: string[];
  troubleshootingSteps: string[];
  verificationSteps: string[];
}

export interface DriverStatus {
  installed: boolean;
  version?: string;
  compatible: boolean;
  error?: string;
}

// ============================================================================
// Printer Configuration Types
// ============================================================================

export type ConnectionType = 'usb' | 'network' | 'bluetooth';
export type PrinterFeature = 'barcode' | 'qrcode' | 'logo' | 'cut' | 'drawer';

export interface PrinterConfig {
  printerName: string;
  connectionType: ConnectionType;
  ipAddress?: string;
  port?: number;
  tested: boolean;
  capabilities?: PrinterCapabilities;
}

export interface PrinterCapabilities {
  paperWidth: number;
  characterSets: string[];
  supportedFeatures: PrinterFeature[];
  maxLineLength: number;
}

export interface PrinterConnection {
  id: string;
  config: PrinterConfig;
  status: 'connected' | 'disconnected' | 'error';
  lastError?: string;
}

// ============================================================================
// ESC/POS Protocol Types
// ============================================================================

export type ESCPOSCommandType = 'text' | 'cut' | 'feed' | 'align' | 'font' | 'barcode';
export type TextAlignment = 'left' | 'center' | 'right';
export type FontStyle = 'normal' | 'bold' | 'large';

export interface ESCPOSCommand {
  type: ESCPOSCommandType;
  data: string | number;
  parameters?: Record<string, any>;
}

export interface ReceiptSection {
  lines: string[];
  alignment: TextAlignment;
  font: FontStyle;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface VenueInfo {
  name: string;
  location?: string;
  phone?: string;
}

export interface ReceiptMetadata {
  venueInfo: VenueInfo;
  timestamp: Date;
  testMode: boolean;
}

export interface ReceiptData {
  header: ReceiptSection;
  items: ReceiptItem[];
  footer: ReceiptSection;
  metadata: ReceiptMetadata;
}

// ============================================================================
// Printer Testing Types
// ============================================================================

export type PrintQuality = 'good' | 'poor' | 'failed';

export interface TestResult {
  success: boolean;
  timestamp: Date;
  error?: string;
  printQuality?: PrintQuality;
}

// ============================================================================
// Printer Status Monitoring Types
// ============================================================================

export type PrinterStatusType = 'online' | 'offline' | 'paper_out' | 'error' | 'busy';

export interface PrinterStatus {
  status: PrinterStatusType;
  timestamp: Date;
  message?: string;
  errorCode?: string;
}

// ============================================================================
// Print Queue Types
// ============================================================================

export type PrintJobStatus = 'queued' | 'printing' | 'completed' | 'failed' | 'retrying';

export interface PrintJob {
  id: string;
  receiptData: ReceiptData;
  status: PrintJobStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  lastAttemptAt?: Date;
  error?: string;
}

export interface PrintQueueStatus {
  queueLength: number;
  processing: boolean;
  currentJob?: PrintJob;
  failedJobs: PrintJob[];
}

// ============================================================================
// Authority-Based Printer Requirements
// ============================================================================

export type PrinterRequirementReason = 'basic_mode' | 'venue_pos_integration' | 'venue_tabeza_mode';

export interface PrinterRequirement {
  required: boolean;
  reason: PrinterRequirementReason;
  description: string;
}

// ============================================================================
// POS Print Interception Types (Essential Tabeza Basic Workflow)
// ============================================================================

export type ReceiptType = 'order' | 'payment' | 'refund' | 'other';
export type DistributionChoice = 'physical' | 'digital';
export type ConnectionStatus = 'connected' | 'idle' | 'disconnected';
export type DeviceType = 'mobile' | 'desktop';
export type DeliveryMethod = 'immediate' | 'queued';

export interface POSPrintData {
  receiptContent: string;
  printJobId: string;
  timestamp: Date;
  posSystemId: string;
  receiptType: ReceiptType;
}

export interface ParsedReceiptData {
  receiptType: ReceiptType;
  content: string;
  items: ReceiptItem[];
  total: number;
  metadata: {
    posSystemId?: string;
    transactionId?: string;
    timestamp: Date;
  };
}

export interface ConnectedCustomer {
  customerId: string;
  tabId: string;
  tabNumber: number;
  connectionStatus: ConnectionStatus;
  deviceInfo: {
    type: DeviceType;
    lastSeen: Date;
  };
  customerIdentifier: string;
}

export interface CustomerSelection {
  selectedCustomers: ConnectedCustomer[];
  deliveryMethod: DeliveryMethod;
  staffNotes?: string;
}

export interface DeliveryResult {
  deliveryId: string;
  successful: ConnectedCustomer[];
  failed: {
    customer: ConnectedCustomer;
    error: string;
  }[];
  timestamp: Date;
}

export interface InstallationResult {
  success: boolean;
  printerName: string;
  error?: string;
}

export type InterceptionAction = 'forwarded' | 'digitized' | 'cancelled';

export interface InterceptionResult {
  intercepted: boolean;
  printJobId: string;
  action: InterceptionAction;
}

// ============================================================================
// Service Configuration Types
// ============================================================================

export interface PrinterServiceConfig {
  venueMode: VenueMode;
  authorityMode: AuthorityMode;
  printerRequired: boolean;
  posIntegrationEnabled: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

export class InvalidAuthorityConfigurationError extends Error {
  constructor(venueMode: VenueMode, authorityMode: AuthorityMode) {
    super(`Invalid configuration: ${venueMode} mode with ${authorityMode} authority`);
    this.name = 'InvalidAuthorityConfigurationError';
  }
}

export class PrinterRequirementMismatchError extends Error {
  constructor(config: VenueConfiguration) {
    super(`Printer requirement mismatch for configuration: ${JSON.stringify(config)}`);
    this.name = 'PrinterRequirementMismatchError';
  }
}

export class DriverDetectionError extends Error {
  constructor(platform: Platform, reason: string) {
    super(`Driver detection failed for ${platform.os}: ${reason}`);
    this.name = 'DriverDetectionError';
  }
}

export class UnsupportedPlatformError extends Error {
  constructor(platform: Platform) {
    super(`Platform ${platform.os} does not support Tabeza printer drivers`);
    this.name = 'UnsupportedPlatformError';
  }
}

export class PrinterConnectionError extends Error {
  constructor(config: PrinterConfig, reason: string) {
    super(`Failed to connect to printer ${config.printerName}: ${reason}`);
    this.name = 'PrinterConnectionError';
  }
}

export class ESCPOSProtocolError extends Error {
  constructor(command: ESCPOSCommand, error: string) {
    super(`ESC/POS protocol error for command ${command.type}: ${error}`);
    this.name = 'ESCPOSProtocolError';
  }
}

export class PrintTestFailureError extends Error {
  constructor(printerName: string, error: string) {
    super(`Print test failed for ${printerName}: ${error}`);
    this.name = 'PrintTestFailureError';
  }
}
