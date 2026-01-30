"use strict";
/**
 * TABEZA Receipt Schema v1
 * Session-based, multi-order transaction truth infrastructure
 *
 * Main entry point for all receipt schema types, builders, and validators
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION_REGISTRY = exports.getMigrationInstructions = exports.getBreakingChanges = exports.hasBreakingChanges = exports.validateAgentCompatibility = exports.migrateData = exports.isDataCompatible = exports.getMigrationPath = exports.checkVersionCompatibility = exports.compareVersions = exports.parseVersion = exports.MINIMUM_SUPPORTED_VERSION = exports.CURRENT_SCHEMA_VERSION = exports.SCHEMA_DESCRIPTION = exports.SCHEMA_NAME = exports.SCHEMA_VERSION = exports.validateBusinessRules = exports.validateCompleteSession = exports.validateReceiptEvent = exports.validateReceiptSession = exports.createTestSession = exports.validateLineItems = exports.validateLineItem = exports.createAuditEvent = exports.createCompleteSession = exports.createSessionTotals = exports.createReceiptEvent = exports.createReceiptSession = exports.computeSessionTotals = exports.canCloseSession = exports.validateSessionTotals = exports.validateEventTotals = exports.AuditEventType = exports.PaymentStatus = exports.PaymentMethod = exports.SessionStatus = exports.ReceiptEventType = exports.AuditEventSchema = exports.CompleteReceiptSessionSchema = exports.SessionTotalsSchema = exports.ReceiptEventSchema = exports.PaymentSchema = exports.EventTotalsSchema = exports.LineItemSchema = exports.ReceiptSessionSchema = exports.DeviceSchema = exports.MerchantSchema = void 0;
exports.createMinimalSession = createMinimalSession;
exports.isValidForProcessing = isValidForProcessing;
exports.getSessionSummary = getSessionSummary;
exports.calculateHealthScore = calculateHealthScore;
exports.getSchemaInfo = getSchemaInfo;
// ============================================================================
// CORE SCHEMAS & TYPES
// ============================================================================
var session_1 = require("./session");
// Schema definitions
Object.defineProperty(exports, "MerchantSchema", { enumerable: true, get: function () { return session_1.MerchantSchema; } });
Object.defineProperty(exports, "DeviceSchema", { enumerable: true, get: function () { return session_1.DeviceSchema; } });
Object.defineProperty(exports, "ReceiptSessionSchema", { enumerable: true, get: function () { return session_1.ReceiptSessionSchema; } });
Object.defineProperty(exports, "LineItemSchema", { enumerable: true, get: function () { return session_1.LineItemSchema; } });
Object.defineProperty(exports, "EventTotalsSchema", { enumerable: true, get: function () { return session_1.EventTotalsSchema; } });
Object.defineProperty(exports, "PaymentSchema", { enumerable: true, get: function () { return session_1.PaymentSchema; } });
Object.defineProperty(exports, "ReceiptEventSchema", { enumerable: true, get: function () { return session_1.ReceiptEventSchema; } });
Object.defineProperty(exports, "SessionTotalsSchema", { enumerable: true, get: function () { return session_1.SessionTotalsSchema; } });
Object.defineProperty(exports, "CompleteReceiptSessionSchema", { enumerable: true, get: function () { return session_1.CompleteReceiptSessionSchema; } });
Object.defineProperty(exports, "AuditEventSchema", { enumerable: true, get: function () { return session_1.AuditEventSchema; } });
// Utility types & enums
Object.defineProperty(exports, "ReceiptEventType", { enumerable: true, get: function () { return session_1.ReceiptEventType; } });
Object.defineProperty(exports, "SessionStatus", { enumerable: true, get: function () { return session_1.SessionStatus; } });
Object.defineProperty(exports, "PaymentMethod", { enumerable: true, get: function () { return session_1.PaymentMethod; } });
Object.defineProperty(exports, "PaymentStatus", { enumerable: true, get: function () { return session_1.PaymentStatus; } });
Object.defineProperty(exports, "AuditEventType", { enumerable: true, get: function () { return session_1.AuditEventType; } });
// Schema validation helpers
Object.defineProperty(exports, "validateEventTotals", { enumerable: true, get: function () { return session_1.validateEventTotals; } });
Object.defineProperty(exports, "validateSessionTotals", { enumerable: true, get: function () { return session_1.validateSessionTotals; } });
Object.defineProperty(exports, "canCloseSession", { enumerable: true, get: function () { return session_1.canCloseSession; } });
Object.defineProperty(exports, "computeSessionTotals", { enumerable: true, get: function () { return session_1.computeSessionTotals; } });
// ============================================================================
// BUILDERS & FACTORIES
// ============================================================================
var builders_1 = require("./builders");
// Session builders
Object.defineProperty(exports, "createReceiptSession", { enumerable: true, get: function () { return builders_1.createReceiptSession; } });
Object.defineProperty(exports, "createReceiptEvent", { enumerable: true, get: function () { return builders_1.createReceiptEvent; } });
Object.defineProperty(exports, "createSessionTotals", { enumerable: true, get: function () { return builders_1.createSessionTotals; } });
Object.defineProperty(exports, "createCompleteSession", { enumerable: true, get: function () { return builders_1.createCompleteSession; } });
// Audit builders
Object.defineProperty(exports, "createAuditEvent", { enumerable: true, get: function () { return builders_1.createAuditEvent; } });
// Validation helpers
Object.defineProperty(exports, "validateLineItem", { enumerable: true, get: function () { return builders_1.validateLineItem; } });
Object.defineProperty(exports, "validateLineItems", { enumerable: true, get: function () { return builders_1.validateLineItems; } });
// Test utilities
Object.defineProperty(exports, "createTestSession", { enumerable: true, get: function () { return builders_1.createTestSession; } });
// ============================================================================
// VALIDATORS & BUSINESS RULES
// ============================================================================
var validators_1 = require("./validators");
// Core validators
Object.defineProperty(exports, "validateReceiptSession", { enumerable: true, get: function () { return validators_1.validateReceiptSession; } });
Object.defineProperty(exports, "validateReceiptEvent", { enumerable: true, get: function () { return validators_1.validateReceiptEvent; } });
Object.defineProperty(exports, "validateCompleteSession", { enumerable: true, get: function () { return validators_1.validateCompleteSession; } });
// Business rule validators
Object.defineProperty(exports, "validateBusinessRules", { enumerable: true, get: function () { return validators_1.validateBusinessRules; } });
/**
 * Create a minimal receipt session for quick testing
 */
