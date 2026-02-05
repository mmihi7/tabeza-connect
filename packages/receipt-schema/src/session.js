"use strict";
/**
 * TABEZA Receipt Session Schema v1
 * Session-based, multi-order transaction truth infrastructure
 *
 * Core Concept: A single TABEZA receipt may contain multiple POS print events
 * (orders, partial bills, refunds), with shared headers and final settlement.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditEventType = exports.PaymentStatus = exports.PaymentMethod = exports.SessionStatus = exports.ReceiptEventType = exports.AuditEventSchema = exports.CompleteReceiptSessionSchema = exports.SessionTotalsSchema = exports.ReceiptEventSchema = exports.PaymentSchema = exports.EventTotalsSchema = exports.LineItemSchema = exports.ReceiptSessionSchema = exports.DeviceSchema = exports.MerchantSchema = void 0;
exports.validateEventTotals = validateEventTotals;
exports.validateSessionTotals = validateSessionTotals;
exports.canCloseSession = canCloseSession;
exports.computeSessionTotals = computeSessionTotals;
const zod_1 = require("zod");
// ============================================================================
// A. RECEIPT SESSION (Header - Once per session)
// ============================================================================
exports.MerchantSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, 'Merchant ID is required'),
    name: zod_1.z.string().min(1, 'Merchant name is required'),
    kra_pin: zod_1.z.string().regex(/^P\d{9}[A-Z]$/).optional(),
    registration_no: zod_1.z.string().optional(),
    location: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional()
});
exports.DeviceSchema = zod_1.z.object({
    printer_id: zod_1.z.string().min(1, 'Printer ID is required'),
    pos_hint: zod_1.z.string().optional(), // Brand/model hint from parsing
    connection_type: zod_1.z.enum(['USB', 'NETWORK', 'BLUETOOTH', 'SERIAL']).optional(),
    location: zod_1.z.string().optional() // Physical location of printer
});
exports.ReceiptSessionSchema = zod_1.z.object({
    // Immutable identifiers
    tabeza_receipt_id: zod_1.z.string().min(1, 'TABEZA receipt ID is required'),
    session_reference: zod_1.z.string().min(1, 'Session reference is required'), // Public-facing ref/QR
    // Session metadata (set once, never changes)
    merchant: exports.MerchantSchema,
    device: exports.DeviceSchema,
    // Session lifecycle
    opened_at: zod_1.z.string().datetime(), // ISO 8601
    closed_at: zod_1.z.string().datetime().optional(),
    // Session properties
    currency: zod_1.z.literal('KES'), // Extensible to other currencies later
    status: zod_1.z.enum(['OPEN', 'CLOSED']),
    // Session context
    table_number: zod_1.z.string().optional(),
    customer_identifier: zod_1.z.string().optional(), // Anonymous identifier
    staff_identifier: zod_1.z.string().optional(),
    // Compliance hints (metadata only)
    compliance_hints: zod_1.z.object({
        jurisdiction: zod_1.z.enum(['KE', 'UG', 'TZ', 'RW']).optional(),
        business_category: zod_1.z.enum(['RESTAURANT', 'RETAIL', 'SERVICE', 'OTHER']).optional(),
        requires_tax_submission: zod_1.z.boolean().optional()
    }).optional()
});
// ============================================================================
// B. RECEIPT EVENTS (Many per session - each POS print = Receipt Event)
// ============================================================================
exports.LineItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Item name is required'),
    sku: zod_1.z.string().optional(),
    qty: zod_1.z.number().positive('Quantity must be positive'),
    unit_price: zod_1.z.number().nonnegative('Unit price cannot be negative'),
    total_price: zod_1.z.number().nonnegative('Total price cannot be negative'),
    tax_rate: zod_1.z.number().min(0).max(1).optional(), // 0.16 for 16% VAT
    tax_amount: zod_1.z.number().nonnegative().optional(),
    discount_amount: zod_1.z.number().nonnegative().optional(),
    category: zod_1.z.string().optional(),
    modifiers: zod_1.z.array(zod_1.z.string()).optional() // "Extra cheese", "No onions"
});
exports.EventTotalsSchema = zod_1.z.object({
    subtotal: zod_1.z.number().nonnegative('Subtotal cannot be negative'),
    tax: zod_1.z.number().nonnegative('Tax cannot be negative'),
    discount: zod_1.z.number().nonnegative('Discount cannot be negative'),
    service_charge: zod_1.z.number().nonnegative('Service charge cannot be negative'),
    total: zod_1.z.number().nonnegative('Total cannot be negative')
});
exports.PaymentSchema = zod_1.z.object({
    method: zod_1.z.enum(['MPESA', 'CASH', 'CARD', 'BANK', 'OTHER']),
    reference: zod_1.z.string().optional(), // M-Pesa code, card last 4 digits, etc.
    amount: zod_1.z.number().positive('Payment amount must be positive'),
    currency: zod_1.z.literal('KES'),
    processed_at: zod_1.z.string().datetime().optional(),
    status: zod_1.z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']).default('PENDING')
});
exports.ReceiptEventSchema = zod_1.z.object({
    // Event identity
    event_id: zod_1.z.string().min(1, 'Event ID is required'),
    session_id: zod_1.z.string().min(1, 'Session ID is required'), // Links to ReceiptSession
    // Source tracking
    source_receipt_no: zod_1.z.string().optional(), // Original POS receipt number
    printed_at: zod_1.z.string().datetime(), // When this event was printed
    // Event classification
    type: zod_1.z.enum(['SALE', 'REFUND', 'VOID', 'ADJUSTMENT', 'PARTIAL_BILL']),
    sequence: zod_1.z.number().int().positive('Sequence must be positive'), // Order within session
    // Event content
    items: zod_1.z.array(exports.LineItemSchema).min(0), // Can be empty for payments-only events
    totals: exports.EventTotalsSchema,
    payment: exports.PaymentSchema.optional(),
    // Integrity & audit
    raw_hash: zod_1.z.string().min(1, 'Raw hash is required'), // Hash of original print data
    parsed_confidence: zod_1.z.number().min(0).max(1), // Parsing confidence score
    // Metadata
    notes: zod_1.z.string().optional(),
    staff_notes: zod_1.z.string().optional(),
    customer_notes: zod_1.z.string().optional()
});
// ============================================================================
// C. SESSION TOTALS (Computed once when session closes)
// ============================================================================
exports.SessionTotalsSchema = zod_1.z.object({
    // Aggregated from all events
    subtotal: zod_1.z.number().nonnegative('Subtotal cannot be negative'),
    tax: zod_1.z.number().nonnegative('Tax cannot be negative'),
    discount: zod_1.z.number().nonnegative('Discount cannot be negative'),
    service_charge: zod_1.z.number().nonnegative('Service charge cannot be negative'),
    total: zod_1.z.number().nonnegative('Total cannot be negative'),
    // Payment tracking
    paid: zod_1.z.number().nonnegative('Paid amount cannot be negative'),
    balance: zod_1.z.number().optional(), // Can be negative (overpaid) or positive (underpaid)
    // Event summary
    total_events: zod_1.z.number().int().nonnegative('Total events cannot be negative'),
    sale_events: zod_1.z.number().int().nonnegative('Sale events cannot be negative'),
    refund_events: zod_1.z.number().int().nonnegative('Refund events cannot be negative'),
    void_events: zod_1.z.number().int().nonnegative('Void events cannot be negative'),
    // Computed at session close
    computed_at: zod_1.z.string().datetime()
});
// ============================================================================
// D. COMPLETE SESSION (Session + Events + Totals)
// ============================================================================
exports.CompleteReceiptSessionSchema = zod_1.z.object({
    session: exports.ReceiptSessionSchema,
    events: zod_1.z.array(exports.ReceiptEventSchema),
    totals: exports.SessionTotalsSchema.optional(), // Only present when session is closed
    // Audit trail
    created_at: zod_1.z.string().datetime(),
    updated_at: zod_1.z.string().datetime(),
    version: zod_1.z.literal('1.0.0') // Schema version
});
// ============================================================================
// E. AUDIT & IMMUTABILITY SUPPORT
// ============================================================================
exports.AuditEventSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, 'Audit event ID is required'),
    type: zod_1.z.enum([
        'SESSION_OPENED',
        'RECEIPT_CAPTURED',
        'SESSION_CLOSED',
        'PAYMENT_PROCESSED',
        'ETIMS_SUBMITTED',
        'COMPLIANCE_CHECKED',
        'DATA_CORRECTED' // Only allowed correction type
    ]),
    entity_id: zod_1.z.string().min(1, 'Entity ID is required'), // session_id or event_id
    entity_type: zod_1.z.enum(['SESSION', 'EVENT', 'PAYMENT']),
    // Audit metadata
    timestamp: zod_1.z.string().datetime(),
    actor: zod_1.z.string().optional(), // Who/what caused this event
    source: zod_1.z.enum(['PRINTER', 'STAFF', 'SYSTEM', 'API']),
    // Integrity chain
    hash: zod_1.z.string().min(1, 'Hash is required'),
    previous_hash: zod_1.z.string().optional(), // Creates hash chain
    // Event data
    data: zod_1.z.record(zod_1.z.any()).optional(), // Flexible data payload
    metadata: zod_1.z.record(zod_1.z.any()).optional() // Additional context
});
// ============================================================================
// G. UTILITY TYPES & ENUMS
// ============================================================================
exports.ReceiptEventType = {
    SALE: 'SALE',
    REFUND: 'REFUND',
    VOID: 'VOID',
    ADJUSTMENT: 'ADJUSTMENT',
    PARTIAL_BILL: 'PARTIAL_BILL'
};
exports.SessionStatus = {
    OPEN: 'OPEN',
    CLOSED: 'CLOSED'
};
exports.PaymentMethod = {
    MPESA: 'MPESA',
    CASH: 'CASH',
    CARD: 'CARD',
    BANK: 'BANK',
    OTHER: 'OTHER'
};
exports.PaymentStatus = {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED'
};
exports.AuditEventType = {
    SESSION_OPENED: 'SESSION_OPENED',
    RECEIPT_CAPTURED: 'RECEIPT_CAPTURED',
    SESSION_CLOSED: 'SESSION_CLOSED',
    PAYMENT_PROCESSED: 'PAYMENT_PROCESSED',
    ETIMS_SUBMITTED: 'ETIMS_SUBMITTED',
    COMPLIANCE_CHECKED: 'COMPLIANCE_CHECKED',
    DATA_CORRECTED: 'DATA_CORRECTED'
};
// ============================================================================
// H. VALIDATION HELPERS
// ============================================================================
/**
 * Validate that event totals are mathematically correct
 */
