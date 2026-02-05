/**
 * TABEZA Receipt Schema v1
 * Session-based, multi-order transaction truth infrastructure
 *
 * Main entry point for all receipt schema types, builders, and validators
 */
export { MerchantSchema, DeviceSchema, ReceiptSessionSchema, LineItemSchema, EventTotalsSchema, PaymentSchema, ReceiptEventSchema, SessionTotalsSchema, CompleteReceiptSessionSchema, AuditEventSchema, type Merchant, type Device, type ReceiptSession, type LineItem, type EventTotals, type Payment, type ReceiptEvent, type SessionTotals, type CompleteReceiptSession, type AuditEvent, ReceiptEventType, SessionStatus, PaymentMethod, PaymentStatus, AuditEventType, validateEventTotals, validateSessionTotals, canCloseSession, computeSessionTotals } from './session';
export { createReceiptSession, createReceiptEvent, createSessionTotals, createCompleteSession, createAuditEvent, validateLineItem, validateLineItems, createTestSession } from './builders';
export { type ValidationResult, type ValidationError, type ValidationWarning, validateReceiptSession, validateReceiptEvent, validateCompleteSession, validateBusinessRules } from './validators';
import type { CompleteReceiptSession } from './session';
/**
 * Create a minimal receipt session for quick testing
 */
export declare function createMinimalSession(merchantName: string, printerId: string): any;
/**
 * Check if a receipt session is valid for processing
 */
export declare function isValidForProcessing(session: CompleteReceiptSession): boolean;
/**
 * Get session summary for display
 */
export declare function getSessionSummary(session: CompleteReceiptSession): {
    id: string;
    merchant: string;
    status: string;
    events: number;
    total: number;
    currency: string;
    opened: string;
    closed?: string;
};
/**
 * Calculate session health score
 */
export declare function calculateHealthScore(session: CompleteReceiptSession): {
    score: number;
    issues: string[];
    recommendations: string[];
};
export declare const SCHEMA_VERSION = "1.0.0";
export declare const SCHEMA_NAME = "TABEZA Receipt Schema";
export declare const SCHEMA_DESCRIPTION = "Session-based, multi-order transaction truth infrastructure";
export { CURRENT_SCHEMA_VERSION, MINIMUM_SUPPORTED_VERSION, type VersionCompatibilityResult, type SchemaVersionMetadata, parseVersion, compareVersions, checkVersionCompatibility, getMigrationPath, isDataCompatible, migrateData, validateAgentCompatibility, hasBreakingChanges, getBreakingChanges, getMigrationInstructions, VERSION_REGISTRY } from './version';
/**
 * Get schema information
 */
export declare function getSchemaInfo(): {
    name: string;
    version: string;
    description: string;
    features: string[];
    supported_currencies: string[];
    supported_jurisdictions: string[];
};
//# sourceMappingURL=index.d.ts.map