function createMinimalSession(merchantName, printerId) {
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
function isValidForProcessing(session) {
    const { validateCompleteSession } = require('./validators');
    const validation = validateCompleteSession(session);
    return validation.valid && validation.score >= 70; // Minimum 70% confidence
}
/**
 * Get session summary for display
 */
function getSessionSummary(session) {
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
function calculateHealthScore(session) {
    const { validateCompleteSession, validateBusinessRules } = require('./validators');
    const structuralValidation = validateCompleteSession(session);
    const businessValidation = validateBusinessRules(session);
    const score = Math.min(structuralValidation.score, businessValidation.score);
    const issues = [
        ...structuralValidation.errors.map((e) => e.message),
        ...businessValidation.errors.map((e) => e.message)
    ];
    const recommendations = [
        ...structuralValidation.warnings.map((w) => w.suggestion),
        ...businessValidation.warnings.map((w) => w.suggestion)
    ].filter(Boolean);
    return { score, issues, recommendations };
}
// ============================================================================
// VERSION & METADATA
// ============================================================================
exports.SCHEMA_VERSION = '1.0.0';
exports.SCHEMA_NAME = 'TABEZA Receipt Schema';
exports.SCHEMA_DESCRIPTION = 'Session-based, multi-order transaction truth infrastructure';
// Export version management utilities
var version_1 = require("./version");
// Version constants
Object.defineProperty(exports, "CURRENT_SCHEMA_VERSION", { enumerable: true, get: function () { return version_1.CURRENT_SCHEMA_VERSION; } });
Object.defineProperty(exports, "MINIMUM_SUPPORTED_VERSION", { enumerable: true, get: function () { return version_1.MINIMUM_SUPPORTED_VERSION; } });
// Version validation functions
Object.defineProperty(exports, "parseVersion", { enumerable: true, get: function () { return version_1.parseVersion; } });
Object.defineProperty(exports, "compareVersions", { enumerable: true, get: function () { return version_1.compareVersions; } });
Object.defineProperty(exports, "checkVersionCompatibility", { enumerable: true, get: function () { return version_1.checkVersionCompatibility; } });
Object.defineProperty(exports, "getMigrationPath", { enumerable: true, get: function () { return version_1.getMigrationPath; } });
// Backward compatibility utilities
Object.defineProperty(exports, "isDataCompatible", { enumerable: true, get: function () { return version_1.isDataCompatible; } });
Object.defineProperty(exports, "migrateData", { enumerable: true, get: function () { return version_1.migrateData; } });
Object.defineProperty(exports, "validateAgentCompatibility", { enumerable: true, get: function () { return version_1.validateAgentCompatibility; } });
// Migration utilities
Object.defineProperty(exports, "hasBreakingChanges", { enumerable: true, get: function () { return version_1.hasBreakingChanges; } });
Object.defineProperty(exports, "getBreakingChanges", { enumerable: true, get: function () { return version_1.getBreakingChanges; } });
Object.defineProperty(exports, "getMigrationInstructions", { enumerable: true, get: function () { return version_1.getMigrationInstructions; } });
// Version registry
Object.defineProperty(exports, "VERSION_REGISTRY", { enumerable: true, get: function () { return version_1.VERSION_REGISTRY; } });
/**
 * Get schema information
 */
function getSchemaInfo() {
    return {
        name: exports.SCHEMA_NAME,
        version: exports.SCHEMA_VERSION,
        description: exports.SCHEMA_DESCRIPTION,
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
//# sourceMappingURL=index.js.map