function validateEventTotals(totals) {
    const calculated = totals.subtotal + totals.tax + totals.service_charge - totals.discount;
    return Math.abs(calculated - totals.total) < 0.01; // Allow 1 cent rounding
}
/**
 * Validate that session totals match aggregated events
 */
function validateSessionTotals(sessionTotals, events) {
    const aggregated = events.reduce((acc, event) => ({
        subtotal: acc.subtotal + event.totals.subtotal,
        tax: acc.tax + event.totals.tax,
        discount: acc.discount + event.totals.discount,
        service_charge: acc.service_charge + event.totals.service_charge,
        total: acc.total + event.totals.total
    }), { subtotal: 0, tax: 0, discount: 0, service_charge: 0, total: 0 });
    return (Math.abs(aggregated.subtotal - sessionTotals.subtotal) < 0.01 &&
        Math.abs(aggregated.tax - sessionTotals.tax) < 0.01 &&
        Math.abs(aggregated.discount - sessionTotals.discount) < 0.01 &&
        Math.abs(aggregated.service_charge - sessionTotals.service_charge) < 0.01 &&
        Math.abs(aggregated.total - sessionTotals.total) < 0.01);
}
/**
 * Check if a session can be closed
 */
function canCloseSession(session, events) {
    return (session.status === 'OPEN' &&
        events.length > 0 &&
        events.every(event => event.parsed_confidence > 0.5) // All events must be reasonably parsed
    );
}
/**
 * Compute session totals from events (alias for createSessionTotals)
 */
