/**
 * TABEZA Receipt Session Schema v1
 * Session-based, multi-order transaction truth infrastructure
 * 
 * Core Concept: A single TABEZA receipt may contain multiple POS print events
 * (orders, partial bills, refunds), with shared headers and final settlement.
 */

import { z } from 'zod';

// ============================================================================
// A. RECEIPT SESSION (Header - Once per session)
// ============================================================================

export const MerchantSchema = z.object({
  id: z.string().min(1, 'Merchant ID is required'),
  name: z.string().min(1, 'Merchant name is required'),
  kra_pin: z.string().regex(/^P\d{9}[A-Z]$/).optional(),
  registration_no: z.string().optional(),
  location: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional()
});

export const DeviceSchema = z.object({
  printer_id: z.string().min(1, 'Printer ID is required'),
  pos_hint: z.string().optional(), // Brand/model hint from parsing
  connection_type: z.enum(['USB', 'NETWORK', 'BLUETOOTH', 'SERIAL']).optional(),
  location: z.string().optional() // Physical location of printer
});

export const ReceiptSessionSchema = z.object({
  // Immutable identifiers
  tabeza_receipt_id: z.string().min(1, 'TABEZA receipt ID is required'),
  session_reference: z.string().min(1, 'Session reference is required'), // Public-facing ref/QR
  
  // Session metadata (set once, never changes)
  merchant: MerchantSchema,
  device: DeviceSchema,
  
  // Session lifecycle
  opened_at: z.string().datetime(), // ISO 8601
  closed_at: z.string().datetime().optional(),
  
  // Session properties
  currency: z.literal('KES'), // Extensible to other currencies later
  status: z.enum(['OPEN', 'CLOSED']),
  
  // Session context
  table_number: z.string().optional(),
  customer_identifier: z.string().optional(), // Anonymous identifier
  staff_identifier: z.string().optional(),
  
  // Compliance hints (metadata only)
  compliance_hints: z.object({
    jurisdiction: z.enum(['KE', 'UG', 'TZ', 'RW']).optional(),
    business_category: z.enum(['RESTAURANT', 'RETAIL', 'SERVICE', 'OTHER']).optional(),
    requires_tax_submission: z.boolean().optional()
  }).optional()
});

// ============================================================================
// B. RECEIPT EVENTS (Many per session - each POS print = Receipt Event)
// ============================================================================

export const LineItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  sku: z.string().optional(),
  qty: z.number().positive('Quantity must be positive'),
  unit_price: z.number().nonnegative('Unit price cannot be negative'),
  total_price: z.number().nonnegative('Total price cannot be negative'),
  tax_rate: z.number().min(0).max(1).optional(), // 0.16 for 16% VAT
  tax_amount: z.number().nonnegative().optional(),
  discount_amount: z.number().nonnegative().optional(),
  category: z.string().optional(),
  modifiers: z.array(z.string()).optional() // "Extra cheese", "No onions"
});

export const EventTotalsSchema = z.object({
  subtotal: z.number().nonnegative('Subtotal cannot be negative'),
  tax: z.number().nonnegative('Tax cannot be negative'),
  discount: z.number().nonnegative('Discount cannot be negative'),
  service_charge: z.number().nonnegative('Service charge cannot be negative'),
  total: z.number().nonnegative('Total cannot be negative')
});

export const PaymentSchema = z.object({
  method: z.enum(['MPESA', 'CASH', 'CARD', 'BANK', 'OTHER']),
  reference: z.string().optional(), // M-Pesa code, card last 4 digits, etc.
  amount: z.number().positive('Payment amount must be positive'),
  currency: z.literal('KES'),
  processed_at: z.string().datetime().optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']).default('PENDING')
});

export const ReceiptEventSchema = z.object({
  // Event identity
  event_id: z.string().min(1, 'Event ID is required'),
  session_id: z.string().min(1, 'Session ID is required'), // Links to ReceiptSession
  
  // Source tracking
  source_receipt_no: z.string().optional(), // Original POS receipt number
  printed_at: z.string().datetime(), // When this event was printed
  
  // Event classification
  type: z.enum(['SALE', 'REFUND', 'VOID', 'ADJUSTMENT', 'PARTIAL_BILL']),
  sequence: z.number().int().positive('Sequence must be positive'), // Order within session
  
  // Event content
  items: z.array(LineItemSchema).min(0), // Can be empty for payments-only events
  totals: EventTotalsSchema,
  payment: PaymentSchema.optional(),
  
  // Integrity & audit
  raw_hash: z.string().min(1, 'Raw hash is required'), // Hash of original print data
  parsed_confidence: z.number().min(0).max(1), // Parsing confidence score
  
  // Metadata
  notes: z.string().optional(),
  staff_notes: z.string().optional(),
  customer_notes: z.string().optional()
});

// ============================================================================
// C. SESSION TOTALS (Computed once when session closes)
// ============================================================================

export const SessionTotalsSchema = z.object({
  // Aggregated from all events
  subtotal: z.number().nonnegative('Subtotal cannot be negative'),
  tax: z.number().nonnegative('Tax cannot be negative'),
  discount: z.number().nonnegative('Discount cannot be negative'),
  service_charge: z.number().nonnegative('Service charge cannot be negative'),
  total: z.number().nonnegative('Total cannot be negative'),
  
  // Payment tracking
  paid: z.number().nonnegative('Paid amount cannot be negative'),
  balance: z.number().optional(), // Can be negative (overpaid) or positive (underpaid)
  
  // Event summary
  total_events: z.number().int().nonnegative('Total events cannot be negative'),
  sale_events: z.number().int().nonnegative('Sale events cannot be negative'),
  refund_events: z.number().int().nonnegative('Refund events cannot be negative'),
  void_events: z.number().int().nonnegative('Void events cannot be negative'),
  
  // Computed at session close
  computed_at: z.string().datetime()
});

