/**
 * TABEZA Receipt Schema v1
 * Session-based, multi-order transaction truth infrastructure
 * 
 * Main entry point for all receipt schema types, builders, and validators
 */

// ============================================================================
// CORE SCHEMAS & TYPES
// ============================================================================

export {
  // Schema definitions
  MerchantSchema,
  DeviceSchema,
  ReceiptSessionSchema,
  LineItemSchema,
  EventTotalsSchema,
  PaymentSchema,
  ReceiptEventSchema,
  SessionTotalsSchema,
  CompleteReceiptSessionSchema,
  AuditEventSchema,
  
  // TypeScript types
  type Merchant,
  type Device,
  type ReceiptSession,
  type LineItem,
  type EventTotals,
  type Payment,
  type ReceiptEvent,
  type SessionTotals,
  type CompleteReceiptSession,
  type AuditEvent,
  
  // Utility types & enums
  ReceiptEventType,
  SessionStatus,
  PaymentMethod,
  PaymentStatus,
  AuditEventType,
  
  // Schema validation helpers
  validateEventTotals,
  validateSessionTotals,
  canCloseSession,
  computeSessionTotals
} from './session';

// ============================================================================
// BUILDERS & FACTORIES
// ============================================================================

export {
  // Session builders
  createReceiptSession,
  createReceiptEvent,
  createSessionTotals,
  createCompleteSession,
  
  // Audit builders
  createAuditEvent,
  
  // Validation helpers
  validateLineItem,
  validateLineItems,
  
  // Test utilities
  createTestSession
} from './builders';

// ============================================================================
// VALIDATORS & BUSINESS RULES
// ============================================================================

export {
  // Validation types
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
  
  // Core validators
  validateReceiptSession,
  validateReceiptEvent,
  validateCompleteSession,
  
  // Business rule validators
  validateBusinessRules
} from './validators';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

import type { CompleteReceiptSession } from './session';

/**
 * Create a minimal receipt session for quick testing
 */
export function createMinimalSession(merchantName: string, printerId: string) {
  const { createReceiptSession } = require('./builders');
  return createReceiptSession({
    merchantId: `merchant-${Date.now()}`,
    merchantName,
    printerId
  });
}

/**
 * Check if a receipt session is valid for processing
 */
export function isValidForProcessing(session: CompleteReceiptSession): boolean {
  const { validateCompleteSession } = require('./validators');
  const validation = validateCompleteSession(session);
  return validation.valid && validation.score >= 70; // Minimum 70% confidence
}

/**
 * Get session summary for display
 */
export function getSessionSummary(session: CompleteReceiptSession): {
  id: string;
  merchant: string;
  status: string;
  events: number;
  total: number;
  currency: string;
  opened: string;
  closed?: string;
} {
  return {
    id: session.session.session_reference,
    merchant: session.session.merchant.name,
    status: session.session.status,
    events: session.events.length,
    total: session.totals?.total || 0,
    currency: session.session.currency,
    opened: session.session.opened_at,
    closed: session.session.closed_at
  };
}

/**
 * Calculate session health score
 */
export function calculateHealthScore(session: CompleteReceiptSession): {
  score: number;
  issues: string[];
  recommendations: string[];
} {
  const { validateCompleteSession, validateBusinessRules } = require('./validators');
  
  const structuralValidation = validateCompleteSession(session);
  const businessValidation = validateBusinessRules(session);
  
  const score = Math.min(structuralValidation.score, businessValidation.score);
  
  const issues = [
    ...structuralValidation.errors.map((e: any) => e.message),
    ...businessValidation.errors.map((e: any) => e.message)
  ];
  
  const recommendations = [
    ...structuralValidation.warnings.map((w: any) => w.suggestion),
    ...businessValidation.warnings.map((w: any) => w.suggestion)
  ].filter(Boolean);
  
  return { score, issues, recommendations };
}

// ============================================================================
// VERSION & METADATA
// ============================================================================

export const SCHEMA_VERSION = '1.0.0';
export const SCHEMA_NAME = 'TABEZA Receipt Schema';
export const SCHEMA_DESCRIPTION = 'Session-based, multi-order transaction truth infrastructure';

// Export version management utilities
export {
  // Version constants
  CURRENT_SCHEMA_VERSION,
  MINIMUM_SUPPORTED_VERSION,
  
  // Version types
  type VersionCompatibilityResult,
  type SchemaVersionMetadata,
  
  // Version validation functions
  parseVersion,
  compareVersions,
  checkVersionCompatibility,
  getMigrationPath,
  
  // Backward compatibility utilities
  isDataCompatible,
  migrateData,
  validateAgentCompatibility,
  
  // Migration utilities
  hasBreakingChanges,
  getBreakingChanges,
  getMigrationInstructions,
  
  // Version registry
  VERSION_REGISTRY
} from './version';

/**
 * Get schema information
 */
export function getSchemaInfo() {
  return {
    name: SCHEMA_NAME,
    version: SCHEMA_VERSION,
    description: SCHEMA_DESCRIPTION,
    features: [
      'Session-based receipt management',
      'Multi-order transaction support',
      'Comprehensive validation',
      'Audit trail support',
      'Business rule validation',
      'Compliance hint support'
    ],
    supported_currencies: ['KES'],
    supported_jurisdictions: ['KE', 'UG', 'TZ', 'RW']
  };
}