function computeSessionTotals(events) {
    const aggregated = events.reduce((acc, event) => {
        // Handle different event types
        const multiplier = event.type === 'REFUND' || event.type === 'VOID' ? -1 : 1;
        return {
            subtotal: acc.subtotal + (event.totals.subtotal * multiplier),
            tax: acc.tax + (event.totals.tax * multiplier),
            discount: acc.discount + (event.totals.discount * multiplier),
            service_charge: acc.service_charge + (event.totals.service_charge * multiplier),
            total: acc.total + (event.totals.total * multiplier)
        };
    }, { subtotal: 0, tax: 0, discount: 0, service_charge: 0, total: 0 });
    // Calculate payments
    const paid = events
        .filter(event => event.payment?.status === 'COMPLETED')
        .reduce((sum, event) => sum + (event.payment?.amount || 0), 0);
    // Count events by type
    const eventCounts = events.reduce((counts, event) => {
        counts.total_events++;
        switch (event.type) {
            case 'SALE':
            case 'PARTIAL_BILL':
                counts.sale_events++;
                break;
            case 'REFUND':
                counts.refund_events++;
                break;
            case 'VOID':
                counts.void_events++;
                break;
        }
        return counts;
    }, { total_events: 0, sale_events: 0, refund_events: 0, void_events: 0 });
    return {
        ...aggregated,
        paid,
        balance: aggregated.total - paid,
        ...eventCounts,
        computed_at: new Date().toISOString()
    };
}
//# sourceMappingURL=session.js.map