// ============================================================================
// D. COMPLETE SESSION (Session + Events + Totals)
// ============================================================================

export const CompleteReceiptSessionSchema = z.object({
  session: ReceiptSessionSchema,
  events: z.array(ReceiptEventSchema),
  totals: SessionTotalsSchema.optional(), // Only present when session is closed
  
  // Audit trail
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  version: z.literal('1.0.0') // Schema version
});

// ============================================================================
// E. AUDIT & IMMUTABILITY SUPPORT
// ============================================================================

export const AuditEventSchema = z.object({
  id: z.string().min(1, 'Audit event ID is required'),
  type: z.enum([
    'SESSION_OPENED',
    'RECEIPT_CAPTURED', 
    'SESSION_CLOSED',
    'PAYMENT_PROCESSED',
    'ETIMS_SUBMITTED',
    'COMPLIANCE_CHECKED',
    'DATA_CORRECTED' // Only allowed correction type
  ]),
  entity_id: z.string().min(1, 'Entity ID is required'), // session_id or event_id
  entity_type: z.enum(['SESSION', 'EVENT', 'PAYMENT']),
  
  // Audit metadata
  timestamp: z.string().datetime(),
  actor: z.string().optional(), // Who/what caused this event
  source: z.enum(['PRINTER', 'STAFF', 'SYSTEM', 'API']),
  
  // Integrity chain
  hash: z.string().min(1, 'Hash is required'),
  previous_hash: z.string().optional(), // Creates hash chain
  
  // Event data
  data: z.record(z.any()).optional(), // Flexible data payload
  metadata: z.record(z.any()).optional() // Additional context
});

// ============================================================================
// F. TYPESCRIPT TYPES (Derived from schemas)
// ============================================================================

export type Merchant = z.infer<typeof MerchantSchema>;
export type Device = z.infer<typeof DeviceSchema>;
export type ReceiptSession = z.infer<typeof ReceiptSessionSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
export type EventTotals = z.infer<typeof EventTotalsSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type ReceiptEvent = z.infer<typeof ReceiptEventSchema>;
export type SessionTotals = z.infer<typeof SessionTotalsSchema>;
export type CompleteReceiptSession = z.infer<typeof CompleteReceiptSessionSchema>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;

// ============================================================================
// G. UTILITY TYPES & ENUMS
// ============================================================================

export const ReceiptEventType = {
  SALE: 'SALE',
  REFUND: 'REFUND', 
  VOID: 'VOID',
  ADJUSTMENT: 'ADJUSTMENT',
  PARTIAL_BILL: 'PARTIAL_BILL'
} as const;

export const SessionStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED'
} as const;

export const PaymentMethod = {
  MPESA: 'MPESA',
  CASH: 'CASH',
  CARD: 'CARD',
  BANK: 'BANK',
  OTHER: 'OTHER'
} as const;

export const PaymentStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
} as const;

export const AuditEventType = {
  SESSION_OPENED: 'SESSION_OPENED',
  RECEIPT_CAPTURED: 'RECEIPT_CAPTURED',
  SESSION_CLOSED: 'SESSION_CLOSED',
  PAYMENT_PROCESSED: 'PAYMENT_PROCESSED',
  ETIMS_SUBMITTED: 'ETIMS_SUBMITTED',
  COMPLIANCE_CHECKED: 'COMPLIANCE_CHECKED',
  DATA_CORRECTED: 'DATA_CORRECTED'
} as const;

// ============================================================================
// H. VALIDATION HELPERS
// ============================================================================

/**
 * Validate that event totals are mathematically correct
 */
export function validateEventTotals(totals: EventTotals): boolean {
  const calculated = totals.subtotal + totals.tax + totals.service_charge - totals.discount;
  return Math.abs(calculated - totals.total) < 0.01; // Allow 1 cent rounding
}

/**
 * Validate that session totals match aggregated events
 */
export function validateSessionTotals(
  sessionTotals: SessionTotals, 
  events: ReceiptEvent[]
): boolean {
  const aggregated = events.reduce((acc, event) => ({
    subtotal: acc.subtotal + event.totals.subtotal,
    tax: acc.tax + event.totals.tax,
    discount: acc.discount + event.totals.discount,
    service_charge: acc.service_charge + event.totals.service_charge,
    total: acc.total + event.totals.total
  }), { subtotal: 0, tax: 0, discount: 0, service_charge: 0, total: 0 });

  return (
    Math.abs(aggregated.subtotal - sessionTotals.subtotal) < 0.01 &&
    Math.abs(aggregated.tax - sessionTotals.tax) < 0.01 &&
    Math.abs(aggregated.discount - sessionTotals.discount) < 0.01 &&
    Math.abs(aggregated.service_charge - sessionTotals.service_charge) < 0.01 &&
    Math.abs(aggregated.total - sessionTotals.total) < 0.01
  );
}

/**
 * Check if a session can be closed
 */
export function canCloseSession(session: ReceiptSession, events: ReceiptEvent[]): boolean {
  return (
    session.status === 'OPEN' &&
    events.length > 0 &&
    events.every(event => event.parsed_confidence > 0.5) // All events must be reasonably parsed
  );
}